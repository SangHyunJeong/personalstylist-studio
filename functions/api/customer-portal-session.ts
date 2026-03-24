import { requireAuthenticatedUser } from './_supabaseAuth'
import {
  createPolarCustomerSessionForIdentity,
  extractPolarErrorMessage,
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

type CustomerPortalBody = {
  preferredLocale?: string
  returnUrl?: string
}

type CustomerPortalSessionResponse = {
  customer_portal_url?: string
  customer?: {
    email?: string
  }
  error?: {
    message?: string
  } | string
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
      { error: 'Polar access token is not configured on the server.' },
      500,
    )
  }

  let body: CustomerPortalBody = {}

  try {
    body = (await request.json()) as CustomerPortalBody
  } catch {
    body = {}
  }

  const preferredLocale = body.preferredLocale ?? undefined
  const fallbackReturnUrl = `${new URL(request.url).origin}/#account`

  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  const session = await createPolarCustomerSessionForIdentity({
    env,
    externalCustomerId: authenticatedUser.id,
    customerEmail: authenticatedUser.email ?? '',
    returnUrl: body.returnUrl?.trim() || fallbackReturnUrl,
  })

  if (!session.response.ok) {
    const errorMessage = extractPolarErrorMessage(
      session.json as PolarApiErrorResponse | null,
    )

    return jsonResponse(
      {
        error:
          errorMessage ||
          (isKoreanLocale(preferredLocale)
            ? '구독 관리 링크를 생성하지 못했습니다.'
            : 'Unable to create the subscription management link.'),
      },
      session.response.status || 500,
    )
  }

  const portalJson = session.json as CustomerPortalSessionResponse | null

  if (!portalJson?.customer_portal_url) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '구독 관리 링크를 생성하지 못했습니다.'
          : 'Unable to create the subscription management link.',
      },
      500,
    )
  }

  return Response.json({
    url: portalJson.customer_portal_url,
    customerEmail:
      portalJson.customer?.email?.trim() ||
      session.customer?.email?.trim() ||
      authenticatedUser.email ||
      '',
  })
}
