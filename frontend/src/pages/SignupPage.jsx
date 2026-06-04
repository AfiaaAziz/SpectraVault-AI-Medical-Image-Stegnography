import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signup } from '../api/spectravault.js'
import { setAuth } from '../lib/auth.js'
import styles from './AuthPage.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateSignup({ name, email, password, confirmPassword }) {
  const errors = {}
  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'Enter your full name.'
  else if (trimmedName.length < 2) errors.name = 'Name must be at least 2 characters.'

  const trimmedEmail = email.trim()
  if (!trimmedEmail) errors.email = 'Enter your email.'
  else if (!EMAIL_RE.test(trimmedEmail)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Enter your password.'
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.'

  if (!confirmPassword) errors.confirmPassword = 'Confirm your password.'
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'

  return errors
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const errors = validateSignup({ name, email, password, confirmPassword })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const data = await signup({
        full_name: name.trim(),
        email: email.trim(),
        password,
      })
      setAuth(data)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
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
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.sub}>Join SpectraVault AI today</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && <p className={styles.errorBanner}>{error}</p>}

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className={inputClass('name')}
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }))
              }}
              autoComplete="name"
            />
            {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
          </div>

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
              autoComplete="new-password"
            />
            {fieldErrors.password && <p className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className={inputClass('confirmPassword')}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }))
                }
              }}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && (
              <p className={styles.fieldError}>{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating account…' : 'Sign Up'}
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <div className={styles.footer}>
          Already have an account? <Link to="/login" className={styles.link}>Log In</Link>
        </div>
      </div>
    </div>
  )
}
