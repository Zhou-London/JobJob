import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

interface FormData {
  cvFile: File | null
  hasCV: boolean | null
  jobPosition: string
  jobType: string
  experiences: string
  nationality: string
  gender: string
  story: string
}

const TOTAL_STEPS = 7

function useSpeechToText(onResult: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const toggle = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1]
      if (last.isFinal) {
        onResult(last[0].transcript)
      }
    }

    recognition.onerror = () => {
      setRecording(false)
    }

    recognition.onend = () => {
      setRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }, [recording, onResult])

  return { recording, toggle }
}

function App() {
  const [step, setStep] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [data, setData] = useState<FormData>({
    cvFile: null,
    hasCV: null,
    jobPosition: '',
    jobType: '',
    experiences: '',
    nationality: '',
    gender: '',
    story: '',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const goNext = useCallback(() => {
    setAnimKey((k) => k + 1)
    setStep((s) => s + 1)
  }, [])

  const goBack = useCallback(() => {
    if (step > 0) {
      setAnimKey((k) => k + 1)
      setStep((s) => s - 1)
    }
  }, [step])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setData((d) => ({ ...d, cvFile: file, hasCV: file ? true : d.hasCV }))
  }

  const experiencesSpeech = useSpeechToText(
    useCallback(
      (text: string) =>
        setData((d) => ({
          ...d,
          experiences: d.experiences ? d.experiences + ' ' + text : text,
        })),
      []
    )
  )

  const storySpeech = useSpeechToText(
    useCallback(
      (text: string) =>
        setData((d) => ({
          ...d,
          story: d.story ? d.story + ' ' + text : text,
        })),
      []
    )
  )

  // Handle Enter key for text inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (step === 1 && data.jobPosition.trim()) {
          e.preventDefault()
          goNext()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step, data.jobPosition, goNext])

  const progress = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <div className="app">
      <div className="progress-bar" style={{ width: `${progress}%` }} />
      {step > 0 && (
        <button className="back-btn" onClick={goBack}>
          &larr; Back
        </button>
      )}

      {/* Step 0: Do you have a CV? */}
      {step === 0 && (
        <div key={animKey}>
          <h1 className="step-question fade-in">Do you have a CV?</h1>
          <div className="fade-in-delay">
            <div
              className={`upload-area ${data.cvFile ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {data.cvFile ? (
                <div className="file-name">{data.cvFile.name}</div>
              ) : (
                <>
                  <div className="upload-icon">&#8593;</div>
                  <div>Upload your CV</div>
                  <div className="upload-hint">PDF, DOC, DOCX</div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-input"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            <div className="btn-group">
              {data.cvFile && (
                <button className="btn btn-primary" onClick={() => {
                  setData((d) => ({ ...d, hasCV: true }))
                  goNext()
                }}>
                  Continue
                </button>
              )}
              <button
                className="btn"
                onClick={() => {
                  setData((d) => ({ ...d, hasCV: false, cvFile: null }))
                  goNext()
                }}
              >
                Nope
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Target job position */}
      {step === 1 && (
        <div key={animKey}>
          <h1 className="step-question fade-in">
            What's your target job position?
          </h1>
          <div className="fade-in-delay">
            <input
              className="text-input"
              type="text"
              placeholder="e.g. Frontend Engineer"
              value={data.jobPosition}
              onChange={(e) =>
                setData((d) => ({ ...d, jobPosition: e.target.value }))
              }
              autoFocus
            />
            <button
              className="btn btn-primary"
              disabled={!data.jobPosition.trim()}
              onClick={goNext}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Target job type */}
      {step === 2 && (
        <div key={animKey}>
          <h1 className="step-question fade-in">
            What's your target job type?
          </h1>
          <div className="fade-in-delay">
            <div className="choices">
              {['Full-time', 'Part-time', 'Intern'].map((type) => (
                <button
                  key={type}
                  className={`choice ${data.jobType === type ? 'selected' : ''}`}
                  onClick={() => setData((d) => ({ ...d, jobType: type }))}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              disabled={!data.jobType}
              onClick={goNext}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Experiences */}
      {step === 3 && (
        <div key={animKey}>
          <h1 className="step-question fade-in">Tell us about your experiences</h1>
          <div className="fade-in-delay">
            <textarea
              className="text-area"
              placeholder="Describe your work experiences, projects, and skills..."
              value={data.experiences}
              onChange={(e) =>
                setData((d) => ({ ...d, experiences: e.target.value }))
              }
              autoFocus
            />
            <div>
              <button
                className={`mic-btn ${experiencesSpeech.recording ? 'recording' : ''}`}
                onClick={experiencesSpeech.toggle}
              >
                <span className="mic-icon">&#9679;</span>
                {experiencesSpeech.recording ? 'Stop recording' : 'Speech to text'}
              </button>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <button
                className="btn btn-primary"
                disabled={!data.experiences.trim()}
                onClick={goNext}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: User info */}
      {step === 4 && (
        <div key={animKey}>
          <h1 className="step-question fade-in">A bit about you</h1>
          <div className="fade-in-delay">
            <div className="info-row">
              <div className="info-field">
                <div className="info-label">Nationality</div>
                <input
                  className="text-input"
                  type="text"
                  placeholder="e.g. American"
                  value={data.nationality}
                  onChange={(e) =>
                    setData((d) => ({ ...d, nationality: e.target.value }))
                  }
                  autoFocus
                />
              </div>
              <div className="info-field">
                <div className="info-label">Gender</div>
                <div className="choices" style={{ justifyContent: 'flex-start' }}>
                  {['Male', 'Female', 'Other'].map((g) => (
                    <button
                      key={g}
                      className={`choice ${data.gender === g ? 'selected' : ''}`}
                      onClick={() => setData((d) => ({ ...d, gender: g }))}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={!data.nationality.trim() || !data.gender}
              onClick={goNext}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Story */}
      {step === 5 && (
        <div key={animKey}>
          <h1 className="step-question fade-in">What's your story?</h1>
          <div className="fade-in-delay">
            <textarea
              className="text-area"
              placeholder="Share anything else you'd like us to know..."
              value={data.story}
              onChange={(e) =>
                setData((d) => ({ ...d, story: e.target.value }))
              }
              autoFocus
            />
            <div>
              <button
                className={`mic-btn ${storySpeech.recording ? 'recording' : ''}`}
                onClick={storySpeech.toggle}
              >
                <span className="mic-icon">&#9679;</span>
                {storySpeech.recording ? 'Stop recording' : 'Speech to text'}
              </button>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <button
                className="btn btn-primary"
                disabled={!data.story.trim()}
                onClick={goNext}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Summary */}
      {step === 6 && (
        <div key={animKey} className="summary">
          <h2 className="summary-title fade-in">Here's what you shared</h2>
          <div className="fade-in-delay">
            <div className="summary-item">
              <div className="summary-label">CV</div>
              <div className="summary-value">
                {data.cvFile ? data.cvFile.name : 'No CV uploaded'}
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Target Position</div>
              <div className="summary-value">{data.jobPosition}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Job Type</div>
              <div className="summary-value">{data.jobType}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Experiences</div>
              <div className="summary-value">{data.experiences}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Nationality</div>
              <div className="summary-value">{data.nationality}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Gender</div>
              <div className="summary-value">{data.gender}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Story</div>
              <div className="summary-value">{data.story}</div>
            </div>
          </div>
          <div className="fade-in-delay-2" style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button
              className="btn"
              onClick={() => {
                setStep(0)
                setAnimKey((k) => k + 1)
                setData({
                  cvFile: null,
                  hasCV: null,
                  jobPosition: '',
                  jobType: '',
                  experiences: '',
                  nationality: '',
                  gender: '',
                  story: '',
                })
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
