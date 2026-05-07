import {
  deriveBillingAccessFromCustomerState,
  fetchPolarCustomerStateForIdentity,
  type PolarEnv,
} from './_polarBilling'
import { getSupabaseAdminClient, type SupabaseAdminEnv } from './_supabaseAdmin'
import type { SupabaseAuthEnv } from './_supabaseAuth'

export interface DailyStylistEnv extends SupabaseAdminEnv, PolarEnv, SupabaseAuthEnv {
  GEMINI_API_KEY?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  RESEND_REPLY_TO?: string
  PROFILE_PHOTOS?: R2Bucket
}

export type DailyStyleProfileRecord = {
  user_id: string
  email: string
  height_cm: number
  weight_kg: number
  location_query: string
  location_name: string
  country_code: string | null
  timezone: string
  latitude: number
  longitude: number
  photo_object_key: string | null
  photo_content_type: string | null
  daily_email_enabled: boolean
  preferred_locale: string
  next_delivery_at_utc: string | null
  last_daily_sent_local_date: string | null
  last_daily_sent_at: string | null
  created_at: string
  updated_at: string
}

export type DeliveryRunSummary = {
  processed: number
  sent: number
  skipped: number
  failed: number
}

export type ResolvedLocation = {
  locationQuery: string
  locationName: string
  countryCode: string
  latitude: number
  longitude: number
  timezone: string
}

export type DailyWeatherSnapshot = {
  forecastDate: string
  summary: string
  weatherCode: number
  highCelsius: number | null
  lowCelsius: number | null
  precipitationProbability: number | null
  timezone: string
}

type OpenMeteoSearchResponse = {
  results?: Array<{
    name?: string
    admin1?: string
    country?: string
    country_code?: string
    latitude?: number
    longitude?: number
    timezone?: string
  }>
}

type OpenMeteoForecastResponse = {
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: number[]
  }
}

type GeminiPart = {
  text?: string
  inlineData?: {
    data?: string
    mimeType?: string
  }
  inline_data?: {
    data?: string
    mime_type?: string
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[]
    }
    finishReason?: string
  }>
  error?: {
    message?: string
  }
}

type InlineImageAsset = {
  imageBase64: string
  mimeType: string
}

const DEFAULT_FROM_EMAIL = 'Personal AI Stylist <noreply@personalstylist.site>'
const GEMINI_TEXT_MODEL = 'gemini-3-flash-preview'
const GEMINI_IMAGE_MODELS = ['gemini-3-pro-image-preview']
const DELIVERY_HOUR = 6
const DELIVERY_WINDOW_MINUTES = 15

const isKoreanLocale = (value?: string) =>
  value?.toLowerCase().startsWith('ko') ?? false

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const renderInlineStrong = (value: string) =>
  escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

const renderRichTextHtml = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      if (!line) {
        return '<div style="height:8px"></div>'
      }

      if (line.startsWith('### ')) {
        return '<h3 style="margin:0 0 8px;color:#201720;font-size:18px;line-height:1.45">' + renderInlineStrong(line.slice(4)) + '</h3>'
      }

      if (line.startsWith('* ') || line.startsWith('- ')) {
        return '<p style="margin:0 0 10px;color:#4a3d4a;line-height:1.7">• ' + renderInlineStrong(line.slice(2)) + '</p>'
      }

      return '<p style="margin:0 0 10px;color:#4a3d4a;line-height:1.7">' + renderInlineStrong(line) + '</p>'
    })
    .join('')

const stripFormatting = (value: string) =>
  value
    .replaceAll('### ', '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')

const parseNumber = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeBoolean = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string') {
    return false
  }

  return value === 'true' || value === '1' || value === 'on'
}

const isValidTimeZone = (value: string) => {
  if (!value.trim()) {
    return false
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

const toBase64 = (buffer: ArrayBuffer) => {
  let binary = ''

  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

const hashString = async (value: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const getFileExtension = (mimeType: string, fileName?: string) => {
  const lowerMime = mimeType.toLowerCase()

  if (lowerMime.includes('png')) {
    return 'png'
  }

  if (lowerMime.includes('jpeg') || lowerMime.includes('jpg')) {
    return 'jpg'
  }

  if (lowerMime.includes('webp')) {
    return 'webp'
  }

  const extensionMatch = fileName?.match(/\.([a-z0-9]+)$/i)
  return extensionMatch?.[1]?.toLowerCase() || 'bin'
}

const weatherCodeDescription = (code: number, preferredLocale?: string) => {
  const ko = isKoreanLocale(preferredLocale)

  switch (code) {
    case 0:
      return ko ? '맑음' : 'Clear sky'
    case 1:
    case 2:
      return ko ? '대체로 맑음' : 'Mostly clear'
    case 3:
      return ko ? '흐림' : 'Overcast'
    case 45:
    case 48:
      return ko ? '안개' : 'Fog'
    case 51:
    case 53:
    case 55:
      return ko ? '이슬비' : 'Drizzle'
    case 61:
    case 63:
    case 65:
      return ko ? '비' : 'Rain'
    case 66:
    case 67:
      return ko ? '어는 비' : 'Freezing rain'
    case 71:
    case 73:
    case 75:
      return ko ? '눈' : 'Snow'
    case 80:
    case 81:
    case 82:
      return ko ? '소나기' : 'Rain showers'
    case 85:
    case 86:
      return ko ? '눈 소나기' : 'Snow showers'
    case 95:
      return ko ? '뇌우' : 'Thunderstorm'
    case 96:
    case 99:
      return ko ? '우박 동반 뇌우' : 'Thunderstorm with hail'
    default:
      return ko ? '변동 가능성 있는 날씨' : 'Changeable conditions'
  }
}

const getLocalizedStrings = (preferredLocale?: string) =>
  isKoreanLocale(preferredLocale)
    ? {
        subjectPrefix: '오늘의 날씨 기반 스타일 브리프',
        heading: '오늘 아침 스타일 브리프가 도착했습니다',
        intro: '저장된 체형 정보, 기준 사진, 오늘 날씨를 바탕으로 아침 스타일 추천을 정리했습니다.',
        weatherHeading: '오늘 날씨 요약',
        photoHeading: '오늘 추천 룩 미리보기',
        briefHeading: '오늘의 스타일 추천',
        footer: '이 메일은 활성화된 무료 체험 또는 구독 계정에만 발송됩니다.',
      }
    : {
        subjectPrefix: 'Today\'s weather-based style brief',
        heading: 'Your morning style brief is ready',
        intro: 'This recommendation was prepared from your saved body details, reference photo, and today\'s weather.',
        weatherHeading: 'Today\'s weather',
        photoHeading: 'Today\'s generated look preview',
        briefHeading: 'Today\'s styling recommendation',
        footer: 'This email is only delivered to accounts with an active trial or subscription.',
      }

const buildDailyEmailHtml = ({
  preferredLocale,
  locationName,
  weatherSummary,
  brief,
  styledLookCid,
}: {
  preferredLocale?: string
  locationName: string
  weatherSummary: string
  brief: string
  styledLookCid?: string
}) => {
  const strings = getLocalizedStrings(preferredLocale)

  return '<div style="margin:0;padding:24px;background:#f7f1ed;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#201720">' +
    '<div style="max-width:680px;margin:0 auto;background:#fffaf8;border:1px solid #ead9d5;border-radius:24px;padding:28px">' +
    '<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.14em;color:#ff115f">PERSONAL AI STYLIST</p>' +
    '<h1 style="margin:0 0 10px;font-size:28px;line-height:1.1;color:#201720">' + escapeHtml(strings.heading) + '</h1>' +
    '<p style="margin:0 0 18px;color:#5f4f5f;line-height:1.7">' + escapeHtml(strings.intro) + '</p>' +
    '<div style="border-radius:18px;background:#fff;border:1px solid #ead9d5;padding:18px;margin-bottom:16px">' +
    '<h2 style="margin:0 0 12px;font-size:17px;color:#201720">' + escapeHtml(strings.weatherHeading) + '</h2>' +
    '<p style="margin:0;color:#4a3d4a;line-height:1.7"><strong>' + escapeHtml(locationName) + '</strong><br />' + escapeHtml(weatherSummary) + '</p>' +
    '</div>' +
    (styledLookCid
      ? '<div style="border-radius:18px;background:#fff;border:1px solid #ead9d5;padding:18px;margin-bottom:16px">' +
        '<h2 style="margin:0 0 12px;font-size:17px;color:#201720">' + escapeHtml(strings.photoHeading) + '</h2>' +
        '<img src="cid:' + escapeHtml(styledLookCid) + '" alt="" style="display:block;width:100%;border-radius:18px;border:1px solid #ead9d5;max-height:420px;object-fit:cover" />' +
        '</div>'
      : '') +
    '<div style="border-radius:18px;background:#fff;border:1px solid #ead9d5;padding:18px;margin-bottom:16px">' +
    '<h2 style="margin:0 0 12px;font-size:17px;color:#201720">' + escapeHtml(strings.briefHeading) + '</h2>' +
    renderRichTextHtml(brief) +
    '</div>' +
    '<p style="margin:0;color:#8a7485;line-height:1.6;font-size:13px">' + escapeHtml(strings.footer) + '</p>' +
    '</div>' +
    '</div>'
}

const buildDailyEmailText = ({
  preferredLocale,
  locationName,
  weatherSummary,
  brief,
}: {
  preferredLocale?: string
  locationName: string
  weatherSummary: string
  brief: string
}) => {
  const strings = getLocalizedStrings(preferredLocale)

  return [
    strings.heading,
    '',
    strings.intro,
    '',
    '[' + strings.weatherHeading + ']',
    locationName,
    weatherSummary,
    '',
    '[' + strings.briefHeading + ']',
    stripFormatting(brief),
    '',
    strings.footer,
  ].join('\n')
}

const getZonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  const localYear = Number(parts.year)
  const localMonth = Number(parts.month)
  const localDay = Number(parts.day)

  return {
    localYear,
    localMonth,
    localDay,
    localDate:
      String(localYear).padStart(4, '0') +
      '-' +
      String(localMonth).padStart(2, '0') +
      '-' +
      String(localDay).padStart(2, '0'),
    localHour: Number(parts.hour),
    localMinute: Number(parts.minute),
  }
}

const addDaysToLocalDate = ({
  year,
  month,
  day,
  days,
}: {
  year: number
  month: number
  day: number
  days: number
}) => {
  const shifted = new Date(Date.UTC(year, month - 1, day + days))

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

const getUtcDateForZonedLocalTime = ({
  timeZone,
  year,
  month,
  day,
  hour,
  minute,
}: {
  timeZone: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}) => {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute))

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = getZonedParts(guess, timeZone)
    const deltaMinutes =
      (Date.UTC(year, month - 1, day, hour, minute) -
        Date.UTC(
          zoned.localYear,
          zoned.localMonth - 1,
          zoned.localDay,
          zoned.localHour,
          zoned.localMinute,
        )) /
      60_000

    if (deltaMinutes === 0) {
      return guess
    }

    guess = new Date(guess.getTime() + deltaMinutes * 60_000)
  }

  return guess
}

const computeNextDeliveryAtUtc = ({
  timeZone,
  now = new Date(),
}: {
  timeZone: string
  now?: Date
}) => {
  const zoned = getZonedParts(now, timeZone)
  const shouldScheduleTomorrow =
    zoned.localHour > DELIVERY_HOUR ||
    (zoned.localHour === DELIVERY_HOUR &&
      zoned.localMinute >= DELIVERY_WINDOW_MINUTES)
  const targetDate = shouldScheduleTomorrow
    ? addDaysToLocalDate({
        year: zoned.localYear,
        month: zoned.localMonth,
        day: zoned.localDay,
        days: 1,
      })
    : {
        year: zoned.localYear,
        month: zoned.localMonth,
        day: zoned.localDay,
      }

  return getUtcDateForZonedLocalTime({
    timeZone,
    year: targetDate.year,
    month: targetDate.month,
    day: targetDate.day,
    hour: DELIVERY_HOUR,
    minute: 0,
  }).toISOString()
}

const computeFollowingDeliveryAtUtc = ({
  timeZone,
  localDate,
}: {
  timeZone: string
  localDate: string
}) => {
  const [year, month, day] = localDate
    .split('-')
    .map((value) => Number(value))
  const targetDate = addDaysToLocalDate({
    year,
    month,
    day,
    days: 1,
  })

  return getUtcDateForZonedLocalTime({
    timeZone,
    year: targetDate.year,
    month: targetDate.month,
    day: targetDate.day,
    hour: DELIVERY_HOUR,
    minute: 0,
  }).toISOString()
}

const buildWeatherSummary = ({
  preferredLocale,
  locationName,
  weatherCode,
  highCelsius,
  lowCelsius,
  precipitationProbability,
}: {
  preferredLocale?: string
  locationName: string
  weatherCode: number
  highCelsius: number | null
  lowCelsius: number | null
  precipitationProbability: number | null
}) => {
  const label = weatherCodeDescription(weatherCode, preferredLocale)

  if (isKoreanLocale(preferredLocale)) {
    return [
      locationName + ' 기준 ' + label,
      highCelsius !== null && lowCelsius !== null
        ? '최고 ' + Math.round(highCelsius) + '°C / 최저 ' + Math.round(lowCelsius) + '°C'
        : '',
      precipitationProbability !== null
        ? '강수 확률 최대 ' + Math.round(precipitationProbability) + '%'
        : '',
    ].filter(Boolean).join(', ')
  }

  return [
    locationName + ': ' + label,
    highCelsius !== null && lowCelsius !== null
      ? 'high ' + Math.round(highCelsius) + '°C / low ' + Math.round(lowCelsius) + '°C'
      : '',
    precipitationProbability !== null
      ? 'up to ' + Math.round(precipitationProbability) + '% chance of precipitation'
      : '',
  ].filter(Boolean).join(', ')
}

const buildDailyBriefPrompt = ({
  profile,
  weather,
  localDate,
}: {
  profile: DailyStyleProfileRecord
  weather: DailyWeatherSnapshot
  localDate: string
}) => [
  'You are Personal AI Stylist, a professional image consultant preparing one concise daily outfit brief.',
  "Use the user's saved reference photo, body metrics, saved location, and today's weather to recommend one practical look for today.",
  'If the locale starts with ko, write in Korean. Otherwise, write in English.',
  'Use markdown headings beginning with ### and bullet lines beginning with *.',
  'Keep the tone professional, decisive, and compact.',
  'Use this decision order: weather practicality -> color direction near the face -> proportion and silhouette -> style essence consistency.',
  'Only use the provided weather facts. Base style inference on the saved reference photo and body metrics without claiming certainty where evidence is limited.',
  'Keep the section order exactly as follows, but localize the section titles into the user language:',
  "### Today's Style Thesis",
  '### Weather and Fabric Strategy',
  '### Proportion Formula',
  '### Color and V-Zone Note',
  '### Shoes and Accessories',
  '### Avoid Today',
  '### Why This Works Today',
  'Local delivery date: ' + localDate,
  'Preferred locale: ' + profile.preferred_locale,
  'Saved location: ' + profile.location_name,
  'Height: ' + profile.height_cm + ' cm',
  'Weight: ' + profile.weight_kg + ' kg',
  'Daily weather summary: ' + weather.summary,
  'Weather code meaning: ' + weatherCodeDescription(weather.weatherCode, profile.preferred_locale),
].join('\n');

const buildDailyLookPrompt = ({
  profile,
  weather,
  brief,
}: {
  profile: DailyStyleProfileRecord
  weather: DailyWeatherSnapshot
  brief: string
}) => [
  'You are Personal AI Stylist, creating one photorealistic daily outfit visualization for the exact same person in the reference photo.',
  'Keep the exact same face, identity, skin tone, body proportions, and overall facial features.',
  'Do not change the person. Change only the clothing, accessories, styling details, and pose if needed.',
  'Translate the daily brief below into one realistic, weather-appropriate outfit that respects the recommended color direction, neckline or V-zone logic, proportion formula, and style essence.',
  'Create a polished full-body or 3/4 portrait with realistic fabric behavior, practical layering, and believable accessories for the stated weather.',
  'The result should feel wearable today in the saved location, not like a fantasy editorial costume.',
  'Avoid collage layouts, text overlays, split screens, duplicate figures, or beauty edits that alter identity.',
  'Preferred locale: ' + profile.preferred_locale,
  'Saved location: ' + profile.location_name,
  'Body reference: ' + profile.height_cm + ' cm, ' + profile.weight_kg + ' kg.',
  "Today's weather: " + weather.summary,
  'Follow this daily styling brief closely:',
  brief,
].join('\n\n')

const isRecoverableGeminiBriefError = (message?: string) => {
  const value = message?.toLowerCase() ?? ''

  return (
    value.includes('spending cap') ||
    value.includes('billing') ||
    value.includes('quota') ||
    value.includes('resource exhausted') ||
    value.includes('user location is not supported') ||
    value.includes('429')
  )
}

const buildFallbackDailyBrief = ({
  profile,
  weather,
}: {
  profile: DailyStyleProfileRecord
  weather: DailyWeatherSnapshot
}) => {
  const ko = isKoreanLocale(profile.preferred_locale)
  const high = weather.highCelsius
  const low = weather.lowCelsius
  const rainChance = weather.precipitationProbability ?? 0
  const warm = high !== null && high >= 24
  const cold = low !== null && low <= 8
  const rainy = rainChance >= 40 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weather.weatherCode)

  if (ko) {
    return [
      "### Today's Style Thesis",
      '* 오늘 추천은 날씨 대응력과 비율 정리를 동시에 잡는 실용적 스타일에 초점을 둡니다.',
      '* ' + weather.summary,
      '',
      '### Weather and Fabric Strategy',
      warm
        ? '* 통기성이 좋은 상의와 가벼운 하의를 중심으로 열감이 갇히지 않게 구성하세요.'
        : cold
          ? '* 아침과 저녁의 냉기를 고려해 얇은 니트나 가벼운 아우터를 추가하는 편이 좋습니다.'
          : '* 실내외 온도차를 고려해 쉽게 벗고 입을 수 있는 얇은 레이어를 유지하세요.',
      rainy
        ? '* 생활 방수 가능한 겉옷이나 젖어도 부담이 적은 소재를 우선하세요.'
        : '* 매트하고 구조가 조금 살아 있는 소재가 전체 실루엣을 더 정돈되게 보이게 합니다.',
      '',
      '### Proportion Formula',
      '* 허리선이 보이거나 상하의 명도 차가 과하지 않은 조합이 오늘 비율을 가장 안정적으로 보이게 합니다.',
      rainy
        ? '* 바닥에 끌리는 긴 기장보다 활동성 있는 길이와 정돈된 하의 라인이 유리합니다.'
        : '* 중간 길이 상의보다 재킷, 셔츠, 니트의 끝선이 명확한 구성이 실루엣을 더 깔끔하게 만듭니다.',
      '',
      '### Color and V-Zone Note',
      '* 얼굴 주변은 과한 패턴보다 안정적인 베이스 컬러 한두 가지로 정리하고, 네크라인은 답답하지 않게 여백을 확보하세요.',
      '* 액세서리는 한 가지 포인트만 두고 시선을 분산시키는 요소는 줄이는 편이 좋습니다.',
      '',
      '### Shoes and Accessories',
      '* 신발은 오래 걸어도 무리가 없고 오늘 노면 상태에 맞는 소재를 우선하세요.',
      '* 가방과 벨트는 선이 단정한 디자인을 고르면 전체 착장이 더 정리되어 보입니다.',
      '',
      '### Avoid Today',
      rainy
        ? '* 비와 습기에 약한 무거운 소재, 젖으면 형태가 무너지는 바지 밑단, 관리가 까다로운 스웨이드는 피하세요.'
        : '* 체형 비율을 애매하게 끊는 중간 길이 상의와 과도한 오버핏 중첩은 피하세요.',
      '',
      '### Why This Works Today',
      '* 현재는 AI 생성 한도 이슈로 예비 브리프를 사용했지만, 오늘 날씨와 저장된 체형 정보 기준으로 준비 시간이 짧고 실패 확률이 낮은 조합을 우선했습니다.',
    ].join('\n')
  }

  return [
    "### Today's Style Thesis",
    "* Today's recommendation prioritizes practical weather response while keeping the body line clean and intentional.",
    '* ' + weather.summary,
    '',
    '### Weather and Fabric Strategy',
    warm
      ? '* Keep the base outfit breathable and light so the look stays polished without trapping heat.'
      : cold
        ? '* Add a knit or light outer layer so the outfit stays balanced during the cooler parts of the day.'
        : '* Use an easy light layer that can move between indoor and outdoor temperatures without bulk.',
    rainy
      ? '* Favor practical outer layers or materials that can handle damp conditions without looking sloppy.'
      : '* Slightly structured matte fabrics will usually keep the silhouette cleaner than soft bulky texture.',
    '',
    '### Proportion Formula',
    '* A visible waist point or a smaller value break between top and bottom will usually read as the most balanced proportion today.',
    rainy
      ? '* Choose active lengths and a controlled lower silhouette instead of hems that drag or collapse in wet conditions.'
      : '* Clear hem endings on jackets, shirts, or knitwear usually look sharper than tops that stop at an awkward middle point.',
    '',
    '### Color and V-Zone Note',
    '* Keep the face zone clean with one or two stable base colors instead of busy pattern or loud contrast.',
    '* Let one accessory do the work and keep the neckline visually open enough to avoid a heavy upper frame.',
    '',
    '### Shoes and Accessories',
    '* Choose shoes that stay comfortable through the day and suit the ground conditions.',
    '* A bag or belt with a clean line will help the total outfit feel more resolved.',
    '',
    '### Avoid Today',
    rainy
      ? '* Avoid heavy fabrics, delicate suede, or long hems that become awkward in wet conditions.'
      : '* Avoid mid-length tops that cut the proportions unclearly and oversized layering that makes the shape look heavy.',
    '',
    '### Why This Works Today',
    '* The AI generation limit was hit, so this fallback brief favors low-risk combinations that still align weather practicality with proportion-friendly styling.',
  ].join('\n')
};

const extractText = (parts: GeminiPart[] = []) =>
  parts
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')

const extractImage = (parts: GeminiPart[] = []) => {
  const imagePart = parts.find((part) => {
    const inlineData = part.inlineData ?? part.inline_data
    return Boolean(inlineData?.data)
  })

  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data

  if (!inlineData?.data || !(inlineData?.mimeType ?? inlineData?.mime_type)) {
    return null
  }

  return {
    imageBase64: inlineData.data,
    mimeType: inlineData.mimeType ?? inlineData.mime_type ?? 'image/png',
  }
}

const callGemini = async ({
  env,
  model,
  parts,
  maxOutputTokens,
  temperature,
}: {
  env: DailyStylistEnv
  model: string
  parts: Array<Record<string, unknown>>
  maxOutputTokens: number
  temperature: number
}) => {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY ?? '',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature,
          topK: 32,
          topP: 0.95,
          maxOutputTokens,
        },
      }),
    },
  )

  const rawText = await response.text()
  const json = rawText.trim() ? (JSON.parse(rawText) as GeminiResponse) : null

  return {
    response,
    json,
  }
}

const callGeminiText = async ({
  env,
  prompt,
  imageBase64,
  mimeType,
  preferredLocale,
}: {
  env: DailyStylistEnv
  prompt: string
  imageBase64?: string
  mimeType?: string
  preferredLocale?: string
}) => {
  const { response, json } = await callGemini({
    env,
    model: GEMINI_TEXT_MODEL,
    parts: [
      { text: prompt },
      ...(imageBase64 && mimeType
        ? [{ inline_data: { mime_type: mimeType, data: imageBase64 } }]
        : []),
    ],
    maxOutputTokens: 1400,
    temperature: 0.72,
  })

  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
        (isKoreanLocale(preferredLocale)
          ? '일일 스타일 추천을 생성하지 못했습니다.'
          : 'Unable to generate the daily style recommendation.'),
    )
  }

  const text = extractText(json?.candidates?.[0]?.content?.parts ?? [])

  if (!text) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '일일 스타일 추천 내용이 비어 있습니다.'
        : 'The daily style recommendation was empty.',
    )
  }

  return text
}

const generateDailyStyledImage = async ({
  env,
  profile,
  weather,
  brief,
  referencePhoto,
}: {
  env: DailyStylistEnv
  profile: DailyStyleProfileRecord
  weather: DailyWeatherSnapshot
  brief: string
  referencePhoto: InlineImageAsset
}) => {
  const prompt = buildDailyLookPrompt({
    profile,
    weather,
    brief,
  })

  for (const model of GEMINI_IMAGE_MODELS) {
    const { response, json } = await callGemini({
      env,
      model,
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: referencePhoto.mimeType,
            data: referencePhoto.imageBase64,
          },
        },
      ],
      maxOutputTokens: 8192,
      temperature: 0.9,
    })

    if (!response.ok) {
      continue
    }

    const generatedImage = extractImage(json?.candidates?.[0]?.content?.parts ?? [])

    if (generatedImage?.imageBase64 && generatedImage.mimeType) {
      return generatedImage
    }
  }

  return null
}

export const resolveLocationQuery = async ({
  query,
  preferredLocale,
}: {
  query: string
  preferredLocale?: string
}): Promise<ResolvedLocation> => {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '위치 검색어를 입력해 주세요.'
        : 'Please enter a location query.',
    )
  }

  const response = await fetch(
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(trimmedQuery) +
      '&count=1&language=' +
      encodeURIComponent(isKoreanLocale(preferredLocale) ? 'ko' : 'en') +
      '&format=json',
  )
  const rawText = await response.text()
  const json = rawText.trim() ? (JSON.parse(rawText) as OpenMeteoSearchResponse) : null
  const result = json?.results?.[0]

  if (!response.ok || !result?.timezone || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '입력한 위치를 찾지 못했습니다. 도시와 국가를 더 구체적으로 입력해 주세요.'
        : 'Unable to resolve that location. Please enter a more specific city and country.',
    )
  }

  const locationName = [result.name, result.admin1, result.country]
    .filter(Boolean)
    .join(', ')

  return {
    locationQuery: trimmedQuery,
    locationName: locationName || trimmedQuery,
    countryCode: result.country_code || '',
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  }
}

export const fetchDailyWeatherSnapshot = async ({
  latitude,
  longitude,
  timezone,
  locationName,
  preferredLocale,
}: {
  latitude: number
  longitude: number
  timezone: string
  locationName: string
  preferredLocale?: string
}): Promise<DailyWeatherSnapshot> => {
  const response = await fetch(
    'https://api.open-meteo.com/v1/forecast?latitude=' +
      encodeURIComponent(String(latitude)) +
      '&longitude=' +
      encodeURIComponent(String(longitude)) +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&forecast_days=1&timezone=' +
      encodeURIComponent(timezone),
  )
  const rawText = await response.text()
  const json = rawText.trim() ? (JSON.parse(rawText) as OpenMeteoForecastResponse) : null
  const daily = json?.daily

  if (!response.ok || !daily?.time?.[0]) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '오늘 날씨 정보를 불러오지 못했습니다.'
        : 'Unable to load today\'s weather forecast.',
    )
  }

  const weatherCode = daily.weather_code?.[0] ?? 0
  const highCelsius = typeof daily.temperature_2m_max?.[0] === 'number' ? daily.temperature_2m_max[0] : null
  const lowCelsius = typeof daily.temperature_2m_min?.[0] === 'number' ? daily.temperature_2m_min[0] : null
  const precipitationProbability = typeof daily.precipitation_probability_max?.[0] === 'number'
    ? daily.precipitation_probability_max[0]
    : null

  return {
    forecastDate: daily.time[0],
    summary: buildWeatherSummary({
      preferredLocale,
      locationName,
      weatherCode,
      highCelsius,
      lowCelsius,
      precipitationProbability,
    }),
    weatherCode,
    highCelsius,
    lowCelsius,
    precipitationProbability,
    timezone,
  }
}

export const fetchCustomerStyleProfile = async ({
  env,
  userId,
}: {
  env: DailyStylistEnv
  userId: string
}) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error('Supabase admin is not configured.')
  }

  const { data, error } = await admin
    .from('customer_style_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as DailyStyleProfileRecord | null) ?? null
}

export const uploadProfilePhotoToR2 = async ({
  env,
  userId,
  file,
  existingObjectKey,
}: {
  env: DailyStylistEnv
  userId: string
  file: File
  existingObjectKey?: string | null
}) => {
  if (!env.PROFILE_PHOTOS) {
    throw new Error('PROFILE_PHOTOS R2 binding is not configured.')
  }

  const mimeType = file.type || 'application/octet-stream'
  const objectKey = 'daily-style-profiles/' + userId + '/' + Date.now() + '-' + crypto.randomUUID() + '.' + getFileExtension(mimeType, file.name)

  await env.PROFILE_PHOTOS.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'private, max-age=0, no-store',
    },
    customMetadata: {
      userId,
      originalName: file.name || 'profile-photo',
    },
  })

  if (existingObjectKey && existingObjectKey !== objectKey) {
    await env.PROFILE_PHOTOS.delete(existingObjectKey).catch(() => undefined)
  }

  return {
    objectKey,
    mimeType,
  }
}

export const deleteProfilePhotoFromR2 = async ({
  env,
  objectKey,
}: {
  env: DailyStylistEnv
  objectKey?: string | null
}) => {
  if (!env.PROFILE_PHOTOS || !objectKey) {
    return
  }

  await env.PROFILE_PHOTOS.delete(objectKey)
}

export const readProfilePhotoResponse = async ({
  env,
  objectKey,
}: {
  env: DailyStylistEnv
  objectKey: string
}) => {
  const object = await env.PROFILE_PHOTOS?.get(objectKey)

  if (!object) {
    return null
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

const readProfilePhotoInlineData = async ({
  env,
  objectKey,
}: {
  env: DailyStylistEnv
  objectKey: string
}) => {
  const object = await env.PROFILE_PHOTOS?.get(objectKey)

  if (!object) {
    return null
  }

  const buffer = await object.arrayBuffer()

  return {
    imageBase64: toBase64(buffer),
    mimeType: object.httpMetadata?.contentType || 'image/jpeg',
  }
}

const loadStoredProfilePhoto = async ({
  env,
  profile,
}: {
  env: DailyStylistEnv
  profile: DailyStyleProfileRecord
}) => {
  if (!profile.photo_object_key) {
    throw new Error('A stored profile photo is required to generate the daily brief.')
  }

  const photo = await readProfilePhotoInlineData({
    env,
    objectKey: profile.photo_object_key,
  })

  if (!photo?.imageBase64 || !photo.mimeType) {
    throw new Error('The stored profile photo could not be loaded from R2.')
  }

  return photo
}

export const saveCustomerStyleProfile = async ({
  env,
  userId,
  email,
  formData,
  preferredLocale,
}: {
  env: DailyStylistEnv
  userId: string
  email: string
  formData: FormData
  preferredLocale?: string
}) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? 'Supabase 관리 설정이 서버에 없습니다.'
        : 'Supabase admin is not configured on the server.',
    )
  }

  const currentProfile = await fetchCustomerStyleProfile({ env, userId })
  const heightCm = parseNumber(formData.get('heightCm'))
  const weightKg = parseNumber(formData.get('weightKg'))
  const locationQuery = String(formData.get('locationQuery') ?? '').trim()
  const directLocationName = String(formData.get('locationName') ?? '').trim()
  const directCountryCode = String(formData.get('countryCode') ?? '').trim()
  const directTimezone = String(formData.get('timezone') ?? '').trim()
  const directLatitude = parseNumber(formData.get('latitude'))
  const directLongitude = parseNumber(formData.get('longitude'))
  const dailyEmailEnabled = normalizeBoolean(formData.get('dailyEmailEnabled'))
  const localeValue = String(formData.get('preferredLocale') ?? preferredLocale ?? 'en-US').trim() || 'en-US'
  const uploadedPhoto = formData.get('photo')

  if (!heightCm || heightCm < 50 || heightCm > 280) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '키는 50cm에서 280cm 사이로 입력해 주세요.'
        : 'Height must be between 50 cm and 280 cm.',
    )
  }

  if (!weightKg || weightKg < 20 || weightKg > 500) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '몸무게는 20kg에서 500kg 사이로 입력해 주세요.'
        : 'Weight must be between 20 kg and 500 kg.',
    )
  }

  const hasDirectLocation =
    typeof directLatitude === 'number' &&
    typeof directLongitude === 'number' &&
    directLatitude >= -90 &&
    directLatitude <= 90 &&
    directLongitude >= -180 &&
    directLongitude <= 180 &&
    isValidTimeZone(directTimezone)

  const resolvedLocation = hasDirectLocation
    ? {
        locationQuery:
          locationQuery ||
          directLocationName ||
          (isKoreanLocale(preferredLocale) ? '현재 위치' : 'Current location'),
        locationName:
          directLocationName ||
          locationQuery ||
          (isKoreanLocale(preferredLocale) ? '현재 위치' : 'Current location'),
        countryCode: directCountryCode || currentProfile?.country_code || '',
        latitude: Number(directLatitude.toFixed(6)),
        longitude: Number(directLongitude.toFixed(6)),
        timezone: directTimezone,
      }
    : await resolveLocationQuery({
        query: locationQuery,
        preferredLocale,
      })

  let photoObjectKey = currentProfile?.photo_object_key ?? null
  let photoContentType = currentProfile?.photo_content_type ?? null

  if (uploadedPhoto instanceof File && uploadedPhoto.size > 0) {
    if (!uploadedPhoto.type.startsWith('image/')) {
      throw new Error(
        isKoreanLocale(preferredLocale)
          ? '프로필 사진은 이미지 파일이어야 합니다.'
          : 'The profile photo must be an image file.',
      )
    }

    const uploaded = await uploadProfilePhotoToR2({
      env,
      userId,
      file: uploadedPhoto,
      existingObjectKey: currentProfile?.photo_object_key,
    })

    photoObjectKey = uploaded.objectKey
    photoContentType = uploaded.mimeType
  }

  if (!photoObjectKey && dailyEmailEnabled) {
    throw new Error(
      isKoreanLocale(preferredLocale)
        ? '매일 스타일 추천을 보내려면 기준 사진을 업로드해 주세요.'
        : 'Please upload a reference photo to enable daily style delivery.',
    )
  }

  const nextDeliveryAtUtc =
    dailyEmailEnabled && photoObjectKey
      ? computeNextDeliveryAtUtc({
          timeZone: resolvedLocation.timezone,
        })
      : null

  const { data, error } = await admin
    .from('customer_style_profiles')
    .upsert({
      user_id: userId,
      email,
      height_cm: Math.round(heightCm),
      weight_kg: Number(weightKg.toFixed(1)),
      location_query: resolvedLocation.locationQuery,
      location_name: resolvedLocation.locationName,
      country_code: resolvedLocation.countryCode || null,
      timezone: resolvedLocation.timezone,
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      photo_object_key: photoObjectKey,
      photo_content_type: photoContentType,
      daily_email_enabled: dailyEmailEnabled,
      preferred_locale: localeValue,
      next_delivery_at_utc: nextDeliveryAtUtc,
    }, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Unable to save the customer style profile.')
  }

  return data as DailyStyleProfileRecord
}

export const getProfileDueCheck = ({
  profile,
  now,
}: {
  profile: DailyStyleProfileRecord
  now: Date
}) => {
  const zoned = getZonedParts(now, profile.timezone)
  const nextDeliveryAt = profile.next_delivery_at_utc
    ? Date.parse(profile.next_delivery_at_utc)
    : Number.NaN

  return {
    ...zoned,
    isDue:
      profile.daily_email_enabled &&
      Boolean(profile.next_delivery_at_utc) &&
      !Number.isNaN(nextDeliveryAt) &&
      nextDeliveryAt <= now.getTime(),
  }
}

const listDueProfiles = async (env: DailyStylistEnv, now: Date) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error('Supabase admin is not configured.')
  }

  const { data, error } = await admin
    .from('customer_style_profiles')
    .select('*')
    .eq('daily_email_enabled', true)
    .not('next_delivery_at_utc', 'is', null)
    .lte('next_delivery_at_utc', now.toISOString())
    .order('next_delivery_at_utc', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DailyStyleProfileRecord[]
}

const insertPendingDeliveryLog = async (env: DailyStylistEnv, profile: DailyStyleProfileRecord, localDate: string) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error('Supabase admin is not configured.')
  }

  const { error } = await admin.from('daily_style_delivery_logs').insert({
    user_id: profile.user_id,
    delivery_date: localDate,
    timezone: profile.timezone,
    email: profile.email,
    status: 'pending',
  })

  if (!error) {
    return true
  }

  if ((error as { code?: string }).code === '23505') {
    return false
  }

  throw new Error(error.message)
}

const updateDeliveryLog = async (
  env: DailyStylistEnv,
  profile: DailyStyleProfileRecord,
  localDate: string,
  updates: Record<string, unknown>,
) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error('Supabase admin is not configured.')
  }

  const { error } = await admin
    .from('daily_style_delivery_logs')
    .update(updates)
    .eq('user_id', profile.user_id)
    .eq('delivery_date', localDate)

  if (error) {
    throw new Error(error.message)
  }
}

const updateProfileDeliveryMeta = async (
  env: DailyStylistEnv,
  profile: DailyStyleProfileRecord,
  localDate: string,
  nowIso: string,
  nextDeliveryAtUtc: string,
) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error('Supabase admin is not configured.')
  }

  const { error } = await admin
    .from('customer_style_profiles')
    .update({
      last_daily_sent_local_date: localDate,
      last_daily_sent_at: nowIso,
      next_delivery_at_utc: nextDeliveryAtUtc,
      email: profile.email,
    })
    .eq('user_id', profile.user_id)

  if (error) {
    throw new Error(error.message)
  }
}

const updateProfileNextDelivery = async (
  env: DailyStylistEnv,
  profile: DailyStyleProfileRecord,
  nextDeliveryAtUtc: string,
) => {
  const admin = getSupabaseAdminClient(env)

  if (!admin) {
    throw new Error('Supabase admin is not configured.')
  }

  const { error } = await admin
    .from('customer_style_profiles')
    .update({
      next_delivery_at_utc: nextDeliveryAtUtc,
      email: profile.email,
    })
    .eq('user_id', profile.user_id)

  if (error) {
    throw new Error(error.message)
  }
}

const checkPolarAccess = async (env: DailyStylistEnv, profile: DailyStyleProfileRecord) => {
  if (!env.POLAR_ACCESS_TOKEN) {
    throw new Error('POLAR_ACCESS_TOKEN is not configured on the server.')
  }

  const customerState = await fetchPolarCustomerStateForIdentity({
    env,
    externalCustomerId: profile.user_id,
    customerEmail: profile.email,
  })

  if (customerState.response.status === 404) {
    return false
  }

  if (!customerState.response.ok) {
    throw new Error('Unable to verify Polar subscription access for daily delivery.')
  }

  const access = deriveBillingAccessFromCustomerState({
    state: customerState.json as never,
    fallbackEmail: profile.email,
  })

  return access.hasAccess
}

const generateDailyBrief = async (
  env: DailyStylistEnv,
  profile: DailyStyleProfileRecord,
  weather: DailyWeatherSnapshot,
  localDate: string,
  referencePhoto: InlineImageAsset,
) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.')
  }

  try {
    return await callGeminiText({
      env,
      prompt: buildDailyBriefPrompt({ profile, weather, localDate }),
      imageBase64: referencePhoto.imageBase64,
      mimeType: referencePhoto.mimeType,
      preferredLocale: profile.preferred_locale,
    })
  } catch (error) {
    if (error instanceof Error && isRecoverableGeminiBriefError(error.message)) {
      return buildFallbackDailyBrief({ profile, weather })
    }

    throw error
  }
}

const sendDailyStyleEmail = async (
  env: DailyStylistEnv,
  profile: DailyStyleProfileRecord,
  weather: DailyWeatherSnapshot,
  brief: string,
  localDate: string,
  styledLook?: InlineImageAsset | null,
) => {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured on the server.')
  }

  if (!styledLook?.imageBase64 || !styledLook.mimeType) {
    throw new Error('The daily styled look could not be generated.')
  }

  const strings = getLocalizedStrings(profile.preferred_locale)
  const subject = strings.subjectPrefix + ' | ' + profile.location_name
  const idempotencyKey = await hashString([
    profile.user_id,
    profile.email.toLowerCase(),
    localDate,
    weather.summary,
    brief,
  ].join('|'))
  const styledLookCid = styledLook ? 'daily-brief-styled-look' : undefined
  const styledLookExtension = styledLook
    ? getFileExtension(styledLook.mimeType)
    : 'jpg'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'daily-style/' + idempotencyKey.slice(0, 48),
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: [profile.email],
      subject,
      html: buildDailyEmailHtml({
        preferredLocale: profile.preferred_locale,
        locationName: profile.location_name,
        weatherSummary: weather.summary,
        brief,
        styledLookCid,
      }),
      text: buildDailyEmailText({
        preferredLocale: profile.preferred_locale,
        locationName: profile.location_name,
        weatherSummary: weather.summary,
        brief,
      }),
      reply_to: env.RESEND_REPLY_TO ? [env.RESEND_REPLY_TO] : undefined,
      attachments: styledLook
        ? [
            {
              content: styledLook.imageBase64,
              filename: 'daily-brief-look-' + localDate + '.' + styledLookExtension,
              contentId: styledLookCid,
            },
          ]
        : undefined,
      tags: [
        { name: 'delivery', value: 'daily_style' },
        { name: 'local_date', value: localDate },
      ],
    }),
  })

  const rawText = await response.text()
  const json = rawText.trim()
    ? (JSON.parse(rawText) as { id?: string; message?: string; error?: string })
    : null

  if (!response.ok || !json?.id) {
    throw new Error(json?.message || json?.error || 'Unable to send the daily style email.')
  }

  return json.id
}

const deliverProfile = async (
  env: DailyStylistEnv,
  profile: DailyStyleProfileRecord,
  now: Date,
) => {
  const due = getProfileDueCheck({ profile, now })

  if (!due.isDue) {
    return 'skipped' as const
  }

  const nextDeliveryAtUtc = computeFollowingDeliveryAtUtc({
    timeZone: profile.timezone,
    localDate: due.localDate,
  })
  const inserted = await insertPendingDeliveryLog(env, profile, due.localDate)

  if (!inserted) {
    return 'skipped' as const
  }

  try {
    const hasAccess = await checkPolarAccess(env, profile)

    if (!hasAccess) {
      await updateDeliveryLog(env, profile, due.localDate, {
        status: 'skipped',
        error_message: 'No active free trial or subscription access was found for this account.',
      })
      await updateProfileNextDelivery(env, profile, nextDeliveryAtUtc)
      return 'skipped' as const
    }

    const weather = await fetchDailyWeatherSnapshot({
      latitude: profile.latitude,
      longitude: profile.longitude,
      timezone: profile.timezone,
      locationName: profile.location_name,
      preferredLocale: profile.preferred_locale,
    })
    const referencePhoto = await loadStoredProfilePhoto({ env, profile })
    const brief = await generateDailyBrief(
      env,
      profile,
      weather,
      due.localDate,
      referencePhoto,
    )
    const styledLook = await generateDailyStyledImage({
      env,
      profile,
      weather,
      brief,
      referencePhoto,
    }).catch(() => null)
    const emailId = await sendDailyStyleEmail(
      env,
      profile,
      weather,
      brief,
      due.localDate,
      styledLook,
    )
    const nowIso = now.toISOString()

    await updateDeliveryLog(env, profile, due.localDate, {
      status: 'sent',
      sent_at: nowIso,
      weather_snapshot: weather,
      generated_brief: brief,
      resend_email_id: emailId,
      error_message: null,
    })
    await updateProfileDeliveryMeta(
      env,
      profile,
      due.localDate,
      nowIso,
      nextDeliveryAtUtc,
    )

    return 'sent' as const
  } catch (error) {
    await updateDeliveryLog(env, profile, due.localDate, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown daily delivery error.',
    }).catch(() => undefined)
    await updateProfileNextDelivery(env, profile, nextDeliveryAtUtc).catch(() => undefined)

    return 'failed' as const
  }
}

export const runDailyStyleScheduler = async ({
  env,
  now = new Date(),
}: {
  env: DailyStylistEnv
  now?: Date
}): Promise<DeliveryRunSummary> => {
  const profiles = await listDueProfiles(env, now)
  const summary: DeliveryRunSummary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  }

  for (const profile of profiles) {
    summary.processed += 1
    summary[await deliverProfile(env, profile, now)] += 1
  }

  return summary
}
