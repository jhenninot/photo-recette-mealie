# Installation avec Dockge derrière Nginx Proxy Manager

Ce guide installe Photo Recette sur un serveur qui fait déjà tourner [Dockge] et [Nginx Proxy Manager] (NPM),
avec l'application accessible en HTTPS sur un sous-domaine, par exemple `https://recettes-photo.example.com`.

[Dockge]: https://github.com/louislam/dockge
[Nginx Proxy Manager]: https://nginxproxymanager.com

## Prérequis

- Dockge installé, avec son dossier de stacks (par défaut `/opt/stacks`).
- Nginx Proxy Manager installé et accessible (interface d'admin sur le port 81).
- Un nom de domaine (ou sous-domaine) qui pointe vers le serveur, avec les ports 80 et 443 ouverts vers NPM.
- Une **clé API Gemini** : https://aistudio.google.com/apikey
- Un **jeton API Mealie** : dans Mealie, *Profil → Gérer vos jetons API → Générer*.
  Créez-le avec un compte qui a le droit de créer des recettes.

## 1. Récupérer le code dans le dossier des stacks

L'image Docker est construite à partir du code source. Il faut donc cloner le dépôt directement dans le dossier des stacks de Dockge.

```bash
cd /opt/stacks
git clone https://github.com/jhenninot/photo-recette-mealie.git
```

> Le dépôt étant privé, `git` demandera un identifiant GitHub et, comme mot de passe, un
> **jeton d'accès personnel** (GitHub → *Settings → Developer settings → Personal access tokens*,
> droit *Contents: Read* sur ce dépôt). Vous pouvez aussi utiliser une clé SSH de déploiement.

Le dossier `/opt/stacks/photo-recette-mealie` apparaît alors comme une stack dans Dockge, grâce au fichier `compose.yaml`.

## 2. Trouver le réseau Docker de Nginx Proxy Manager

Pour que NPM joigne l'application par son nom de conteneur, sans exposer de port sur le serveur, les deux doivent partager un réseau Docker.

Pour connaître le réseau de NPM :

```bash
docker network ls
docker inspect <nom-du-conteneur-npm> --format '{{json .NetworkSettings.Networks}}'
```

C'est souvent `npm_default` ou `nginx-proxy-manager_default` (selon le nom de la stack de NPM).
Si vous utilisez déjà un réseau partagé, par exemple `proxy`, prenez celui-là.

## 3. Configurer la stack dans Dockge

Dans Dockge, ouvrez la stack **photo-recette-mealie** puis cliquez sur **Modifier**.

### compose.yaml

Remplacez le contenu par le suivant, en adaptant le nom du réseau (`npm_default`) à celui trouvé à l'étape 2 :

```yaml
services:
  photo-recette:
    build: .
    image: photo-recette-mealie:latest
    container_name: photo-recette-mealie
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
    networks:
      - proxy

networks:
  proxy:
    name: npm_default   # ← réseau de Nginx Proxy Manager
    external: true
```

Aucune section `ports:` n'est nécessaire : seul NPM parle à l'application, via le réseau partagé.

### .env

Dans l'éditeur **.env** de Dockge, sous le `compose.yaml` :

```env
GEMINI_API_KEY=votre-cle-gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# URL de Mealie vue depuis le conteneur (voir la remarque ci-dessous)
MEALIE_URL=https://mealie.example.com
MEALIE_TOKEN=votre-jeton-mealie
# URL de Mealie utilisée pour le lien « Ouvrir dans Mealie »
MEALIE_PUBLIC_URL=https://mealie.example.com

# Premier administrateur (créé au premier démarrage uniquement)
ADMIN_USERNAME=julien
ADMIN_PASSWORD=un-mot-de-passe-solide
```

> **Joindre Mealie :**
> - Le plus simple est d'utiliser l'URL publique de Mealie (`https://mealie.example.com`).
> - Si Mealie est aussi branché sur le réseau de NPM, vous pouvez utiliser son nom de conteneur,
>   par exemple `MEALIE_URL=http://mealie:9000`, ce qui évite de repasser par Internet.
>   Gardez dans ce cas `MEALIE_PUBLIC_URL` sur l'adresse publique pour que les liens fonctionnent sur le téléphone.

Cliquez sur **Enregistrer**, puis **Démarrer**. Le premier lancement construit l'image, ce qui prend 1 à 2 minutes.
Dans les journaux, vous devez voir :

```
[users] Administrateur « julien » créé
Photo Recette Mealie démarré sur http://localhost:3000
```

Après ce premier démarrage, vous pouvez retirer `ADMIN_PASSWORD` du `.env` : le compte est enregistré dans `data/users.json`.

## 4. Créer l'hôte dans Nginx Proxy Manager

Dans NPM : **Hosts → Proxy Hosts → Add Proxy Host**.

**Onglet Details**

| Champ | Valeur |
|---|---|
| Domain Names | `recettes-photo.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | `photo-recette-mealie` (nom du conteneur) |
| Forward Port | `3000` |
| Block Common Exploits | ✅ |
| Websockets Support | inutile |

**Onglet SSL**

- SSL Certificate : *Request a new SSL Certificate* (Let's Encrypt)
- ✅ Force SSL, ✅ HTTP/2 Support, ✅ HSTS Enabled (facultatif)

**Onglet Advanced** : la lecture de la recette et la génération de l'image par Gemini peuvent prendre
jusqu'à une minute. Allongez donc les délais d'attente et autorisez des envois de photos confortables :

```nginx
client_max_body_size 50m;
proxy_read_timeout 180s;
proxy_send_timeout 180s;
```

Enregistrez. L'application est disponible sur `https://recettes-photo.example.com`.

## 5. Vérifier

1. Ouvrez l'application et connectez-vous avec le compte administrateur.
2. Touchez votre nom en haut à droite, puis **Tester la connexion** (carte « Connexion à Mealie »).
   Le message doit être *✓ Connecté à Mealie*.
3. Photographiez une recette pour un premier essai complet.

Sur le téléphone, utilisez **Ajouter à l'écran d'accueil** (Safari) ou **Installer l'application** (Chrome)
pour l'avoir comme une vraie application.

## Mettre à jour

```bash
cd /opt/stacks/photo-recette-mealie
git pull
```

Puis, dans Dockge, ouvrez la stack et utilisez le **terminal** de la stack (ou un shell sur le serveur) :

```bash
docker compose up -d --build
```

> Le bouton **Mettre à jour** de Dockge fait un `pull` d'image : il ne reconstruit pas une image
> construite localement. D'où la commande `--build` ci-dessus.
>
> `git pull` ne touche ni à votre `.env` ni au dossier `data/` (ils sont ignorés par git).
> En revanche, si vous avez modifié `compose.yaml` à l'étape 3, `git pull` peut signaler un conflit. Dans ce cas :
> `git stash && git pull && git stash pop`.

## Gérer les utilisateurs

Le plus simple est de passer par l'application : menu du compte, carte **Utilisateurs**, visible par les administrateurs.

En ligne de commande, depuis le dossier de la stack :

```bash
docker compose exec photo-recette node server/scripts/users.js add marie
docker compose exec photo-recette node server/scripts/users.js add paul --admin
docker compose exec photo-recette node server/scripts/users.js passwd marie
docker compose exec photo-recette node server/scripts/users.js list
```

## Sauvegarde

Tout l'état de l'application tient dans le dossier `data/` de la stack :
`users.json` (comptes) et `jwt-secret` (clé de signature des sessions).
Les recettes, elles, sont dans Mealie.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| **502 Bad Gateway** dans NPM | NPM et l'application ne sont pas sur le même réseau Docker, ou le conteneur est arrêté. Vérifiez le nom du réseau dans `compose.yaml` et le champ *Forward Hostname*. |
| **504 Gateway Timeout** pendant l'analyse | Délais trop courts : ajoutez les lignes `proxy_read_timeout` de l'onglet *Advanced*. |
| **413 Request Entity Too Large** | Ajoutez `client_max_body_size 50m;` dans l'onglet *Advanced*. |
| « Clé Gemini invalide » | `GEMINI_API_KEY` erronée ; après correction du `.env`, redémarrez la stack. |
| « Modèle Gemini introuvable » | Nom de modèle retiré ou mal saisi dans `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL`. |
| « Mealie … 401 » | Jeton Mealie invalide ou expiré : régénérez-le dans Mealie. |
| « Serveur injoignable » / erreur réseau vers Mealie | `MEALIE_URL` injoignable depuis le conteneur. Testez : `docker compose exec photo-recette sh -c 'wget -qO- "$MEALIE_URL/api/app/about"'` |
| « Trop de tentatives » à la connexion | 10 essais ratés en 15 minutes : attendez 15 minutes. |
