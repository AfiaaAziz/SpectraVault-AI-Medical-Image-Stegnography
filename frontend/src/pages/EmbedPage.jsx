import { useState, useRef, useCallback, useEffect } from 'react'
import DemoBanner from '../components/DemoBanner.jsx'
import { embedImage, base64ToBlob, analyzeImage } from '../api/spectravault.js'
import styles from './EmbedPage.module.css'

const METHODS = ['LSB', 'DCT', 'FFT']
const DISEASES = [
  'Atelectasis',
  'Cardiomegaly',
  'Consolidation',
  'Edema',
  'Effusion',
  'Emphysema',
  'Fibrosis',
  'Hernia',
  'Infiltration',
  'Mass',
  'Nodule',
  'Pleural_Thickening',
  'Pneumonia',
  'Pneumothorax',
]

function Step({ num, label, active, done }) {
  return (
    <div className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
      <div className={styles.stepNum}>
        {done ? (
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden>
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          num
        )}
      </div>
      <span className={styles.stepLabel}>{label}</span>
    </div>
  )
}

function DropZone({ onFile, file }) {
  const [dragging, setDragging] = useState(false)
  const [thumbUrl, setThumbUrl] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!file) {
      setThumbUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setThumbUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const handleDrop = useCallback(
    e => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) onFile(f)
    },
    [onFile],
  )

  const handleChange = e => {
    if (e.target.files[0]) onFile(e.target.files[0])
  }

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ''} ${file ? styles.dropZoneHasFile : ''}`}
      onDragOver={e => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
      {file && thumbUrl ? (
        <div className={styles.filePreview}>
          <img src={thumbUrl} alt="" className={styles.filePreviewImg} />
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      ) : (
        <div className={styles.dropContent}>
          <div className={styles.dropIcon}>
            <svg viewBox="0 0 48 48" fill="none" width="40" height="40" aria-hidden>
              <rect x="6" y="6" width="36" height="36" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
              <path d="M24 32V20M18 26l6-6 6 6" stroke="#00e5a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 36h18" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
            </svg>
          </div>
          <p className={styles.dropText}>Drop an X-ray image here</p>
          <p className={styles.dropSub}>PNG, JPG — any medical image</p>
        </div>
      )}
    </div>
  )
}

function PasswordInput({ value, onChange, label, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className={styles.inputGroup}>
      <label className={styles.inputLabel}>{label}</label>
      <div className={styles.passwordWrap}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={styles.input}
          autoComplete="new-password"
        />
        <button type="button" className={styles.showBtn} onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? (
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

function AIAnalysisResult({ running, done, diseases }) {
  if (!running && !done) return null
  return (
    <div className={styles.aiResult}>
      <div className={styles.aiResultHeader}>
        <span className={styles.aiResultTitle}>
          {running ? (
            <>
              <span className={styles.spinner} /> DenseNet-121 analyzing…
            </>
          ) : (
            <>AI detection complete</>
          )}
        </span>
      </div>
      {done && (
        <div className={styles.aiDiseases}>
          {diseases.map(([name, conf]) => (
            <div key={name} className={styles.aiDisease}>
              <div className={styles.aiDiseaseBar}>
                <div className={styles.aiDiseaseBarFill} style={{ width: `${conf * 100}%` }} />
              </div>
              <span className={styles.aiDiseaseName}>{name}</span>
              <span className={styles.aiDiseaseConf}>{(conf * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetadataPreview({ pid, age, gender, view, method, diseases }) {
  const metaStr = `PID:${pid}|AGE:${age}|GEN:${gender}|VIEW:${view}|SRC:DenseNet121_AI|DX:${diseases.join('|')}`
  return (
    <div className={styles.metaPreview}>
      <div className={styles.metaPreviewHeader}>
        <span>Metadata to embed</span>
        <span className={`${styles.methodPill} ${styles[`method${method}`]}`}>{method}</span>
      </div>
      <div className={styles.metaPreviewBody}>
        <code className={styles.metaCode}>{metaStr}</code>
      </div>
      <div className={styles.metaStats}>
        <span>{metaStr.length} chars</span>
        <span>AES-256-GCM</span>
        <span>{method} embed</span>
      </div>
    </div>
  )
}

export default function EmbedPage() {
  const [activeStep, setActiveStep] = useState(1)
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [method, setMethod] = useState('LSB')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pid, setPid] = useState('P00001')
  const [age, setAge] = useState('54')
  const [gender, setGender] = useState('M')
  const [view, setView] = useState('PA')
  const [selectedDiseases, setSelectedDiseases] = useState(['Atelectasis'])
  const [aiRunning, setAiRunning] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [aiDiseases, setAiDiseases] = useState([])
  const [embedding, setEmbedding] = useState(false)
  const [embedded, setEmbedded] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [stegoUrl, setStegoUrl] = useState(null)
  const [embedError, setEmbedError] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const u = URL.createObjectURL(imageFile)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [imageFile])

  useEffect(() => {
    return () => {
      if (stegoUrl) URL.revokeObjectURL(stegoUrl)
    }
  }, [stegoUrl])

  const handleImageFile = file => {
    setImageFile(file)
    setAiDone(false)
    setEmbedded(false)
    setMetrics(null)
    setEmbedError('')
    if (stegoUrl) {
      URL.revokeObjectURL(stegoUrl)
      setStegoUrl(null)
    }
    setActiveStep(2)
  }

  const [aiError, setAiError] = useState('')

  const runAI = async () => {
    if (!imageFile) return
    setAiRunning(true)
    setAiDone(false)
    setAiError('')
    try {
      const result = await analyzeImage({ file: imageFile, threshold: 0.3 })
      const detected = result.ranked.slice(0, 6).map(item => [item.name, item.confidence])
      setAiDiseases(detected)
      setSelectedDiseases(result.diagnoses.length ? result.diagnoses : detected.map(([n]) => n))
      setAiDone(true)
      setActiveStep(3)
    } catch (err) {
      setAiError(err.message || 'AI analysis failed. Is the API running with torchxrayvision installed?')
    } finally {
      setAiRunning(false)
    }
  }

  const skipAI = () => {
    setActiveStep(3)
  }

  const doEmbed = async () => {
    if (!password || password !== confirmPwd || !imageFile) return
    setEmbedding(true)
    setEmbedError('')
    setEmbedded(false)
    setMetrics(null)
    if (stegoUrl) {
      URL.revokeObjectURL(stegoUrl)
      setStegoUrl(null)
    }

    try {
      const diagnoses = selectedDiseases.length ? selectedDiseases.join('|') : 'No Finding'
      const result = await embedImage({
        file: imageFile,
        password,
        method,
        patientId: pid,
        age,
        gender,
        view,
        diagnoses,
        source: aiDone ? 'DenseNet121_AI' : 'WebUI',
      })
      const blob = base64ToBlob(result.stego_png_base64)
      const url = URL.createObjectURL(blob)
      setStegoUrl(url)
      setMetrics({ ...result.metrics, method: result.method, success: result.success })
      setEmbedded(true)
      setActiveStep(4)
    } catch (err) {
      setEmbedError(err.message || 'Embedding failed. Is the API running?')
    } finally {
      setEmbedding(false)
    }
  }

  const toggleDisease = d => {
    setSelectedDiseases(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))
  }

  const downloadStego = () => {
    if (!stegoUrl) return
    const a = document.createElement('a')
    a.href = stegoUrl
    a.download = `spectravault_stego_lsb_${imageFile?.name.replace(/\s+/g, '_') || 'image.png'}`
    a.click()
  }

  const displayUrl = embedded && stegoUrl ? stegoUrl : previewUrl

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.headerTag}>Steganography</span>
          <h1 className={styles.title}>Embed patient data</h1>
          <p className={styles.sub}>
            Chest X-ray in, encrypted metadata out. Optional AI-assisted labeling, then AES-256-GCM and your chosen embed method—LSB is the live path through the API.
          </p>
        </div>

        <DemoBanner variant="embed" />

        <div className={styles.steps}>
          <Step num="1" label="Upload image" active={activeStep === 1} done={activeStep > 1} />
          <div className={styles.stepLine} />
          <Step num="2" label="AI analysis" active={activeStep === 2} done={activeStep > 2} />
          <div className={styles.stepLine} />
          <Step num="3" label="Configure" active={activeStep === 3} done={activeStep > 3} />
          <div className={styles.stepLine} />
          <Step num="4" label="Result" active={activeStep === 4} done={false} />
        </div>

        <div className={styles.grid}>
          <div className={styles.controls}>
            <div className={`${styles.card} ${activeStep > 1 ? styles.cardDim : ''}`}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>01</span>
                Upload X-ray image
              </h2>
              <DropZone onFile={handleImageFile} file={imageFile} />
            </div>

            <div className={`${styles.card} ${activeStep < 2 ? styles.cardDim : ''}`}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>02</span>
                AI disease detection
              </h2>
              <p className={styles.cardDesc}>
                NIH ChestX-ray14–trained DenseNet-121; live pathology scores when the API is serving the model.
              </p>
              <div className={styles.aiBtnRow}>
                <button type="button" className={styles.aiBtn} onClick={runAI} disabled={!imageFile || aiRunning}>
                  {aiRunning ? (
                    <>
                      <span className={styles.spinner} /> Analyzing…
                    </>
                  ) : aiDone ? (
                    'Re-run AI analysis'
                  ) : (
                    'Run AI analysis'
                  )}
                </button>
                <button type="button" className={styles.skipBtn} onClick={skipAI} disabled={!imageFile || aiRunning}>
                  Skip — configure manually
                </button>
              </div>
              {aiError && <p className={styles.errorMsg}>{aiError}</p>}
              <AIAnalysisResult running={aiRunning} done={aiDone} diseases={aiDiseases} />

              {aiDone && (
                <div className={styles.diseaseOverride}>
                  <p className={styles.overrideLabel}>Override diagnoses</p>
                  <div className={styles.diseaseTags}>
                    {DISEASES.map(d => (
                      <button
                        type="button"
                        key={d}
                        className={`${styles.diseaseTag} ${selectedDiseases.includes(d) ? styles.diseaseTagActive : ''}`}
                        onClick={() => toggleDisease(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!aiDone && activeStep >= 3 && (
                <div className={styles.diseaseOverride}>
                  <p className={styles.overrideLabel}>Select diagnoses to embed</p>
                  <div className={styles.diseaseTags}>
                    {DISEASES.map(d => (
                      <button
                        type="button"
                        key={d}
                        className={`${styles.diseaseTag} ${selectedDiseases.includes(d) ? styles.diseaseTagActive : ''}`}
                        onClick={() => toggleDisease(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`${styles.card} ${activeStep < 3 ? styles.cardDim : ''}`}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>03</span>
                Configure embedding
              </h2>

              <div className={styles.inputGroup}>
                <span className={styles.inputLabel}>Steganography method</span>
                <div className={styles.methodToggle}>
                  {METHODS.map(m => (
                    <button
                      type="button"
                      key={m}
                      className={`${styles.methodBtn} ${method === m ? styles.methodBtnActive : ''}`}
                      onClick={() => setMethod(m)}
                    >
                      <span className={styles.methodBtnName}>{m}</span>
                      <span className={styles.methodBtnDesc}>
                        {m === 'LSB'
                          ? 'Spatial · 224px'
                          : m === 'DCT'
                            ? 'DCT blocks · 512px'
                            : 'Block DFT · 512px'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.patientGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="pid">
                    Patient ID
                  </label>
                  <input id="pid" className={styles.input} value={pid} onChange={e => setPid(e.target.value)} placeholder="P00001" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="age">
                    Age
                  </label>
                  <input id="age" className={styles.input} value={age} onChange={e => setAge(e.target.value)} placeholder="54" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="gender">
                    Gender
                  </label>
                  <select id="gender" className={styles.input} value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="view">
                    View
                  </label>
                  <select id="view" className={styles.input} value={view} onChange={e => setView(e.target.value)}>
                    <option value="PA">PA</option>
                    <option value="AP">AP</option>
                  </select>
                </div>
              </div>

              <PasswordInput label="Encryption password" value={password} onChange={setPassword} placeholder="Enter password" />
              <PasswordInput label="Confirm password" value={confirmPwd} onChange={setConfirmPwd} placeholder="Re-enter password" />
              {password && confirmPwd && password !== confirmPwd && <p className={styles.errorMsg}>Passwords do not match</p>}

              {(aiDone || activeStep >= 3) && (
                <MetadataPreview pid={pid} age={age} gender={gender} view={view} method={method} diseases={selectedDiseases} />
              )}

              {embedError && <p className={styles.errorMsg}>{embedError}</p>}

              <button
                type="button"
                className={styles.embedBtn}
                onClick={doEmbed}
                disabled={!imageFile || !password || password !== confirmPwd || embedding || activeStep < 3}
              >
                {embedding ? (
                  <>
                    <span className={styles.spinner} /> Embedding with {method}…
                  </>
                ) : (
                  <>Embed and encrypt</>
                )}
              </button>
            </div>
          </div>

          <div className={styles.preview}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>04</span>
                Live preview
              </h2>

              {imageFile && displayUrl ? (
                <div className={styles.previewImage}>
                  <img src={displayUrl} alt="Selected X-ray" className={styles.previewImg} />
                  <div className={styles.previewOverlay}>
                    {embedded && <div className={styles.embeddedBadge}>Embedded · {method}</div>}
                  </div>
                </div>
              ) : (
                <div className={styles.previewEmpty}>
                  <svg viewBox="0 0 80 80" fill="none" width="60" height="60" aria-hidden>
                    <rect x="4" y="4" width="72" height="72" rx="8" stroke="var(--border-normal)" strokeWidth="1.5" strokeDasharray="5 3" />
                    <circle cx="40" cy="40" r="16" stroke="var(--border-subtle)" strokeWidth="1" />
                    <path d="M40 32v16M32 40h16" stroke="var(--border-normal)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p>Upload an image to preview</p>
                </div>
              )}

              {embedded && metrics && (
                <div className={styles.metricsResult}>
                  <div className={styles.metricsResultTitle}>
                    <span className={styles.successDot} />
                    Embedding complete
                  </div>
                  <div className={styles.metricsGrid}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricVal}>{metrics.psnr} dB</span>
                      <span className={styles.metricKey}>PSNR</span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricVal}>{metrics.ssim}</span>
                      <span className={styles.metricKey}>SSIM</span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricVal}>{metrics.mse}</span>
                      <span className={styles.metricKey}>MSE</span>
                    </div>
                  </div>
                  <div className={styles.qualityLabel}>
                    {metrics.psnr >= 45 ? 'Excellent — visually stable' : metrics.psnr >= 35 ? 'Good' : 'Fair'}
                  </div>
                  <button type="button" className={styles.downloadBtn} onClick={downloadStego} disabled={!stegoUrl}>
                    Download stego image
                  </button>
                  <DemoBanner variant="embed-download" />
                </div>
              )}
            </div>

            <div className={`${styles.card} ${styles.pipelineSummary}`}>
              <h3 className={styles.cardTitle} style={{ fontSize: '13px' }}>
                Embedding pipeline
              </h3>
              <div className={styles.pipelineFlow}>
                {[
                  { label: 'X-ray image', done: !!imageFile },
                  { label: 'AI detection', done: aiDone },
                  { label: 'AES-256-GCM', done: !!password && password === confirmPwd },
                  { label: `${method} embed`, done: embedded },
                  { label: 'Stego image', done: embedded },
                ].map((s, i, arr) => (
                  <div key={s.label} className={styles.pipelineNode}>
                    <div className={`${styles.pipelineNodeDot} ${s.done ? styles.pipelineNodeDotDone : ''}`}>{s.done ? '✓' : '·'}</div>
                    <span className={`${styles.pipelineNodeLabel} ${s.done ? styles.pipelineNodeLabelDone : ''}`}>{s.label}</span>
                    {i < arr.length - 1 && <div className={`${styles.pipelineNodeLine} ${s.done ? styles.pipelineNodeLineDone : ''}`} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
