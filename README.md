# [JB] Security

Penetration Testing · OT/ICS Security · Bug Bounty Research

Marketing site for **[JB] Security** — Inh. Josef Roland Basner.

Live: <https://jbmtp07.github.io/jb-security/>

## Stack

- Static HTML / CSS / vanilla JS — no build, deploys straight to GitHub Pages
- Three.js (r149) for the animated 3D background
- [Formsubmit](https://formsubmit.co) for the contact form (no signup, no backend)
- DE / EN toggle via `data-i18n` attributes

## Local dev

```
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Structure

- `index.html` — page markup
- `styles.css` — dark hacker / cyberpunk theme
- `main.js` — Three.js scene, tilt cards, glitch text, i18n, form handling
- `assets/sample-finding.pdf` — anonymized work sample

## Deployment

Pushed to `main` → GitHub Pages serves from root.

Activate once under **Settings → Pages → Source: Deploy from a branch → main / (root)**.
