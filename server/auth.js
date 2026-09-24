import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { findUser, publicUser } from './users.js'

export function signToken(user) {
  return jwt.sign({ sub: user.username }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentification requise' })
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    // Le compte doit toujours exister : supprimer un utilisateur révoque ses sessions
    const user = findUser(payload.sub)
    if (!user) return res.status(401).json({ error: 'Compte introuvable' })
    req.user = publicUser(user)
    next()
  } catch {
    res.status(401).json({ error: 'Session expirée, reconnectez-vous' })
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Réservé aux administrateurs' })
  next()
}
