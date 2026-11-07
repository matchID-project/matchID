// Named placeholder components: `stubComponent('LinkJob')` renders the name
// (in `.rf-tile__desc`, see `stubText`) and records the props it received.
//
// The placeholder reuses StatsTile.svelte from the app sources: a Svelte 5
// component is a function (anchor, props), so the stub records the props and
// renders StatsTile in its place.
import StatsTile from '../../../../src/components/views/StatsTile.svelte';

export const stubProps = [];

export const stubSelector = '.rf-tile__desc';

export const stubText = (root = document) => [...root.querySelectorAll(stubSelector)].map(e => e.textContent.trim());

export const stubComponent = (name) => function StubComponent(anchor, props) {
  stubProps.push({ name, props });
  return StatsTile(anchor, { label: name, number: '' });
};
