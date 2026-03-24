import { requireAuthenticatedUser } from './_supabaseAuth'
import {
  deriveBillingAccessFromCustomerState,
  extractPolarErrorMessage,
  fetchPolarCustomerStateForIdentity,
  getBaseApiUrl,
  parsePolarJson,
  POLAR_ONE_TIME_PRODUCT_ID,
  POLAR_SUBSCRIPTION_PRODUCT_ID,
  type PolarApiErrorResponse,
  type PolarCustomerStateResponse,
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

type PolarCheckoutStatusResponse = {
  status?: string
  product_id?: string
  order_id?: string
  customer_id?: string
  customer_email?: string
  metadata?: {
    checkout_kind?: string
    supabase_user_id?: string
  }
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

  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  const polarResponse = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/checkouts/${checkoutId}`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      },
    },
  )

  const polarJson = await parsePolarJson<PolarCheckoutStatusResponse>(polarResponse)

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

  if (
    polarJson.metadata?.supabase_user_id &&
    polarJson.metadata.supabase_user_id !== authenticatedUser.id
  ) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '현재 로그인한 계정과 다른 체크아웃입니다.'
          : 'This checkout belongs to a different signed-in account.',
      },
      403,
    )
  }

  const productId = polarJson.product_id ?? ''
  const checkoutKind =
    polarJson.metadata?.checkout_kind === 'subscription'
      ? 'subscription'
      : polarJson.metadata?.checkout_kind === 'one_time'
        ? 'one_time'
        : productId === POLAR_SUBSCRIPTION_PRODUCT_ID
          ? 'subscription'
          : 'one_time'

  let hasAccess = false
  let subscriptionStatus: 'inactive' | 'trialing' | 'active' = 'inactive'
  let customerEmail = polarJson.customer_email ?? authenticatedUser.email ?? ''
  let subscription: ReturnType<typeof deriveBillingAccessFromCustomerState>['subscription'] = null

  if (polarJson.status === 'succeeded' && checkoutKind === 'one_time') {
    hasAccess = productId === POLAR_ONE_TIME_PRODUCT_ID || !productId
  }

  if (polarJson.status === 'succeeded' && checkoutKind === 'subscription') {
    const customerState = await fetchPolarCustomerStateForIdentity({
      env,
      externalCustomerId: authenticatedUser.id,
      customerEmail: polarJson.customer_email ?? authenticatedUser.email ?? '',
      customerId: polarJson.customer_id,
    })

    if (customerState.response.status === 404) {
      hasAccess = false
      subscriptionStatus = 'inactive'
    } else if (!customerState.response.ok) {
      const errorMessage = extractPolarErrorMessage(
        customerState.json as PolarApiErrorResponse | null,
      )

      return jsonResponse(
        {
          error:
            errorMessage ||
            (isKoreanLocale(preferredLocale)
              ? 'Polar 구독 상태를 확인하지 못했습니다.'
              : 'Unable to verify the Polar subscription state.'),
        },
        customerState.response.status || 500,
      )
    } else {
      const accessSnapshot = deriveBillingAccessFromCustomerState({
        state: customerState.json as PolarCustomerStateResponse | null,
        fallbackEmail: customerEmail,
      })

      hasAccess = accessSnapshot.hasAccess
      subscriptionStatus = accessSnapshot.subscriptionStatus
      customerEmail = accessSnapshot.customerEmail || customerEmail
      subscription = accessSnapshot.subscription
    }
  }

  return Response.json({
    status: polarJson.status,
    checkoutKind,
    productId:
      productId ||
      (checkoutKind === 'subscription'
        ? POLAR_SUBSCRIPTION_PRODUCT_ID
        : POLAR_ONE_TIME_PRODUCT_ID),
    orderId: polarJson.order_id ?? '',
    customerEmail,
    hasAccess,
    subscriptionStatus,
    subscription,
  })
}
