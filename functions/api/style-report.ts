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
  finishReason?: string
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
  error?: {
    message?: string
  }
}

type TextGenerationResult = {
  text: string
  finishReason?: string
}

const TEXT_MODEL = 'gemini-3-flash-preview'
const IMAGE_MODELS = ['gemini-3-pro-image-preview']

const jsonResponse = (
  body: Record<string, string | boolean>,
  status: number,
) => Response.json(body, { status })

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
  temperature,
}: {
  model: string
  env: Env
  parts: Array<Record<string, unknown>>
  maxOutputTokens: number
  temperature: number
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
        contents: [{ parts }],
        generationConfig: {
          temperature,
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
      reason: 'Automatic refund after style generation failure',
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

const getFriendlyTextError = (
  status: number,
  message: string | undefined,
  preferredLocale?: string,
) => {
  if (status === 429) {
    return isKoreanLocale(preferredLocale)
      ? '현재 Gemini API 키의 사용 한도 또는 결제 설정 문제로 보고서를 생성할 수 없습니다. Google AI Studio에서 quota와 billing 상태를 확인해 주세요.'
      : 'The style report could not be generated because of the current Gemini API quota or billing status. Please check quota and billing in Google AI Studio.'
  }

  return message ?? (isKoreanLocale(preferredLocale)
    ? 'Gemini API 호출 중 오류가 발생했습니다.'
    : 'An error occurred while calling the Gemini API.')
}

const buildReportPrompt = ({
  height,
  weight,
  preferredLocale,
}: {
  height: string
  weight: string
  preferredLocale?: string
}) =>
  [
    'You are Personal AI Stylist, a professional image consultant trained in personal color theory, face-shape and V-zone harmony, proportion correction, optical styling, and Kibbe-inspired style essence analysis.',
    'Analyze the attached user photo together with the provided height and weight to produce a rigorous digital style consultation report.',
    'Base every conclusion on visible evidence first. When evidence is limited, frame the point as a likelihood instead of a fact.',
    'Clearly separate observed cues from professional inference.',
    'Use professional fashion terminology, but keep the report practical, specific, and easy to act on.',
    'Write entirely in the user preferred language. If locale starts with ko, respond in Korean. If ja, Japanese. If zh, Chinese. Otherwise, respond in English.',
    'Use markdown headings that begin with ### and bullet lines that begin with *.',
    'Keep the section order exactly as listed below, but localize the section titles into the user language.',
    'Follow this analysis priority: color identity -> V-zone and face harmony -> proportion and silhouette -> style essence -> outfit strategy.',
    'If the photo evidence and the numeric body metrics do not fully align, prioritize the photo for visible line and proportion, and use height and weight as supporting context only.',
    'For undertone, face-shape tendency, and style essence, add a short confidence label such as (confidence: high), (confidence: medium), or (confidence: low).',
    'Do not claim medical, biometric, or exact anthropometric certainty.',
    'Keep each bullet concise and insight-dense.',
    'Required section order:',
    '### Executive Summary',
    '* 2 bullets: overall image impression and the main styling thesis',
    '### Observable Cues',
    '* 3-4 bullets describing only what is visibly supported by the photo and the provided body metrics',
    '### Color Identity',
    '* likely undertone, contrast or value impression, best near-face color families, harmonious metals, and colors to de-emphasize near the face',
    '### V-Zone and Face Harmony',
    '* likely face-shape tendency, recommended necklines or collars, accessory geometry, and hair-volume or parting direction if relevant',
    '### Proportion and Silhouette Strategy',
    '* vertical versus horizontal balance, waist placement, fit amount, jacket or top length, bottom shape, shoe line, pattern scale, and fabric structure',
    '### Style Essence',
    '* closest style essence or Kibbe-family tendency, plus the line quality, detail density, and fabric behavior that best fit the person',
    '### Outfit Directions',
    '* provide exactly 3 outfit formulas',
    '* each formula must include a name, key garments, palette, shoes or accessories, and one short reason it works',
    '### Better To Avoid',
    '* 3-4 concrete styling traps that weaken color harmony, facial balance, or body proportion',
    '### Shopping Priorities',
    '* list exactly 5 next-purchase items in priority order',
    'End with one closing sentence that summarizes the style direction without hype or repetition.',
    `User locale: ${preferredLocale || 'en-US'}`,
    `Height: ${height}cm`,
    `Weight: ${weight}kg`,
  ].join('\n')

const buildStyleImagePrompt = ({
  height,
  weight,
  report,
  preferredLocale,
}: {
  height: string
  weight: string
  report: string
  preferredLocale?: string
}) =>
  [
    'You are creating one professional fashion visualization for the exact same person shown in the attached reference photo.',
    'Preserve the exact face, identity, skin tone, body proportions, and overall facial structure.',
    'Do not beautify or alter the person. Change only the outfit, accessories, styling details, and pose if needed.',
    'Translate the style report below into one realistic, wearable, premium-quality look.',
    'The selected look must embody the recommended color identity, V-zone strategy, proportional balance, and style essence.',
    'Prefer a full-body or strong 3/4 portrait with commercial editorial polish, realistic garment construction, and coherent accessories.',
    'If the report gives multiple outfit formulas, visualize the one that is both the strongest and the most broadly wearable.',
    'Use believable fabrics, flattering lengths, and styling details that could actually be shopped or worn in real life.',
    'Avoid fantasy costumes, exaggerated retouching, text overlays, collage layouts, split screens, duplicate figures, or inconsistent anatomy.',
    `Body reference: ${height}cm, ${weight}kg.`,
    `User locale: ${preferredLocale || 'en-US'}.`,
    'Style report:',
    report,
  ].join('\n\n')

const buildOfflineStyleFallbackReport = ({
  height,
  weight,
  preferredLocale,
}: {
  height: string
  weight: string
  preferredLocale?: string
}) =>
  isKoreanLocale(preferredLocale)
    ? [
        '### Executive Summary',
        '* 현재 지역 제한 때문에 서버에서 사진 기반 AI 분석을 직접 완료하지 못했습니다.',
        '* 대신 키와 몸무게, 그리고 전문 스타일링 원칙을 바탕으로 외부 생성형 AI에 바로 넣을 수 있는 구조화된 스타일 브리프를 제공합니다.',
        '',
        '### Available Inputs',
        `* 입력 데이터: 키 ${height}cm, 몸무게 ${weight}kg`,
        '* 업로드 사진의 세부 색채, 얼굴형, 골격 판독은 이번 응답에서 확정하지 않았습니다.',
        '* 따라서 아래 가이드는 안전한 비율 보정과 범용적인 스타일링 전략에 초점을 둡니다.',
        '',
        '### Color Identity',
        '* 얼굴 주변은 아이보리, 소프트 화이트, 차분한 네이비, 뮤트 브라운처럼 과채도보다 중채도 안정색부터 테스트하는 편이 안전합니다.',
        '* 메탈은 실버와 샴페인 골드를 모두 비교해 보고, 안색이 더 또렷해 보이는 쪽을 우선 채택하세요.',
        '* 얼굴 가까운 영역에서는 형광색, 탁한 카키-머스터드, 지나치게 강한 대비를 한 번에 겹치지 않는 편이 안정적입니다.',
        '',
        '### V-Zone and Face Harmony',
        '* 네크라인은 깊이보다 정돈감을 우선해 V넥, 스퀘어넥, 라운드넥 중 얼굴 인상을 가장 또렷하게 만드는 방향을 테스트하세요.',
        '* 액세서리는 큰 장식보다 선이 정리된 귀걸이, 얇은 체인, 단정한 안경 프레임처럼 얼굴 주변 노이즈를 줄이는 방식이 유리합니다.',
        '* 헤어 볼륨은 옆 폭을 과하게 키우기보다 정수리 또는 앞머리 라인의 균형을 조정하는 접근이 실패 확률이 낮습니다.',
        '',
        '### Proportion and Silhouette Strategy',
        '* 허리선이 보이도록 상하 비율을 정리하고, 상의와 하의의 색 간격을 좁혀 세로 흐름을 만드는 편이 비율 개선에 유리합니다.',
        '* 아우터와 상의는 어깨선과 여백이 정리된 핏을 우선하고, 하의는 하이웨이스트 또는 발등까지 자연스럽게 이어지는 라인을 우선하세요.',
        '* 패턴은 작은 규모 또는 절제된 스트라이프부터 적용하고, 소재는 광택보다 매트하고 구조가 살아 있는 쪽이 안정적입니다.',
        '',
        '### Outfit Directions',
        '* 도시형 모노톤 테일러링: 구조적인 재킷 + 정돈된 하이웨이스트 하의 + 미니멀 슈즈로 세로선을 강화',
        '* 소프트 뉴트럴 레이어드: 명도 차를 과하게 벌리지 않은 니트 또는 셔츠 레이어드 + 슬림한 하의로 안정감 확보',
        '* 스마트 캐주얼 구조화 데님: 깔끔한 톱 + 직선적인 재킷 + 톤 통일 데님으로 일상성과 비율 보정을 동시 확보',
        '',
        '### Better To Avoid',
        '* 허리와 골반의 기준점을 모호하게 만드는 중간 길이 상의',
        '* 얼굴 주변을 무겁게 만드는 큰 로고, 복잡한 패턴, 과한 장식',
        '* 실루엣을 한 번에 부풀리는 두꺼운 광택 소재와 과도한 오버핏 중첩',
        '',
        '### Shopping Priorities',
        '* 1. 어깨선이 정리된 재킷 또는 셔츠 아우터',
        '* 2. 비율을 올려 보이게 하는 하이웨이스트 하의',
        '* 3. 얼굴 주변 톤을 정돈하는 기본 이너 2장',
        '* 4. 앞코와 갑피 라인이 깔끔한 슈즈 1켤레',
        '* 5. 선이 단정한 벨트 또는 미니멀 액세서리',
        '',
        '사진 기반 정밀 진단이 가능해지면 퍼스널 컬러, 얼굴형, 스타일 에센스를 더 세밀하게 좁혀 추천 정확도를 높일 수 있습니다.',
      ].join('\n')
    : [
        '### Executive Summary',
        '* The server could not complete a photo-based AI analysis from this location.',
        '* Instead, this fallback provides a structured style brief grounded in height, weight, and professional styling principles that you can reuse in an external AI tool.',
        '',
        '### Available Inputs',
        `* Input data: height ${height}cm, weight ${weight}kg`,
        '* This response does not lock in a precise photo-based reading of color, face shape, or bone structure.',
        '* The guidance below therefore focuses on safe proportion correction and broadly reliable styling strategy.',
        '',
        '### Color Identity',
        '* Start near the face with stable mid-intensity shades such as ivory, soft white, calm navy, and muted brown before testing highly saturated color.',
        '* Compare silver and champagne gold, then keep the metal that makes the complexion look clearer and more rested.',
        '* Avoid stacking fluorescent tones, muddy mustard-khaki shades, or overly sharp contrast right next to the face.',
        '',
        '### V-Zone and Face Harmony',
        '* Test V neck, square neck, and clean round neck options with the goal of clarity and balance rather than maximum exposure.',
        '* Favor accessories with controlled lines such as refined earrings, slim chains, and clean eyewear frames instead of visually noisy statement pieces.',
        '* Hair volume is usually safest when it balances the crown or fringe area instead of dramatically widening the sides of the face.',
        '',
        '### Proportion and Silhouette Strategy',
        '* A visible waist point and a smaller color break between top and bottom usually create a longer, cleaner vertical line.',
        '* Prioritize outerwear and tops with a defined shoulder and controlled ease, then pair them with high-waist bottoms or lines that continue smoothly to the shoe.',
        '* Start with smaller pattern scale or restrained stripes, and lean toward matte fabrics with structure instead of glossy bulk.',
        '',
        '### Outfit Directions',
        '* Urban monochrome tailoring: a structured jacket, clean high-waist bottoms, and minimal shoes to strengthen the vertical line',
        '* Soft neutral layering: knit or shirt layering with controlled value contrast and a slim lower silhouette for calm balance',
        '* Structured denim smart casual: a clean top, straight jacket, and tonal denim for everyday ease with better proportion control',
        '',
        '### Better To Avoid',
        '* Mid-length tops that blur the waist and hip starting point',
        '* Large logos, busy prints, or heavy decoration near the face',
        '* Thick glossy fabrics and excessive oversized layering that expand the silhouette all at once',
        '',
        '### Shopping Priorities',
        '* 1. One jacket or shirt-jacket with a defined shoulder line',
        '* 2. One high-waist bottom that lengthens the proportion',
        '* 3. Two base inner tops that clean up the near-face color zone',
        '* 4. One pair of shoes with a clean toe and upper line',
        '* 5. One refined belt or minimal accessory to sharpen the total line',
        '',
        'Once photo-based analysis becomes available, the recommendation can narrow the personal color, face balance, and style essence much more precisely.',
      ].join('\n')

const generateText = async ({
  env,
  prompt,
  imageBase64,
  mimeType,
  preferredLocale,
}: {
  env: Env
  prompt: string
  imageBase64?: string
  mimeType?: string
  preferredLocale?: string
}): Promise<TextGenerationResult> => {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]

  if (imageBase64 && mimeType) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64,
      },
    })
  }

  const { response, json } = await callGemini({
    model: TEXT_MODEL,
    env,
    parts,
    maxOutputTokens: 2048,
    temperature: 0.7,
  })

  if (!response.ok) {
    throw new Error(
      getFriendlyTextError(
        response.status,
        json?.error?.message,
        preferredLocale,
      ),
    )
  }

  const candidate = json?.candidates?.[0]

  return {
    text: extractText(candidate?.content?.parts ?? []),
    finishReason: candidate?.finishReason,
  }
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context
  let preferredLocale: string | undefined
  let orderId: string | undefined

  try {
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: 'Cloudflare Pages environment variable GEMINI_API_KEY is not set.' },
        500,
      )
    }

    let body: {
      height?: string
        weight?: string
        imageBase64?: string
        mimeType?: string
        preferredLocale?: string
        orderId?: string
      }

    try {
      body = await request.json()
    } catch {
      return jsonResponse(
        { error: 'Unable to read the request body.' },
        400,
      )
    }

    const { height, weight, imageBase64, mimeType } = body
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

    if (!height || !weight || !imageBase64 || !mimeType) {
      return jsonResponse(
        {
          error: isKoreanLocale(preferredLocale)
            ? '사진, 키, 몸무게 정보를 모두 전달해야 합니다.'
            : 'Photo, height, and weight are all required.',
        },
        400,
      )
    }

    const reportPrompt = buildReportPrompt({
      height,
      weight,
      preferredLocale,
    })

    let report = ''
    let reportNote = ''

    const initialResult = await generateText({
      prompt: reportPrompt,
      env,
      imageBase64,
      mimeType,
      preferredLocale,
    }).catch((error: unknown) => {
      if (!(error instanceof Error) || !isLocationRestrictedError(error.message)) {
        throw error
      }

      report = buildOfflineStyleFallbackReport({
        height,
        weight,
        preferredLocale,
      })
      reportNote = isKoreanLocale(preferredLocale)
        ? '현재 지역에서는 Gemini API 사용이 제한되어 있어, 서버 분석 대신 외부 생성형 AI에서 바로 쓸 수 있는 스타일 가이드와 프롬프트를 제공합니다.'
        : 'Gemini use is restricted for this location, so the app prepared a reusable style guide and external prompt instead of an in-app analysis.'

      return null
    })

    if (initialResult) {
      report = initialResult.text

      if (initialResult.finishReason === 'MAX_TOKENS' && report) {
        const continuationPrompt = [
          reportPrompt,
          'The previous answer was cut off by the token limit.',
          'Do not repeat the existing content. Continue from the interruption point and finish the remaining sections.',
          'Already written content:',
          report,
        ].join('\n\n')

        try {
          const continuationResult = await generateText({
            prompt: continuationPrompt,
            env,
            preferredLocale,
          })

          if (continuationResult.text) {
            report = `${report}\n\n${continuationResult.text}`.trim()
          }
        } catch (error) {
          if (!(error instanceof Error) || !isLocationRestrictedError(error.message)) {
            throw error
          }
        }
      }
    }

    if (!report) {
      throw new Error(
        isKoreanLocale(preferredLocale)
          ? 'Gemini 응답에서 스타일 보고서를 찾을 수 없습니다.'
          : 'The Gemini response did not contain a style report.',
      )
    }

    const styleImagePrompt = buildStyleImagePrompt({
      height,
      weight,
      report,
      preferredLocale,
    })

    if (reportNote) {
      return Response.json({
        report,
        prompt: styleImagePrompt,
        note: reportNote,
      })
    }

    let lastImageStatus = 0
    let lastImageErrorMessage = ''

    for (const model of IMAGE_MODELS) {
      const { response, json } = await callGemini({
        model,
        env,
        parts: [
          { text: styleImagePrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
        maxOutputTokens: 8192,
        temperature: 0.9,
      })

      if (response.ok) {
        const imageResult = extractImage(
          json?.candidates?.[0]?.content?.parts ?? [],
        )

        if (imageResult.imageBase64 && imageResult.mimeType) {
          return Response.json({
            report,
            prompt: styleImagePrompt,
            imageBase64: imageResult.imageBase64,
            mimeType: imageResult.mimeType,
          })
        }
      }

      lastImageStatus = response.status
      lastImageErrorMessage = json?.error?.message ?? ''

      if (isLocationRestrictedError(lastImageErrorMessage)) {
        break
      }
    }

    return Response.json({
      report,
      prompt: styleImagePrompt,
      note:
        isLocationRestrictedError(lastImageErrorMessage)
          ? isKoreanLocale(preferredLocale)
            ? '현재 지역에서는 Gemini 이미지 생성 API가 제한되어 있어, 아래에 외부 생성형 AI용 스타일 프롬프트만 제공합니다.'
            : 'Gemini image generation is restricted for this location, so the app provided only an external style prompt below.'
          : lastImageStatus === 429
          ? isKoreanLocale(preferredLocale)
            ? '스타일 이미지 생성은 현재 한도 또는 결제 상태 때문에 건너뛰고, 외부 생성형 AI에 붙여넣을 프롬프트만 제공했습니다.'
            : 'Style image generation was skipped because of the current quota or billing status, so only a prompt for your external AI tool was provided.'
          : isKoreanLocale(preferredLocale)
            ? '스타일 이미지 생성은 완료하지 못해, 외부 생성형 AI에 붙여넣을 프롬프트만 제공했습니다.'
            : 'Style image generation could not be completed, so only a prompt for your external AI tool was provided.',
    })
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
            ? '스타일 보고서를 생성하는 중 서버 오류가 발생했습니다.'
            : 'A server error occurred while generating the style report.',
        refundRequested,
      },
      500,
    )
  }
}
