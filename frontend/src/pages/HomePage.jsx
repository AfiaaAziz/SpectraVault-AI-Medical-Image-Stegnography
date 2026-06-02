import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import styles from './HomePage.module.css'

const PIPELINE_STEPS = [
  {
    num: '01',
    title: 'AI disease detection',
    desc: 'DenseNet-121 on NIH ChestX-ray14 suggests pathology labels that become part of the embedded record.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="36" height="36" aria-hidden>
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
        <path d="M12 20a8 8 0 1 0 16 0 8 8 0 0 0-16 0" stroke="#00e5a0" strokeWidth="1.5" />
        <path d="M20 16v8M16 20h8" stroke="#00e5a0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    tag: 'DenseNet-121',
    color: '#00e5a0',
  },
  {
    num: '02',
    title: 'AES-256-GCM encryption',
    desc: 'Metadata is sealed with AES-256-GCM; keys are derived from your password via PBKDF2.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="36" height="36" aria-hidden>
        <rect x="8" y="18" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 18v-5a7 7 0 0 1 14 0v5" stroke="#00b8d9" strokeWidth="1.5" />
        <circle cx="20" cy="26" r="2.5" fill="#00b8d9" />
        <path d="M20 28.5v2.5" stroke="#00b8d9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    tag: 'PBKDF2',
    color: '#00b8d9',
  },
  {
    num: '03',
    title: 'Steganography embedding',
    desc: 'LSB in the spatial domain, DCT in 8×8 blocks, or FFT in a frequency band—each trades capacity, fidelity, and robustness differently.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="36" height="36" aria-hidden>
        <rect x="6" y="6" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 14h28M6 22h28M14 6v28M22 6v28" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.3" />
        <circle cx="14" cy="14" r="2" fill="#a855f7" />
        <circle cx="22" cy="22" r="2" fill="#a855f7" />
        <circle cx="14" cy="30" r="2" fill="#a855f7" />
        <circle cx="30" cy="14" r="2" fill="#a855f7" />
      </svg>
    ),
    tag: 'LSB · DCT · FFT',
    color: '#a855f7',
  },
  {
    num: '04',
    title: 'Blind extraction and verify',
    desc: 'Hidden bits are recovered, decrypted, and checked against the GCM tag so tampering is caught before the record is shown.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="36" height="36" aria-hidden>
        <path d="M20 8C12 8 6 20 6 20s6 12 14 12 14-12 14-12S28 8 20 8z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="5" stroke="#ff6b35" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="2" fill="#ff6b35" />
        <path d="M32 32L27 27" stroke="#ff6b35" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    tag: 'PSNR · SSIM · MSE',
    color: '#ff6b35',
  },
]

const STATS = [
  { value: '112K', label: 'X-ray images', sub: 'NIH ChestX-ray14' },
  { value: '14', label: 'Pathologies', sub: 'Model output heads' },
  { value: '~72', label: 'dB PSNR (LSB)', sub: 'Typical LSB quality' },
  { value: '100%', label: 'LSB extraction', sub: 'When embed succeeds' },
]

const METHODS = [
  { name: 'LSB', domain: 'Spatial', capacity: 'High', robustness: 'Low', psnr: '≈ 72 dB', status: 'Live (API)' },
  { name: 'DCT', domain: 'Frequency', capacity: 'Med', robustness: 'Med', psnr: '—', status: 'In development' },
  { name: 'FFT', domain: 'Frequency', capacity: 'Med', robustness: 'High', psnr: '—', status: 'In development' },
]

function EcgLine() {
  return (
    <svg className={styles.ecgLine} viewBox="0 0 800 80" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0,40 L100,40 L120,40 L130,10 L140,70 L150,40 L180,40 L200,40 L220,40 L230,15 L240,65 L250,40 L280,40 L300,40 L320,40 L330,12 L340,68 L350,40 L380,40 L400,40 L420,40 L430,10 L440,70 L450,40 L480,40 L500,40 L520,40 L530,14 L540,66 L550,40 L580,40 L600,40 L620,40 L630,11 L640,69 L650,40 L680,40 L700,40 L720,40 L730,13 L740,67 L750,40 L800,40"
        fill="none"
        stroke="url(#ecgGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00e5a0" stopOpacity="0" />
          <stop offset="30%" stopColor="#00e5a0" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#00b8d9" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#00b8d9" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function GridBg() {
  return (
    <div className={styles.gridBg} aria-hidden>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,229,160,0.04)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}

export default function HomePage() {
  const [activeMethod, setActiveMethod] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMethod(m => (m + 1) % METHODS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`${styles.page} page-enter`}>
      <GridBg />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleLine1}>Medical data</span>
            <span className={styles.heroTitleLine2}>
              <em className={styles.serif}>Hidden in</em>
              <span className={styles.heroTitleAccent}>plain sight</span>
            </span>
          </h1>

          <p className={styles.heroSub}>
            SpectraVault encrypts patient metadata with AES-256-GCM and hides it inside chest X-rays using steganography.
            LSB embed and extract are served by the FastAPI backend; pathology scoring on Embed is preview-only for now.
          </p>

          <div className={styles.statusCard} role="note">
            <div className={styles.statusCardTitle}>Platform status</div>
            <ul className={styles.statusList}>
              <li>
                <strong>Notebook & API</strong> — LSB and AES round-trip verified; DCT and FFT recovery still in progress
              </li>
              <li>
                <strong>Web Embed / Extract</strong> — LSB when the FastAPI service is running
              </li>
              <li>
                <strong>Embed AI panel</strong> — sample scores until DenseNet-121 is served from the API
              </li>
            </ul>
          </div>

          <div className={styles.heroCtas}>
            <Link to="/embed" className={styles.ctaPrimary}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Open embed tool
            </Link>
            <Link to="/metrics" className={styles.ctaSecondary}>
              View metrics
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className={styles.ecgContainer}>
            <EcgLine />
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.xrayCard}>
            <div className={styles.xrayHeader}>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                PATIENT X-RAY · PREVIEW
              </span>
              <span className={styles.xrayLive}>DEMO</span>
            </div>

            <div className={styles.xrayImage}>
              <svg viewBox="0 0 260 220" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden>
                <ellipse cx="90" cy="110" rx="50" ry="75" stroke="rgba(0,229,160,0.2)" strokeWidth="1.5" fill="rgba(0,229,160,0.02)" />
                <ellipse cx="170" cy="110" rx="50" ry="75" stroke="rgba(0,229,160,0.2)" strokeWidth="1.5" fill="rgba(0,229,160,0.02)" />
                <rect x="127" y="40" width="6" height="150" rx="3" fill="rgba(0,229,160,0.08)" />
                {[60, 80, 100, 120, 140, 160].map((y, i) => (
                  <g key={i}>
                    <path d={`M127 ${y} Q${90 - i * 2} ${y + 8} ${50 + i * 2} ${y + 4}`} stroke="rgba(0,229,160,0.12)" strokeWidth="1" fill="none" />
                    <path d={`M133 ${y} Q${170 + i * 2} ${y + 8} ${210 - i * 2} ${y + 4}`} stroke="rgba(0,229,160,0.12)" strokeWidth="1" fill="none" />
                  </g>
                ))}
                <ellipse cx="120" cy="130" rx="22" ry="28" stroke="rgba(255,107,53,0.3)" strokeWidth="1" fill="rgba(255,107,53,0.04)" />
                <line x1="0" y1="0" x2="260" y2="0" stroke="rgba(0,229,160,0.6)" strokeWidth="1">
                  <animateTransform attributeName="transform" type="translate" from="0 0" to="0 220" dur="3s" repeatCount="indefinite" />
                </line>
                <rect x="60" y="80" width="80" height="60" rx="3" stroke="#00e5a0" strokeWidth="1" strokeDasharray="4 2" fill="none" opacity="0.6" />
                <text x="62" y="76" fill="#00e5a0" fontSize="7" fontFamily="monospace" opacity="0.8">
                  Atelectasis 0.72
                </text>
              </svg>

              <div className={styles.xrayDataOverlay}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={styles.xrayDataLine} style={{ animationDelay: `${i * 0.3}s` }}>
                    <span className="mono" style={{ fontSize: '9px', color: 'rgba(0,229,160,0.5)' }}>
                      {`${String(Math.floor(Math.random() * 255)).padStart(3, '0')} `.repeat(8)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.metaBlock}>
              {[
                ['PID', 'P00001'],
                ['AGE', '54 · M'],
                ['DX', 'Atelectasis, Effusion'],
                ['SRC', 'DenseNet121_AI'],
                ['ENC', 'AES-256-GCM ✓'],
              ].map(([k, v]) => (
                <div key={k} className={styles.metaRow}>
                  <span className={styles.metaKey}>{k}</span>
                  <span className={styles.metaVal}>{v}</span>
                </div>
              ))}
            </div>

            <div className={styles.xrayFooter}>
              <div className={styles.embedBadge}>
                <span className={styles.embedDot} />
                EMBEDDED · LSB
              </div>
              <span className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                PSNR: ~72 dB (eval)
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.statsBar}>
        {STATS.map((s, i) => (
          <div key={i} className={styles.statItem}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statSub}>{s.sub}</div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Architecture</span>
          <h2 className={styles.sectionTitle}>How SpectraVault AI works</h2>
          <p className={styles.sectionSub}>
            From raw X-ray to stego image and back—labeling, encryption, embedding, quality metrics, and authenticated extraction.
          </p>
        </div>

        <div className={styles.pipeline}>
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.num} className={styles.pipelineStep}>
              <div className={styles.pipelineNum}>{step.num}</div>
              <div className={styles.pipelineIcon} style={{ color: step.color }}>
                {step.icon}
              </div>
              <h3 className={styles.pipelineTitle}>{step.title}</h3>
              <p className={styles.pipelineDesc}>{step.desc}</p>
              <span className={styles.pipelineTag} style={{ borderColor: `${step.color}33`, color: step.color }}>
                {step.tag}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={styles.pipelineArrow}>
                  <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden>
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Steganography</span>
          <h2 className={styles.sectionTitle}>Three embedding methods</h2>
        </div>

        <div className={styles.methodTable}>
          <div className={styles.methodHeader}>
            {['Method', 'Domain', 'Capacity', 'Robustness', 'PSNR', 'Status'].map(h => (
              <div key={h} className={styles.methodHeadCell}>
                {h}
              </div>
            ))}
          </div>
          {METHODS.map((m, i) => (
            <div
              key={m.name}
              className={`${styles.methodRow} ${activeMethod === i ? styles.methodRowActive : ''}`}
              onMouseEnter={() => setActiveMethod(i)}
              role="row"
            >
              <div className={styles.methodCell}>
                <span className={styles.methodName} style={{ color: ['#00e5a0', '#00b8d9', '#a855f7'][i] }}>
                  {m.name}
                </span>
              </div>
              <div className={styles.methodCell}>{m.domain}</div>
              <div className={styles.methodCell}>
                <span className={`${styles.pill} ${styles[`pill${m.capacity}`]}`}>{m.capacity}</span>
              </div>
              <div className={styles.methodCell}>
                <span className={`${styles.pill} ${styles[`pill${m.robustness}`]}`}>{m.robustness}</span>
              </div>
              <div className={`${styles.methodCell} mono`} style={{ color: 'var(--accent-primary)' }}>
                {m.psnr}
              </div>
              <div className={styles.methodCell}>
                <span className={i === 0 ? styles.statusOk : styles.statusWarn}>{m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaSectionInner}>
          <h2 className={styles.ctaSectionTitle}>Protect metadata inside the image</h2>
          <p className={styles.ctaSectionSub}>
            Embed builds the stego image, Extract reads it back, and Metrics charts LSB evaluation. DCT and FFT views are illustrative while those pipelines are unfinished.
          </p>
          <div className={styles.heroCtas}>
            <Link to="/embed" className={styles.ctaPrimary}>
              Start embedding →
            </Link>
            <Link to="/extract" className={styles.ctaSecondary}>
              Extract data
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
