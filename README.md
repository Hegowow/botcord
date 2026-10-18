# Botcord

**Botcord** te permet d'utiliser la vraie interface de Discord avec ton **bot** : au lieu d'un e-mail et d'un mot de passe, tu te connectes avec le **token de ton bot**. Serveurs, salons, messages, embeds, réactions, vocal… comme un utilisateur Discord classique.

Développé par **kahodev**.

---

## Sommaire

- [Installation depuis les sources](#installation-depuis-les-sources)
- [Connexion](#connexion)
- [Fonctionnalités](#fonctionnalités)
- [Personnalisation](#personnalisation)
- [Licence et crédits](#licence-et-crédits)

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

Au premier démarrage, Botcord affiche l'écran de connexion de Discord avec un champ **token**. Colle le token de ton bot (portail développeur Discord → ton application → *Bot* → *Reset Token*).

> [!NOTE]
> Active l'intent **Message Content** dans le portail développeur. Pour voir la liste des membres et leurs statuts, active aussi **Server Members** et **Presence**.

> [!CAUTION]
> Ton token donne un contrôle total sur ton bot. Ne le partage jamais. Il reste stocké localement sur ta machine.

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

## Personnalisation

Toute l'identité de l'application (nom, auteur, dépôt GitHub, compte système qui envoie le message de bienvenue, bio des profils) est centralisée dans `src/AppCore/Branding.ts`.

Pour afficher ton propre avatar sur le compte système, renseigne `SystemUserId` et `SystemUserAvatar` avec l'ID et le hash d'avatar d'un compte Discord, puis renomme le dossier `src/AppCore/routes/users/<ID>` avec le même ID.

Le plugin Vencord qui ajoute la connexion par token est versionné dans `plugin/` et copié dans Vencord à chaque `npm run vencord`.

---

## Licence et crédits

Botcord est distribué sous licence **GPL-3.0** (voir [LICENSE](LICENSE)).

C'est une version modifiée de [DiscordBotClient](https://github.com/aiko-chan-ai/DiscordBotClient) et de [VencordDBCPlugin](https://github.com/aiko-chan-ai/VencordDBCPlugin) par aiko-chan-ai. Le détail des modifications et les mentions de copyright d'origine sont dans [NOTICE.md](NOTICE.md).

Merci également à [Vencord](https://github.com/Vendicated/Vencord), à [Discohook](https://github.com/discohook/discohook) et à [Lambert-server](https://github.com/SamuelScheit/Lambert-server).
