# Journal des versions

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros suivent [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé
- Vue En écoute : le titre garde « ? », « ! », « : » et « ; » sur la même ligne que le mot précédent, et ses lignes sont équilibrées.

## [1.1.3] — 2026-11-07

### Modifié
- Nouvelle icône : un « b » blanc dont la boucle est un bouton lecture, sur l'accent violet. Source vectorielle dans `store/icon.svg`.

## [1.1.2] — 2026-11-07

### Ajouté
- Icônes de l'extension, prête pour le Chrome Web Store (textes et visuels de la fiche dans `store/`).
- Politique de confidentialité en anglais (`docs/privacy.md`).
- Fichiers de projet open source : guide de contribution, politique de sécurité, modèles d'issues et de pull requests, ce journal.

### Modifié
- Notes de maintenance (`HANDOFF.md`) réécrites pour un dépôt public.
- Messages d'erreur et dépannage : plus de mention d'un dépôt privé.

## [1.1.1] — 2026-11-07

### Modifié
- Bouton lecture du lecteur réduit à 32 px.

### Corrigé
- Ligne d'installation de secours via GitHub CLI.

## [1.1.0] — 2026-11-07

### Ajouté
- Commande `better-deezer`, sur le modèle de `spicetify` : `status`, `update` (avec vérification SHA-256), `apply`, `restore`, `restart`, `logs`, `uninstall`, `version`.
- Entrée *Paramètres Windows › Applications* pour désinstaller.
- README et documentation en français.

### Modifié
- L'application Windows est modifiée directement (`app.asar`), comme Spicetify le fait pour Spotify : plus de lanceur ni de raccourci séparé. Le correctif est remis à l'ouverture de session après une mise à jour de Deezer.
- La barre latérale dépliée est centrée comme la barre repliée.

### Corrigé
- Dans l'application Windows, toutes les entrées de la barre latérale paraissaient actives (routage par le hash).
- Des barres de défilement réapparaissaient sous les carrousels de l'accueil.
- Les chevrons Précédent / Suivant de l'application se superposaient à la barre latérale.
- Popover des recherches récentes : « Tout effacer » et les cœurs restaient au milieu ; première lettre des titres rognée.
- Better Deezer ne démarre plus sur les pages vitrines de deezer.com, seulement sur le lecteur.

## [1.0.0] — 2026-11-07

Première version publique.

### Ajouté
- Thème Graphite (sombre et clair) et 5 autres thèmes intégrés, Marketplace de thèmes de la communauté, installation par lien ou fichier, éditeur avec aperçu en direct et contrôle de lisibilité.
- Modules activables à chaud : vue **En écoute** avec paroles synchronisées (mot à mot quand Deezer les a, sinon LRCLIB), transitions entre les pages, masquage des bannières promotionnelles, minuteur de sommeil avec fondu, accent selon la pochette, mode compact.
- Recherche centrée sur la fenêtre avec bouton Accueil, `Ctrl K`.
- Barre latérale et lecteur flottants ; barre latérale configurable (afficher, masquer, réordonner).
- Volume : curseur qui se déplie au clic, molette (5 %, 1 % avec Maj). Molette sur la pochette du lecteur pour avancer de 5 s.
- Accueil : sections à masquer, ordre Familier / Découverte / selon l'heure, liste *Ne plus me recommander*.
- En-têtes d'album et d'artiste teintés par la pochette, popularité en barre fine, filtre *Masquer les titres explicites*.
- Menus, notifications, modales et toasts restylés ; réglages Better Deezer (`Ctrl ,`) ; carte de bienvenue au premier lancement.
- Extension Chrome / Edge, userscript et installation Windows en une ligne.

[Non publié]: https://github.com/Gabizoc/Better-Deezer/compare/v1.1.3...HEAD
[1.1.3]: https://github.com/Gabizoc/Better-Deezer/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/Gabizoc/Better-Deezer/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Gabizoc/Better-Deezer/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Gabizoc/Better-Deezer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Gabizoc/Better-Deezer/releases/tag/v1.0.0
