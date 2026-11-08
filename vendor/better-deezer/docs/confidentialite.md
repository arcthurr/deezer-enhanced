# Confidentialité

Better Deezer n'a ni serveur, ni compte, ni statistiques, ni télémétrie.

## Ce qui reste sur votre machine

Tout : vos réglages, les thèmes installés, la liste *Ne plus me recommander* et les sections d'accueil masquées sont dans le `localStorage` de deezer.com (clés qui commencent par `bd:`). Ils ne quittent jamais votre navigateur ni l'application Windows.

## Les seules requêtes réseau de Better Deezer

| Quand | Vers | Ce qui est envoyé |
| --- | --- | --- |
| Vous ouvrez la vue **En écoute** (module activé, source des paroles *Deezer*, par défaut) | `auth.deezer.com`, `pipe.deezer.com` (les serveurs de Deezer) | Les mêmes requêtes que le bouton paroles de Deezer : un jeton de courte durée tiré de votre session Deezer (gardé 4 minutes en mémoire, jamais enregistré), puis l'identifiant du titre en cours pour obtenir ses paroles. Rien ne sort de chez Deezer. |
| Pareil, quand Deezer n'a pas les paroles du titre, ou avec la source *LRCLIB seul* | `lrclib.net` | Le titre, l'artiste et la durée du morceau en cours, pour trouver ses paroles. Pas de compte, pas de cookie (`credentials: "omit"`). Les résultats sont gardés pour la session. |
| Vous ouvrez l'onglet **Thèmes** | `raw.githubusercontent.com` | Un simple téléchargement de `themes/index.json` (la liste de la Marketplace), une fois par session. |
| Vous installez un thème **depuis un lien** | le lien que vous avez saisi | Un simple téléchargement de ce fichier. |
| Vous lancez `better-deezer update` ou `status` (application Windows) | `api.github.com`, `github.com` | La demande de la dernière version et, pour `update`, le téléchargement de ses fichiers. Rien sur vous. |

Les couleurs des pochettes (teinte des en-têtes, accent selon la pochette) sont lues depuis le CDN d'images de Deezer, que la page charge déjà.

Coupez le module *En écoute*, n'ouvrez jamais la Marketplace, et Better Deezer ne fait aucune requête.

Dans l'extension, un tout petit script (`page-bridge.js`) tourne dans la page de Deezer pour lire le titre en cours (l'extension elle-même ne voit pas le lecteur de Deezer). Il lit cela et rien d'autre.

## Un thème ne peut pas vous pister

Un thème, ce sont des données, pas du code : des couleurs, des tailles, des noms de polices et du CSS. Le CSS qui pourrait charger quoi que ce soit (`url()`, `@import`) ou exécuter du code est refusé à l'installation. Un thème ne voit pas votre compte et ne peut rien envoyer nulle part.

## L'application Windows

L'installation ajoute quelques lignes au fichier `app.asar` de Deezer. Elles exécutent `%LOCALAPPDATA%\BetterDeezer\better-deezer.user.js` dans les pages deezer.com de l'application. Elles n'ouvrent aucun port et ne font aucune requête ; le skin se comporte ensuite exactement comme dans le navigateur. Détails dans le [README](../README.md#la-commande-better-deezer).
