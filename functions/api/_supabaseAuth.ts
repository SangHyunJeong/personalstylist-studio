export type SupabaseAuthEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

export type AuthenticatedSupabaseUser = {
  id: string
  email: string
}

type SupabaseUserResponse = {
  id?: string
  email?: string
}

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

const isKoreanLocale = (preferredLocale?: string) =>
  preferredLocale?.toLowerCase().startsWith('ko') ?? false

export const requireAuthenticatedUser = async ({
  request,
  env,
  preferredLocale,
}: {
  request: Request
  env: SupabaseAuthEnv
  preferredLocale?: string
}): Promise<AuthenticatedSupabaseUser | Response> => {
  const supabaseApiKey =
    env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY

  if (!env.SUPABASE_URL || !supabaseApiKey) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? 'Supabase 인증 설정이 서버에 구성되지 않았습니다.'
          : 'Supabase auth is not configured on the server.',
      },
      500,
    )
  }

  const authorization = request.headers.get('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '먼저 로그인해 주세요.'
          : 'Please sign in first.',
      },
      401,
    )
  }

  const accessToken = authorization.slice('Bearer '.length).trim()

  if (!accessToken) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '로그인 세션이 비어 있습니다. 다시 로그인해 주세요.'
          : 'Your session is empty. Please sign in again.',
      },
      401,
    )
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseApiKey,
    },
  })

  const rawText = await response.text()
  let user: SupabaseUserResponse | null = null

  try {
    user = rawText.trim()
      ? (JSON.parse(rawText) as SupabaseUserResponse)
      : null
  } catch {
    user = null
  }

  if (!response.ok || !user?.id) {
    return jsonResponse(
      {
        error: isKoreanLocale(preferredLocale)
          ? '로그인 세션을 확인하지 못했습니다. 다시 로그인해 주세요.'
          : 'Unable to verify the current session. Please sign in again.',
      },
      401,
    )
  }

  return {
    id: user.id,
    email: user.email ?? '',
  }
}
