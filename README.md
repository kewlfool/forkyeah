# Forkyeah

Minimalist recipe manager PWA designed to stay open while you cook.

## Features
- Import recipes from URL, PDF, or manual creation.
- Review parsed content in a staging screen before saving.
- Browse recipes in stacked card, scroll, or list views.
- Swipe through cards and open recipes with a tap.
- Keep recipes and thumbnails stored locally for offline access.
- Cooking-friendly UI with cook mode entry point and quick navigation.

## GitHub Pages deploy notes
- Build Pages artifacts with `npm run build:pages`.
- Commit and push the updated `docs/` output to the branch configured in GitHub Pages.
- If an old JS bundle keeps loading on mobile, clear site data/service worker in Chrome and reload.
