# Arcade Soccer

A 3D arcade football game built with Three.js + Vite, deployable to GitHub Pages.

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Build for GitHub Pages

```bash
npm run build
```

The output goes to `dist/`. Deploy the contents of `dist/` to GitHub Pages (use the `dist` folder as the Pages source, or push it to the `gh-pages` branch).

## Preview the build locally

```bash
npm run preview
```

## Stadium GLB

Place your stadium model at:

```
public/assets/stadium/stadium.glb
```

The game tries these paths in order:
- `./assets/stadium/stadium.glb`
- `./assets/stadium/arena.glb`
- `./assets/stadium/pitch.glb`
- `./assets/stadium/soccer.glb`
- `./assets/stadium/football.glb`

If none are found, a procedural fallback stadium is used automatically.

## Controls

| Action       | Keyboard         | Mobile            |
|--------------|------------------|-------------------|
| Move         | WASD / Arrows    | Left joystick     |
| Sprint       | Shift            | RUN button        |
| Shoot        | Space            | SHOOT button      |
| Reset ball   | R                | –                 |
| Pause        | Esc              | –                 |

## Things to tweak

| What                  | Where                         | Variable / property              |
|-----------------------|-------------------------------|----------------------------------|
| Stadium GLB scale     | `src/game/Stadium.js`         | `this.glbScale`                  |
| Stadium GLB position  | `src/game/Stadium.js`         | `this.glbPosition`               |
| Camera height         | `src/game/CameraController.js`| `BASE_HEIGHT`                    |
| Camera distance       | `src/game/CameraController.js`| `BASE_DIST` / `SPRINT_DIST`      |
| Player speed          | `src/game/Player.js`          | `SPEED` / `SPRINT_MULT`          |
| Shot power            | `src/game/Ball.js`            | `SHOOT_NORMAL` / `SHOOT_SPRINT`  |
| Match duration        | `src/game/Game.js`            | `MATCH_DURATION` (seconds)       |
| Ball friction         | `src/game/Ball.js`            | `FRICTION`                       |

## Audio

Place audio files (MP3) in `public/assets/audio/`:
- `kick.mp3`
- `goal.mp3`
- `whistle.mp3`
- `crowd.mp3`

Missing audio files are silently ignored — the game still runs.
