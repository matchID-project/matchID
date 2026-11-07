import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { person } from './helpers.js';

const { default: ResultRow } = await import('../../../src/components/views/ResultRow.svelte');
const stores = await import('../../../src/components/tools/stores.js');

// ResultRow renders a <tr>: mount it inside a table body.
const renderRow = (props) => {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  document.body.appendChild(table);
  return render(ResultRow, { target: tbody, props });
};
const cells = (container) => [...container.querySelectorAll('td')].map(td => td.textContent.trim());

describe('ResultRow', () => {
  it('SR-163 stripes the rows by index', () => {
    const odd = renderRow({ result: person(), index: 1 });
    expect(odd.container.querySelector('tr').className).toContain('rf-background--beige');
    const even = renderRow({ result: person(), index: 2 });
    expect(even.container.querySelector('tr').className).not.toContain('rf-background--beige');
  });

  it('SR-164 a corrected record is red with the title "la fiche a fait l\'objet d\'un signalement"', () => {
    const { container } = renderRow({ result: person({ correction: { change: 'cancel' } }), index: 0 });
    const tr = container.querySelector('tr');
    expect(tr.className).toContain('rf-color--rm');
    expect(tr.title).toBe("la fiche a fait l'objet d'un signalement");
    const plain = renderRow({ result: person(), index: 0 });
    expect(plain.container.querySelector('tr').title).toBe('');
  });

  it('SR-165 joins the first names, or shows "(aucun)"', () => {
    expect(cells(renderRow({ result: person(), index: 0 }).container)[1]).toBe('Jean Pierre');
    expect(cells(renderRow({ result: person({ name: { last: 'Dupont', first: [] } }), index: 0 }).container)[1]).toBe('(aucun)');
  });

  it('SR-166 formats the dates dd/mm/yyyy', () => {
    const row = cells(renderRow({ result: person(), index: 0 }).container);
    expect(row[3]).toBe('03/10/1932');
    expect(row[8]).toBe('16/01/2020');
  });

  it('SR-167 prefers the non-arrondissement city name', () => {
    const result = person();
    result.death = { ...result.death, location: { ...result.death.location, city: ['Paris 15e Arrondissement', 'Paris'] } };
    expect(cells(renderRow({ result, index: 0 }).container)[10]).toBe('Paris');
  });

  it('SR-168 shows the INSEE location code (the first one when there are several)', () => {
    const result = person();
    result.birth = { ...result.birth, location: { ...result.birth.location, code: ['33162', '33999'] } };
    const row = cells(renderRow({ result, index: 0 }).container);
    expect(row[5]).toBe('33162');
    expect(row[11]).toBe('33318');
  });

  it('SR-169 shows the department, country, age and certificate number cells', () => {
    const row = cells(renderRow({ result: person(), index: 0 }).container);
    expect(row).toEqual([
      'Dupont', 'Jean Pierre', 'M', '03/10/1932', 'Eysines', '33162', '33', 'France',
      '16/01/2020', '87', 'Pessac', '33318', '33', 'France', '69 N', ''
    ]);
  });

  it('SR-170 the source cell links to the data.gouv file in a new tab', () => {
    stores.dataGouvCatalog.set({ '2020-m01': '/data.gouv.fr/deces-2020-m01.txt' });
    const { container } = renderRow({ result: person(), index: 0 });
    const link = container.querySelector('td:last-child a');
    expect(link.textContent.trim()).toBe('2020-m01');
    expect(link.getAttribute('href')).toBe('/data.gouv.fr/deces-2020-m01.txt');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    stores.dataGouvCatalog.set(null);
  });

  it('SR-171 wraps each cell in an expand-on-hover box', () => {
    const { container } = renderRow({ result: person(), index: 0 });
    const boxes = container.querySelectorAll('td > div.expand-on-hover');
    expect(boxes).toHaveLength(16);
  });

  it('SR-163 renders nothing for an error result', () => {
    const { container } = renderRow({ result: { error: true }, index: 0 });
    expect(container.querySelector('tr')).toBeNull();
  });
});
