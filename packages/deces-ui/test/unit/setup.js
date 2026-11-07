// Shared jsdom setup for the deces-ui unit tests.
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Routes and URL helpers read and rewrite `location`; start each test from a
  // known URL so that tests do not depend on each other.
  window.history.replaceState({}, '', '/search');
  localStorage.clear();
});
