interface Env {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
}

interface PagesContext {
  request: Request
  env: Env
}

type PolarCheckoutResponse = {
  url?: string
  error?: {
    message?: string
  }
}

const PRODUCT_ID = '002b35bb-9e2b-450c-9127-6a4175c61347'

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

const getBaseApiUrl = (server?: string) =>
  server === 'sandbox'
    ? 'https://sandbox-api.polar.sh'
    : 'https://api.polar.sh'

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

  if (!env.POLAR_ACCESS_TOKEN) {
    return jsonResponse(
      {
        error: 'Polar access token is not configured on the server.',
      },
      500,
    )
  }

  let body: {
    preferredLocale?: string
    currentUrl?: string
  }

  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      { error: 'Unable to read the checkout request body.' },
      400,
    )
  }

  const { preferredLocale, currentUrl } = body

  if (!currentUrl) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '결제를 시작할 현재 페이지 정보가 필요합니다.'
          : 'The current page URL is required to start checkout.',
      },
      400,
    )
  }

  const returnUrl = new URL(currentUrl)
  const successUrl = new URL(currentUrl)
  successUrl.searchParams.set('checkout', 'success')
  successUrl.searchParams.set('checkout_id', '{CHECKOUT_ID}')

  const apiUrl = `${getBaseApiUrl(env.POLAR_SERVER)}/v1/checkouts/`
  const polarResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [PRODUCT_ID],
      success_url: successUrl.toString(),
      return_url: returnUrl.toString(),
      locale: isKoreanLocale(preferredLocale) ? 'ko' : 'en',
    }),
  })

  const rawText = await polarResponse.text()
  const polarJson = rawText.trim()
    ? (JSON.parse(rawText) as PolarCheckoutResponse)
    : null

  if (!polarResponse.ok || !polarJson?.url) {
    return jsonResponse(
      {
        error:
          polarJson?.error?.message ??
          (isKoreanLocale(preferredLocale)
            ? 'Polar 결제 세션을 생성하지 못했습니다.'
            : 'Unable to create the Polar checkout session.'),
      },
      polarResponse.status || 500,
    )
  }

  return Response.json({ url: polarJson.url })
}
