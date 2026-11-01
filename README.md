# Snake

Classic snake, playable in the browser. No build step, no dependencies, no
network calls — three source files and a stylesheet.

## Play

Open `index.html` directly (double-click) or serve it:

```powershell
npm start          # python -m http.server 8000 → http://localhost:8000
```

`file://` works because everything is a classic script, not an ES module.

## Controls

| Input | Action |
| --- | --- |
| Arrows / `WASD` | Steer (also starts the game) |
| `Space` | Start · pause · resume · play again |
| `P` | Toggle pause |
| `R` | Restart after game over |
| Click the board | Start / pause / resume |
| Swipe | Steer on touch devices |

## Rules

- Walls are solid. Hitting one, or your own body, ends the run.
- Food is worth 10 points and one segment of growth.
- The tick speeds up 4 ms per food: 130 ms at the start, capped at 65 ms.
- Best score persists in `localStorage` under `snake.best`.
- Filling the entire 24×24 board wins the game.

## Layout

```
index.html          markup + HUD + overlay
styles.css          dark theme, responsive square board
src/core.js         game rules only — no DOM (UMD: browser global or require)
src/game.js         canvas rendering, input handling, rAF loop
tests/core.test.cjs node:test suite for the rules
```

The split matters: `core.js` is pure state and can be driven from Node, and
`game.js` never decides a rule — it only reacts to what `step()` returns
(`{ moved, ate, dead, won }`).

Turns are buffered two deep, so a fast "up then right" both register before the
next tick, and reversing into the neck is rejected rather than instant death.

## Tests

```powershell
npm test           # node --test tests/core.test.cjs
```

14 tests cover movement, turn buffering, growth, wall and self collisions,
tail-following (not a collision), speed ramp, board-full win, reset, plus 100
seeded random games asserting the body never self-intersects and food never
spawns under the snake.

## Debugging

`window.__snake` exposes `{ game, tick(n), restart, primaryAction, syncHud,
syncOverlay }` so a headless browser or the console can advance the simulation
without waiting on timers:

```js
__snake.game.start();
__snake.game.food = { x: __snake.game.head.x + 4, y: __snake.game.head.y };
__snake.tick(4);   // eat it, grow, score
```

## Ideas

- Wall-wrap mode and obstacles
- Obstacles / levels
- Sound on eat and death
- Run history and a score table in SQLite
