import { requireAuthenticatedUser } from './_supabaseAuth'

interface Env {
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  RESEND_REPLY_TO?: string
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

interface PagesContext {
  request: Request
  env: Env
}

type ReportKind = 'style' | 'hair'
type Language = 'ko' | 'en'

type SendReportEmailBody = {
  kind?: ReportKind
  language?: Language
  toEmail?: string
  content?: string
  prompt?: string
  note?: string
  imageDataUrl?: string
}

type ResendResponse = {
  id?: string
  message?: string
  error?: string
}

type ParsedImage = {
  mimeType: string
  content: string
}

const DEFAULT_FROM_EMAIL = 'Personal AI Stylist <noreply@personalstylist.site>'

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

const isKorean = (language?: string) => language === 'ko'

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const renderInlineStrong = (value: string) =>
  escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

const renderRichTextHtml = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      if (!line) {
        return '<div style="height:8px"></div>'
      }

      if (line === '---') {
        return '<hr style="border:none;border-top:1px solid #e7d8d8;margin:12px 0" />'
      }

      if (line.startsWith('### ')) {
        return `<h3 style="margin:0 0 8px;color:#201720;font-size:18px;line-height:1.45">${renderInlineStrong(line.slice(4))}</h3>`
      }

      if (line.startsWith('* ') || line.startsWith('- ')) {
        return `<p style="margin:0 0 10px;color:#4a3d4a;line-height:1.7">• ${renderInlineStrong(line.slice(2))}</p>`
      }

      return `<p style="margin:0 0 10px;color:#4a3d4a;line-height:1.7">${renderInlineStrong(line)}</p>`
    })
    .join('')

const stripFormatting = (value: string) =>
  value
    .replaceAll('### ', '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')

const parseImageDataUrl = (imageDataUrl?: string): ParsedImage | null => {
  if (!imageDataUrl) {
    return null
  }

  const match = imageDataUrl.match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    content: match[2],
  }
}

const getFileExtension = (mimeType: string) => {
  if (mimeType.includes('png')) {
    return 'png'
  }

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpg'
  }

  if (mimeType.includes('webp')) {
    return 'webp'
  }

  return 'bin'
}

const getLocalizedStrings = (language: Language, kind: ReportKind) => {
  if (language === 'ko') {
    return kind === 'style'
      ? {
          subject: 'Personal AI Stylist 체형 스타일 보고서',
          heading: '체형 스타일 보고서가 도착했습니다',
          intro:
            '요청하신 스타일 분석 결과를 이메일로 보내드립니다. 생성된 비주얼이 있으면 함께 첨부했습니다.',
          contentHeading: '리포트 내용',
          promptHeading: '외부 생성형 AI용 프롬프트',
          noteHeading: '추가 안내',
        }
      : {
          subject: 'Personal AI Stylist 헤어스타일 추천 리포트',
          heading: '헤어스타일 추천 리포트가 도착했습니다',
          intro:
            '요청하신 헤어스타일 추천 결과를 이메일로 보내드립니다. 생성된 3x3 이미지가 있으면 함께 첨부했습니다.',
          contentHeading: '리포트 내용',
          promptHeading: '외부 생성형 AI용 프롬프트',
          noteHeading: '추가 안내',
        }
  }

  return kind === 'style'
    ? {
        subject: 'Personal AI Stylist body style report',
        heading: 'Your body style report is ready',
        intro:
          'Here is the styling result you requested. If a visual was generated, it is attached as well.',
        contentHeading: 'Report content',
        promptHeading: 'Prompt for external generative AI',
        noteHeading: 'Additional note',
      }
    : {
        subject: 'Personal AI Stylist hairstyle recommendation',
        heading: 'Your hairstyle recommendation is ready',
        intro:
          'Here is the hairstyle result you requested. If a 3x3 visual was generated, it is attached as well.',
        contentHeading: 'Report content',
        promptHeading: 'Prompt for external generative AI',
        noteHeading: 'Additional note',
      }
}

const buildHtmlEmail = ({
  strings,
  content,
  prompt,
  note,
  hasInlineImage,
}: {
  strings: ReturnType<typeof getLocalizedStrings>
  content: string
  prompt?: string
  note?: string
  hasInlineImage: boolean
}) => `
  <div style="margin:0;padding:24px;background:#f7f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#201720">
    <div style="max-width:680px;margin:0 auto;background:#fffaf8;border:1px solid #ead9d5;border-radius:24px;padding:28px">
      <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.14em;color:#ff115f">PERSONAL AI STYLIST</p>
      <h1 style="margin:0 0 10px;font-size:28px;line-height:1.1;color:#201720">${escapeHtml(strings.heading)}</h1>
      <p style="margin:0 0 18px;color:#5f4f5f;line-height:1.7">${escapeHtml(strings.intro)}</p>
      ${
        hasInlineImage
          ? '<div style="margin:0 0 20px"><img src="cid:report-image" alt="" style="display:block;max-width:100%;border-radius:18px;border:1px solid #ead9d5" /></div>'
          : ''
      }
      <div style="border-radius:18px;background:#fff;border:1px solid #ead9d5;padding:18px;margin-bottom:16px">
        <h2 style="margin:0 0 12px;font-size:17px;color:#201720">${escapeHtml(strings.contentHeading)}</h2>
        ${renderRichTextHtml(content)}
      </div>
      ${
        prompt
          ? `<div style="border-radius:18px;background:#fff;border:1px solid #ead9d5;padding:18px;margin-bottom:16px">
              <h2 style="margin:0 0 12px;font-size:17px;color:#201720">${escapeHtml(strings.promptHeading)}</h2>
              <pre style="margin:0;white-space:pre-wrap;word-break:break-word;color:#4a3d4a;line-height:1.7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px">${escapeHtml(prompt)}</pre>
            </div>`
          : ''
      }
      ${
        note
          ? `<div style="border-radius:18px;background:#fff;border:1px solid #ead9d5;padding:18px">
              <h2 style="margin:0 0 12px;font-size:17px;color:#201720">${escapeHtml(strings.noteHeading)}</h2>
              <p style="margin:0;color:#4a3d4a;line-height:1.7">${escapeHtml(note)}</p>
            </div>`
          : ''
      }
    </div>
  </div>
`

const buildPlainTextEmail = ({
  strings,
  content,
  prompt,
  note,
}: {
  strings: ReturnType<typeof getLocalizedStrings>
  content: string
  prompt?: string
  note?: string
}) =>
  [
    strings.heading,
    '',
    strings.intro,
    '',
    `[${strings.contentHeading}]`,
    stripFormatting(content),
    prompt ? `\n[${strings.promptHeading}]\n${stripFormatting(prompt)}` : '',
    note ? `\n[${strings.noteHeading}]\n${stripFormatting(note)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

const hashString = async (value: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

  if (!env.RESEND_API_KEY) {
    return jsonResponse(
      { error: 'RESEND_API_KEY is not configured on the server.' },
      500,
    )
  }

  let body: SendReportEmailBody

  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      { error: 'Unable to read the email request body.' },
      400,
    )
  }

  const kind = body.kind
  const language: Language = body.language === 'ko' ? 'ko' : 'en'
  const toEmail = body.toEmail?.trim() ?? ''
  const content = body.content?.trim() ?? ''
  const prompt = body.prompt?.trim() ?? ''
  const note = body.note?.trim() ?? ''
  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale: language === 'ko' ? 'ko-KR' : 'en-US',
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  if (kind !== 'style' && kind !== 'hair') {
    return jsonResponse(
      {
        error: isKorean(language)
          ? '전송할 리포트 종류가 올바르지 않습니다.'
          : 'The report type is invalid.',
      },
      400,
    )
  }

  if (!toEmail) {
    return jsonResponse(
      {
        error: isKorean(language)
          ? '이메일 주소를 입력해 주세요.'
          : 'Please enter an email address.',
      },
      400,
    )
  }

  if (!isValidEmail(toEmail)) {
    return jsonResponse(
      {
        error: isKorean(language)
          ? '올바른 이메일 주소를 입력해 주세요.'
          : 'Please enter a valid email address.',
      },
      400,
    )
  }

  if (
    authenticatedUser.email &&
    toEmail.toLowerCase() !== authenticatedUser.email.toLowerCase()
  ) {
    return jsonResponse(
      {
        error: isKorean(language)
          ? '현재 로그인한 계정 이메일로만 전송할 수 있습니다.'
          : 'Reports can only be sent to the signed-in account email.',
      },
      403,
    )
  }

  if (!content) {
    return jsonResponse(
      {
        error: isKorean(language)
          ? '전송할 리포트 내용이 없습니다.'
          : 'There is no report content to send.',
      },
      400,
    )
  }

  const strings = getLocalizedStrings(language, kind)
  const parsedImage = parseImageDataUrl(body.imageDataUrl)
  const imageExtension = parsedImage
    ? getFileExtension(parsedImage.mimeType)
    : null
  const fileName = parsedImage
    ? `${kind}-report.${imageExtension}`
    : null
  const html = buildHtmlEmail({
    strings,
    content,
    prompt,
    note,
    hasInlineImage: Boolean(parsedImage),
  })
  const text = buildPlainTextEmail({
    strings,
    content,
    prompt,
    note,
  })
  const idempotencyHash = await hashString(
    [kind, language, toEmail.toLowerCase(), content, prompt, note].join('|'),
  )

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `report-email/${kind}/${idempotencyHash.slice(0, 48)}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: [toEmail],
      subject: strings.subject,
      html,
      text,
      reply_to: env.RESEND_REPLY_TO ? [env.RESEND_REPLY_TO] : undefined,
      attachments: parsedImage && fileName
        ? [
            {
              filename: fileName,
              content: parsedImage.content,
              contentId: 'report-image',
            },
          ]
        : undefined,
      tags: [
        { name: 'report_kind', value: kind },
        { name: 'language', value: language },
      ],
    }),
  })

  const rawText = await resendResponse.text()
  const resendJson = rawText.trim()
    ? (JSON.parse(rawText) as ResendResponse)
    : null

  if (!resendResponse.ok || !resendJson?.id) {
    return jsonResponse(
      {
        error:
          resendJson?.message ??
          resendJson?.error ??
          (isKorean(language)
            ? '결과 리포트 이메일을 보내지 못했습니다.'
            : 'Unable to send the report email.'),
      },
      resendResponse.status || 500,
    )
  }

  return Response.json({
    id: resendJson.id,
    message: isKorean(language)
      ? '결과 리포트를 이메일로 보냈습니다.'
      : 'The report email has been sent.',
  })
}
