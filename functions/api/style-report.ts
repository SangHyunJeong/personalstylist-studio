interface Env {
  GEMINI_API_KEY?: string
}

interface PagesContext {
  request: Request
  env: Env
}

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string
    }>
  }
  finishReason?: string
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
  error?: {
    message?: string
  }
}

type GenerateReportOptions = {
  prompt: string
  env: Env
  imageBase64?: string
  mimeType?: string
}

const MODEL_NAME = 'gemini-3-flash-preview'

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
    return '현재 Gemini API 키의 사용 한도 또는 결제 설정 문제로 보고서를 생성할 수 없습니다. Google AI Studio에서 quota와 billing 상태를 확인해 주세요.'
  }

  return message ?? 'Gemini API 호출 중 오류가 발생했습니다.'
}

const generateReport = async ({
  prompt,
  env,
  imageBase64,
  mimeType,
}: GenerateReportOptions) => {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]

  if (imageBase64 && mimeType) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64,
      },
    })
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`,
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
          temperature: 0.7,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    },
  )

  const rawGeminiText = await geminiResponse.text()
  const geminiJson = rawGeminiText.trim()
    ? (JSON.parse(rawGeminiText) as GeminiResponse)
    : null

  if (!geminiResponse.ok) {
    throw new Error(
      getFriendlyGeminiError(
        geminiResponse.status,
        geminiJson?.error?.message,
      ),
    )
  }

  const candidate = geminiJson?.candidates?.[0]
  const report = candidate?.content?.parts
    ?.map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')

  return {
    report,
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

    const prompt = [
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

    const initialResult = await generateReport({
      prompt,
      env,
      imageBase64,
      mimeType,
    })

    let report = initialResult.report ?? ''

    if (initialResult.finishReason === 'MAX_TOKENS' && report) {
      const continuationPrompt = [
        prompt,
        '이전 답변이 토큰 제한으로 중간에 끊겼습니다.',
        '아래까지 이미 작성한 내용은 반복하지 말고, 끊긴 지점부터 나머지 섹션을 끝까지 이어서 완성하세요.',
        '이미 작성된 내용:',
        report,
      ].join('\n\n')

      const continuationResult = await generateReport({
        prompt: continuationPrompt,
        env,
      })

      if (continuationResult.report) {
        report = `${report}\n\n${continuationResult.report}`.trim()
      }
    }

    if (!report) {
      return jsonResponse(
        { error: 'Gemini 응답에서 스타일 보고서를 찾을 수 없습니다.' },
        502,
      )
    }

    return Response.json({ report })
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
