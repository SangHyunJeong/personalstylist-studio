export type AnalyticsParams = Record<string, unknown>

export type AnalyticsItem = {
  item_id: string
  item_name: string
  affiliation: string
  item_brand: string
  item_category: string
  item_category2?: string
  item_list_id?: string
  item_list_name?: string
  item_variant?: string
  index?: number
  quantity?: number
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (
      command: 'event',
      eventName: string,
      params?: Record<string, unknown>,
    ) => void
  }
}

const AFFILIATION = 'Personal AI Stylist'
const BRAND = 'Personal AI Stylist'
const ONE_TIME_ACCESS_ITEM_ID = '82fb5b93-ef0a-4af0-914c-05aaf8882da2'
const SUBSCRIPTION_ITEM_ID = 'f417ba31-0bf8-4e38-9367-334264abeb43'

export const HOME_ITEM_LIST_ID = 'home_recommendations'
export const HOME_ITEM_LIST_NAME = 'Home recommendations'
export const SUBSCRIPTION_PROMOTION_ID = 'daily_brief_trial'
export const SUBSCRIPTION_PROMOTION_NAME = '7-day free trial'
export const SUBSCRIPTION_PROMOTION_SLOT = 'account_subscription_section'

const cleanRecord = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) {
        return false
      }

      if (typeof entry === 'string') {
        return entry.trim().length > 0
      }

      return true
    }),
  )

const cleanParamValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'object' && entry !== null) {
          return cleanRecord(entry as Record<string, unknown>)
        }

        return entry
      })
      .filter((entry) => entry !== undefined && entry !== null && entry !== '')
  }

  return value
}

const track = (eventName: string, params: AnalyticsParams = {}) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }

  const cleanedParams = cleanRecord(
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, cleanParamValue(value)]),
    ),
  )

  window.gtag('event', eventName, cleanedParams)
}

export const trackEvent = (eventName: string, params: AnalyticsParams = {}) => {
  track(eventName, params)
}

export const trackPageView = ({
  page_title,
  page_path,
  page_location,
  language,
}: {
  page_title: string
  page_path: string
  page_location: string
  language: string
}) => {
  track('page_view', {
    page_title,
    page_path,
    page_location,
    language,
  })
}

export const getHomeRecommendationItems = (): AnalyticsItem[] => [
  {
    affiliation: AFFILIATION,
    item_brand: BRAND,
    item_id: 'body_style_report',
    item_name: 'Body Style Report',
    item_category: 'feature_entry',
    item_category2: 'body_styling',
    item_list_id: HOME_ITEM_LIST_ID,
    item_list_name: HOME_ITEM_LIST_NAME,
    index: 0,
    quantity: 1,
  },
  {
    affiliation: AFFILIATION,
    item_brand: BRAND,
    item_id: 'hairstyling_recommendation',
    item_name: 'Hairstyling Recommendation',
    item_category: 'feature_entry',
    item_category2: 'hair_styling',
    item_list_id: HOME_ITEM_LIST_ID,
    item_list_name: HOME_ITEM_LIST_NAME,
    index: 1,
    quantity: 1,
  },
]

export const buildFeatureItem = (entryFlow: 'style' | 'hair'): AnalyticsItem =>
  entryFlow === 'style'
    ? {
        affiliation: AFFILIATION,
        item_brand: BRAND,
        item_id: 'body_style_report',
        item_name: 'Body Style Report',
        item_category: 'feature_entry',
        item_category2: 'body_styling',
        quantity: 1,
      }
    : {
        affiliation: AFFILIATION,
        item_brand: BRAND,
        item_id: 'hairstyling_recommendation',
        item_name: 'Hairstyling Recommendation',
        item_category: 'feature_entry',
        item_category2: 'hair_styling',
        quantity: 1,
      }

export const buildCheckoutItem = ({
  checkoutKind,
  entryFlow,
  subscriptionStatus,
}: {
  checkoutKind: 'one_time' | 'subscription'
  entryFlow?: 'style' | 'hair' | 'subscription' | null
  subscriptionStatus?: 'trialing' | 'active' | null
}): AnalyticsItem => {
  if (checkoutKind === 'subscription') {
    return {
      affiliation: AFFILIATION,
      item_brand: BRAND,
      item_id: SUBSCRIPTION_ITEM_ID,
      item_name: 'Daily Morning Style Brief Subscription',
      item_category: 'subscription',
      item_category2: 'daily_brief',
      item_variant: subscriptionStatus ?? 'checkout_started',
      quantity: 1,
    }
  }

  return {
    affiliation: AFFILIATION,
    item_brand: BRAND,
    item_id: ONE_TIME_ACCESS_ITEM_ID,
    item_name: 'One-Time AI Styling Access',
    item_category: 'checkout',
    item_category2: 'digital_access',
    item_variant: entryFlow ?? 'direct',
    quantity: 1,
  }
}

export const buildSubscriptionPromotionItem = (): AnalyticsItem => ({
  affiliation: AFFILIATION,
  item_brand: BRAND,
  item_id: SUBSCRIPTION_ITEM_ID,
  item_name: 'Daily Morning Style Brief Subscription',
  item_category: 'subscription',
  item_category2: 'free_trial_offer',
  item_variant: '7_day_free_trial',
  quantity: 1,
})
