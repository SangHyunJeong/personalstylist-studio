import {
  fetchCustomerStyleProfile,
  readProfilePhotoResponse,
  type DailyStylistEnv,
} from './_dailyStylist'
import type { SupabaseAuthEnv } from './_supabaseAuth'
import { requireAuthenticatedUser } from './_supabaseAuth'

interface Env extends DailyStylistEnv, SupabaseAuthEnv {}

interface PagesContext {
  request: Request
  env: Env
}

const jsonResponse = (body: Record<string, string>, status: number) =>
  Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

const getPreferredLocaleFromUrl = (request: Request) =>
  new URL(request.url).searchParams.get('preferred_locale')?.trim() || undefined

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

    if (!profile?.photo_object_key) {
      return jsonResponse(
        {
          error: isKoreanLocale(preferredLocale)
            ? '저장된 프로필 사진이 없습니다.'
            : 'No saved profile photo was found.',
        },
        404,
      )
    }

    const response = await readProfilePhotoResponse({
      env,
      objectKey: profile.photo_object_key,
    })

    if (!response) {
      return jsonResponse(
        {
          error: isKoreanLocale(preferredLocale)
            ? '저장된 프로필 사진을 찾지 못했습니다.'
            : 'The saved profile photo could not be found.',
        },
        404,
      )
    }

    const headers = new Headers(response.headers)
    headers.set('X-Content-Type-Options', 'nosniff')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : isKoreanLocale(preferredLocale)
              ? '프로필 사진을 불러오지 못했습니다.'
              : 'Unable to load the profile photo.',
      },
      500,
    )
  }
}
