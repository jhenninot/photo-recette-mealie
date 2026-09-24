import { reactive } from 'vue'

const TOKEN_KEY = 'photo-recette-token'
const USER_KEY = 'photo-recette-user'

function load(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

export const session = reactive({
  token: load(TOKEN_KEY),
  user: JSON.parse(load(USER_KEY) || 'null')
})

export function setSession(token, user) {
  session.token = token
  session.user = user
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  } catch { /* stockage indisponible : session limitée à l'onglet */ }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  if (session.token) headers.Authorization = `Bearer ${session.token}`
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload })
  } catch {
    throw new Error('Serveur injoignable, vérifiez votre connexion')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && session.token) setSession(null, null)
  if (!res.ok) throw Object.assign(new Error(data.error || `Erreur ${res.status}`), { code: data.code })
  return data
}

// Réduit la photo avant envoi (les photos de téléphone font souvent 5 à 12 Mo)
export async function compressImage(file, maxSize = 2000, quality = 0.85) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}
