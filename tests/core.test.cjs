'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SnakeGame, SPEEDS } = require('../src/core.js');

/** Build a game with a hand-placed snake so collision cases are explicit. */
function withSnake(body, direction, overrides = {}) {
  const game = new SnakeGame({ cols: 10, rows: 10, ...overrides });
  game.body = body.map(([x, y]) => ({ x, y }));
  game.direction = direction;
  game.state = 'running';
  game.queue = [];
  game.food = { x: 0, y: 0 };
  return game;
}

test('starts centred, length 3, heading right', () => {
  const game = new SnakeGame({ cols: 24, rows: 24 });
  assert.equal(game.body.length, 3);
  assert.equal(game.direction, 'right');
  assert.equal(game.state, 'ready');
  assert.deepEqual(game.head, { x: 12, y: 12 });
  assert.equal(game.score, 0);
});

test('step is a no-op until started', () => {
  const game = new SnakeGame();
  const before = JSON.stringify(game.body);
  assert.deepEqual(game.step(), { moved: false, ate: false, dead: false, won: false });
  assert.equal(JSON.stringify(game.body), before);
  assert.equal(game.start(), true);
  assert.equal(game.state, 'running');
});

test('a tick moves the head one cell and keeps the length', () => {
  const game = new SnakeGame();
  game.start();
  game.step();
  assert.deepEqual(game.head, { x: 13, y: 12 });
  assert.equal(game.body.length, 3);
});

test('opposite turns are rejected, perpendicular ones queue', () => {
  const game = new SnakeGame();
  assert.equal(game.setDirection('left'), false, 'reversing into the neck');
  assert.equal(game.setDirection('up'), true);
  assert.equal(game.setDirection('down'), false, 'reverse of the pending turn');
  assert.equal(game.setDirection('left'), true, 'second buffered turn');
  assert.equal(game.setDirection('right'), false, 'buffer full');
  assert.deepEqual(game.queue, ['up', 'left']);
});

test('buffered turns are applied one per tick', () => {
  const game = new SnakeGame();
  game.start();
  game.setDirection('up');
  game.setDirection('right');
  game.step();
  assert.equal(game.direction, 'up');
  game.step();
  assert.equal(game.direction, 'right');
});

test('eating grows the snake, scores, and respawns food off the body', () => {
  const game = withSnake([[5, 5], [4, 5], [3, 5]], 'right', { rng: () => 0 });
  game.food = { x: 6, y: 5 };

  const result = game.step();

  assert.deepEqual(result, { moved: true, ate: true, dead: false, won: false });
  assert.equal(game.body.length, 4, 'grew by one');
  assert.equal(game.score, 10);
  assert.equal(game.foodsEaten, 1);
  assert.ok(game.food, 'a new food cell exists');
  const occupied = new Set(game.body.map((p) => `${p.x},${p.y}`));
  assert.ok(!occupied.has(`${game.food.x},${game.food.y}`), 'food not inside the snake');
});

test('food placement is deterministic for a seeded rng', () => {
  const game = new SnakeGame({ cols: 8, rows: 8, rng: () => 0 });
  assert.deepEqual(game.food, { x: 0, y: 0 });
});

test('running into a wall ends the game', () => {
  const game = withSnake([[9, 0], [8, 0], [7, 0]], 'right');
  const result = game.step();
  assert.equal(result.dead, true);
  assert.equal(game.state, 'over');
  assert.equal(game.isOver, true);
});

test('running into your own body ends the game', () => {
  const game = withSnake([[4, 4], [3, 4], [3, 5], [4, 5], [5, 5]], 'down');
  const result = game.step();
  assert.equal(result.dead, true);
  assert.equal(game.state, 'over');
});

test('following the tail is not a collision', () => {
  const game = withSnake([[4, 4], [4, 3], [3, 3], [3, 4]], 'left');
  const result = game.step();
  assert.equal(result.dead, false);
  assert.deepEqual(game.head, { x: 3, y: 4 });
  assert.equal(game.body.length, 4);
});

test('speed ramps up with food and clamps at the floor', () => {
  const game = new SnakeGame();
  const base = game.tickMs;
  game.foodsEaten = 5;
  assert.ok(game.tickMs < base);
  assert.ok(game.tickMs >= game.minTickMs);
  game.foodsEaten = 500;
  assert.equal(game.tickMs, game.minTickMs);
});

test('pace presets are ordered and slower than the old default', () => {
  assert.ok(SPEEDS.chill.baseTickMs > SPEEDS.normal.baseTickMs);
  assert.ok(SPEEDS.normal.baseTickMs > SPEEDS.brisk.baseTickMs);
  assert.ok(SPEEDS.chill.minTickMs > SPEEDS.brisk.minTickMs);
  // The original 130 ms start / 65 ms floor felt too fast; normal is calmer.
  assert.ok(SPEEDS.normal.baseTickMs >= 180);
  assert.ok(SPEEDS.normal.minTickMs >= 100);
});

test('speed can be switched at runtime, unknown names rejected', () => {
  const game = new SnakeGame({ speed: 'brisk' });
  assert.equal(game.speed, 'brisk');
  assert.equal(game.tickMs, SPEEDS.brisk.baseTickMs);

  assert.equal(game.setSpeed('chill'), true);
  assert.equal(game.speed, 'chill');
  assert.equal(game.tickMs, SPEEDS.chill.baseTickMs);
  assert.equal(game.minTickMs, SPEEDS.chill.minTickMs);

  assert.equal(game.setSpeed('ludicrous'), false);
  assert.equal(game.speed, 'chill');
});

test('an unknown speed option falls back to the default', () => {
  const game = new SnakeGame({ speed: 'nope' });
  assert.equal(game.speed, 'normal');
});

test('a full board is reported as won, not over', () => {
  const game = withSnake([[0, 0], [1, 0], [1, 1], [0, 1]], 'right', { cols: 2, rows: 2 });
  game.body = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ];
  game.food = null;
  assert.equal(game.placeFood(), null);
  assert.equal(game.state, 'won');
  assert.equal(game.isOver, true);
});

test('reset restores a fresh game', () => {
  const game = withSnake([[1, 1]], 'up');
  game.score = 120;
  game.reset();
  assert.equal(game.score, 0);
  assert.equal(game.body.length, game.initialLength);
  assert.equal(game.state, 'ready');
  assert.equal(game.direction, 'right');
  assert.equal(game.queue.length, 0);
});

test('100 random games never self-intersect while alive', () => {
  let seed = 42;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const turns = ['up', 'down', 'left', 'right'];

  for (let run = 0; run < 100; run++) {
    const game = new SnakeGame({ cols: 12, rows: 12, rng });
    game.start();
    for (let i = 0; i < 300 && !game.isOver; i++) {
      if (rng() < 0.3) game.setDirection(turns[Math.floor(rng() * 4)]);
      game.step();
      const cells = new Set(game.body.map((p) => `${p.x},${p.y}`));
      assert.equal(cells.size, game.body.length, 'body overlaps itself');
      if (game.food) {
        assert.ok(!cells.has(`${game.food.x},${game.food.y}`), 'food under the snake');
      }
    }
  }
});

// ---- wall wrap ------------------------------------------------------------

test('wrap: leaving the right edge arrives on the left', () => {
  const game = withSnake([[9, 0], [8, 0], [7, 0]], 'right', { wrap: true });
  game.food = { x: 5, y: 5 };
  const result = game.step();
  assert.equal(result.dead, false);
  assert.deepEqual(game.head, { x: 0, y: 0 });
});

test('wrap: leaving the top edge arrives at the bottom', () => {
  const game = withSnake([[0, 0], [1, 0], [2, 0]], 'up', { wrap: true });
  game.food = { x: 5, y: 5 };
  const result = game.step();
  assert.equal(result.dead, false);
  assert.deepEqual(game.head, { x: 0, y: 9 });
});

test('wrap: obstacles still apply, self collision still kills', () => {
  const blocked = withSnake([[9, 4], [8, 4], [7, 4]], 'right', {
    wrap: true,
    obstacles: [{ x: 0, y: 4 }],
  });
  blocked.food = { x: 5, y: 5 };
  assert.equal(blocked.step().dead, true, 'portal exit was blocked');

  const coiled = withSnake([[4, 4], [3, 4], [3, 5], [4, 5], [5, 5]], 'down', { wrap: true });
  coiled.food = { x: 5, y: 5 };
  assert.equal(coiled.step().dead, true, 'ran into its own body');
});

test('wrap can be toggled without resetting the run', () => {
  const game = withSnake([[9, 5], [8, 5], [7, 5]], 'right');
  game.food = { x: 5, y: 5 };
  assert.equal(game.wrap, false);
  game.setWrap(true);
  assert.equal(game.step().dead, false);
  assert.deepEqual(game.head, { x: 0, y: 5 });
});

// ---- obstacles ------------------------------------------------------------

test('running into an obstacle ends the game', () => {
  const game = withSnake([[5, 5], [4, 5], [3, 5]], 'right', {
    obstacles: [{ x: 6, y: 5 }],
  });
  const result = game.step();
  assert.equal(result.dead, true);
  assert.equal(game.state, 'over');
});

test('explicit obstacles are kept as given, across resets', () => {
  const blocks = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
  const game = new SnakeGame({ obstacles: blocks });
  assert.deepEqual(game.obstacles, blocks);
  assert.notEqual(game.obstacles, blocks, 'copied, not aliased');
  game.reset();
  assert.deepEqual(game.obstacles, blocks);
});

test('generated obstacles stay in bounds, off the snake and off the spawn corridor', () => {
  let seed = 7;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const game = new SnakeGame({ cols: 24, rows: 24, obstacles: true, rng });
  const target = Math.round(24 * 24 * game.density);

  assert.ok(game.obstacles.length >= 4, 'some obstacles generated');
  assert.ok(game.obstacles.length <= target, 'density respected');

  const snake = new Set(game.body.map((p) => `${p.x},${p.y}`));
  for (const block of game.obstacles) {
    assert.ok(block.x >= 0 && block.x < 24 && block.y >= 0 && block.y < 24, 'in bounds');
    assert.ok(!snake.has(`${block.x},${block.y}`), 'not on the snake');
    assert.ok(Math.abs(block.y - 12) > 1, 'spawn row kept clear');
  }

  assert.ok(game.food, 'food exists');
  const blocks = new Set(game.obstacles.map((p) => `${p.x},${p.y}`));
  assert.ok(!blocks.has(`${game.food.x},${game.food.y}`), 'food not inside an obstacle');
});

test('obstacles are excluded from free cells', () => {
  const game = new SnakeGame({ cols: 4, rows: 4, obstacles: [{ x: 0, y: 0 }] });
  const free = game.freeCells();
  assert.equal(free.length, 16 - game.body.length - 1);
  assert.ok(!free.some((cell) => cell.x === 0 && cell.y === 0));
});

test('setObstacles rebuilds the board on reset', () => {
  const game = new SnakeGame();
  assert.equal(game.obstacles.length, 0);

  game.setObstacles(true);
  game.reset();
  assert.ok(game.obstacles.length > 0);
  assert.equal(game.isOver, false);
  assert.equal(game.state, 'ready');

  game.setObstacles(false);
  game.reset();
  assert.equal(game.obstacles.length, 0);
});

test('200 random runs with wrap and obstacles stay consistent', () => {
  let seed = 99;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const turns = ['up', 'down', 'left', 'right'];

  for (let run = 0; run < 200; run++) {
    const game = new SnakeGame({ cols: 14, rows: 14, rng, wrap: true, obstacles: true });
    game.start();
    for (let i = 0; i < 200 && !game.isOver; i++) {
      if (rng() < 0.35) game.setDirection(turns[Math.floor(rng() * 4)]);
      game.step();

      const head = game.head;
      assert.ok(head.x >= 0 && head.x < 14 && head.y >= 0 && head.y < 14, 'head in bounds');

      const cells = new Set(game.body.map((p) => `${p.x},${p.y}`));
      assert.equal(cells.size, game.body.length, 'body overlaps itself');
      for (const key of cells) {
        assert.ok(!game.obstacleKeys.has(key), 'body inside an obstacle');
      }
      if (game.food) {
        assert.ok(!cells.has(`${game.food.x},${game.food.y}`), 'food under the snake');
      }
    }
  }
});
