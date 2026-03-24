import { createClient } from '@supabase/supabase-js'
import { requireAuthenticatedUser } from './_supabaseAuth'

interface Env {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
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
    ? `${fallbackKo} 상세: ${normalizedDetail}`
    : `${fallbackEn} Details: ${normalizedDetail}`
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

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabaseUrl = env.SUPABASE_URL?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '계정 탈퇴 기능이 서버에 구성되지 않았습니다.'
          : 'Account deletion is not configured on the server.',
      },
      500,
    )
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: existingUser, error: lookupError } =
    await adminClient.auth.admin.getUserById(authenticatedUser.id)

  if (lookupError || !existingUser.user) {
    const detail = lookupError?.message || 'Signed-in user was not found in the configured Supabase project.'
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
