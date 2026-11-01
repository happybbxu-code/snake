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
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      const resumed = ctx.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
    }
    return ctx;
  }

  function blip(options) {
    const audio = ensureContext();
    if (!audio) return null;

    const now = audio.currentTime;
    const duration = options.duration || 0.1;
    const peak = options.gain || 0.14;

    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = options.type || 'triangle';
    osc.frequency.setValueAtTime(options.from, now);
    if (options.to && options.to !== options.from) {
      osc.frequency.exponentialRampToValueAtTime(options.to, now + duration * 0.9);
    }

    // Fast attack, exponential release: reads as a click, not a beep.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
    return osc;
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

    /* Diagnostics: 'running' when audio can actually be heard. */
    state: function () {
      if (muted) return 'muted';
      return ctx ? ctx.state : 'none';
    },

    /* Two quick notes, used to confirm audio works when unmuting. */
    test: function () {
      blip({ from: 587, to: 587, duration: 0.09, type: 'triangle', gain: 0.16 });
      root.setTimeout(function () {
        blip({ from: 880, to: 880, duration: 0.12, type: 'triangle', gain: 0.16 });
      }, 110);
    },

    eat: function () {
      blip({ from: 620, to: 980, duration: 0.1, type: 'triangle', gain: 0.18 });
    },

    /* Small tick when the snake reaches a new level. */
    levelUp: function () {
      blip({ from: 880, to: 1240, duration: 0.08, type: 'sine', gain: 0.1 });
    },

    death: function () {
      blip({ from: 340, to: 70, duration: 0.4, type: 'sawtooth', gain: 0.2 });
    },

    win: function () {
      [523, 659, 784, 1047].forEach(function (freq, index) {
        root.setTimeout(function () {
          blip({ from: freq, to: freq, duration: 0.16, type: 'triangle', gain: 0.14 });
        }, index * 115);
      });
    },
  };

  // Coming back to the tab: browsers suspend the context while hidden.
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) ensureContext();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
