import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { PolicyDocument, PolicyView as LegalView } from './legalContent'
import {
  HOME_ITEM_LIST_ID,
  HOME_ITEM_LIST_NAME,
  SUBSCRIPTION_PROMOTION_ID,
  SUBSCRIPTION_PROMOTION_NAME,
  SUBSCRIPTION_PROMOTION_SLOT,
  buildCheckoutItem,
  buildFeatureItem,
  buildSubscriptionPromotionItem,
  getHomeRecommendationItems,
  trackEvent,
  trackPageView,
} from './analytics'
import './App.css'

type StyleReportResponse = {
  report: string
  imageBase64?: string
  mimeType?: string
  prompt?: string
  note?: string
  error?: string
  refundRequested?: boolean
}

type HairRecommendationResponse = {
  mode: 'image' | 'prompt'
  imageBase64?: string
  mimeType?: string
  description: string
  prompt?: string
  note?: string
  error?: string
  refundRequested?: boolean
}

type CheckoutResponse = {
  url?: string
  error?: string
}

type BillingSubscriptionSnapshot = {
  id?: string
  status?: string
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
  currentPeriodStart?: string | null
  trialEndsAt?: string | null
  endsAt?: string | null
}

type CheckoutStatusResponse = {
  status?: string
  checkoutKind?: 'one_time' | 'subscription'
  productId?: string
  orderId?: string
  customerEmail?: string
  hasAccess?: boolean
  subscriptionStatus?: string
  subscription?: BillingSubscriptionSnapshot | null
  error?: string
}

type BillingAccessResponse = {
  hasAccess?: boolean
  subscriptionStatus?: string
  customerEmail?: string
  subscription?: BillingSubscriptionSnapshot | null
  error?: string
}

type CustomerPortalSessionResponse = {
  url?: string
  customerEmail?: string
  error?: string
}

type CancelSubscriptionResponse = BillingAccessResponse & {
  message?: string
}

type SendReportEmailResponse = {
  id?: string
  message?: string
  error?: string
}

type DeleteAccountResponse = {
  message?: string
  error?: string
}

type CustomerProfileRecord = {
  email: string
  heightCm: number
  weightKg: number
  locationQuery: string
  locationName: string
  countryCode?: string | null
  timezone: string
  latitude?: number | null
  longitude?: number | null
  dailyEmailEnabled: boolean
  preferredLocale: string
  hasPhoto: boolean
  nextDeliveryAtUtc?: string | null
  lastDailySentLocalDate?: string | null
  lastDailySentAt?: string | null
  updatedAt?: string
}

type CustomerProfileResponse = {
  profile?: CustomerProfileRecord | null
  message?: string
  error?: string
}

type StyleGenerationPayload = {
  kind: 'style'
  imageBase64: string
  mimeType: string
  previewUrl: string
  photoName: string
  height: string
  weight: string
}

type HairGenerationPayload = {
  kind: 'hair'
  imageBase64: string
  mimeType: string
  previewUrl: string
  photoName: string
}

type PendingCheckoutPayload = StyleGenerationPayload | HairGenerationPayload
type ProtectedView = Extract<View, 'style' | 'hair'>
type BillingAccessPhase = 'inactive' | 'trialing' | 'active'
type CheckoutKind = 'one_time' | 'subscription'
type CheckoutSource = ProtectedView | 'subscription'

type Theme = 'light' | 'dark'
type Language = 'ko' | 'en'
type AuthMode = 'sign-in' | 'sign-up'
type AccountSection = 'subscription' | 'profile' | 'password' | 'delete'
type StatusTone = 'success' | 'error' | 'fallback'
type View = 'home' | 'style' | 'hair' | 'account' | LegalView
type PolicyDocumentsByLocale = Record<Language, Record<LegalView, PolicyDocument>>

const PURCHASE_VERIFIED_KEY = 'polar_purchase_verified'
const PURCHASE_ORDER_ID_KEY = 'polar_purchase_order_id'
const PURCHASE_EMAIL_KEY = 'polar_purchase_email'
const PENDING_CHECKOUT_KEY = 'polar_pending_checkout_payload'
const PENDING_ENTRY_VIEW_KEY = 'polar_pending_entry_view'
const PENDING_CHECKOUT_SOURCE_KEY = 'polar_pending_checkout_source'
const MAX_UPLOAD_BYTES = 1_200_000
const MAX_UPLOAD_DIMENSION = 1600

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const storedTheme = window.localStorage.getItem('theme')

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const storedLanguage = window.localStorage.getItem('language')

  if (storedLanguage === 'ko' || storedLanguage === 'en') {
    return storedLanguage
  }

  return window.navigator.language.toLowerCase().startsWith('ko')
    ? 'ko'
    : 'en'
}

const getInitialView = (): View => {
  if (typeof window === 'undefined') {
    return 'home'
  }

  const hash = window.location.hash.replace('#', '')

  if (isSupabaseAuthHash(hash)) {
    return 'home'
  }

  if (
    hash === 'style' ||
    hash === 'hair' ||
    hash === 'account' ||
    hash === 'terms' ||
    hash === 'refunds' ||
    hash === 'privacy'
  ) {
    return hash
  }

  if (hash === 'billing') {
    return 'account'
  }

  return 'home'
}

const getInitialPurchaseVerified = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.localStorage.getItem(PURCHASE_VERIFIED_KEY) === 'true' &&
    Boolean(window.localStorage.getItem(PURCHASE_ORDER_ID_KEY)?.trim())
  )
}

const getInitialPurchaseOrderId = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(PURCHASE_ORDER_ID_KEY) ?? ''
}

const getInitialPurchaseEmail = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(PURCHASE_EMAIL_KEY) ?? ''
}

const getInitialBillingAccessPhase = (): BillingAccessPhase => 'inactive'

const getAuthRedirectUrl = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return `${window.location.origin}${window.location.pathname}`
}


const isSupabaseAuthHash = (hash: string) =>
  hash.includes('access_token=') ||
  hash.includes('refresh_token=') ||
  hash.includes('error_description=') ||
  hash.includes('error_code=') ||
  hash.includes('token_type=') ||
  hash.includes('expires_in=')

const normalizeBillingAccessPhase = (
  status?: string,
  hasAccess = false,
): BillingAccessPhase => {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'trialing') {
    return 'trialing'
  }

  if (normalized === 'active') {
    return 'active'
  }

  return hasAccess ? 'active' : 'inactive'
}

const formatAccountTimestamp = (value: string | undefined, locale: string) => {
  if (!value) {
    return ''
  }

  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

const formatCalendarDate = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return ''
  }

  const timestamp = Date.parse(value + 'T12:00:00Z')

  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(timestamp)
}

const formatAuthProvider = (value?: string) => {
  if (!value) {
    return ''
  }

  switch (value) {
    case 'google':
      return 'Google'
    case 'email':
      return 'Email'
    default:
      return value
        .split('_')
        .filter(Boolean)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ')
  }
}

const localeCopy = {
  ko: {
    languageLabel: 'Language',
    korean: '한국어',
    english: 'English',
    authPanelTag: 'ACCOUNT',
    authPanelTitle: '회원가입 또는 로그인',
    authPanelBody:
      '로그인한 계정으로 결제와 결과 생성이 이어집니다.',
    authLoading: '로그인 세션 확인 중...',
    authEmailLabel: '이메일',
    authEmailPlaceholder: 'name@example.com',
    authPasswordLabel: '비밀번호',
    authPasswordPlaceholder: '6자 이상 입력',
    authPasswordConfirmLabel: '비밀번호 확인',
    authPasswordConfirmPlaceholder: '비밀번호를 다시 입력',
    authSignInTab: '로그인',
    authSignUpTab: '회원가입',
    authSignInAction: '이메일로 로그인',
    authSignUpAction: '이메일로 회원가입',
    authGoogleAction: 'Google로 계속하기',
    authGoogleRedirecting: 'Google 로그인으로 이동 중...',
    authDivider: '또는',
    authSubmitting: '처리 중...',
    authSignedInTitle: '로그인 완료',
    authSignedInBody:
      '이 계정으로 결제와 생성 결과가 연결됩니다.',
    authSignedInAs: '현재 계정',
    authSignOutAction: '로그아웃',
    authConfigMissing:
      'Supabase 환경변수가 설정되지 않아 회원가입/로그인을 사용할 수 없습니다.',
    authSessionRequired: '먼저 로그인해 주세요.',
    authEmailRequired: '이메일을 입력해 주세요.',
    authPasswordRequired: '비밀번호를 입력해 주세요.',
    authPasswordsMismatch: '비밀번호 확인이 일치하지 않습니다.',
    authSignInSuccess: '로그인되었습니다.',
    authSignUpSuccess:
      '회원가입 요청이 완료되었습니다. 이메일 확인이 필요한 경우 받은편지함을 확인해 주세요.',
    authCheckoutRequired: '결제를 시작하려면 먼저 로그인해 주세요.',
    purchaseCheckoutError: '단건 결제 체크아웃을 시작하지 못했습니다.',
    noImageSelected: '아직 선택된 이미지가 없습니다.',
    copySuccess: '프롬프트를 클립보드에 복사했습니다.',
    copyFailure: '클립보드 복사에 실패했습니다. 직접 선택해서 복사해 주세요.',
    emailSendTitle: '결제 이메일 자동 전송',
    emailSendDescription:
      '결과 생성이 끝나면 현재 리포트를 Polar 결제 이메일로 자동 전송합니다.',
    emailSendAction: '결제 이메일로 보내기',
    emailSendLoading: '이메일 전송 중...',
    emailSendUnavailable:
      '결제 이메일 정보를 찾을 수 없습니다. 새 결제 후 다시 시도해 주세요.',
    emailSendTarget: '전송 대상',
    reportImageSaveAction: '리포트를 이미지로 저장하기',
    reportImageSaveLoading: '이미지 저장 준비 중...',
    reportImageShareAction: '외부로 공유하기',
    reportImageShareLoading: '공유 준비 중...',
    reportImageSaveSuccess: '리포트 이미지를 저장했습니다.',
    reportImageExportError: '리포트를 이미지로 저장하지 못했습니다.',
    reportImageShareUnsupported:
      '이 브라우저에서는 리포트 이미지 공유를 지원하지 않습니다. 먼저 저장해 주세요.',
    styleReportShareTitle: '체형 스타일 보고서',
    hairReportShareTitle: '헤어스타일 추천 리포트',
    encodeFailure: '이미지 인코딩에 실패했습니다.',
    imageDataMissing: '이미지 데이터를 읽을 수 없습니다.',
    imageReadFailure: '이미지 파일을 읽는 중 오류가 발생했습니다.',
    responseParseFailure: '서버 응답을 해석하지 못했습니다.',
    imageOnlyFailure: '이미지 파일만 업로드할 수 있습니다.',
    stylePhotoRequired: '스타일 분석을 위해 본인 사진을 업로드해 주세요.',
    styleMetricsRequired: '키와 몸무게를 모두 입력해 주세요.',
    styleSubmitError: '스타일 보고서를 생성하지 못했습니다.',
    styleFetchError: '스타일 보고서를 가져오는 중 문제가 발생했습니다.',
    hairPhotoRequired: '헤어스타일 추천을 위해 본인 사진을 업로드해 주세요.',
    hairSubmitError: '헤어스타일 추천 이미지를 생성하지 못했습니다.',
    hairFetchError: '헤어스타일 추천 이미지를 가져오는 중 문제가 발생했습니다.',
    topbarStyle: '체형 스타일 보고서',
    topbarHair: '퍼스널 스타일리스트',
    homeTitleLead: '원하는 스타일 추천을',
    homeTitleAccent: '먼저 선택하세요.',
    homeDescription:
      'AI 소프트웨어가 자동으로 생성하는 디지털 스타일링 결과를, 체형 분석과 헤어 추천 흐름으로 나눠서 받아볼 수 있습니다.',
    complianceTitle: '디지털 전용 AI 스타일링 소프트웨어',
    complianceBody:
      '이 서비스는 사람 상담이나 오프라인 제공 없이, 이미지와 텍스트 같은 디지털 결과만 자동 생성합니다.',
    homeStyleTitle: '체형 스타일 보고서',
    homeStyleDescription:
      '체형과 인상을 바탕으로 실루엣, 코디, 아이템을 자동 정리한 디지털 스타일 보고서를 생성합니다.',
    homeStyleCta: '분석 시작하기',
    homeAccountShortcutSignedOut: '로그인',
    homeAccountShortcutSignedIn: '내 계정',
    homeHairTitle: '헤어스타일링 추천',
    homeHairDescription:
      '얼굴은 그대로 유지한 채, 잘 어울리는 헤어스타일 9가지를 3x3 이미지로 추천합니다.',
    homeHairCta: '헤어 추천 보기',
    styleUploadTitle: '전신 사진 업로드',
    styleUploadHelper: '드래그 앤 드롭하거나 클릭해서 사진을 선택하세요',
    styleUploadSelect: '이미지 선택',
    styleHeight: '키 (cm)',
    styleWeight: '몸무게 (kg)',
    styleHeightPlaceholder: '예: 175',
    styleWeightPlaceholder: '예: 70',
    styleAction: '분석 생성하기',
    styleActionLoading: '스타일 보고서 생성 중...',
    stylePayAction: '단건 결제하고 분석하기',
    stylePayActionLoading: '단건 결제 체크아웃 준비 중...',
    stylePanelTag: 'AI 스타일 보고서',
    stylePanelTitle: 'AI 자동 스타일 보고서',
    styleEmpty:
      '사진과 체형 정보를 입력하면 스타일 보고서와 착장 방향이 여기에 표시됩니다.',
    styleVisualTitle: '추천 착장 이미지',
    stylePromptTitle: 'AI 프롬프트 유틸리티',
    stylePromptDescription:
      'ChatGPT, Gemini, Stitch 같은 생성형 AI에서 추가 룩 이미지를 만들 수 있도록 프롬프트를 복사합니다.',
    styleAdoptPhotoTitle: '이 사진을 아침 브리프 기준 사진으로 저장',
    styleAdoptPhotoDescription:
      '방금 분석에 사용한 STYLE 사진을 매일 아침 스타일 브리프의 기준 사진으로 채택합니다. 위치만 저장되어 있으면 바로 적용됩니다.',
    styleAdoptPhotoAction: '이 사진 기준으로 저장하기',
    styleAdoptPhotoLoading: '기준 사진으로 저장 중...',
    styleAdoptPhotoSuccess:
      '이 STYLE 사진을 아침 브리프 기준 사진으로 저장했습니다.',
    styleAdoptPhotoMissingLocation:
      '먼저 account 페이지에서 도시 또는 현재 위치를 저장해 주세요. 그 다음 이 사진을 기준 사진으로 채택할 수 있습니다.',
    styleAdoptPhotoMissingImage:
      '먼저 STYLE 분석에 사용할 사진을 업로드해 주세요.',
    styleAdoptPhotoMissingMetrics:
      '기준 사진으로 저장하려면 키와 몸무게 정보가 필요합니다.',
    hairUploadTitle: '내 사진 업로드',
    hairUploadHelper:
      '드래그 앤 드롭하거나 탭해서 선명한 인물 사진을 업로드하세요.',
    hairAction: '내 스타일 분석하기',
    hairActionLoading: '헤어스타일 추천 생성 중...',
    hairPayAction: '단건 결제하고 추천받기',
    hairPayActionLoading: '단건 결제 체크아웃 준비 중...',
    hairPanelTag: 'AI 헤어 스타일리스트',
    hairPanelTitle: '3x3 헤어스타일 추천',
    hairEmpty:
      '사진을 업로드하면 3x3 헤어스타일 추천 이미지와 설명이 여기에 표시됩니다.',
    checkoutFlowHint:
      '활성 구독이 있으면 바로 생성되고, 없으면 단건 Polar 체크아웃으로 이동합니다. 결제가 완료되면 같은 입력값으로 생성이 자동 이어집니다.',
    hairPromptTitle: '생성형 AI 프롬프트',
    hairPromptDescription:
      'ChatGPT, Gemini 또는 다른 이미지 생성 도구에서 다시 시도할 수 있도록 프롬프트를 복사합니다.',
    utilityButton: '내 생성형 AI로 가져가서 이미지 생성할 프롬프트 복사하기',
    recommendedVisual: '추천 스타일 비주얼',
    topbarAccount: '계정 및 액세스',
    checkoutTitle: '7일 무료 체험으로 시작',
    checkoutDescription:
      '7일 무료 체험 또는 활성 구독이 확인되면 매일 아침 6시 기준 날씨 기반 스타일 브리프를 받을 수 있습니다.',
    checkoutButton: '7일 무료 체험 시작',
    checkoutLoading: '무료 체험 체크아웃 준비 중...',
    checkoutStatusLabel: '현재 구독 액세스 상태',
    checkoutLockedTitle: '아직 구독이 활성화되지 않았습니다',
    checkoutLockedBody:
      '7일 무료 체험 또는 활성 구독이 확인되면 매일 아침 날씨 기반 스타일 브리프를 받을 수 있습니다.',
    checkoutVerifiedStatus: '활성 구독이 확인되어 매일 아침 스타일 브리프가 발송됩니다.',
    checkoutTrialStatus: '7일 무료 체험이 활성화되어 매일 아침 스타일 브리프를 받을 수 있습니다.',
    checkoutPendingStatus:
      '체크아웃 후 돌아왔지만 Polar가 아직 무료 체험 또는 구독 권한을 반영하는 중입니다.',
    accountPageTag: 'ACCOUNT',
    accountPageTitle: '계정과 일일 스타일 구독 관리',
    accountPageBody:
      '이 계정 ID를 기준으로 Polar 구독이 연결됩니다. 단건 결제는 그대로 유지되고, 활성 무료 체험 또는 구독이 있으면 STYLE, HAIR, 매일 아침 브리프가 함께 열립니다.',
    accountPageOrderTitle: '추천 순서',
    accountPageOrderStep1: '지금 로그인한 계정이 이 구독을 소유할 계정인지 확인합니다.',
    accountPageOrderStep2: '구독 섹션에서 Polar 결제 이메일과 무료 체험 또는 월 구독 상태를 확인합니다.',
    accountPageOrderStep3: '기준 사진, 키, 몸무게, 위치를 저장해 아침 브리프를 준비합니다.',
    accountPageOrderStep4: '필요하면 구독 관리 또는 해지를 진행하고, 비밀번호 변경과 탈퇴는 마지막에 처리합니다.',
    accountSubscriptionTitle: '매일 아침 스타일 브리프 구독',
    accountSubscriptionBody:
      '활성 무료 체험 또는 구독이 있으면 매일 아침 6시 브리프와 STYLE, HAIR 생성이 함께 열립니다.',
    accountSubscriptionSeparateNote:
      '단건 결제는 그대로 유지됩니다. 구독이 없어도 STYLE과 HAIR는 개별 결제로 사용할 수 있고, 매일 아침 브리프는 구독 기반으로만 발송됩니다.',
    accountSubscriptionSummaryLocked: '아직 무료 체험 또는 구독이 활성화되지 않았습니다.',
    accountBillingEmailLabel: 'Polar 결제 이메일',
    accountSubscriptionPlanLabel: '현재 구독 상태',
    accountSubscriptionManageAction: 'Polar에서 결제 관리하기',
    accountSubscriptionManageLoading: '구독 관리 페이지 준비 중...',
    accountSubscriptionCancelAction: '이번 주기 종료 시 해지 예약',
    accountSubscriptionCancelLoading: '구독 해지 예약 중...',
    accountSubscriptionCancelPrompt: '현재 결제 주기 종료 시점에 구독을 해지할까요?',
    accountSubscriptionCancelScheduled: '현재 주기 종료 후 해지 예정',
    accountSubscriptionCancelNote: '구독 해지가 예약되어 있습니다. 현재 주기 종료 전까지는 액세스가 유지됩니다.',
    accountSubscriptionCurrentPeriodEndLabel: '현재 주기 종료',
    accountSubscriptionTrialEndsLabel: '무료 체험 종료',
    accountSubscriptionManageHint: '카드 변경, 영수증 확인, 해지 철회는 Polar 고객 포털에서 이어서 할 수 있습니다.',
    accountProfileTitle: '내 정보 및 브리프 설정',
    accountProfileIdentityTitle: '로그인 계정',
    accountProfileMetricsTitle: '브리프 기준 정보',
    accountProfileDeliveryTitle: '발송 일정과 위치',
    accountProfilePhotoTitle: '브리프 기준 사진',
    accountProfileBody:
      '로그인 계정 정보와 매일 아침 브리프에 쓰는 기준 정보를 한 번에 정리합니다.',
    accountEmailLabel: '이메일',
    accountProviderLabel: '로그인 방식',
    accountUserIdLabel: '사용자 ID',
    accountCreatedAtLabel: '가입일',
    accountUnavailable: '확인할 수 없음',
    accountProfileHeightLabel: '키 (cm)',
    accountProfileWeightLabel: '몸무게 (kg)',
    accountProfileLocationLabel: '도시 또는 지역',
    accountProfileLocationPlaceholder: '예: Seoul, South Korea',
    accountProfileLocationAutoAction: '현재 위치로 자동 입력',
    accountProfileLocationAutoLoading: '현재 위치 확인 중...',
    accountProfileLocationAutoSuccess:
      '현재 위치를 불러왔습니다. 저장하면 이 위치 기준으로 오전 6시 브리프가 발송됩니다.',
    accountProfileLocationAutoUnsupported:
      '이 브라우저에서는 현재 위치 자동 감지를 지원하지 않습니다.',
    accountProfileLocationAutoDenied:
      '현재 위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.',
    accountProfileLocationAutoFailed:
      '현재 위치를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    accountProfileCurrentLocation: '현재 위치',
    accountProfileResolvedLocationLabel: '저장된 위치',
    accountProfileTimezoneLabel: '시간대',
    accountProfileScheduleLabel: '일일 발송 일정',
    accountProfileScheduleEnabled: '현지 시간 기준 매일 오전 6:00에 발송을 시도합니다.',
    accountProfileSchedulePaused:
      '일일 발송이 꺼져 있습니다. 다시 켜면 현지 시간 오전 6:00에 맞춰 발송됩니다.',
    accountProfileNextDeliveryLabel: '다음 예정 발송',
    accountProfileNextDeliveryEmpty: '다음 발송 시각이 아직 계산되지 않았습니다.',
    accountProfileLastDeliveryLabel: '마지막 발송 날짜',
    accountProfileLastDeliveryEmpty: '아직 발송 기록이 없습니다.',
    accountProfilePhotoLabel: '기준 사진',
    accountProfilePhotoHint:
      '선명한 전신 기준 사진 1장을 저장합니다. 매일 아침 스타일 브리프 생성에 사용됩니다.',
    accountProfilePhotoAction: '사진 업로드 또는 변경',
    accountProfilePhotoSaved: '저장된 프로필 사진',
    accountProfilePhotoLoadError: '저장된 프로필 사진을 불러오지 못했습니다.',
    accountProfileDailyToggleLabel: '매일 오전 6시 브리프 받기',
    accountProfileDailyToggleHint:
      '활성 무료 체험 또는 구독이 있는 동안에만 발송됩니다.',
    accountProfileDailyOn: '일일 발송 켜짐',
    accountProfileDailyOff: '일일 발송 꺼짐',
    accountProfileSetupNote:
      '키, 몸무게, 위치, 사진을 저장해 두면 날씨와 체형 정보를 함께 반영한 아침 추천을 보냅니다.',
    accountProfileSaveAction: '일일 브리프 프로필 저장',
    accountProfileSaveLoading: '프로필 저장 중...',
    accountProfileLoading: '저장된 일일 브리프 프로필을 불러오는 중...',
    accountProfileLoadError: '일일 브리프 프로필을 불러오지 못했습니다.',
    accountProfileSaveError: '일일 브리프 프로필을 저장하지 못했습니다.',
    accountPasswordTitle: '비밀번호 재설정',
    accountPasswordBody:
      '로그인된 상태에서 새 비밀번호를 설정합니다. 보안 설정에 따라 이메일 인증 코드가 필요할 수 있습니다.',
    accountPasswordLabel: '새 비밀번호',
    accountPasswordPlaceholder: '새 비밀번호를 입력',
    accountPasswordConfirmLabel: '새 비밀번호 확인',
    accountPasswordConfirmPlaceholder: '새 비밀번호를 다시 입력',
    accountPasswordNonceLabel: '이메일 인증 코드',
    accountPasswordNoncePlaceholder: '필요한 경우 이메일로 받은 코드를 입력',
    accountPasswordNonceAction: '인증 코드 보내기',
    accountPasswordAction: '비밀번호 변경',
    accountPasswordMinLength: '비밀번호는 6자 이상이어야 합니다.',
    accountPasswordNonceSent:
      '이메일 인증 코드를 전송했습니다. 코드가 도착하면 입력 후 비밀번호를 변경하세요.',
    accountPasswordUpdated: '비밀번호를 변경했습니다.',
    accountDeleteTitle: '계정 탈퇴',
    accountDeleteBody:
      '계정을 탈퇴하면 현재 로그인과 결제 연동을 더 이상 사용할 수 없습니다. 계속하려면 현재 이메일을 다시 입력하세요.',
    accountDeleteConfirmLabel: '현재 이메일로 탈퇴 확인',
    accountDeleteConfirmPlaceholder: '현재 로그인 이메일을 입력',
    accountDeleteMismatch: '입력한 이메일이 현재 계정과 일치하지 않습니다.',
    accountDeleteAction: '계정 탈퇴',
    accountDeletePrompt:
      '정말로 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    accountDeleteSuccess:
      '계정을 탈퇴했고 이 기기에서 로그아웃했습니다.',
    accountDeleteError: '계정을 탈퇴하지 못했습니다.',
    checkoutError: '구독 체크아웃을 시작하지 못했습니다.',
    checkoutVerifiedTitle: '구독 활성화 완료',
    checkoutVerifiedBody:
      '활성 구독이 확인되었습니다. 매일 아침 스타일 브리프가 이 계정 기준으로 발송됩니다.',
    checkoutTrialTitle: '무료 체험 활성화 완료',
    checkoutTrialBody:
      '7일 무료 체험이 확인되었습니다. 무료 체험 기간 동안 매일 아침 스타일 브리프를 받을 수 있습니다.',
    checkoutPendingTitle: '구독 권한 확인 대기 중',
    checkoutPendingBody:
      '체크아웃 후 돌아왔지만 Polar에서 아직 무료 체험 또는 구독 권한을 확정하지 않았습니다. 잠시 후 다시 동기화됩니다.',
    navHome: 'HOME',
    navStyle: 'STYLE',
    navHair: 'HAIR',
    navAccount: 'ACCOUNT',
    legalTag: 'LEGAL',
    legalLinksTitle: '약관 및 정책',
    legalLinksDescription: '서비스 약관, 환불 규정, 개인정보 처리방침',
  },
  en: {
    languageLabel: 'Language',
    korean: '한국어',
    english: 'English',
    authPanelTag: 'ACCOUNT',
    authPanelTitle: 'Sign Up or Sign In',
    authPanelBody:
      'Checkout and generation continue under the signed-in account.',
    authLoading: 'Checking your session...',
    authEmailLabel: 'Email',
    authEmailPlaceholder: 'name@example.com',
    authPasswordLabel: 'Password',
    authPasswordPlaceholder: 'Enter at least 6 characters',
    authPasswordConfirmLabel: 'Confirm password',
    authPasswordConfirmPlaceholder: 'Re-enter your password',
    authSignInTab: 'Sign In',
    authSignUpTab: 'Sign Up',
    authSignInAction: 'Sign in with email',
    authSignUpAction: 'Create account with email',
    authGoogleAction: 'Continue with Google',
    authGoogleRedirecting: 'Redirecting to Google...',
    authDivider: 'or',
    authSubmitting: 'Working...',
    authSignedInTitle: 'Signed in',
    authSignedInBody:
      'Checkout and generated results are connected to this account.',
    authSignedInAs: 'Current account',
    authSignOutAction: 'Sign out',
    authConfigMissing:
      'Supabase environment variables are missing, so sign-up and sign-in are unavailable.',
    authSessionRequired: 'Please sign in first.',
    authEmailRequired: 'Please enter your email address.',
    authPasswordRequired: 'Please enter your password.',
    authPasswordsMismatch: 'The password confirmation does not match.',
    authSignInSuccess: 'You are signed in.',
    authSignUpSuccess:
      'Your sign-up request was submitted. Check your inbox if email confirmation is enabled.',
    authCheckoutRequired: 'Please sign in before starting checkout.',
    purchaseCheckoutError: 'Unable to start the one-time checkout flow.',
    noImageSelected: 'No image selected yet.',
    copySuccess: 'Prompt copied to your clipboard.',
    copyFailure: 'Clipboard copy failed. Please copy it manually.',
    emailSendTitle: 'Automatic email delivery',
    emailSendDescription:
      'When generation finishes, the current report is sent automatically to the email used during Polar checkout.',
    emailSendAction: 'Send to checkout email',
    emailSendLoading: 'Sending email...',
    emailSendUnavailable:
      'The checkout email could not be found on this device. Please complete checkout again and retry.',
    emailSendTarget: 'Delivery target',
    reportImageSaveAction: 'Save report as image',
    reportImageSaveLoading: 'Preparing image...',
    reportImageShareAction: 'Share externally',
    reportImageShareLoading: 'Preparing share...',
    reportImageSaveSuccess: 'The report image has been saved.',
    reportImageExportError: 'Unable to export the report as an image.',
    reportImageShareUnsupported:
      'This browser cannot share report images directly. Please save the image first.',
    styleReportShareTitle: 'Body Style Report',
    hairReportShareTitle: 'Hairstyle Recommendation Report',
    encodeFailure: 'Failed to encode the image.',
    imageDataMissing: 'Unable to read the image data.',
    imageReadFailure: 'Something went wrong while reading the image file.',
    responseParseFailure: 'Unable to parse the server response.',
    imageOnlyFailure: 'Only image files can be uploaded.',
    stylePhotoRequired: 'Please upload your photo for the style analysis.',
    styleMetricsRequired: 'Please enter both height and weight.',
    styleSubmitError: 'Unable to generate the style report.',
    styleFetchError: 'Something went wrong while loading the style report.',
    hairPhotoRequired: 'Please upload your photo for the hairstyle analysis.',
    hairSubmitError: 'Unable to generate the hairstyle recommendation.',
    hairFetchError: 'Something went wrong while loading the hairstyle recommendation.',
    topbarStyle: 'Body Style Report',
    topbarHair: 'Personal Stylist',
    homeTitleLead: 'Choose the style recommendation',
    homeTitleAccent: 'you want first.',
    homeDescription:
      'Our AI software generates digital styling outputs through separate body styling and hairstyling flows.',
    complianceTitle: 'Digital-only AI styling software',
    complianceBody:
      'This product generates automated digital outputs only. It does not provide human consultation, offline services, or physical goods.',
    homeStyleTitle: 'Body Style Report',
    homeStyleDescription:
      'Generate an automated digital report on silhouettes, outfit direction, and shopping ideas based on your proportions and impression.',
    homeStyleCta: 'Start Analysis',
    homeAccountShortcutSignedOut: 'Sign In',
    homeAccountShortcutSignedIn: 'Account',
    homeHairTitle: 'Hairstyling Recommendation',
    homeHairDescription:
      'Keep your face unchanged and generate 9 hairstyle ideas as a 3x3 image recommendation.',
    homeHairCta: 'Discover Looks',
    styleUploadTitle: 'Upload full-body photo',
    styleUploadHelper: 'Drag and drop or click to browse',
    styleUploadSelect: 'Select Image',
    styleHeight: 'Height (cm)',
    styleWeight: 'Weight (kg)',
    styleHeightPlaceholder: 'e.g. 175',
    styleWeightPlaceholder: 'e.g. 70',
    styleAction: 'Generate Analysis',
    styleActionLoading: 'Generating Analysis...',
    stylePayAction: 'Pay Once and Generate',
    stylePayActionLoading: 'Preparing one-time checkout...',
    stylePanelTag: 'AI Style Report',
    stylePanelTitle: 'AI Automated Style Report',
    styleEmpty:
      'Upload your photo and body details to see the report and outfit direction here.',
    styleVisualTitle: 'Recommended Outfit Construction',
    stylePromptTitle: 'AI Prompt Utility',
    stylePromptDescription:
      'Copy a prompt for ChatGPT, Gemini, Stitch, or another generative AI tool to create more style visuals.',
    styleAdoptPhotoTitle: 'Use this photo for the daily morning brief',
    styleAdoptPhotoDescription:
      'Save the STYLE photo you just analyzed as the reference photo for your daily weather-based style brief. If your location is already saved, it applies immediately.',
    styleAdoptPhotoAction: 'Save as daily brief photo',
    styleAdoptPhotoLoading: 'Saving as the reference photo...',
    styleAdoptPhotoSuccess:
      'This STYLE photo has been saved as your daily brief reference photo.',
    styleAdoptPhotoMissingLocation:
      'Please save your city or current location on the account page first. Then this photo can be adopted as the daily brief reference photo.',
    styleAdoptPhotoMissingImage:
      'Please upload the STYLE photo first.',
    styleAdoptPhotoMissingMetrics:
      'Height and weight are required before this photo can be saved as your daily brief reference photo.',
    hairUploadTitle: 'Upload Your Photo',
    hairUploadHelper:
      'Drag and drop or tap to upload a clear portrait for AI hair analysis.',
    hairAction: 'Analyze My Look',
    hairActionLoading: 'Analyzing My Look...',
    hairPayAction: 'Pay Once and Analyze',
    hairPayActionLoading: 'Preparing one-time checkout...',
    hairPanelTag: 'AI Hair Stylist',
    hairPanelTitle: '3x3 Hairstyle Recommendations',
    hairEmpty:
      'Upload your photo to see the 3x3 hairstyle grid and recommendation details here.',
    checkoutFlowHint:
      'If an active subscription exists, generation starts immediately. Otherwise a one-time Polar checkout opens and generation resumes automatically after payment.',
    hairPromptTitle: 'Generative Prompt',
    hairPromptDescription:
      'Copy an optimized prompt to try the hairstyle generation again in ChatGPT, Gemini, or another image tool.',
    utilityButton: 'Copy prompt for image generation in my AI',
    recommendedVisual: 'Recommended Style Visual',
    topbarAccount: 'Account & Access',
    checkoutTitle: 'Start with a 7-day free trial',
    checkoutDescription:
      'Start a 7-day free trial or monthly subscription to receive the daily weather-based style brief every morning.',
    checkoutButton: 'Start 7-Day Free Trial',
    checkoutLoading: 'Preparing free-trial checkout...',
    checkoutStatusLabel: 'Current subscription access',
    checkoutLockedTitle: 'No free trial or subscription is active yet',
    checkoutLockedBody:
      'Once your 7-day free trial or active subscription is confirmed, the daily morning style brief becomes available.',
    checkoutVerifiedStatus:
      'An active subscription is confirmed, so the daily morning style brief is enabled for this account.',
    checkoutTrialStatus: 'Your 7-day free trial is active, so the daily morning style brief is enabled for this account.',
    checkoutPendingStatus:
      'You returned from checkout, but Polar is still confirming the free trial or subscription access.',
    accountPageTag: 'ACCOUNT',
    accountPageTitle: 'Manage your account and daily style subscription',
    accountPageBody:
      'This signed-in account ID owns the Polar subscription. One-time purchases still remain available, and an active trial or subscription unlocks STYLE, HAIR, and the daily morning brief together.',
    accountPageOrderTitle: 'Recommended order',
    accountPageOrderStep1: 'Confirm that the signed-in account is the one that should own the subscription.',
    accountPageOrderStep2: 'Check the subscription section for the Polar billing email and the current free-trial or monthly status.',
    accountPageOrderStep3: 'Save the reference photo, height, weight, and location for the morning brief.',
    accountPageOrderStep4: 'Use subscription management or cancellation when needed, and keep password or account deletion for last.',
    accountSubscriptionTitle: 'Daily morning style brief subscription',
    accountSubscriptionBody:
      'An active free trial or subscription unlocks the 6:00 AM morning brief together with STYLE and HAIR generation.',
    accountSubscriptionSeparateNote:
      'One-time checkout remains available. STYLE and HAIR can still be purchased separately, while the daily morning brief is sent only while the subscription side stays active.',
    accountSubscriptionSummaryLocked: 'No free trial or subscription is active yet.',
    accountBillingEmailLabel: 'Polar billing email',
    accountSubscriptionPlanLabel: 'Current subscription state',
    accountSubscriptionManageAction: 'Manage billing in Polar',
    accountSubscriptionManageLoading: 'Opening the subscription manager...',
    accountSubscriptionCancelAction: 'Schedule cancellation at period end',
    accountSubscriptionCancelLoading: 'Scheduling the cancellation...',
    accountSubscriptionCancelPrompt: 'Schedule this subscription to cancel at the end of the current billing period?',
    accountSubscriptionCancelScheduled: 'Cancellation scheduled at period end',
    accountSubscriptionCancelNote: 'Cancellation is scheduled. Access stays available until the current billing period ends.',
    accountSubscriptionCurrentPeriodEndLabel: 'Current period ends',
    accountSubscriptionTrialEndsLabel: 'Free trial ends',
    accountSubscriptionManageHint: 'Use the Polar customer portal for card updates, receipts, or reversing a cancellation.',
    accountProfileTitle: 'My details and brief settings',
    accountProfileIdentityTitle: 'Signed-in account',
    accountProfileMetricsTitle: 'Brief inputs',
    accountProfileDeliveryTitle: 'Delivery schedule and location',
    accountProfilePhotoTitle: 'Brief reference photo',
    accountProfileBody:
      'Review the signed-in account and the saved profile used for daily morning delivery in one place.',
    accountEmailLabel: 'Email',
    accountProviderLabel: 'Sign-in method',
    accountUserIdLabel: 'User ID',
    accountCreatedAtLabel: 'Created',
    accountUnavailable: 'Unavailable',
    accountProfileHeightLabel: 'Height (cm)',
    accountProfileWeightLabel: 'Weight (kg)',
    accountProfileLocationLabel: 'City or region',
    accountProfileLocationPlaceholder: 'e.g. Seoul, South Korea',
    accountProfileLocationAutoAction: 'Use current location',
    accountProfileLocationAutoLoading: 'Detecting your location...',
    accountProfileLocationAutoSuccess:
      'Your current location was loaded. Save the profile to schedule the 6:00 AM brief for this location.',
    accountProfileLocationAutoUnsupported:
      'This browser does not support automatic current-location detection.',
    accountProfileLocationAutoDenied:
      'Location access was denied. Please allow location access in your browser settings.',
    accountProfileLocationAutoFailed:
      'Unable to detect your current location right now. Please try again shortly.',
    accountProfileCurrentLocation: 'Current location',
    accountProfileResolvedLocationLabel: 'Saved location',
    accountProfileTimezoneLabel: 'Timezone',
    accountProfileScheduleLabel: 'Daily delivery schedule',
    accountProfileScheduleEnabled: 'Delivery is attempted every day at 6:00 AM in the saved local timezone.',
    accountProfileSchedulePaused:
      'Daily delivery is paused. Turn it back on to resume the 6:00 AM local-time send.',
    accountProfileNextDeliveryLabel: 'Next scheduled delivery',
    accountProfileNextDeliveryEmpty: 'The next delivery time has not been scheduled yet.',
    accountProfileLastDeliveryLabel: 'Last delivery date',
    accountProfileLastDeliveryEmpty: 'No delivery has been sent yet.',
    accountProfilePhotoLabel: 'Reference photo',
    accountProfilePhotoHint:
      'Store one clear full-body reference photo. It is used to generate the morning style brief.',
    accountProfilePhotoAction: 'Upload or replace photo',
    accountProfilePhotoSaved: 'Saved profile photo',
    accountProfilePhotoLoadError: 'Unable to load the saved profile photo.',
    accountProfileDailyToggleLabel: 'Receive the 6:00 AM daily brief',
    accountProfileDailyToggleHint:
      'Delivery only runs while this account has an active free trial or subscription.',
    accountProfileDailyOn: 'Daily delivery on',
    accountProfileDailyOff: 'Daily delivery off',
    accountProfileSetupNote:
      'Save your height, weight, location, and photo so the morning recommendation can use both weather and body context.',
    accountProfileSaveAction: 'Save daily brief profile',
    accountProfileSaveLoading: 'Saving profile...',
    accountProfileLoading: 'Loading your saved daily brief profile...',
    accountProfileLoadError: 'Unable to load the daily brief profile.',
    accountProfileSaveError: 'Unable to save the daily brief profile.',
    accountPasswordTitle: 'Reset password',
    accountPasswordBody:
      'Set a new password while signed in. Depending on your Supabase security settings, an email verification code may be required.',
    accountPasswordLabel: 'New password',
    accountPasswordPlaceholder: 'Enter a new password',
    accountPasswordConfirmLabel: 'Confirm new password',
    accountPasswordConfirmPlaceholder: 'Re-enter the new password',
    accountPasswordNonceLabel: 'Email verification code',
    accountPasswordNoncePlaceholder: 'Enter the code from email if Supabase requests it',
    accountPasswordNonceAction: 'Send verification code',
    accountPasswordAction: 'Update password',
    accountPasswordMinLength: 'Your password must be at least 6 characters long.',
    accountPasswordNonceSent:
      'A verification code was sent by email. Enter it below if Supabase asks for reauthentication.',
    accountPasswordUpdated: 'Your password has been updated.',
    accountDeleteTitle: 'Delete account',
    accountDeleteBody:
      'Deleting your account removes future access to this sign-in and its linked checkout flow. Enter your current email to confirm.',
    accountDeleteConfirmLabel: 'Confirm with your current email',
    accountDeleteConfirmPlaceholder: 'Enter your signed-in email',
    accountDeleteMismatch: 'The confirmation email does not match the signed-in account.',
    accountDeleteAction: 'Delete my account',
    accountDeletePrompt:
      'Delete this account? This action cannot be undone.',
    accountDeleteSuccess:
      'Your account was deleted and this device was signed out.',
    accountDeleteError: 'Unable to delete your account.',
    checkoutError: 'Unable to start the subscription checkout flow.',
    checkoutVerifiedTitle: 'Subscription active',
    checkoutVerifiedBody:
      'Your active subscription has been confirmed. The daily morning style brief is now enabled for this account.',
    checkoutTrialTitle: 'Free trial active',
    checkoutTrialBody:
      'Your 7-day free trial has been confirmed. The daily morning style brief is now enabled for this account.',
    checkoutPendingTitle: 'Subscription access still pending',
    checkoutPendingBody:
      'You returned from checkout, but Polar has not finished confirming the free trial or subscription access yet. Please try again shortly.',
    navHome: 'HOME',
    navStyle: 'STYLE',
    navHair: 'HAIR',
    navAccount: 'ACCOUNT',
    legalTag: 'LEGAL',
    legalLinksTitle: 'Terms and policies',
    legalLinksDescription: 'Terms of Service, Refund Policy, Privacy Policy',
  },
} as const

const Icon = ({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
  >
    {children}
  </svg>
)

const SparkleIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M12 3.75 13.85 8.15 18.25 10 13.85 11.85 12 16.25 10.15 11.85 5.75 10 10.15 8.15 12 3.75Z"
      fill="currentColor"
    />
    <path
      d="M18.75 3.75 19.45 5.55 21.25 6.25 19.45 6.95 18.75 8.75 18.05 6.95 16.25 6.25 18.05 5.55 18.75 3.75Z"
      fill="currentColor"
    />
  </Icon>
)

const SunIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" fill="currentColor" r="4.25" />
    <path
      d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    />
  </Icon>
)

const MoonIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M14.5 3.4a8.6 8.6 0 1 0 6.1 14.7A7.55 7.55 0 0 1 14.5 3.4Z"
      fill="currentColor"
    />
  </Icon>
)

const ArrowLeftIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M14.75 5.5 8.25 12l6.5 6.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </Icon>
)

const AnalyticsIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <rect fill="currentColor" height="12" opacity=".38" rx="1.5" width="3.5" x="4" y="8" />
    <rect fill="currentColor" height="8" opacity=".65" rx="1.5" width="3.5" x="10.25" y="12" />
    <rect fill="currentColor" height="15" rx="1.5" width="3.5" x="16.5" y="5" />
  </Icon>
)

const ScissorsIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="6.5" cy="16.75" r="2.25" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="6.5" cy="7.25" r="2.25" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M19 5.75 9.2 10.95M19 18.25 9.2 13.05M8.25 9.85l2.85 2.15M8.25 14.15 11.1 12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </Icon>
)

const UploadIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M12 15.75V6.75M8.5 10.25 12 6.75l3.5 3.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path
      d="M5.5 18.25h13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </Icon>
)

const CameraIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M7.5 7.5h2l1.1-1.75h2.8L14.5 7.5h2A2.5 2.5 0 0 1 19 10v6A2.5 2.5 0 0 1 16.5 18.5h-9A2.5 2.5 0 0 1 5 16v-6A2.5 2.5 0 0 1 7.5 7.5Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
    <circle cx="12" cy="13" r="2.6" stroke="currentColor" strokeWidth="1.6" />
  </Icon>
)

const CopyIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <rect
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
      width="9"
      x="8.5"
      y="8"
    />
    <path
      d="M6.25 15.5h-.75A2.5 2.5 0 0 1 3 13V5.5A2.5 2.5 0 0 1 5.5 3H13a2.5 2.5 0 0 1 2.5 2.5v.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </Icon>
)

const DownloadIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M12 4.5v9M8.5 10.25 12 13.5l3.5-3.25M5.5 18.25h13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </Icon>
)

const ShareIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="18" cy="5.75" fill="currentColor" r="2" />
    <circle cx="6" cy="12" fill="currentColor" r="2" />
    <circle cx="18" cy="18.25" fill="currentColor" r="2" />
    <path
      d="M7.75 11.1 16.2 6.65M7.75 12.9l8.45 4.45"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </Icon>
)

const CheckIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" fill="currentColor" opacity=".14" r="9" />
    <path
      d="m8.5 12.25 2.3 2.3 4.7-5.1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </Icon>
)

const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="m7.5 10 4.5 4.5 4.5-4.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </Icon>
)

const WarningIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M12 4.75 4.9 18h14.2L12 4.75Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
    <path
      d="M12 9.3v4.25M12 16.3h.01"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </Icon>
)

const HomeIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="M5.5 10.25 12 5l6.5 5.25v7.25h-4.75V13h-3.5v4.5H5.5v-7.25Z"
      fill="currentColor"
    />
  </Icon>
)

const PersonIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="8.25" fill="currentColor" r="3.25" />
    <path
      d="M5.75 18.5a6.25 6.25 0 0 1 12.5 0"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </Icon>
)

const GoogleIcon = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
    <path
      d="M21.8 12.23c0-.68-.06-1.33-.17-1.95H12v3.69h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.39 3.04-7.38Z"
      fill="#4285F4"
    />
    <path
      d="M12 22c2.75 0 5.06-.91 6.76-2.47l-3.3-2.56c-.91.61-2.08.97-3.46.97-2.65 0-4.9-1.79-5.71-4.19H2.89v2.64A10 10 0 0 0 12 22Z"
      fill="#34A853"
    />
    <path
      d="M6.29 13.75A6 6 0 0 1 5.97 12c0-.61.11-1.2.32-1.75V7.61H2.89A10 10 0 0 0 2 12c0 1.61.38 3.14.89 4.39l3.4-2.64Z"
      fill="#FBBC05"
    />
    <path
      d="M12 6.06c1.5 0 2.85.51 3.91 1.51l2.93-2.93C17.06 3 14.75 2 12 2A10 10 0 0 0 2.89 7.61l3.4 2.64c.81-2.4 3.06-4.19 5.71-4.19Z"
      fill="#EA4335"
    />
  </svg>
)

const navItems = [
  { key: 'home', icon: HomeIcon },
  { key: 'style', icon: AnalyticsIcon },
  { key: 'hair', icon: ScissorsIcon },
  { key: 'account', icon: PersonIcon },
] as const

const policyViews: LegalView[] = ['terms', 'refunds', 'privacy']

const isPolicyView = (view: View): view is LegalView =>
  view === 'terms' || view === 'refunds' || view === 'privacy'

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [language, setLanguage] = useState<Language>(getInitialLanguage)
  const [view, setView] = useState<View>(getInitialView)
  const [policyDocumentsByLocale, setPolicyDocumentsByLocale] =
    useState<PolicyDocumentsByLocale | null>(null)
  const styleReportCaptureRef = useRef<HTMLElement | null>(null)
  const hairReportCaptureRef = useRef<HTMLElement | null>(null)
  const lastTrackedViewRef = useRef<View | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageTone, setAuthMessageTone] = useState<StatusTone>('fallback')
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [hasAuthConfig, setHasAuthConfig] = useState(true)
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null)
  const [authSession, setAuthSession] = useState<Session | null>(null)
  const [accountPassword, setAccountPassword] = useState('')
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('')
  const [accountPasswordNonce, setAccountPasswordNonce] = useState('')
  const [openAccountSection, setOpenAccountSection] = useState<AccountSection | null>(null)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordMessageTone, setPasswordMessageTone] = useState<StatusTone>('success')
  const [deleteConfirmationEmail, setDeleteConfirmationEmail] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [deleteMessageTone, setDeleteMessageTone] = useState<StatusTone>('success')
  const [isPasswordNonceSending, setIsPasswordNonceSending] = useState(false)
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false)
  const [isAccountDeleting, setIsAccountDeleting] = useState(false)
  const [customerProfileHeight, setCustomerProfileHeight] = useState('')
  const [customerProfileWeight, setCustomerProfileWeight] = useState('')
  const [customerProfileLocationQuery, setCustomerProfileLocationQuery] = useState('')
  const [customerProfileLocationName, setCustomerProfileLocationName] = useState('')
  const [customerProfileTimezone, setCustomerProfileTimezone] = useState('')
  const [customerProfileLatitude, setCustomerProfileLatitude] = useState<number | null>(null)
  const [customerProfileLongitude, setCustomerProfileLongitude] = useState<number | null>(null)
  const [isLocationDetecting, setIsLocationDetecting] = useState(false)
  const [customerProfileHasPhoto, setCustomerProfileHasPhoto] = useState(false)
  const [customerProfilePhotoFile, setCustomerProfilePhotoFile] = useState<File | null>(null)
  const [customerProfilePhotoName, setCustomerProfilePhotoName] = useState<string>(localeCopy.en.noImageSelected)
  const [customerProfilePhotoPreview, setCustomerProfilePhotoPreview] = useState('')
  const [customerProfileUpdatedAt, setCustomerProfileUpdatedAt] = useState('')
  const [customerProfileNextDeliveryAt, setCustomerProfileNextDeliveryAt] = useState('')
  const [customerProfileLastDeliveryLocalDate, setCustomerProfileLastDeliveryLocalDate] = useState('')
  const [customerDailyEmailEnabled, setCustomerDailyEmailEnabled] = useState(true)
  const [customerProfileMessage, setCustomerProfileMessage] = useState('')
  const [customerProfileMessageTone, setCustomerProfileMessageTone] = useState<StatusTone>('success')
  const [isCustomerProfileLoading, setIsCustomerProfileLoading] = useState(false)
  const [isCustomerProfileSaving, setIsCustomerProfileSaving] = useState(false)

  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [stylePhotoFile, setStylePhotoFile] = useState<File | null>(null)
  const [stylePhotoName, setStylePhotoName] = useState<string>(localeCopy.en.noImageSelected)
  const [stylePhotoPreview, setStylePhotoPreview] = useState('')
  const [styleReport, setStyleReport] = useState('')
  const [styleResultImage, setStyleResultImage] = useState('')
  const [stylePrompt, setStylePrompt] = useState('')
  const [styleNote, setStyleNote] = useState('')
  const [styleCopyMessage, setStyleCopyMessage] = useState('')
  const [styleAssetMessage, setStyleAssetMessage] = useState('')
  const [styleAssetTone, setStyleAssetTone] = useState<StatusTone>('success')
  const [styleAssetAction, setStyleAssetAction] = useState<'idle' | 'save' | 'share'>('idle')
  const [styleErrorMessage, setStyleErrorMessage] = useState('')
  const [isStyleLoading, setIsStyleLoading] = useState(false)
  const [isStyleDragging, setIsStyleDragging] = useState(false)

  const [hairPhotoFile, setHairPhotoFile] = useState<File | null>(null)
  const [hairPhotoName, setHairPhotoName] = useState<string>(localeCopy.en.noImageSelected)
  const [hairPhotoPreview, setHairPhotoPreview] = useState('')
  const [hairDescription, setHairDescription] = useState('')
  const [hairResultImage, setHairResultImage] = useState('')
  const [hairPrompt, setHairPrompt] = useState('')
  const [hairNote, setHairNote] = useState('')
  const [hairCopyMessage, setHairCopyMessage] = useState('')
  const [hairAssetMessage, setHairAssetMessage] = useState('')
  const [hairAssetTone, setHairAssetTone] = useState<StatusTone>('success')
  const [hairAssetAction, setHairAssetAction] = useState<'idle' | 'save' | 'share'>('idle')
  const [hairErrorMessage, setHairErrorMessage] = useState('')
  const [isHairLoading, setIsHairLoading] = useState(false)
  const [isHairDragging, setIsHairDragging] = useState(false)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [activeCheckoutKind, setActiveCheckoutKind] = useState<CheckoutKind | null>(null)
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState('')
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'pending' | 'verified'>('idle')
  const [checkoutStatusMessage, setCheckoutStatusMessage] = useState('')
  const [isPurchaseVerified, setIsPurchaseVerified] = useState(getInitialPurchaseVerified)
  const [billingAccessPhase, setBillingAccessPhase] = useState<BillingAccessPhase>(
    getInitialBillingAccessPhase,
  )
  const [purchaseOrderId, setPurchaseOrderId] = useState(getInitialPurchaseOrderId)
  const [purchaseEmail, setPurchaseEmail] = useState(getInitialPurchaseEmail)
  const [billingCustomerEmail, setBillingCustomerEmail] = useState('')
  const [billingSubscriptionId, setBillingSubscriptionId] = useState('')
  const [billingSubscriptionCurrentPeriodEnd, setBillingSubscriptionCurrentPeriodEnd] = useState('')
  const [billingSubscriptionTrialEndsAt, setBillingSubscriptionTrialEndsAt] = useState('')
  const [billingSubscriptionCancelAtPeriodEnd, setBillingSubscriptionCancelAtPeriodEnd] = useState(false)
  const [subscriptionActionMessage, setSubscriptionActionMessage] = useState('')
  const [subscriptionActionTone, setSubscriptionActionTone] = useState<StatusTone>('success')
  const [isSubscriptionPortalLoading, setIsSubscriptionPortalLoading] = useState(false)
  const [isSubscriptionCanceling, setIsSubscriptionCanceling] = useState(false)
  const [styleEmailMessage, setStyleEmailMessage] = useState('')
  const [styleEmailTone, setStyleEmailTone] = useState<StatusTone>('success')
  const [isStyleEmailSending, setIsStyleEmailSending] = useState(false)
  const [styleAdoptMessage, setStyleAdoptMessage] = useState('')
  const [styleAdoptTone, setStyleAdoptTone] = useState<StatusTone>('success')
  const [isStylePhotoAdopting, setIsStylePhotoAdopting] = useState(false)
  const [hairEmailMessage, setHairEmailMessage] = useState('')
  const [hairEmailTone, setHairEmailTone] = useState<StatusTone>('success')
  const [isHairEmailSending, setIsHairEmailSending] = useState(false)
  const copy = localeCopy[language]
  const policyCopy = policyDocumentsByLocale?.[language] ?? null
  const preferredLocale = language === 'ko' ? 'ko-KR' : 'en-US'
  const authenticatedEmail = authSession?.user.email ?? ''
  const isAuthenticated = Boolean(authSession?.user)
  const authProvider = formatAuthProvider(
    typeof authSession?.user.app_metadata?.provider === 'string'
      ? authSession.user.app_metadata.provider
      : typeof authSession?.user.identities?.[0]?.provider === 'string'
        ? authSession.user.identities[0].provider
        : undefined,
  )
  const accountCreatedAt = formatAccountTimestamp(
    authSession?.user.created_at,
    preferredLocale,
  )
  const customerProfileLastDeliveryDisplay = formatCalendarDate(
    customerProfileLastDeliveryLocalDate,
    preferredLocale,
  )
  const customerProfileNextDeliveryDisplay = formatAccountTimestamp(
    customerProfileNextDeliveryAt,
    preferredLocale,
  )
  const billingCurrentPeriodEndDisplay = formatAccountTimestamp(
    billingSubscriptionCurrentPeriodEnd,
    preferredLocale,
  )
  const billingTrialEndsDisplay = formatAccountTimestamp(
    billingSubscriptionTrialEndsAt,
    preferredLocale,
  )
  const accountProfileSummary =
    customerProfileLocationName
      ? [
          customerProfileLocationName,
          customerDailyEmailEnabled
            ? copy.accountProfileDailyOn
            : copy.accountProfileDailyOff,
        ].join(' / ')
      : [authenticatedEmail, authProvider].filter(Boolean).join(' / ') ||
        copy.accountProfileBody
  const accountPasswordSummary = passwordMessage || copy.accountPasswordBody
  const accountDeleteSummary = deleteMessage || copy.accountDeleteBody
  const linkedBillingEmail = billingCustomerEmail || authenticatedEmail
  const subscriptionStatusTitle =
    checkoutStatus === 'pending'
      ? copy.checkoutPendingTitle
      : billingAccessPhase === 'trialing'
        ? copy.checkoutTrialTitle
        : billingAccessPhase === 'active'
          ? billingSubscriptionCancelAtPeriodEnd
            ? copy.accountSubscriptionCancelScheduled
            : copy.checkoutVerifiedTitle
          : copy.checkoutLockedTitle
  const subscriptionStatusBody =
    checkoutErrorMessage ||
    (checkoutStatus === 'pending'
      ? checkoutStatusMessage || copy.checkoutPendingBody
      : billingAccessPhase === 'trialing'
        ? copy.checkoutTrialBody
        : billingAccessPhase === 'active'
          ? billingSubscriptionCancelAtPeriodEnd
            ? copy.accountSubscriptionCancelNote
            : copy.checkoutVerifiedBody
          : copy.checkoutLockedBody)
  const accountSubscriptionSummary =
    checkoutErrorMessage ||
    (!isAuthenticated
      ? copy.authCheckoutRequired
      : checkoutStatus === 'pending'
        ? checkoutStatusMessage || copy.checkoutPendingStatus
        : billingAccessPhase === 'trialing'
          ? copy.checkoutTrialStatus
          : billingAccessPhase === 'active'
            ? billingSubscriptionCancelAtPeriodEnd
              ? copy.accountSubscriptionCancelScheduled
              : copy.checkoutVerifiedStatus
            : copy.accountSubscriptionSummaryLocked)
  const hasGenerationAccess =
    isPurchaseVerified ||
    billingAccessPhase === 'trialing' ||
    billingAccessPhase === 'active'
  const analyticsAccessType =
    isPurchaseVerified
      ? 'one_time'
      : billingAccessPhase === 'trialing'
        ? 'subscription_trial'
        : billingAccessPhase === 'active'
          ? 'subscription_active'
          : 'locked'

  const setAuthFeedback = (tone: StatusTone, message: string) => {
    setAuthMessageTone(tone)
    setAuthMessage(message)
  }

  const setPasswordFeedback = (tone: StatusTone, message: string) => {
    setPasswordMessageTone(tone)
    setPasswordMessage(message)
  }

  const setDeleteFeedback = (tone: StatusTone, message: string) => {
    setDeleteMessageTone(tone)
    setDeleteMessage(message)
  }

  const setCustomerProfileFeedback = (tone: StatusTone, message: string) => {
    setCustomerProfileMessageTone(tone)
    setCustomerProfileMessage(message)
  }

  const applyBillingSnapshot = useCallback(
    (
      snapshot:
        | BillingAccessResponse
        | CheckoutStatusResponse
        | CancelSubscriptionResponse
        | null,
    ) => {
      const nextEmail = snapshot?.customerEmail?.trim() || ''
      const nextPhase = normalizeBillingAccessPhase(
        snapshot?.subscriptionStatus,
        Boolean(snapshot?.hasAccess),
      )
      const nextSubscription = snapshot?.subscription ?? null

      setBillingAccessPhase(nextPhase)
      setBillingCustomerEmail(nextEmail)
      setBillingSubscriptionId(nextSubscription?.id?.trim() || '')
      setBillingSubscriptionCurrentPeriodEnd(nextSubscription?.currentPeriodEnd?.trim?.() || nextSubscription?.currentPeriodEnd || '')
      setBillingSubscriptionTrialEndsAt(nextSubscription?.trialEndsAt?.trim?.() || nextSubscription?.trialEndsAt || '')
      setBillingSubscriptionCancelAtPeriodEnd(Boolean(nextSubscription?.cancelAtPeriodEnd))
    },
    [],
  )

  const toggleAccountSection = useCallback((section: AccountSection) => {
    const isOpening = openAccountSection !== section

    if (section === 'subscription' && isOpening && billingAccessPhase === 'inactive') {
      trackEvent('view_promotion', {
        promotion_id: SUBSCRIPTION_PROMOTION_ID,
        promotion_name: SUBSCRIPTION_PROMOTION_NAME,
        creative_slot: SUBSCRIPTION_PROMOTION_SLOT,
        items: [buildSubscriptionPromotionItem()],
        ui_locale: preferredLocale,
      })
    }

    setOpenAccountSection((current) => (current === section ? null : section))
  }, [billingAccessPhase, openAccountSection, preferredLocale])

  const resetCustomerProfileState = useCallback(() => {
    setCustomerProfileHeight('')
    setCustomerProfileWeight('')
    setCustomerProfileLocationQuery('')
    setCustomerProfileLocationName('')
    setCustomerProfileTimezone('')
    setCustomerProfileLatitude(null)
    setCustomerProfileLongitude(null)
    setIsLocationDetecting(false)
    setCustomerProfileHasPhoto(false)
    setCustomerProfilePhotoFile(null)
    setCustomerProfilePhotoName(copy.noImageSelected)
    setCustomerProfilePhotoPreview('')
    setCustomerProfileUpdatedAt('')
    setCustomerProfileNextDeliveryAt('')
    setCustomerProfileLastDeliveryLocalDate('')
    setCustomerDailyEmailEnabled(true)
    setCustomerProfileMessage('')
    setCustomerProfileMessageTone('success')
    setIsCustomerProfileLoading(false)
    setIsCustomerProfileSaving(false)
  }, [copy.noImageSelected])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('language', language)
    document.documentElement.lang = language === 'ko' ? 'ko' : 'en'
  }, [language])

  useEffect(() => {
    if (policyDocumentsByLocale || (view !== 'account' && !isPolicyView(view))) {
      return
    }

    let isCancelled = false

    void import('./legalContent').then(({ policyDocuments }) => {
      if (isCancelled) {
        return
      }

      setPolicyDocumentsByLocale(policyDocuments as PolicyDocumentsByLocale)
    })

    return () => {
      isCancelled = true
    }
  }, [policyDocumentsByLocale, view])

  useEffect(() => {
    let isCancelled = false
    let unsubscribe = () => {}

    void import('./supabase')
      .then(({ loadSupabaseClient }) => loadSupabaseClient())
      .then((client) => {
        if (isCancelled) {
          return
        }

        if (!client) {
          setSupabaseClient(null)
          setHasAuthConfig(false)
          setIsAuthLoading(false)
          return
        }

        setSupabaseClient(client)
        setHasAuthConfig(true)

        void client.auth.getSession().then(({ data, error }) => {
          if (isCancelled) {
            return
          }

          if (error) {
            setAuthFeedback('error', error.message)
          }

          setAuthSession(data.session)
          setIsAuthLoading(false)
        })

        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (isCancelled) {
            return
          }

          setAuthSession(nextSession)
          setIsAuthLoading(false)
        })

        unsubscribe = () => {
          subscription.unsubscribe()
        }
      })
      .catch(() => {
        if (isCancelled) {
          return
        }

        setSupabaseClient(null)
        setHasAuthConfig(false)
        setIsAuthLoading(false)
      })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    setAuthMessage('')
    setAuthPassword('')
    setAuthPasswordConfirm('')
  }, [authMode])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (isAuthenticated) {
      return
    }

    setAccountPassword('')
    setAccountPasswordConfirm('')
    setAccountPasswordNonce('')
    setOpenAccountSection(null)
    setPasswordMessage('')
    setDeleteConfirmationEmail('')
    setDeleteMessage('')
    setIsPasswordNonceSending(false)
    setIsPasswordUpdating(false)
    setIsAccountDeleting(false)
    resetCustomerProfileState()

    setIsPurchaseVerified(false)
    setBillingAccessPhase('inactive')
    setBillingCustomerEmail('')
    setBillingSubscriptionId('')
    setBillingSubscriptionCurrentPeriodEnd('')
    setBillingSubscriptionTrialEndsAt('')
    setBillingSubscriptionCancelAtPeriodEnd(false)
    setSubscriptionActionMessage('')
    setPurchaseOrderId('')
    setPurchaseEmail('')
    setCheckoutStatus('idle')
    setCheckoutStatusMessage('')
    setCheckoutErrorMessage('')

    if (view === 'style' || view === 'hair') {
      setView('account')
    }
  }, [isAuthLoading, isAuthenticated, resetCustomerProfileState, view])

  useEffect(() => {
    if (isPurchaseVerified) {
      window.localStorage.setItem(PURCHASE_VERIFIED_KEY, 'true')
    } else {
      window.localStorage.removeItem(PURCHASE_VERIFIED_KEY)
    }
  }, [isPurchaseVerified])

  useEffect(() => {
    if (purchaseOrderId) {
      window.localStorage.setItem(PURCHASE_ORDER_ID_KEY, purchaseOrderId)
    } else {
      window.localStorage.removeItem(PURCHASE_ORDER_ID_KEY)
    }

    if (purchaseEmail) {
      window.localStorage.setItem(PURCHASE_EMAIL_KEY, purchaseEmail)
    } else {
      window.localStorage.removeItem(PURCHASE_EMAIL_KEY)
    }
  }, [purchaseEmail, purchaseOrderId])

  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace('#', '')

      if (isSupabaseAuthHash(rawHash)) {
        return
      }

      setView(getInitialView())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    const rawHash = window.location.hash.replace('#', '')

    if (isSupabaseAuthHash(rawHash)) {
      return
    }

    const hash = view === 'home' ? '' : `#${view}`
    const url = `${window.location.pathname}${window.location.search}${hash}`
    window.history.replaceState(null, '', url)
  }, [view])

  useEffect(() => {
    if (lastTrackedViewRef.current === view) {
      return
    }

    lastTrackedViewRef.current = view

    const pageTitle =
      view === 'style'
        ? 'Body Style Report'
        : view === 'hair'
          ? 'Hairstyling Recommendation'
          : view === 'account'
            ? 'Account & Access'
            : view === 'terms'
              ? 'Terms of Service'
              : view === 'refunds'
                ? 'Refund Policy'
                : view === 'privacy'
                  ? 'Privacy Policy'
                  : 'Home'
    const pagePath = view === 'home' ? '/' : `/${view}`
    const pageLocation = `${window.location.origin}${window.location.pathname}${window.location.search}${view === 'home' ? '' : `#${view}`}`

    trackPageView({
      page_title: pageTitle,
      page_path: pagePath,
      page_location: pageLocation,
      language: preferredLocale,
    })

    if (view === 'home') {
      trackEvent('view_item_list', {
        item_list_id: HOME_ITEM_LIST_ID,
        item_list_name: HOME_ITEM_LIST_NAME,
        items: getHomeRecommendationItems(),
        ui_locale: preferredLocale,
      })
      return
    }

    if (view === 'style' || view === 'hair') {
      trackEvent('view_item', {
        items: [buildFeatureItem(view)],
        entry_flow: view,
        access_type: analyticsAccessType,
        ui_locale: preferredLocale,
      })
    }
  }, [analyticsAccessType, preferredLocale, view])

  useEffect(() => {
    return () => {
      if (stylePhotoPreview) {
        URL.revokeObjectURL(stylePhotoPreview)
      }
    }
  }, [stylePhotoPreview])

  useEffect(() => {
    return () => {
      if (hairPhotoPreview) {
        URL.revokeObjectURL(hairPhotoPreview)
      }
    }
  }, [hairPhotoPreview])

  useEffect(() => {
    return () => {
      if (customerProfilePhotoPreview) {
        URL.revokeObjectURL(customerProfilePhotoPreview)
      }
    }
  }, [customerProfilePhotoPreview])

  useEffect(() => {
    if (!stylePhotoFile) {
      setStylePhotoName(copy.noImageSelected)
    }

    if (!hairPhotoFile) {
      setHairPhotoName(copy.noImageSelected)
    }

    if (!customerProfilePhotoFile) {
      setCustomerProfilePhotoName(
        customerProfileHasPhoto
          ? copy.accountProfilePhotoSaved
          : copy.noImageSelected,
      )
    }
  }, [
    copy.accountProfilePhotoSaved,
    copy.noImageSelected,
    customerProfileHasPhoto,
    customerProfilePhotoFile,
    hairPhotoFile,
    stylePhotoFile,
  ])

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const result = reader.result

        if (typeof result !== 'string') {
          reject(new Error(copy.encodeFailure))
          return
        }

        const base64 = result.split(',')[1]

        if (!base64) {
          reject(new Error(copy.imageDataMissing))
          return
        }

        resolve(base64)
      }

      reader.onerror = () => {
        reject(new Error(copy.imageReadFailure))
      }

      reader.readAsDataURL(file)
    })

  const parseResponseJson = useCallback(async <T,>(response: Response) => {
    const rawText = await response.text()

    if (!rawText.trim()) {
      return null
    }

    try {
      return JSON.parse(rawText) as T
    } catch {
      throw new Error(copy.responseParseFailure)
    }
  }, [copy.responseParseFailure])

  const canvasToBlob = (
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number,
  ) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error(copy.imageReadFailure))
          return
        }

        resolve(blob)
      }, type, quality)
    })

  const loadImageFromFile = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const image = new Image()

      image.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(image)
      }

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error(copy.imageReadFailure))
      }

      image.src = objectUrl
    })

  const compressImageForUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return file
    }

    const image = await loadImageFromFile(file)
    const scale = Math.min(
      1,
      MAX_UPLOAD_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))

    if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) {
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')

    if (!context) {
      return file
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    let quality = 0.88
    let blob = await canvasToBlob(canvas, 'image/jpeg', quality)

    while (blob.size > MAX_UPLOAD_BYTES && quality > 0.56) {
      quality -= 0.08
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }

    if (blob.size >= file.size && scale === 1) {
      return file
    }

    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, '') || 'upload'}.jpg`,
      {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      },
    )
  }

  const clearPurchaseState = () => {
    window.localStorage.removeItem(PURCHASE_VERIFIED_KEY)
    window.localStorage.removeItem(PURCHASE_ORDER_ID_KEY)
    window.localStorage.removeItem(PURCHASE_EMAIL_KEY)
    setIsPurchaseVerified(false)
    setPurchaseOrderId('')
    setPurchaseEmail('')
  }

  const persistPendingCheckout = (payload: PendingCheckoutPayload) => {
    window.localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(payload))
  }

  const readPendingCheckout = (): PendingCheckoutPayload | null => {
    const rawPayload = window.localStorage.getItem(PENDING_CHECKOUT_KEY)

    if (!rawPayload) {
      return null
    }

    try {
      return JSON.parse(rawPayload) as PendingCheckoutPayload
    } catch {
      window.localStorage.removeItem(PENDING_CHECKOUT_KEY)
      return null
    }
  }

  const clearPendingCheckout = () => {
    window.localStorage.removeItem(PENDING_CHECKOUT_KEY)
  }

  const persistPendingEntryView = (nextView: ProtectedView) => {
    window.localStorage.setItem(PENDING_ENTRY_VIEW_KEY, nextView)
  }

  const readPendingEntryView = (): ProtectedView | null => {
    const rawValue = window.localStorage.getItem(PENDING_ENTRY_VIEW_KEY)

    if (rawValue === 'style' || rawValue === 'hair') {
      return rawValue
    }

    return null
  }

  const clearPendingEntryView = () => {
    window.localStorage.removeItem(PENDING_ENTRY_VIEW_KEY)
  }

  const persistPendingCheckoutSource = (source: CheckoutSource) => {
    window.localStorage.setItem(PENDING_CHECKOUT_SOURCE_KEY, source)
  }

  const readPendingCheckoutSource = (): CheckoutSource | null => {
    const rawValue = window.localStorage.getItem(PENDING_CHECKOUT_SOURCE_KEY)

    if (rawValue === 'style' || rawValue === 'hair' || rawValue === 'subscription') {
      return rawValue
    }

    return null
  }

  const clearPendingCheckoutSource = () => {
    window.localStorage.removeItem(PENDING_CHECKOUT_SOURCE_KEY)
  }

  const trackAnalyticsOnce = (
    eventKey: string,
    eventName: string,
    params: Record<string, unknown>,
  ) => {
    const storageKey = `analytics_once:${eventKey}`

    if (window.sessionStorage.getItem(storageKey) === 'true') {
      return
    }

    window.sessionStorage.setItem(storageKey, 'true')
    trackEvent(eventName, params)
  }

  const handleGoogleSignIn = async () => {
    if (!hasAuthConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      return
    }

    if (!supabaseClient) {
      setAuthFeedback('error', copy.authConfigMissing)
      return
    }

    try {
      setIsAuthSubmitting(true)
      setAuthFeedback('fallback', copy.authGoogleRedirecting)

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      setAuthFeedback(
        'error',
        error instanceof Error ? error.message : copy.authSessionRequired,
      )
      setIsAuthSubmitting(false)
    }
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasAuthConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      return
    }

    if (!supabaseClient) {
      setAuthFeedback('error', copy.authConfigMissing)
      return
    }

    const trimmedEmail = authEmail.trim()

    if (!trimmedEmail) {
      setAuthFeedback('error', copy.authEmailRequired)
      return
    }

    if (!authPassword.trim()) {
      setAuthFeedback('error', copy.authPasswordRequired)
      return
    }

    if (authMode === 'sign-up' && authPassword !== authPasswordConfirm) {
      setAuthFeedback('error', copy.authPasswordsMismatch)
      return
    }

    try {
      setIsAuthSubmitting(true)
      setAuthMessage('')

      if (authMode === 'sign-up') {
        const { error } = await supabaseClient.auth.signUp({
          email: trimmedEmail,
          password: authPassword,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })

        if (error) {
          throw error
        }

        setAuthFeedback('success', copy.authSignUpSuccess)
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: trimmedEmail,
          password: authPassword,
        })

        if (error) {
          throw error
        }

        setAuthFeedback('success', copy.authSignInSuccess)
      }
    } catch (error) {
      setAuthFeedback(
        'error',
        error instanceof Error ? error.message : copy.authSessionRequired,
      )
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  const handleAuthSignOut = async () => {
    if (!supabaseClient) {
      return
    }

    try {
      setIsAuthSubmitting(true)
      setAuthMessage('')
      clearPendingCheckout()
      clearPendingEntryView()
      clearPurchaseState()
      setAuthPassword('')
      setAuthPasswordConfirm('')
      setAccountPassword('')
      setAccountPasswordConfirm('')
      setAccountPasswordNonce('')
      setOpenAccountSection(null)
      setPasswordMessage('')
      setDeleteConfirmationEmail('')
      setDeleteMessage('')
      resetCustomerProfileState()
      await supabaseClient.auth.signOut()
      setView('account')
      setAuthMode('sign-in')
    } catch (error) {
      setAuthFeedback(
        'error',
        error instanceof Error ? error.message : copy.authSessionRequired,
      )
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  const handlePasswordReauthentication = async () => {
    if (!hasAuthConfig) {
      setPasswordFeedback('error', copy.authConfigMissing)
      return
    }

    if (!supabaseClient || !isAuthenticated) {
      setPasswordFeedback('error', copy.authSessionRequired)
      return
    }

    try {
      setIsPasswordNonceSending(true)
      setPasswordMessage('')

      const { error } = await supabaseClient.auth.reauthenticate()

      if (error) {
        throw error
      }

      setPasswordFeedback('success', copy.accountPasswordNonceSent)
    } catch (error) {
      setPasswordFeedback(
        'error',
        error instanceof Error ? error.message : copy.authSessionRequired,
      )
    } finally {
      setIsPasswordNonceSending(false)
    }
  }

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasAuthConfig) {
      setPasswordFeedback('error', copy.authConfigMissing)
      return
    }

    if (!supabaseClient || !isAuthenticated) {
      setPasswordFeedback('error', copy.authSessionRequired)
      return
    }

    if (!accountPassword) {
      setPasswordFeedback('error', copy.authPasswordRequired)
      return
    }

    if (accountPassword.length < 6) {
      setPasswordFeedback('error', copy.accountPasswordMinLength)
      return
    }

    if (accountPassword !== accountPasswordConfirm) {
      setPasswordFeedback('error', copy.authPasswordsMismatch)
      return
    }

    try {
      setIsPasswordUpdating(true)
      setPasswordMessage('')

      const { error } = await supabaseClient.auth.updateUser({
        password: accountPassword,
        ...(accountPasswordNonce.trim() ? { nonce: accountPasswordNonce.trim() } : {}),
      })

      if (error) {
        throw error
      }

      setAccountPassword('')
      setAccountPasswordConfirm('')
      setAccountPasswordNonce('')
      setPasswordFeedback('success', copy.accountPasswordUpdated)
    } catch (error) {
      setPasswordFeedback(
        'error',
        error instanceof Error ? error.message : copy.authSessionRequired,
      )
    } finally {
      setIsPasswordUpdating(false)
    }
  }

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasAuthConfig) {
      setDeleteFeedback('error', copy.authConfigMissing)
      return
    }

    if (!supabaseClient || !isAuthenticated || !authenticatedEmail) {
      setDeleteFeedback('error', copy.authSessionRequired)
      return
    }

    if (deleteConfirmationEmail.trim().toLowerCase() !== authenticatedEmail.trim().toLowerCase()) {
      setDeleteFeedback('error', copy.accountDeleteMismatch)
      return
    }

    if (!window.confirm(copy.accountDeletePrompt)) {
      return
    }

    try {
      setIsAccountDeleting(true)
      setDeleteMessage('')

      const response = await fetchWithAuth('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredLocale,
        }),
      })

      const data = await parseResponseJson<DeleteAccountResponse>(response)

      if (!response.ok) {
        throw new Error(data?.error ?? copy.accountDeleteError)
      }

      clearPendingCheckout()
      clearPendingEntryView()
      clearPurchaseState()
      setDeleteConfirmationEmail('')
      setAccountPassword('')
      setAccountPasswordConfirm('')
      setAccountPasswordNonce('')
      setPasswordMessage('')
      setDeleteMessage('')
      await supabaseClient.auth.signOut({ scope: 'local' })
      setAuthSession(null)
      setAuthMode('sign-in')
      setView('account')
      setAuthFeedback('success', data?.message ?? copy.accountDeleteSuccess)
    } catch (error) {
      setDeleteFeedback(
        'error',
        error instanceof Error ? error.message : copy.accountDeleteError,
      )
    } finally {
      setIsAccountDeleting(false)
    }
  }

  const resolveAccessToken = useCallback(async () => {
    if (!hasAuthConfig) {
      throw new Error(copy.authConfigMissing)
    }

    const currentToken = authSession?.access_token?.trim()

    if (currentToken) {
      return currentToken
    }

    if (!supabaseClient) {
      throw new Error(copy.authConfigMissing)
    }

    const { data, error } = await supabaseClient.auth.getSession()

    if (error) {
      throw error
    }

    const nextToken = data.session?.access_token?.trim()

    if (!nextToken) {
      throw new Error(copy.authSessionRequired)
    }

    return nextToken
  }, [
    authSession?.access_token,
    copy.authConfigMissing,
    copy.authSessionRequired,
    hasAuthConfig,
    supabaseClient,
  ])

  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const accessToken = await resolveAccessToken()
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)

    return fetch(input, {
      ...init,
      headers,
    })
  }, [resolveAccessToken])

  const loadCustomerProfilePhoto = useCallback(
    async (cacheKey?: string) => {
      const response = await fetchWithAuth(
        '/api/customer-profile-photo?preferred_locale=' +
          encodeURIComponent(preferredLocale) +
          '&v=' +
          encodeURIComponent(cacheKey || ''),
      )

      if (!response.ok) {
        const data = await parseResponseJson<CustomerProfileResponse>(response)
        throw new Error(data?.error ?? copy.accountProfilePhotoLoadError)
      }

      const blob = await response.blob()

      if (!blob.size) {
        throw new Error(copy.accountProfilePhotoLoadError)
      }

      setCustomerProfilePhotoPreview(URL.createObjectURL(blob))
    },
    [
      copy.accountProfilePhotoLoadError,
      fetchWithAuth,
      parseResponseJson,
      preferredLocale,
    ],
  )

  const applyCustomerProfile = useCallback(
    async (profile: CustomerProfileRecord | null) => {
      setCustomerProfileHeight(profile ? String(profile.heightCm) : '')
      setCustomerProfileWeight(profile ? String(profile.weightKg) : '')
      setCustomerProfileLocationQuery(profile?.locationQuery ?? '')
      setCustomerProfileLocationName(profile?.locationName ?? '')
      setCustomerProfileTimezone(profile?.timezone ?? '')
      setCustomerProfileLatitude(profile?.latitude ?? null)
      setCustomerProfileLongitude(profile?.longitude ?? null)
      setCustomerProfileHasPhoto(Boolean(profile?.hasPhoto))
      setCustomerProfilePhotoFile(null)
      setCustomerProfilePhotoName(
        profile?.hasPhoto ? copy.accountProfilePhotoSaved : copy.noImageSelected,
      )
      setCustomerProfileUpdatedAt(profile?.updatedAt ?? '')
      setCustomerProfileNextDeliveryAt(profile?.nextDeliveryAtUtc ?? '')
      setCustomerProfileLastDeliveryLocalDate(
        profile?.lastDailySentLocalDate ?? '',
      )
      setCustomerDailyEmailEnabled(profile?.dailyEmailEnabled ?? true)
      setCustomerProfilePhotoPreview('')

      if (profile) {
        setHeight((current) => (current.trim() ? current : String(profile.heightCm)))
        setWeight((current) => (current.trim() ? current : String(profile.weightKg)))
      }

      if (!profile?.hasPhoto) {
        return
      }

      await loadCustomerProfilePhoto(profile.updatedAt)
    },
    [
      copy.accountProfilePhotoSaved,
      copy.noImageSelected,
      loadCustomerProfilePhoto,
    ],
  )

  const loadCustomerProfile = useCallback(
    async ({ suppressErrors = false }: { suppressErrors?: boolean } = {}) => {
      if (!hasAuthConfig || isAuthLoading || !isAuthenticated) {
        return null
      }

      try {
        setIsCustomerProfileLoading(true)

        if (!suppressErrors) {
          setCustomerProfileMessage('')
        }

        const response = await fetchWithAuth(
          '/api/customer-profile?preferred_locale=' +
            encodeURIComponent(preferredLocale),
        )
        const data = await parseResponseJson<CustomerProfileResponse>(response)

        if (!response.ok) {
          throw new Error(data?.error ?? copy.accountProfileLoadError)
        }

        await applyCustomerProfile(data?.profile ?? null)
        return data?.profile ?? null
      } catch (error) {
        if (!suppressErrors) {
          setCustomerProfileFeedback(
            'error',
            error instanceof Error
              ? error.message
              : copy.accountProfileLoadError,
          )
        }

        return null
      } finally {
        setIsCustomerProfileLoading(false)
      }
    },
    [
      applyCustomerProfile,
      copy.accountProfileLoadError,
      fetchWithAuth,
      hasAuthConfig,
      isAuthenticated,
      isAuthLoading,
      parseResponseJson,
      preferredLocale,
    ],
  )

  const handleCustomerProfileLocationQueryChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextValue = event.target.value
    setCustomerProfileLocationQuery(nextValue)
    setCustomerProfileLocationName('')
    setCustomerProfileTimezone('')
    setCustomerProfileLatitude(null)
    setCustomerProfileLongitude(null)
    setCustomerProfileMessage('')
  }

  const handleUseCurrentLocation = async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setCustomerProfileFeedback('error', copy.accountProfileLocationAutoUnsupported)
      return
    }

    const browserTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || ''

    if (!browserTimeZone) {
      setCustomerProfileFeedback('error', copy.accountProfileLocationAutoFailed)
      return
    }

    try {
      setIsLocationDetecting(true)
      setCustomerProfileMessage('')

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300000,
        })
      })

      const latitude = Number(position.coords.latitude.toFixed(6))
      const longitude = Number(position.coords.longitude.toFixed(6))
      const currentLocationLabel = copy.accountProfileCurrentLocation

      setCustomerProfileLatitude(latitude)
      setCustomerProfileLongitude(longitude)
      setCustomerProfileTimezone(browserTimeZone)
      setCustomerProfileLocationName(currentLocationLabel)
      setCustomerProfileLocationQuery(currentLocationLabel)
      setCustomerProfileFeedback('success', copy.accountProfileLocationAutoSuccess)
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error && 'code' in error
          ? Number((error as { code?: unknown }).code)
          : 0

      setCustomerProfileFeedback(
        'error',
        errorCode === 1
          ? copy.accountProfileLocationAutoDenied
          : copy.accountProfileLocationAutoFailed,
      )
    } finally {
      setIsLocationDetecting(false)
    }
  }

  const handleCustomerProfilePhotoChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setCustomerProfileFeedback('error', copy.imageOnlyFailure)
      return
    }

    setCustomerProfilePhotoFile(file)
    setCustomerProfilePhotoName(file.name)
    setCustomerProfileHasPhoto(true)
    setCustomerProfileMessage('')
    setCustomerProfilePhotoPreview(URL.createObjectURL(file))
  }

  const handleCustomerProfileSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    try {
      setIsCustomerProfileSaving(true)
      setCustomerProfileMessage('')

      const formData = new FormData()
      formData.set('heightCm', customerProfileHeight.trim())
      formData.set('weightKg', customerProfileWeight.trim())
      formData.set('locationQuery', customerProfileLocationQuery.trim())
      formData.set(
        'dailyEmailEnabled',
        customerDailyEmailEnabled ? 'true' : 'false',
      )
      formData.set('preferredLocale', preferredLocale)

      if (
        typeof customerProfileLatitude === 'number' &&
        typeof customerProfileLongitude === 'number' &&
        customerProfileTimezone.trim()
      ) {
        formData.set('latitude', String(customerProfileLatitude))
        formData.set('longitude', String(customerProfileLongitude))
        formData.set('timezone', customerProfileTimezone.trim())
        formData.set(
          'locationName',
          customerProfileLocationName.trim() ||
            customerProfileLocationQuery.trim() ||
            copy.accountProfileCurrentLocation,
        )
      }

      if (customerProfilePhotoFile) {
        const uploadFile = await compressImageForUpload(customerProfilePhotoFile)
        formData.set('photo', uploadFile)
      }

      const response = await fetchWithAuth(
        '/api/customer-profile?preferred_locale=' +
          encodeURIComponent(preferredLocale),
        {
          method: 'POST',
          body: formData,
        },
      )
      const data = await parseResponseJson<CustomerProfileResponse>(response)

      if (!response.ok) {
        throw new Error(data?.error ?? copy.accountProfileSaveError)
      }

      await applyCustomerProfile(data?.profile ?? null)
      setCustomerProfileFeedback(
        'success',
        data?.message ?? copy.accountProfileSaveAction,
      )
    } catch (error) {
      setCustomerProfileFeedback(
        'error',
        error instanceof Error ? error.message : copy.accountProfileSaveError,
      )
    } finally {
      setIsCustomerProfileSaving(false)
    }
  }

  const syncBillingAccess = useCallback(
    async ({
      suppressErrors = false,
      preservePendingState = false,
    }: {
      suppressErrors?: boolean
      preservePendingState?: boolean
    } = {}): Promise<BillingAccessResponse | null> => {
      if (!hasAuthConfig || isAuthLoading || !isAuthenticated) {
        return null
      }

      try {
        const response = await fetchWithAuth(
          `/api/customer-access?preferred_locale=${encodeURIComponent(preferredLocale)}`,
        )
        const rawText = await response.text()
        let data: BillingAccessResponse | null = null

        if (rawText.trim()) {
          try {
            data = JSON.parse(rawText) as BillingAccessResponse
          } catch {
            throw new Error(copy.responseParseFailure)
          }
        }

        if (!response.ok) {
          throw new Error(data?.error ?? copy.checkoutError)
        }

        const hasAccess = Boolean(data?.hasAccess)
        const nextPhase = normalizeBillingAccessPhase(
          data?.subscriptionStatus,
          hasAccess,
        )
        const nextEmail = data?.customerEmail?.trim() || authenticatedEmail

        applyBillingSnapshot(data)
        setCheckoutErrorMessage('')

        if (hasAccess) {
          setCheckoutStatus('verified')
          setCheckoutStatusMessage(
            nextPhase === 'trialing'
              ? copy.checkoutTrialBody
              : copy.checkoutVerifiedBody,
          )
        } else if (!preservePendingState) {
          setCheckoutStatus('idle')
          setCheckoutStatusMessage('')
        }

        return {
          ...data,
          hasAccess,
          subscriptionStatus: nextPhase,
          customerEmail: nextEmail,
        }
      } catch (error) {
        if (!suppressErrors) {
          setCheckoutErrorMessage(
            error instanceof Error ? error.message : copy.checkoutError,
          )
        }

        return null
      }
    },
    [
      applyBillingSnapshot,
      authenticatedEmail,
      copy.checkoutError,
      copy.checkoutTrialBody,
      copy.checkoutVerifiedBody,
      copy.responseParseFailure,
      fetchWithAuth,
      hasAuthConfig,
      isAuthenticated,
      isAuthLoading,
      preferredLocale,
    ],
  )

  const handleOpenSubscriptionPortal = async () => {
    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    try {
      setIsSubscriptionPortalLoading(true)
      setSubscriptionActionMessage('')

      const response = await fetchWithAuth('/api/customer-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredLocale,
          returnUrl: window.location.origin + window.location.pathname + '#account',
        }),
      })

      const data = await parseResponseJson<CustomerPortalSessionResponse>(response)

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? copy.checkoutError)
      }

      if (data.customerEmail?.trim()) {
        setBillingCustomerEmail(data.customerEmail.trim())
      }

      trackEvent('subscription_portal_opened', {
        subscription_status: billingAccessPhase,
        ui_locale: preferredLocale,
      })

      window.location.href = data.url
    } catch (error) {
      setSubscriptionActionTone('error')
      setSubscriptionActionMessage(
        error instanceof Error ? error.message : copy.checkoutError,
      )
    } finally {
      setIsSubscriptionPortalLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    if (!billingSubscriptionId) {
      setSubscriptionActionTone('error')
      setSubscriptionActionMessage(copy.accountSubscriptionSummaryLocked)
      return
    }

    if (!window.confirm(copy.accountSubscriptionCancelPrompt)) {
      return
    }

    trackEvent('subscription_cancellation_requested', {
      subscription_status: billingAccessPhase,
      ui_locale: preferredLocale,
    })

    try {
      setIsSubscriptionCanceling(true)
      setSubscriptionActionMessage('')

      const response = await fetchWithAuth('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredLocale,
        }),
      })

      const data = await parseResponseJson<CancelSubscriptionResponse>(response)

      if (!response.ok) {
        throw new Error(data?.error ?? copy.accountSubscriptionCancelNote)
      }

      applyBillingSnapshot(data)
      setSubscriptionActionTone('success')
      setSubscriptionActionMessage(
        data?.message ?? copy.accountSubscriptionCancelNote,
      )
      trackEvent('subscription_cancellation_scheduled', {
        subscription_status: data?.subscriptionStatus ?? billingAccessPhase,
        ui_locale: preferredLocale,
      })
      setCheckoutStatus(data?.hasAccess ? 'verified' : 'idle')
      setCheckoutStatusMessage(
        data?.hasAccess ? copy.accountSubscriptionCancelNote : '',
      )
    } catch (error) {
      setSubscriptionActionTone('error')
      setSubscriptionActionMessage(
        error instanceof Error ? error.message : copy.accountSubscriptionCancelNote,
      )
    } finally {
      setIsSubscriptionCanceling(false)
    }
  }

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const updateStylePhoto = (file: File | null) => {
    if (!file) {
      setStylePhotoFile(null)
      setStylePhotoName(copy.noImageSelected)

      if (stylePhotoPreview) {
        URL.revokeObjectURL(stylePhotoPreview)
      }

      setStylePhotoPreview('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setStyleErrorMessage(copy.imageOnlyFailure)
      return
    }

    if (stylePhotoPreview) {
      URL.revokeObjectURL(stylePhotoPreview)
    }

    setStylePhotoFile(file)
    setStylePhotoName(file.name)
    setStylePhotoPreview(URL.createObjectURL(file))
    setStyleErrorMessage('')
  }

  const updateHairPhoto = (file: File | null) => {
    if (!file) {
      setHairPhotoFile(null)
      setHairPhotoName(copy.noImageSelected)

      if (hairPhotoPreview) {
        URL.revokeObjectURL(hairPhotoPreview)
      }

      setHairPhotoPreview('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setHairErrorMessage(copy.imageOnlyFailure)
      return
    }

    if (hairPhotoPreview) {
      URL.revokeObjectURL(hairPhotoPreview)
    }

    setHairPhotoFile(file)
    setHairPhotoName(file.name)
    setHairPhotoPreview(URL.createObjectURL(file))
    setHairErrorMessage('')
  }

  const runStyleGeneration = async (
    payload: StyleGenerationPayload,
    deliveryEmail = purchaseEmail || authenticatedEmail,
  ) => {
    try {
      setIsStyleLoading(true)
      setStyleErrorMessage('')
      setStyleReport('')
      setStyleResultImage('')
      setStylePrompt('')
      setStyleNote('')
      setStyleCopyMessage('')
      setStyleAssetMessage('')
      setStyleAssetAction('idle')
      setStyleEmailMessage('')
      setStyleAdoptMessage('')
      setView('style')
      setStylePhotoPreview(payload.previewUrl)
      setStylePhotoName(payload.photoName)
      setHeight(payload.height)
      setWeight(payload.weight)
      trackEvent('report_generation_started', {
        report_kind: 'style',
        ui_locale: preferredLocale,
      })

      const response = await fetchWithAuth('/api/style-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          height: payload.height,
          weight: payload.weight,
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
          preferredLocale,
          orderId: purchaseOrderId,
        }),
      })

      const data = await parseResponseJson<StyleReportResponse>(response)

      if (!response.ok || !data?.report) {
        if (data?.refundRequested) {
          clearPurchaseState()
        }
        throw new Error(data?.error ?? copy.styleSubmitError)
      }

      setStyleReport(data.report)
      setStylePrompt(data.prompt ?? '')
      setStyleNote(data.note ?? '')

      const styleImageDataUrl =
        data.imageBase64 && data.mimeType
          ? `data:${data.mimeType};base64,${data.imageBase64}`
          : ''

      if (data.imageBase64 && data.mimeType) {
        setStyleResultImage(styleImageDataUrl)
      }

      trackEvent('report_generated', {
        report_kind: 'style',
        result_mode: styleImageDataUrl ? 'image_and_text' : 'text_only',
        ui_locale: preferredLocale,
      })

      void requestReportEmail({
        kind: 'style',
        toEmail: deliveryEmail,
        content: data.report,
        prompt: data.prompt ?? '',
        note: data.note ?? '',
        imageDataUrl: styleImageDataUrl,
        setSending: setIsStyleEmailSending,
        setMessage: setStyleEmailMessage,
        setTone: setStyleEmailTone,
      })
    } catch (error) {
      trackEvent('report_generation_failed', {
        report_kind: 'style',
        ui_locale: preferredLocale,
      })
      const fallback = copy.styleFetchError
      setStyleErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsStyleLoading(false)
    }
  }

  const runHairGeneration = async (
    payload: HairGenerationPayload,
    deliveryEmail = purchaseEmail || authenticatedEmail,
  ) => {
    try {
      setIsHairLoading(true)
      setHairErrorMessage('')
      setHairDescription('')
      setHairResultImage('')
      setHairPrompt('')
      setHairNote('')
      setHairCopyMessage('')
      setHairAssetMessage('')
      setHairAssetAction('idle')
      setHairEmailMessage('')
      setView('hair')
      setHairPhotoPreview(payload.previewUrl)
      setHairPhotoName(payload.photoName)
      trackEvent('report_generation_started', {
        report_kind: 'hair',
        ui_locale: preferredLocale,
      })

      const response = await fetchWithAuth('/api/hairstyle-grid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
          preferredLocale,
          orderId: purchaseOrderId,
        }),
      })

      const data = await parseResponseJson<HairRecommendationResponse>(response)

      if (!response.ok || !data?.description) {
        if (data?.refundRequested) {
          clearPurchaseState()
        }
        throw new Error(data?.error ?? copy.hairSubmitError)
      }

      setHairDescription(data.description)
      setHairNote(data.note ?? '')
      setHairPrompt(data.prompt ?? '')

      const hairImageDataUrl =
        data.mode === 'image' && data.imageBase64 && data.mimeType
          ? `data:${data.mimeType};base64,${data.imageBase64}`
          : ''

      if (data.mode === 'image' && data.imageBase64 && data.mimeType) {
        setHairResultImage(hairImageDataUrl)
      }

      trackEvent('report_generated', {
        report_kind: 'hair',
        result_mode: data.mode === 'image' ? 'image_grid' : 'prompt_only',
        ui_locale: preferredLocale,
      })

      void requestReportEmail({
        kind: 'hair',
        toEmail: deliveryEmail,
        content: data.description,
        prompt: data.prompt ?? '',
        note: data.note ?? '',
        imageDataUrl: hairImageDataUrl,
        setSending: setIsHairEmailSending,
        setMessage: setHairEmailMessage,
        setTone: setHairEmailTone,
      })
    } catch (error) {
      trackEvent('report_generation_failed', {
        report_kind: 'hair',
        ui_locale: preferredLocale,
      })
      const fallback = copy.hairFetchError
      setHairErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsHairLoading(false)
    }
  }

  const resumePendingCheckout = useEffectEvent(
    async (
      pendingCheckout: PendingCheckoutPayload | null,
      deliveryEmail?: string,
    ) => {
      if (pendingCheckout?.kind === 'style') {
        await runStyleGeneration(pendingCheckout, deliveryEmail)
      }

      if (pendingCheckout?.kind === 'hair') {
        await runHairGeneration(pendingCheckout, deliveryEmail)
      }
    },
  )

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return
    }

    void loadCustomerProfile({
      suppressErrors: true,
    })
  }, [isAuthenticated, isAuthLoading, loadCustomerProfile])

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return
    }

    void syncBillingAccess({
      suppressErrors: true,
      preservePendingState: true,
    })
  }, [isAuthenticated, isAuthLoading, syncBillingAccess])

  const handleStyleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    if (!stylePhotoFile) {
      setStyleErrorMessage(copy.stylePhotoRequired)
      return
    }

    if (!height.trim() || !weight.trim()) {
      setStyleErrorMessage(copy.styleMetricsRequired)
      return
    }

    try {
      const uploadFile = await compressImageForUpload(stylePhotoFile)
      const imageBase64 = await readFileAsBase64(uploadFile)
      const payload: StyleGenerationPayload = {
        kind: 'style',
        height,
        weight,
        imageBase64,
        mimeType: uploadFile.type || 'image/jpeg',
        previewUrl: `data:${uploadFile.type || 'image/jpeg'};base64,${imageBase64}`,
        photoName: stylePhotoFile.name,
      }

      let deliveryEmail = purchaseEmail || authenticatedEmail
      let hasAccess = hasGenerationAccess

      if (!hasAccess) {
        const accessSnapshot = await syncBillingAccess({
          suppressErrors: true,
          preservePendingState: true,
        })

        hasAccess = Boolean(accessSnapshot?.hasAccess)
        deliveryEmail = accessSnapshot?.customerEmail || deliveryEmail
      }

      trackEvent('report_request_submitted', {
        report_kind: 'style',
        has_access: hasAccess,
        access_type: hasAccess ? analyticsAccessType : 'locked',
        ui_locale: preferredLocale,
      })

      if (!hasAccess) {
        persistPendingCheckout(payload)
        trackEvent('report_request_paywalled', {
          report_kind: 'style',
          entry_flow: 'style',
          ui_locale: preferredLocale,
        })
        await startCheckout('one_time', {
          source: 'style',
          onError: (message) => setStyleErrorMessage(message),
        })
        return
      }

      await runStyleGeneration(payload, deliveryEmail)
    } catch (error) {
      const fallback = copy.styleFetchError
      setStyleErrorMessage(error instanceof Error ? error.message : fallback)
    }
  }

  const handleHairSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    if (!hairPhotoFile) {
      setHairErrorMessage(copy.hairPhotoRequired)
      return
    }

    try {
      const uploadFile = await compressImageForUpload(hairPhotoFile)
      const imageBase64 = await readFileAsBase64(uploadFile)
      const payload: HairGenerationPayload = {
        kind: 'hair',
        imageBase64,
        mimeType: uploadFile.type || 'image/jpeg',
        previewUrl: `data:${uploadFile.type || 'image/jpeg'};base64,${imageBase64}`,
        photoName: hairPhotoFile.name,
      }

      let deliveryEmail = purchaseEmail || authenticatedEmail
      let hasAccess = hasGenerationAccess

      if (!hasAccess) {
        const accessSnapshot = await syncBillingAccess({
          suppressErrors: true,
          preservePendingState: true,
        })

        hasAccess = Boolean(accessSnapshot?.hasAccess)
        deliveryEmail = accessSnapshot?.customerEmail || deliveryEmail
      }

      trackEvent('report_request_submitted', {
        report_kind: 'hair',
        has_access: hasAccess,
        access_type: hasAccess ? analyticsAccessType : 'locked',
        ui_locale: preferredLocale,
      })

      if (!hasAccess) {
        persistPendingCheckout(payload)
        trackEvent('report_request_paywalled', {
          report_kind: 'hair',
          entry_flow: 'hair',
          ui_locale: preferredLocale,
        })
        await startCheckout('one_time', {
          source: 'hair',
          onError: (message) => setHairErrorMessage(message),
        })
        return
      }

      await runHairGeneration(payload, deliveryEmail)
    } catch (error) {
      const fallback = copy.hairFetchError
      setHairErrorMessage(error instanceof Error ? error.message : fallback)
    }
  }

  const renderInlineRichText = (line: string) => {
    const segments = line.split(/(\*\*.*?\*\*)/g).filter(Boolean)

    return segments.map((segment, index): ReactNode => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={`${segment}-${index}`}>{segment.slice(2, -2)}</strong>
      }

      return <span key={`${segment}-${index}`}>{segment}</span>
    })
  }

  const renderFormattedBlock = (line: string, index: number) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return <div className="rich-spacer" key={`space-${index}`} />
    }

    if (trimmed === '---') {
      return <div className="rich-divider" key={`divider-${index}`} />
    }

    if (trimmed.startsWith('### ')) {
      return (
        <h4 className="rich-heading" key={`heading-${index}`}>
          {renderInlineRichText(trimmed.slice(4))}
        </h4>
      )
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      return (
        <div className="rich-list-item" key={`list-${index}`}>
          <CheckIcon className="rich-list-icon" />
          <p>{renderInlineRichText(trimmed.slice(2))}</p>
        </div>
      )
    }

    return (
      <p className="rich-paragraph" key={`paragraph-${index}`}>
        {renderInlineRichText(trimmed)}
      </p>
    )
  }

  const copyText = async (
    text: string,
    onSuccess: (message: string) => void,
    onFailure: (message: string) => void,
  ) => {
    if (!text) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      onSuccess(copy.copySuccess)
    } catch {
      onFailure(copy.copyFailure)
    }
  }

  const copyStylePrompt = async () => {
    await copyText(stylePrompt, setStyleCopyMessage, setStyleCopyMessage)
  }

  const adoptStylePhotoForDailyBrief = async () => {
    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    if (!stylePhotoFile) {
      setStyleAdoptTone('error')
      setStyleAdoptMessage(copy.styleAdoptPhotoMissingImage)
      return
    }

    const nextHeight = customerProfileHeight.trim() || height.trim()
    const nextWeight = customerProfileWeight.trim() || weight.trim()
    const hasDirectLocation =
      typeof customerProfileLatitude === 'number' &&
      typeof customerProfileLongitude === 'number' &&
      customerProfileTimezone.trim()
    const nextLocationQuery = customerProfileLocationQuery.trim()

    if (!nextHeight || !nextWeight) {
      setStyleAdoptTone('error')
      setStyleAdoptMessage(copy.styleAdoptPhotoMissingMetrics)
      return
    }

    if (!hasDirectLocation && !nextLocationQuery) {
      setStyleAdoptTone('error')
      setStyleAdoptMessage(copy.styleAdoptPhotoMissingLocation)
      return
    }

    try {
      setIsStylePhotoAdopting(true)
      setStyleAdoptMessage('')

      const formData = new FormData()
      formData.set('heightCm', nextHeight)
      formData.set('weightKg', nextWeight)
      formData.set('locationQuery', nextLocationQuery)
      formData.set(
        'dailyEmailEnabled',
        customerDailyEmailEnabled ? 'true' : 'false',
      )
      formData.set('preferredLocale', preferredLocale)

      if (hasDirectLocation) {
        formData.set('latitude', String(customerProfileLatitude))
        formData.set('longitude', String(customerProfileLongitude))
        formData.set('timezone', customerProfileTimezone.trim())
        formData.set(
          'locationName',
          customerProfileLocationName.trim() ||
            customerProfileLocationQuery.trim() ||
            copy.accountProfileCurrentLocation,
        )
      }

      const uploadFile = await compressImageForUpload(stylePhotoFile)
      formData.set('photo', uploadFile)

      const response = await fetchWithAuth(
        '/api/customer-profile?preferred_locale=' +
          encodeURIComponent(preferredLocale),
        {
          method: 'POST',
          body: formData,
        },
      )
      const data = await parseResponseJson<CustomerProfileResponse>(response)

      if (!response.ok) {
        throw new Error(data?.error ?? copy.accountProfileSaveError)
      }

      await applyCustomerProfile(data?.profile ?? null)
      setStyleAdoptTone('success')
      setStyleAdoptMessage(data?.message ?? copy.styleAdoptPhotoSuccess)
    } catch (error) {
      setStyleAdoptTone('error')
      setStyleAdoptMessage(
        error instanceof Error ? error.message : copy.accountProfileSaveError,
      )
    } finally {
      setIsStylePhotoAdopting(false)
    }
  }

  const copyHairPrompt = async () => {
    await copyText(hairPrompt, setHairCopyMessage, setHairCopyMessage)
  }

  const requestReportEmail = async ({
    kind,
    toEmail,
    content,
    prompt,
    note,
    imageDataUrl,
    setSending,
    setMessage,
    setTone,
  }: {
    kind: 'style' | 'hair'
    toEmail?: string
    content: string
    prompt: string
    note: string
    imageDataUrl: string
    setSending: (value: boolean) => void
    setMessage: (value: string) => void
    setTone: (value: 'success' | 'error' | 'fallback') => void
  }) => {
    const deliveryEmail = toEmail?.trim() || purchaseEmail.trim()

    if (!deliveryEmail) {
      setTone('error')
      setMessage(copy.emailSendUnavailable)
      return
    }

    try {
      setSending(true)
      setMessage('')

      const response = await fetchWithAuth('/api/send-report-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          language,
          toEmail: deliveryEmail,
          content,
          prompt,
          note,
          imageDataUrl: imageDataUrl || undefined,
        }),
      })

      const data = await parseResponseJson<SendReportEmailResponse>(response)

      if (!response.ok || !data?.id) {
        throw new Error(data?.error ?? copy.emailSendUnavailable)
      }

      setTone('success')
      setMessage(data.message ?? '')
      trackEvent('report_email_sent', {
        report_kind: kind,
        ui_locale: preferredLocale,
      })
    } catch (error) {
      trackEvent('report_email_failed', {
        report_kind: kind,
        ui_locale: preferredLocale,
      })
      setTone('error')
      setMessage(
        error instanceof Error ? error.message : copy.emailSendUnavailable,
      )
    } finally {
      setSending(false)
    }
  }

  const createReportFile = async (
    element: HTMLElement | null,
    fileName: string,
  ) => {
    if (!element) {
      throw new Error(copy.reportImageExportError)
    }

    const { toBlob } = await import('html-to-image')
    const blob = await toBlob(element, {
      cacheBust: true,
      pixelRatio: 2,
    })

    if (!blob) {
      throw new Error(copy.reportImageExportError)
    }

    return new File([blob], fileName, { type: 'image/png' })
  }

  const downloadReportFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 0)
  }

  const saveReportImage = async ({
    captureRef,
    fileName,
    setAction,
    setMessage,
    setTone,
  }: {
    captureRef: React.RefObject<HTMLElement | null>
    fileName: string
    setAction: (action: 'idle' | 'save' | 'share') => void
    setMessage: (message: string) => void
    setTone: (tone: 'success' | 'error' | 'fallback') => void
  }) => {
    try {
      setAction('save')
      setMessage('')
      const file = await createReportFile(captureRef.current, fileName)
      downloadReportFile(file)
      setTone('success')
      setMessage(copy.reportImageSaveSuccess)
    } catch (error) {
      setTone('error')
      setMessage(
        error instanceof Error ? error.message : copy.reportImageExportError,
      )
    } finally {
      setAction('idle')
    }
  }

  const shareReportImage = async ({
    captureRef,
    fileName,
    shareTitle,
    setAction,
    setMessage,
    setTone,
  }: {
    captureRef: React.RefObject<HTMLElement | null>
    fileName: string
    shareTitle: string
    setAction: (action: 'idle' | 'save' | 'share') => void
    setMessage: (message: string) => void
    setTone: (tone: 'success' | 'error' | 'fallback') => void
  }) => {
    try {
      setAction('share')
      setMessage('')
      const file = await createReportFile(captureRef.current, fileName)

      if (
        typeof navigator.share !== 'function' ||
        (typeof navigator.canShare === 'function' &&
          !navigator.canShare({ files: [file] }))
      ) {
        throw new Error(copy.reportImageShareUnsupported)
      }

      await navigator.share({
        files: [file],
        title: shareTitle,
        text: shareTitle,
      })
      setTone('success')
      setMessage('')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessage('')
      } else {
        setTone('error')
        setMessage(
          error instanceof Error ? error.message : copy.reportImageExportError,
        )
      }
    } finally {
      setAction('idle')
    }
  }

  const saveStyleReportImage = async () => {
    await saveReportImage({
      captureRef: styleReportCaptureRef,
      fileName: 'style-report.png',
      setAction: setStyleAssetAction,
      setMessage: setStyleAssetMessage,
      setTone: setStyleAssetTone,
    })
  }

  const shareStyleReportImage = async () => {
    await shareReportImage({
      captureRef: styleReportCaptureRef,
      fileName: 'style-report.png',
      shareTitle: copy.styleReportShareTitle,
      setAction: setStyleAssetAction,
      setMessage: setStyleAssetMessage,
      setTone: setStyleAssetTone,
    })
  }

  const saveHairReportImage = async () => {
    await saveReportImage({
      captureRef: hairReportCaptureRef,
      fileName: 'hair-report.png',
      setAction: setHairAssetAction,
      setMessage: setHairAssetMessage,
      setTone: setHairAssetTone,
    })
  }

  const shareHairReportImage = async () => {
    await shareReportImage({
      captureRef: hairReportCaptureRef,
      fileName: 'hair-report.png',
      shareTitle: copy.hairReportShareTitle,
      setAction: setHairAssetAction,
      setMessage: setHairAssetMessage,
      setTone: setHairAssetTone,
    })
  }

  const beginProtectedEntry = async (targetView: ProtectedView) => {
    trackEvent('select_item', {
      item_list_id: HOME_ITEM_LIST_ID,
      item_list_name: HOME_ITEM_LIST_NAME,
      items: [buildFeatureItem(targetView)],
      entry_flow: targetView,
      access_type: analyticsAccessType,
      ui_locale: preferredLocale,
    })

    if (!hasAuthConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      setView('account')
      return
    }

    if (isAuthLoading) {
      setAuthFeedback('fallback', copy.authLoading)
      setView('account')
      return
    }

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('account')
      return
    }

    if (hasGenerationAccess) {
      setView(targetView)
      return
    }

    const accessSnapshot = await syncBillingAccess({
      suppressErrors: true,
      preservePendingState: true,
    })

    if (accessSnapshot?.hasAccess) {
      setView(targetView)
      return
    }

    clearPendingCheckout()
    persistPendingEntryView(targetView)
    await startCheckout('one_time', {
      source: targetView,
      onError: (message) => {
        if (targetView === 'style') {
          setStyleErrorMessage(message)
        } else {
          setHairErrorMessage(message)
        }
        setView(targetView)
      },
    })
  }

  const startCheckout = async (
    checkoutKind: CheckoutKind,
    options?: {
      onError?: (message: string) => void
      source?: CheckoutSource
    },
  ) => {
    if (!hasAuthConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      setView('account')
      return
    }

    if (isAuthLoading) {
      setAuthFeedback('fallback', copy.authLoading)
      setView('account')
      return
    }

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authCheckoutRequired)
      setView('account')
      return
    }

    try {
      setIsCheckoutLoading(true)
      setActiveCheckoutKind(checkoutKind)

      if (options?.source) {
        persistPendingCheckoutSource(options.source)
      }

      if (checkoutKind === 'subscription') {
        setCheckoutErrorMessage('')
      }

      const response = await fetchWithAuth('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredLocale,
          currentUrl: window.location.href,
          checkoutKind,
        }),
      })

      const data = await parseResponseJson<CheckoutResponse>(response)
      const fallbackMessage =
        checkoutKind === 'subscription'
          ? copy.checkoutError
          : copy.purchaseCheckoutError

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? fallbackMessage)
      }

      const checkoutSource = options?.source ?? readPendingCheckoutSource()

      trackEvent('begin_checkout', {
        items: [
          buildCheckoutItem({
            checkoutKind,
            entryFlow:
              checkoutKind === 'subscription'
                ? 'subscription'
                : checkoutSource === 'style' || checkoutSource === 'hair'
                  ? checkoutSource
                  : null,
          }),
        ],
        checkout_kind: checkoutKind,
        entry_flow: checkoutSource ?? undefined,
        ui_locale: preferredLocale,
      })

      window.location.href = data.url
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : checkoutKind === 'subscription'
            ? copy.checkoutError
            : copy.purchaseCheckoutError

      if (checkoutKind === 'subscription') {
        setCheckoutErrorMessage(message)
      }

      if (options?.source) {
        clearPendingCheckoutSource()
      }

      options?.onError?.(message)
      setIsCheckoutLoading(false)
      setActiveCheckoutKind(null)
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href)
    const checkoutFlag = url.searchParams.get('checkout')
    const checkoutId = url.searchParams.get('checkout_id')

    if (checkoutFlag !== 'success' || !checkoutId) {
      return
    }

    if (isAuthLoading) {
      return
    }

    if (!isAuthenticated) {
      setCheckoutStatus('pending')
      setCheckoutStatusMessage(copy.authSessionRequired)
      return
    }

    let isCancelled = false

    const clearCheckoutQuery = () => {
      url.searchParams.delete('checkout')
      url.searchParams.delete('checkout_id')
      window.history.replaceState(null, '', url.toString())
    }

    const verifyCheckout = async () => {
      try {
        const response = await fetchWithAuth(
          `/api/checkout-status?checkout_id=${encodeURIComponent(checkoutId)}&preferred_locale=${encodeURIComponent(preferredLocale)}`,
        )
        const rawText = await response.text()
        const data = rawText.trim()
          ? (JSON.parse(rawText) as CheckoutStatusResponse)
          : null

        if (!response.ok || !data?.status) {
          throw new Error(data?.error ?? copy.checkoutError)
        }

        if (isCancelled) {
          return
        }

        if (data.checkoutKind === 'one_time') {
          if (data.status === 'succeeded' && data.hasAccess) {
            const pendingCheckout = readPendingCheckout()
            const pendingEntryView = readPendingEntryView()
            const pendingCheckoutSource = readPendingCheckoutSource()
            const entryFlow =
              pendingCheckout?.kind ?? pendingEntryView ?? pendingCheckoutSource ?? undefined
            const transactionId = data.orderId || checkoutId

            trackAnalyticsOnce(`purchase:${transactionId}`, 'purchase', {
              transaction_id: transactionId,
              items: [
                buildCheckoutItem({
                  checkoutKind: 'one_time',
                  entryFlow:
                    entryFlow === 'style' || entryFlow === 'hair' ? entryFlow : null,
                }),
              ],
              checkout_kind: 'one_time',
              entry_flow: entryFlow,
              access_type: 'one_time',
              ui_locale: preferredLocale,
            })

            setIsPurchaseVerified(true)
            setPurchaseOrderId(data.orderId ?? '')
            setPurchaseEmail(data.customerEmail ?? authenticatedEmail)
            clearPendingCheckout()
            clearPendingEntryView()
            clearPendingCheckoutSource()
            setActiveCheckoutKind(null)
            setIsCheckoutLoading(false)
            clearCheckoutQuery()

            if (pendingCheckout) {
              await resumePendingCheckout(
                pendingCheckout,
                data.customerEmail ?? authenticatedEmail,
              )
            } else if (pendingEntryView) {
              setView(pendingEntryView)
            }
          }

          return
        }

        const hasAccess = Boolean(data.hasAccess)
        const nextPhase = normalizeBillingAccessPhase(
          data.subscriptionStatus,
          hasAccess,
        )

        const transactionId = data.orderId || checkoutId

        if (data.status === 'succeeded' && hasAccess) {
          trackAnalyticsOnce(`purchase:${transactionId}`, 'purchase', {
            transaction_id: transactionId,
            items: [
              buildCheckoutItem({
                checkoutKind: 'subscription',
                entryFlow: 'subscription',
                subscriptionStatus: nextPhase === 'trialing' ? 'trialing' : 'active',
              }),
            ],
            checkout_kind: 'subscription',
            entry_flow: 'subscription',
            access_type:
              nextPhase === 'trialing' ? 'subscription_trial' : 'subscription_active',
            subscription_status: nextPhase,
            ui_locale: preferredLocale,
          })

          trackAnalyticsOnce(
            `${nextPhase === 'trialing' ? 'trial_started' : 'subscription_activated'}:${transactionId}`,
            nextPhase === 'trialing' ? 'trial_started' : 'subscription_activated',
            {
              subscription_status: nextPhase,
              ui_locale: preferredLocale,
            },
          )
        }

        applyBillingSnapshot(data)
        setActiveCheckoutKind(null)
        setIsCheckoutLoading(false)
        setCheckoutErrorMessage('')
        clearPendingCheckoutSource()
        clearCheckoutQuery()

        if (data.status === 'succeeded' && hasAccess) {
          setCheckoutStatus('verified')
          setCheckoutStatusMessage(
            nextPhase === 'trialing'
              ? copy.checkoutTrialBody
              : copy.checkoutVerifiedBody,
          )
          return
        }

        setCheckoutStatus('pending')
        setCheckoutStatusMessage(copy.checkoutPendingBody)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setActiveCheckoutKind(null)
        setIsCheckoutLoading(false)
        setCheckoutStatus('pending')
        setCheckoutStatusMessage(
          error instanceof Error ? error.message : copy.checkoutError,
        )
      }
    }

    void verifyCheckout()

    return () => {
      isCancelled = true
    }
  }, [
    applyBillingSnapshot,
    authenticatedEmail,
    copy.authSessionRequired,
    copy.checkoutError,
    copy.checkoutPendingBody,
    copy.checkoutTrialBody,
    copy.checkoutVerifiedBody,
    fetchWithAuth,
    isAuthenticated,
    isAuthLoading,
    preferredLocale,
  ])

  const activeNav = isPolicyView(view) ? 'account' : view
  const currentPolicy = isPolicyView(view) ? policyCopy?.[view] ?? null : null

  const renderPhotoField = ({
    label,
    helper,
    selectLabel,
    icon,
    isDragging,
    preview,
    name,
    onChange,
    onDragOver,
    onDragLeave,
    onDrop,
  }: {
    label: string
    helper: string
    selectLabel?: string
    icon: ReactNode
    isDragging: boolean
    preview: string
    name: string
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
    onDragOver: (event: DragEvent<HTMLLabelElement>) => void
    onDragLeave: (event: DragEvent<HTMLLabelElement>) => void
    onDrop: (event: DragEvent<HTMLLabelElement>) => void
  }) => (
    <label
      className={`upload-card ${isDragging ? 'is-dragging' : ''}`}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        accept="image/*"
        className="photo-input"
        onChange={onChange}
        type="file"
      />
      {preview ? (
        <div className="upload-preview-wrap">
          <img
            alt={language === 'ko' ? '업로드한 미리보기' : 'Uploaded preview'}
            className="upload-preview"
            src={preview}
          />
          <span className="upload-file-name">{name}</span>
        </div>
      ) : (
        <div className="upload-empty">
          <div className="upload-icon-badge">{icon}</div>
          <strong>{label}</strong>
          <p>{helper}</p>
          {selectLabel ? <span className="upload-select-button">{selectLabel}</span> : null}
        </div>
      )}
    </label>
  )

  const renderPromptUtility = ({
    title,
    description,
    prompt,
    note,
    copyMessage,
    onCopy,
  }: {
    title: string
    description: string
    prompt: string
    note: string
    copyMessage: string
    onCopy: () => Promise<void>
  }) => {
    if (!prompt) {
      return null
    }

    return (
      <section className="utility-card">
        <div className="utility-copy">
          <div className="utility-icon">
            <SparkleIcon className="utility-icon-svg" />
          </div>
          <div>
            <h4>{title}</h4>
            <p>{description}</p>
          </div>
        </div>
        {note ? <p className="status-message fallback">{note}</p> : null}
        {copyMessage ? <p className="status-message success">{copyMessage}</p> : null}
        <button className="utility-button" onClick={onCopy} type="button">
          <CopyIcon className="button-icon" />
          <span>{copy.utilityButton}</span>
        </button>
      </section>
    )
  }

  const renderEmailDeliveryCard = ({
    hasContent,
    message,
    tone,
    isSending,
  }: {
    hasContent: boolean
    message: string
    tone: 'success' | 'error' | 'fallback'
    isSending: boolean
  }) => {
    if (!hasContent) {
      return null
    }

    return (
      <section className="utility-card delivery-card">
        <div className="utility-copy">
          <div className="utility-icon">
            <SparkleIcon className="utility-icon-svg" />
          </div>
          <div>
            <h4>{copy.emailSendTitle}</h4>
            <p>{copy.emailSendDescription}</p>
          </div>
        </div>
        <p className="delivery-target">
          <strong>{copy.emailSendTarget}</strong>
          <span>{purchaseEmail || authenticatedEmail || copy.emailSendUnavailable}</span>
        </p>
        {isSending ? (
          <p className="status-message fallback">{copy.emailSendLoading}</p>
        ) : null}
        {message ? <p className={`status-message ${tone}`}>{message}</p> : null}
      </section>
    )
  }

  const renderAuthCard = () => {
    if (!hasAuthConfig) {
      return (
        <section className="utility-card auth-status-card">
          <div className="utility-copy">
            <div className="utility-icon">
              <PersonIcon className="utility-icon-svg" />
            </div>
            <div>
              <h4>{copy.authPanelTitle}</h4>
              <p>{copy.authPanelBody}</p>
            </div>
          </div>
          <p className="status-message error">{copy.authConfigMissing}</p>
        </section>
      )
    }

    if (isAuthLoading) {
      return (
        <section className="utility-card auth-status-card">
          <div className="utility-copy">
            <div className="utility-icon">
              <PersonIcon className="utility-icon-svg" />
            </div>
            <div>
              <h4>{copy.authPanelTitle}</h4>
              <p>{copy.authPanelBody}</p>
            </div>
          </div>
          <p className="status-message fallback">{copy.authLoading}</p>
        </section>
      )
    }

    if (isAuthenticated) {
      return (
        <section className="utility-card auth-status-card">
          <div className="utility-copy">
            <div className="utility-icon">
              <PersonIcon className="utility-icon-svg" />
            </div>
            <div>
              <h4>{copy.authSignedInTitle}</h4>
              <p>{copy.authSignedInBody}</p>
            </div>
          </div>
          <p className="delivery-target">
            <strong>{copy.authSignedInAs}</strong>
            <span>{authenticatedEmail || copy.authSessionRequired}</span>
          </p>
          {authMessage ? (
            <p className={`status-message ${authMessageTone}`}>{authMessage}</p>
          ) : null}
          <div className="auth-action-row">
            <button
              className="utility-button"
              disabled={isAuthSubmitting}
              onClick={() => {
                void handleAuthSignOut()
              }}
              type="button"
            >
              {copy.authSignOutAction}
            </button>
          </div>
        </section>
      )
    }

    return (
      <section className="panel auth-panel">
        <div className="report-card-header">
          <span className="panel-tag">{copy.authPanelTag}</span>
          <h3>{copy.authPanelTitle}</h3>
        </div>
        <p className="rich-paragraph">{copy.authPanelBody}</p>
        <div className="oauth-actions">
          <button
            className="utility-button oauth-button"
            disabled={isAuthSubmitting}
            onClick={() => {
              void handleGoogleSignIn()
            }}
            type="button"
          >
            <GoogleIcon className="oauth-provider-icon" />
            {copy.authGoogleAction}
          </button>
        </div>
        <div className="auth-divider">
          <span>{copy.authDivider}</span>
        </div>
        <div className="auth-mode-switch">
          <button
            className={`auth-mode-button ${authMode === 'sign-in' ? 'is-active' : ''}`}
            onClick={() => setAuthMode('sign-in')}
            type="button"
          >
            {copy.authSignInTab}
          </button>
          <button
            className={`auth-mode-button ${authMode === 'sign-up' ? 'is-active' : ''}`}
            onClick={() => setAuthMode('sign-up')}
            type="button"
          >
            {copy.authSignUpTab}
          </button>
        </div>
        <form className="stack-form" onSubmit={handleAuthSubmit}>
          <label className="metric-field">
            <span>{copy.authEmailLabel}</span>
            <div className="auth-input-wrap">
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder={copy.authEmailPlaceholder}
                type="email"
                value={authEmail}
              />
            </div>
          </label>

          <label className="metric-field">
            <span>{copy.authPasswordLabel}</span>
            <div className="auth-input-wrap">
              <input
                autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder={copy.authPasswordPlaceholder}
                type="password"
                value={authPassword}
              />
            </div>
          </label>

          {authMode === 'sign-up' ? (
            <label className="metric-field">
              <span>{copy.authPasswordConfirmLabel}</span>
              <div className="auth-input-wrap">
                <input
                  autoComplete="new-password"
                  onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                  placeholder={copy.authPasswordConfirmPlaceholder}
                  type="password"
                  value={authPasswordConfirm}
                />
              </div>
            </label>
          ) : null}

          {authMessage ? (
            <p className={`status-message ${authMessageTone}`}>{authMessage}</p>
          ) : null}

          <button className="action-button" disabled={isAuthSubmitting} type="submit">
            {isAuthSubmitting
              ? copy.authSubmitting
              : authMode === 'sign-in'
                ? copy.authSignInAction
                : copy.authSignUpAction}
          </button>
        </form>
      </section>
    )
  }

  const renderCheckoutStatusCard = () => {
    if (!isAuthenticated) {
      return null
    }

    return (
      <div
        className="billing-status-card"
        data-state={billingAccessPhase}
        data-cancel={billingSubscriptionCancelAtPeriodEnd ? 'true' : 'false'}
      >
        <div className="billing-status-head">
          <strong>{copy.accountSubscriptionPlanLabel}</strong>
          <span className="account-status-pill">{subscriptionStatusTitle}</span>
        </div>
        <p className="rich-paragraph">{subscriptionStatusBody}</p>
      </div>
    )
  }

  const renderAccountManagement = () => {
    if (!isAuthenticated) {
      return null
    }

    return (
      <>
        <section
          className="utility-card account-settings-card"
          data-open={openAccountSection === 'subscription' ? 'true' : 'false'}
        >
          <button
            aria-controls="account-subscription-panel"
            aria-expanded={openAccountSection === 'subscription'}
            className="account-accordion-button"
            onClick={() => toggleAccountSection('subscription')}
            type="button"
          >
            <div className="utility-copy">
              <div className="utility-icon">
                <SparkleIcon className="utility-icon-svg" />
              </div>
              <div>
                <h4>{copy.accountSubscriptionTitle}</h4>
                <p>{accountSubscriptionSummary}</p>
              </div>
            </div>
            <ChevronDownIcon className="account-accordion-chevron" />
          </button>
          <div className="account-accordion-panel" id="account-subscription-panel">
            <div className="account-accordion-panel-inner">
              <div className="account-accordion-content">
                {renderCheckoutStatusCard()}
                <p className="account-inline-note">{copy.accountSubscriptionBody}</p>
                <div className="account-info-grid">
                  <p className="delivery-target">
                    <strong>{copy.accountBillingEmailLabel}</strong>
                    <span>{linkedBillingEmail || copy.accountUnavailable}</span>
                  </p>
                  <p className="delivery-target">
                    <strong>{copy.accountSubscriptionPlanLabel}</strong>
                    <span>{accountSubscriptionSummary}</span>
                  </p>
                  {billingTrialEndsDisplay ? (
                    <p className="delivery-target">
                      <strong>{copy.accountSubscriptionTrialEndsLabel}</strong>
                      <span>{billingTrialEndsDisplay}</span>
                    </p>
                  ) : null}
                  {billingCurrentPeriodEndDisplay ? (
                    <p className="delivery-target">
                      <strong>{copy.accountSubscriptionCurrentPeriodEndLabel}</strong>
                      <span>{billingCurrentPeriodEndDisplay}</span>
                    </p>
                  ) : null}
                </div>
                <p className="account-inline-note">{copy.accountSubscriptionSeparateNote}</p>
                {subscriptionActionMessage ? (
                  <p className={`status-message ${subscriptionActionTone}`}>
                    {subscriptionActionMessage}
                  </p>
                ) : null}
                <div className="account-action-grid">
                  {billingAccessPhase === 'inactive' && checkoutStatus !== 'pending' ? (
                    <button
                      className="utility-button checkout-button"
                      disabled={isCheckoutLoading && activeCheckoutKind === 'subscription'}
                      onClick={() => {
                        trackEvent('select_promotion', {
                          promotion_id: SUBSCRIPTION_PROMOTION_ID,
                          promotion_name: SUBSCRIPTION_PROMOTION_NAME,
                          creative_slot: SUBSCRIPTION_PROMOTION_SLOT,
                          items: [buildSubscriptionPromotionItem()],
                          ui_locale: preferredLocale,
                        })
                        void startCheckout('subscription', { source: 'subscription' })
                      }}
                      type="button"
                    >
                      <SparkleIcon className="button-icon" />
                      <span>
                        {isCheckoutLoading && activeCheckoutKind === 'subscription'
                          ? copy.checkoutLoading
                          : copy.checkoutButton}
                      </span>
                    </button>
                  ) : null}
                  <button
                    className="utility-button"
                    disabled={isSubscriptionPortalLoading}
                    onClick={() => {
                      void handleOpenSubscriptionPortal()
                    }}
                    type="button"
                  >
                    {isSubscriptionPortalLoading
                      ? copy.accountSubscriptionManageLoading
                      : copy.accountSubscriptionManageAction}
                  </button>
                  {(billingAccessPhase === 'trialing' || billingAccessPhase === 'active') &&
                  !billingSubscriptionCancelAtPeriodEnd &&
                  billingSubscriptionId ? (
                    <button
                      className="utility-button"
                      disabled={isSubscriptionCanceling}
                      onClick={() => {
                        void handleCancelSubscription()
                      }}
                      type="button"
                    >
                      {isSubscriptionCanceling
                        ? copy.accountSubscriptionCancelLoading
                        : copy.accountSubscriptionCancelAction}
                    </button>
                  ) : null}
                </div>
                <p className="account-inline-note">{copy.accountSubscriptionManageHint}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="utility-card account-settings-card"
          data-open={openAccountSection === 'profile' ? 'true' : 'false'}
        >
          <button
            aria-controls="account-profile-panel"
            aria-expanded={openAccountSection === 'profile'}
            className="account-accordion-button"
            onClick={() => toggleAccountSection('profile')}
            type="button"
          >
            <div className="utility-copy">
              <div className="utility-icon">
                <PersonIcon className="utility-icon-svg" />
              </div>
              <div>
                <h4>{copy.accountProfileTitle}</h4>
                <p>{accountProfileSummary}</p>
              </div>
            </div>
            <ChevronDownIcon className="account-accordion-chevron" />
          </button>
          <div className="account-accordion-panel" id="account-profile-panel">
            <div className="account-accordion-panel-inner">
              <div className="account-accordion-content">
                <form className="stack-form" onSubmit={handleCustomerProfileSave}>
                  <section className="account-block-card">
                    <div className="account-block-heading">
                      <h5>{copy.accountProfileIdentityTitle}</h5>
                      <p>{copy.accountProfileBody}</p>
                    </div>
                    <div className="account-info-grid">
                      <p className="delivery-target">
                        <strong>{copy.accountEmailLabel}</strong>
                        <span>{authenticatedEmail || copy.accountUnavailable}</span>
                      </p>
                      <p className="delivery-target">
                        <strong>{copy.accountProviderLabel}</strong>
                        <span>{authProvider || copy.accountUnavailable}</span>
                      </p>
                      <p className="delivery-target">
                        <strong>{copy.accountCreatedAtLabel}</strong>
                        <span>{accountCreatedAt || copy.accountUnavailable}</span>
                      </p>
                    </div>
                  </section>

                  <section className="account-block-card">
                    <div className="account-block-heading">
                      <h5>{copy.accountProfileMetricsTitle}</h5>
                      <p>
                        {isCustomerProfileLoading
                          ? copy.accountProfileLoading
                          : copy.accountProfileSetupNote}
                      </p>
                    </div>
                    <label className="metric-field">
                      <span>{copy.accountProfileHeightLabel}</span>
                      <div className="auth-input-wrap">
                        <input
                          inputMode="numeric"
                          onChange={(event) => setCustomerProfileHeight(event.target.value)}
                          placeholder={copy.styleHeightPlaceholder}
                          type="number"
                          value={customerProfileHeight}
                        />
                      </div>
                    </label>
                    <label className="metric-field">
                      <span>{copy.accountProfileWeightLabel}</span>
                      <div className="auth-input-wrap">
                        <input
                          inputMode="decimal"
                          onChange={(event) => setCustomerProfileWeight(event.target.value)}
                          placeholder={copy.styleWeightPlaceholder}
                          step="0.1"
                          type="number"
                          value={customerProfileWeight}
                        />
                      </div>
                    </label>
                  </section>

                  <section className="account-block-card">
                    <div className="account-block-heading">
                      <h5>{copy.accountProfileDeliveryTitle}</h5>
                      <p>{copy.accountProfileDailyToggleHint}</p>
                    </div>
                    <label className="metric-field">
                      <span>{copy.accountProfileLocationLabel}</span>
                      <div className="auth-input-wrap">
                        <input
                          autoComplete="address-level2"
                          onChange={handleCustomerProfileLocationQueryChange}
                          placeholder={copy.accountProfileLocationPlaceholder}
                          type="text"
                          value={customerProfileLocationQuery}
                        />
                      </div>
                    </label>
                    <div className="auth-action-row account-inline-actions">
                      <button
                        className="utility-button"
                        disabled={isLocationDetecting || isCustomerProfileLoading || isCustomerProfileSaving}
                        onClick={() => {
                          void handleUseCurrentLocation()
                        }}
                        type="button"
                      >
                        {isLocationDetecting
                          ? copy.accountProfileLocationAutoLoading
                          : copy.accountProfileLocationAutoAction}
                      </button>
                    </div>
                    <div className="account-info-grid">
                      <p className="delivery-target">
                        <strong>{copy.accountProfileResolvedLocationLabel}</strong>
                        <span>{customerProfileLocationName || copy.accountUnavailable}</span>
                      </p>
                      <p className="delivery-target">
                        <strong>{copy.accountProfileTimezoneLabel}</strong>
                        <span>{customerProfileTimezone || copy.accountUnavailable}</span>
                      </p>
                      <p className="delivery-target">
                        <strong>{copy.accountProfileScheduleLabel}</strong>
                        <span>
                          {customerDailyEmailEnabled
                            ? copy.accountProfileScheduleEnabled
                            : copy.accountProfileSchedulePaused}
                        </span>
                      </p>
                      <p className="delivery-target">
                        <strong>{copy.accountProfileNextDeliveryLabel}</strong>
                        <span>
                          {customerProfileNextDeliveryDisplay ||
                            copy.accountProfileNextDeliveryEmpty}
                        </span>
                      </p>
                      <p className="delivery-target">
                        <strong>{copy.accountProfileLastDeliveryLabel}</strong>
                        <span>
                          {customerProfileLastDeliveryDisplay ||
                            copy.accountProfileLastDeliveryEmpty}
                        </span>
                      </p>
                    </div>
                    <label className="account-toggle-card">
                      <div className="account-toggle-copy">
                        <strong>{copy.accountProfileDailyToggleLabel}</strong>
                        <p>{copy.accountProfileDailyToggleHint}</p>
                      </div>
                      <input
                        checked={customerDailyEmailEnabled}
                        className="account-toggle-input"
                        onChange={(event) => setCustomerDailyEmailEnabled(event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  </section>

                  <section className="account-block-card">
                    <div className="account-block-heading">
                      <h5>{copy.accountProfilePhotoTitle}</h5>
                      <p>{copy.accountProfilePhotoHint}</p>
                    </div>
                    <div
                      className="account-profile-photo-layout"
                      data-photo-version={customerProfileUpdatedAt || 'none'}
                    >
                      <div className="account-profile-photo-frame">
                        {customerProfilePhotoPreview ? (
                          <img
                            alt={copy.accountProfilePhotoSaved}
                            src={customerProfilePhotoPreview}
                          />
                        ) : (
                          <div className="account-profile-photo-placeholder">
                            <span>{copy.accountProfilePhotoLabel}</span>
                          </div>
                        )}
                      </div>
                      <div className="account-profile-photo-copy">
                        <strong>{copy.accountProfilePhotoLabel}</strong>
                        <p>{copy.accountProfilePhotoHint}</p>
                        <label className="utility-button account-file-button">
                          <input
                            accept="image/*"
                            className="account-file-input"
                            onChange={handleCustomerProfilePhotoChange}
                            type="file"
                          />
                          <span>{copy.accountProfilePhotoAction}</span>
                        </label>
                        <p className="account-inline-note">{customerProfilePhotoName}</p>
                      </div>
                    </div>
                  </section>

                  {customerProfileMessage ? (
                    <p className={`status-message ${customerProfileMessageTone}`}>
                      {customerProfileMessage}
                    </p>
                  ) : null}
                  <button
                    className="action-button"
                    disabled={isCustomerProfileLoading || isCustomerProfileSaving}
                    type="submit"
                  >
                    {isCustomerProfileSaving
                      ? copy.accountProfileSaveLoading
                      : copy.accountProfileSaveAction}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section
          className="utility-card account-settings-card"
          data-open={openAccountSection === 'password' ? 'true' : 'false'}
        >
          <button
            aria-controls="account-password-panel"
            aria-expanded={openAccountSection === 'password'}
            className="account-accordion-button"
            onClick={() => toggleAccountSection('password')}
            type="button"
          >
            <div className="utility-copy">
              <div className="utility-icon">
                <CheckIcon className="utility-icon-svg" />
              </div>
              <div>
                <h4>{copy.accountPasswordTitle}</h4>
                <p>{accountPasswordSummary}</p>
              </div>
            </div>
            <ChevronDownIcon className="account-accordion-chevron" />
          </button>
          <div className="account-accordion-panel" id="account-password-panel">
            <div className="account-accordion-panel-inner">
              <div className="account-accordion-content">
                <form className="stack-form" onSubmit={handlePasswordUpdate}>
                  <label className="metric-field">
                    <span>{copy.accountPasswordLabel}</span>
                    <div className="auth-input-wrap">
                      <input
                        autoComplete="new-password"
                        onChange={(event) => setAccountPassword(event.target.value)}
                        placeholder={copy.accountPasswordPlaceholder}
                        type="password"
                        value={accountPassword}
                      />
                    </div>
                  </label>
                  <label className="metric-field">
                    <span>{copy.accountPasswordConfirmLabel}</span>
                    <div className="auth-input-wrap">
                      <input
                        autoComplete="new-password"
                        onChange={(event) => setAccountPasswordConfirm(event.target.value)}
                        placeholder={copy.accountPasswordConfirmPlaceholder}
                        type="password"
                        value={accountPasswordConfirm}
                      />
                    </div>
                  </label>
                  <label className="metric-field">
                    <span>{copy.accountPasswordNonceLabel}</span>
                    <div className="auth-input-wrap">
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        onChange={(event) => setAccountPasswordNonce(event.target.value)}
                        placeholder={copy.accountPasswordNoncePlaceholder}
                        type="text"
                        value={accountPasswordNonce}
                      />
                    </div>
                  </label>
                  {passwordMessage ? (
                    <p className={`status-message ${passwordMessageTone}`}>{passwordMessage}</p>
                  ) : null}
                  <div className="account-action-grid">
                    <button
                      className="utility-button"
                      disabled={isPasswordNonceSending || isPasswordUpdating}
                      onClick={() => {
                        void handlePasswordReauthentication()
                      }}
                      type="button"
                    >
                      {isPasswordNonceSending
                        ? copy.authSubmitting
                        : copy.accountPasswordNonceAction}
                    </button>
                    <button
                      className="action-button"
                      disabled={isPasswordUpdating || isPasswordNonceSending}
                      type="submit"
                    >
                      {isPasswordUpdating
                        ? copy.authSubmitting
                        : copy.accountPasswordAction}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section
          className="utility-card account-settings-card danger-card"
          data-open={openAccountSection === 'delete' ? 'true' : 'false'}
        >
          <button
            aria-controls="account-delete-panel"
            aria-expanded={openAccountSection === 'delete'}
            className="account-accordion-button"
            onClick={() => toggleAccountSection('delete')}
            type="button"
          >
            <div className="utility-copy">
              <div className="utility-icon">
                <WarningIcon className="utility-icon-svg" />
              </div>
              <div>
                <h4>{copy.accountDeleteTitle}</h4>
                <p>{accountDeleteSummary}</p>
              </div>
            </div>
            <ChevronDownIcon className="account-accordion-chevron" />
          </button>
          <div className="account-accordion-panel" id="account-delete-panel">
            <div className="account-accordion-panel-inner">
              <div className="account-accordion-content">
                <form className="stack-form" onSubmit={handleDeleteAccount}>
                  <label className="metric-field">
                    <span>{copy.accountDeleteConfirmLabel}</span>
                    <div className="auth-input-wrap">
                      <input
                        autoComplete="email"
                        inputMode="email"
                        onChange={(event) => setDeleteConfirmationEmail(event.target.value)}
                        placeholder={copy.accountDeleteConfirmPlaceholder}
                        type="email"
                        value={deleteConfirmationEmail}
                      />
                    </div>
                  </label>
                  {deleteMessage ? (
                    <p className={`status-message ${deleteMessageTone}`}>{deleteMessage}</p>
                  ) : null}
                  <button
                    className="utility-button danger-button"
                    disabled={isAccountDeleting}
                    type="submit"
                  >
                    {isAccountDeleting ? copy.authSubmitting : copy.accountDeleteAction}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  const renderAccountPage = () => (
    <>
      {renderAuthCard()}

      {isAuthenticated ? (
        <>
          <section className="panel report-card account-page-summary">
            <div className="report-card-header">
              <span className="panel-tag">{copy.accountPageTag}</span>
              <h3>{copy.accountPageTitle}</h3>
            </div>
            <div className="rich-content">
              <p className="rich-paragraph">{copy.accountPageBody}</p>
              <div className="billing-status-card">
                <strong>{copy.accountPageOrderTitle}</strong>
                <ol className="account-summary-list">
                  <li>{copy.accountPageOrderStep1}</li>
                  <li>{copy.accountPageOrderStep2}</li>
                  <li>{copy.accountPageOrderStep3}</li>
                  <li>{copy.accountPageOrderStep4}</li>
                </ol>
              </div>
            </div>
          </section>

          {renderAccountManagement()}
        </>
      ) : null}

      {renderPolicyLinks()}
    </>
  )

  const renderPolicyPage = (policyView: LegalView) => {
    const policy = policyCopy?.[policyView]

    if (!policy) {
      return (
        <section className="panel report-card policy-card">
          <div className="report-card-header">
            <span className="panel-tag">{copy.legalTag}</span>
            <h3>{copy.legalLinksTitle}</h3>
          </div>
          <p className="rich-paragraph">
            {language === 'ko' ? '약관 정보를 불러오는 중입니다.' : 'Loading the legal content...'}
          </p>
        </section>
      )
    }

    return (
      <section className="panel report-card policy-card">
        <div className="report-card-header">
          <span className="panel-tag">{copy.legalTag}</span>
          <h3>{policy.title}</h3>
        </div>
        <p className="policy-subtitle">{policy.subtitle}</p>
        <p className="policy-meta">{policy.lastUpdated}</p>
        <div className="policy-section-stack">
          {policy.sections.map((section) => (
            <section className="policy-section" key={section.heading}>
              <h4>{section.heading}</h4>
              {section.paragraphs.map((paragraph, index) => (
                <p className="rich-paragraph" key={`${section.heading}-p-${index}`}>
                  {paragraph}
                </p>
              ))}
              {section.bullets?.map((bullet, index) => (
                <div className="rich-list-item" key={`${section.heading}-b-${index}`}>
                  <CheckIcon className="rich-list-icon" />
                  <p>{bullet}</p>
                </div>
              ))}
            </section>
          ))}
        </div>
      </section>
    )
  }

  const renderPolicyLinks = () => {
    if (!policyCopy) {
      return null
    }

    return (
      <section className="policy-links-card">
        <p className="policy-links-label">
          <strong>{copy.legalLinksTitle}</strong>
          <span>{copy.legalLinksDescription}</span>
        </p>
        <div className="policy-link-grid">
          {policyViews.map((policyView) => {
            const policy = policyCopy[policyView]
            const isActive = view === policyView

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`policy-link-button ${isActive ? 'is-active' : ''}`}
                key={policyView}
                onClick={() => setView(policyView)}
                type="button"
              >
                {policy.title}
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  const renderReportActions = ({
    hasContent,
    actionState,
    message,
    tone,
    onSave,
    onShare,
  }: {
    hasContent: boolean
    actionState: 'idle' | 'save' | 'share'
    message: string
    tone: 'success' | 'error' | 'fallback'
    onSave: () => Promise<void>
    onShare: () => Promise<void>
  }) => {
    if (!hasContent) {
      return null
    }

    return (
      <section className="utility-card report-action-card">
        <div className="report-action-group">
          <button
            className="utility-button report-action-button"
            disabled={actionState !== 'idle'}
            onClick={() => {
              void onSave()
            }}
            type="button"
          >
            <DownloadIcon className="button-icon" />
            <span>
              {actionState === 'save'
                ? copy.reportImageSaveLoading
                : copy.reportImageSaveAction}
            </span>
          </button>
          <button
            className="utility-button report-action-button"
            disabled={actionState !== 'idle'}
            onClick={() => {
              void onShare()
            }}
            type="button"
          >
            <ShareIcon className="button-icon" />
            <span>
              {actionState === 'share'
                ? copy.reportImageShareLoading
                : copy.reportImageShareAction}
            </span>
          </button>
        </div>
        {message ? <p className={`status-message ${tone}`}>{message}</p> : null}
      </section>
    )
  }

  return (
    <div className="app-frame" lang={language === 'ko' ? 'ko' : 'en'}>
      <div className="app-shell">
        <header className="topbar">
          {view === 'home' ? (
            <>
              <div className="brand">
                <div className="brand-badge">
                  <SparkleIcon className="brand-badge-icon" />
                </div>
                <span className="brand-name">Personal AI Stylist</span>
              </div>

              <button
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="icon-button theme-button"
                onClick={toggleTheme}
                type="button"
              >
                {theme === 'dark' ? (
                  <SunIcon className="topbar-icon" />
                ) : (
                  <MoonIcon className="topbar-icon" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                aria-label="Go back"
                className="icon-button"
                onClick={() => setView('home')}
                type="button"
              >
                <ArrowLeftIcon className="topbar-icon" />
              </button>

              <h1 className="topbar-title">
                {currentPolicy?.title ??
                  (view === 'style'
                    ? copy.topbarStyle
                    : view === 'hair'
                      ? copy.topbarHair
                      : copy.topbarAccount)}
              </h1>

              <button
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="icon-button theme-button"
                onClick={toggleTheme}
                type="button"
              >
                {theme === 'dark' ? (
                  <SunIcon className="topbar-icon" />
                ) : (
                  <MoonIcon className="topbar-icon" />
                )}
              </button>
            </>
          )}
        </header>

        <main className="page-content">
          <section className="language-strip" aria-label={copy.languageLabel}>
            <div className="language-strip-main">
              <span className="language-label">{copy.languageLabel}</span>
              <div className="language-switch">
                <button
                  className={`language-option ${language === 'ko' ? 'is-active' : ''}`}
                  onClick={() => setLanguage('ko')}
                  type="button"
                >
                  {copy.korean}
                </button>
                <button
                  className={`language-option ${language === 'en' ? 'is-active' : ''}`}
                  onClick={() => setLanguage('en')}
                  type="button"
                >
                  {copy.english}
                </button>
              </div>
            </div>
            {view === 'home' ? (
              <button
                className="account-shortcut-button"
                onClick={() => setView('account')}
                type="button"
              >
                <PersonIcon className="button-icon" />
                <span>
                  {isAuthenticated
                    ? copy.homeAccountShortcutSignedIn
                    : copy.homeAccountShortcutSignedOut}
                </span>
              </button>
            ) : null}
          </section>

          {view === 'home' ? (
            <>
              <section className="hero-section">
                <h2 className="hero-title">
                  {copy.homeTitleLead} <span>{copy.homeTitleAccent}</span>
                </h2>
                <p className="hero-description">{copy.homeDescription}</p>
                <div className="compliance-banner">
                  <strong>{copy.complianceTitle}</strong>
                  <p>{copy.complianceBody}</p>
                </div>
              </section>
              <section className="selection-stack">
                <button
                  className="selection-card"
                  onClick={() => {
                    void beginProtectedEntry('style')
                  }}
                  type="button"
                >
                  <div aria-hidden="true" className="selection-visual selection-visual-style">
                    <div className="selection-orb selection-orb-style-primary" />
                    <div className="selection-orb selection-orb-style-secondary" />
                    <div className="selection-dashboard">
                      <span className="selection-line selection-line-long" />
                      <span className="selection-line selection-line-medium" />
                      <div className="selection-pill-row">
                        <span className="selection-pill" />
                        <span className="selection-pill selection-pill-accent" />
                        <span className="selection-pill" />
                      </div>
                    </div>
                  </div>
                  <div className="selection-content">
                    <div className="selection-heading">
                      <h3>{copy.homeStyleTitle}</h3>
                      <AnalyticsIcon className="selection-heading-icon" />
                    </div>
                    <p>{copy.homeStyleDescription}</p>
                    <span className="primary-cta">
                      <span>{copy.homeStyleCta}</span>
                      <ArrowLeftIcon className="cta-arrow" />
                    </span>
                  </div>
                </button>

                <button
                  className="selection-card"
                  onClick={() => {
                    void beginProtectedEntry('hair')
                  }}
                  type="button"
                >
                  <div aria-hidden="true" className="selection-visual selection-visual-hair">
                    <div className="selection-orb selection-orb-hair-primary" />
                    <div className="selection-orb selection-orb-hair-secondary" />
                    <div className="selection-grid-visual">
                      {Array.from({ length: 9 }, (_, index) => (
                        <span className="selection-grid-cell" key={`hair-grid-${index}`} />
                      ))}
                    </div>
                  </div>
                  <div className="selection-content">
                    <div className="selection-heading">
                      <h3>{copy.homeHairTitle}</h3>
                      <ScissorsIcon className="selection-heading-icon" />
                    </div>
                    <p>{copy.homeHairDescription}</p>
                    <span className="secondary-cta">
                      <span>{copy.homeHairCta}</span>
                      <SparkleIcon className="cta-spark" />
                    </span>
                  </div>
                </button>
              </section>
            </>
          ) : null}

          {view === 'style' ? (
            <>
              <section className="panel panel-form">
                <form className="stack-form" onSubmit={handleStyleSubmit}>
                  {renderPhotoField({
                    label: copy.styleUploadTitle,
                    helper: copy.styleUploadHelper,
                    selectLabel: copy.styleUploadSelect,
                    icon: <UploadIcon className="upload-icon-svg" />,
                    isDragging: isStyleDragging,
                    preview: stylePhotoPreview,
                    name: stylePhotoName,
                    onChange: (event) => updateStylePhoto(event.target.files?.[0] ?? null),
                    onDragOver: (event) => {
                      event.preventDefault()
                      setIsStyleDragging(true)
                    },
                    onDragLeave: (event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsStyleDragging(false)
                      }
                    },
                    onDrop: (event) => {
                      event.preventDefault()
                      setIsStyleDragging(false)
                      updateStylePhoto(event.dataTransfer.files?.[0] ?? null)
                    },
                  })}

                  <div className="metrics-grid">
                    <label className="metric-field">
                      <span>{copy.styleHeight}</span>
                      <div className="metric-input-wrap">
                        <input
                          inputMode="decimal"
                          onChange={(event) => setHeight(event.target.value)}
                          placeholder={copy.styleHeightPlaceholder}
                          type="text"
                          value={height}
                        />
                        <em>cm</em>
                      </div>
                    </label>

                    <label className="metric-field">
                      <span>{copy.styleWeight}</span>
                      <div className="metric-input-wrap">
                        <input
                          inputMode="decimal"
                          onChange={(event) => setWeight(event.target.value)}
                          placeholder={copy.styleWeightPlaceholder}
                          type="text"
                          value={weight}
                        />
                        <em>kg</em>
                      </div>
                    </label>
                  </div>

                  {styleErrorMessage ? (
                    <p className="status-message error">{styleErrorMessage}</p>
                  ) : null}

                  {!hasGenerationAccess ? (
                    <p className="status-message fallback">{copy.checkoutFlowHint}</p>
                  ) : null}

                  <button
                    className="action-button"
                    disabled={isStyleLoading || isCheckoutLoading}
                    type="submit"
                  >
                    {isStyleLoading
                      ? copy.styleActionLoading
                      : isCheckoutLoading && activeCheckoutKind === 'one_time' && !hasGenerationAccess
                        ? copy.stylePayActionLoading
                        : hasGenerationAccess
                          ? copy.styleAction
                          : copy.stylePayAction}
                  </button>
                </form>
              </section>

              <section className="panel report-card" ref={styleReportCaptureRef}>
                <div className="report-card-header">
                  <span className="panel-tag">{copy.stylePanelTag}</span>
                  <h3>{copy.stylePanelTitle}</h3>
                </div>

                {styleReport ? (
                  <>
                    {styleNote ? <p className="status-message fallback">{styleNote}</p> : null}
                    <div className="rich-content">
                      {styleReport.split('\n').map((line, index) => (
                        renderFormattedBlock(line, index)
                      ))}
                    </div>
                    {styleResultImage ? (
                      <section className="report-visual-card">
                        <p className="visual-caption">{copy.styleVisualTitle}</p>
                        <img
                          alt={
                            language === 'ko'
                              ? '스타일 보고서를 기반으로 생성한 착장 방향 이미지'
                              : 'Generated outfit direction based on the style report'
                          }
                          className="generated-image"
                          src={styleResultImage}
                        />
                      </section>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-state">{copy.styleEmpty}</div>
                )}
              </section>

              {renderReportActions({
                hasContent: Boolean(styleReport),
                actionState: styleAssetAction,
                message: styleAssetMessage,
                tone: styleAssetTone,
                onSave: saveStyleReportImage,
                onShare: shareStyleReportImage,
              })}

              {styleReport && stylePhotoFile && isAuthenticated ? (
                <section className="utility-card delivery-card">
                  <div className="utility-copy">
                    <div className="utility-icon">
                      <CameraIcon className="utility-icon-svg" />
                    </div>
                    <div>
                      <h4>{copy.styleAdoptPhotoTitle}</h4>
                      <p>{copy.styleAdoptPhotoDescription}</p>
                    </div>
                  </div>
                  {styleAdoptMessage ? (
                    <p className={'status-message ' + styleAdoptTone}>{styleAdoptMessage}</p>
                  ) : null}
                  <button
                    className="utility-button"
                    disabled={isStylePhotoAdopting}
                    onClick={() => {
                      void adoptStylePhotoForDailyBrief()
                    }}
                    type="button"
                  >
                    <CameraIcon className="button-icon" />
                    <span>
                      {isStylePhotoAdopting
                        ? copy.styleAdoptPhotoLoading
                        : copy.styleAdoptPhotoAction}
                    </span>
                  </button>
                </section>
              ) : null}

              {renderEmailDeliveryCard({
                hasContent: Boolean(styleReport),
                message: styleEmailMessage,
                tone: styleEmailTone,
                isSending: isStyleEmailSending,
              })}

              {renderPromptUtility({
                title: copy.stylePromptTitle,
                description: copy.stylePromptDescription,
                prompt: stylePrompt,
                note: '',
                copyMessage: styleCopyMessage,
                onCopy: copyStylePrompt,
              })}
            </>
          ) : null}

          {view === 'hair' ? (
            <>
              <section className="panel feature-panel">
                <div className="feature-upload">
                  {renderPhotoField({
                    label: copy.hairUploadTitle,
                    helper: copy.hairUploadHelper,
                    icon: <CameraIcon className="upload-icon-svg" />,
                    isDragging: isHairDragging,
                    preview: hairPhotoPreview,
                    name: hairPhotoName,
                    onChange: (event) => updateHairPhoto(event.target.files?.[0] ?? null),
                    onDragOver: (event) => {
                      event.preventDefault()
                      setIsHairDragging(true)
                    },
                    onDragLeave: (event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsHairDragging(false)
                      }
                    },
                    onDrop: (event) => {
                      event.preventDefault()
                      setIsHairDragging(false)
                      updateHairPhoto(event.dataTransfer.files?.[0] ?? null)
                    },
                  })}
                </div>

                {hairErrorMessage ? (
                  <p className="status-message error">{hairErrorMessage}</p>
                ) : null}

                {!hasGenerationAccess ? (
                  <p className="status-message fallback">{copy.checkoutFlowHint}</p>
                ) : null}

                <button
                  className="action-button"
                  disabled={isHairLoading || isCheckoutLoading}
                  type="submit"
                  form="hair-form-hidden"
                >
                  {isHairLoading
                    ? copy.hairActionLoading
                    : isCheckoutLoading && activeCheckoutKind === 'one_time' && !hasGenerationAccess
                      ? copy.hairPayActionLoading
                      : hasGenerationAccess
                        ? copy.hairAction
                        : copy.hairPayAction}
                </button>
                <form className="visually-hidden" id="hair-form-hidden" onSubmit={handleHairSubmit} />
              </section>

              <section
                className="panel report-card hair-report-card"
                ref={hairReportCaptureRef}
              >
                <div className="center-header">
                  <span className="panel-tag">{copy.hairPanelTag}</span>
                  <h3>{copy.hairPanelTitle}</h3>
                </div>

                {hairResultImage || hairDescription ? (
                  <>
                    {hairNote ? <p className="status-message fallback">{hairNote}</p> : null}
                    {hairCopyMessage ? (
                      <p className="status-message success">{hairCopyMessage}</p>
                    ) : null}
                    {hairResultImage ? (
                      <img
                        alt={
                          language === 'ko'
                            ? '3x3 헤어스타일 추천 이미지'
                            : '3x3 hairstyle recommendations'
                        }
                        className="generated-grid-image"
                        src={hairResultImage}
                      />
                    ) : null}
                    {hairDescription ? (
                      <div className="rich-content compact">
                        {hairDescription.split('\n').map((line, index) => (
                          renderFormattedBlock(line, index)
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-state">{copy.hairEmpty}</div>
                )}
              </section>

              {renderReportActions({
                hasContent: Boolean(hairResultImage || hairDescription),
                actionState: hairAssetAction,
                message: hairAssetMessage,
                tone: hairAssetTone,
                onSave: saveHairReportImage,
                onShare: shareHairReportImage,
              })}

              {renderEmailDeliveryCard({
                hasContent: Boolean(hairResultImage || hairDescription),
                message: hairEmailMessage,
                tone: hairEmailTone,
                isSending: isHairEmailSending,
              })}

              {renderPromptUtility({
                title: copy.hairPromptTitle,
                description: copy.hairPromptDescription,
                prompt: hairPrompt,
                note: '',
                copyMessage: hairCopyMessage,
                onCopy: copyHairPrompt,
              })}
            </>
          ) : null}

          {view === 'account' ? renderAccountPage() : null}
          {isPolicyView(view) ? renderPolicyPage(view) : null}
        </main>

        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {navItems.map((item) => {
              const IconComponent = item.icon
              const isActive = activeNav === item.key

              const handleClick = () => {
                if (item.key === 'home') {
                  setView('home')
                  return
                }

                if (item.key === 'style' || item.key === 'hair') {
                  void beginProtectedEntry(item.key)
                  return
                }

                if (item.key === 'account') {
                  setView('account')
                }
              }

              return (
                <button
                  className={`nav-item ${isActive ? 'is-active' : ''}`}
                  key={item.key}
                  onClick={handleClick}
                  type="button"
                >
                  <IconComponent className="nav-icon" />
                  <span>
                    {item.key === 'home'
                      ? copy.navHome
                      : item.key === 'style'
                        ? copy.navStyle
                        : item.key === 'hair'
                          ? copy.navHair
                          : copy.navAccount}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

export default App
