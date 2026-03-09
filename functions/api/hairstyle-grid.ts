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

const IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
]

const TEXT_FALLBACK_MODEL = 'gemini-3-flash-preview'

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) =>
  Response.json(body, { status })

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
    '너는 최고의 헤어스타일리스트야.',
    '3x3 그리드로, 첨부한 사진 속 사람에게 최고로 잘 어울리는 헤어스타일 9개를 생성해줘.',
    '단, 첨부한 사람의 얼굴은 절대 바꾸지 말고 기존 얼굴을 그대로 유지하고 헤어스타일만 바꿔.',
    '헤어 길이, 질감, 가르마, 볼륨, 무드가 서로 뚜렷하게 다른 9개를 만들어줘.',
    '하나의 완성된 3x3 콜라주 이미지로 만들어줘.',
    '이미지와 함께 각 스타일 9개에 대한 짧은 설명도 작성해줘.',
    '설명은 사용자의 locale을 따르되, ko면 한국어, ja면 일본어, zh면 중국어, 그 외에는 영어로 작성해줘.',
    `사용자 locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

const buildHairFallbackPromptRequest = (preferredLocale?: string) =>
  [
    '너는 최고의 헤어스타일리스트야.',
    '사용자가 ChatGPT, Gemini, Nano Banana 같은 외부 이미지 생성 도구에 바로 붙여넣어 사용할 수 있는 프롬프트를 작성해줘.',
    '반드시 두 가지를 작성해줘.',
    '1. 첨부 사진 속 인물의 얼굴은 그대로 유지하고 헤어스타일만 바꾸는 3x3 그리드 생성용 메인 프롬프트 1개',
    '2. 9개 헤어스타일 각각에 대한 짧은 추천 설명',
    '프롬프트에는 얼굴 변경 금지, identity preservation, hair only change, 3x3 collage, realistic photo quality를 분명하게 포함해.',
    '설명은 사용자의 locale을 따르되, ko면 한국어, ja면 일본어, zh면 중국어, 그 외에는 영어로 작성해줘.',
    '출력 형식은 다음을 지켜줘.',
    '**추천 요약**',
    '짧은 요약 2~3문장',
    '**복사용 프롬프트**',
    '외부 툴에 붙여넣을 수 있는 완성 프롬프트',
    '**9개 스타일 설명**',
    '1번부터 9번까지 각 스타일 설명',
    `사용자 locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

const buildGenericHairFallbackPromptRequest = (preferredLocale?: string) =>
  [
    '너는 최고의 헤어스타일리스트야.',
    '사용자가 외부 이미지 생성 도구에 바로 붙여넣을 수 있는 고품질 프롬프트를 작성해줘.',
    '입력 사진의 얼굴은 그대로 유지하고, 헤어스타일만 바꾸는 3x3 콜라주용 프롬프트를 작성해줘.',
    '프롬프트에는 identity preservation, same face, same facial features, hair only change, 3x3 collage, photorealistic, salon recommendation을 분명하게 넣어줘.',
    '또한 9개의 추천 헤어스타일 이름과 특징을 함께 작성해줘.',
    '설명은 사용자의 locale을 따르되, ko면 한국어, ja면 일본어, zh면 중국어, 그 외에는 영어로 작성해줘.',
    '출력 형식은 다음을 지켜줘.',
    '**추천 요약**',
    '짧은 요약 2~3문장',
    '**복사용 프롬프트**',
    '외부 툴에 붙여넣을 수 있는 완성 프롬프트',
    '**9개 스타일 설명**',
    '1번부터 9번까지 각 스타일 설명',
    `사용자 locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

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
        maxOutputTokens: 1536,
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
          })
        }

        lastImageErrorMessage = 'Gemini 응답에서 헤어스타일 이미지 결과를 완성하지 못했습니다.'
        shouldFallbackToPrompt = true
        break
      }

      lastImageErrorMessage = json?.error?.message ?? 'Gemini 이미지 생성 호출 중 오류가 발생했습니다.'

      if (response.status === 429) {
        shouldFallbackToPrompt = true
        break
      }
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
          prompt: description,
          note: shouldFallbackToPrompt
            ? '이미지 생성 한도 문제로 텍스트 프롬프트 추천으로 전환했습니다.'
            : '이미지 결과를 완성하지 못해 텍스트 프롬프트 추천으로 전환했습니다.',
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
          prompt: description,
          note: '이미지 생성 한도 또는 이미지 처리 문제로 텍스트 프롬프트 추천으로 전환했습니다.',
        })
      }
    }

    return jsonResponse(
      {
        error:
          lastImageErrorMessage ||
          '헤어스타일 추천을 생성하는 중 문제가 발생했습니다.',
      },
      500,
    )
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
