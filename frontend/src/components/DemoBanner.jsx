import styles from './DemoBanner.module.css'

export default function DemoBanner({ variant = 'global' }) {
  if (variant === 'embed-download') {
    return (
      <p className={styles.downloadWarning} role="note">
        Stego PNG from the API (LSB + AES-256-GCM). Decrypt on Extract with the same password.
      </p>
    )
  }

  if (variant === 'embed') {
    return (
      <div className={styles.banner} role="note">
        <strong>API-backed embed</strong> — LSB at 224×224; DCT and FFT at 512×512. AI labels are preview until DenseNet is served from the API.
      </div>
    )
  }

  if (variant === 'extract') {
    return (
      <div className={styles.banner} role="note">
        <strong>API-backed extract</strong> — LSB, DCT, or frequency-band recovery. Same password and method as embed, or auto-detect.
      </div>
    )
  }

  if (variant === 'metrics') {
    return (
      <div className={styles.banner} role="note">
        LSB values load from evaluation when available. DCT, FFT, robustness, and accuracy series are illustrative while those extractors are still incomplete.
      </div>
    )
  }

  return (
    <div className={styles.bannerGlobal} role="note">
      <span className={styles.badge}>Hybrid</span>
      <span>
        LSB embed and extract run through the API when it is online. Some AI and metric views are illustrative; DCT/FFT pipelines are not production-ready. Not intended for clinical use without independent review.
      </span>
    </div>
  )
}
