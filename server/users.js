import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { config } from './config.js'

// Stockage minimaliste des comptes dans data/users.json :
// [{ username, passwordHash, isAdmin, theme, createdAt }]
const usersFile = path.join(config.dataDir, 'users.json')

export const USERNAME_RE = /^[a-z0-9._-]{2,32}$/
export const MIN_PASSWORD_LENGTH = 8
export const THEMES = ['auto', 'light', 'dark']

// Données du compte exposées au navigateur
export function publicUser(user) {
  return { username: user.username, isAdmin: !!user.isAdmin, theme: THEMES.includes(user.theme) ? user.theme : 'auto' }
}

function readAll() {
  if (!fs.existsSync(usersFile)) return []
  return JSON.parse(fs.readFileSync(usersFile, 'utf8'))
}

function writeAll(users) {
  const tmp = `${usersFile}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, usersFile)
}

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase()
}

export function listUsers() {
  return readAll().map(({ username, isAdmin, createdAt }) => ({ username, isAdmin: !!isAdmin, createdAt }))
}

export function findUser(username) {
  const name = normalizeUsername(username)
  return readAll().find(u => u.username === name) || null
}

function validate(username, password) {
  if (!USERNAME_RE.test(username)) {
    throw new Error('Identifiant invalide (2 à 32 caractères : lettres minuscules, chiffres, . _ -)')
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`)
  }
}

export async function createUser(username, password, { isAdmin = false } = {}) {
  const name = normalizeUsername(username)
  validate(name, password)
  const users = readAll()
  if (users.some(u => u.username === name)) throw new Error(`L'utilisateur « ${name} » existe déjà`)
  users.push({
    username: name,
    passwordHash: await bcrypt.hash(password, 12),
    isAdmin: !!isAdmin,
    createdAt: new Date().toISOString()
  })
  writeAll(users)
  return { username: name, isAdmin: !!isAdmin }
}

export async function setPassword(username, password) {
  const name = normalizeUsername(username)
  validate(name, password)
  const users = readAll()
  const user = users.find(u => u.username === name)
  if (!user) throw new Error(`Utilisateur « ${name} » introuvable`)
  user.passwordHash = await bcrypt.hash(password, 12)
  writeAll(users)
}

export function setTheme(username, theme) {
  if (!THEMES.includes(theme)) throw new Error('Thème inconnu')
  const name = normalizeUsername(username)
  const users = readAll()
  const user = users.find(u => u.username === name)
  if (!user) throw new Error(`Utilisateur « ${name} » introuvable`)
  user.theme = theme
  writeAll(users)
  return publicUser(user)
}

export function deleteUser(username) {
  const name = normalizeUsername(username)
  const users = readAll()
  const next = users.filter(u => u.username !== name)
  if (next.length === users.length) throw new Error(`Utilisateur « ${name} » introuvable`)
  const removed = users.find(u => u.username === name)
  if (removed.isAdmin && !next.some(u => u.isAdmin)) throw new Error('Impossible de supprimer le dernier administrateur')
  writeAll(next)
}

let dummyHash

export async function verifyPassword(username, password) {
  const user = findUser(username)
  // Comparaison factice si l'utilisateur n'existe pas, pour ne pas révéler son existence par le temps de réponse
  const hash = user?.passwordHash || (dummyHash ||= bcrypt.hashSync('dummy-password', 12))
  const ok = await bcrypt.compare(String(password || ''), hash)
  return ok && user ? user : null
}

// Crée le premier administrateur depuis ADMIN_USERNAME / ADMIN_PASSWORD si aucun compte n'existe
export async function bootstrapAdmin() {
  if (readAll().length > 0) return
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn('[users] Aucun compte. Définissez ADMIN_USERNAME et ADMIN_PASSWORD ou lancez « npm run user add <nom> ».')
    return
  }
  await createUser(ADMIN_USERNAME, ADMIN_PASSWORD, { isAdmin: true })
  console.log(`[users] Administrateur « ${normalizeUsername(ADMIN_USERNAME)} » créé`)
}
