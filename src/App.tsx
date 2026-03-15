import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { toBlob } from 'html-to-image'
import { policyDocuments, type PolicyView as LegalView } from './legalContent'
import { getSupabaseClient, hasSupabaseConfig } from './supabase'
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

type CheckoutStatusResponse = {
  status?: string
  productId?: string
  orderId?: string
  customerEmail?: string
  error?: string
}

type SendReportEmailResponse = {
  id?: string
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

type Theme = 'light' | 'dark'
type Language = 'ko' | 'en'
type AuthMode = 'sign-in' | 'sign-up'
type StatusTone = 'success' | 'error' | 'fallback'
type View = 'home' | 'style' | 'hair' | 'billing' | LegalView

const homeStyleImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDQjx-vParhC1dothBqJzuH356lz73-3ubERqUoT5vD7PVP-6JWbDUJOmUiF7xHQu1a3AvUMNrHW-RYaRmRSLlWsZejfRc9IkyHIB5x0r7TScYE-OT3lXUhRyl5r37cDOMlynoU9NXuA65unD52y31OY7Q-ni6AFAwrRSWbYU98PSLxaWZvysgx72USxcVwLNYX3C9CaPR5qmcmow2iAt1Eupi0iZPhBPUyf8z_xepgOug3zcHgSv_QMSD1qZRtUY9T5DSq1mVQrS0P'

const homeHairImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCiSoCbdZuRJXGn4Kar-8Sh8WklP3L-cazvB65L2O-j9SDHoSd2DGfiznQyEpdI_JEZEkTKsoK9tkDC_HwU03HvOSayIiYsiUnoZLr9bbYrj-SDFS-3Yi5Ta8VVZCQB0B2ZgNvncqijcLi6l2T22UzdyOUKEdlD4ZACHKAIRA2AVFUpLVuPWL1RrR0hqAK8bGBc-U6yjKz5NihvIWvV4WuqWfYspWoWrYPUkhuUzxf_UMnLMJA2-NFcnaxo7EKcfJOnOjTNIvVIMg5I'

const PURCHASE_VERIFIED_KEY = 'polar_purchase_verified'
const PURCHASE_ORDER_ID_KEY = 'polar_purchase_order_id'
const PURCHASE_EMAIL_KEY = 'polar_purchase_email'
const PENDING_CHECKOUT_KEY = 'polar_pending_checkout_payload'
const PENDING_ENTRY_VIEW_KEY = 'polar_pending_entry_view'
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

  if (
    hash === 'style' ||
    hash === 'hair' ||
    hash === 'billing' ||
    hash === 'terms' ||
    hash === 'refunds' ||
    hash === 'privacy'
  ) {
    return hash
  }

  return 'home'
}

const getInitialPurchaseVerified = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(PURCHASE_VERIFIED_KEY) === 'true'
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
    stylePayAction: '결제 후 분석 시작하기',
    stylePayActionLoading: '결제 페이지 준비 중...',
    stylePanelTag: 'AI 스타일 보고서',
    stylePanelTitle: 'AI 자동 스타일 보고서',
    styleEmpty:
      '사진과 체형 정보를 입력하면 스타일 보고서와 착장 방향이 여기에 표시됩니다.',
    styleVisualTitle: '추천 착장 이미지',
    stylePromptTitle: 'AI 프롬프트 유틸리티',
    stylePromptDescription:
      'ChatGPT, Gemini, Stitch 같은 생성형 AI에서 추가 룩 이미지를 만들 수 있도록 프롬프트를 복사합니다.',
    hairUploadTitle: '내 사진 업로드',
    hairUploadHelper:
      '드래그 앤 드롭하거나 탭해서 선명한 인물 사진을 업로드하세요.',
    hairAction: '내 스타일 분석하기',
    hairActionLoading: '헤어스타일 추천 생성 중...',
    hairPayAction: '결제 후 헤어 추천받기',
    hairPayActionLoading: '결제 페이지 준비 중...',
    hairPanelTag: 'AI 헤어 스타일리스트',
    hairPanelTitle: '3x3 헤어스타일 추천',
    hairEmpty:
      '사진을 업로드하면 3x3 헤어스타일 추천 이미지와 설명이 여기에 표시됩니다.',
    checkoutFlowHint:
      '지금 버튼을 누르면 Polar 결제로 이동한 뒤, 결제가 확인되면 입력한 내용으로 생성이 자동 이어집니다.',
    hairPromptTitle: '생성형 AI 프롬프트',
    hairPromptDescription:
      'ChatGPT, Gemini 또는 다른 이미지 생성 도구에서 다시 시도할 수 있도록 프롬프트를 복사합니다.',
    utilityButton: '내 생성형 AI로 가져가서 이미지 생성할 프롬프트 복사하기',
    recommendedVisual: '추천 스타일 비주얼',
    topbarBilling: '결제 및 액세스',
    checkoutTitle: '디지털 액세스 구매',
    checkoutDescription:
      'Polar 결제로 이 AI 스타일링 소프트웨어의 디지털 액세스를 구매합니다. 오프라인 서비스나 실물 상품은 포함되지 않습니다.',
    checkoutButton: 'Polar로 결제하기',
    checkoutLoading: '결제 페이지 준비 중...',
    checkoutStatusLabel: '현재 액세스 상태',
    checkoutLockedTitle: '아직 결제가 확인되지 않았습니다',
    checkoutLockedBody:
      '체형 스타일 보고서와 헤어스타일링 추천은 결제 완료 후 자동으로 이어서 생성됩니다.',
    checkoutVerifiedStatus: '이 기기에서는 결제 확인이 완료되어 두 생성 흐름을 바로 사용할 수 있습니다.',
    checkoutPendingStatus:
      '결제 세션이 대기 중입니다. 결제를 마친 뒤 이 페이지로 돌아오면 상태가 갱신됩니다.',
    checkoutPageTag: 'BILLING',
    checkoutPageTitle: '결제 후 자동으로 생성이 이어집니다',
    checkoutPageBody:
      '사진과 정보를 먼저 입력한 뒤 생성 버튼을 누르면 Polar checkout으로 이동합니다. 결제가 확인되면 방금 입력한 내용으로 스타일 결과를 자동 생성합니다.',
    checkoutError: '결제 페이지를 시작하지 못했습니다.',
    checkoutVerifiedTitle: '결제 확인 완료',
    checkoutVerifiedBody:
      'Polar 결제가 확인되었습니다. 이 기기에서는 구매된 디지털 액세스를 사용할 수 있습니다.',
    checkoutPendingTitle: '결제 확인 대기 중',
    checkoutPendingBody:
      '결제 후 돌아왔지만 Polar에서 아직 성공 상태가 확정되지 않았습니다. 잠시 후 다시 새로고침해 보세요.',
    navHome: 'HOME',
    navStyle: 'STYLE',
    navHair: 'HAIR',
    navBilling: 'BILLING',
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
    stylePayAction: 'Pay and Generate',
    stylePayActionLoading: 'Preparing checkout...',
    stylePanelTag: 'AI Style Report',
    stylePanelTitle: 'AI Automated Style Report',
    styleEmpty:
      'Upload your photo and body details to see the report and outfit direction here.',
    styleVisualTitle: 'Recommended Outfit Construction',
    stylePromptTitle: 'AI Prompt Utility',
    stylePromptDescription:
      'Copy a prompt for ChatGPT, Gemini, Stitch, or another generative AI tool to create more style visuals.',
    hairUploadTitle: 'Upload Your Photo',
    hairUploadHelper:
      'Drag and drop or tap to upload a clear portrait for AI hair analysis.',
    hairAction: 'Analyze My Look',
    hairActionLoading: 'Analyzing My Look...',
    hairPayAction: 'Pay and Analyze',
    hairPayActionLoading: 'Preparing checkout...',
    hairPanelTag: 'AI Hair Stylist',
    hairPanelTitle: '3x3 Hairstyle Recommendations',
    hairEmpty:
      'Upload your photo to see the 3x3 hairstyle grid and recommendation details here.',
    checkoutFlowHint:
      'When you submit, Polar checkout opens first. After payment is verified, generation resumes automatically with the same inputs.',
    hairPromptTitle: 'Generative Prompt',
    hairPromptDescription:
      'Copy an optimized prompt to try the hairstyle generation again in ChatGPT, Gemini, or another image tool.',
    utilityButton: 'Copy prompt for image generation in my AI',
    recommendedVisual: 'Recommended Style Visual',
    topbarBilling: 'Billing & Access',
    checkoutTitle: 'Purchase Digital Access',
    checkoutDescription:
      'Use Polar checkout to purchase digital access to this AI styling software. No offline service or physical goods are included.',
    checkoutButton: 'Pay with Polar',
    checkoutLoading: 'Preparing checkout...',
    checkoutStatusLabel: 'Current access status',
    checkoutLockedTitle: 'Payment has not been verified yet',
    checkoutLockedBody:
      'Both the body style report and hairstyling generation continue automatically after checkout succeeds.',
    checkoutVerifiedStatus:
      'Payment is already verified on this device, so both generation flows can start immediately.',
    checkoutPendingStatus:
      'A checkout session is still pending. Return here after payment and the status will refresh.',
    checkoutPageTag: 'BILLING',
    checkoutPageTitle: 'Pay once, then continue automatically',
    checkoutPageBody:
      'Users can fill in their photo and details first, then tap generate to open Polar checkout. After payment is verified, the app resumes the requested style generation automatically.',
    checkoutError: 'Unable to start the checkout flow.',
    checkoutVerifiedTitle: 'Payment verified',
    checkoutVerifiedBody:
      'Your Polar payment has been verified. Digital access is available on this device.',
    checkoutPendingTitle: 'Payment still pending',
    checkoutPendingBody:
      'You returned from checkout, but Polar has not marked this session as succeeded yet. Please refresh in a moment.',
    navHome: 'HOME',
    navStyle: 'STYLE',
    navHair: 'HAIR',
    navBilling: 'BILLING',
    legalTag: 'LEGAL',
    legalLinksTitle: 'Terms and policies',
    legalLinksDescription: 'Terms of Service, Refund Policy, Privacy Policy',
  },
} as const

const backgroundStyle = (imageUrl: string): CSSProperties => ({
  backgroundImage: `linear-gradient(180deg, transparent 0%, rgba(17, 6, 11, 0.22) 100%), url("${imageUrl}")`,
})

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

const navItems = [
  { key: 'home', icon: HomeIcon },
  { key: 'style', icon: AnalyticsIcon },
  { key: 'hair', icon: ScissorsIcon },
  { key: 'billing', icon: PersonIcon },
] as const

const policyViews: LegalView[] = ['terms', 'refunds', 'privacy']

const isPolicyView = (view: View): view is LegalView =>
  view === 'terms' || view === 'refunds' || view === 'privacy'

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [language, setLanguage] = useState<Language>(getInitialLanguage)
  const [view, setView] = useState<View>(getInitialView)
  const styleReportCaptureRef = useRef<HTMLElement | null>(null)
  const hairReportCaptureRef = useRef<HTMLElement | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageTone, setAuthMessageTone] = useState<StatusTone>('fallback')
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseConfig)
  const [authSession, setAuthSession] = useState<Session | null>(null)

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
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState('')
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'pending' | 'verified'>('idle')
  const [checkoutStatusMessage, setCheckoutStatusMessage] = useState('')
  const [isPurchaseVerified, setIsPurchaseVerified] = useState(getInitialPurchaseVerified)
  const [purchaseOrderId, setPurchaseOrderId] = useState(getInitialPurchaseOrderId)
  const [purchaseEmail, setPurchaseEmail] = useState(getInitialPurchaseEmail)
  const [styleEmailMessage, setStyleEmailMessage] = useState('')
  const [styleEmailTone, setStyleEmailTone] = useState<StatusTone>('success')
  const [isStyleEmailSending, setIsStyleEmailSending] = useState(false)
  const [hairEmailMessage, setHairEmailMessage] = useState('')
  const [hairEmailTone, setHairEmailTone] = useState<StatusTone>('success')
  const [isHairEmailSending, setIsHairEmailSending] = useState(false)
  const copy = localeCopy[language]
  const policyCopy = policyDocuments[language]
  const preferredLocale = language === 'ko' ? 'ko-KR' : 'en-US'
  const authenticatedEmail = authSession?.user.email ?? ''
  const isAuthenticated = Boolean(authSession?.user)

  const setAuthFeedback = (tone: StatusTone, message: string) => {
    setAuthMessageTone(tone)
    setAuthMessage(message)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('language', language)
    document.documentElement.lang = language === 'ko' ? 'ko' : 'en'
  }, [language])

  useEffect(() => {
    const client = getSupabaseClient()

    if (!client) {
      setIsAuthLoading(false)
      return
    }

    let isCancelled = false

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

    return () => {
      isCancelled = true
      subscription.unsubscribe()
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

    setIsPurchaseVerified(false)
    setPurchaseOrderId('')
    setPurchaseEmail('')
    setCheckoutStatus('idle')
    setCheckoutStatusMessage('')
    setCheckoutErrorMessage('')

    if (view === 'style' || view === 'hair') {
      setView('home')
    }
  }, [isAuthLoading, isAuthenticated, view])

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
      setView(getInitialView())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    const hash = view === 'home' ? '' : `#${view}`
    const url = `${window.location.pathname}${window.location.search}${hash}`
    window.history.replaceState(null, '', url)
  }, [view])

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
    if (!stylePhotoFile) {
      setStylePhotoName(copy.noImageSelected)
    }

    if (!hairPhotoFile) {
      setHairPhotoName(copy.noImageSelected)
    }
  }, [copy.noImageSelected, hairPhotoFile, stylePhotoFile])

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

  const parseResponseJson = async <T,>(response: Response) => {
    const rawText = await response.text()

    if (!rawText.trim()) {
      return null
    }

    try {
      return JSON.parse(rawText) as T
    } catch {
      throw new Error(copy.responseParseFailure)
    }
  }

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
    setCheckoutStatus('idle')
    setCheckoutStatusMessage('')
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

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasSupabaseConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      return
    }

    const client = getSupabaseClient()

    if (!client) {
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
        const { error } = await client.auth.signUp({
          email: trimmedEmail,
          password: authPassword,
        })

        if (error) {
          throw error
        }

        setAuthFeedback('success', copy.authSignUpSuccess)
      } else {
        const { error } = await client.auth.signInWithPassword({
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
    const client = getSupabaseClient()

    if (!client) {
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
      await client.auth.signOut()
      setView('home')
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

  const resolveAccessToken = useCallback(async () => {
    if (!hasSupabaseConfig) {
      throw new Error(copy.authConfigMissing)
    }

    const currentToken = authSession?.access_token?.trim()

    if (currentToken) {
      return currentToken
    }

    const client = getSupabaseClient()

    if (!client) {
      throw new Error(copy.authConfigMissing)
    }

    const { data, error } = await client.auth.getSession()

    if (error) {
      throw error
    }

    const nextToken = data.session?.access_token?.trim()

    if (!nextToken) {
      throw new Error(copy.authSessionRequired)
    }

    return nextToken
  }, [authSession?.access_token, copy.authConfigMissing, copy.authSessionRequired])

  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const accessToken = await resolveAccessToken()
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)

    return fetch(input, {
      ...init,
      headers,
    })
  }, [resolveAccessToken])

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
    deliveryEmail = purchaseEmail,
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
      setView('style')
      setStylePhotoPreview(payload.previewUrl)
      setStylePhotoName(payload.photoName)
      setHeight(payload.height)
      setWeight(payload.weight)

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
      const fallback = copy.styleFetchError
      setStyleErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsStyleLoading(false)
    }
  }

  const runHairGeneration = async (
    payload: HairGenerationPayload,
    deliveryEmail = purchaseEmail,
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

  const handleStyleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('home')
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

      if (!isPurchaseVerified) {
        persistPendingCheckout(payload)
        await startCheckout()
        return
      }

      await runStyleGeneration(payload)
    } catch (error) {
      const fallback = copy.styleFetchError
      setStyleErrorMessage(error instanceof Error ? error.message : fallback)
    }
  }

  const handleHairSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('home')
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

      if (!isPurchaseVerified) {
        persistPendingCheckout(payload)
        await startCheckout()
        return
      }

      await runHairGeneration(payload)
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
    } catch (error) {
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
    setCheckoutErrorMessage('')

    if (!hasSupabaseConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      setView('home')
      return
    }

    if (isAuthLoading) {
      setAuthFeedback('fallback', copy.authLoading)
      setView('home')
      return
    }

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authSessionRequired)
      setView('home')
      return
    }

    if (isPurchaseVerified) {
      setView(targetView)
      return
    }

    clearPendingCheckout()
    persistPendingEntryView(targetView)
    await startCheckout()
  }

  const startCheckout = async () => {
    if (!hasSupabaseConfig) {
      setAuthFeedback('error', copy.authConfigMissing)
      setView('home')
      return
    }

    if (isAuthLoading) {
      setAuthFeedback('fallback', copy.authLoading)
      setView('home')
      return
    }

    if (!isAuthenticated) {
      setAuthFeedback('error', copy.authCheckoutRequired)
      setView('home')
      return
    }

    try {
      setIsCheckoutLoading(true)
      setCheckoutErrorMessage('')

      const response = await fetchWithAuth('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredLocale,
          currentUrl: window.location.href,
        }),
      })

      const data = await parseResponseJson<CheckoutResponse>(response)

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? copy.checkoutError)
      }

      window.location.href = data.url
    } catch (error) {
      setCheckoutErrorMessage(
        error instanceof Error ? error.message : copy.checkoutError,
      )
      setIsCheckoutLoading(false)
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

        if (data.status === 'succeeded') {
          setCheckoutStatus('verified')
          setCheckoutStatusMessage(copy.checkoutVerifiedBody)
          window.localStorage.setItem(PURCHASE_VERIFIED_KEY, 'true')
          setIsPurchaseVerified(true)
          setPurchaseOrderId(data.orderId ?? '')
          setPurchaseEmail(data.customerEmail ?? '')

          const pendingCheckout = readPendingCheckout()
          const pendingEntryView = readPendingEntryView()
          clearPendingCheckout()
          clearPendingEntryView()

          if (pendingCheckout) {
            await resumePendingCheckout(pendingCheckout, data.customerEmail ?? '')
          } else if (pendingEntryView) {
            setView(pendingEntryView)
          }

          url.searchParams.delete('checkout')
          url.searchParams.delete('checkout_id')
          window.history.replaceState(null, '', url.toString())
          return
        }

        setCheckoutStatus('pending')
        setCheckoutStatusMessage(copy.checkoutPendingBody)
      } catch (error) {
        if (isCancelled) {
          return
        }

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
    copy.authSessionRequired,
    copy.checkoutError,
    copy.checkoutPendingBody,
    copy.checkoutVerifiedBody,
    fetchWithAuth,
    isAuthenticated,
    isAuthLoading,
    preferredLocale,
  ])

  const activeNav = isPolicyView(view) ? 'billing' : view
  const currentPolicy = isPolicyView(view) ? policyCopy[view] : null

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
          <span>{purchaseEmail || copy.emailSendUnavailable}</span>
        </p>
        {isSending ? (
          <p className="status-message fallback">{copy.emailSendLoading}</p>
        ) : null}
        {message ? <p className={`status-message ${tone}`}>{message}</p> : null}
      </section>
    )
  }

  const renderAuthCard = () => {
    if (!hasSupabaseConfig) {
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
    if (checkoutStatus === 'idle' && !checkoutErrorMessage) {
      return null
    }

    return (
      <section className="utility-card checkout-status-card">
        <div className="utility-copy">
          <div className="utility-icon">
            <SparkleIcon className="utility-icon-svg" />
          </div>
          <div>
            <h4>
              {checkoutErrorMessage
                ? copy.checkoutTitle
                : checkoutStatus === 'verified'
                ? copy.checkoutVerifiedTitle
                : copy.checkoutPendingTitle}
            </h4>
            <p>{checkoutErrorMessage || checkoutStatusMessage}</p>
          </div>
        </div>
      </section>
    )
  }

  const renderBillingPage = () => (
    <>
      <section className="panel report-card">
        <div className="report-card-header">
          <span className="panel-tag">{copy.checkoutPageTag}</span>
          <h3>{copy.checkoutPageTitle}</h3>
        </div>
        <div className="rich-content">
          <p className="rich-paragraph">{copy.checkoutPageBody}</p>
          <div className="billing-status-card">
            <strong>{copy.checkoutStatusLabel}</strong>
            <p className="rich-paragraph">
              {!isAuthenticated
                ? copy.authCheckoutRequired
                : isPurchaseVerified
                ? copy.checkoutVerifiedStatus
                : checkoutStatus === 'pending'
                  ? copy.checkoutPendingStatus
                  : copy.checkoutLockedBody}
            </p>
          </div>
        </div>
      </section>

      <section className="utility-card checkout-card">
        <div className="utility-copy">
          <div className="utility-icon">
            <SparkleIcon className="utility-icon-svg" />
          </div>
          <div>
            <h4>
              {isPurchaseVerified
                ? copy.checkoutVerifiedTitle
                : copy.checkoutLockedTitle}
            </h4>
            <p>{copy.checkoutDescription}</p>
          </div>
        </div>
        {isPurchaseVerified ? (
          <p className="status-message success">{copy.checkoutVerifiedBody}</p>
        ) : !isAuthenticated ? (
          <p className="status-message fallback">{copy.authCheckoutRequired}</p>
        ) : (
          <button
            className="utility-button checkout-button"
            disabled={isCheckoutLoading}
            onClick={() => {
              void startCheckout()
            }}
            type="button"
          >
            <SparkleIcon className="button-icon" />
            <span>
              {isCheckoutLoading ? copy.checkoutLoading : copy.checkoutButton}
            </span>
          </button>
        )}
      </section>

      {renderPolicyLinks()}
    </>
  )

  const renderPolicyPage = (policyView: LegalView) => {
    const policy = policyCopy[policyView]

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

  const renderPolicyLinks = () => (
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
                      : copy.topbarBilling)}
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
          </section>

          {renderCheckoutStatusCard()}
          {(!isAuthenticated || view === 'home' || view === 'billing') ? renderAuthCard() : null}

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
                  <div
                    aria-hidden="true"
                    className="selection-visual"
                    style={backgroundStyle(homeStyleImage)}
                  />
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
                  <div
                    aria-hidden="true"
                    className="selection-visual"
                    style={backgroundStyle(homeHairImage)}
                  />
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

                  {!isPurchaseVerified ? (
                    <p className="status-message fallback">{copy.checkoutFlowHint}</p>
                  ) : null}

                  <button
                    className="action-button"
                    disabled={isStyleLoading || isCheckoutLoading}
                    type="submit"
                  >
                    {isStyleLoading
                      ? copy.styleActionLoading
                      : isCheckoutLoading && !isPurchaseVerified
                        ? copy.stylePayActionLoading
                        : isPurchaseVerified
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

                {!isPurchaseVerified ? (
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
                    : isCheckoutLoading && !isPurchaseVerified
                      ? copy.hairPayActionLoading
                      : isPurchaseVerified
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

          {view === 'billing' ? renderBillingPage() : null}
          {isPolicyView(view) ? renderPolicyPage(view) : null}
        </main>

        <nav className="bottom-nav">
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

              if (item.key === 'billing') {
                setView('billing')
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
                        : copy.navBilling}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default App
