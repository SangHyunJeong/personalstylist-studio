import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey)

export const getSupabaseClient = () => {
  if (!hasSupabaseConfig) {
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }

  return supabaseClient
}
