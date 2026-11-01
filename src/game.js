/*
 * Rendering, input, and the game loop. Logic lives in core.js.
 */
(function () {
  'use strict';

  const { SnakeGame, DIRECTIONS } = window.SnakeCore;

  const COLS = 24;
  const ROWS = 24;
  const BEST_KEY = 'snake.best';

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  const game = new SnakeGame({ cols: COLS, rows: ROWS });
  const view = { size: 576 };
  let best = readBest();
  let eatFlash = 0;
  let shake = 0;

  function readBest() {
    try {
      return Number(window.localStorage.getItem(BEST_KEY)) || 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch (error) {
      /* private mode / storage disabled — best score just won't persist */
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(rect.width) || 576;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.size = size;
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawGrid(cell) {
    const size = view.size;
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 178, 214, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < COLS; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawFood(cell, now) {
    if (!game.food) return;
    const pulse = 1 + Math.sin(now / 220) * 0.08;
    const cx = (game.food.x + 0.5) * cell;
    const cy = (game.food.y + 0.5) * cell;
    const r = cell * 0.32 * pulse;

    ctx.save();
    ctx.shadowColor = 'rgba(248, 113, 113, 0.65)';
    ctx.shadowBlur = cell * 0.6;
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake(cell) {
    const body = game.body;
    const pad = Math.max(1, cell * 0.08);

    for (let i = body.length - 1; i >= 0; i--) {
      const segment = body[i];
      const t = body.length > 1 ? i / (body.length - 1) : 0;
      const green = Math.round(222 - t * 90);
      const blue = Math.round(128 - t * 60);
      ctx.fillStyle = i === 0 ? '#86efac' : 'rgb(74, ' + green + ', ' + blue + ')';
      roundRect(
        segment.x * cell + pad,
        segment.y * cell + pad,
        cell - pad * 2,
        cell - pad * 2,
        cell * 0.28
      );
      ctx.fill();
    }

    // Eyes, oriented along the current heading.
    const head = game.head;
    const dir = DIRECTIONS[game.direction];
    const cx = (head.x + 0.5) * cell;
    const cy = (head.y + 0.5) * cell;
    const forward = cell * 0.18;
    const spread = cell * 0.16;
    const offsetX = dir.x * forward + (dir.y !== 0 ? spread : 0);
    const offsetY = dir.y * forward + (dir.x !== 0 ? spread : 0);

    ctx.fillStyle = '#0b1a12';
    ctx.beginPath();
    if (dir.x !== 0) {
      ctx.arc(cx + offsetX, cy - offsetY, cell * 0.075, 0, Math.PI * 2);
      ctx.arc(cx + offsetX, cy + offsetY, cell * 0.075, 0, Math.PI * 2);
    } else {
      ctx.arc(cx - offsetY, cy + offsetY, cell * 0.075, 0, Math.PI * 2);
      ctx.arc(cx + offsetY, cy + offsetY, cell * 0.075, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function draw(now) {
    const size = view.size;
    const cell = size / COLS;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawGrid(cell);
    drawFood(cell, now);
    drawSnake(cell);

    if (eatFlash > 0) {
      ctx.fillStyle = 'rgba(134, 239, 172, ' + (eatFlash / 260) * 0.06 + ')';
      ctx.fillRect(0, 0, size, size);
    }

    ctx.restore();
  }

  function syncHud() {
    scoreEl.textContent = String(game.score);
    bestEl.textContent = String(best);
    speedEl.textContent = String(game.foodsEaten + 1);
  }

  function syncOverlay() {
    overlay.dataset.state = game.state;

    if (game.state === 'ready') {
      overlayTitle.textContent = 'Ready?';
      overlayText.textContent = 'Arrows / WASD to steer · Space to start';
    } else if (game.state === 'paused') {
      overlayTitle.textContent = 'Paused';
      overlayText.textContent = 'Space or P to resume';
    } else if (game.state === 'over') {
      overlayTitle.textContent = 'Game over';
      overlayText.textContent =
        'Score ' + game.score + (game.score >= best && game.score > 0 ? ' · new best!' : ' · best ' + best) +
        ' · Space to play again';
    } else if (game.state === 'won') {
      overlayTitle.textContent = 'Board filled!';
      overlayText.textContent = 'Score ' + game.score + ' · Space to play again';
    }

    const over = game.isOver;
    startBtn.textContent = over ? 'Play again' : game.state === 'running' ? 'Restart' : 'Start';
    pauseBtn.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
    pauseBtn.disabled = !(game.state === 'running' || game.state === 'paused');
  }

  function startGame() {
    game.start();
    syncOverlay();
  }

  function restartGame() {
    game.reset();
    eatFlash = 0;
    shake = 0;
    startGame();
    syncHud();
  }

  function primaryAction() {
    if (game.isOver) restartGame();
    else if (game.state === 'running') game.pause();
    else startGame();
    syncOverlay();
  }

  function handleDeath(event) {
    shake = 14;
    if (game.score > best) {
      best = game.score;
      saveBest(best);
    }
    syncHud();
    syncOverlay();
    if (event && event.won) {
      overlay.dataset.state = 'won';
      syncOverlay();
    }
  }

  // ---- input ---------------------------------------------------------------

  const KEY_DIRECTIONS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
    W: 'up',
    A: 'left',
    S: 'down',
    D: 'right',
  };

  window.addEventListener('keydown', function (event) {
    const dir = KEY_DIRECTIONS[event.key];

    if (dir) {
      event.preventDefault();
      if (game.isOver) return;
      if (game.state === 'ready') startGame();
      if (game.state === 'paused') game.resume();
      game.setDirection(dir);
      syncOverlay();
      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      primaryAction();
      return;
    }

    if (event.key === 'p' || event.key === 'P') {
      game.togglePause();
      syncOverlay();
      return;
    }

    if ((event.key === 'r' || event.key === 'R') && game.isOver) {
      restartGame();
    }
  });

  let pointerStart = null;

  canvas.addEventListener('pointerdown', function (event) {
    pointerStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointerup', function (event) {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;

    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
      primaryAction();
      return;
    }

    if (game.state === 'ready') startGame();
    if (game.isOver) return;

    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    game.setDirection(dir);
    syncOverlay();
  });

  startBtn.addEventListener('click', function () {
    if (game.isOver) restartGame();
    else primaryAction();
    startBtn.blur();
  });

  pauseBtn.addEventListener('click', function () {
    game.togglePause();
    syncOverlay();
    pauseBtn.blur();
  });

  window.addEventListener('resize', resize);

  // ---- loop ----------------------------------------------------------------

  let previous = 0;
  let accumulator = 0;

  function frame(now) {
    if (!previous) previous = now;
    const delta = Math.min(now - previous, 250); // clamp after tab switches
    previous = now;

    if (game.state === 'running') {
      accumulator += delta;
      let guard = 0;
      while (accumulator >= game.tickMs && guard++ < 8) {
        accumulator -= game.tickMs;
        const result = game.step();
        if (result.ate) {
          eatFlash = 260;
          syncHud();
        }
        if (result.dead || result.won) {
          handleDeath(result);
          break;
        }
      }
    } else {
      accumulator = 0;
    }

    eatFlash = Math.max(0, eatFlash - delta);
    shake = Math.max(0, shake - delta * 0.06);

    draw(now);
    window.requestAnimationFrame(frame);
  }

  resize();
  syncHud();
  syncOverlay();
  window.requestAnimationFrame(frame);

  /*
   * Handle for smoke tests and console poking: lets a headless browser step the
   * simulation deterministically instead of waiting on real timers. Not used by
   * the game itself.
   */
  window.__snake = {
    game,
    restart: restartGame,
    primaryAction,
    syncHud,
    syncOverlay,
    handleDeath,
    tick: function (times) {
      let last = null;
      for (let i = 0; i < (times || 1); i++) {
        last = game.step();
        if (last.ate) eatFlash = 260;
        if (last.dead || last.won) {
          handleDeath(last);
          break;
        }
      }
      syncHud();
      syncOverlay();
      return last;
    },
  };
})();
