import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import DemoBanner from './DemoBanner.jsx'
import styles from './Layout.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', exact: true },
  { to: '/embed', label: 'Embed' },
  { to: '/extract', label: 'Extract' },
  { to: '/metrics', label: 'Metrics' },
]

export default function Layout() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location])

  return (
    <div className={styles.layout}>
      <div className={styles.ambientBlob1} aria-hidden />
      <div className={styles.ambientBlob2} aria-hidden />
      <div className={styles.ambientBlob3} aria-hidden />

      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <NavLink to="/" className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                <path d="M14 7v14M7 14h14" stroke="#00e5a0" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="14" r="3" fill="#00e5a0" />
              </svg>
            </div>
            <span className={styles.logoText}>
              Spectra<span className={styles.logoAccent}>Vault</span> AI
            </span>
          </NavLink>

          <div className={styles.navLinks}>
            {NAV_ITEMS.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                {label}
              </NavLink>
            ))}
            <button 
              onClick={() => {
                localStorage.removeItem('isAuthenticated')
                window.location.href = '/login'
              }}
              style={{
                background: 'none', border: '1px solid var(--border-normal)', color: 'var(--text-secondary)',
                padding: '4px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', marginLeft: '12px'
              }}
            >
              Logout
            </button>
          </div>

          <div className={styles.statusBadge}>
            <span className={styles.statusDotDemo} />
            <span className={styles.mono} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              LSB + API
            </span>
          </div>

          <button
            type="button"
            className={styles.menuToggle}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
          >
            <span className={`${styles.menuBar} ${menuOpen ? styles.menuBarOpen1 : ''}`} />
            <span className={`${styles.menuBar} ${menuOpen ? styles.menuBarOpen2 : ''}`} />
            <span className={`${styles.menuBar} ${menuOpen ? styles.menuBarOpen3 : ''}`} />
          </button>
        </div>

        <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
          {NAV_ITEMS.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `${styles.mobileLink} ${isActive ? styles.mobileLinkActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className={styles.main}>
        <DemoBanner />
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <span className={styles.mono} style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              SpectraVault AI
            </span>
          </div>
          <div className={styles.footerTech}>
            {['AES-256-GCM', 'LSB', 'DCT', 'FFT', 'DenseNet-121'].map(tag => (
              <span key={tag} className={styles.footerTag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
