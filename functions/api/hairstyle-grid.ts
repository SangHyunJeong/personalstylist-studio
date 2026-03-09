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

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

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
    'You are an AI hairstyle generation assistant.',
    'Create a 3x3 grid with nine hairstyle options that suit the person in the attached photo.',
    'Do not change the face. Keep the same identity, facial structure, and expression, and change the hair only.',
    'Make the nine hairstyles clearly different in length, texture, parting, fringe, volume, and overall mood.',
    'Return one finished 3x3 collage image.',
    'Also include short descriptions for all nine styles.',
    'Write the descriptions in the user preferred language: Korean for ko, Japanese for ja, Chinese for zh, otherwise English.',
    `User locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

const buildHairFallbackPromptRequest = (preferredLocale?: string) =>
  [
    'You are an AI hairstyle prompt generator.',
    'Write content that the user can paste directly into an external image generation tool like ChatGPT or Gemini.',
    'Include two parts.',
    '1. One main prompt for a 3x3 hairstyle grid that keeps the same face and changes only the hair.',
    '2. Short recommendation text for each of the nine hairstyles.',
    'The prompt must explicitly mention identity preservation, same face, hair only change, 3x3 collage, and realistic photo quality.',
    'Write the response in the user preferred language: Korean for ko, Japanese for ja, Chinese for zh, otherwise English.',
    'Use this output format exactly.',
    '**Recommendation Summary**',
    'A short 2-3 sentence summary',
    '**Copy Prompt**',
    'One complete prompt ready to paste into an external tool',
    '**Nine Style Notes**',
    'Descriptions for styles 1 through 9',
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
    'Use the attached reference photo of the same person.',
    'Keep the exact same face, identity, skin tone, age impression, and facial structure.',
    'Do not change the face. Change hair only.',
    'Create a single 3x3 collage containing nine distinct hairstyles that all suit this person.',
    'Make the result photorealistic, salon-reference quality, and clearly varied in length, texture, parting, fringe, volume, and mood.',
    'Preserve realism and consistency across all nine variations.',
    styleSummary
      ? `Use this hairstyle direction and recommendation summary as guidance:\n${styleSummary}`
      : '',
    `User locale: ${preferredLocale || 'en-US'}.`,
  ]
    .filter(Boolean)
    .join('\n\n')

const buildGenericHairFallbackPromptRequest = (preferredLocale?: string) =>
  [
    'You are an AI hairstyle prompt generator.',
    'Write a high-quality prompt the user can paste into an external image generation tool.',
    'The prompt must keep the same face from the source photo and change the hair only in a 3x3 collage.',
    'Explicitly include identity preservation, same face, same facial features, hair only change, 3x3 collage, photorealistic quality, and salon-style recommendation language.',
    'Also provide names and characteristics for nine recommended hairstyles.',
    'Write the response in the user preferred language: Korean for ko, Japanese for ja, Chinese for zh, otherwise English.',
    'Use this output format exactly.',
    '**Recommendation Summary**',
    'A short 2-3 sentence summary',
    '**Copy Prompt**',
    'One complete prompt ready to paste into an external tool',
    '**Nine Style Notes**',
    'Descriptions for styles 1 through 9',
    `User locale: ${preferredLocale || 'en-US'}`,
  ].join('\n')

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

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

    const { imageBase64, mimeType, preferredLocale } = body

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

    return jsonResponse(
      {
        error:
          lastImageErrorMessage ||
          (isKoreanLocale(preferredLocale)
            ? '헤어스타일 추천을 생성하는 중 문제가 발생했습니다.'
            : 'An issue occurred while generating the hairstyle recommendation.'),
      },
      500,
    )
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : isKoreanLocale(undefined)
              ? '헤어스타일 추천을 생성하는 중 서버 오류가 발생했습니다.'
              : 'A server error occurred while generating the hairstyle recommendation.',
      },
      500,
    )
  }
}
