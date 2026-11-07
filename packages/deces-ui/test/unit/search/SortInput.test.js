import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, createEvent, waitFor } from '@testing-library/svelte';
// synchronises requestAnimationFrame timestamps (transitions)
import './helpers.js';
import { get } from 'svelte/store';

const { default: SortInput } = await import('../../../src/components/views/SortInput.svelte');
const stores = await import('../../../src/components/tools/stores.js');

const initialSort = structuredClone(get(stores.sortInput));
const orders = () => Object.fromEntries(get(stores.sortInput).filter(s => s.order).map(s => [s.input, s.order]));
// The visible draggable card of a sort key, found by its label.
const item = (label) => [...document.querySelectorAll('[draggable="true"]:not(.rf-hide)')]
  .find(el => el.querySelector('.no-pointer-events').textContent.trim() === label);
const activeItems = () => [...document.querySelectorAll('[draggable="true"]:not(.rf-hide)')]
  .filter(el => el.closest('.rf-col-6').querySelector('strong').textContent === 'actives')
  .map(el => el.textContent.trim());

// HTML5 drag and drop with a minimal DataTransfer.
const dataTransfer = () => {
  const data = {};
  return { setData: (k, v) => { data[k] = v; }, getData: k => data[k], effectAllowed: '', dropEffect: '' };
};
const dragAndDrop = async (from, to) => {
  const transfer = dataTransfer();
  await fireEvent(from, Object.assign(createEvent.dragStart(from), { dataTransfer: transfer }));
  await fireEvent(to, Object.assign(createEvent.drop(to), { dataTransfer: transfer }));
};

describe('SortInput', () => {
  beforeEach(() => {
    stores.sortInput.set(structuredClone(initialSort));
    stores.sortInputDisplay.set(true);
  });

  it('SR-189 the sort panel is hidden unless sortInputDisplay is set', async () => {
    stores.sortInputDisplay.set(false);
    const { container } = render(SortInput);
    expect(container.innerHTML.replace(/<!---->/g, '')).toBe(''); // Svelte 5 keeps empty <!----> block anchors
    stores.sortInputDisplay.set(true);
    await waitFor(() => expect(screen.getByText('clés de tri')).toBeTruthy());
  });

  it('SR-190 shows the "clés de tri" title, each key label and its order arrow', () => {
    render(SortInput);
    expect(screen.getByText('clés de tri').tagName).toBe('B');
    expect(item('score').querySelector('.rf-fi-arrow-down-s-line')).not.toBeNull();
    expect(item('nom').querySelector('[class*="rf-fi-arrow"]')).toBeNull();
    expect(activeItems()).toEqual(['score']);
  });

  it('SR-191 clicking an active key cycles asc/desc and updates the sortInput store', async () => {
    render(SortInput);
    await fireEvent.click(item('score'));
    expect(orders()).toEqual({ score: 'asc' });
    expect(item('score').querySelector('.rf-fi-arrow-up-s-line')).not.toBeNull();
    await fireEvent.click(item('score'));
    expect(orders()).toEqual({ score: 'desc' });
  });

  it('SR-191 dragging an inactive key onto an active one activates it and reorders the keys', async () => {
    render(SortInput);
    await dragAndDrop(item('nom'), item('score'));
    await waitFor(() => expect(get(stores.sortInput).slice(0, 2).map(s => [s.input, s.order])).toEqual([
      ['lastName', 'asc'], ['score', 'desc']
    ]));
    expect(activeItems()).toEqual(['nom', 'score']);
  });

  it('SR-191 dragging an active key to the inactive column deactivates it', async () => {
    render(SortInput);
    const inactiveZone = [...document.querySelectorAll('strong')].find(s => s.textContent === 'inactives').nextElementSibling;
    await dragAndDrop(item('score'), inactiveZone);
    await waitFor(() => expect(orders()).toEqual({}));
    expect(screen.getAllByText('glissez un filtre ici')).toHaveLength(1);
  });
});
