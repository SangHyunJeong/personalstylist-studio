import { useEffect, useState } from 'react'
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

type Theme = 'light' | 'dark'
type View = 'home' | 'style' | 'hair'

const homeStyleImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDQjx-vParhC1dothBqJzuH356lz73-3ubERqUoT5vD7PVP-6JWbDUJOmUiF7xHQu1a3AvUMNrHW-RYaRmRSLlWsZejfRc9IkyHIB5x0r7TScYE-OT3lXUhRyl5r37cDOMlynoU9NXuA65unD52y31OY7Q-ni6AFAwrRSWbYU98PSLxaWZvysgx72USxcVwLNYX3C9CaPR5qmcmow2iAt1Eupi0iZPhBPUyf8z_xepgOug3zcHgSv_QMSD1qZRtUY9T5DSq1mVQrS0P'

const homeHairImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCiSoCbdZuRJXGn4Kar-8Sh8WklP3L-cazvB65L2O-j9SDHoSd2DGfiznQyEpdI_JEZEkTKsoK9tkDC_HwU03HvOSayIiYsiUnoZLr9bbYrj-SDFS-3Yi5Ta8VVZCQB0B2ZgNvncqijcLi6l2T22UzdyOUKEdlD4ZACHKAIRA2AVFUpLVuPWL1RrR0hqAK8bGBc-U6yjKz5NihvIWvV4WuqWfYspWoWrYPUkhuUzxf_UMnLMJA2-NFcnaxo7EKcfJOnOjTNIvVIMg5I'

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

const getInitialView = (): View => {
  if (typeof window === 'undefined') {
    return 'home'
  }

  const hash = window.location.hash.replace('#', '')

  if (hash === 'style' || hash === 'hair') {
    return hash
  }

  return 'home'
}

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
  { key: 'home', label: 'HOME', icon: HomeIcon },
  { key: 'stylist', label: 'STYLIST', icon: WandIcon },
  { key: 'gallery', label: 'GALLERY', icon: GridIcon },
  { key: 'profile', label: 'PROFILE', icon: PersonIcon },
] as const

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [view, setView] = useState<View>(getInitialView)

  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [stylePhotoFile, setStylePhotoFile] = useState<File | null>(null)
  const [stylePhotoName, setStylePhotoName] = useState('No image selected yet.')
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
  const [hairPhotoName, setHairPhotoName] = useState('No image selected yet.')
  const [hairPhotoPreview, setHairPhotoPreview] = useState('')
  const [hairDescription, setHairDescription] = useState('')
  const [hairResultImage, setHairResultImage] = useState('')
  const [hairPrompt, setHairPrompt] = useState('')
  const [hairNote, setHairNote] = useState('')
  const [hairCopyMessage, setHairCopyMessage] = useState('')
  const [hairErrorMessage, setHairErrorMessage] = useState('')
  const [isHairLoading, setIsHairLoading] = useState(false)
  const [isHairDragging, setIsHairDragging] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

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

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const result = reader.result

        if (typeof result !== 'string') {
          reject(new Error('이미지 인코딩에 실패했습니다.'))
          return
        }

        const base64 = result.split(',')[1]

        if (!base64) {
          reject(new Error('이미지 데이터를 읽을 수 없습니다.'))
          return
        }

        resolve(base64)
      }

      reader.onerror = () => {
        reject(new Error('이미지 파일을 읽는 중 오류가 발생했습니다.'))
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
      throw new Error('서버 응답을 해석하지 못했습니다.')
    }
  }

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const updateStylePhoto = (file: File | null) => {
    if (!file) {
      setStylePhotoFile(null)
      setStylePhotoName('No image selected yet.')

      if (stylePhotoPreview) {
        URL.revokeObjectURL(stylePhotoPreview)
      }

      setStylePhotoPreview('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setStyleErrorMessage('이미지 파일만 업로드할 수 있습니다.')
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
      setHairPhotoName('No image selected yet.')

      if (hairPhotoPreview) {
        URL.revokeObjectURL(hairPhotoPreview)
      }

      setHairPhotoPreview('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setHairErrorMessage('이미지 파일만 업로드할 수 있습니다.')
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

  const handleStyleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!stylePhotoFile) {
      setStyleErrorMessage('스타일 분석을 위해 본인 사진을 업로드해 주세요.')
      return
    }

    if (!height.trim() || !weight.trim()) {
      setStyleErrorMessage('키와 몸무게를 모두 입력해 주세요.')
      return
    }

    try {
      setIsStyleLoading(true)
      setStyleErrorMessage('')
      setStyleReport('')
      setStyleResultImage('')
      setStylePrompt('')
      setStyleNote('')
      setStyleCopyMessage('')

      const imageBase64 = await readFileAsBase64(stylePhotoFile)

      const response = await fetch('/api/style-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          height,
          weight,
          imageBase64,
          mimeType: stylePhotoFile.type || 'image/jpeg',
          preferredLocale: navigator.language || 'en-US',
        }),
      })

      const data = await parseResponseJson<StyleReportResponse>(response)

      if (!response.ok || !data?.report) {
        throw new Error(data?.error ?? '스타일 보고서를 생성하지 못했습니다.')
      }

      setStyleReport(data.report)
      setStylePrompt(data.prompt ?? '')
      setStyleNote(data.note ?? '')

      if (data.imageBase64 && data.mimeType) {
        setStyleResultImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      }
    } catch (error) {
      const fallback = '스타일 보고서를 가져오는 중 문제가 발생했습니다.'
      setStyleErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsStyleLoading(false)
    }
  }

  const handleHairSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hairPhotoFile) {
      setHairErrorMessage('헤어스타일 추천을 위해 본인 사진을 업로드해 주세요.')
      return
    }

    try {
      setIsHairLoading(true)
      setHairErrorMessage('')
      setHairDescription('')
      setHairResultImage('')
      setHairPrompt('')
      setHairNote('')
      setHairCopyMessage('')

      const imageBase64 = await readFileAsBase64(hairPhotoFile)

      const response = await fetch('/api/hairstyle-grid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: hairPhotoFile.type || 'image/jpeg',
          preferredLocale: navigator.language || 'en-US',
        }),
      })

      const data = await parseResponseJson<HairRecommendationResponse>(response)

      if (!response.ok || !data?.description) {
        throw new Error(data?.error ?? '헤어스타일 추천 이미지를 생성하지 못했습니다.')
      }

      setHairDescription(data.description)
      setHairNote(data.note ?? '')
      setHairPrompt(data.prompt ?? '')

      if (data.mode === 'image' && data.imageBase64 && data.mimeType) {
        setHairResultImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      }
    } catch (error) {
      const fallback = '헤어스타일 추천 이미지를 가져오는 중 문제가 발생했습니다.'
      setHairErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsHairLoading(false)
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
      onSuccess('프롬프트를 클립보드에 복사했습니다.')
    } catch {
      onFailure('클립보드 복사에 실패했습니다. 직접 선택해서 복사해 주세요.')
    }
  }

  const copyStylePrompt = async () => {
    await copyText(stylePrompt, setStyleCopyMessage, setStyleCopyMessage)
  }

  const copyHairPrompt = async () => {
    await copyText(hairPrompt, setHairCopyMessage, setHairCopyMessage)
  }

  const activeNav = view === 'style'
    ? 'gallery'
    : view === 'hair'
      ? 'stylist'
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
            alt="업로드한 미리보기"
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
          <span>내 생성형 AI로 가져가서 이미지 생성할 프롬프트 복사하기</span>
        </button>
      </section>
    )
  }

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
                {view === 'style' ? 'Body Style Report' : 'Personal Stylist'}
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
          {view === 'home' ? (
            <>
              <section className="hero-section">
                <h2 className="hero-title">
                  Choose the style recommendation <span>you want first.</span>
                </h2>
                <p className="hero-description">
                  Our AI-powered recommendation paths help you discover your
                  perfect look.
                </p>
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
                      <h3>Body Style Report</h3>
                      <AnalyticsIcon className="selection-heading-icon" />
                    </div>
                    <p>
                      A deep dive into silhouettes and cuts that flatter your
                      unique proportions and elevate your confidence.
                    </p>
                    <span className="primary-cta">
                      <span>Start Analysis</span>
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
                      <h3>Hairstyling Recommendation</h3>
                      <ScissorsIcon className="selection-heading-icon" />
                    </div>
                    <p>
                      Discover the perfect cut and color based on your face
                      shape, features, and personal aesthetic.
                    </p>
                    <span className="secondary-cta">
                      <span>Discover Looks</span>
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
                    label: 'Upload full-body photo',
                    helper: 'Drag and drop or click to browse',
                    selectLabel: 'Select Image',
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
                      <span>Height (cm)</span>
                      <div className="metric-input-wrap">
                        <input
                          inputMode="decimal"
                          onChange={(event) => setHeight(event.target.value)}
                          placeholder="e.g. 175"
                          type="text"
                          value={height}
                        />
                        <em>cm</em>
                      </div>
                    </label>

                    <label className="metric-field">
                      <span>Weight (kg)</span>
                      <div className="metric-input-wrap">
                        <input
                          inputMode="decimal"
                          onChange={(event) => setWeight(event.target.value)}
                          placeholder="e.g. 70"
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

                  <button className="action-button" disabled={isStyleLoading} type="submit">
                    {isStyleLoading ? 'Generating Analysis...' : 'Generate Analysis'}
                  </button>
                </form>
              </section>

              <section className="panel report-card">
                <div className="report-card-header">
                  <span className="panel-tag">AI Style Report</span>
                  <h3>Style Consulting Report</h3>
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
                        <p className="visual-caption">Recommended Outfit Construction</p>
                        <img
                          alt="Generated outfit direction based on the style report"
                          className="generated-image"
                          src={styleResultImage}
                        />
                      </section>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-state">
                    사진과 체형 정보를 입력하면 스타일 보고서와 착장 방향이 여기에
                    표시됩니다.
                  </div>
                )}
              </section>

              {renderPromptUtility({
                title: 'AI Prompt Utility',
                description:
                  'Use this copy-ready prompt in ChatGPT, Gemini, Stitch, or another image tool to generate more style visuals.',
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
                    label: 'Upload Your Photo',
                    helper: 'Drag and drop or tap to upload a clear portrait for AI hair analysis.',
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

                <button className="action-button" disabled={isHairLoading} type="submit" form="hair-form-hidden">
                  {isHairLoading ? 'Analyzing My Look...' : 'Analyze My Look'}
                </button>
                <form className="visually-hidden" id="hair-form-hidden" onSubmit={handleHairSubmit} />
              </section>

              <section className="panel report-card hair-report-card">
                <div className="center-header">
                  <span className="panel-tag">AI Hair Stylist</span>
                  <h3>3x3 Hairstyle Recommendations</h3>
                </div>

                {hairResultImage || hairDescription ? (
                  <>
                    {hairNote ? <p className="status-message fallback">{hairNote}</p> : null}
                    {hairCopyMessage ? (
                      <p className="status-message success">{hairCopyMessage}</p>
                    ) : null}
                    {hairResultImage ? (
                      <img
                        alt="3x3 hairstyle recommendations"
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
                  <div className="empty-state">
                    사진을 업로드하면 3x3 헤어스타일 추천 이미지와 설명이 여기에
                    표시됩니다.
                  </div>
                )}
              </section>

              {renderPromptUtility({
                title: 'Generative Prompt',
                description:
                  'Copy this optimized prompt to experiment with your own AI tools like ChatGPT, Gemini, or another image generator.',
                prompt: hairPrompt,
                note: '',
                copyMessage: hairCopyMessage,
                onCopy: copyHairPrompt,
              })}
            </>
          ) : null}
        </main>

        <nav className="bottom-nav">
          {navItems.map((item) => {
            const IconComponent = item.icon
            const isActive = activeNav === item.key
            const isClickable = item.key === 'home' || item.key === 'stylist' || item.key === 'gallery'

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
            }

            return (
              <button
                className={`nav-item ${isActive ? 'is-active' : ''}`}
                disabled={!isClickable}
                key={item.key}
                onClick={handleClick}
                type="button"
              >
                <IconComponent className="nav-icon" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default App
