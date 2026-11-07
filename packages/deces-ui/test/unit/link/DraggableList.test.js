import { beforeEach, describe, expect, it } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import DraggableList from '../../../src/components/views/DraggableList.svelte';
import SortInput from '../../../src/components/views/SortInput.svelte';
import { sortInput, sortInputDisplay } from '../../../src/components/tools/stores.js';
import { makeDataTransfer, flush } from './helpers.js';

const items = () => [
  { label: 'score', order: 'desc' },
  { label: 'nom', order: undefined },
  { label: 'prénom', order: 'asc' }
];

// zone 0 = "actives", zone 1 = "inactives"
const zone = (container, n) => container.querySelectorAll('.rf-col-6.rf-padding-1N')[n];
const visibleItems = (container, n) => [...zone(container, n).querySelectorAll('div[draggable="true"]')]
  .filter(div => !div.classList.contains('rf-hide'));
const labels = (container, n) => visibleItems(container, n).map(div => div.textContent.trim());

// The component mutates the bound array in place: keep a reference to it.
const renderList = (props = {}) => {
  const list = props.items || items();
  const result = render(DraggableList, { activeKey: 'order', statusKey: 'order', status: ['asc', 'desc'], ...props, items: list });
  return { ...result, list };
};

describe('DraggableList (sort keys, used by SortInput)', () => {
  beforeEach(() => {
    sortInputDisplay.set(false);
  });

  it('LK-202 splits the items into "actives" / "inactives" zones by activeKey', () => {
    const { container } = renderList();
    expect(zone(container, 0).querySelector('strong').textContent).toBe('actives');
    expect(zone(container, 1).querySelector('strong').textContent).toBe('inactives');
    expect(labels(container, 0)).toEqual(['[object Object]', '[object Object]']);
    expect(visibleItems(container, 0)).toHaveLength(2);
    expect(visibleItems(container, 1)).toHaveLength(1);
  });

  it('LK-203 an empty zone shows "glissez un filtre ici" and highlights on dragenter', async () => {
    const { container } = renderList({ items: [{ label: 'a', order: 'asc' }] });
    const placeholder = zone(container, 1).querySelector('.rf-text--center');
    expect(placeholder.textContent.trim()).toBe('glissez un filtre ici');
    expect(zone(container, 0).querySelector('.rf-text--center.rf-padding-top-3N')).toBeNull();
    await fireEvent.dragEnter(placeholder);
    expect(placeholder.classList.contains('hovering')).toBe(true);
    await fireEvent.dragLeave(placeholder);
    expect(placeholder.classList.contains('hovering')).toBe(false);
  });

  it('LK-203 both zones and their empty placeholders accept a drop (dragover default prevented)', async () => {
    const { container } = renderList({ items: [{ label: 'a', order: 'asc' }] });
    const targets = [
      zone(container, 0).querySelector('.rf-container-fuild'),
      zone(container, 1).querySelector('.rf-container-fuild'),
      zone(container, 1).querySelector('.rf-text--center')
    ];
    for (const target of targets) {
      const over = createEvent.dragOver(target);
      await fireEvent(target, over);
      expect(over.defaultPrevented).toBe(true);
    }
    // an item itself does not cancel dragover: the event bubbles to its zone
    const item = zone(container, 0).querySelector('div[draggable="true"]');
    const over = createEvent.dragOver(item);
    item.addEventListener('dragover', (e) => expect(e.defaultPrevented).toBe(false), { once: true });
    await fireEvent(item, over);
    expect(over.defaultPrevented).toBe(true);
  });

  const dragPayload = async (container, zoneIndex, itemIndex) => {
    const dataTransfer = makeDataTransfer();
    const source = zone(container, zoneIndex).querySelectorAll('div[draggable="true"]')[itemIndex];
    await fireEvent.dragStart(source, { dataTransfer });
    return dataTransfer;
  };

  it('LK-204 dragstart sends {item, id, status}; dropping on the inactive zone clears the status', async () => {
    const { container, list } = renderList();
    const dataTransfer = await dragPayload(container, 0, 0); // "score" from the active zone
    expect(JSON.parse(dataTransfer.store['text/plain'])).toEqual({ item: { label: 'score', order: 'desc' }, id: 0, status: 'asc' });
    await fireEvent.drop(zone(container, 1).querySelector('.rf-container-fuild'), { dataTransfer });
    await flush();
    expect(list[0]).toEqual({ label: 'score', order: undefined });
    expect(visibleItems(container, 1)).toHaveLength(2);
  });

  it('LK-204 dropping on an item of the active zone reorders and sets status[0]', async () => {
    const { container, list } = renderList();
    const dataTransfer = await dragPayload(container, 1, 1); // "nom" (index 1) from the inactive zone
    const target = zone(container, 0).querySelectorAll('div[draggable="true"]')[0]; // onto "score" (index 0)
    await fireEvent.drop(target, { dataTransfer });
    await flush();
    expect(list.map(i => [i.label, i.order])).toEqual([['nom', 'asc'], ['score', 'desc'], ['prénom', 'asc']]);
  });

  it('LK-205 clicking an active item cycles its status (asc <-> desc) — relies on the lazy Svelte 3 handler expression', async () => {
    const { container, list } = renderList();
    const score = zone(container, 0).querySelectorAll('div[draggable="true"]')[0];
    const order = () => list[0].order;
    expect(order()).toBe('desc');
    await fireEvent.click(score);
    expect(order()).toBe('asc');
    await fireEvent.click(score);
    expect(order()).toBe('desc');
  });

  it('LK-205 the handler is not run at render time', () => {
    const list = items();
    render(DraggableList, { items: list, activeKey: 'order', statusKey: 'order', status: ['asc', 'desc'] });
    expect(list.map(i => i.order)).toEqual(['desc', undefined, 'asc']);
  });

  it('LK-207 renders the default slot with let:item (SortInput labels and order arrows)', async () => {
    sortInput.set([
      { label: 'score', input: 'score', order: 'desc' },
      { label: 'nom', input: 'lastName', order: 'asc' },
      { label: 'sexe', input: 'sex' }
    ]);
    sortInputDisplay.set(true);
    const { container } = render(SortInput);
    expect(container.querySelector('p b').textContent).toBe('clés de tri');
    expect(labels(container, 0)).toEqual(['score', 'nom']);
    expect(labels(container, 1)).toEqual(['sexe']);
    const [score, nom] = visibleItems(container, 0);
    expect(score.querySelector('.rf-fi-arrow-down-s-line')).not.toBeNull();
    expect(nom.querySelector('.rf-fi-arrow-up-s-line')).not.toBeNull();
    await fireEvent.click(score);
    expect(get(sortInput)[0].order).toBe('asc');
    expect(score.querySelector('.rf-fi-arrow-up-s-line')).not.toBeNull();
  });

  it('LK-207 falls back to the item key text without slot content', () => {
    const { container } = render(DraggableList, { items: ['alpha', 'beta'] });
    expect(labels(container, 0)).toEqual(['alpha', 'beta']);
    expect(zone(container, 0).querySelector('p').textContent).toBe('alpha');
  });
});
