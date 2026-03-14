# Forkyeah

Forkyeah is a local-first recipe manager built for cooking flow, quick import, and low-friction browsing on phone.

### What The App Does
- Saves recipes locally for repeat use, offline access.
- Imports recipes from links, Search, PDF(not working currently), or manual entry.
- Parses supported recipe pages through python library recipe_scrappers.
- Lets you review imported content in a staging screen before saving.
- Supports multiple browse modes.
- Exports recipes through a print-friendly HTML.

### Browsing
- `List view` is the stable, information-dense browsing mode.
- `Grid view` gives a lighter visual scan with image, title, last cooked, and cuisine tags.
- `Stack view` is a full-content browse mode:
  - swipe horizontally to move between recipes
  - scroll ingredients and steps vertically
  - use the footer action to open the full recipe screen
  - wraps around when reaching the end of the recipe set
- Browse mode is remembered between app launches.
- Recipe order is reshuffled each time the app opens and reused across all browse modes for that session.

### Recipe View
- Focused recipe screen with title, description, timings, tags, ingredients, steps, notes, and nutrients.
- Ingredient and step completion tracking while cooking.
- Last-cooked tracking directly from the recipe view.
- In-recipe timer and quick access panels for ingredients, notes, and nutrients.
- Image updates for saved recipes.

### Search
- Integrated recipe search flow from the import menu.
- Search result click goes straight into import parsing and staging.

### Export
- Recipe export is driven by a dedicated HTML template.
- Browser print handles PDF generation.

### Local-First Behavior
- Recipes are stored in IndexedDB.
- Theme preference and browse mode preference are persisted locally.
- The app is packaged as a PWA for repeat-use.

### Frontend
- React
- TypeScript
- Vite
- Framer Motion
- Lucide icons

### State And Persistence
- Zustand for app and domain state
- Dexie over IndexedDB for local persistence
- Service worker / PWA support for installable offline-friendly behavior

### Backend And Parsing
- FastAPI
- Python
- `recipe_scrapers` as the first-pass parser
- JSON-LD, metadata, and heuristic fallback extraction for unsupported pages
- SearXNG-backed recipe search

### Media And Document Handling
- Client-side image compression for uploaded recipe images
- `pdfjs-dist` for PDF parsing
- HTML print-template export flow for browser PDF save/share

### Quality And Validation
- Vitest
- React Testing Library
- TypeScript typechecking