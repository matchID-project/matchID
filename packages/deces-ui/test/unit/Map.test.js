import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('../../src/components/tools/getDataGouvCatalog.js', () => ({ default: vi.fn() }));

const { default: Map } = await import('../../src/components/views/Map.svelte');

describe('Map', () => {
  // Regression: the Fullscreen API fallbacks referenced an undefined `noop`,
  // so the component threw a ReferenceError at init (and on click) in any
  // browser without the Fullscreen API (jsdom has none).
  it('mounts and toggles the fullscreen label without the Fullscreen API', async () => {
    expect(document.exitFullscreen).toBeUndefined();
    render(Map);
    const toggle = screen.getByText('Cliquez ici pour le plein écran');
    await fireEvent.click(toggle);
    expect(screen.getByText('Cliquez ici pour sortir du plein écran')).toBeTruthy();
    await fireEvent.click(screen.getByText('Cliquez ici pour sortir du plein écran'));
    expect(screen.getByText('Cliquez ici pour le plein écran')).toBeTruthy();
  });

  it('shows the birth and death layer toggles, checked by default', () => {
    render(Map);
    expect(screen.getByLabelText('Naissance').checked).toBe(true);
    expect(screen.getByLabelText('Décès').checked).toBe(true);
  });
});
