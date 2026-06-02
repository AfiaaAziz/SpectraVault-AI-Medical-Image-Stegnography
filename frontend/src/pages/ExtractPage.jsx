import { useState, useRef, useCallback, useEffect } from 'react'
import DemoBanner from '../components/DemoBanner.jsx'
import { extractImage } from '../api/spectravault.js'
import styles from './ExtractPage.module.css'

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

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
        style={{ display: 'none' }}
      />
      {file && thumbUrl ? (
        <div className={styles.fileInfo}>
          <img src={thumbUrl} alt="" className={styles.fileThumb} />
          <div>
            <p className={styles.fileName}>{file.name}</p>
            <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB · ready</p>
          </div>
        </div>
      ) : (
        <div className={styles.dropContent}>
          <svg viewBox="0 0 48 48" fill="none" width="40" height="40" aria-hidden>
            <rect x="6" y="6" width="36" height="36" rx="6" stroke="var(--border-normal)" strokeWidth="1.5" strokeDasharray="4 3" />
            <path d="M24 16v16M17 30l7 7 7-7" stroke="#00b8d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.dropText}>Drop stego image here</p>
          <p className={styles.dropHint}>Image produced by the embed step</p>
        </div>
      )}
    </div>
  )
}

function DecryptedCard({ data }) {
  const fields = [
    { key: 'Patient ID', val: data.pid },
    { key: 'Age', val: data.age },
    { key: 'Gender', val: data.gender === 'M' ? 'Male' : data.gender === 'F' ? 'Female' : data.gender },
    { key: 'View', val: data.view },
    { key: 'Source', val: data.source },
    { key: 'Diagnoses', val: data.diagnoses, wide: true },
  ]

  return (
    <div className={styles.decryptedCard}>
      <div className={styles.decryptedHeader}>
        <div className={styles.decryptedHeaderLeft}>
          <span className={styles.decryptedDot} />
          <span className={styles.decryptedTitle}>Decrypted patient record</span>
        </div>
        <span className={styles.decryptedBadge}>AES-256-GCM</span>
      </div>
      <div className={styles.decryptedFields}>
        {fields.map(f => (
          <div key={f.key} className={`${styles.decryptedField} ${f.wide ? styles.decryptedFieldWide : ''}`}>
            <div className={styles.decryptedFieldContent}>
              <span className={styles.decryptedFieldKey}>{f.key}</span>
              <span className={styles.decryptedFieldVal}>{f.val}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RawDataBlock({ raw }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(raw)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className={styles.rawBlock}>
      <div className={styles.rawBlockHeader}>
        <span>Raw extracted string</span>
        <button type="button" className={styles.copyBtn} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className={styles.rawCode}>{raw}</code>
    </div>
  )
}

function VerificationBadge({ status }) {
  const configs = {
    verified: {
      color: '#00e5a0',
      icon: '✓',
      label: 'Integrity verified',
      sub: 'GCM authentication tag verified — payload integrity confirmed.',
    },
    tampered: {
      color: '#ff6b35',
      icon: '✗',
      label: 'Integrity failed',
      sub: 'Tag mismatch — do not trust the plaintext.',
    },
    pending: {
      color: '#00b8d9',
      icon: '…',
      label: 'Verifying',
      sub: 'Checking authentication tag…',
    },
  }
  const cfg = configs[status]
  return (
    <div className={styles.verifyBadge} style={{ borderColor: `${cfg.color}33`, background: `${cfg.color}08` }}>
      <div className={styles.verifyIcon} style={{ color: cfg.color }}>
        {cfg.icon}
      </div>
      <div>
        <p className={styles.verifyLabel} style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className={styles.verifySub}>{cfg.sub}</p>
      </div>
    </div>
  )
}

export default function ExtractPage() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [method, setMethod] = useState('Auto-Detect')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [result, setResult] = useState(null)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const doExtract = async () => {
    if (!file || !password) return
    setExtracting(true)
    setResult(null)
    setError('')
    setVerifyStatus('pending')

    try {
      const apiMethod = method === 'Auto-Detect' ? 'AUTO' : method
      const data = await extractImage({ file, password, method: apiMethod })
      setVerifyStatus(data.verified ? 'verified' : 'tampered')
      setResult(data)
    } catch (err) {
      setVerifyStatus('tampered')
      setError(err.message || 'Extraction failed. Check password and that the API is running.')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.headerTag}>Decryption</span>
          <h1 className={styles.title}>Extract hidden data</h1>
          <p className={styles.sub}>
            Open a SpectraVault stego image, enter the embed password, and pick how the payload was hidden—or let auto-detect try each method.
          </p>
        </div>

        <DemoBanner variant="extract" />

        <div className={styles.grid}>
          <div className={styles.controls}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>01</span>
                Stego image
              </h2>
              <DropZone
                onFile={f => {
                  setFile(f)
                  setResult(null)
                  setError('')
                  setVerifyStatus(null)
                }}
                file={file}
              />
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>02</span>
                Extraction method
              </h2>
              <div className={styles.methodGrid}>
                {['LSB', 'DCT', 'FFT', 'Auto-Detect'].map(m => (
                  <button
                    type="button"
                    key={m}
                    className={`${styles.methodBtn} ${method === m ? styles.methodBtnActive : ''}`}
                    onClick={() => setMethod(m)}
                  >
                    {m}
                    {m === 'Auto-Detect' && <span className={styles.methodBtnSub}>Tries LSB → DCT → FFT</span>}
                  </button>
                ))}
              </div>
              <p className={styles.methodHint}>
                {method === 'Auto-Detect'
                  ? 'Tries LSB, then DCT, then FFT until decryption succeeds.'
                  : `${method} only — for images you know were embedded with that method.`}
              </p>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardNum}>03</span>
                Password
              </h2>
              <div className={styles.pwdWrap}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter decryption password"
                  onKeyDown={e => e.key === 'Enter' && doExtract()}
                  autoComplete="off"
                />
                <button type="button" className={styles.showBtn} onClick={() => setShowPwd(!showPwd)} aria-label="Toggle password visibility">
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className={styles.pwdHint}>Same password as at embed time.</p>

              <button type="button" className={styles.extractBtn} onClick={doExtract} disabled={!file || !password || extracting}>
                {extracting ? (
                  <>
                    <span className={styles.spinner} /> Extracting…
                  </>
                ) : (
                  <>Extract and decrypt</>
                )}
              </button>
            </div>
          </div>

          <div className={styles.resultPanel}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Stego preview</h2>
              {file && previewUrl ? (
                <div className={styles.imgWrap}>
                  <img src={previewUrl} alt="Stego preview" className={styles.previewImg} />
                  <div className={styles.imgOverlay}>
                    {result && <span className={styles.imgBadge}>{result.method} · verified</span>}
                  </div>
                  {extracting && <div className={styles.scanEffect} />}
                </div>
              ) : (
                <div className={styles.emptyImg}>
                  <svg viewBox="0 0 60 60" fill="none" width="50" height="50" aria-hidden>
                    <rect x="4" y="4" width="52" height="52" rx="6" stroke="var(--border-subtle)" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx="30" cy="30" r="12" stroke="var(--border-subtle)" strokeWidth="1" />
                  </svg>
                  <p>No image uploaded</p>
                </div>
              )}
            </div>

            {verifyStatus && (
              <div className={styles.card} style={{ padding: '16px' }}>
                <VerificationBadge status={verifyStatus} />
              </div>
            )}

            {result && (
              <div className={`${styles.card} ${styles.resultCard}`}>
                <DecryptedCard data={result} />
                <RawDataBlock raw={result.raw} />
                <div className={styles.resultMetrics}>
                  <div className={styles.resultMetric}>
                    <span className={`${styles.mono} ${styles.rmValPlain}`}>{result.method}</span>
                    <span className={styles.rmLabel}>Method</span>
                  </div>
                  <div className={styles.resultMetric}>
                    <span className={`${styles.mono} ${styles.rmValSecondary}`}>{result.success ? 'OK' : 'Fail'}</span>
                    <span className={styles.rmLabel}>Status</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className={styles.card}>
                <div className={styles.errorCard}>
                  <span>Extraction failed</span>
                  <p>{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
