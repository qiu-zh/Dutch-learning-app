# DutchDeck Studio for iPhone

This is a static, installable Progressive Web App. It does not require Node.js or an API key.

## Important

An iPhone PWA must be opened from an HTTPS website. Safari cannot install the app directly from a ZIP file, and a Windows localhost address belongs to the Windows computer—not the iPhone.

## Easiest publishing method

1. Extract this ZIP.
2. Upload the contents of the `dutchdeck-studio` folder to any static HTTPS host, such as GitHub Pages, Cloudflare Pages, Netlify, or your own web server.
3. Open the resulting HTTPS address in Safari on the iPhone.
4. Tap Share → Add to Home Screen → Add.

The entire 233-entry deck is built in. Reviews, edits, favorites, and settings are stored locally on the iPhone. Use Settings → Export backup to move your existing Windows progress to the phone, then Settings → Restore backup on the iPhone.

## Local testing

The included Windows launcher remains useful for desktop testing, but iPhone installation and offline support require HTTPS.
