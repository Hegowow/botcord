# KahoCord

<p align="center"><img src="assets/brand/wordmark.png" alt="KahoCord" width="420"></p>

**KahoCord** te permet d'utiliser la vraie interface de Discord avec ton **bot** : au lieu d'un e-mail et d'un mot de passe, tu te connectes avec le **token de ton bot**. Serveurs, salons, messages, embeds, réactions, vocal… comme un utilisateur Discord classique.

Développé par **kahodev**.

---

## Sommaire

- [Installation depuis les sources](#installation-depuis-les-sources)
- [Connexion](#connexion)
- [Fonctionnalités](#fonctionnalités)
- [Badges](#badges)
- [Personnalisation](#personnalisation)

---

## Installation depuis les sources

Prérequis : **Node.js 22+** et **git**.

```shell
git clone https://github.com/Hegowow/botcord.git
cd botcord
npm run requirement
npm run vencord
npm run build:ts
npm start
```

Pour générer un exécutable (`.dmg`, `.exe` ou `.AppImage` dans `dist/`) :

```shell
npm run build
```

> [!WARNING]
> L'application n'est pas signée. Sur macOS, fais un clic droit sur l'app puis « Ouvrir » au premier lancement.

---

## Connexion

L'écran de connexion de Discord affiche un champ **token** et, juste au-dessus du bouton **Connexion**, un menu **Type de compte** :

- **Bot** : colle le token de ton bot (portail développeur Discord → ton application → *Bot* → *Reset Token*). KahoCord adapte l'interface aux limites des bots (faux profils, liste des membres reconstruite, éditeur d'embeds, etc.).
- **Compte personnel** : colle le token de ton propre compte. KahoCord laisse alors passer toutes les requêtes telles quelles vers Discord, sans aucune modification propre aux bots.

Changer de type de compte recharge l'application. Le dernier type choisi est mémorisé.

> [!NOTE]
> Pour un bot, active l'intent **Message Content** dans le portail développeur. Pour voir la liste des membres et leurs statuts, active aussi **Server Members** et **Presence**.

> [!CAUTION]
> Un token donne un contrôle total sur le compte. Ne le partage jamais. Utiliser un client modifié avec un compte personnel est contraire aux conditions d'utilisation de Discord.

---

## Fonctionnalités

- Sharding
- Serveurs (chargement progressif), gestion des serveurs et des salons
- Messages : envoi, historique, embeds, composants V2, réactions, sondages
- Messages privés (avec les restrictions imposées aux bots)
- Vocal (hors partage d'écran)
- Éditeur d'embeds intégré
- Vencord intégré

---

## Badges

Chaque compte connecté via KahoCord (bot ou compte personnel) reçoit automatiquement le badge **Utilisateur KahoCord**, visible par tous les utilisateurs de KahoCord. Un clic dessus ouvre la page LinkedIn de Kaho.

Les administrateurs peuvent en plus :

- créer, modifier et supprimer des badges personnalisés dans **Paramètres → Gestion des badges** (image recadrée automatiquement au format Discord 72×72, titre au survol, action au clic : rien ou ouvrir un lien) ;
- attribuer ou retirer un badge (personnalisé ou badge officiel Discord) par **clic droit sur un utilisateur → Badges KahoCord**.

Pour devenir admin, colle ta clé dans **Paramètres → Vencord → Plugins → KahoCordBadges → Clé admin**. L'onglet et le menu apparaissent dès que la clé est validée par le serveur.

> [!NOTE]
> Les badges sont stockés sur le serveur `https://api.kaho.fr` et ne sont visibles que dans KahoCord, pas dans le client Discord officiel.

### Serveur de badges

Le serveur est dans `server/` (Node 24, aucune dépendance, SQLite intégré). Il tourne sur le VPS avec le service systemd `kahocord-badges`, derrière Apache (`api.kaho.fr`, HTTPS via certbot). Les données sont dans `/var/lib/kahocord-badges`.

```shell
cd server
npm test
DEPLOY_KEY=<chemin de la clé SSH> ./deploy/deploy.sh
```

Gestion des clés admin, sur le VPS :

```shell
cd /opt/kahocord-badges
sudo -u kahocord bash -c 'set -a; . /etc/kahocord-badges.env; set +a; node --disable-warning=ExperimentalWarning src/cli.ts create-key "Nom"'
sudo -u kahocord bash -c 'set -a; . /etc/kahocord-badges.env; set +a; node --disable-warning=ExperimentalWarning src/cli.ts list-keys'
sudo -u kahocord bash -c 'set -a; . /etc/kahocord-badges.env; set +a; node --disable-warning=ExperimentalWarning src/cli.ts revoke-key <id>'
```

## Personnalisation

Toute l'identité de l'application (nom, auteur, dépôt GitHub, compte système qui envoie le message de bienvenue, bio des profils) est centralisée dans `src/AppCore/Branding.ts`.

Pour afficher ton propre avatar sur le compte système, renseigne `SystemUserId` et `SystemUserAvatar` avec l'ID et le hash d'avatar d'un compte Discord, puis renomme le dossier `src/AppCore/routes/users/<ID>` avec le même ID.

Les logos sont dans `assets/brand/` : `wordmark.png` remplace le logo Discord complet, `mark.png` remplace le petit logo seul, `overrides/` contient les avatars par défaut redessinés et `assets/icon.png` est l'icône de l'application. Le remplacement est automatique : les SVG de Discord sont analysés et chaque logo détecté est remplacé, en gardant sa couleur.

Le plugin Vencord qui ajoute la connexion par token est versionné dans `plugin/` et copié dans Vencord à chaque `npm run vencord`.
