# Contribuer à Better Deezer

Merci de votre intérêt. Les contributions sont bienvenues en français ou en anglais.

## Signaler un problème

Ouvrez une [issue](https://github.com/Gabizoc/Better-Deezer/issues/new/choose) avec :

- votre version de Better Deezer (*Réglages › À propos*, ou `better-deezer version`) et la cible : application Windows, extension ou userscript ;
- la version de Deezer, du navigateur ou de Windows ;
- ce qui s'affiche dans *Réglages › À propos* (éléments de Deezer introuvables), ou la sortie de `__betterDeezer.health()` dans la console (`F12`) ;
- pour l'application Windows, la fin du journal : `better-deezer logs`.

**Ne collez jamais de cookies, de jetons ni votre valeur `arl`** : personne n'en a besoin pour déboguer Better Deezer. Une faille de sécurité ne va pas dans une issue publique : voir [SECURITY.md](SECURITY.md).

Après une mise à jour de Deezer, la plupart des problèmes viennent d'un élément de la page qui a changé de nom. Le signaler avec la sortie de `health()` suffit souvent à le corriger.

## Proposer un thème

Un thème est un seul fichier JSON, sans code. Tout est expliqué dans [docs/themes.md](docs/themes.md) :

1. créez-le avec l'éditeur (*Réglages › Thèmes › Créer*) et exportez-le ;
2. ajoutez-le dans `themes/community/` ;
3. lancez `npm run build`, qui valide le thème, vérifie la lisibilité et régénère `themes/index.json` ;
4. ouvrez une pull request avec une capture en mode sombre et/ou clair.

## Proposer du code

Prérequis : Node 18 ou plus récent. Le build n'a aucune dépendance.

```bash
npm run build              # sortie dans dist/
npm test                   # test de fumée dans Chromium (Playwright installé globalement)
npm run check              # build + vérification de syntaxe + test de fumée
node test/cdp-inject.mjs   # injecte la build dans le vrai deezer.com via DevTools
```

Pour tester l'extension : `chrome://extensions` › Mode développeur › *Charger l'extension non empaquetée* › `dist/extension`.

Avant d'écrire du code, lisez [HANDOFF.md](HANDOFF.md) : l'architecture, ce qu'on sait de la page de Deezer et surtout les **règles anti-casse**. En résumé :

- le CSS ne cible jamais les classes générées de Deezer (`css-xxxx`) ;
- seul `src/core/10-anchors.js` sait trouver les éléments de Deezer ;
- on ne déplace jamais un nœud géré par React ;
- toute nouvelle couleur passe par un token, en sombre et en clair ;
- toute nouvelle requête réseau est documentée dans [docs/confidentialite.md](docs/confidentialite.md).

Pour la pull request :

- un sujet par pull request, avec des messages de commit en anglais, à l'impératif ;
- `npm run check` passe ;
- une capture avant / après pour tout changement visuel ;
- la doc à jour (`docs/`, `HANDOFF.md`, et une ligne dans `CHANGELOG.md` sous *Non publié*).

Les scripts Windows (`desktop/*.ps1`) doivent tourner sous Windows PowerShell 5.1. `install.ps1` reste en ASCII pur, les autres en UTF-8 avec BOM ; la CI vérifie les deux, ainsi que PSScriptAnalyzer.

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous la [licence MIT](LICENSE) du projet.
