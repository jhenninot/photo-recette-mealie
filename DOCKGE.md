# Installation avec Dockge derrière Nginx Proxy Manager

Ce guide installe Photo Recette avec [Dockge] sur un **serveur d'applications**, publiée en HTTPS
par un [Nginx Proxy Manager] (NPM) qui tourne sur **un autre serveur** du réseau local,
par exemple sur `https://recettes-photo.example.com`.

```
Téléphone ──HTTPS──▶ NPM (serveur A) ──HTTP, réseau local──▶ Photo Recette :3000 (serveur B, Dockge)
                                                                  │
                                                                  ├──▶ Gemini (Internet)
                                                                  └──▶ Mealie (API)
```

[Dockge]: https://github.com/louislam/dockge
[Nginx Proxy Manager]: https://nginxproxymanager.com

## Prérequis

- **Serveur B** (applications) : Dockge installé, avec son dossier de stacks (par défaut `/opt/stacks`).
  Notez son **adresse IP locale**, par exemple `192.168.1.20` (`ip -4 addr` ou `hostname -I`).
- **Serveur A** (proxy) : Nginx Proxy Manager installé, qui peut joindre le serveur B sur le réseau local.
- Un nom de domaine (ou sous-domaine) qui pointe vers votre connexion, avec les ports 80 et 443 redirigés vers NPM.
- Une **clé API Gemini** : https://aistudio.google.com/apikey
- Un **jeton API Mealie** : dans Mealie, *Profil → Gérer vos jetons API → Générer*.
  Créez-le avec un compte qui a le droit de créer des recettes.

## 1. Créer la stack dans Dockge (serveur B)

L'image est construite automatiquement par GitHub à chaque mise à jour du code et publiée sur
`ghcr.io/jhenninot/photo-recette-mealie` (PC x86 et ARM/Raspberry Pi). Rien n'est compilé sur le serveur
et il n'est pas nécessaire de cloner le dépôt.

Dans Dockge, cliquez sur **+ Composer**, nommez la stack `photo-recette-mealie`, puis remplissez
le `compose.yaml` et le `.env` comme ci-dessous.

### compose.yaml

NPM étant sur une autre machine, l'application publie simplement son port 3000 sur le serveur B :

```yaml
services:
  photo-recette:
    image: ghcr.io/jhenninot/photo-recette-mealie:latest
    container_name: photo-recette-mealie
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```

> - Si le port 3000 est déjà pris sur le serveur B, changez seulement le premier : `"3010:3000"`,
>   et utilisez 3010 dans NPM.
> - Fixez l'IP locale du serveur B (bail DHCP statique sur la box ou le routeur), sinon NPM ne le retrouvera plus.
> - Cas particulier : si le serveur B a une **IP publique directement sur une de ses cartes réseau**
>   (serveur loué, pas de box devant), limitez le port au réseau local avec `"192.168.1.20:3000:3000"`,
>   sinon l'application serait joignable depuis Internet sans passer par NPM. Derrière une box, c'est inutile.

### .env

Dans l'éditeur **.env** de Dockge, sous le `compose.yaml` :

```env
GEMINI_API_KEY=votre-cle-gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# URL de Mealie vue depuis le serveur B (voir la remarque ci-dessous)
MEALIE_URL=https://mealie.example.com
MEALIE_TOKEN=votre-jeton-mealie
# URL de Mealie utilisée pour le lien « Ouvrir dans Mealie » sur le téléphone
MEALIE_PUBLIC_URL=https://mealie.example.com

# Premier administrateur (créé au premier démarrage uniquement)
ADMIN_USERNAME=julien
ADMIN_PASSWORD=un-mot-de-passe-solide
```

> **Joindre Mealie :**
> - Le plus simple est d'utiliser l'URL publique de Mealie (`https://mealie.example.com`), qui repasse par NPM.
> - Vous pouvez aussi viser Mealie directement sur le réseau local, par exemple `MEALIE_URL=http://192.168.1.30:9925`
>   (IP et port publiés par le conteneur Mealie). C'est plus rapide et ne dépend pas de NPM.
>   Gardez dans ce cas `MEALIE_PUBLIC_URL` sur l'adresse publique pour que les liens fonctionnent sur le téléphone.

Cliquez sur **Déployer**. Dockge télécharge l'image puis démarre le conteneur.
Dans les journaux, vous devez voir :

```
[users] Administrateur « julien » créé
Photo Recette Mealie démarré sur http://localhost:3000
```

Après ce premier démarrage, vous pouvez retirer `ADMIN_PASSWORD` du `.env` : le compte est enregistré dans `data/users.json`.

**Vérifiez depuis le serveur A (NPM)** que l'application est joignable :

```bash
curl http://192.168.1.20:3000/api/health
# → {"ok":true,"missingConfig":[]}
```

Si `missingConfig` n'est pas vide, une variable manque dans le `.env`.

### Limiter l'accès au port 3000 (recommandé)

Seul NPM a besoin de joindre le port 3000. Attention : **Docker contourne `ufw`** (les ports publiés par
un conteneur restent ouverts même si `ufw` les bloque). Pour n'autoriser que le serveur A
(ici `192.168.1.10`), ajoutez la règle dans la chaîne `DOCKER-USER` sur le serveur B :

```bash
sudo iptables -I DOCKER-USER -p tcp -m conntrack --ctorigdstport 3000 --ctdir ORIGINAL ! -s 192.168.1.10 -j DROP
```

Pour la rendre permanente : `sudo apt install iptables-persistent && sudo netfilter-persistent save`.
Si votre réseau local est de confiance, vous pouvez sauter cette étape.

## 2. Créer l'hôte dans Nginx Proxy Manager (serveur A)

Dans NPM : **Hosts → Proxy Hosts → Add Proxy Host**.

**Onglet Details**

| Champ | Valeur |
|---|---|
| Domain Names | `recettes-photo.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.1.20` (IP locale du serveur B) |
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

## 3. Vérifier

1. Ouvrez l'application et connectez-vous avec le compte administrateur.
2. Touchez votre nom en haut à droite, puis **Tester la connexion** (carte « Connexion à Mealie »).
   Le message doit être *✓ Connecté à Mealie*.
3. Photographiez une recette pour un premier essai complet.

Sur le téléphone, utilisez **Ajouter à l'écran d'accueil** (Safari) ou **Installer l'application** (Chrome)
pour l'avoir comme une vraie application.

## Mettre à jour

Dans Dockge, ouvrez la stack et cliquez sur **Mettre à jour** : Dockge télécharge la dernière image
`latest` et redémarre le conteneur. Le `.env` et le dossier `data/` sont conservés.

> Pour figer une version précise plutôt que suivre `latest`, remplacez le tag de l'image,
> par exemple `ghcr.io/jhenninot/photo-recette-mealie:1.0` (disponible dès qu'une version `v1.0.0` est publiée).

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
| **502 Bad Gateway** dans NPM | NPM ne joint pas le serveur B : conteneur arrêté, mauvaise IP ou mauvais port dans *Forward Hostname / Port*, ou pare-feu. Testez depuis le serveur A : `curl http://192.168.1.20:3000/api/health`. Si NPM tourne lui-même dans Docker, testez depuis son conteneur : `docker exec <conteneur-npm> curl -s http://192.168.1.20:3000/api/health`. |
| **504 Gateway Timeout** pendant l'analyse | Délais trop courts : ajoutez les lignes `proxy_read_timeout` de l'onglet *Advanced*. |
| **413 Request Entity Too Large** | Ajoutez `client_max_body_size 50m;` dans l'onglet *Advanced*. |
| « Clé Gemini invalide » | `GEMINI_API_KEY` erronée ; après correction du `.env`, redémarrez la stack. |
| « Modèle Gemini introuvable » | Nom de modèle retiré ou mal saisi dans `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL`. |
| « Mealie … 401 » | Jeton Mealie invalide ou expiré : régénérez-le dans Mealie. |
| « Serveur injoignable » / erreur réseau vers Mealie | `MEALIE_URL` injoignable depuis le conteneur. Testez : `docker compose exec photo-recette sh -c 'wget -qO- "$MEALIE_URL/api/app/about"'` |
| « Trop de tentatives » à la connexion | 10 essais ratés en 15 minutes : attendez 15 minutes. |
