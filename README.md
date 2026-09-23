# Photo Recette → Mealie

Application web mobile (PWA) pour ajouter une recette d'un livre de cuisine dans [Mealie] en une photo :

1. **Photo** : vous photographiez la page du livre (jusqu'à 4 photos si la recette tient sur plusieurs pages).
2. **Lecture** : Gemini transcrit la recette (nom, portions, temps, ingrédients, étapes, tags, conseils, source).
3. **Relecture** : vous corrigez la recette si besoin. Pendant ce temps, Gemini génère une photo du plat, et vous pouvez en demander une autre.
4. **Envoi** : la recette et l'image générée sont créées dans Mealie via son API, puis un lien vers la recette s'affiche.

La photo originale du livre n'est jamais conservée : elle est seulement transmise à Gemini puis oubliée.
L'accès est protégé par un compte utilisateur avec mot de passe.

[Mealie]: https://mealie.io

## Architecture

- **Frontend** : Vue 3 + Vite, installable sur le téléphone (PWA). Code dans `src/`.
- **Backend** : Express (`server/`). Il garde les secrets : la clé Gemini et le jeton Mealie ne sont jamais envoyés au navigateur.
  - `server/gemini.js` : lecture de la recette (sortie JSON structurée) et génération de l'image.
  - `server/mealie.js` : création de la recette, des tags et envoi de l'image via l'API Mealie.
  - `server/users.js` / `server/auth.js` : comptes (mots de passe bcrypt dans `data/users.json`) et sessions JWT.

## Configuration

Copiez `.env.example` en `.env` et renseignez au minimum :

| Variable | Rôle |
|---|---|
| `GEMINI_API_KEY` | Clé API Gemini ([Google AI Studio](https://aistudio.google.com/apikey)) |
| `MEALIE_URL` | URL de Mealie accessible depuis le serveur (ex. `http://mealie:9000`) |
| `MEALIE_TOKEN` | Jeton API Mealie (*Profil → Jetons API*) |
| `MEALIE_PUBLIC_URL` | URL de Mealie pour les liens affichés dans l'application (facultatif) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Premier administrateur, créé au premier démarrage |
| `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL` | Modèles Gemini utilisés (facultatif, pour passer à un modèle plus récent) |

## Utilisateurs

Un administrateur peut ajouter ou supprimer des comptes et réinitialiser leurs mots de passe depuis l'application (menu du compte, en haut à droite). En ligne de commande :

```bash
npm run user add marie            # demande le mot de passe
npm run user add paul -- --admin  # administrateur
npm run user passwd marie
npm run user delete marie
npm run user list
```

Avec Docker : `docker compose exec photo-recette node server/scripts/users.js add marie`.

## Développement

```bash
npm install
cp .env.example .env   # puis compléter
npm run dev            # API sur :3000, interface sur :5173
```

## Déploiement (Docker / Dockge)

Guide pas à pas pour Dockge derrière un Nginx Proxy Manager situé sur un autre serveur : **[DOCKGE.md](DOCKGE.md)**.

```bash
docker compose up -d --build
```

Les comptes et le secret de session sont conservés dans `./data`. Pour l'installer comme application sur le téléphone (PWA), servez-la en **HTTPS**, par exemple derrière votre reverse proxy habituel.
