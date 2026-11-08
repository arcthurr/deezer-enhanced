# Thèmes

Un thème Better Deezer est **un seul fichier JSON** : un nom, des couleurs pour le mode sombre et/ou clair, et en option des arrondis, des polices et un peu de CSS. Pas de code, pas de compilation. Les thèmes s'installent depuis *Réglages › Thèmes* (Marketplace, lien ou fichier) et se partagent dans le dossier `themes/community/` de ce dépôt.

- [Créer un thème en 2 minutes (sans code)](#créer-un-thème-en-2-minutes)
- [Le format](#le-format)
- [Les couleurs](#les-couleurs)
- [CSS personnalisé](#css-personnalisé)
- [Tester depuis la console](#tester-depuis-la-console)
- [Publier sur la Marketplace](#publier-sur-la-marketplace)
- [Règles et limites](#règles-et-limites)

## Créer un thème en 2 minutes

1. `Ctrl ,` › **Thèmes** › **Créer un thème** (ou **Personnaliser** sur un thème existant pour partir de lui).
2. Choisissez les couleurs : l'aperçu s'applique en direct sur Deezer, derrière le panneau. L'encadré **Lisibilité** prévient quand une couleur de texte est trop proche de son fond.
3. **Enregistrer et appliquer**. Votre thème apparaît dans *Vos thèmes*, marqué *perso*.
4. **Exporter .json** pour le partager ou en garder une copie.

Le choix **Palette sombre / Palette claire** en haut de l'éditeur indique le mode que vous modifiez (et l'affiche). Un thème peut fournir les deux modes ou un seul (« Sombre uniquement » / « Clair uniquement »).

## Le format

```json
{
  "schema": 1,
  "id": "mon-theme",
  "name": "Mon thème",
  "author": "Votre nom",
  "description": "Une phrase affichée sur la carte.",
  "version": "1.0.0",
  "modes": ["dark", "light"],
  "colors": {
    "dark":  { "bg": "#0e0f13", "accent": "#7c5cff" },
    "light": { "bg": "#f7f7f9", "accent": "#5b3df5" }
  },
  "radius": { "card": 16, "dock": 24 },
  "fonts": { "display": "Georgia, serif" },
  "css": "html[data-bd-skin=\"mon-theme\"] [data-bd=\"dock\"] { border-width: 2px !important; }"
}
```

| Champ | Obligatoire | Remarques |
| --- | --- | --- |
| `schema` | oui | Toujours `1` pour l'instant. |
| `id` | oui | 2 à 41 caractères : minuscules, chiffres, tirets. Doit correspondre au nom du fichier dans `themes/community/` (`mon-theme.json`). |
| `name` | oui | 60 caractères au plus. |
| `author`, `version` | non | 60 caractères au plus. Augmentez `version` quand vous mettez à jour un thème publié. |
| `description` | non | 240 caractères au plus. |
| `modes` | non | `["dark"]`, `["light"]` ou les deux. Par défaut, les palettes fournies. Un thème à un seul mode impose ce mode tant qu'il est actif. |
| `colors` | non | Un objet par mode, voir plus bas. **Toute couleur omise reprend celle du thème Graphite par défaut** : un thème peut se résumer à une couleur d'accent. |
| `radius` | non | Arrondis en px : `chip` 0–16, `cover` 0–24, `card` 0–32, `menu` 0–32, `dock` 0–40. |
| `fonts` | non | `display` (titres) et `ui` (tout le reste) : noms de polices déjà installées sur la machine, avec des polices de secours. Pas de polices web. |
| `css` | non | CSS en plus, 20 000 caractères au plus, voir [CSS personnalisé](#css-personnalisé). |

## Les couleurs

Treize clés par mode. Better Deezer les applique à toute l'interface de Deezer (y compris les menus et fenêtres que Deezer affiche lui-même) et en tire les variantes survol, appui et atténuée de l'accent.

| Clé | Utilisée pour | Contrôle de lisibilité |
| --- | --- | --- |
| `bg` | fond de la page | |
| `surface-1` | barre latérale, lecteur, panneaux | |
| `surface-2` | lignes survolées, champs, pastilles | `text` ≥ 4,5 dessus |
| `surface-3` | éléments sélectionnés, appuyés | |
| `surface-4` | élévation la plus haute | |
| `line` | bordures, séparateurs | |
| `line-strong` | bordures actives / mises en avant | |
| `text` | texte principal | ≥ 7 sur `bg` |
| `text-2` | texte secondaire (artistes, informations) | ≥ 4,5 sur `bg` |
| `text-3` | texte tertiaire (astuces, dates) | ≥ 4,5 sur `bg` |
| `accent` | bouton lecture, barre de progression, interrupteurs, titre en cours | |
| `accent-text` | accent utilisé comme texte (titre en cours, liens) | ≥ 4,5 sur `bg` |
| `on-accent` | icônes et texte posés sur `accent` | ≥ 3 sur `accent` |

Valeurs : `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()`. Le contrôle de lisibilité ne porte que sur les valeurs `#rrggbb`. Les nombres sont des rapports de contraste WCAG. Dans l'éditeur, ce sont des avertissements (vous pouvez enregistrer quand même) ; pour les thèmes publiés dans ce dépôt, la compilation **refuse** une palette en dessous, pour que toute la Marketplace reste lisible.

## CSS personnalisé

Pour ce que les couleurs ne permettent pas. Limitez chaque règle à votre thème, pour qu'elle ne s'applique que lorsqu'il est actif :

```css
html[data-bd-skin="mon-theme"] [data-bd="rail"] { backdrop-filter: blur(12px); }
```

Better Deezer marque l'interface de Deezer avec des attributs stables. **Ciblez ceux-là, jamais les classes `css-xxxx` de Deezer**, qui changent à chaque version.

| Attribut | Éléments |
| --- | --- |
| `data-bd="topbar"`, `"search-slot"`, `"rail"`, `"dock"`, `"page"` | la mise en page principale |
| `data-bd="page-header"` | en-tête d'album / playlist / artiste |
| `data-bd="modal"`, `"menu"`, `"toast"`, `"search-popover"`, `"scrim"` | les surcouches |
| `data-bd-role="track-row"`, `"card"`, `"section-title"`, `"play"`, `"like"`, `"progress-track"`, `"progress-fill"` | contenu et lecteur |
| `data-bd-playing="true"` | la ligne du titre en cours |
| `data-bd-collapsed="true"` sur le rail | barre latérale réduite |
| `html[data-bd-theme="dark"]` / `"light"` | mode actuel |
| `.bd-np-*` | la vue En écoute (`#bd-np`) |

Et les variables CSS, pour réutiliser la palette : `--bd-bg`, `--bd-surface-1`…`4`, `--bd-text`, `--bd-text-2`, `--bd-text-3`, `--bd-accent`, `--bd-accent-hover`, `--bd-accent-soft`, `--bd-on-accent`, `--bd-line`, `--bd-r-card`, `--bd-r-dock`, `--bd-font-display`, `--bd-font-ui`, `--bd-ease`, `--bd-t-fast`.

Les styles en ligne de Deezer l'emportent souvent : ajoutez `!important` quand une règle ne s'applique pas.

## Tester depuis la console

Sur deezer.com, `F12` › *Console* (avec l'extension, choisissez le contexte **Better Deezer**) :

```js
const t = { schema: 1, id: "test", name: "Test", colors: { dark: { accent: "#ff5c8a" } } };
__betterDeezer.themes.validate(t)   // { ok, theme, errors }
__betterDeezer.themes.preview(t)    // appliquer sans enregistrer (fermer les réglages annule)
__betterDeezer.themes.install(t)    // enregistrer dans Vos thèmes
__betterDeezer.themes.activate("test")
__betterDeezer.themes.list()        // identifiants de tous les thèmes installés
```

## Publier sur la Marketplace

1. Forkez le dépôt.
2. Ajoutez votre fichier sous `themes/community/<id>.json` (le nom du fichier doit être l'`id`).
3. Lancez `npm run build` (Node 18+, aucune dépendance) : il valide chaque thème avec le même code que l'extension, vérifie les règles de contraste ci-dessus et régénère `themes/index.json` (la liste de la Marketplace). Corrigez les erreurs signalées.
4. Ouvrez une pull request avec une capture en mode sombre et/ou clair.

Une fois fusionné, le thème apparaît dans la Marketplace de tout le monde (elle télécharge `themes/index.json` depuis la branche par défaut) et est inclus hors ligne dans la version suivante.

## Règles et limites

Appliquées à l'installation, dans l'éditeur et à la compilation, pour qu'un thème ne puisse jamais rien charger ni exécuter :

- Le CSS ne peut pas contenir `url(`, `@import`, `expression(`, `javascript:`, `behavior:`, `-moz-binding`, `</style`, ni d'échappements avec antislash.
- Pas de polices venant du web : seulement celles installées sur la machine.
- Un fichier de thème fait 100 Ko au plus ; `css` 20 000 caractères au plus.
- Une clé inconnue dans `colors` ou `radius` est une erreur (une faute de frappe ne passe pas en silence).

Les messages d'erreur sont expliqués dans [Dépannage › Thèmes](depannage.md#thèmes).
