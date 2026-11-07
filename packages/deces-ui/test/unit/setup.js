// Shared jsdom setup for the deces-ui unit tests.
import { beforeEach, vi } from 'vitest';

// jsdom gaps that the Svelte 5 runtime relies on (Svelte 3 did not).

// `svelte/motion` (tweened) creates a MediaQuery for prefers-reduced-motion
// when it is imported, which calls window.matchMedia.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false
  });
}

// Svelte 5 runs transitions with the Web Animations API. This stand-in only
// keeps the timing: the animation "finishes" (onfinish) after its duration,
// so that intros and outros (and the DOM removal at the end of an outro)
// happen as in a browser. Keyframes are not applied.
if (typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = function animate(keyframes, options = {}) {
    const duration = typeof options === 'number' ? options : (options.duration || 0);
    const animation = {
      effect: {},
      currentTime: 0,
      playState: 'running',
      onfinish: null,
      cancel() {
        clearTimeout(timer);
        animation.playState = 'idle';
        animation.currentTime = null;
      }
    };
    const timer = setTimeout(() => {
      animation.playState = 'finished';
      animation.currentTime = duration;
      if (animation.onfinish) animation.onfinish();
    }, duration);
    return animation;
  };
}

// `animate:flip` asks the element for its running animations.
if (typeof Element.prototype.getAnimations !== 'function') {
  Element.prototype.getAnimations = () => [];
}

beforeEach(() => {
  // Routes and URL helpers read and rewrite `location`; start each test from a
  // known URL so that tests do not depend on each other.
  window.history.replaceState({}, '', '/search');
  localStorage.clear();
});

// Several tests call vi.resetModules() to boot fresh app modules. With Svelte 5
// the runtime is processed by Vite (Svelte 3 was externalized), so it would be
// reset too: components compiled against a fresh runtime then fail under
// @testing-library/svelte's mount (two runtimes, two component contexts).
// Pass-through mocks survive vi.resetModules(): load every Svelte entry point
// once here, through them, to pin a single runtime as before.
vi.mock('svelte', async (importOriginal) => importOriginal());
vi.mock('svelte/internal/client', async (importOriginal) => importOriginal());
vi.mock('svelte/internal/disclose-version', async (importOriginal) => importOriginal());
vi.mock('svelte/internal/flags/legacy', async (importOriginal) => importOriginal());
vi.mock('svelte/store', async (importOriginal) => importOriginal());
vi.mock('svelte/transition', async (importOriginal) => importOriginal());
vi.mock('svelte/animate', async (importOriginal) => importOriginal());
vi.mock('svelte/motion', async (importOriginal) => importOriginal());
vi.mock('svelte/easing', async (importOriginal) => importOriginal());
await import('svelte');
await import('svelte/internal/client');
await import('svelte/internal/disclose-version');
await import('svelte/internal/flags/legacy');
await import('svelte/store');
await import('svelte/transition');
await import('svelte/animate');
await import('svelte/motion');
await import('svelte/easing');
