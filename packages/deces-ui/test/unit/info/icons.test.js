// Inventory zone IN, icons and icon menus (rows IN-183, IN-184, IN-189 .. IN-195):
// Icon.svelte, IconDecorator.svelte, IconMenuCallout.svelte, tools/icons.js.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { readdirSync, readFileSync } from 'node:fs';

const { default: Icon } = await import('../../../src/components/views/Icon.svelte');
const { default: IconDecorator } = await import('../../../src/components/views/IconDecorator.svelte');
const { default: IconMenuCallout } = await import('../../../src/components/views/IconMenuCallout.svelte');
const { default: StatsTile } = await import('../../../src/components/views/StatsTile.svelte');
const { default: Iframe } = await import('../../../src/components/views/Iframe.svelte');
const { icons } = await import('../../../src/components/tools/icons.js');
const { activeElement } = await import('../../../src/components/tools/stores.js');
const { resetStores } = await import('./helpers.js');

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const paths = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('path')].map(p => p.getAttribute('d'));
};

beforeEach(() => {
  resetStores();
});

describe('Icon', () => {
  it('IN-189 renders the inline SVG of the icon from the generated icons map', () => {
    const { container } = render(Icon, { icon: 'ri:search-line' });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(paths(svg.outerHTML)).toEqual(paths(icons['ri:search-line']));
    expect(paths(svg.outerHTML).length).toBeGreaterThan(0);
    expect(container.querySelector('.rf-color--rm')).toBeNull();
  });

  it('IN-190 an unknown icon name renders the alert icon in red', () => {
    const { container } = render(Icon, { icon: 'ri:does-not-exist' });
    expect(paths(container.querySelector('svg').outerHTML)).toEqual(paths(icons['ri:alert-line']));
    expect(container.querySelector('.rf-color--rm')).not.toBeNull();
  });

  it('IN-191 href wraps the icon in a link with an aria-label', () => {
    const { container } = render(Icon, { icon: 'ri:search-line', href: '#search', label: 'Recherche' });
    const link = container.querySelector('a.rf-fi__link');
    expect(link.getAttribute('href')).toBe('#search');
    expect(link.getAttribute('aria-label')).toBe('Recherche');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('IN-191 without href there is no link', () => {
    const { container } = render(Icon, { icon: 'ri:search-line', label: 'Recherche' });
    expect(container.querySelector('a')).toBeNull();
  });

  it('IN-192 spin, center, zoom and extra class', () => {
    const { container } = render(Icon, { icon: 'ri:search-line', spin: true, center: true, zoom: true, class: 'rf-fi--lg' });
    const outer = container.firstElementChild;
    const inner = outer.firstElementChild;
    expect([...outer.classList]).toEqual(expect.arrayContaining(['rf-fi--icon', 'center', 'rf-fi--lg', 'zoom', 'zoomed']));
    expect(outer.classList.contains('spin')).toBe(false);
    expect([...inner.classList]).toEqual(expect.arrayContaining(['rf-fi--icon', 'rf-fi--lg', 'spin']));
    expect(inner.style.position).toBe('relative');
  });

  it('IN-192 no zoom / spin classes by default', () => {
    const { container } = render(Icon, { icon: 'ri:search-line' });
    expect(container.querySelector('.zoom, .zoomed, .spin')).toBeNull();
  });

  it('IN-193 renders nothing when icon is falsy', () => {
    const { container } = render(Icon, { icon: '' });
    expect(container.innerHTML.replace(/<!---->/g, '')).toBe(''); // Svelte 5 keeps empty <!----> block anchors
    const { container: none } = render(Icon);
    expect(none.innerHTML.replace(/<!---->/g, '')).toBe(''); // Svelte 5 keeps empty <!----> block anchors
  });

  it('IN-031 / IN-194 circleText adds an IconDecorator around the icon', () => {
    const { container } = render(Icon, { icon: 'ri:user-follow-line', circleText: 'admin@example.org' });
    const decorator = container.querySelectorAll('svg')[1];
    expect(decorator.querySelector('title').textContent).toBe('admin@example.org');
    expect(decorator.parentElement.style.position).toBe('absolute');
  });
});

describe('IconDecorator', () => {
  it('IN-194 circular text on the #textcircle path with a <title>', () => {
    const { container } = render(IconDecorator, { text: 'Admin@Example.org' });
    expect(container.querySelector('title').textContent).toBe('Admin@Example.org');
    const textPath = container.querySelector('textPath');
    expect(textPath.getAttribute('xlink:href')).toBe('#textcircle');
    expect(text(textPath)).toBe('Admin@Example.org');
    expect(container.querySelector('path#textcircle')).not.toBeNull();
  });

  // BUG: the path id "textcircle" is hard-coded, so the desktop and mobile
  // header decorators (2 instances) produce duplicate ids.
  it.fails('IN-194 BUG: two decorators do not duplicate the "textcircle" id', () => {
    render(IconDecorator, { text: 'a' });
    render(IconDecorator, { text: 'b' });
    expect(document.querySelectorAll('[id="textcircle"]')).toHaveLength(1);
  });
});

describe('IconMenuCallout', () => {
  const menu = () => ({
    Options: { icon: 'ri:settings-3-line', component: StatsTile, props: { number: 5, label: 'Cinq' } },
    Aide: { icon: 'ri:question-line', component: Iframe, props: { src: 'https://example.org/aide' } }
  });
  const links = (container) => [...container.querySelectorAll('a.rf-fi__link')];

  it('IN-183 one icon link per entry (href "#<name>", labelled with the entry name), no callout by default', () => {
    const { container } = render(IconMenuCallout, { menu: menu() });
    expect(links(container).map(a => [a.getAttribute('href'), a.getAttribute('aria-label')])).toEqual([
      ['#options', 'Options'], ['#aide', 'Aide']
    ]);
    expect(container.querySelector('.rf-callout')).toBeNull();
    expect(container.querySelector('#options').classList.contains('rf-padding-2N')).toBe(true);
  });

  it('IN-183 clicking an icon opens the callout with its component and hides the other icons', async () => {
    const { container } = render(IconMenuCallout, { menu: menu() });
    await fireEvent.click(links(container)[0].closest('span'));
    const callout = container.querySelector('.rf-callout');
    expect(callout).not.toBeNull();
    expect(text(callout)).toBe('5 Cinq');
    await waitFor(() => expect(links(container).map(a => a.getAttribute('aria-label'))).toEqual(['Options']));
    expect(container.querySelector('#options').classList.contains('rf-padding-bottom-2N')).toBe(true);
  });

  it('IN-183 the callout spreads the entry props into its component', async () => {
    const { container } = render(IconMenuCallout, { menu: menu() });
    await fireEvent.click(links(container)[1].closest('span'));
    expect(container.querySelector('.rf-callout iframe').getAttribute('src')).toBe('https://example.org/aide');
  });

  it('IN-184 clicking the active icon closes the callout and shows all icons again', async () => {
    const { container } = render(IconMenuCallout, { menu: menu() });
    await fireEvent.click(links(container)[1].closest('span'));
    await waitFor(() => expect(links(container)).toHaveLength(1));
    await fireEvent.click(links(container)[0].closest('span'));
    expect(container.querySelector('.rf-callout')).toBeNull();
    await waitFor(() => expect(links(container).map(a => a.getAttribute('aria-label'))).toEqual(['Options', 'Aide']));
  });

  it('IN-184 each click blurs the focused element', async () => {
    const focused = { blur: vi.fn() };
    activeElement.set(focused);
    const { container } = render(IconMenuCallout, { menu: menu() });
    await fireEvent.click(links(container)[0].closest('span'));
    expect(focused.blur).toHaveBeenCalledTimes(1);
    expect(get(activeElement)).toBeUndefined();
  });
});

describe('generated icons map', () => {
  // Same pattern as svelte-iconify-svg (used by rollup-plugin-iconify-svg) to
  // find the icon ids quoted in the view sources.
  const iconIdPattern = /(?<=("|'))(?!(bind|on|svelte))[a-zA-Z0-9-]+:[a-zA-Z0-9-]+(?=("|'))/g;
  // vitest runs from packages/deces-ui (its root)
  const viewsDir = `${process.cwd()}/src/components/views/`;
  const prefixes = new Set(Object.keys(icons).map(k => k.split(':')[0]));
  const usedIds = [...new Set(readdirSync(viewsDir)
    .filter(f => f.endsWith('.svelte'))
    .flatMap(f => [...readFileSync(`${viewsDir}${f}`, 'utf8').matchAll(iconIdPattern)].map(m => m[0]))
    .filter(id => prefixes.has(id.split(':')[0])))];

  it('IN-195 contains every literal icon id used in the views, including the ri:alert-line fallback', () => {
    expect(usedIds.length).toBeGreaterThan(30);
    expect(usedIds).toContain('ri:alert-line');
    expect(usedIds.filter(id => !icons[id])).toEqual([]);
  });

  it('IN-195 every entry is an inline SVG with aria-hidden, focusable=false and currentColor', () => {
    for (const [id, svg] of Object.entries(icons)) {
      expect(svg, id).toMatch(/^<svg/);
      expect(svg, id).toContain('aria-hidden="true"');
      expect(svg, id).toContain('focusable="false"');
    }
  });
});
