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

// Récupère ou crée un tag / une catégorie Mealie par son nom
async function resolveOrganizer(kind, name, cache) {
  const key = slugify(name)
  if (!key) return null
  if (!cache.has(key)) {
    const found = await api(`/api/organizers/${kind}?search=${encodeURIComponent(name)}&perPage=50`)
    const existing = (found?.items || []).find(t => t.slug === key || slugify(t.name) === key)
    cache.set(key, existing || await api(`/api/organizers/${kind}`, { method: 'POST', body: { name } }))
  }
  const item = cache.get(key)
  return item ? { id: item.id, name: item.name, slug: item.slug } : null
}

async function resolveOrganizers(kind, names) {
  const cache = new Map()
  const items = []
  for (const name of names || []) {
    const item = await resolveOrganizer(kind, name, cache)
    if (item && !items.some(i => i.id === item.id)) items.push(item)
  }
  return items
}

export async function categoryNames() {
  try {
    const page = await api('/api/organizers/categories?perPage=-1')
    return (page?.items || []).map(c => c.name).filter(Boolean)
  } catch (err) {
    console.warn('[mealie] catégories indisponibles :', err.message)
    return []
  }
}

// Unités et aliments Mealie, gardés quelques minutes en mémoire
const CATALOG_TTL = 5 * 60 * 1000
const catalogs = { units: null, foods: null }

async function catalog(kind) {
  const cached = catalogs[kind]
  if (!cached || Date.now() - cached.at > CATALOG_TTL) {
    const page = await api(`/api/${kind}?perPage=-1`)
    catalogs[kind] = { at: Date.now(), items: page?.items || [] }
  }
  return catalogs[kind].items
}

const keysOf = item => [item.name, item.pluralName, item.abbreviation, item.pluralAbbreviation,
  ...(item.aliases || []).map(a => a.name)].filter(Boolean).map(slugify)

// Récupère ou crée une unité / un aliment Mealie par son nom (ou pluriel, abréviation, alias)
async function resolveCatalogItem(kind, name) {
  const key = slugify(name || '')
  if (!key) return null
  const items = await catalog(kind)
  let item = items.find(i => keysOf(i).includes(key))
  if (!item) {
    item = await api(`/api/${kind}`, { method: 'POST', body: { name: name.trim() } })
    items.push(item)
  }
  return item
}

export async function unitNames() {
  try {
    return (await catalog('units')).map(u => u.name).filter(Boolean)
  } catch (err) {
    console.warn('[mealie] unités indisponibles :', err.message)
    return []
  }
}

async function buildIngredients(ingredients) {
  const result = []
  let title = null
  for (const ing of ingredients || []) {
    const food = ing.food?.trim()
    const note = ing.note?.trim() || ''
    // Ligne de groupe (« Pour la sauce ») : devient le titre de l'ingrédient suivant
    if (!food && !Number(ing.quantity) && !ing.unit?.trim()) {
      if (note) title = note
      continue
    }
    result.push({
      referenceId: crypto.randomUUID(),
      title,
      quantity: Number(ing.quantity) || 0,
      unit: await resolveCatalogItem('units', ing.unit),
      food: await resolveCatalogItem('foods', food),
      note,
      originalText: ing.originalText || null,
      disableAmount: false
    })
    title = null
  }
  return result
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
    const tags = await resolveOrganizers('tags', recipe.tags)
    const recipeCategory = await resolveOrganizers('categories', recipe.categories)

    const notes = []
    if (recipe.notes) notes.push({ title: 'Conseils', text: recipe.notes })
    if (recipe.source) notes.push({ title: 'Source', text: recipe.source })

    const updated = {
      ...current,
      name: recipe.name,
      description: recipe.description || '',
      recipeServings: Number(recipe.servings) || 0,
      recipeYieldQuantity: Number(recipe.yieldQuantity) || 0,
      recipeYield: recipe.yieldUnit?.trim() || '',
      prepTime: recipe.prepTime || null,
      performTime: recipe.cookTime || null,
      cookTime: recipe.cookTime || null,
      totalTime: recipe.totalTime || null,
      recipeIngredient: await buildIngredients(recipe.ingredients),
      recipeInstructions: (recipe.instructions || []).filter(Boolean).map(text => ({
        id: crypto.randomUUID(),
        title: '',
        summary: '',
        text,
        ingredientReferences: []
      })),
      tags,
      recipeCategory,
      notes,
      settings: { ...(current.settings || {}), disableAmount: false }
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
