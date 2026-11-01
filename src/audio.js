/*
 * Tiny WebAudio synth — no assets, no dependencies. Browsers block audio until
 * a user gesture, so the context is created lazily on the first unlock() call
 * (which game.js does from a real key/pointer event).
 */
(function (root) {
  'use strict';

  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    const AudioCtor = root.AudioContext || root.webkitAudioContext;
    if (!AudioCtor) return null;

    if (!ctx) {
      try {
        ctx = new AudioCtor();
      } catch (error) {
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      const resumed = ctx.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
    }
    return ctx;
  }

  function blip(options) {
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const duration = options.duration || 0.09;
    const peak = options.gain || 0.06;

    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = options.type || 'triangle';
    osc.frequency.setValueAtTime(options.from, now);
    if (options.to && options.to !== options.from) {
      osc.frequency.exponentialRampToValueAtTime(options.to, now + duration);
    }

    // Short attack and release so blips sound like clicks, not beeps.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  root.SnakeAudio = {
    unlock: function () {
      ensureContext();
    },

    setMuted: function (value) {
      muted = !!value;
      return muted;
    },

    isMuted: function () {
      return muted;
    },

    eat: function () {
      blip({ from: 600, to: 900, duration: 0.08, type: 'triangle', gain: 0.07 });
    },

    /* Small tick when the snake reaches a new level. */
    levelUp: function () {
      blip({ from: 860, to: 1150, duration: 0.06, type: 'sine', gain: 0.045 });
    },

    death: function () {
      blip({ from: 320, to: 80, duration: 0.34, type: 'sawtooth', gain: 0.08 });
    },

    win: function () {
      [523, 659, 784, 1047].forEach(function (freq, index) {
        root.setTimeout(function () {
          blip({ from: freq, to: freq, duration: 0.14, type: 'triangle', gain: 0.06 });
        }, index * 110);
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
