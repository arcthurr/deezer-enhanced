# Modules

Les modules sont des extras optionnels, un peu comme les extensions de Spicetify. Activez-les ou coupez-les dans *Réglages › Modules* : chacun s'applique tout de suite, sans recharger.

| Module | Par défaut | Ce qu'il fait | Réseau |
| --- | --- | --- | --- |
| **Vue « En écoute » + paroles synchronisées** | activé | `F` ou le bouton du lecteur : une vue plein écran avec la grande pochette à gauche et les paroles à droite, qui défilent avec la musique. La ligne en cours se remplit au rythme du chant et les passages instrumentaux affichent trois points qui s'allument jusqu'au retour de la voix. Cliquez une ligne pour y aller ; cliquez ou faites glisser la barre de progression (flèches ±5 s). Pochette floutée en fond, lecture / précédent / suivant. `Échap` ferme. | Paroles : voir [plus bas](#les-paroles), seulement quand la vue est ouverte |
| **Transitions fluides** | activé | Les pages apparaissent en fondu, la pochette du lecteur se fond au changement de titre, les cartes se soulèvent au survol. Désactivé quand le système demande moins d'animations. | aucun |
| **Masquer les bannières promotionnelles** | activé | Masque les bandeaux « Passez à Premium » et « Inscrivez-vous », les emplacements publicitaires et les playlists sponsorisées. Purement visuel. | aucun |
| **Minuteur de sommeil** | activé | 15 / 30 / 45 / 60 minutes ou *Fin du titre*, depuis la carte du module. Un badge avec le compte à rebours s'affiche dans le lecteur (cliquez-le pour annuler). Le volume baisse pendant la dernière minute, Deezer se met en pause, puis le volume est remis. | aucun |
| **Couleur d'accent selon la pochette** | coupé | L'accent (bouton lecture, barre de progression, interrupteurs, titre en cours) prend la couleur principale de la pochette en cours, éclaircie ou assombrie jusqu'à être lisible sur le fond du thème. | aucun (CDN d'images de Deezer) |
| **Mode compact** | coupé | Lecteur plus petit, espacements resserrés, en-têtes de page plus petits. | aucun |

## Les paroles

Deux sources, au choix dans *Réglages › Lecture et volume › Paroles* :

1. **Deezer** (par défaut) : les paroles de Deezer, via votre session Deezer, exactement comme le bouton paroles de Deezer. Beaucoup de titres sont synchronisés **mot à mot** : chaque mot s'allume quand il est chanté. Les autres le sont ligne par ligne, avec la vraie durée de chaque ligne.
2. **[LRCLIB](https://lrclib.net)**, quand Deezer n'en a pas (ou avec *LRCLIB seul*) : une base libre, ouverte et tenue par la communauté. Better Deezer demande d'abord le titre, l'artiste et la durée exacts, puis cherche et garde la version la plus proche (à moins de 8 secondes de la durée du titre, paroles synchronisées en priorité). Seulement le début de chaque ligne : la ligne se remplit à un rythme estimé.

La source est indiquée sous les paroles (*Paroles : Deezer, mot à mot*, *Paroles : Deezer*, *Paroles : LRCLIB*).

Tout le monde peut ajouter ou corriger des paroles sur lrclib.net ; elles apparaissent ensuite pour tous.

## Écrire un module

Un module est un fichier de `src/features/` avec `module: true`. Exemple minimal, `src/features/hello.js` :

```js
/*
 * Hello: shows the playing title in the window title.
 */
BD.defaultOff.add("hello"); // opt-in: remove this line to have it on by default
BD.feature({
  id: "hello",
  module: true,
  live: true, // can be switched on/off without reloading
  glyph: "M4 12h16M12 4v16", // 24×24 SVG path, drawn with a stroke
  label: ["Titre dans l'onglet", "Title in the tab"],
  description: ["Le titre en cours dans le nom de l'onglet.", "The playing title in the tab name."],

  setup() {
    this.original = document.title;
  },

  update() {
    // Runs after every DOM change (throttled to one per frame): keep it cheap and idempotent.
    const title = BD.q('[data-bd="dock"] [data-testid="item_title"]')?.textContent.trim();
    const next = title ? `♪ ${title}` : this.original;
    if (document.title !== next) document.title = next;
  },

  teardown() {
    // Undo everything setup/update did: switching the module off must leave no trace.
    document.title = this.original;
  }
});
```

Lancez `npm run build`, rechargez l'extension : le module apparaît dans *Réglages › Modules*.

Les règles (les mêmes que partout dans Better Deezer, voir [HANDOFF.md](../HANDOFF.md)) :

- **Trouvez les éléments de Deezer avec `BD.anchors` ou `data-testid` / ARIA**, jamais avec les classes `css-xxxx`.
- **Ne déplacez ni ne supprimez jamais les nœuds de Deezer** : ils appartiennent à React. Marquez-les (`BD.mark(el, "value", "data-bd-…")`) et stylez la marque, ou insérez vos propres éléments à côté.
- Votre interface : construisez-la avec `BD.h(tag, props, ...children)`, des classes préfixées `bd-`, les couleurs des variables `--bd-*` pour que tous les thèmes s'appliquent.
- Le texte dans les deux langues : `BD.t("Français", "English")`.
- Pour enregistrer : `BD.settings.get(key, fallback)` / `BD.settings.set(key, value)` (stocké sous `bd:<key>`).
- Le réseau : seulement si le module en a besoin, avec `credentials: "omit"` et un délai maximal, et dites ce qui est envoyé dans sa `description` et dans [Confidentialité](confidentialite.md).
- Les erreurs sont rattrapées : un module qui plante est coupé pour la session et nommé dans la console, le reste continue.
- Ajoutez une vérification dans `test/smoke.mjs` (la page de test est `test/fixture.html`).
