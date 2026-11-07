// Named placeholder components: `stubComponent('LinkJob')` renders the name
// (in `.rf-tile__desc`, see `stubText`) and records the props it received.
//
// The placeholder reuses StatsTile.svelte from the app sources on purpose:
// vitest.config.mjs only compiles .svelte files whose path contains "/src/"
// (CI mounts the package at /app, so a .svelte file under test/ would not be
// compiled there).
import StatsTile from '../../../../src/components/views/StatsTile.svelte';

export const stubProps = [];

export const stubSelector = '.rf-tile__desc';

export const stubText = (root = document) => [...root.querySelectorAll(stubSelector)].map(e => e.textContent.trim());

export const stubComponent = (name) => class extends StatsTile {
  constructor(options) {
    stubProps.push({ name, props: options.props || {} });
    super({ ...options, props: { label: name, number: '' } });
  }
};
