import { requireAuthenticatedUser } from './_supabaseAuth'
import {
  deriveBillingAccessFromCustomerState,
  extractPolarErrorMessage,
  fetchPolarCustomerStateByExternalId,
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
  const preferredLocale = url.searchParams.get('preferred_locale') ?? undefined

  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  const customerState = await fetchPolarCustomerStateByExternalId({
    env,
    externalCustomerId: authenticatedUser.id,
  })

  if (customerState.response.status === 404) {
    return Response.json({
      hasAccess: false,
      subscriptionStatus: 'inactive',
      customerEmail: authenticatedUser.email,
    })
  }

  if (!customerState.response.ok) {
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
  }

  const accessSnapshot = deriveBillingAccessFromCustomerState({
    state: customerState.json as PolarCustomerStateResponse | null,
    fallbackEmail: authenticatedUser.email,
  })

  return Response.json(accessSnapshot)
}
