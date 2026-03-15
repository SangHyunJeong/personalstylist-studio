interface Env {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

interface PagesContext {
  env: Env
}

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

export async function onRequestGet(context: PagesContext) {
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL?.trim()
  const supabasePublishableKey =
    env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabasePublishableKey) {
    return jsonResponse(
      {
        error: 'Supabase public config is not configured on the server.',
      },
      500,
    )
  }

  return Response.json({
    supabaseUrl,
    supabasePublishableKey,
  })
}
