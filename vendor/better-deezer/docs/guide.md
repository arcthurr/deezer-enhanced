# Guide

Better Deezer restyle le lecteur web de Deezer (www.deezer.com) et l'application Windows, et ajoute ce que Deezer n'a pas. Tout se passe sur votre machine : les serveurs de Deezer voient un Deezer normal.

L'installation est décrite dans le [README](../README.md#installer). Un souci ? Voir le [Dépannage](depannage.md).

## Premier lancement

Une carte en bas à droite rappelle les trois choses à savoir :

- `Ctrl ,` (`⌘ ,` sur Mac) ouvre les **Réglages Better Deezer**. Ils sont aussi dans le menu du profil (votre avatar, en haut à droite).
- `F` ouvre la vue **En écoute** avec les paroles synchronisées.
- La **molette** marche sur le volume et sur la pochette du lecteur.

La carte n'apparaît qu'une fois. Ensuite, un petit badge « Better Deezer x.y.z » s'affiche 3 secondes au démarrage (à couper dans *Réglages › Apparence*).

## Ce qui change

### Barre du haut
- Le champ de recherche est **toujours centré sur la fenêtre**, quelle que soit la largeur de la barre latérale, avec un bouton **Accueil** rond à sa gauche. `Ctrl K` y place le curseur.
- Les résultats s'ouvrent juste sous le champ, à la même largeur, avec en pied la liste des raccourcis de recherche.

### Barre latérale et lecteur
- La barre latérale flotte, centrée à l'écran, réduite ou non. La page active est marquée d'une barre de couleur.
- Le lecteur flotte en bas : bouton lecture rond de la couleur d'accent, cœur plein quand le titre est aimé, barre de progression fine entre les deux durées.
- **Volume** : un clic sur le haut-parleur déplie un curseur, un second clic coupe le son. Molette sur le haut-parleur ou le curseur : ±5 % (±1 % avec Maj ; le pas peut être 2, 5 ou 10 % dans *Réglages › Lecture et volume*). Alt+clic ou clic milieu : couper le son.
- **Avancer à la molette** sur la pochette du lecteur : ±5 s. La barre de progression ignore la molette : faire défiler la page ne déplace jamais la musique.
- Double-clic sur le titre dans le lecteur : ouvre son album.
- Une infobulle sur chaque icône, avec le geste qu'elle accepte.

### Pages
- Les en-têtes d'album, de playlist et d'artiste sont teintés de la couleur de la pochette.
- Listes de titres : lignes plus sobres, titre en cours mis en avant, popularité en barre fine, et un filtre **Masquer les titres explicites**.
- Accueil : un message d'accueil avec la date, des sections à masquer (*Réglages › Accueil*) et à réordonner (*Réglages › Recommandations*).
- Fenêtres, menus, notifications (avec les filtres *Sorties / Social*), menu du profil et messages suivent le thème.

## Les réglages

| Onglet | Ce qu'on y fait |
| --- | --- |
| **Thèmes** | Clair / sombre / auto, choisir un thème, parcourir la Marketplace, installer depuis un lien ou un fichier, créer ou personnaliser un thème ([Thèmes](themes.md)) |
| **Modules** | Activer ou couper les extras, en direct ([Modules](modules.md)) |
| **Apparence** | Activer ou couper chaque partie visuelle, le badge de démarrage, les **Infobulles** (celles de Better Deezer, leurs astuces, celles de Deezer : coupées par défaut ; la carte titre précédent / suivant : activée) |
| **Barre latérale** | Les entrées telles que Deezer les a (vraies icônes et vrais noms : une entrée ajoutée ou renommée par Deezer apparaît d'elle-même). Afficher ou masquer chacune, glisser la poignée ou utiliser `Alt ↑` `Alt ↓` pour réordonner dans un groupe, *Rétablir par défaut*. Les entrées de la Bibliothèque sont masquées par défaut ; vos playlists et éléments épinglés restent toujours. |
| **Lecture et volume** | Fonctions du lecteur, gestes à la molette, pas du volume, source des paroles (Deezer mot à mot, ou LRCLIB) |
| **Accueil** | Masquer les carrousels de l'accueil que vous n'utilisez pas |
| **Recommandations** | Ordre de l'accueil : *Deezer* (inchangé), *Familier* (vos mix et favoris d'abord) ou *Découverte* (nouveautés et tendances d'abord), plus *Selon l'heure*. Et une liste **Ne plus me recommander** : les cartes et titres qui correspondent à un artiste, un genre ou un mot sont masqués partout |
| **Raccourcis** | Tous les raccourcis clavier et gestes |
| **À propos** | Version, le bilan (éléments de Deezer reconnus), l'aide, la réinitialisation, couper Better Deezer |

Les changements s'appliquent tout de suite. Les rares qui demandent un rechargement affichent une barre *Recharger* en bas du panneau.

À propos des Recommandations : Better Deezer ne peut pas changer ce que Deezer recommande (cela se passe sur les serveurs de Deezer). Il réordonne et masque ce que Deezer affiche, sur cet appareil seulement.

## Raccourcis clavier

| Touches | Action |
| --- | --- |
| `Ctrl K` / `⌘ K` | Recherche |
| `Ctrl ,` / `⌘ ,` | Réglages Better Deezer (réactive aussi Better Deezer si vous l'avez coupé) |
| `F` | Vue En écoute avec les paroles |
| `Échap` | Fermer la vue, les réglages ou un menu |
| `Q` | File d'attente |
| Ceux de Deezer | `Espace` lecture / pause, `←` `→` avancer / reculer, `Maj ←` `Maj →` précédent / suivant, `Maj ↑` `Maj ↓` volume, `M` couper le son, `L` aimer, `S` recherche, `R` répéter, `0`–`9` aller à, `H` pour la liste de Deezer |

Les raccourcis sont ignorés pendant la saisie dans un champ.

## Où sont vos réglages

Dans le `localStorage` du navigateur pour deezer.com, sous des clés qui commencent par `bd:` (par exemple `bd:themes:active`). Rien n'est synchronisé : chaque navigateur, et l'application Windows, a ses propres réglages. Les thèmes installés y sont aussi.

### Tout réinitialiser

- *Réglages › À propos › Réinitialiser* (demande confirmation, puis recharge), ou
- dans la console des DevTools (`F12`) sur deezer.com :
  ```js
  Object.keys(localStorage).filter((k) => k.startsWith("bd:")).forEach((k) => localStorage.removeItem(k)); location.reload();
  ```
  Avec l'extension, choisissez le contexte **Better Deezer** dans la liste de la console, ou lancez-le dans le contexte par défaut : les deux voient le même `localStorage`.

## Couper Better Deezer

- Une fonction : son interrupteur dans les réglages.
- Tout, pour l'instant : *Réglages › À propos › Désactiver Better Deezer*. Deezer se recharge sans modification. `Ctrl ,` propose de le réactiver.
- Garder Better Deezer installé mais rendre son apparence d'origine à l'application Windows : `better-deezer restore` (`better-deezer apply` le remet).
- Pour de bon : supprimez l'extension, ou lancez `better-deezer uninstall` (ou *Paramètres Windows › Applications › Better Deezer › Désinstaller*). L'application Deezer est remise exactement comme avant. Vos réglages Better Deezer restent dans le stockage de Deezer tant que vous ne videz pas son cache, ou faites *Réinitialiser* avant.
