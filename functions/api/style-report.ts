interface Env {
  GEMINI_API_KEY?: string
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
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

    const initialResult = await generateText({
      prompt: reportPrompt,
      env,
      imageBase64,
      mimeType,
      preferredLocale,
    })

    let report = initialResult.text

    if (initialResult.finishReason === 'MAX_TOKENS' && report) {
      const continuationPrompt = [
        reportPrompt,
        'The previous answer was cut off by the token limit.',
        'Do not repeat the existing content. Continue from the interruption point and finish the remaining sections.',
        'Already written content:',
        report,
      ].join('\n\n')

      const continuationResult = await generateText({
        prompt: continuationPrompt,
        env,
        preferredLocale,
      })

      if (continuationResult.text) {
        report = `${report}\n\n${continuationResult.text}`.trim()
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

    let lastImageStatus = 0

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
    }

    return Response.json({
      report,
      prompt: styleImagePrompt,
      note:
        lastImageStatus === 429
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
