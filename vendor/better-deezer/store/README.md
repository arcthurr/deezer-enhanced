# Chrome Web Store listing

Everything to copy into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) for Better Deezer. Keep it in sync with the extension.

## Package

`better-deezer-extension.zip` from the latest [release](https://github.com/Gabizoc/Better-Deezer/releases/latest), or `npm run build` then zip the contents of `dist/extension` (the `manifest.json` must be at the root of the zip). The version comes from `package.json`; each upload needs a higher version.

## Store listing tab

**Name** (from the manifest): `Better Deezer`

**Summary** (from the manifest, 132 characters max): Unofficial skin for the Deezer web player: themes, synced lyrics, floating player, volume wheel and more.

**Category**: **Lifestyle › Entertainment** (it is a music player skin).

**Language**: French (add English as a second listing language).

**Description (fr)**

```text
🎧 Better Deezer redessine le lecteur web de Deezer et ajoute des dizaines de petites retouches. Extension non officielle, sans lien avec Deezer.

🎨 THÈMES
• 🌗 6 thèmes inclus, en clair, en sombre ou selon le système
• 🛍️ Une Marketplace de thèmes de la communauté
• ✏️ Un éditeur avec aperçu en direct et contrôle de lisibilité

🎤 EN ÉCOUTE
• 💿 Grande pochette et paroles synchronisées, mot à mot quand Deezer les a

🪟 MISE EN PAGE
• 🔍 Recherche centrée (Ctrl K), barre latérale et lecteur flottants
• 🖼️ En-têtes d'album et d'artiste teintés par la pochette
• 💬 Menus, notifications et fenêtres restylés

🎛️ CONFORT
• 🔊 Volume : un clic déplie un curseur, la molette règle (5 %, 1 % avec Maj)
• ⏩ Molette sur la pochette du lecteur pour avancer de 5 s
• 🏠 Accueil : sections à masquer, ordre au choix, liste « Ne plus me recommander »
• 😴 Minuteur de sommeil, mode compact, masquage des bannières promotionnelles

⚙️ Tout se règle dans les Réglages Better Deezer (Ctrl ,).

🔒 Vie privée : pas de compte, pas de statistiques, pas de serveur. Vos réglages restent dans votre navigateur.

💜 Code source (licence MIT) : https://github.com/Gabizoc/Better-Deezer
💻 Existe aussi pour l'application Windows de Deezer.

Deezer est une marque de Deezer SA. Better Deezer n'est ni affilié à Deezer, ni approuvé par Deezer.
```

**Description (en)**

```text
Better Deezer redesigns the Deezer web player and adds dozens of small improvements. Unofficial extension, not affiliated with Deezer.

THEMES
• 6 built-in themes, light, dark or following the system
• A Marketplace of community themes
• An editor with live preview and a readability check

NOW PLAYING
• Large cover and synced lyrics, word by word when Deezer has them

LAYOUT
• Centered search (Ctrl K), floating sidebar and player
• Album and artist headers tinted from the cover
• Restyled menus, notifications and dialogs

COMFORT
• Volume: one click opens a slider, the mouse wheel adjusts it (5%, 1% with Shift)
• Mouse wheel on the player's cover to skip 5 s
• Home: hide sections, choose their order, "Don't recommend" list
• Sleep timer, compact mode, hide promotional banners

Everything is in the Better Deezer settings (Ctrl ,).

Privacy: no account, no analytics, no server. Your settings stay in your browser.

Source code (MIT license): https://github.com/Gabizoc/Better-Deezer
Also available for the Deezer Windows app.

Deezer is a trademark of Deezer SA. Better Deezer is not affiliated with or endorsed by Deezer.
```

**Store icon**: `extension/icons/icon-128.png` (vector source: `store/icon.svg`).

**Screenshots** (1280×800, PNG without alpha): `store/screenshots/`, in this order. Taken on the real deezer.com, logged out, with the skin injected (GIMS as the example artist): Now playing view with synced lyrics, artist page, album *Ceinture noire*, album *Subliminal* in light mode, Better Deezer settings. Spares in `store/screenshots/extra/` (Now playing in light mode, a playlist).

**Small promo tile** (440×280): `store/promo-small-440x280.png`.

**Marquee promo tile** (1400×560): `store/promo-marquee-1400x560.png`.

**Homepage URL**: https://github.com/Gabizoc/Better-Deezer
**Support URL**: https://github.com/Gabizoc/Better-Deezer/issues

## Privacy practices tab

**Single purpose**

```text
Restyle and improve the Deezer web player (www.deezer.com): themes, layout, player controls and a lyrics view. It only runs on Deezer's web player.
```

**Permission justification**

The extension requests no API permission. Its only host access comes from its content scripts:

```text
Host access to https://www.deezer.com/*: the extension is a skin for the Deezer web player. Its content scripts add the stylesheet and the scripts that restyle the page and add controls (volume, lyrics view, settings). It runs on no other site.
```

**Remote code**: select **No, I am not using remote code**.

```text
All JavaScript is in the package. Themes downloaded from the Marketplace (raw.githubusercontent.com) or from a link are JSON data: colors, sizes, font names and CSS. They are validated before use; CSS that could load a resource or run code (url(), @import, expression(), javascript:) is rejected.
```

**Data usage**: check

- **Authentication information**: to show lyrics, the extension asks auth.deezer.com for a short-lived token from the user's existing Deezer session, exactly as Deezer's own Lyrics button does. The token is kept in memory for 4 minutes, sent only to Deezer, never stored or shared.
- **Website content**: the title, artist and duration of the current track are sent to lrclib.net to find lyrics when Deezer has none.

Leave every other type unchecked. Certify the three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL**: https://github.com/Gabizoc/Better-Deezer/blob/main/docs/privacy.md

## Distribution tab

Visibility: **Public**. Regions: all.
