import crypto from 'node:crypto'
import { config } from './config.js'

async function api(path, { method = 'GET', body, form } = {}) {
  if (!config.mealie.url || !config.mealie.token) throw new Error('MEALIE_URL / MEALIE_TOKEN non configurés')
  const headers = { Authorization: `Bearer ${config.mealie.token}`, Accept: 'application/json' }
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${config.mealie.url}${path}`, { method, headers, body: payload })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Mealie ${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  }
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Récupère ou crée un tag Mealie par son nom
async function resolveTag(name, cache) {
  const key = slugify(name)
  if (!key) return null
  if (!cache.has(key)) {
    const found = await api(`/api/organizers/tags?search=${encodeURIComponent(name)}&perPage=50`)
    const existing = (found?.items || []).find(t => t.slug === key || slugify(t.name) === key)
    cache.set(key, existing || await api('/api/organizers/tags', { method: 'POST', body: { name } }))
  }
  const tag = cache.get(key)
  return tag ? { id: tag.id, name: tag.name, slug: tag.slug } : null
}

async function recipeUrl(slug) {
  const base = config.mealie.publicUrl
  try {
    // Mealie v2 : /g/<groupe>/r/<slug>
    const group = await api('/api/groups/self')
    if (group?.slug) return `${base}/g/${group.slug}/r/${slug}`
  } catch { /* Mealie v1 */ }
  return `${base}/recipe/${slug}`
}

function extensionFor(mimeType) {
  return { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }[mimeType] || 'png'
}

export async function sendRecipe(recipe, image) {
  const slug = await api('/api/recipes', { method: 'POST', body: { name: recipe.name } })
  try {
    const current = await api(`/api/recipes/${slug}`)
    const tagCache = new Map()
    const tags = []
    for (const name of recipe.tags || []) {
      const tag = await resolveTag(name, tagCache)
      if (tag && !tags.some(t => t.id === tag.id)) tags.push(tag)
    }

    const notes = []
    if (recipe.notes) notes.push({ title: 'Conseils', text: recipe.notes })
    if (recipe.source) notes.push({ title: 'Source', text: recipe.source })

    const updated = {
      ...current,
      name: recipe.name,
      description: recipe.description || '',
      recipeYield: recipe.recipeYield || '',
      recipeServings: Number(recipe.servings) || current.recipeServings || 0,
      prepTime: recipe.prepTime || null,
      performTime: recipe.cookTime || null,
      cookTime: recipe.cookTime || null,
      totalTime: recipe.totalTime || null,
      // Ingrédients en texte libre (quantité incluse dans la note) : pas de parsing unité/aliment
      recipeIngredient: (recipe.ingredients || []).filter(Boolean).map(line => ({
        referenceId: crypto.randomUUID(),
        title: null,
        note: line,
        display: line,
        originalText: line,
        quantity: 0,
        unit: null,
        food: null,
        disableAmount: true
      })),
      recipeInstructions: (recipe.instructions || []).filter(Boolean).map(text => ({
        id: crypto.randomUUID(),
        title: '',
        summary: '',
        text,
        ingredientReferences: []
      })),
      tags,
      notes,
      settings: { ...(current.settings || {}), disableAmount: true }
    }
    await api(`/api/recipes/${slug}`, { method: 'PUT', body: updated })

    if (image?.data) {
      const ext = extensionFor(image.mimeType)
      const form = new FormData()
      form.append('image', new Blob([Buffer.from(image.data, 'base64')], { type: image.mimeType }), `image.${ext}`)
      form.append('extension', ext)
      await api(`/api/recipes/${slug}/image`, { method: 'PUT', form })
    }
  } catch (err) {
    // Évite de laisser une recette vide dans Mealie en cas d'échec
    await api(`/api/recipes/${slug}`, { method: 'DELETE' }).catch(() => {})
    throw err
  }
  return { slug, url: await recipeUrl(slug) }
}

export async function checkMealie() {
  const me = await api('/api/users/self')
  return { ok: true, user: me?.username || me?.email }
}
