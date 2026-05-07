import { requireAuthenticatedUser } from './_supabaseAuth'
import {
  POLAR_ONE_TIME_PRODUCT_ID,
  POLAR_SUBSCRIPTION_PRODUCT_ID,
  extractPolarErrorMessage,
  getPolarAuthErrorMessage,
  getBaseApiUrl,
  isPolarAuthErrorStatus,
  type PolarApiErrorResponse,
} from './_polarBilling'

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
  error?: PolarApiErrorResponse['error']
  detail?:
    | string
    | Array<{
        loc?: Array<string | number>
        msg?: string
        type?: string
      }>
}

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

const getPolarServerLabel = (server?: string) =>
  server === 'sandbox' ? 'sandbox' : 'production'

const parsePolarCheckoutJson = (rawText: string) => {
  if (!rawText.trim()) {
    return null
  }

  try {
    return JSON.parse(rawText) as PolarCheckoutResponse
  } catch {
    return null
  }
}

const extractPolarCheckoutErrorMessage = (
  payload: PolarCheckoutResponse | null,
) => {
  const standardError = extractPolarErrorMessage(payload)

  if (standardError) {
    return standardError
  }

  if (typeof payload?.detail === 'string') {
    return payload.detail
  }

  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item) => item.msg)
      .filter((message): message is string => Boolean(message))
      .join('; ')
  }

  return ''
}

const getLocalizedPolarCheckoutFallback = ({
  preferredLocale,
  checkoutKind,
  status,
}: {
  preferredLocale?: string
  checkoutKind: 'one_time' | 'subscription'
  status: number
}) => {
  const isKo = isKoreanLocale(preferredLocale)

  if (isPolarAuthErrorStatus(status)) {
    return getPolarAuthErrorMessage(preferredLocale)
  }

  if (status === 422) {
    return isKo
      ? 'Polar가 체크아웃 요청을 거부했습니다. POLAR_SERVER와 상품 ID가 같은 환경인지, products 필드에 Product ID를 보내는지 확인해주세요.'
      : 'Polar rejected the checkout request. Verify POLAR_SERVER matches the product IDs and that the request sends Product IDs in the products field.'
  }

  return isKo
    ? checkoutKind === 'subscription'
      ? 'Polar 구독 체크아웃 세션을 생성하지 못했습니다.'
      : 'Polar 결제 체크아웃 세션을 생성하지 못했습니다.'
    : checkoutKind === 'subscription'
      ? 'Unable to create the Polar subscription checkout session.'
      : 'Unable to create the Polar one-time checkout session.'
}

const logPolarCheckoutError = ({
  message,
  status,
  checkoutKind,
  productId,
  server,
  polarMessage,
  rawText,
}: {
  message: string
  status?: number
  checkoutKind: 'one_time' | 'subscription'
  productId: string
  server?: string
  polarMessage?: string
  rawText?: string
}) => {
  console.error('Polar checkout creation failed', {
    message,
    status,
    checkoutKind,
    productId,
    polarServer: getPolarServerLabel(server),
    polarMessage,
    rawResponse: rawText?.slice(0, 1000),
  })
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

  if (!env.POLAR_ACCESS_TOKEN) {
    console.error('Polar checkout configuration error', {
      message: 'POLAR_ACCESS_TOKEN is not configured.',
      polarServer: getPolarServerLabel(env.POLAR_SERVER),
    })

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
    checkoutKind?: 'one_time' | 'subscription'
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
  const checkoutKind =
    body.checkoutKind === 'subscription' ? 'subscription' : 'one_time'
  const productId =
    checkoutKind === 'subscription'
      ? POLAR_SUBSCRIPTION_PRODUCT_ID
      : POLAR_ONE_TIME_PRODUCT_ID

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

  const polarCheckoutPayload = {
    products: [productId],
    customer_email: authenticatedUser.email,
    external_customer_id: authenticatedUser.id,
    metadata: {
      supabase_user_id: authenticatedUser.id,
      checkout_kind: checkoutKind,
    },
    success_url: successUrl.toString(),
    return_url: returnUrl.toString(),
    locale: isKoreanLocale(preferredLocale) ? 'ko' : 'en',
  }

  let polarResponse: Response

  try {
    polarResponse = await fetch(`${getBaseApiUrl(env.POLAR_SERVER)}/v1/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(polarCheckoutPayload),
    })
  } catch (error) {
    logPolarCheckoutError({
      message: error instanceof Error ? error.message : 'Polar request failed.',
      checkoutKind,
      productId,
      server: env.POLAR_SERVER,
    })

    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? 'Polar 체크아웃 API에 연결하지 못했습니다.'
          : 'Unable to reach the Polar checkout API.',
      },
      502,
    )
  }

  const rawText = await polarResponse.text()
  const polarJson = parsePolarCheckoutJson(rawText)
  const polarErrorMessage = extractPolarCheckoutErrorMessage(polarJson)

  if (!polarResponse.ok || !polarJson?.url) {
    logPolarCheckoutError({
      message: !polarResponse.ok
        ? 'Polar returned an error response.'
        : 'Polar response did not include a checkout URL.',
      status: polarResponse.status,
      checkoutKind,
      productId,
      server: env.POLAR_SERVER,
      polarMessage: polarErrorMessage || undefined,
      rawText,
    })

    return jsonResponse(
      {
        error: isPolarAuthErrorStatus(polarResponse.status)
          ? getLocalizedPolarCheckoutFallback({
              preferredLocale,
              checkoutKind,
              status: polarResponse.status,
            })
          : polarErrorMessage ||
            getLocalizedPolarCheckoutFallback({
              preferredLocale,
              checkoutKind,
              status: polarResponse.status,
            }),
      },
      polarResponse.status || 500,
    )
  }

  return Response.json({ url: polarJson.url })
}
