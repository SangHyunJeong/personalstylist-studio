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
const IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
]

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
    'You are an AI styling software assistant.',
    'Analyze the user photo and body information to generate a digital style report.',
    'Write the report in the user preferred language.',
    'If locale starts with ko, respond in Korean. If ja, Japanese. If zh, Chinese. Otherwise, respond in English.',
    'Separate observations from suggestions, and avoid presenting uncertain traits as facts.',
    'Keep each section concise: 2-4 sentences or 2-4 bullets.',
    'Complete the following structure in full.',
    '1. One-line summary',
    '2. Body shape and impression analysis',
    '3. Recommended fits and silhouettes',
    '4. Three outfit directions',
    '5. Styles to avoid',
    '6. Five items to shop next',
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
    'Use the attached reference photo of the same person.',
    'Keep the exact same face, identity, skin tone, body proportions, and overall facial features.',
    'Do not change the face. Restyle only the outfit, accessories, styling details, and pose.',
    'Create one photorealistic fashion image that visualizes the strongest styling direction from the report below.',
    'Prefer a flattering full-body or 3/4 portrait with premium editorial quality and realistic clothing details.',
    'Follow the report closely for silhouette, layering, color palette, shoes, and accessories.',
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
        '### 한 줄 요약',
        '현재 지역 제한 때문에 서버에서 Gemini 기반 사진 분석을 직접 완료하지 못했습니다. 대신 외부 생성형 AI에 바로 넣을 수 있는 스타일 방향과 프롬프트를 준비했습니다.',
        '',
        '### 기본 분석 메모',
        `* 입력 기준: 키 ${height}cm, 몸무게 ${weight}kg`,
        '* 업로드한 같은 사진을 외부 생성형 AI에 함께 넣고, 얼굴과 체형은 유지한 채 의상과 스타일링만 바꾸도록 요청하세요.',
        '* 아래 가이드는 정밀 체형 판독 결과가 아니라, 사진 재활용용 스타일 브리프로 활용하는 용도입니다.',
        '',
        '### 추천 실루엣',
        '* 세로 라인이 보이도록 상하 비율을 정리한 하이웨이스트 조합',
        '* 어깨선과 허리선이 분명한 구조적 아우터 또는 재킷',
        '* 과한 장식보다 핏, 길이, 레이어 균형이 잘 보이는 미니멀 스타일',
        '',
        '### 추천 착장 방향 3가지',
        '* 도회적인 모노톤 테일러링 룩',
        '* 부드러운 뉴트럴 톤의 데일리 레이어드 룩',
        '* 데님과 구조적인 자켓을 섞은 스마트 캐주얼 룩',
        '',
        '### 피하면 좋은 방향',
        '* 상체와 하체 비율을 애매하게 끊는 중간 길이 상의',
        '* 얼굴 주변 시선을 과하게 모으는 큰 장식과 복잡한 패턴',
        '* 전체 실루엣을 무겁게 만드는 지나친 오버핏 중첩',
        '',
        '### 다음 쇼핑 우선순위',
        '* 어깨선이 정리된 재킷 1벌',
        '* 비율을 정리해 주는 하이웨이스트 하의 1벌',
        '* 톤을 정돈하는 벨트 또는 미니 백',
        '* 앞코가 정리된 슈즈 1켤레',
        '* 레이어링용 기본 이너 2-3장',
      ].join('\n')
    : [
        '### Summary',
        'Gemini could not complete the in-app photo analysis from this location, so the app prepared a reusable style brief and external prompt instead.',
        '',
        '### Baseline Notes',
        `* Input reference: height ${height}cm, weight ${weight}kg`,
        '* Reuse the same uploaded photo in your external AI tool and ask it to keep the same face and body while changing only the styling.',
        '* Treat the guidance below as a styling brief for prompt-based generation, not as a precise body-reading result.',
        '',
        '### Recommended Silhouettes',
        '* High-waist proportions that keep a clean vertical line',
        '* Structured outerwear or jackets with a defined shoulder and waist rhythm',
        '* Minimal styling where fit, length, and layering read clearly',
        '',
        '### Three Outfit Directions',
        '* Urban monochrome tailoring',
        '* Soft neutral daily layering',
        '* Smart casual denim with a structured jacket',
        '',
        '### Better To Avoid',
        '* Mid-length tops that cut the proportions in an unclear place',
        '* Heavy decoration or busy prints near the face',
        '* Excessive oversized layering that makes the silhouette look heavy',
        '',
        '### Shopping Priorities',
        '* One clean structured jacket',
        '* One high-waist bottom',
        '* One belt or compact bag to tighten the overall line',
        '* One refined shoe with a clean toe shape',
        '* Two or three base layering tops',
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
        maxOutputTokens: 1536,
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
