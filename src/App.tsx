import { useEffect, useState } from 'react'
import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
} from 'react'
import './App.css'

type StyleReportResponse = {
  report: string
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

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light'
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

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [view, setView] = useState<View>(getInitialView)

  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [stylePhotoFile, setStylePhotoFile] = useState<File | null>(null)
  const [stylePhotoName, setStylePhotoName] = useState('아직 선택된 사진이 없습니다')
  const [stylePhotoPreview, setStylePhotoPreview] = useState('')
  const [styleReport, setStyleReport] = useState('')
  const [styleErrorMessage, setStyleErrorMessage] = useState('')
  const [isStyleLoading, setIsStyleLoading] = useState(false)
  const [isStyleDragging, setIsStyleDragging] = useState(false)

  const [hairPhotoFile, setHairPhotoFile] = useState<File | null>(null)
  const [hairPhotoName, setHairPhotoName] = useState('아직 선택된 사진이 없습니다')
  const [hairPhotoPreview, setHairPhotoPreview] = useState('')
  const [hairDescription, setHairDescription] = useState('')
  const [hairResultImage, setHairResultImage] = useState('')
  const [hairPrompt, setHairPrompt] = useState('')
  const [hairNote, setHairNote] = useState('')
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

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

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

  const updateStylePhoto = (file: File | null) => {
    if (!file) {
      setStylePhotoFile(null)
      setStylePhotoName('아직 선택된 사진이 없습니다')

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
      setHairPhotoName('아직 선택된 사진이 없습니다')

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

      if (data.mode === 'image' && data.imageBase64 && data.mimeType) {
        setHairResultImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      }

      if (data.mode === 'prompt') {
        setHairPrompt(data.prompt ?? data.description)
      }
    } catch (error) {
      const fallback = '헤어스타일 추천 이미지를 가져오는 중 문제가 발생했습니다.'
      setHairErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsHairLoading(false)
    }
  }

  const renderRichTextLine = (line: string) => {
    const segments = line.split(/(\*\*.*?\*\*)/g).filter(Boolean)

    return segments.map((segment, index): ReactNode => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={`${segment}-${index}`}>{segment.slice(2, -2)}</strong>
      }

      return <span key={`${segment}-${index}`}>{segment}</span>
    })
  }

  const copyHairPrompt = async () => {
    if (!hairPrompt) {
      return
    }

    try {
      await navigator.clipboard.writeText(hairPrompt)
      setHairNote('프롬프트를 클립보드에 복사했습니다.')
    } catch {
      setHairNote('클립보드 복사에 실패했습니다. 직접 선택해서 복사해 주세요.')
    }
  }

  const renderPhotoField = ({
    label,
    isDragging,
    preview,
    name,
    onChange,
    onDragOver,
    onDragLeave,
    onDrop,
  }: {
    label: string
    isDragging: boolean
    preview: string
    name: string
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
    onDragOver: (event: DragEvent<HTMLLabelElement>) => void
    onDragLeave: (event: DragEvent<HTMLLabelElement>) => void
    onDrop: (event: DragEvent<HTMLLabelElement>) => void
  }) => (
    <label
      className={`photo-field ${isDragging ? 'is-dragging' : ''}`}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="field-label">{label}</span>
      <input
        accept="image/*"
        className="photo-input"
        onChange={onChange}
        type="file"
      />

      <div className="photo-dropzone">
        {preview ? (
          <img
            alt="업로드한 프로필 미리보기"
            className="photo-preview"
            src={preview}
          />
        ) : (
          <div className="photo-placeholder">
            <strong>사진을 끌어다 놓거나 클릭해서 업로드하세요</strong>
            <p>정면 전신 또는 상반신 사진이면 더 정확한 추천이 가능합니다.</p>
          </div>
        )}
      </div>

      <span className="photo-name">{name}</span>
    </label>
  )

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-topbar">
          <div className="hero-actions">
            {view !== 'home' ? (
              <button
                className="back-button"
                onClick={() => setView('home')}
                type="button"
              >
                홈으로
              </button>
            ) : null}
            <p className="eyebrow">PERSONAL STYLIST</p>
          </div>

          <button className="theme-toggle" onClick={toggleTheme} type="button">
            {theme === 'dark' ? '라이트 모드' : '다크 모드'}
          </button>
        </div>

        {view === 'home' ? (
          <>
            <h1>어떤 스타일 추천을 받을지 먼저 선택하세요.</h1>
            <p className="hero-copy">
              체형 기반 코디 추천과 헤어스타일링 추천을 분리해서, 같은 사진으로도
              다른 방향의 스타일 컨설팅을 받을 수 있게 구성했습니다.
            </p>

            <div className="mode-grid">
              <button
                className="mode-card"
                onClick={() => setView('style')}
                type="button"
              >
                <span>1</span>
                <strong>체형에 맞는 스타일 제안</strong>
                <p>사진, 키, 몸무게를 바탕으로 코디와 핏 중심의 보고서를 생성합니다.</p>
              </button>

              <button
                className="mode-card"
                onClick={() => setView('hair')}
                type="button"
              >
                <span>2</span>
                <strong>헤어스타일링 추천</strong>
                <p>사진 속 얼굴은 유지한 채, 잘 어울리는 헤어스타일 9가지를 3x3 그리드로 생성합니다.</p>
              </button>
            </div>
          </>
        ) : view === 'style' ? (
          <>
            <h1>체형에 맞는 스타일 보고서를 생성해보세요.</h1>
            <p className="hero-copy">
              체형 정보와 얼굴 인상을 함께 참고해, 옷의 핏과 실루엣, 코디 방향을
              텍스트 보고서로 정리해드립니다.
            </p>
          </>
        ) : (
          <>
            <h1>얼굴은 그대로, 헤어스타일만 바꿔서 추천받아보세요.</h1>
            <p className="hero-copy">
              AI 헤어스타일리스트가 첨부한 사진 속 인물의 얼굴을 유지한 채, 가장
              잘 어울리는 헤어스타일 9개를 3x3 그리드 이미지로 생성합니다.
            </p>
          </>
        )}
      </section>

      {view === 'style' ? (
        <>
          <section className="content-panel">
            <div className="form-header">
              <p>Style Report</p>
              <h2>기본 정보 입력</h2>
            </div>

            <form className="profile-form" onSubmit={handleStyleSubmit}>
              {renderPhotoField({
                label: '본인 사진',
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
                <label className="input-field">
                  <span className="field-label">키</span>
                  <div className="input-wrap">
                    <input
                      inputMode="decimal"
                      onChange={(event) => setHeight(event.target.value)}
                      placeholder="예: 170"
                      type="text"
                      value={height}
                    />
                    <span>cm</span>
                  </div>
                </label>

                <label className="input-field">
                  <span className="field-label">몸무게</span>
                  <div className="input-wrap">
                    <input
                      inputMode="decimal"
                      onChange={(event) => setWeight(event.target.value)}
                      placeholder="예: 70"
                      type="text"
                      value={weight}
                    />
                    <span>kg</span>
                  </div>
                </label>
              </div>

              {styleErrorMessage ? (
                <p className="status-message error">{styleErrorMessage}</p>
              ) : null}

              <button className="submit-button" disabled={isStyleLoading} type="submit">
                {isStyleLoading ? '스타일 보고서 생성 중...' : '체형 스타일 추천받기'}
              </button>
            </form>
          </section>

          <section className="report-panel">
            <div className="report-header">
              <p>AI Style Report</p>
              <h3>스타일 컨설팅 보고서</h3>
            </div>

            {styleReport ? (
              <article className="report-body">
                {styleReport.split('\n').map((line, index) => (
                  <p key={`${line}-${index}`}>{renderRichTextLine(line)}</p>
                ))}
              </article>
            ) : (
              <div className="report-placeholder">
                사진과 체형 정보를 입력한 뒤 보고서를 생성하면, 실루엣 분석과 추천
                룩 방향이 여기에 표시됩니다.
              </div>
            )}
          </section>
        </>
      ) : null}

      {view === 'hair' ? (
        <>
          <section className="content-panel">
            <div className="form-header">
              <p>Hair Styling</p>
              <h2>헤어스타일링 추천</h2>
            </div>

            <p className="section-copy">
              업로드한 사진 속 얼굴은 유지한 채, 가장 잘 어울리는 헤어스타일 9개를
              3x3 그리드 이미지와 설명으로 생성합니다.
            </p>

            <form className="profile-form" onSubmit={handleHairSubmit}>
              {renderPhotoField({
                label: '헤어스타일링용 사진',
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

              {hairErrorMessage ? (
                <p className="status-message error">{hairErrorMessage}</p>
              ) : null}

              <button className="submit-button" disabled={isHairLoading} type="submit">
                {isHairLoading ? '헤어스타일 추천 생성 중...' : '헤어스타일 추천받기'}
              </button>
            </form>
          </section>

          <section className="report-panel">
            <div className="report-header">
              <p>AI Hair Stylist</p>
              <h3>3x3 헤어스타일 추천</h3>
            </div>

            {hairResultImage ? (
              <div className="hair-result">
                {hairNote ? <p className="status-message fallback">{hairNote}</p> : null}
                <img
                  alt="추천된 3x3 헤어스타일 그리드"
                  className="hair-result-image"
                  src={hairResultImage}
                />
                <article className="report-body">
                  {hairDescription.split('\n').map((line, index) => (
                    <p key={`${line}-${index}`}>{renderRichTextLine(line)}</p>
                  ))}
                </article>
              </div>
            ) : hairPrompt ? (
              <div className="hair-result">
                {hairNote ? <p className="status-message fallback">{hairNote}</p> : null}
                <div className="prompt-panel">
                  <div className="prompt-header">
                    <strong>외부 툴용 복사 프롬프트</strong>
                    <button className="copy-button" onClick={copyHairPrompt} type="button">
                      프롬프트 복사
                    </button>
                  </div>
                  <pre className="prompt-box">{hairPrompt}</pre>
                </div>
                <article className="report-body">
                  {hairDescription.split('\n').map((line, index) => (
                    <p key={`${line}-${index}`}>{renderRichTextLine(line)}</p>
                  ))}
                </article>
              </div>
            ) : (
              <div className="report-placeholder">
                사진을 업로드한 뒤 추천을 생성하면, 얼굴은 유지한 3x3 헤어스타일
                이미지가 생성되거나, 외부 툴에 붙여넣을 수 있는 프롬프트가
                여기에 표시됩니다.
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default App
