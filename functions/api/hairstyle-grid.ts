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
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
  error?: {
    message?: string
  }
}

const MODEL_NAME = 'gemini-2.5-flash-image'

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) =>
  Response.json(body, { status })

const getFriendlyGeminiError = (
  status: number,
  message: string | undefined,
) => {
  if (status === 429) {
    return '현재 Gemini 이미지 생성 API의 사용 한도 또는 결제 설정 문제로 헤어스타일 추천을 생성할 수 없습니다. Google AI Studio에서 quota와 billing 상태를 확인해 주세요.'
  }

  return message ?? 'Gemini 이미지 생성 호출 중 오류가 발생했습니다.'
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
      imageBase64?: string
      mimeType?: string
      preferredLocale?: string
    }

    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: '요청 본문을 읽을 수 없습니다.' }, 400)
    }

    const { imageBase64, mimeType, preferredLocale } = body

    if (!imageBase64 || !mimeType) {
      return jsonResponse({ error: '헤어스타일 추천용 사진이 필요합니다.' }, 400)
    }

    const prompt = [
      '너는 최고의 헤어스타일리스트야.',
      '3x3 그리드로, 첨부한 사진 속 사람에게 최고로 잘 어울리는 헤어스타일 9개를 생성해줘.',
      '단, 첨부한 사람의 얼굴은 절대 바꾸지 말고 기존 얼굴을 그대로 유지하고 헤어스타일만 바꿔.',
      '하나의 완성된 3x3 콜라주 이미지로 만들어줘.',
      '이미지 아래 또는 함께, 각 헤어스타일 9개에 대해 어떤 스타일인지 한 줄씩 설명해줘.',
      '설명은 사용자의 locale을 따르되, ko면 한국어, ja면 일본어, zh면 중국어, 그 외에는 영어로 작성해줘.',
      `사용자 locale: ${preferredLocale || 'en-US'}`,
    ].join('\n')

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1536,
          },
        }),
      },
    )

    const rawGeminiText = await geminiResponse.text()
    const geminiJson = rawGeminiText.trim()
      ? (JSON.parse(rawGeminiText) as GeminiResponse)
      : null

    if (!geminiResponse.ok) {
      return jsonResponse(
        {
          error: getFriendlyGeminiError(
            geminiResponse.status,
            geminiJson?.error?.message,
          ),
        },
        geminiResponse.status,
      )
    }

    const parts = geminiJson?.candidates?.[0]?.content?.parts ?? []

    const description = parts
      .map((part) => part.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n')

    const imagePart = parts.find((part) => {
      const inlineData = part.inlineData ?? part.inline_data
      return Boolean(inlineData?.data)
    })

    const inlineData = imagePart?.inlineData ?? imagePart?.inline_data
    const resultImageBase64 = inlineData?.data
    const resultMimeType = inlineData?.mimeType ?? inlineData?.mime_type

    if (!resultImageBase64 || !resultMimeType) {
      return jsonResponse(
        { error: 'Gemini 응답에서 헤어스타일 이미지 결과를 찾을 수 없습니다.' },
        502,
      )
    }

    if (!description) {
      return jsonResponse(
        { error: 'Gemini 응답에서 헤어스타일 설명을 찾을 수 없습니다.' },
        502,
      )
    }

    return Response.json({
      imageBase64: resultImageBase64,
      mimeType: resultMimeType,
      description,
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : '헤어스타일 추천을 생성하는 중 서버 오류가 발생했습니다.',
      },
      500,
    )
  }
}
