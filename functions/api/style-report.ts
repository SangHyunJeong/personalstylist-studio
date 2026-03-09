interface Env {
  GEMINI_API_KEY?: string
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
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

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
) => {
  if (status === 429) {
    return '현재 Gemini API 키의 사용 한도 또는 결제 설정 문제로 보고서를 생성할 수 없습니다. Google AI Studio에서 quota와 billing 상태를 확인해 주세요.'
  }

  return message ?? 'Gemini API 호출 중 오류가 발생했습니다.'
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
    '당신은 프리미엄 퍼스널 스타일리스트입니다.',
    '사용자의 사진과 체형 정보를 바탕으로 스타일 컨설팅 보고서를 작성하세요.',
    '사용자의 선호 언어를 기준으로 보고서를 작성하세요.',
    'locale이 ko로 시작하면 한국어, ja로 시작하면 일본어, zh로 시작하면 중국어, 그 외에는 영어로 답변하세요.',
    '추측을 단정적으로 말하지 말고, 사진 기반 관찰과 스타일 제안을 구분해 표현하세요.',
    '각 섹션은 너무 길지 않게 2~4문장 또는 2~4개 bullet로 간결하게 작성하세요.',
    '다음 구조를 반드시 끝까지 완성하세요.',
    '1. 한줄 총평',
    '2. 체형 및 인상 분석',
    '3. 잘 어울리는 핏과 실루엣',
    '4. 추천 코디 3가지',
    '5. 피하면 좋은 스타일',
    '6. 바로 쇼핑할 아이템 5개',
    `사용자 locale: ${preferredLocale || 'en-US'}`,
    `입력된 키: ${height}cm`,
    `입력된 몸무게: ${weight}kg`,
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
}: {
  env: Env
  prompt: string
  imageBase64?: string
  mimeType?: string
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

  try {
    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: 'Cloudflare Pages 환경변수 GEMINI_API_KEY가 설정되지 않았습니다.' },
        500,
      )
    }

    let body: {
      height?: string
      weight?: string
      imageBase64?: string
      mimeType?: string
      preferredLocale?: string
    }

    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: '요청 본문을 읽을 수 없습니다.' }, 400)
    }

    const { height, weight, imageBase64, mimeType, preferredLocale } = body

    if (!height || !weight || !imageBase64 || !mimeType) {
      return jsonResponse(
        { error: '사진, 키, 몸무게 정보를 모두 전달해야 합니다.' },
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
    })

    let report = initialResult.text

    if (initialResult.finishReason === 'MAX_TOKENS' && report) {
      const continuationPrompt = [
        reportPrompt,
        '이전 답변이 토큰 제한으로 중간에 끊겼습니다.',
        '아래까지 이미 작성한 내용은 반복하지 말고, 끊긴 지점부터 나머지 섹션을 끝까지 이어서 완성하세요.',
        '이미 작성된 내용:',
        report,
      ].join('\n\n')

      const continuationResult = await generateText({
        prompt: continuationPrompt,
        env,
      })

      if (continuationResult.text) {
        report = `${report}\n\n${continuationResult.text}`.trim()
      }
    }

    if (!report) {
      return jsonResponse(
        { error: 'Gemini 응답에서 스타일 보고서를 찾을 수 없습니다.' },
        502,
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
          ? '스타일 이미지 생성은 현재 한도 또는 결제 상태 때문에 건너뛰고, 외부 생성형 AI에 붙여넣을 프롬프트만 제공했습니다.'
          : '스타일 이미지 생성은 완료하지 못해, 외부 생성형 AI에 붙여넣을 프롬프트만 제공했습니다.',
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : '스타일 보고서를 생성하는 중 서버 오류가 발생했습니다.',
      },
      500,
    )
  }
}
