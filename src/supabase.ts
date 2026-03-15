import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type PublicSupabaseConfig = {
  url: string
  publishableKey: string
}

type PublicConfigResponse = {
  supabaseUrl?: string
  supabasePublishableKey?: string
}

let supabaseClient: SupabaseClient | null = null
let configPromise: Promise<PublicSupabaseConfig | null> | null = null

const buildTimeSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const buildTimeSupabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const isValidHttpUrl = (value?: string) => {
  if (!value) {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const normalizeConfig = (
  url?: string,
  publishableKey?: string,
): PublicSupabaseConfig | null => {
  const trimmedUrl = url?.trim()
  const trimmedKey = publishableKey?.trim()

  if (!isValidHttpUrl(trimmedUrl) || !trimmedKey) {
    return null
  }

  return {
    url: trimmedUrl as string,
    publishableKey: trimmedKey,
  }
}

const readBuildTimeConfig = () =>
  normalizeConfig(buildTimeSupabaseUrl, buildTimeSupabasePublishableKey)

const readRuntimeConfig = async () => {
  const response = await fetch('/api/public-config')

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as PublicConfigResponse

  return normalizeConfig(data.supabaseUrl, data.supabasePublishableKey)
}

export const loadSupabaseConfig = async () => {
  const buildTimeConfig = readBuildTimeConfig()

  if (buildTimeConfig) {
    return buildTimeConfig
  }

  if (!configPromise) {
    configPromise = readRuntimeConfig().catch(() => null)
  }

  return configPromise
}

export const loadSupabaseClient = async () => {
  if (supabaseClient) {
    return supabaseClient
  }

  const config = await loadSupabaseConfig()

  if (!config) {
    return null
  }

  supabaseClient = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  return supabaseClient
}
