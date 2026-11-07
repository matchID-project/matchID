// Inventory zone IN, PunchMessage.svelte (rows IN-196 .. IN-200).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

vi.mock('../../../src/components/tools/routes.js', () => ({ goTo: vi.fn() }));

const { default: PunchMessage } = await import('../../../src/components/views/PunchMessage.svelte');
const { goTo } = await import('../../../src/components/tools/routes.js');
const { themeDnum, version } = await import('../../../src/components/tools/stores.js');
const { resetStores } = await import('./helpers.js');

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const versionBlock = (container) => container.querySelector('p.rf-text--xs');

const loadedVersion = () => ({
  ui: 'deces-ui version test',
  api: '1.2.3',
  data: { uniqRecordsCount: 27000000, updateDate: '05/01/2023', lastRecordDate: '31/12/2022', lastDataset: 'deces-2022-m12' }
});

describe('PunchMessage', () => {
  beforeEach(() => {
    resetStores();
  });

  it('IN-196 public punchline links to /search and navigates with goTo', async () => {
    render(PunchMessage);
    const link = screen.getByTitle('Recherche');
    expect(link.getAttribute('href')).toBe('/search');
    expect(text(link)).toBe('Recherchez parmi 27 millions de décès depuis 1970 dans les enregistrements officiels de l\'INSEE');
    expect(text(link.querySelector('strong'))).toBe('27 millions de décès');
    expect(screen.queryByAltText('DNUM Logo')).toBeNull();
    const notPrevented = await fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(goTo).toHaveBeenCalledWith({ path: '/search' });
  });

  it('IN-197 DNUM theme: /dnum-logo.svg (hidden on mobile) and the DNUM punchline', async () => {
    themeDnum.set(1);
    render(PunchMessage);
    const logo = screen.getByAltText('DNUM Logo');
    expect(logo.getAttribute('src')).toBe('/dnum-logo.svg');
    expect(logo.getAttribute('width')).toBe('64');
    expect(logo.closest('.rf-hide--mobile')).not.toBeNull();
    expect(text(screen.getByTitle('Recherche'))).toBe('DNUM - Sous direction de l\'innovation et de la transformation numérique');
    themeDnum.set(0);
    await waitFor(() => expect(screen.queryByAltText('DNUM Logo')).toBeNull());
  });

  it('IN-198 data info: record count, update date, last death date and dataset', () => {
    version.set(loadedVersion());
    const { container } = render(PunchMessage);
    const block = text(versionBlock(container));
    expect(block).toContain('27000000 enregistrements, mise à jour le 05/01/2023');
    expect(block).toContain('dernier décès enregistré le 31/12/2022 (deces-2022-m12)');
  });

  it('IN-199 UI version followed by "-api/<api version>"', () => {
    version.set(loadedVersion());
    const { container } = render(PunchMessage);
    expect(text(versionBlock(container))).toMatch(/deces-ui version test -api\/1\.2\.3$/);
    expect(screen.queryByText(/API indisponible/)).toBeNull();
  });

  it('IN-200 "API indisponible (êtes vous hors ligne ?)" while $version.api is missing, then the API version', async () => {
    const { container } = render(PunchMessage);
    const warning = screen.getByText(/API indisponible/);
    expect(text(warning)).toBe('API indisponible (êtes vous hors ligne ?)');
    expect(warning.classList.contains('rf-color--rm')).toBe(true);
    expect(text(versionBlock(container))).not.toContain('enregistrements');
    version.set(loadedVersion());
    await waitFor(() => expect(screen.queryByText(/API indisponible/)).toBeNull());
    expect(text(versionBlock(container))).toContain('-api/1.2.3');
  });

  it('IN-200 no version block at all when $version is unset', () => {
    version.set(undefined);
    const { container } = render(PunchMessage);
    expect(versionBlock(container)).toBeNull();
  });
});
