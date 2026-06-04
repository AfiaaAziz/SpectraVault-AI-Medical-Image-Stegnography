const TOKEN_KEY = 'access_token'
const USER_KEY = 'user'

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setAuth({ access_token, user }) {
  localStorage.setItem(TOKEN_KEY, access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem('isAuthenticated', 'true')
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem('isAuthenticated')
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}
