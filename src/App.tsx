import { useEffect, useState } from 'react'
import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
} from 'react'
import './App.css'

type StyleReportResponse = {
  report: string
  error?: string
}

function App() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoName, setPhotoName] = useState('아직 선택된 사진이 없습니다')
  const [photoPreview, setPhotoPreview] = useState('')
  const [report, setReport] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  const resetPhoto = () => {
    setPhotoFile(null)
    setPhotoName('아직 선택된 사진이 없습니다')

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    setPhotoPreview('')
  }

  const applySelectedPhoto = (file: File | null) => {
    if (!file) {
      resetPhoto()
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    setPhotoFile(file)
    setPhotoName(file.name)
    setPhotoPreview(URL.createObjectURL(file))
    setErrorMessage('')
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    applySelectedPhoto(event.target.files?.[0] ?? null)
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    applySelectedPhoto(event.dataTransfer.files?.[0] ?? null)
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

  const parseResponseJson = async (response: Response) => {
    const rawText = await response.text()

    if (!rawText.trim()) {
      return null
    }

    try {
      return JSON.parse(rawText) as StyleReportResponse
    } catch {
      throw new Error('서버 응답을 해석하지 못했습니다.')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!photoFile) {
      setErrorMessage('스타일 분석을 위해 본인 사진을 업로드해 주세요.')
      return
    }

    if (!height.trim() || !weight.trim()) {
      setErrorMessage('키와 몸무게를 모두 입력해 주세요.')
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage('')
      setReport('')

      const imageBase64 = await readFileAsBase64(photoFile)

      const response = await fetch('/api/style-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          height,
          weight,
          imageBase64,
          mimeType: photoFile.type || 'image/jpeg',
          preferredLocale: navigator.language || 'en-US',
        }),
      })

      const data = await parseResponseJson(response)

      if (!response.ok || !data?.report) {
        throw new Error(data?.error ?? '스타일 보고서를 생성하지 못했습니다.')
      }

      setReport(data.report)
    } catch (error) {
      const fallback = '스타일 보고서를 가져오는 중 문제가 발생했습니다.'
      setErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">PERSONAL STYLIST</p>
        <h1>내 체형에 맞는 스타일 제안을 시작해보세요.</h1>
        <p className="hero-copy">
          사진 한 장과 기본 신체 정보를 입력하면, AI 스타일리스트가 실루엣,
          핏, 추천 아이템 중심으로 개인화된 스타일 컨설팅 보고서를 제공합니다.
        </p>

        <div className="hero-card">
          <span>추천 흐름</span>
          <strong>사진 업로드</strong>
          <strong>체형 정보 입력</strong>
          <strong>스타일 보고서 받기</strong>
        </div>
      </section>

      <section className="form-panel">
        <div className="form-header">
          <p>스타일 프로필 만들기</p>
          <h2>기본 정보 입력</h2>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label
            className={`photo-field ${isDragging ? 'is-dragging' : ''}`}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <span className="field-label">본인 사진</span>
            <input
              accept="image/*"
              className="photo-input"
              onChange={handlePhotoChange}
              type="file"
            />

            <div className="photo-dropzone">
              {photoPreview ? (
                <img
                  alt="업로드한 프로필 미리보기"
                  className="photo-preview"
                  src={photoPreview}
                />
              ) : (
                <div className="photo-placeholder">
                  <strong>사진을 끌어다 놓거나 클릭해서 업로드하세요</strong>
                  <p>정면 전신 또는 상반신 사진이면 더 정확한 추천이 가능합니다.</p>
                </div>
              )}
            </div>

            <span className="photo-name">{photoName}</span>
          </label>

          <div className="metrics-grid">
            <label className="input-field">
              <span className="field-label">키</span>
              <div className="input-wrap">
                <input
                  inputMode="decimal"
                  onChange={(event) => setHeight(event.target.value)}
                  placeholder="예: 168"
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
                  placeholder="예: 55"
                  type="text"
                  value={weight}
                />
                <span>kg</span>
              </div>
            </label>
          </div>

          {errorMessage ? <p className="status-message error">{errorMessage}</p> : null}

          <button className="submit-button" disabled={isLoading} type="submit">
            {isLoading ? '스타일 보고서 생성 중...' : '스타일 추천 시작하기'}
          </button>
        </form>

        <section className="report-panel">
          <div className="report-header">
            <p>AI Style Report</p>
            <h3>스타일 컨설팅 보고서</h3>
          </div>

          {report ? (
            <article className="report-body">
              {report.split('\n').map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </article>
          ) : (
            <div className="report-placeholder">
              사진과 체형 정보를 입력한 뒤 보고서를 생성하면, 실루엣 분석과 추천
              룩 방향이 여기에 표시됩니다.
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
