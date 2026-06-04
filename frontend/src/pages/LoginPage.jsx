import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/spectravault.js'
import { setAuth } from '../lib/auth.js'
import styles from './AuthPage.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateLogin({ email, password }) {
  const errors = {}
  const trimmedEmail = email.trim()
  if (!trimmedEmail) errors.email = 'Enter your email.'
  else if (!EMAIL_RE.test(trimmedEmail)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Enter your password.'

  return errors
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const errors = validateLogin({ email, password })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const data = await login({ email: email.trim(), password })
      setAuth(data)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field) =>
    `${styles.input} ${fieldErrors[field] ? styles.inputInvalid : ''}`

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.sub}>Log in to access your secure vault</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && <p className={styles.errorBanner}>{error}</p>}

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={inputClass('email')}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }))
              }}
              autoComplete="email"
            />
            {fieldErrors.email && <p className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={inputClass('password')}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }))
              }}
              autoComplete="current-password"
            />
            {fieldErrors.password && <p className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <div className={styles.footer}>
          Don't have an account? <Link to="/signup" className={styles.link}>Sign Up</Link>
        </div>
      </div>
    </div>
  )
}
