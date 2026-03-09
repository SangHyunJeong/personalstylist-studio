import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

function App() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [photoName, setPhotoName] = useState('아직 선택된 사진이 없습니다')
  const [photoPreview, setPhotoPreview] = useState('')

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      setPhotoName('아직 선택된 사진이 없습니다')
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoPreview('')
      return
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }

    setPhotoName(file.name)
    setPhotoPreview(URL.createObjectURL(file))
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">PERSONAL STYLIST</p>
        <h1>내 체형에 맞는 스타일 제안을 시작해보세요.</h1>
        <p className="hero-copy">
          사진 한 장과 기본 신체 정보를 입력하면, 퍼스널 스타일링 추천의
          출발점이 되는 프로필을 만들 수 있습니다.
        </p>

        <div className="hero-card">
          <span>추천 흐름</span>
          <strong>사진 업로드</strong>
          <strong>체형 정보 입력</strong>
          <strong>스타일 추천 받기</strong>
        </div>
      </section>

      <section className="form-panel">
        <div className="form-header">
          <p>스타일 프로필 만들기</p>
          <h2>기본 정보 입력</h2>
        </div>

        <form className="profile-form">
          <label className="photo-field">
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
                  <strong>정면 사진을 업로드하세요</strong>
                  <p>전신 또는 상반신 사진이면 더 정확한 추천이 가능합니다.</p>
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

          <button className="submit-button" type="button">
            스타일 추천 시작하기
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
