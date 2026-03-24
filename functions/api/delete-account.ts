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

  const { error } = await adminClient.auth.admin.deleteUser(
    authenticatedUser.id,
    true,
  )

  if (error) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '계정을 탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          : 'Unable to delete the account. Please try again shortly.',
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
