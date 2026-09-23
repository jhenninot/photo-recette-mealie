import { GoogleGenAI } from '@google/genai'
import { config } from './config.js'

let client
function ai() {
  if (!config.gemini.apiKey) throw new Error('GEMINI_API_KEY non configurée')
  client ||= new GoogleGenAI({ apiKey: config.gemini.apiKey })
  return client
}

// Traduit les erreurs de l'API Gemini (souvent du JSON brut) en message lisible
async function call(request) {
  try {
    return await ai().models.generateContent(request)
  } catch (err) {
    const msg = String(err?.message || err)
    console.error('[gemini]', msg.slice(0, 500))
    if (/API_KEY_INVALID|API key not valid/i.test(msg)) throw new Error('Clé Gemini invalide (GEMINI_API_KEY)')
    if (/RESOURCE_EXHAUSTED|429/.test(msg)) throw new Error('Quota Gemini dépassé, réessayez plus tard')
    if (/NOT_FOUND|404/.test(msg)) throw new Error(`Modèle Gemini introuvable (${request.model})`)
    if (/UNAVAILABLE|503|overloaded/i.test(msg)) throw new Error('Gemini est surchargé, réessayez dans un instant')
    throw new Error('Erreur Gemini, réessayez')
  }
}

const recipeSchema = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'false si aucune recette lisible sur les photos' },
    name: { type: 'string' },
    description: { type: 'string', description: 'Courte présentation du plat (1 à 3 phrases), tirée du livre si présente' },
    recipeYield: { type: 'string', description: 'Ex. « 4 personnes », « 12 biscuits »' },
    servings: { type: 'number', description: 'Nombre de portions, 0 si inconnu' },
    prepTime: { type: 'string', description: 'Ex. « 20 min », vide si inconnu' },
    cookTime: { type: 'string', description: 'Ex. « 1 h 15 », vide si inconnu' },
    totalTime: { type: 'string', description: 'Vide si inconnu' },
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      description: 'Une ligne par ingrédient, avec quantité et unité, telle qu\'écrite dans le livre'
    },
    instructions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Une entrée par étape, dans l\'ordre'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '2 à 5 mots-clés courts en minuscules (type de plat, ingrédient principal, cuisine…)'
    },
    source: { type: 'string', description: 'Titre du livre / auteur / page si visibles, sinon vide' },
    notes: { type: 'string', description: 'Astuces, variantes ou conseils présents sur la page, sinon vide' }
  },
  required: ['found', 'name', 'description', 'recipeYield', 'servings', 'prepTime', 'cookTime', 'totalTime',
    'ingredients', 'instructions', 'tags', 'source', 'notes']
}

const EXTRACT_PROMPT = `Tu reçois une ou plusieurs photos de pages d'un livre de cuisine (plusieurs photos = pages successives de la même recette).
Transcris fidèlement la recette en JSON :
- conserve la langue du livre, les quantités et les unités exactes ; n'invente aucun ingrédient ni aucune étape ;
- corrige seulement les coupures de mots et les erreurs évidentes de lecture ;
- sépare chaque ingrédient et chaque étape ; retire les numéros d'étape du texte ;
- si la page contient plusieurs recettes, prends la recette principale (la plus complète) ;
- si aucune recette n'est lisible, renvoie found = false et des champs vides.`

export async function extractRecipe(images) {
  const response = await call({
    model: config.gemini.textModel,
    contents: [{
      role: 'user',
      parts: [
        ...images.map(img => ({ inlineData: { mimeType: img.mimetype, data: img.buffer.toString('base64') } })),
        { text: EXTRACT_PROMPT }
      ]
    }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: recipeSchema,
      temperature: 0.1
    }
  })
  let recipe
  try {
    recipe = JSON.parse(response.text)
  } catch {
    throw new Error('Réponse de Gemini illisible, réessayez')
  }
  if (!recipe.found || !recipe.name) throw new Error('Aucune recette reconnue sur la photo')
  delete recipe.found
  return recipe
}

function imagePrompt(recipe) {
  const ingredients = (recipe.ingredients || []).slice(0, 12).join(', ')
  return `Photographie culinaire professionnelle et appétissante du plat « ${recipe.name} ».
${recipe.description ? `Description : ${recipe.description}\n` : ''}Ingrédients principaux : ${ingredients}.
Le plat terminé, dressé dans une assiette ou un plat de service adapté, sur une table en bois ou en lin,
lumière naturelle douce venant du côté, faible profondeur de champ, vue de trois quarts.
Style réaliste de livre de cuisine moderne. Aucun texte, aucun logo, aucune main.`
}

export async function generateRecipeImage(recipe) {
  const response = await call({
    model: config.gemini.imageModel,
    contents: imagePrompt(recipe),
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '4:3' }
    }
  })
  const parts = response.candidates?.[0]?.content?.parts || []
  const image = parts.find(p => p.inlineData?.data)
  if (!image) throw new Error('Gemini n\'a pas renvoyé d\'image, réessayez')
  return { mimeType: image.inlineData.mimeType || 'image/png', data: image.inlineData.data }
}
