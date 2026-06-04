const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function readError(res) {
  try {
    const body = await res.json()
    return body.detail || body.message || res.statusText
  } catch {
    return res.statusText || 'Request failed'
  }
}

export async function signup({ full_name, email, password }) {
  const res = await fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, email, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function login({ email, password }) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function checkApiHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function analyzeImage({ file, threshold = 0.3 }) {
  const form = new FormData()
  form.append('image', file)
  form.append('threshold', String(threshold))

  const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function embedImage({
  file,
  password,
  method = 'LSB',
  patientId,
  age,
  gender,
  view,
  diagnoses,
  source = 'WebUI',
}) {
  const form = new FormData()
  form.append('image', file)
  form.append('password', password)
  form.append('method', method)
  form.append('patient_id', patientId)
  form.append('age', String(age))
  form.append('gender', gender)
  form.append('view', view)
  form.append('diagnoses', Array.isArray(diagnoses) ? diagnoses.join('|') : diagnoses)
  form.append('source', source)

  const res = await fetch(`${API_BASE}/embed`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function extractImage({ file, password, method = 'AUTO' }) {
  const form = new FormData()
  form.append('image', file)
  form.append('password', password)
  form.append('method', method)

  const res = await fetch(`${API_BASE}/extract`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export function base64ToBlob(base64, mime = 'image/png') {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
