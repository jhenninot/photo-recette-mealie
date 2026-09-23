import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { config, missingConfig } from './config.js'
import { requireAuth, requireAdmin, signToken } from './auth.js'
import { bootstrapAdmin, createUser, deleteUser, listUsers, setPassword, verifyPassword } from './users.js'
import { extractRecipe, generateRecipeImage } from './gemini.js'
import { checkMealie, sendRecipe } from './mealie.js'

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '15mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
})

// Petit utilitaire : transforme les erreurs async en réponse JSON
const handle = fn => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error(`[${req.method} ${req.path}]`, err.message)
    res.status(err.status || 500).json({ error: err.message || 'Erreur interne' })
  }
}
const badRequest = message => Object.assign(new Error(message), { status: 400 })

// === SANTÉ ===
app.get('/api/health', (req, res) => res.json({ ok: true, missingConfig: missingConfig() }))

// === AUTHENTIFICATION ===
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes' } })

app.post('/api/auth/login', loginLimiter, handle(async (req, res) => {
  const user = await verifyPassword(req.body?.username, req.body?.password)
  if (!user) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
  res.json({ token: signToken(user), user: { username: user.username, isAdmin: !!user.isAdmin } })
}))

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }))

app.post('/api/auth/password', requireAuth, handle(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!await verifyPassword(req.user.username, currentPassword)) throw badRequest('Mot de passe actuel incorrect')
  try {
    await setPassword(req.user.username, newPassword)
  } catch (err) { throw badRequest(err.message) }
  res.json({ ok: true })
}))

// === UTILISATEURS (admin) ===
app.get('/api/users', requireAuth, requireAdmin, (req, res) => res.json({ users: listUsers() }))

app.post('/api/users', requireAuth, requireAdmin, handle(async (req, res) => {
  const { username, password, isAdmin } = req.body || {}
  try {
    res.status(201).json({ user: await createUser(username, password, { isAdmin }) })
  } catch (err) { throw badRequest(err.message) }
}))

app.put('/api/users/:username/password', requireAuth, requireAdmin, handle(async (req, res) => {
  try {
    await setPassword(req.params.username, req.body?.password)
  } catch (err) { throw badRequest(err.message) }
  res.json({ ok: true })
}))

app.delete('/api/users/:username', requireAuth, requireAdmin, handle(async (req, res) => {
  if (req.params.username === req.user.username) throw badRequest('Vous ne pouvez pas supprimer votre propre compte')
  try {
    deleteUser(req.params.username)
  } catch (err) { throw badRequest(err.message) }
  res.json({ ok: true })
}))

// === RECETTES ===
// 1. Photo(s) de la page → recette structurée (les photos ne sont jamais conservées)
app.post('/api/recipes/extract', requireAuth, upload.array('photos', 4), handle(async (req, res) => {
  if (!req.files?.length) throw badRequest('Ajoutez au moins une photo')
  res.json({ recipe: await extractRecipe(req.files) })
}))

// 2. Recette → image générée
app.post('/api/recipes/image', requireAuth, handle(async (req, res) => {
  if (!req.body?.recipe?.name) throw badRequest('Recette manquante')
  res.json({ image: await generateRecipeImage(req.body.recipe) })
}))

// 3. Envoi dans Mealie
app.post('/api/recipes/mealie', requireAuth, handle(async (req, res) => {
  const { recipe, image } = req.body || {}
  if (!recipe?.name?.trim()) throw badRequest('Le nom de la recette est obligatoire')
  if (image && !/^image\/(png|jpeg|webp)$/.test(image.mimeType || '')) throw badRequest('Format d\'image non supporté')
  const result = await sendRecipe(recipe, image)
  console.log(`[mealie] « ${recipe.name} » ajoutée par ${req.user.username} → ${result.slug}`)
  res.json(result)
}))

app.get('/api/mealie/check', requireAuth, requireAdmin, handle(async (req, res) => {
  res.json(await checkMealie())
}))

// === FICHIERS STATIQUES (production) ===
const distDir = path.resolve('dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }))
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }))

await bootstrapAdmin()
const missing = missingConfig()
if (missing.length) console.warn(`[config] Variables manquantes : ${missing.join(', ')}`)
app.listen(config.port, () => console.log(`Photo Recette Mealie démarré sur http://localhost:${config.port}`))
