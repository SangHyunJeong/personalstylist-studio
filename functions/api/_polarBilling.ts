export interface PolarEnv {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
}

export type PolarApiErrorResponse = {
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
    state?.customer?.email?.trim() || fallbackEmail?.trim() || ''

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
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN ?? ""}`,
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
