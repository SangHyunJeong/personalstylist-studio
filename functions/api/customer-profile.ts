import type { DailyStyleProfileRecord, DailyStylistEnv } from './_dailyStylist'
import { fetchCustomerStyleProfile, saveCustomerStyleProfile } from './_dailyStylist'
import type { SupabaseAuthEnv } from './_supabaseAuth'
import { requireAuthenticatedUser } from './_supabaseAuth'

interface Env extends DailyStylistEnv, SupabaseAuthEnv {}

interface PagesContext {
  request: Request
  env: Env
}

type SerializedCustomerProfile = {
  email: string
  heightCm: number
  weightKg: number
  locationQuery: string
  locationName: string
  countryCode: string | null
  timezone: string
  dailyEmailEnabled: boolean
  preferredLocale: string
  hasPhoto: boolean
  nextDeliveryAtUtc: string | null
  lastDailySentLocalDate: string | null
  lastDailySentAt: string | null
  updatedAt: string
}

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

const getPreferredLocaleFromUrl = (request: Request) =>
  new URL(request.url).searchParams.get('preferred_locale')?.trim() || undefined

const serializeProfile = (
  profile: DailyStyleProfileRecord | null,
): SerializedCustomerProfile | null => {
  if (!profile) {
    return null
  }

  return {
    email: profile.email,
    heightCm: profile.height_cm,
    weightKg: Number(profile.weight_kg),
    locationQuery: profile.location_query,
    locationName: profile.location_name,
    countryCode: profile.country_code,
    timezone: profile.timezone,
    dailyEmailEnabled: profile.daily_email_enabled,
    preferredLocale: profile.preferred_locale,
    hasPhoto: Boolean(profile.photo_object_key),
    nextDeliveryAtUtc: profile.next_delivery_at_utc,
    lastDailySentLocalDate: profile.last_daily_sent_local_date,
    lastDailySentAt: profile.last_daily_sent_at,
    updatedAt: profile.updated_at,
  }
}

export async function onRequestGet(context: PagesContext) {
  const { request, env } = context
  const preferredLocale = getPreferredLocaleFromUrl(request)
  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  try {
    const profile = await fetchCustomerStyleProfile({
      env,
      userId: authenticatedUser.id,
    })

    return Response.json({
      profile: serializeProfile(profile),
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : isKoreanLocale(preferredLocale)
              ? '고객 프로필을 불러오지 못했습니다.'
              : 'Unable to load the customer profile.',
      },
      500,
    )
  }
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context
  const urlPreferredLocale = getPreferredLocaleFromUrl(request)
  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale: urlPreferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return jsonResponse(
      {
        error: isKoreanLocale(urlPreferredLocale)
          ? '프로필 저장 요청을 읽지 못했습니다.'
          : 'Unable to read the profile form data.',
      },
      400,
    )
  }

  const preferredLocale =
    String(formData.get('preferredLocale') ?? urlPreferredLocale ?? '').trim() ||
    urlPreferredLocale ||
    undefined

  if (!authenticatedUser.email) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '로그인된 이메일 계정이 필요합니다.'
          : 'A signed-in email account is required.',
      },
      400,
    )
  }

  try {
    const profile = await saveCustomerStyleProfile({
      env,
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      formData,
      preferredLocale,
    })

    return Response.json({
      message: isKoreanLocale(preferredLocale)
        ? '일일 스타일 프로필을 저장했습니다.'
        : 'Your daily styling profile has been saved.',
      profile: serializeProfile(profile),
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : isKoreanLocale(preferredLocale)
              ? '일일 스타일 프로필을 저장하지 못했습니다.'
              : 'Unable to save the daily styling profile.',
      },
      500,
    )
  }
}
