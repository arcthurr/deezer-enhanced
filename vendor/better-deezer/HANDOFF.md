# HANDOFF — Better Deezer

> Notes de maintenance : architecture, règles pour toucher à la page de Deezer, ce qu'on sait de Deezer, conventions.
> À lire avant de modifier le code, que vous soyez un contributeur ou une session d'agent de code (Claude Code ou autre). Mettez ce fichier à jour dans le même commit que tout changement d'architecture ou d'ancre.
> Échanges avec le mainteneur et doc utilisateur : français. Code, commentaires et messages de commit : anglais.

Pour démarrer : [CONTRIBUTING.md](CONTRIBUTING.md). Historique des versions : [CHANGELOG.md](CHANGELOG.md).

## 1. Le projet

Une surcouche CSS + JS qui redessine Deezer et ajoute des fonctions de confort, l'équivalent de Spicetify pour Deezer. Elle est distribuée comme extension navigateur, comme userscript et pour l'application Windows. Trois exigences guident tout le reste :

- **Survivre aux mises à jour de Deezer** : si quelque chose n'est plus trouvé, Deezer reste dans son état d'origine, jamais cassé.
- **S'installer en une ligne**, sans droits administrateur.
- **Ne rien envoyer nulle part** : pas de serveur, pas de compte, pas de statistiques (voir [docs/confidentialite.md](docs/confidentialite.md)).

## 2. Design

- **Sobriété** : pas de dégradé décoratif, pas de jeu d'icônes générique, pas d'emoji dans l'interface. Icônes maison sur une grille de 24, trait 1,75, terminaisons arrondies.
- **Sombre (Graphite, défaut)** : fond graphite chaud `#0B0A0C`, surfaces `#141316 / #1C1A1F / #26232A`, un **seul accent** `#A238FF` en aplat, réservé à ce qui joue ou est actif.
- **Clair** : jamais de blanc ni de noir purs (surface-1 `#FCFBF9`). Accent plus foncé `#8A1FE8` pour le contraste, accent-text `#7A14D6`.
- **Polices** : Bricolage Grotesque (titres) et Instrument Sans (interface), SIL OFL, embarquées dans `assets/fonts`.
- **Lecteur** : dock flottant arrondi, bouton lecture rond en accent, cœur plein en accent, temps de part et d'autre d'une barre fine.
- **Volume** : au survol, une pastille sous l'icône, et la molette agit déjà. Un clic déplie un curseur vers la gauche avec un anneau accent sur l'icône ; un second clic coupe le son ; Échap ou un clic ailleurs le replie. Pas de 5 %, 1 % avec Maj, flèches au clavier.
- **Barre latérale** : flottante, centrée verticalement (au-dessus du dock) et horizontalement, repliée comme dépliée. Entrées configurables (afficher, masquer, réordonner).
- **Barre du haut** : recherche toujours centrée sur la fenêtre, bouton Accueil rond à sa gauche, `Ctrl K`. Popover de recherche arrondi (r=22), aligné sous le champ, avec un pied qui rappelle les raccourcis.
- **Panneaux** (notifications, menu profil, menus, modales) : une seule surface, r=22. Le menu profil porte le sélecteur Clair / Sombre / Auto et l'entrée « Réglages Better Deezer (Ctrl ,) ».
- **Réglages** : onglet sélectionné en accent doux. Tout ce qui est affiché fonctionne : pas d'option « Bientôt ».
- **Infobulles** : par défaut, seule la carte de Deezer au survol de Précédent / Suivant reste ; les autres se règlent dans Apparence › Infobulles.
- **Pages** : en-tête teinté par la pochette, grand titre, photo ronde pour les artistes et profils, cœur et ⋯ au survol des lignes, popularité en barre fine, filtre « Masquer les titres explicites ».

## 3. Architecture

```
src/
  styles/00-tokens.css   tokens sombre (:root) + clair (html[data-bd-theme=light]) — seule source de couleurs
  styles/05-tempo.css    pont vers le design system de Deezer (--tempo-* -> --bd-*), voir §4
  styles/10-base.css     fond, barres de défilement, focus, view transitions
  styles/20-shell.css    barre latérale, barre du haut, recherche, lecteur
  styles/30-content.css  cartes, lignes, en-têtes de pages, accueil, chips
  styles/40-overlays.css popovers, menus, notifications, modales, toasts, infobulles, volume
  styles/50-settings.css panneau Réglages Better Deezer (DOM à nous, classes .bd-*)
  styles/60-modules.css  vue « En écoute », transitions, promos, minuteur, compact, onglet Modules
  core/00-core.js        objet BD, réglages (localStorage bd:*), bus d'événements, BD.h (DOM), BD.t (fr/en)
  core/10-anchors.js     LE SEUL endroit qui sait trouver les éléments de Deezer
  core/20-theme.js       mode sombre / clair / système (html[data-bd-theme])
  core/30-themes.js      thèmes JSON : schéma + validation (partagés avec le build), contrastes, BD.skins
  features/*.js          une feature = { id, label, description, module, glyph, live, setup, update, teardown }
                         (contrat documenté dans core/00-core.js et docs/modules.md)
  main.js                démarrage, MutationObserver (une frame au plus), isolation des erreurs, API console
extension/               manifest MV3 + page-bridge.js (monde MAIN : lit le titre en cours via dzPlayer)
themes/builtin/*.json    6 thèmes intégrés (graphite = défaut)
themes/community/*.json  thèmes de la communauté ; themes/index.json (Marketplace) est GÉNÉRÉ par le build
assets/fonts/            woff2 OFL + fonts.json (plages unicode) + licences
desktop/                 install.ps1 (amorce ASCII) -> setup.ps1, patch.ps1 (patch de app.asar),
                         cli.ps1 (commande better-deezer), ui.ps1 (affichage commun), uninstall.ps1
scripts/build.mjs        build sans dépendance -> dist/extension + dist/better-deezer.user.js (CSS + polices en base64)
test/fixture.html        page qui reproduit les vraies ancres de Deezer
test/smoke.mjs           test de fumée dans Chromium (npm test) ; deezer.com, lrclib.net et GitHub routés vers des fixtures
test/cdp-inject.mjs      injecte la build dans le vrai deezer.com via le protocole DevTools
docs/                    doc utilisateur en français
.github/workflows/       ci.yml (build, smoke, analyse PowerShell 5.1, PSScriptAnalyzer) ; release.yml (tag v*)
```

### Règles anti-casse (mises à jour de Deezer)

1. Le CSS ne cible **jamais** les classes générées `css-xxxx`. Il cible `[data-bd="…"]` / `[data-bd-role="…"]` (posés par le JS), des `data-testid` et des rôles ARIA. Le test de fumée vérifie qu'aucun `.css-` n'est présent dans la feuille.
2. Le JS trouve les éléments par `data-testid`, ids, rôles ARIA et heuristiques géométriques, **uniquement dans `core/10-anchors.js`**. Les classes écrites à la main dans le source de Deezer (`.naboo`, `.slider-track`, `.chakra-*`) sont tolérées en dernier recours, dans les ancres seulement.
3. Ne **jamais déplacer** un nœud possédé par React (plantage au rendu suivant). On ajoute des frères (`insertBefore`) ou des enfants en fin ; l'ordre visuel se règle en CSS (`order`).
4. Si une ancre ne résout pas, la feature ne tague rien et Deezer reste natif.
5. Une feature qui lève une exception est désactivée pour la session, les autres continuent.
6. *Réglages › À propos* et `__betterDeezer.health()` listent les ancres introuvables. Les ancres optionnelles (overlays fermés) valent `"not open"`.
7. Coupe-circuit : *Réglages › À propos › Désactiver*, ou `__betterDeezer.disable()`. Pour réactiver : `Ctrl ,` puis OK.

## 4. Deezer — ce qu'on sait

### Application Windows (étudiée sur la 8.0.10)

- Installeur NSIS → `resources/app.asar`. **Electron 38.4.0**, `loadURL("https://www.deezer.com/…")` : **l'interface de l'application EST le site web**, avec le même DOM et les mêmes `data-testid`.
- Fuses : RunAsNode=on, NodeOptions=on, NodeCliInspect=on, EmbeddedAsarIntegrityValidation=off, OnlyLoadAppFromAsar=off.
- Variables d'environnement reconnues : `DZ_DEVTOOLS=yes`, `DZ_DISABLE_UPDATE=yes`, `DZ_LANG`, `DZ_DEV_ENV`.
- Emplacement par défaut : `%LOCALAPPDATA%\Programs\deezer-desktop\Deezer.exe`. `patch.ps1` cherche aussi `Programs\Deezer`, Program Files et les clés Uninstall du registre.
- **Routage par le hash** : l'application charge `https://www.deezer.com/fr/` puis navigue en `#/fr/album/…`, et les liens de la barre latérale sont des `#/fr/…`. `location.pathname` vaut donc `/fr/` partout : toujours lire la route avec `BD.path()` (et `BD.routePrefix()` pour les liens qu'on fabrique).
- Fenêtre cachée (zone de notification) : `requestAnimationFrame` est en pause, donc `BD.schedule` aussi. Pour tester par CDP, amener la fenêtre au premier plan (`Page.bringToFront`).

### Lecteur web (bundle `app-web` et ses chunks)

- Design system **Tempo** = Chakra UI avec `cssVarPrefix: "tempo"`. Jetons sémantiques `background|text|icon|border|divider . neutral|accent|feedback . primary|secondary|tertiary|inverse|onDark|onLight|onAccent . default|hovered|pressed|selected|disabled|focused` → variables `--tempo-colors-…`. Polices `--tempo-fonts-body|heading|headline`, rayons `--tempo-radii-2xs…l`. Mode sombre : `.chakra-ui-dark` + `html[data-theme=dark]`, certains blocs portent leur propre `[data-theme]`. `styles/05-tempo.css` les repointe vers `--bd-*` (avec `!important`) : **c'est ce qui thème 90 % de l'application**.
- Mise en page : `.naboo` porte `--layout-sidebar-width` (**80px replié / 243px déplié**, clé localStorage `sidebar-collapsed`), `--layout-player-height: 80px`, `--layout-topbar-height: 80px`. La barre latérale est `position: fixed; top 0; bottom 0; width: var(--layout-sidebar-width)`.
- Ids : `#page_topbar`, `#page_content`, `#page_player` (+ `data-testid="miniplayer_container"`, barre fixe interne z-index 300).
- Lecteur : `play_button_play|pause|stop`, `previous_track_button`, `next_track_button`, `shuffle_play_button_on|off`, `repeat_button_off|all|single`, `add_to_favorite_button_on|off`, `add_to_playlist_button`, `item_cover|item_title|item_subtitle`, `elapsed_time`, `remaining_time`, `progress_bar` (= `input.slider-track-input[type=range]`, piste dessinée par `.slider-track-default` / `.slider-track-active`), `lyrics_button`, `queue_list_button`, `audio_settings_button`, `volume_button_default|mute` (clic = muet natif), `volume_menu` (popover au survol, `role=tooltip`) + `volume_menu_bar` (range 0–100, `onChange` → `setVolume`).
- **Seek** : le Slider de Deezer n'accepte une valeur que pendant un glisser (`mousedown` → `input` → `mouseup`). Sans `mousedown`, React remet l'ancienne valeur. La fixture reproduit ce comportement.
- Barre du haut : `search_container`, `search_field`, `search_popper` (`.popper-search`, contenu figé à 450 px par Deezer), `recent_search_title`, `recent_search_clear_button`, `topbar-profile`, `account-popover-content` (ul `role=navigation`, li `data-testid` = multiAccount, account, subscription, recommendations, getGiftCard, logout, display, support…), cloche = icône `BellOutlinedIcon` (popover `data-testid="popover-content"`), compteur `aria-label="topbar-notification-counter"`.
- Barre latérale : bouton `aria-label="Masquer|Afficher la barre latérale"` avec icône `PanelLeftIcon|PanelRightIcon`, `sidebar-profile`. Dans l'application, chevrons Précédent / Suivant (`ChevronLeftIcon` / `ChevronRightIcon`) en haut.
- **Les icônes Tempo portent leur nom en `data-testid`** (`HouseOutlinedIcon`, `HeartFilledIcon`, `PlusIcon`, `MoreHorizontalIcon`, `ExplicitIcon`…) : très bonnes ancres.
- Pages : `masthead`, `album-cover`, `artist-cover`, `user-cover`, `masthead-subtitle`, `creator-name`, `toolbar`, grille `role=grid` (lignes `role=row` `aria-rowindex`), `title`, `duration`, `popularity` (`aria-label="Popularité : 8 / 10"`, `note-active|inactive`), `select_button`, `section_title`, `section_title_cta`, `section-renderer`.
- Overlays : `modal_header`, `modal_body`, `modal_close_button`, `btn-modal-confirm|cancel`, `context-menu-content`, toasts Chakra (`#chakra-toast-manager-*`, `.chakra-toast__inner role=status`).
- Raccourcis natifs (lib `mousetrap`) : Espace, Maj+Entrée, `s`, ←/→, Maj+←/→, `r`, Maj+R, `m`, Maj+↑/↓, `l`, `0…9`, `h`/`?`.
- Paroles : le bouton Paroles de Deezer interroge `pipe.deezer.com` (GraphQL `track.lyrics.synchronizedWordByWordLines`) avec un JWT de `auth.deezer.com/login/renew`, tiré de la session ouverte dans la page. Better Deezer fait la même requête, avec repli sur LRCLIB.
- CSP : en mode *report-only* (rien n'est bloqué). Le CDN des pochettes (`cdn-images.dzcdn.net`) répond en CORS pour `https://www.deezer.com`.

## 5. Application Windows : comment le skin est injecté

Comme Spicetify pour Spotify : on modifie l'application Deezer elle-même, pas de deuxième application ni de lanceur. Le raccourci habituel de Deezer ouvre Deezer avec le skin.

`desktop/patch.ps1`, en PowerShell 5.1 pur :

- Lit `resources\app.asar` (pickle : `uint32 4 | uint32 headerSize | uint32 payloadSize | uint32 jsonLength | JSON | padding 4`, puis les données ; offsets = chaînes relatives au début des données). JSON lu et écrit avec `System.Web.Script.Serialization.JavaScriptSerializer` (`MaxJsonLength` au maximum : `ConvertFrom-Json` de PS 5.1 plafonne à 2 Mo, l'en-tête fait environ 700 Ko).
- Ajoute à la fin de `build/main.js` un hook ES5 entre `/*better-deezer-hook*/` et `/*/better-deezer-hook*/` : `app.on("web-contents-created")` → `wc.on("dom-ready")` → si l'URL est `https://*.deezer.com/`, lit `%LOCALAPPDATA%\BetterDeezer\better-deezer.user.js` et l'exécute (`executeJavaScript`, monde principal). Fichier absent → Deezer intact. Mettre à jour le skin = remplacer ce fichier, sans repatcher.
- Le nouveau `main.js` est **ajouté à la fin des données** et l'en-tête pointe dessus (hash d'intégrité recalculé) : aucun autre fichier ne bouge. Relecture de contrôle avant de remplacer, sauvegarde `app.asar.bd-backup`. `-Remove` retire le hook, `-Check` dit si Deezer est modifié, `-Quiet` (lancé à l'ouverture de session via `HKCU\…\Run\BetterDeezer`) repatche après une mise à jour de Deezer sans jamais fermer un Deezer ouvert.
- Chaque patch ajoute un `main.js` d'environ 180 Ko en fin d'archive ; les anciens restent comme octets morts jusqu'à la prochaine mise à jour de Deezer, qui remplace `app.asar`.
- On ne remplace pas l'application par un dossier `resources\app` : `main.js` utilise `getAppPath()` pour les locales et `titlebar.html`.

Abandonné : un lanceur qui injectait par CDP (`--remote-debugging-port`). Le port fonctionne, mais le lanceur s'est heurté à deux pièges de PowerShell 5.1 : `@(Invoke-RestMethod …)` garde le tableau JSON en un seul objet, et `ConnectAsync().GetAwaiter().GetResult()` pollue la valeur de retour d'une fonction. `test/cdp-inject.mjs` reste utile pour injecter dans le vrai site.

## 6. Installation et publication

- **Windows** : `irm https://github.com/Gabizoc/Better-Deezer/releases/latest/download/install.ps1 | iex`. `install.ps1` est **100 % ASCII** (vérifié en CI) car `irm | iex` peut mal décoder. Il télécharge les fichiers dans `%TEMP%\BetterDeezer-setup` (repli sur GitHub CLI si le téléchargement direct échoue) et lance `setup.ps1` (UTF-8 **avec BOM**, sinon PowerShell 5.1 le lit en ANSI). `setup.ps1` copie les scripts et le payload dans `%LOCALAPPDATA%\BetterDeezer`, crée `bin\better-deezer.cmd` et l'ajoute au PATH utilisateur (valeur non développée dans `HKCU\Environment`, puis diffusion de `WM_SETTINGCHANGE`), patche Deezer (le ferme et le relance s'il tournait), inscrit `patch.ps1 -Quiet` à l'ouverture de session et une entrée *Paramètres › Applications* (HKCU, sans droits administrateur). Deezer installé dans Program Files : installer depuis un PowerShell administrateur.
- **Commande `better-deezer`** (`cli.ps1`) : `status`, `update` (vérifie chaque fichier avec `SHA256SUMS.txt`), `apply`, `restore`, `restart`, `logs`, `uninstall`, `version`.
- **Navigateur** : zip de l'extension dans les Releases. Publication Chrome Web Store / Edge / Firefox AMO : pas encore faite.
- **Userscript** : `better-deezer.user.js` (Violentmonkey, Tampermonkey).
- **Publier une version** : changer `version` dans `package.json` et le badge du README, compléter `CHANGELOG.md`, puis pousser un tag `vX.Y.Z` identique. `release.yml` publie le zip de l'extension, le zip Windows, les scripts, le payload et `SHA256SUMS.txt`.

## 7. État et limites connues

Vérifié :
- Test de fumée complet en CI (fixture qui reproduit les ancres de Deezer).
- Vrai deezer.com hors connexion : album, artiste, vue En écoute avec paroles synchronisées, accent dynamique, recherche centrée à 1024 / 1280 / 1440 / 1920 px.
- Vrai deezer.com connecté, en lecture seule : ordre des sections de l'accueil dans les trois modes.
- Application Windows (Deezer 8.0.10, PowerShell 5.1) : patch, installation, commande `better-deezer` (dont `update` vers une vraie release), désinstallation puis réinstallation.

Pas encore vérifié en conditions réelles :
- Lecture audio sur un compte (volume, seek, minuteur, coup de cœur) : logique testée sur la fixture seulement.
- Paroles mot à mot de Deezer : testées sur la fixture seulement.
- Page de résultats de recherche ; Firefox ; comportement après une vraie mise à jour de l'application Deezer.

### Tester sur un vrai compte

- Lecture seule : pas de coup de cœur, pas d'ajout, pas de lecture, pas de recherche tapée.
- Le script de test bloque au niveau réseau toute requête qui modifie le compte (`gw-light.php?method=…add|remove|set|log…`, mutations GraphQL, flux média).
- **Jamais de cookies, de jetons ni de valeur `arl` dans le dépôt** (`*cookies*.json` est ignoré par Git). Une session de test doit être fermée (déconnexion de tous les appareils) à la fin.

## 8. Backlog (par priorité)

1. Retours des premiers utilisateurs (Windows + Chrome) et corrections.
2. « Ne plus me recommander » depuis le menu ⋯ d'une carte (aujourd'hui dans les réglages ; filtre texte, à affiner par id d'artiste).
3. Clic milieu sur une carte = ajouter à la file (piloter le menu contextuel).
4. Accueil : ordre manuel des sections (glisser-déposer dans les réglages).
5. Aperçu du temps au survol de la barre de progression ; numéro → ▶ au survol des lignes.
6. Page de résultats de recherche à styler (avec un compte de test).
7. Publication Chrome Web Store / Edge / Firefox (`browser_specific_settings` pour Firefox).
8. Idées de modules : visualiseur, karaoké mot à mot via LRCLIB « enhanced », mini-lecteur Picture-in-Picture, statistiques d'écoute locales.

## 9. Conventions

- Branche par défaut : `main`. Messages de commit en anglais, à l'impératif, un sujet par commit.
- Toute nouvelle ancre → `core/10-anchors.js` (+ `BD.optionalAnchors` si elle n'existe que quand un overlay est ouvert).
- Toute nouvelle couleur → token d'abord (`00-tokens.css`, sombre ET clair).
- Toute nouvelle feature → `label` [fr, en] pour apparaître dans les réglages ; un module → `module: true`, `glyph`, `description`, `live` + `teardown` (voir `docs/modules.md`). Ne pas nommer une méthode comme un champ réservé (`label`, `icon`…).
- Toute nouvelle requête réseau → `credentials: "omit"` sauf nécessité documentée, un délai maximal, et une ligne dans `docs/confidentialite.md`.
- Tout nouveau message d'erreur visible → une ligne dans `docs/depannage.md` (`docs/troubleshooting.md` ne fait que rediriger, pour les liens de la 1.0.0).
- `npm run build` reste sans dépendance. `npm test` utilise un Playwright installé globalement (la CI l'installe à la volée).
- Après un changement visuel : `npm run build && npm test`, puis regarder les captures dans `test/.out/`.
