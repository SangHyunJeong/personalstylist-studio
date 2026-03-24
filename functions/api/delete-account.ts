import {
  deleteProfilePhotoFromR2,
  fetchCustomerStyleProfile,
  type DailyStylistEnv,
} from './_dailyStylist'
import type { SupabaseAuthEnv } from './_supabaseAuth'
import { requireAuthenticatedUser } from './_supabaseAuth'
import { getSupabaseAdminClient } from './_supabaseAdmin'

interface Env extends DailyStylistEnv, SupabaseAuthEnv {}

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

const formatAdminError = (
  preferredLocale: string | undefined,
  fallbackKo: string,
  fallbackEn: string,
  detail?: string,
) => {
  const normalizedDetail = detail?.trim()

  if (!normalizedDetail) {
    return isKoreanLocale(preferredLocale) ? fallbackKo : fallbackEn
  }

  return isKoreanLocale(preferredLocale)
    ? fallbackKo + ' 상세: ' + normalizedDetail
    : fallbackEn + ' Details: ' + normalizedDetail
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

  let preferredLocale: string | undefined

  try {
    const body = (await request.json()) as { preferredLocale?: string }
    preferredLocale = body.preferredLocale
  } catch {
    preferredLocale = undefined
  }

  const authenticatedUser = await requireAuthenticatedUser({
    request,
    env,
    preferredLocale,
  })

  if (authenticatedUser instanceof Response) {
    return authenticatedUser
  }

  const adminClient = getSupabaseAdminClient(env)

  if (!adminClient) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '계정 탈퇴 기능이 서버에 구성되지 않았습니다.'
          : 'Account deletion is not configured on the server.',
      },
      500,
    )
  }

  const { data: existingUser, error: lookupError } =
    await adminClient.auth.admin.getUserById(authenticatedUser.id)

  if (lookupError || !existingUser.user) {
    const detail =
      lookupError?.message ||
      'Signed-in user was not found in the configured Supabase project.'
    console.error('Delete account lookup failed', {
      userId: authenticatedUser.id,
      detail,
      status: lookupError?.status,
      code: lookupError?.code,
    })

    return jsonResponse(
      {
        error: formatAdminError(
          preferredLocale,
          '계정 정보를 확인하지 못했습니다.',
          'Unable to verify the account before deletion.',
          detail,
        ),
      },
      500,
    )
  }

  try {
    const profile = await fetchCustomerStyleProfile({
      env,
      userId: authenticatedUser.id,
    })

    if (profile?.photo_object_key) {
      await deleteProfilePhotoFromR2({
        env,
        objectKey: profile.photo_object_key,
      }).catch((error) => {
        console.warn('Profile photo cleanup failed during account deletion', {
          userId: authenticatedUser.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
  } catch (error) {
    console.warn('Profile lookup failed during account deletion cleanup', {
      userId: authenticatedUser.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const { error } = await adminClient.auth.admin.deleteUser(
    authenticatedUser.id,
    true,
  )

  if (error) {
    console.error('Delete account request failed', {
      userId: authenticatedUser.id,
      detail: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    })

    return jsonResponse(
      {
        error: formatAdminError(
          preferredLocale,
          '계정을 탈퇴하지 못했습니다.',
          'Unable to delete the account.',
          error.message,
        ),
      },
      500,
    )
  }

  return Response.json({
    message: isKoreanLocale(preferredLocale)
      ? '계정을 탈퇴했고 이 기기에서 로그아웃했습니다.'
      : 'Your account was deleted and this device was signed out.',
  })
}
