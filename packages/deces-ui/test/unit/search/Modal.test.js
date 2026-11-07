import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
// synchronises requestAnimationFrame timestamps (transitions)
import './helpers.js';

const { default: Modal } = await import('../../../src/components/views/Modal.svelte');
// APIKey.svelte is a real parent: `<Modal title="API Key" bind:show={showAPIKey}>`
// with slot content.
const { default: APIKey } = await import('../../../src/components/views/APIKey.svelte');
const { default: RadioButtons } = await import('../../../src/components/views/RadioButtons.svelte');

const closeIcon = (container) => container.querySelector('.rf-card div[style*="right:26px"], .rf-card div[style*="right: 26px"]');

describe('Modal', () => {
  it('SR-274 is hidden when show is false', () => {
    const { container } = render(Modal, { title: 'Connexion', show: false });
    expect(container.querySelector('.modal')).toBeNull();
  });

  it('SR-275 shows the title in the card header', () => {
    render(Modal, { title: 'Connexion', show: true });
    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Connexion');
  });

  it('SR-276 renders the slot content', () => {
    render(APIKey, { showAPIKey: true });
    expect(screen.getByText('API Key')).toBeTruthy();
    expect(screen.getByText("Votre clé d'API")).toBeTruthy();
    expect(screen.getByText(/Copier clé/)).toBeTruthy();
  });

  it('SR-277 the close icon sets show=false and calls the callback', async () => {
    const callback = vi.fn();
    const { container } = render(Modal, { title: 'Connexion', show: true, callback });
    await fireEvent.click(closeIcon(container));
    expect(callback).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(container.querySelector('.modal')).toBeNull());
  });

  it('SR-277 closing propagates to the parent through bind:show', async () => {
    const { container, component } = render(APIKey, { showAPIKey: true });
    await fireEvent.click(closeIcon(container));
    await waitFor(() => expect(container.querySelector('.modal')).toBeNull());
    // reopening only re-renders if the parent's value was set back to false
    component.$set({ showAPIKey: true });
    await waitFor(() => expect(container.querySelector('.modal')).not.toBeNull());
  });

  it('SR-278 also closes on keydown (the icon is not focusable: no Escape, no role=dialog)', async () => {
    const callback = vi.fn();
    const { container } = render(Modal, { title: 'Connexion', show: true, callback });
    expect(closeIcon(container).getAttribute('tabindex')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(callback).not.toHaveBeenCalled();
    await fireEvent.keyDown(closeIcon(container), { key: 'Enter' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('SR-279 shows the favicon in the card and centres the content responsively', () => {
    const { container } = render(Modal, { title: 'Connexion', show: true });
    expect(screen.getByAltText('login').getAttribute('src')).toBe('/favicon.svg');
    const [left, center, right] = container.querySelector('.modal-container > .rf-container-fluid > .rf-grid-row').children;
    expect(left.className).toBe('rf-col-xs-0 rf-col-sm-1 rf-col-md-2 rf-col-lg-3 rf-col-xl-3');
    expect(center.className).toBe('rf-col-xs-12 rf-col-sm-10 rf-col-md-8 rf-col-lg-6 rf-col-xl-6');
    expect(right.className).toBe(left.className);
  });
});

describe('RadioButtons', () => {
  const props = { title: 'Qualité du scan', labels: ['Mauvaise', 'Bonne'], values: ['poor', 'good'] };

  it('SR-230 shows the title as the fieldset legend', () => {
    const { container } = render(RadioButtons, props);
    expect(container.querySelector('legend').textContent.trim()).toBe('Qualité du scan');
  });

  it('SR-231 renders one radio with its label per value', () => {
    render(RadioButtons, props);
    const radios = screen.getAllByRole('radio');
    expect(radios.map(r => r.value)).toEqual(['poor', 'good']);
    expect(screen.getByLabelText('Mauvaise').value).toBe('poor');
    expect(screen.getByLabelText('Bonne').value).toBe('good');
  });

  it('SR-232 the value is two-way bound to the checked radio', async () => {
    const { component } = render(RadioButtons, { ...props, value: 'good' });
    expect(screen.getByLabelText('Bonne').checked).toBe(true);
    await fireEvent.click(screen.getByLabelText('Mauvaise'));
    expect(screen.getByLabelText('Mauvaise').checked).toBe(true);
    expect(screen.getByLabelText('Bonne').checked).toBe(false);
    component.$set({ value: 'good' });
    await waitFor(() => expect(screen.getByLabelText('Bonne').checked).toBe(true));
  });

  it('SR-233 slugifies the ids and names from the id prop, or from the title, plus the index', () => {
    render(RadioButtons, props);
    expect(screen.getAllByRole('radio').map(r => [r.id, r.name])).toEqual([
      ['qualite-du-scan-0', 'qualite-du-scan-0'], ['qualite-du-scan-1', 'qualite-du-scan-1']
    ]);
    render(RadioButtons, { ...props, id: 'type-2-1' });
    expect(document.getElementById('type-2-1-0')).not.toBeNull();
  });
});
