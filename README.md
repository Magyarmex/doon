# Doon (Web Doom Prototype)

This project is an open, browser-friendly foundation inspired by the original Doom. It focuses on modular architecture, transparent debug metrics, and robust error handling to enable future expansion.

## Getting started

No external dependencies are required. Use the built-in dev server and Node's test runner:

```bash
npm run dev   # start a static dev server at http://localhost:4173 (binds to 0.0.0.0 for tooling)
npm test      # run the node-based test suite
```

Opening the repository root in a browser (or on GitHub Pages) now forwards straight into the live game view via `/public/`,
ensuring you bypass the documentation wall and land directly in the playfield.

> Audio assets now live at the repository root next to `README.md` (for example `/90s-chopped-2-435023.mp3` and
> `/shot-and-reload-6158.mp3`). The dev server automatically exposes root-level `.mp3` files; production hosts must serve these
> files from the site root so soundtrack and rifle effects can load.

## Architecture

- `src/engine` – Core systems (game loop, renderer, input, level loader, debug metrics).
- `src/entities` – Basic entities to demonstrate movement and updates.
- `src/data` – Level definitions with tile-based layouts.
- `public` – Static assets including `index.html` and styling.
- `scripts/dev-server.js` – Minimal static server for local development.

The `DebugMetrics` utility tracks logs, errors, and feature flags to aid future debugging and live diagnostics.

## Prototype controls & debugging

- The experience boots straight into the running game; the canvas auto-requests pointer lock when you hover or click for smooth yaw/pitch.
- Toggle the debug HUD/logs with the **Debug HUD** button or **F3** to keep the play view clear while still exposing metrics when needed.
- Move with **WASD**, turn with the mouse or arrow keys, and fire with **Space**.
- Reload the bolt-action rifle with **R** (12-round magazine, 1.5s between shots, 4s reload).
- HUD metrics expose FPS, entities, orientation, ammo, rifle state, and error counts; logs surface flagged issues.
