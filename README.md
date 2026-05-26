# [JB] Security

Penetration Testing · OT/ICS Security · Bug Bounty Research

Marketing site for **[JB] Security** — Inh. Josef Roland Basner.

Live: <https://jb-security.de/>

## Stack

- Static HTML / CSS / vanilla JS — no build, deploys straight to GitHub Pages
- Three.js r149 (self-hosted in `assets/three.min.js`, no CDN — no third-country IP transfer)
- Bunny Fonts for typography (GDPR-friendly, no IP logging)
- Contact via prefilled `mailto:` links — no form backend, no third party
- DE / EN toggle via `data-i18n` attributes

## Local dev

```
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Structure

- `index.html` — page markup
- `styles.css` — dark hacker / cyberpunk theme
- `main.js` — Three.js scene, tilt cards, glitch text, i18n
- `impressum.html` / `datenschutz.html` — legal pages (§ 5 DDG, Art. 13 GDPR)
- `assets/three.min.js` — Three.js r149 (self-hosted)
- `assets/sample-finding.pdf` — anonymized work sample

## Deployment

Pushed to `main` → GitHub Pages serves from root.

Activate once under **Settings → Pages → Source: Deploy from a branch → main / (root)**.
