# Privacy policy

*Better Deezer, browser extension, userscript and Windows app. Last updated: 2026-11-07. French version: [Confidentialité](confidentialite.md).*

Better Deezer is an unofficial, open-source skin for the Deezer web player. It has no server, no account, no analytics and no telemetry. The developer receives no data at all.

## Data stored on your device

Your settings, installed themes, the *Don't recommend* list and hidden home sections are stored in deezer.com's `localStorage` (keys starting with `bd:`). They never leave your browser or the Windows app. Uninstalling the extension and clearing deezer.com's site data removes them.

## Network requests

Better Deezer only makes the requests below, and only when you use the matching feature.

| When | To | What is sent |
| --- | --- | --- |
| You open the **Now playing** view (module on, lyrics source *Deezer*, the default) | `auth.deezer.com`, `pipe.deezer.com` (Deezer's own servers) | The same requests as Deezer's own Lyrics button. A short-lived token is obtained from your existing Deezer session (kept in memory for 4 minutes, never stored, never sent anywhere but Deezer), then the current track's ID is sent to get its lyrics. |
| Same, when Deezer has no lyrics for the track, or with the *LRCLIB only* source | `lrclib.net` | The current track's title, artist and duration, to find its lyrics. No cookies (`credentials: "omit"`). Results are kept for the session. |
| You open the **Themes** tab | `raw.githubusercontent.com` | A plain download of `themes/index.json` (the theme Marketplace list), once per session. |
| You install a theme **from a link** | the link you entered | A plain download of that file. |
| You run `better-deezer update` or `status` (Windows app only) | `api.github.com`, `github.com` | A request for the latest release and, for `update`, its files. Nothing about you. |

Cover colors (header tint, accent from the cover) are read from Deezer's image CDN, which the page already loads.

Turn off the *Now playing* module and never open the Marketplace, and Better Deezer makes no request at all.

## What Better Deezer does not do

- It does not collect, sell or share any personal data.
- It does not read your Deezer password, cookies or payment details, and never stores your session token.
- It does not track your browsing: it only runs on `https://www.deezer.com/*`.
- It does not load or run remote code. Themes are data (colors, sizes, font names and CSS); CSS that could load anything (`url()`, `@import`) or run code is rejected.

## Contact

Questions or concerns: open an issue at https://github.com/Gabizoc/Better-Deezer/issues. Security issues: see [SECURITY.md](../SECURITY.md).
