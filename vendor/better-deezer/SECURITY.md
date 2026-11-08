# Sécurité

Better Deezer s'exécute dans votre session Deezer et, sur Windows, modifie l'application Deezer. Une faille peut donc toucher votre compte ou votre machine : merci de la signaler de façon privée.

## Signaler une faille

Utilisez le signalement privé de GitHub : onglet **Security › Report a vulnerability** du dépôt ([lien direct](https://github.com/Gabizoc/Better-Deezer/security/advisories/new)). N'ouvrez pas d'issue publique.

Indiquez la version concernée, la cible (application Windows, extension, userscript) et les étapes pour reproduire. Vous recevrez une réponse dès que possible ; un correctif est publié dans une nouvelle version, et le signalement rendu public ensuite, avec votre accord pour vous citer.

## Ce qui est concerné

- Le code de la surcouche (`src/`), l'extension (`extension/`) et le userscript.
- Les scripts Windows (`desktop/`), en particulier le correctif de `app.asar` et la commande `better-deezer update` (téléchargement et vérification SHA-256).
- La validation des thèmes : un thème ne doit jamais pouvoir exécuter du code ni charger une ressource externe.

Les failles de Deezer lui-même sont à signaler à Deezer.

## Vos données

Better Deezer n'a ni serveur, ni compte, ni télémétrie. Les seules requêtes réseau sont listées dans [docs/confidentialite.md](docs/confidentialite.md). Personne ne vous demandera jamais vos cookies, vos jetons ou votre valeur `arl`.
