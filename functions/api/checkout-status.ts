interface Env {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
}

interface PagesContext {
  request: Request
  env: Env
}

type PolarCheckoutStatusResponse = {
  status?: string
  product_id?: string
  order_id?: string
  error?: {
    message?: string
  }
}

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

export async function onRequestGet(context: PagesContext) {
  const { request, env } = context

  if (!env.POLAR_ACCESS_TOKEN) {
    return jsonResponse(
      { error: 'Polar access token is not configured on the server.' },
      500,
    )
  }

  const url = new URL(request.url)
  const checkoutId = url.searchParams.get('checkout_id')
  const preferredLocale = url.searchParams.get('preferred_locale') ?? undefined

  if (!checkoutId) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? 'checkout_id가 필요합니다.'
          : 'checkout_id is required.',
      },
      400,
    )
  }

  const polarResponse = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/checkouts/${checkoutId}`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      },
    },
  )

  const rawText = await polarResponse.text()
  const polarJson = rawText.trim()
    ? (JSON.parse(rawText) as PolarCheckoutStatusResponse)
    : null

  if (!polarResponse.ok || !polarJson?.status) {
    return jsonResponse(
      {
        error:
          polarJson?.error?.message ??
          (isKoreanLocale(preferredLocale)
            ? 'Polar checkout 상태를 확인하지 못했습니다.'
            : 'Unable to verify the Polar checkout status.'),
      },
      polarResponse.status || 500,
    )
  }

  return Response.json({
    status: polarJson.status,
    productId: polarJson.product_id ?? '',
    orderId: polarJson.order_id ?? '',
  })
}
