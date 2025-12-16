# Doon (Web Doom Prototype)

This project is an open, browser-friendly foundation inspired by the original Doom. It focuses on modular architecture, transparent debug metrics, and robust error handling to enable future expansion.

## Getting started

No external dependencies are required. Use the built-in dev server and Node's test runner:

```bash
npm run dev   # start a static dev server at http://localhost:4173
npm test      # run the node-based test suite
```

## Architecture

- `src/engine` – Core systems (game loop, renderer, input, level loader, debug metrics).
- `src/entities` – Basic entities to demonstrate movement and updates.
- `src/data` – Level definitions with tile-based layouts.
- `public` – Static assets including `index.html` and styling.
- `scripts/dev-server.js` – Minimal static server for local development.

The `DebugMetrics` utility tracks logs, errors, and feature flags to aid future debugging and live diagnostics.

## Prototype controls & debugging

- Click the canvas to capture the pointer for smooth mouse-driven yaw/pitch.
- Move with **WASD**, turn with the mouse or arrow keys, and fire with **Space**.
- Reload the bolt-action rifle with **R** (12-round magazine, 1.5s between shots, 4s reload).
- HUD metrics expose FPS, entities, orientation, ammo, rifle state, and error counts; logs surface flagged issues.
