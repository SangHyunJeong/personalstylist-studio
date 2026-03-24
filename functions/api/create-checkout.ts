import { requireAuthenticatedUser } from './_supabaseAuth'
import { POLAR_SUBSCRIPTION_PRODUCT_ID, getBaseApiUrl } from './_polarBilling'

interface Env {
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

type PolarCheckoutResponse = {
  url?: string
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

  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  if (!authenticatedUser.email) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '체크아웃을 시작하려면 이메일 계정이 필요합니다.'
          : 'An email account is required to start checkout.',
      },
      400,
    )
  }

  const returnUrl = new URL(currentUrl)
  const successUrl = new URL(currentUrl)
  successUrl.searchParams.set('checkout', 'success')
  successUrl.searchParams.set('checkout_id', '{CHECKOUT_ID}')

  const polarResponse = await fetch(`${getBaseApiUrl(env.POLAR_SERVER)}/v1/checkouts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [POLAR_SUBSCRIPTION_PRODUCT_ID],
      customer_email: authenticatedUser.email,
      external_customer_id: authenticatedUser.id,
      metadata: {
        supabase_user_id: authenticatedUser.id,
        checkout_kind: 'subscription',
      },
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
            ? 'Polar 구독 체크아웃 세션을 생성하지 못했습니다.'
            : 'Unable to create the Polar subscription checkout session.'),
      },
      polarResponse.status || 500,
    )
  }

  return Response.json({ url: polarJson.url })
}
