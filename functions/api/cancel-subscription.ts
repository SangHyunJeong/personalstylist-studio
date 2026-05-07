import { requireAuthenticatedUser } from './_supabaseAuth'
import {
  createPolarCustomerSessionForIdentity,
  deriveBillingAccessFromCustomerState,
  extractPolarErrorMessage,
  fetchPolarCustomerStateForIdentity,
  getPolarAuthErrorMessage,
  getBaseApiUrl,
  isPolarAuthErrorStatus,
  logPolarApiError,
  parsePolarJson,
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

type CancelSubscriptionBody = {
  preferredLocale?: string
}

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

const getCancelSuccessMessage = (preferredLocale?: string) =>
  isKoreanLocale(preferredLocale)
    ? '구독 해지를 예약했습니다. 현재 결제 주기 종료 전까지는 액세스가 유지됩니다.'
    : 'Your subscription cancellation has been scheduled. Access stays active until the current billing period ends.'

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

  if (!env.POLAR_ACCESS_TOKEN) {
    return jsonResponse(
      { error: 'Polar access token is not configured on the server.' },
      500,
    )
  }

  let body: CancelSubscriptionBody = {}

  try {
    body = (await request.json()) as CancelSubscriptionBody
  } catch {
    body = {}
  }

  const preferredLocale = body.preferredLocale ?? undefined

  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  const customerState = await fetchPolarCustomerStateForIdentity({
    env,
    externalCustomerId: authenticatedUser.id,
    customerEmail: authenticatedUser.email ?? '',
  })

  if (customerState.response.status === 404) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '해지할 활성 구독을 찾지 못했습니다.'
          : 'No active subscription was found to cancel.',
      },
      404,
    )
  }

  if (!customerState.response.ok) {
    const errorMessage = extractPolarErrorMessage(
      customerState.json as PolarApiErrorResponse | null,
    )
    const status = customerState.response.status || 500

    logPolarApiError({
      operation: 'cancel-subscription.fetchCustomerState',
      status,
      server: env.POLAR_SERVER,
      polarMessage: errorMessage || undefined,
    })

    return jsonResponse(
      {
        error: isPolarAuthErrorStatus(status)
          ? getPolarAuthErrorMessage(preferredLocale)
          : errorMessage ||
            (isKoreanLocale(preferredLocale)
              ? '구독 상태를 확인하지 못했습니다.'
              : 'Unable to verify the subscription state.'),
      },
      status,
    )
  }

  const accessSnapshot = deriveBillingAccessFromCustomerState({
    state: customerState.json as PolarCustomerStateResponse | null,
    fallbackEmail: authenticatedUser.email,
  })

  if (!accessSnapshot.subscription?.id) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '해지할 활성 구독을 찾지 못했습니다.'
          : 'No active subscription was found to cancel.',
      },
      404,
    )
  }

  const session = await createPolarCustomerSessionForIdentity({
    env,
    externalCustomerId: authenticatedUser.id,
    customerEmail: accessSnapshot.customerEmail || authenticatedUser.email || '',
  })

  if (!session.response.ok) {
    const errorMessage = extractPolarErrorMessage(
      session.json as PolarApiErrorResponse | null,
    )
    const status = session.response.status || 500

    logPolarApiError({
      operation: 'cancel-subscription.createCustomerSession',
      status,
      server: env.POLAR_SERVER,
      polarMessage: errorMessage || undefined,
    })

    return jsonResponse(
      {
        error: isPolarAuthErrorStatus(status)
          ? getPolarAuthErrorMessage(preferredLocale)
          : errorMessage ||
            (isKoreanLocale(preferredLocale)
              ? '구독 해지 세션을 만들지 못했습니다.'
              : 'Unable to create the subscription cancellation session.'),
      },
      status,
    )
  }

  const sessionJson = (session.json ?? {}) as {
    token?: string
    error?: { message?: string } | string
  }

  if (!sessionJson.token) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '구독 해지 세션을 만들지 못했습니다.'
          : 'Unable to create the subscription cancellation session.',
      },
      500,
    )
  }

  const cancelResponse = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customer-portal/subscriptions/${encodeURIComponent(accessSnapshot.subscription.id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${sessionJson.token}`,
        Accept: 'application/json',
      },
    },
  )

  const cancelJson = await parsePolarJson<PolarApiErrorResponse>(cancelResponse)

  if (!cancelResponse.ok) {
    const errorMessage = extractPolarErrorMessage(cancelJson)

    return jsonResponse(
      {
        error:
          errorMessage ||
          (isKoreanLocale(preferredLocale)
            ? '구독을 해지하지 못했습니다.'
            : 'Unable to cancel the subscription.'),
      },
      cancelResponse.status || 500,
    )
  }

  const refreshedState = await fetchPolarCustomerStateForIdentity({
    env,
    externalCustomerId: authenticatedUser.id,
    customerEmail: accessSnapshot.customerEmail || authenticatedUser.email || '',
  })

  if (!refreshedState.response.ok) {
    return Response.json({
      ...accessSnapshot,
      message: getCancelSuccessMessage(preferredLocale),
    })
  }

  const refreshedSnapshot = deriveBillingAccessFromCustomerState({
    state: refreshedState.json as PolarCustomerStateResponse | null,
    fallbackEmail: accessSnapshot.customerEmail || authenticatedUser.email,
  })

  return Response.json({
    ...refreshedSnapshot,
    message: getCancelSuccessMessage(preferredLocale),
  })
}
