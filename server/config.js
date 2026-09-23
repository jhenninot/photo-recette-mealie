import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const dataDir = path.resolve(process.env.DATA_DIR || 'data')
fs.mkdirSync(dataDir, { recursive: true })

// Secret JWT : fourni par l'environnement, sinon généré une fois et conservé dans data/
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const file = path.join(dataDir, 'jwt-secret')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const secret = crypto.randomBytes(48).toString('hex')
  fs.writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

export const config = {
  port: Number(process.env.PORT || 3000),
  dataDir,
  jwtSecret: loadJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    textModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
  },
  mealie: {
    url: (process.env.MEALIE_URL || '').replace(/\/+$/, ''),
    publicUrl: (process.env.MEALIE_PUBLIC_URL || process.env.MEALIE_URL || '').replace(/\/+$/, ''),
    token: process.env.MEALIE_TOKEN || ''
  }
}

export function missingConfig() {
  const missing = []
  if (!config.gemini.apiKey) missing.push('GEMINI_API_KEY')
  if (!config.mealie.url) missing.push('MEALIE_URL')
  if (!config.mealie.token) missing.push('MEALIE_TOKEN')
  return missing
}
