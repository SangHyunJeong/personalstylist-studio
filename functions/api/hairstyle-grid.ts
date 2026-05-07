import { requireAuthenticatedUser } from './_supabaseAuth'

interface Env {
  GEMINI_API_KEY?: string
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

interface PagesContext {
  request: Request
  env: Env
}

type GeminiPart = {
  text?: string
  inlineData?: {
    data?: string
    mimeType?: string
  }
  inline_data?: {
    data?: string
    mime_type?: string
  }
}

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[]
  }
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
  error?: {
    message?: string
  }
}

const IMAGE_MODELS = ['gemini-3-pro-image-preview']

const TEXT_FALLBACK_MODEL = 'gemini-3-flash-preview'

const jsonResponse = (
  body: Record<string, string | boolean>,
  status: number,
) =>
  Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

const isLocationRestrictedError = (message?: string) =>
  message?.toLowerCase().includes('user location is not supported') ?? false

const getBaseApiUrl = (server?: string) =>
  server === 'sandbox'
    ? 'https://sandbox-api.polar.sh'
    : 'https://api.polar.sh'

const parseGeminiResponse = async (response: Response) => {
  const rawText = await response.text()
  return rawText.trim()
    ? (JSON.parse(rawText) as GeminiResponse)
    : null
}

const callGemini = async ({
  model,
  env,
  parts,
  maxOutputTokens,
}: {
  model: string
  env: Env
  parts: Array<Record<string, unknown>>
  maxOutputTokens: number
}) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY ?? '',
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.9,
          topK: 32,
          topP: 0.95,
          maxOutputTokens,
        },
      }),
    },
  )

  const json = await parseGeminiResponse(response)

  return {
    response,
    json,
  }
}

const refundOrder = async ({
  env,
  orderId,
}: {
  env: Env
  orderId?: string
}) => {
  if (!env.POLAR_ACCESS_TOKEN || !orderId) {
    return false
  }

  const response = await fetch(`${getBaseApiUrl(env.POLAR_SERVER)}/v1/refunds/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: orderId,
      reason: 'Automatic refund after hairstyle generation failure',
    }),
  })

  return response.ok
}

const extractText = (parts: GeminiPart[] = []) =>
  parts
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')

const extractImage = (parts: GeminiPart[] = []) => {
  const imagePart = parts.find((part) => {
    const inlineData = part.inlineData ?? part.inline_data
    return Boolean(inlineData?.data)
  })

  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data

  return {
    imageBase64: inlineData?.data,
    mimeType: inlineData?.mimeType ?? inlineData?.mime_type,
  }
}

const buildHairImagePrompt = (preferredLocale?: string) =>
  [
    'You are Personal AI Stylist acting as a senior salon creative director and face-shape analyst.',
    'Analyze the attached photo and create one 3x3 grid with nine hairstyle recommendations tailored to this exact person.',
    'Preserve the exact face, identity, skin tone, age impression, and facial structure. Change the hair only.',
    'Base the recommendations on visible cues such as face shape tendency, forehead width, jawline, cheek balance, neckline impression, apparent hair density or texture if visible, and overall image balance.',
    'Use professional criteria: face-shape balancing, V-zone harmony around the face, vertical versus horizontal volume control, style essence compatibility, and maintenance diversity.',
    'Create nine options that are meaningfully different in length, layering, parting, fringe, texture, volume placement, and polish level, while keeping every option realistic and wearable for this person.',
    'The final collage must be photorealistic, salon-reference quality, evenly lit, and visually consistent across all nine panels.',
    'Also return short text descriptions in the user language using markdown headings and bullet lines.',
    'Localize the writing to the user preferred language: Korean for ko, Japanese for ja, Chinese for zh, otherwise English.',
    'Use this exact structure for the text portion, with localized section titles:',
    '### Recommendation Summary',
    '* 2-3 bullets on the overall hairstyle strategy, volume placement, and face-balancing logic',
    '### 9 Style Notes',
    '* Provide exactly 9 bullets, one for each style, in the format: number + style name + key cut or texture details + why it suits the person + maintenance level',
    `User locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

const buildHairFallbackPromptRequest = (preferredLocale?: string) =>
  [
    'You are Personal AI Stylist acting as both a senior hair consultant and a prompt engineer.',
    'Analyze the attached photo and write portable content that the user can paste directly into an external image generation tool such as ChatGPT or Gemini.',
    'Base the recommendation on professional criteria: face-shape balancing, V-zone harmony, volume placement, overall image essence, and maintenance practicality.',
    'The external prompt must explicitly preserve the same face and identity, change only the hair, and request one realistic 3x3 hairstyle collage.',
    'Write in the user preferred language: Korean for ko, Japanese for ja, Chinese for zh, otherwise English.',
    'Use markdown headings and bullet lines. Keep the section order exactly as follows, but localize the section titles:',
    '### Diagnostic Summary',
    '* 2-3 bullets explaining the hairstyle direction and the balancing logic',
    '### Design Principles',
    '* 3-5 bullets covering face balance, fringe or parting logic, volume placement, and maintenance range',
    '### Copy Prompt',
    '* one complete prompt that can be pasted into an external image model',
    '### 9 Style Notes',
    '* exactly 9 bullets, one for each hairstyle, including the style name, distinguishing cut details, why it works, and maintenance level',
    `User locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

const buildHairExternalPrompt = ({
  preferredLocale,
  styleSummary,
}: {
  preferredLocale?: string
  styleSummary?: string
}) =>
  [
    'You are a senior salon creative director generating a 3x3 hairstyle board for the exact same person shown in the attached reference photo.',
    'Preserve the exact same face, identity, skin tone, age impression, and facial structure. Change the hair only.',
    'Design the hairstyles using these professional criteria: face-shape and jawline balance, forehead and cheek balance, V-zone harmony, vertical versus horizontal volume control, image essence consistency, and realistic maintenance diversity.',
    'Create one single 3x3 collage containing nine distinct hairstyles that all suit this person, with clear differences in length, layers, fringe, parting, texture, volume placement, and finish.',
    'Keep the output photorealistic, salon-reference quality, and consistent across all nine panels.',
    'Do not add hats, text overlays, split screens, extra accessories, facial changes, or beauty filters that change the identity.',
    styleSummary
      ? `Use this recommendation summary and style logic as guidance:
${styleSummary}`
      : '',
    `User locale: ${preferredLocale || 'en-US'}.`,
  ]
    .filter(Boolean)
    .join('\n\n')

const buildGenericHairFallbackPromptRequest = (preferredLocale?: string) =>
  [
    'You are Personal AI Stylist acting as a senior hair consultant and prompt engineer.',
    'Write a professional hairstyle recommendation package that the user can paste into an external image generation tool even without a successful in-app render.',
    'The prompt must preserve the same face from the source photo, change only the hair, and request one photorealistic 3x3 collage with nine hairstyle options.',
    'Use professional evaluation criteria: face-shape balancing, V-zone harmony, volume control, image essence, and maintenance range.',
    'Also provide names and characteristics for nine recommended hairstyles.',
    'Write in the user preferred language: Korean for ko, Japanese for ja, Chinese for zh, otherwise English.',
    'Use markdown headings and bullet lines. Keep the section order exactly as follows, but localize the section titles:',
    '### Diagnostic Summary',
    '* 2-3 bullets that summarize the hairstyle direction',
    '### Design Principles',
    '* 3-5 bullets on the haircut logic and what to prioritize',
    '### Copy Prompt',
    '* one complete external image prompt',
    '### 9 Style Notes',
    '* exactly 9 bullets with the style name, key cut details, why it works, and maintenance level',
    `User locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

const buildOfflineHairFallbackDescription = (preferredLocale?: string) =>
  isKoreanLocale(preferredLocale)
    ? [
        '### Recommendation Summary',
        '* 현재 이미지 생성 API의 지역 제한 때문에 서버에서 직접 3x3 헤어 이미지를 만들 수 없습니다.',
        '* 대신 얼굴 균형, 볼륨 배치, 유지보수 난이도를 기준으로 외부 생성형 AI에서 바로 사용할 수 있는 전문 헤어 브리프를 제공합니다.',
        '',
        '### Design Principles',
        '* 얼굴 주변은 옆 폭을 무조건 키우기보다 정수리, 앞머리, 가르마 위치로 균형을 조정하는 접근이 안정적입니다.',
        '* 길이와 레이어는 턱선과 광대 부근의 시각적 무게를 분산시키는 방향으로 고르는 것이 좋습니다.',
        '* 유지보수 난이도는 low, medium, high로 나누어 일상 적합성과 스타일 변화를 함께 확보하세요.',
        '',
        '### 9 Style Notes',
        '* 1. 내추럴 미디엄 레이어: 자연 가르마와 부드러운 층으로 얼굴선을 정리, maintenance: low-medium',
        '* 2. 시스루 뱅 소프트 볼륨: 이마 노출을 조절해 인상을 부드럽게 정리, maintenance: medium',
        '* 3. 클래식 쇼트 정돈 컷: 실루엣이 깔끔해 이목구비가 또렷하게 보임, maintenance: low',
        '* 4. 텍스처 리프컷: 층과 결을 살려 세련된 움직임을 더함, maintenance: medium',
        '* 5. 페이스 프레이밍 웨이브 보브: 턱선 주변 균형을 잡아 주는 부드러운 볼륨, maintenance: medium',
        '* 6. 스마트 사이드 파트 컷: 단정한 분할감으로 도시적인 인상을 강화, maintenance: low-medium',
        '* 7. 허쉬 레이어 또는 소프트 울프 무드: 상단 볼륨으로 스타일 에센스를 살리는 옵션, maintenance: medium-high',
        '* 8. 세미 웨이브 미디 길이: 강하지 않은 컬감으로 친근하고 세련된 인상 형성, maintenance: medium',
        '* 9. 로우 메인터넌스 데일리 컷: 손질 부담이 적고 반복 착장과도 잘 어울림, maintenance: low',
      ].join('\n')
    : [
        '### Recommendation Summary',
        '* The image generation API is restricted for this location, so the app cannot render the 3x3 hairstyle board directly on the server.',
        '* Instead, this fallback gives you a professional hair brief you can reuse in an external image tool, based on facial balance, volume placement, and maintenance range.',
        '',
        '### Design Principles',
        '* Balance is usually strongest when volume is controlled through the crown, fringe, or part line instead of simply widening the sides of the face.',
        '* Length and layers should distribute visual weight around the jaw and cheek area rather than piling bulk into one zone.',
        '* Split the options across low, medium, and high maintenance so the board includes both practical and higher-impact choices.',
        '',
        '### 9 Style Notes',
        '* 1. Natural medium layers: soft movement with a natural part to clean up the face line, maintenance: low-medium',
        '* 2. Soft see-through fringe volume: controlled forehead framing for a gentler impression, maintenance: medium',
        '* 3. Classic polished short cut: clear silhouette that sharpens the facial features, maintenance: low',
        '* 4. Textured leaf cut: layered texture for modern movement and softness, maintenance: medium',
        '* 5. Face-framing wave bob: balanced volume that supports the jawline area, maintenance: medium',
        '* 6. Smart side-part cut: refined directional line for a cleaner urban mood, maintenance: low-medium',
        '* 7. Hush layer or soft wolf mood cut: upper-volume option with more style presence, maintenance: medium-high',
        '* 8. Semi-wave medium style: calm texture that reads polished without looking severe, maintenance: medium',
        '* 9. Low-maintenance daily cut: easy repeat styling that still keeps a considered shape, maintenance: low',
      ].join('\n')

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context
  let preferredLocale: string | undefined
  let orderId: string | undefined

  try {
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        {
          error: 'Cloudflare Pages environment variable GEMINI_API_KEY is not set.',
        },
        500,
      )
    }

    let body: {
        imageBase64?: string
        mimeType?: string
        preferredLocale?: string
        orderId?: string
      }

    try {
      body = await request.json()
    } catch {
      return jsonResponse(
        {
          error: 'Unable to read the request body.',
        },
        400,
      )
    }

    const { imageBase64, mimeType } = body
    preferredLocale = body.preferredLocale
    orderId = body.orderId

    const authenticatedUser = await requireAuthenticatedUser({
      request,
      env,
      preferredLocale,
    })

    if (authenticatedUser instanceof Response) {
      return authenticatedUser
    }

    if (!imageBase64 || !mimeType) {
      return jsonResponse(
        {
          error: isKoreanLocale(preferredLocale)
            ? '헤어스타일 추천용 사진이 필요합니다.'
            : 'A photo is required for the hairstyle recommendation.',
        },
        400,
      )
    }

    const imagePrompt = buildHairImagePrompt(preferredLocale)
    let lastImageErrorMessage = ''
    let shouldFallbackToPrompt = false

    for (const model of IMAGE_MODELS) {
      const { response, json } = await callGemini({
        model,
        env,
        parts: [
          { text: imagePrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
        maxOutputTokens: 8192,
      })

      if (response.ok) {
        const parts = json?.candidates?.[0]?.content?.parts ?? []
        const description = extractText(parts)
        const imageResult = extractImage(parts)

        if (imageResult.imageBase64 && imageResult.mimeType && description) {
          return Response.json({
            mode: 'image',
            imageBase64: imageResult.imageBase64,
            mimeType: imageResult.mimeType,
            description,
            prompt: buildHairExternalPrompt({
              preferredLocale,
              styleSummary: description,
            }),
          })
        }

        lastImageErrorMessage = isKoreanLocale(preferredLocale)
          ? 'Gemini 응답에서 헤어스타일 이미지 결과를 완성하지 못했습니다.'
          : 'The Gemini response did not complete the hairstyle image result.'
        shouldFallbackToPrompt = true
        break
      }

      lastImageErrorMessage = json?.error?.message ?? (
        isKoreanLocale(preferredLocale)
          ? 'Gemini 이미지 생성 호출 중 오류가 발생했습니다.'
          : 'An error occurred while calling Gemini image generation.'
      )

      if (response.status === 429 || isLocationRestrictedError(lastImageErrorMessage)) {
        shouldFallbackToPrompt = true
        break
      }
    }

    if (isLocationRestrictedError(lastImageErrorMessage)) {
      const description = buildOfflineHairFallbackDescription(preferredLocale)

      return Response.json({
        mode: 'prompt',
        description,
        prompt: buildHairExternalPrompt({
          preferredLocale,
          styleSummary: description,
        }),
        note: isKoreanLocale(preferredLocale)
          ? '현재 지역에서는 Gemini 이미지 생성 API가 제한되어 있어, 아래에 외부 생성형 AI용 3x3 프롬프트를 준비했습니다.'
          : 'Gemini image generation is restricted for this location, so the app prepared an external 3x3 hairstyle prompt below.',
      })
    }

    const fallbackPrompt = buildHairFallbackPromptRequest(preferredLocale)
    let fallbackResult = await callGemini({
      model: TEXT_FALLBACK_MODEL,
      env,
      parts: [
        { text: fallbackPrompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: imageBase64,
          },
        },
      ],
      maxOutputTokens: 2048,
    })

    if (fallbackResult.response.ok) {
      const description = extractText(
        fallbackResult.json?.candidates?.[0]?.content?.parts ?? [],
      )

      if (description) {
        return Response.json({
          mode: 'prompt',
          description,
          prompt: buildHairExternalPrompt({
            preferredLocale,
            styleSummary: description,
          }),
          note: shouldFallbackToPrompt
            ? isKoreanLocale(preferredLocale)
              ? '이미지 생성 한도 문제로 텍스트 프롬프트 추천으로 전환했습니다.'
              : 'Image generation hit a limit, so the result was switched to a text prompt recommendation.'
            : isKoreanLocale(preferredLocale)
              ? '이미지 결과를 완성하지 못해 텍스트 프롬프트 추천으로 전환했습니다.'
              : 'The image result could not be completed, so the result was switched to a text prompt recommendation.',
        })
      }
    }

    fallbackResult = await callGemini({
      model: TEXT_FALLBACK_MODEL,
      env,
      parts: [{ text: buildGenericHairFallbackPromptRequest(preferredLocale) }],
      maxOutputTokens: 2048,
    })

    if (fallbackResult.response.ok) {
      const description = extractText(
        fallbackResult.json?.candidates?.[0]?.content?.parts ?? [],
      )

      if (description) {
        return Response.json({
          mode: 'prompt',
          description,
          prompt: buildHairExternalPrompt({
            preferredLocale,
            styleSummary: description,
          }),
          note: isKoreanLocale(preferredLocale)
            ? '이미지 생성 한도 또는 이미지 처리 문제로 텍스트 프롬프트 추천으로 전환했습니다.'
            : 'Image generation was switched to a text prompt recommendation because of a limit or image processing issue.',
        })
      }
    }

    if (shouldFallbackToPrompt) {
      const description = buildOfflineHairFallbackDescription(preferredLocale)

      return Response.json({
        mode: 'prompt',
        description,
        prompt: buildHairExternalPrompt({
          preferredLocale,
          styleSummary: description,
        }),
        note: isKoreanLocale(preferredLocale)
          ? '이미지 결과를 끝까지 완성하지 못해, 외부 생성형 AI에서 다시 시도할 수 있는 3x3 프롬프트를 제공합니다.'
          : 'The image result could not be completed, so the app provided an external 3x3 prompt you can retry in another AI tool.',
      })
    }

    throw new Error(
      lastImageErrorMessage ||
      (isKoreanLocale(preferredLocale)
        ? '헤어스타일 추천을 생성하는 중 문제가 발생했습니다.'
        : 'An issue occurred while generating the hairstyle recommendation.'),
    )
  } catch (error) {
    const refundRequested = await refundOrder({ env, orderId })

    return jsonResponse(
      {
        error: error instanceof Error
          ? refundRequested
            ? `${error.message} ${
                isKoreanLocale(preferredLocale)
                  ? '결제가 자동 환불 처리되었습니다.'
                  : 'The payment was refunded automatically.'
              }`
            : error.message
          : isKoreanLocale(preferredLocale)
            ? '헤어스타일 추천을 생성하는 중 서버 오류가 발생했습니다.'
            : 'A server error occurred while generating the hairstyle recommendation.',
        refundRequested,
      },
      500,
    )
  }
}
