<div align="center">

<img src="store/icon.svg" width="96" height="96" alt="">

# Better Deezer

**Un Deezer plus propre, plus moderne, à votre goût.**

Thèmes, Marketplace, paroles synchronisées, lecteur flottant et des dizaines de petites retouches,<br>
pour l'application Windows et le lecteur web. L'équivalent de Spicetify, pour Deezer.

![Version](https://img.shields.io/badge/version-1.1.3-a238ff?style=flat-square)
![Windows](https://img.shields.io/badge/Windows-application_Deezer-0078d4?style=flat-square)
![Navigateur](https://img.shields.io/badge/Chrome_·_Edge_·_Brave-extension-4285f4?style=flat-square)
![Licence](https://img.shields.io/badge/licence-MIT-22c55e?style=flat-square)

[Installer](#installer) · [Fonctionnalités](#ce-qui-change) · [Commande](#la-commande-better-deezer) · [Documentation](#documentation) · [Développement](#développement)

</div>

> [!NOTE]
> Projet non officiel, sans lien avec Deezer. Il ne change que l'apparence et le comportement de Deezer **sur votre machine**. Pas de compte, pas de statistiques, pas de serveur : voir [Confidentialité](docs/confidentialite.md).

## Installer

### Application Windows

Ouvrez **PowerShell** (pas l'invite de commandes) et collez :

```powershell
irm https://github.com/Gabizoc/Better-Deezer/releases/latest/download/install.ps1 | iex
```

C'est tout. Ouvrez Deezer comme d'habitude, depuis son propre raccourci : le skin est là.

- **Pas de deuxième application** : Better Deezer modifie l'application Deezer elle-même, comme Spicetify le fait pour Spotify.
- **Pas de droits administrateur** : tout s'installe pour votre compte Windows.
- **Les mises à jour de Deezer sont gérées** : le correctif est remis à l'ouverture de session.

<details>
<summary>Sans la commande PowerShell</summary>

Téléchargez `better-deezer-windows.zip` depuis les [Releases](https://github.com/Gabizoc/Better-Deezer/releases), décompressez-le, puis clic droit sur `install.ps1` › *Exécuter avec PowerShell*.

</details>

### Navigateur — Chrome, Edge, Brave, Opera

1. Téléchargez `better-deezer-extension.zip` depuis les [Releases](https://github.com/Gabizoc/Better-Deezer/releases) et décompressez-le.
2. Ouvrez `chrome://extensions` (ou `edge://extensions`) et activez le **Mode développeur**.
3. **Charger l'extension non empaquetée** › choisissez le dossier, puis rechargez deezer.com.

### Userscript

Installez `better-deezer.user.js` depuis les [Releases](https://github.com/Gabizoc/Better-Deezer/releases) avec Violentmonkey ou Tampermonkey. L'extension **ou** le userscript, pas les deux.

## Ce qui change

<table>
<tr>
<td width="50%" valign="top">

### 🎨 Thèmes
- 6 thèmes inclus, clair / sombre / auto
- Une **Marketplace** de thèmes de la communauté
- Installation depuis un lien ou un fichier
- Un **éditeur** avec aperçu en direct et contrôle de lisibilité
- Un thème = un fichier JSON sans code : [créer le vôtre](docs/themes.md)

</td>
<td width="50%" valign="top">

### 🧩 Modules
- **En écoute** (`F`) : grande pochette et **paroles synchronisées**, mot à mot quand Deezer les a
- **Transitions fluides** entre les pages
- **Masquer les bannières promotionnelles**
- **Minuteur de sommeil** avec fondu du volume
- **Couleur d'accent selon la pochette**, **Mode compact**

</td>
</tr>
<tr>
<td valign="top">

### 🪟 Une nouvelle mise en page
- Recherche **centrée** et bouton **Accueil** rond (`Ctrl K`)
- **Barre latérale flottante**, centrée à l'écran
- **Lecteur flottant** : bouton lecture rond, cœur plein, barre de progression fine
- En-têtes d'album et d'artiste **teintés par la pochette**
- Fenêtres, menus, notifications et messages restylés

</td>
<td valign="top">

### 🎛️ Du confort
- **Volume** : un clic déplie un curseur, molette dessus (5 %, 1 % avec Maj)
- **Molette sur la pochette** du lecteur pour avancer de 5 s
- **Accueil** : sections à masquer, ordre au choix, liste **Ne plus me recommander**
- **Barre latérale** : afficher, masquer, réordonner les entrées
- Filtre **Masquer les titres explicites**, `Q` pour la file d'attente

</td>
</tr>
</table>

Tout se règle dans les **Réglages Better Deezer** : `Ctrl ,`, ou depuis le menu du profil. Le [guide](docs/guide.md) détaille chaque option.

## La commande `better-deezer`

L'installation Windows ajoute une commande, comme `spicetify`. Ouvrez un **nouveau** terminal après l'installation.

```text
better-deezer status       état : versions, Deezer modifié, mise à jour disponible
better-deezer update       installe la dernière version (-f : réinstalle la même)
better-deezer apply        remodifie Deezer, par exemple après une mise à jour de Deezer
better-deezer restore      remet Deezer d'origine, garde Better Deezer installé
better-deezer restart      relance Deezer
better-deezer logs         dernières lignes du journal
better-deezer uninstall    désinstalle tout et remet Deezer d'origine (-y : sans question)
better-deezer version      affiche la version installée
```

`update` vérifie chaque fichier téléchargé avec les sommes SHA-256 de la version avant d'installer quoi que ce soit.

### Désinstaller

`better-deezer uninstall`, ou *Paramètres Windows › Applications › Better Deezer › Désinstaller*. Deezer est remis exactement comme avant. Dans le navigateur, supprimez l'extension.

<details>
<summary><b>Comment Better Deezer modifie l'application</b></summary>

<br>

L'application Deezer est une application Electron qui affiche deezer.com.

1. `patch.ps1` ajoute quelques lignes à `build/main.js` dans `resources\app.asar` de Deezer, et garde l'original sous le nom `app.asar.bd-backup`.
2. À chaque chargement de deezer.com, ces lignes lisent `%LOCALAPPDATA%\BetterDeezer\better-deezer.user.js` et l'exécutent dans la page. Si le fichier n'existe plus, Deezer tourne sans modification.
3. Une mise à jour de Deezer remplace `app.asar` : l'installation enregistre `patch.ps1 -Quiet` à l'ouverture de session pour remettre le correctif, et `better-deezer apply` le fait à la demande.

Le correctif n'ouvre aucun port et ne fait aucune requête. Tout se trouve dans `%LOCALAPPDATA%\BetterDeezer` : les scripts (en texte clair), le skin, `config.json`, le journal `patch.log`, et `bin\better-deezer.cmd`, ajouté au PATH de l'utilisateur.

</details>

## Documentation

| Page | Contenu |
| --- | --- |
| [Guide](docs/guide.md) | Chaque fonction, les réglages, les raccourcis, réinitialiser ou couper Better Deezer |
| [Dépannage](docs/depannage.md) | Symptômes, messages d'erreur et solutions |
| [Thèmes](docs/themes.md) | Le format, l'éditeur, publier sur la Marketplace |
| [Modules](docs/modules.md) | Ce que fait chaque module, et comment en écrire un |
| [Confidentialité](docs/confidentialite.md) | Ce qui reste sur votre machine (tout) et les seules requêtes faites |

> [!TIP]
> **Quelque chose ne va pas ?** Ouvrez *Réglages Better Deezer › À propos* : la page liste les éléments de Deezer introuvables et permet de couper Better Deezer (`Ctrl ,` le réactive). Puis voyez le [Dépannage](docs/depannage.md).

## Développement

```bash
npm run build              # Node 18+, aucune dépendance ; sortie dans dist/
npm test                   # test de fumée dans Chromium (Playwright installé globalement)
npm run check              # build + vérification de syntaxe + test de fumée
node test/cdp-inject.mjs   # injecte la build dans le vrai deezer.com via DevTools
```

| Dossier | Contenu |
| --- | --- |
| `src/core` | Le noyau, les repères sur la page de Deezer (`data-testid`, rôles ARIA, jamais les classes générées), le moteur de thèmes |
| `src/features` | Un fichier par fonction : barre du haut, barre latérale, lecteur, volume, paroles, réglages… |
| `src/styles` | Le CSS, des variables aux modules |
| `themes/` | Thèmes inclus et de la communauté, et `index.json` pour la Marketplace |
| `desktop/` | Les scripts Windows : `install`, `setup`, `patch`, `cli` (la commande), `ui` (l'affichage commun), `uninstall` |
| `test/` | Test de fumée Playwright sur une page qui reprend les repères de Deezer |

Dans les DevTools (`F12`) sur deezer.com, `__betterDeezer.health()` montre les éléments de Deezer reconnus et `__betterDeezer.features()` l'état de chaque fonction. Avec l'extension, choisissez d'abord le contexte **Better Deezer**.

**Publier une version** : changez `version` dans `package.json`, puis poussez un tag `vX.Y.Z` identique. Le workflow `release` construit les zips, le userscript et `SHA256SUMS.txt`, et `better-deezer update` la propose aussitôt.

Pour contribuer : [CONTRIBUTING.md](CONTRIBUTING.md). [HANDOFF.md](HANDOFF.md) explique l'architecture et les règles pour toucher à la page de Deezer, et [CHANGELOG.md](CHANGELOG.md) liste les versions. Faille de sécurité : [SECURITY.md](SECURITY.md).

## Crédits

- Paroles : [LRCLIB](https://lrclib.net), la base de paroles ouverte
- Inspiration : [Spicetify](https://spicetify.app)
- Polices : [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) et [Instrument Sans](https://github.com/Instrument/instrument-sans), SIL Open Font License 1.1 ([détails](assets/fonts/README.md))

## Licence

MIT
