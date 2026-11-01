# Snake

Classic snake, playable in the browser. No build step, no dependencies, no
network calls — four source files and a stylesheet.

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
| Pace selector | Chill · Normal (default) · Brisk — remembered across reloads |
| Wrap walls | Edges become portals instead of killing you |
| Obstacles | Scatter 3% of the board with solid blocks (restarts the board) |
| Sound on/off | Mute toggle, also remembered |

## Pace

| Preset | Start | Fastest | Ramp |
| --- | --- | --- | --- |
| Chill | 240 ms per move | 140 ms | −3 ms per food |
| Normal | 190 ms per move | 100 ms | −3 ms per food |
| Brisk | 130 ms per move | 65 ms | −4 ms per food |

Normal is the default; the original 130/65 timing now lives in Brisk. The choice
is stored in `localStorage` under `snake.pace` and can be changed mid-game.

## Rules

- Walls are solid — unless **Wrap walls** is on, in which case leaving an edge
  brings you out the opposite side.
- **Obstacles** are solid blocks, generated in mirrored pairs at ~3% density,
  never on the snake and never in the spawn corridor. Hitting one ends the run.
  Toggling them rebuilds the board and returns to the start screen.
- Food is worth 10 points and one segment of growth.
- The pace ramps up as you eat: −3 ms per food on Chill and Normal, −4 ms on
  Brisk, down to that preset's floor.
- Best score persists in `localStorage` under `snake.best`.
- Filling the entire board (obstacles included) wins the game.

## Layout

```
index.html          markup + HUD + overlay
styles.css          dark theme, responsive square board
src/core.js         game rules only — no DOM (UMD: browser global or require)
src/audio.js        WebAudio blips synthesized at runtime, no audio files
src/game.js         canvas rendering, input handling, rAF loop
tests/core.test.cjs node:test suite for the rules
```

The split matters: `core.js` is pure state and can be driven from Node, and
`game.js` never decides a rule — it only reacts to what `step()` returns
(`{ moved, ate, dead, won }`).

Turns are buffered two deep, so a fast "up then right" both register before the
next tick, and reversing into the neck is rejected rather than instant death.

## Sound

`src/audio.js` synthesizes everything with `OscillatorNode` + `GainNode` — no
sound files, nothing to download, ~90 lines. Events: eat (rising triangle),
level-up every 5 foods, death (falling saw), win (four-note arpeggio).

The `AudioContext` is created lazily on the first real key/pointer event, because
browsers block audio before a user gesture. Muting suspends nothing — it just
skips creating the context, and the choice persists under `snake.muted`.

## Tests

```powershell
npm test           # node --test tests/core.test.cjs
```

27 tests: movement, turn buffering, growth, wall and self collisions,
tail-following (not a collision), the speed ramp, preset ordering and runtime
switching, wall wrap (both axes, toggling mid-run), obstacle collision,
generated-obstacle placement (in bounds, off the snake, spawn corridor clear),
obstacle/food exclusion, board-full win, reset, plus 100 seeded random games
with solid walls and 200 more with wrap + obstacles enabled, asserting the body
never self-intersects and food never spawns under the snake or in a block.

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

- Maze mode: generated corridors instead of scattered blocks
- Levels that add obstacles as the score climbs
- Run history and a score table in SQLite
- Gamepad support
