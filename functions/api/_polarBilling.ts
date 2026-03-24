export interface PolarEnv {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
}

export type PolarApiErrorResponse = {
  error?: {
    message?: string
  } | string
}

type PolarCustomer = {
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

export type BillingAccessSnapshot = {
  hasAccess: boolean
  subscriptionStatus: 'inactive' | 'trialing' | 'active'
  customerEmail: string
}

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
    if (typeof product === 'string' && product) {
      productIds.add(product)
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
