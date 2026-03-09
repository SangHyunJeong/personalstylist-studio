import { useEffect, useEffectEvent, useState } from 'react'
import type {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
} from 'react'
import './App.css'

type StyleReportResponse = {
  report: string
  imageBase64?: string
  mimeType?: string
  prompt?: string
  note?: string
  error?: string
}

type HairRecommendationResponse = {
  mode: 'image' | 'prompt'
  imageBase64?: string
  mimeType?: string
  description: string
  prompt?: string
  note?: string
  error?: string
}

type CheckoutResponse = {
  url?: string
  error?: string
}

type CheckoutStatusResponse = {
  status?: string
  productId?: string
  orderId?: string
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

type Theme = 'light' | 'dark'
type Language = 'ko' | 'en'
type View = 'home' | 'style' | 'hair' | 'billing'

const homeStyleImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDQjx-vParhC1dothBqJzuH356lz73-3ubERqUoT5vD7PVP-6JWbDUJOmUiF7xHQu1a3AvUMNrHW-RYaRmRSLlWsZejfRc9IkyHIB5x0r7TScYE-OT3lXUhRyl5r37cDOMlynoU9NXuA65unD52y31OY7Q-ni6AFAwrRSWbYU98PSLxaWZvysgx72USxcVwLNYX3C9CaPR5qmcmow2iAt1Eupi0iZPhBPUyf8z_xepgOug3zcHgSv_QMSD1qZRtUY9T5DSq1mVQrS0P'

const homeHairImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCiSoCbdZuRJXGn4Kar-8Sh8WklP3L-cazvB65L2O-j9SDHoSd2DGfiznQyEpdI_JEZEkTKsoK9tkDC_HwU03HvOSayIiYsiUnoZLr9bbYrj-SDFS-3Yi5Ta8VVZCQB0B2ZgNvncqijcLi6l2T22UzdyOUKEdlD4ZACHKAIRA2AVFUpLVuPWL1RrR0hqAK8bGBc-U6yjKz5NihvIWvV4WuqWfYspWoWrYPUkhuUzxf_UMnLMJA2-NFcnaxo7EKcfJOnOjTNIvVIMg5I'

const PURCHASE_VERIFIED_KEY = 'polar_purchase_verified'
const PENDING_CHECKOUT_KEY = 'polar_pending_checkout_payload'

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

  if (hash === 'style' || hash === 'hair' || hash === 'billing') {
    return hash
  }

  return 'home'
}

const localeCopy = {
  ko: {
    languageLabel: 'Language',
    korean: '한국어',
    english: 'English',
    noImageSelected: '아직 선택된 이미지가 없습니다.',
    copySuccess: '프롬프트를 클립보드에 복사했습니다.',
    copyFailure: '클립보드 복사에 실패했습니다. 직접 선택해서 복사해 주세요.',
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
      'Polar 샌드박스 결제가 성공으로 확인되었습니다. 현재 checkout 세션 상태는 검증된 상태입니다.',
    checkoutPendingTitle: '결제 확인 대기 중',
    checkoutPendingBody:
      '결제 후 돌아왔지만 Polar에서 아직 성공 상태가 확정되지 않았습니다. 잠시 후 다시 새로고침해 보세요.',
    navHome: 'HOME',
    navStylist: 'STYLIST',
    navGallery: 'REPORTS',
    navProfile: 'BILLING',
  },
  en: {
    languageLabel: 'Language',
    korean: '한국어',
    english: 'English',
    noImageSelected: 'No image selected yet.',
    copySuccess: 'Prompt copied to your clipboard.',
    copyFailure: 'Clipboard copy failed. Please copy it manually.',
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
      'Your Polar sandbox payment was verified successfully. The current checkout session has been confirmed.',
    checkoutPendingTitle: 'Payment still pending',
    checkoutPendingBody:
      'You returned from checkout, but Polar has not marked this session as succeeded yet. Please refresh in a moment.',
    navHome: 'HOME',
    navStylist: 'STYLIST',
    navGallery: 'REPORTS',
    navProfile: 'BILLING',
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
      d="M19.5 5.5 8.6 11.3M19.5 18.5 8.6 12.7M11.4 12l8.1 0"
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

const WandIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <path
      d="m5.5 17.75 6.65-6.65M14.85 8.4l3.65-3.65M15.95 4.75l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7ZM7.5 9l.95 2.2 2.2.95-2.2.95-.95 2.2-.95-2.2-2.2-.95 2.2-.95L7.5 9Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </Icon>
)

const GridIcon = ({ className = '' }: { className?: string }) => (
  <Icon className={className}>
    <rect fill="currentColor" height="5.25" rx="1.1" width="5.25" x="4" y="4" />
    <rect fill="currentColor" height="5.25" rx="1.1" width="5.25" x="14.75" y="4" />
    <rect fill="currentColor" height="5.25" rx="1.1" width="5.25" x="4" y="14.75" />
    <rect fill="currentColor" height="5.25" rx="1.1" width="5.25" x="14.75" y="14.75" />
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
  { key: 'stylist', icon: WandIcon },
  { key: 'gallery', icon: GridIcon },
  { key: 'profile', icon: PersonIcon },
] as const

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [language, setLanguage] = useState<Language>(getInitialLanguage)
  const [view, setView] = useState<View>(getInitialView)

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
  const [hairErrorMessage, setHairErrorMessage] = useState('')
  const [isHairLoading, setIsHairLoading] = useState(false)
  const [isHairDragging, setIsHairDragging] = useState(false)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState('')
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'pending' | 'verified'>('idle')
  const [checkoutStatusMessage, setCheckoutStatusMessage] = useState('')
  const [isPurchaseVerified, setIsPurchaseVerified] = useState(false)
  const copy = localeCopy[language]
  const preferredLocale = language === 'ko' ? 'ko-KR' : 'en-US'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('language', language)
  }, [language])

  useEffect(() => {
    setIsPurchaseVerified(
      window.localStorage.getItem(PURCHASE_VERIFIED_KEY) === 'true',
    )
  }, [])

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

  const runStyleGeneration = async (payload: StyleGenerationPayload) => {
    try {
      setIsStyleLoading(true)
      setStyleErrorMessage('')
      setStyleReport('')
      setStyleResultImage('')
      setStylePrompt('')
      setStyleNote('')
      setStyleCopyMessage('')
      setView('style')
      setStylePhotoPreview(payload.previewUrl)
      setStylePhotoName(payload.photoName)
      setHeight(payload.height)
      setWeight(payload.weight)

      const response = await fetch('/api/style-report', {
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
        }),
      })

      const data = await parseResponseJson<StyleReportResponse>(response)

      if (!response.ok || !data?.report) {
        throw new Error(data?.error ?? copy.styleSubmitError)
      }

      setStyleReport(data.report)
      setStylePrompt(data.prompt ?? '')
      setStyleNote(data.note ?? '')

      if (data.imageBase64 && data.mimeType) {
        setStyleResultImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      }
    } catch (error) {
      const fallback = copy.styleFetchError
      setStyleErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsStyleLoading(false)
    }
  }

  const runHairGeneration = async (payload: HairGenerationPayload) => {
    try {
      setIsHairLoading(true)
      setHairErrorMessage('')
      setHairDescription('')
      setHairResultImage('')
      setHairPrompt('')
      setHairNote('')
      setHairCopyMessage('')
      setView('hair')
      setHairPhotoPreview(payload.previewUrl)
      setHairPhotoName(payload.photoName)

      const response = await fetch('/api/hairstyle-grid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
          preferredLocale,
        }),
      })

      const data = await parseResponseJson<HairRecommendationResponse>(response)

      if (!response.ok || !data?.description) {
        throw new Error(data?.error ?? copy.hairSubmitError)
      }

      setHairDescription(data.description)
      setHairNote(data.note ?? '')
      setHairPrompt(data.prompt ?? '')

      if (data.mode === 'image' && data.imageBase64 && data.mimeType) {
        setHairResultImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      }
    } catch (error) {
      const fallback = copy.hairFetchError
      setHairErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsHairLoading(false)
    }
  }

  const resumePendingCheckout = useEffectEvent(
    async (pendingCheckout: PendingCheckoutPayload | null) => {
      if (pendingCheckout?.kind === 'style') {
        await runStyleGeneration(pendingCheckout)
      }

      if (pendingCheckout?.kind === 'hair') {
        await runHairGeneration(pendingCheckout)
      }
    },
  )

  const handleStyleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!stylePhotoFile) {
      setStyleErrorMessage(copy.stylePhotoRequired)
      return
    }

    if (!height.trim() || !weight.trim()) {
      setStyleErrorMessage(copy.styleMetricsRequired)
      return
    }

    try {
      const imageBase64 = await readFileAsBase64(stylePhotoFile)
      const payload: StyleGenerationPayload = {
        kind: 'style',
        height,
        weight,
        imageBase64,
        mimeType: stylePhotoFile.type || 'image/jpeg',
        previewUrl: `data:${stylePhotoFile.type || 'image/jpeg'};base64,${imageBase64}`,
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

    if (!hairPhotoFile) {
      setHairErrorMessage(copy.hairPhotoRequired)
      return
    }

    try {
      const imageBase64 = await readFileAsBase64(hairPhotoFile)
      const payload: HairGenerationPayload = {
        kind: 'hair',
        imageBase64,
        mimeType: hairPhotoFile.type || 'image/jpeg',
        previewUrl: `data:${hairPhotoFile.type || 'image/jpeg'};base64,${imageBase64}`,
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

  const startCheckout = async () => {
    try {
      setIsCheckoutLoading(true)
      setCheckoutErrorMessage('')

      const response = await fetch('/api/create-checkout', {
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

    let isCancelled = false

    const verifyCheckout = async () => {
      try {
        const response = await fetch(
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

          const pendingCheckout = readPendingCheckout()
          clearPendingCheckout()
          await resumePendingCheckout(pendingCheckout)

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
  }, [copy.checkoutError, copy.checkoutPendingBody, copy.checkoutVerifiedBody, preferredLocale])

  const activeNav = view === 'style'
    ? 'gallery'
    : view === 'hair'
      ? 'stylist'
      : view === 'billing'
        ? 'profile'
        : 'home'

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
              {isPurchaseVerified
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
      </section>
    </>
  )

  return (
    <div className="app-frame">
      <div className="app-shell">
        <header className="topbar">
          {view === 'home' ? (
            <>
              <div className="brand">
                <div className="brand-badge">
                  <SparkleIcon className="brand-badge-icon" />
                </div>
                <span className="brand-name">STYLIS.</span>
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
                {view === 'style'
                  ? copy.topbarStyle
                  : view === 'hair'
                    ? copy.topbarHair
                    : copy.topbarBilling}
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
                  onClick={() => setView('style')}
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
                  onClick={() => setView('hair')}
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

              <section className="panel report-card">
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

              <section className="panel report-card hair-report-card">
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
        </main>

        <nav className="bottom-nav">
          {navItems.map((item) => {
            const IconComponent = item.icon
            const isActive = activeNav === item.key

            const handleClick = () => {
              if (item.key === 'home') {
                setView('home')
              }

              if (item.key === 'stylist') {
                setView('hair')
              }

              if (item.key === 'gallery') {
                setView('style')
              }

              if (item.key === 'profile') {
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
                    : item.key === 'stylist'
                      ? copy.navStylist
                      : item.key === 'gallery'
                        ? copy.navGallery
                        : copy.navProfile}
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
