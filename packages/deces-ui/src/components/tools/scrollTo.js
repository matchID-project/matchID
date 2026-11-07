// Minimal in-house replacement for the `scrollTo` action of svelte-scrolling
// 1.4.0, which does not support Svelte 5.
//
// Same contract as the original action: `use:scrollTo={options}`, where
// options is an element id or `{ ref, offset }`; a click on the node then
// smoothly scrolls the window to that element.
//
// Info.svelte and EditsList.svelte call it as a plain function with a single
// argument: exactly like the original, this throws "scrollTo require a
// options" (frozen bugs IN-078 and LK-199, covered by `it.fails` tests).
export function scrollTo(node, options) {
  if (!options) {
    throw new Error('scrollTo require a options');
  }
  const { ref, offset = 0 } = typeof options === 'string' ? { ref: options } : options;
  if (!ref) {
    throw new Error('scrollTo require a reference');
  }
  const handler = (event) => {
    event.preventDefault();
    const element = document.getElementById(ref.replace(/^#/, ''));
    if (!element) {
      throw new Error(`Element reference '${ref}' not found`);
    }
    window.scrollTo({ top: element.offsetTop + offset, left: element.offsetLeft, behavior: 'smooth' });
  };
  node.addEventListener('click', handler);
  return {
    destroy() {
      node.removeEventListener('click', handler);
    }
  };
}
