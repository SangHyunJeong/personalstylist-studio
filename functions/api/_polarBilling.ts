export interface PolarEnv {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
}

export type PolarApiErrorResponse = {
  error?: {
    message?: string
  } | string
}

export type PolarCustomer = {
  id?: string
  email?: string
  external_id?: string | null
}

type PolarCustomerListResponse = {
  items?: PolarCustomer[]
  error?: {
    message?: string
  } | string
}

type PolarCustomerStateSubscription = {
  id?: string
  status?: string
  cancel_at_period_end?: boolean
  cancelAtPeriodEnd?: boolean
  current_period_end?: string | null
  currentPeriodEnd?: string | null
  current_period_start?: string | null
  currentPeriodStart?: string | null
  trial_ends_at?: string | null
  trialEndsAt?: string | null
  ends_at?: string | null
  endsAt?: string | null
  product_id?: string
  product?: {
    id?: string
  }
  products?: Array<string | { id?: string }>
  items?: Array<{
    product_id?: string
    product?: {
      id?: string
    }
  }>
}

export type PolarCustomerStateResponse = {
  customer?: {
    email?: string
  }
  email?: string
  active_subscriptions?: PolarCustomerStateSubscription[]
  activeSubscriptions?: PolarCustomerStateSubscription[]
  granted_benefits?: Array<Record<string, unknown>>
  grantedBenefits?: Array<Record<string, unknown>>
  error?: {
    message?: string
  }
}

export type BillingSubscriptionSnapshot = {
  id: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  currentPeriodStart: string | null
  trialEndsAt: string | null
  endsAt: string | null
}

export type BillingAccessSnapshot = {
  hasAccess: boolean
  subscriptionStatus: 'inactive' | 'trialing' | 'active'
  customerEmail: string
  subscription: BillingSubscriptionSnapshot | null
}

export const POLAR_ONE_TIME_PRODUCT_ID =
  '82fb5b93-ef0a-4af0-914c-05aaf8882da2'

export const POLAR_SUBSCRIPTION_PRODUCT_ID =
  'f417ba31-0bf8-4e38-9367-334264abeb43'

export const getBaseApiUrl = (server?: string) =>
  server === 'sandbox'
    ? 'https://sandbox-api.polar.sh'
    : 'https://api.polar.sh'

export const parsePolarJson = async <T,>(response: Response) => {
  const rawText = await response.text()

  if (!rawText.trim()) {
    return null
  }

  return JSON.parse(rawText) as T
}

export const extractPolarErrorMessage = (
  payload: PolarApiErrorResponse | PolarCustomerStateResponse | null,
) => {
  if (!payload) {
    return ''
  }

  if (typeof payload.error === 'string') {
    return payload.error
  }

  return payload.error?.message ?? ''
}

export const isPolarAuthErrorStatus = (status: number) =>
  status === 401 || status === 403

export const getPolarAuthErrorMessage = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko')
    ? 'Polar 액세스 토큰이 없거나 만료되었거나 필요한 권한이 없습니다. 서버 환경변수 POLAR_ACCESS_TOKEN과 토큰 스코프를 확인해주세요.'
    : 'The Polar access token is missing, expired, or does not have the required scope. Check the POLAR_ACCESS_TOKEN server environment variable and token scopes.'

export const logPolarApiError = ({
  operation,
  status,
  server,
  polarMessage,
}: {
  operation: string
  status: number
  server?: string
  polarMessage?: string
}) => {
  console.error('Polar API request failed', {
    operation,
    status,
    polarServer: server === 'sandbox' ? 'sandbox' : 'production',
    polarMessage,
  })
}

const normalizeSubscriptionStatus = (status?: string) =>
  status?.trim().toLowerCase() ?? ''

const extractSubscriptionProductIds = (
  subscription: PolarCustomerStateSubscription,
) => {
  const productIds = new Set<string>()

  if (subscription.product_id) {
    productIds.add(subscription.product_id)
  }

  if (subscription.product?.id) {
    productIds.add(subscription.product.id)
  }

  for (const product of subscription.products ?? []) {
    if (typeof product === 'string') {
      if (product) {
        productIds.add(product)
      }

      continue
    }

    if (product?.id) {
      productIds.add(product.id)
    }
  }

  for (const item of subscription.items ?? []) {
    if (item.product_id) {
      productIds.add(item.product_id)
    }

    if (item.product?.id) {
      productIds.add(item.product.id)
    }
  }

  return [...productIds]
}

const matchesTargetProduct = (subscription: PolarCustomerStateSubscription) =>
  extractSubscriptionProductIds(subscription).includes(POLAR_SUBSCRIPTION_PRODUCT_ID)

const summarizeSubscription = (
  subscription?: PolarCustomerStateSubscription,
): BillingSubscriptionSnapshot | null => {
  if (!subscription?.id) {
    return null
  }

  return {
    id: subscription.id,
    status: normalizeSubscriptionStatus(subscription.status) || 'active',
    cancelAtPeriodEnd: Boolean(
      subscription.cancel_at_period_end ?? subscription.cancelAtPeriodEnd,
    ),
    currentPeriodEnd:
      subscription.current_period_end ?? subscription.currentPeriodEnd ?? null,
    currentPeriodStart:
      subscription.current_period_start ?? subscription.currentPeriodStart ?? null,
    trialEndsAt: subscription.trial_ends_at ?? subscription.trialEndsAt ?? null,
    endsAt: subscription.ends_at ?? subscription.endsAt ?? null,
  }
}

export const deriveBillingAccessFromCustomerState = ({
  state,
  fallbackEmail,
}: {
  state: PolarCustomerStateResponse | null
  fallbackEmail?: string
}): BillingAccessSnapshot => {
  const activeSubscriptions = [
    ...(state?.active_subscriptions ?? []),
    ...(state?.activeSubscriptions ?? []),
  ].filter(matchesTargetProduct)

  const trialingSubscription = activeSubscriptions.find(
    (subscription) => normalizeSubscriptionStatus(subscription.status) === 'trialing',
  )

  const activeSubscription = activeSubscriptions.find((subscription) => {
    const status = normalizeSubscriptionStatus(subscription.status)
    return status === 'active' || status === 'trialing' || !status
  })
  const currentSubscription = trialingSubscription ?? activeSubscription ?? null

  const hasAccess = Boolean(trialingSubscription || activeSubscription)
  const customerEmail =
    state?.customer?.email?.trim() ||
    state?.email?.trim() ||
    fallbackEmail?.trim() ||
    ''

  return {
    hasAccess,
    subscriptionStatus: trialingSubscription
      ? 'trialing'
      : hasAccess
        ? 'active'
        : 'inactive',
    customerEmail,
    subscription: summarizeSubscription(currentSubscription ?? undefined),
  }
}

export const fetchPolarCustomerStateByExternalId = async ({
  env,
  externalCustomerId,
}: {
  env: PolarEnv
  externalCustomerId: string
}) => {
  const response = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customers/external/${encodeURIComponent(externalCustomerId)}/state`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  const json = await parsePolarJson<
    PolarCustomerStateResponse | PolarApiErrorResponse
  >(response)

  return {
    response,
    json,
  }
}

export const fetchPolarCustomerStateByCustomerId = async ({
  env,
  customerId,
}: {
  env: PolarEnv
  customerId: string
}) => {
  const response = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customers/${encodeURIComponent(customerId)}/state`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  const json = await parsePolarJson<
    PolarCustomerStateResponse | PolarApiErrorResponse
  >(response)

  return {
    response,
    json,
  }
}

export const fetchPolarCustomerById = async ({
  env,
  customerId,
}: {
  env: PolarEnv
  customerId: string
}) => {
  const response = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customers/${encodeURIComponent(customerId)}`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  const json = await parsePolarJson<PolarCustomer | PolarApiErrorResponse>(response)

  return {
    response,
    json,
  }
}

export const fetchPolarCustomerByExternalId = async ({
  env,
  externalCustomerId,
}: {
  env: PolarEnv
  externalCustomerId: string
}) => {
  const response = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customers/external/${encodeURIComponent(externalCustomerId)}`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  const json = await parsePolarJson<PolarCustomer | PolarApiErrorResponse>(response)

  return {
    response,
    json,
  }
}

const listPolarCustomersByEmail = async ({
  env,
  email,
}: {
  env: PolarEnv
  email: string
}) => {
  const response = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customers/?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  const json = await parsePolarJson<
    PolarCustomerListResponse | PolarApiErrorResponse
  >(response)

  return {
    response,
    json,
  }
}

const updatePolarCustomerExternalId = async ({
  env,
  customerId,
  externalCustomerId,
}: {
  env: PolarEnv
  customerId: string
  externalCustomerId: string
}) => {
  const response = await fetch(
    `${getBaseApiUrl(env.POLAR_SERVER)}/v1/customers/${encodeURIComponent(customerId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: externalCustomerId,
      }),
    },
  )

  return response.ok
}

export const resolvePolarCustomerForIdentity = async ({
  env,
  externalCustomerId,
  customerEmail,
  customerId,
}: {
  env: PolarEnv
  externalCustomerId?: string
  customerEmail?: string
  customerId?: string
}) => {
  if (externalCustomerId) {
    const byExternalId = await fetchPolarCustomerByExternalId({
      env,
      externalCustomerId,
    })

    if (byExternalId.response.ok) {
      return {
        response: byExternalId.response,
        json: byExternalId.json,
        customer: byExternalId.json as PolarCustomer,
      }
    }

    if (byExternalId.response.status !== 404) {
      return {
        response: byExternalId.response,
        json: byExternalId.json,
        customer: null,
      }
    }
  }

  if (customerId) {
    const byCustomerId = await fetchPolarCustomerById({
      env,
      customerId,
    })

    if (byCustomerId.response.ok) {
      return {
        response: byCustomerId.response,
        json: byCustomerId.json,
        customer: byCustomerId.json as PolarCustomer,
      }
    }

    if (byCustomerId.response.status !== 404) {
      return {
        response: byCustomerId.response,
        json: byCustomerId.json,
        customer: null,
      }
    }
  }

  const normalizedEmail = customerEmail?.trim().toLowerCase() ?? ''

  if (!normalizedEmail) {
    return {
      response: new Response(null, { status: 404 }),
      json: { error: { message: 'Customer could not be resolved.' } },
      customer: null,
    }
  }

  const customerList = await listPolarCustomersByEmail({
    env,
    email: normalizedEmail,
  })

  if (!customerList.response.ok) {
    return {
      response: customerList.response,
      json: customerList.json,
      customer: null,
    }
  }

  const matchedCustomer = (
    (customerList.json as PolarCustomerListResponse | null)?.items ?? []
  ).find((candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail)

  if (!matchedCustomer?.id) {
    return {
      response: new Response(null, { status: 404 }),
      json: { error: { message: 'Customer was not found for the supplied identity.' } },
      customer: null,
    }
  }

  if (externalCustomerId && matchedCustomer.external_id !== externalCustomerId) {
    await updatePolarCustomerExternalId({
      env,
      customerId: matchedCustomer.id,
      externalCustomerId,
    }).catch(() => false)
  }

  return {
    response: customerList.response,
    json: matchedCustomer,
    customer: {
      ...matchedCustomer,
      external_id: externalCustomerId || matchedCustomer.external_id || null,
    },
  }
}

type PolarCustomerSessionResponse = {
  token?: string
  customer_id?: string
  customer_portal_url?: string
  customer?: {
    email?: string
  }
  error?: {
    message?: string
  } | string
}

export const createPolarCustomerSessionForIdentity = async ({
  env,
  externalCustomerId,
  customerEmail,
  customerId,
  returnUrl,
}: {
  env: PolarEnv
  externalCustomerId?: string
  customerEmail?: string
  customerId?: string
  returnUrl?: string
}) => {
  const resolvedCustomer = await resolvePolarCustomerForIdentity({
    env,
    externalCustomerId,
    customerEmail,
    customerId,
  })

  if (!resolvedCustomer.customer?.id) {
    return {
      response: resolvedCustomer.response,
      json: resolvedCustomer.json,
      customer: null,
    }
  }

  const response = await fetch(`${getBaseApiUrl(env.POLAR_SERVER)}/v1/customer-sessions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_id: resolvedCustomer.customer.id,
      return_url: returnUrl || undefined,
    }),
  })

  const json = await parsePolarJson<
    PolarCustomerSessionResponse | PolarApiErrorResponse
  >(response)

  return {
    response,
    json,
    customer: resolvedCustomer.customer,
  }
}

export const fetchPolarCustomerStateForIdentity = async ({
  env,
  externalCustomerId,
  customerEmail,
  customerId,
}: {
  env: PolarEnv
  externalCustomerId?: string
  customerEmail?: string
  customerId?: string
}) => {
  if (externalCustomerId) {
    const byExternalId = await fetchPolarCustomerStateByExternalId({
      env,
      externalCustomerId,
    })

    if (byExternalId.response.ok || byExternalId.response.status !== 404) {
      return byExternalId
    }
  }

  if (customerId) {
    const byCustomerId = await fetchPolarCustomerStateByCustomerId({
      env,
      customerId,
    })

    if (byCustomerId.response.ok || byCustomerId.response.status !== 404) {
      return byCustomerId
    }
  }

  const normalizedEmail = customerEmail?.trim().toLowerCase() ?? ''

  if (!normalizedEmail) {
    return {
      response: new Response(null, { status: 404 }),
      json: { error: { message: 'Customer state could not be resolved.' } },
    }
  }

  const customerList = await listPolarCustomersByEmail({
    env,
    email: normalizedEmail,
  })

  if (!customerList.response.ok) {
    return {
      response: customerList.response,
      json: customerList.json,
    }
  }

  const matchedCustomer = ((customerList.json as PolarCustomerListResponse | null)?.items ?? []).find(
    (candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail,
  )

  if (!matchedCustomer?.id) {
    return {
      response: new Response(null, { status: 404 }),
      json: { error: { message: 'Customer was not found for the supplied identity.' } },
    }
  }

  if (externalCustomerId && matchedCustomer.external_id !== externalCustomerId) {
    await updatePolarCustomerExternalId({
      env,
      customerId: matchedCustomer.id,
      externalCustomerId,
    }).catch(() => false)
  }

  return fetchPolarCustomerStateByCustomerId({
    env,
    customerId: matchedCustomer.id,
  })
}
