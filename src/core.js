/*
 * Snake game logic — no DOM, no canvas, no globals beyond this module.
 * Loads in the browser (window.SnakeCore) or in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  /*
   * Pace presets. `baseTickMs` is the delay between moves at the start,
   * `minTickMs` the floor the ramp can reach, `accelMs` how much each food
   * shaves off the delay.
   */
  const SPEEDS = {
    chill: { label: 'Chill', baseTickMs: 240, minTickMs: 140, accelMs: 3 },
    normal: { label: 'Normal', baseTickMs: 190, minTickMs: 100, accelMs: 3 },
    brisk: { label: 'Brisk', baseTickMs: 130, minTickMs: 65, accelMs: 4 },
  };

  const DEFAULT_SPEED = 'normal';

  class SnakeGame {
    constructor(options = {}) {
      this.cols = options.cols ?? 24;
      this.rows = options.rows ?? 24;
      this.rng = options.rng ?? Math.random;
      this.initialLength = Math.max(2, options.initialLength ?? 3);
      this.pointsPerFood = options.pointsPerFood ?? 10;

      const requested = SPEEDS[options.speed] ? options.speed : DEFAULT_SPEED;
      const preset = SPEEDS[requested];
      this.speed = requested;
      this.baseTickMs = options.baseTickMs ?? preset.baseTickMs;
      this.minTickMs = options.minTickMs ?? preset.minTickMs;
      this.accelMs = options.accelMs ?? preset.accelMs;
      this.reset();
    }

    /* Switch pace mid-game; the next tick uses the new delay. */
    setSpeed(name) {
      if (!SPEEDS[name]) return false;
      const preset = SPEEDS[name];
      this.speed = name;
      this.baseTickMs = preset.baseTickMs;
      this.minTickMs = preset.minTickMs;
      this.accelMs = preset.accelMs;
      return true;
    }

    reset() {
      const cx = Math.floor(this.cols / 2);
      const cy = Math.floor(this.rows / 2);

      this.body = [];
      for (let i = 0; i < this.initialLength; i++) {
        this.body.push({ x: cx - i, y: cy });
      }

      this.direction = 'right';
      this.queue = [];
      this.score = 0;
      this.foodsEaten = 0;
      this.state = 'ready'; // ready | running | paused | over | won
      this.food = null;
      this.placeFood();
      return this;
    }

    get head() {
      return this.body[0];
    }

    get tickMs() {
      return Math.max(this.minTickMs, this.baseTickMs - this.foodsEaten * this.accelMs);
    }

    get isOver() {
      return this.state === 'over' || this.state === 'won';
    }

    start() {
      if (this.state === 'ready') this.state = 'running';
      return this.state === 'running';
    }

    pause() {
      if (this.state === 'running') this.state = 'paused';
    }

    resume() {
      if (this.state === 'paused') this.state = 'running';
    }

    togglePause() {
      if (this.state === 'running') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    /*
     * Queue a turn. Rejected when it would reverse into the neck, repeat the
     * pending direction, or exceed the 2-slot buffer that lets players enter
     * two fast turns (e.g. up then right) before the next tick lands.
     */
    setDirection(dir) {
      if (!DIRECTIONS[dir]) return false;
      const reference = this.queue.length
        ? this.queue[this.queue.length - 1]
        : this.direction;
      if (dir === reference || dir === OPPOSITE[reference]) return false;
      if (this.queue.length >= 2) return false;
      this.queue.push(dir);
      return true;
    }

    freeCells() {
      const occupied = new Set(this.body.map((p) => p.x + ',' + p.y));
      const free = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!occupied.has(x + ',' + y)) free.push({ x, y });
        }
      }
      return free;
    }

    placeFood() {
      const free = this.freeCells();
      if (free.length === 0) {
        this.food = null;
        this.state = 'won';
        return null;
      }
      const index = Math.min(free.length - 1, Math.floor(this.rng() * free.length));
      this.food = free[index];
      return this.food;
    }

    /*
     * Advance one tick. Returns what happened so the renderer can react
     * (shake on death, pop on eat) without polling state.
     */
    step() {
      if (this.state !== 'running') {
        return { moved: false, ate: false, dead: false, won: false };
      }

      if (this.queue.length) this.direction = this.queue.shift();

      const delta = DIRECTIONS[this.direction];
      const head = { x: this.head.x + delta.x, y: this.head.y + delta.y };

      const outside =
        head.x < 0 || head.y < 0 || head.x >= this.cols || head.y >= this.rows;
      if (outside) {
        this.state = 'over';
        return { moved: true, ate: false, dead: true, won: false };
      }

      const ate = !!this.food && head.x === this.food.x && head.y === this.food.y;

      // The tail vacates its cell on a non-growing tick, so it is not a hit.
      const checked = ate ? this.body.length : this.body.length - 1;
      for (let i = 0; i < checked; i++) {
        if (this.body[i].x === head.x && this.body[i].y === head.y) {
          this.state = 'over';
          return { moved: true, ate: false, dead: true, won: false };
        }
      }

      this.body.unshift(head);
      if (!ate) {
        this.body.pop();
        return { moved: true, ate: false, dead: false, won: false };
      }

      this.score += this.pointsPerFood;
      this.foodsEaten++;
      const won = this.placeFood() === null;
      return { moved: true, ate: true, dead: false, won };
    }
  }

  return { DIRECTIONS, OPPOSITE, SPEEDS, DEFAULT_SPEED, SnakeGame };
});
