import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import fs from 'node:fs';
import path from 'node:path';
import * as stores from '../../../src/components/tools/stores.js';
import * as queries from '../../../src/components/tools/queries.js';

const fields = get(stores.searchInput);

describe('CO-069 queries.js (dead code)', () => {
  // The ES query builders are referenced by searchInput[*].query but the UI
  // only sends field values: the backend builds the Elasticsearch queries.
  it('CO-069 builders are referenced by the search inputs but never invoked by the UI', () => {
    expect(fields.lastName.query).toBe(queries.fuzzyTermQuery);
    const srcDir = path.resolve(__dirname, '../../../src');
    const sources = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|svelte)$/.test(entry.name) && !p.endsWith('queries.js')) sources.push(p);
    });
    walk(srcDir);
    const callers = sources.filter(p => /\.query\s*\(|(fuzzyTermQuery|matchQuery|firstNameQuery|dateRangeStringQuery|ageRangeStringQuery|prefixQuery)\s*\(/
      .test(fs.readFileSync(p, 'utf8')));
    expect(callers).toEqual([]);
  });
});

describe('CO-070 datalists', () => {
  it('CO-070 sex datalist is F / M', () => {
    expect(fields.sex.datalist).toEqual(['F', 'M']);
  });

  it('CO-070 birth departments include 20 (pre-1976 Corsica), 2A/2B and overseas codes', () => {
    const deps = fields.birthDepartment.datalist;
    expect(deps).toHaveLength(108);
    expect(deps).toEqual(expect.arrayContaining(['01', '20', '2A', '2B', '33', '95', '971', '976', '988']));
    expect(new Set(deps).size).toBe(deps.length);
  });

  it('CO-070 death departments are the birth departments without 20', () => {
    expect(fields.deathDepartment.datalist).toEqual(fields.birthDepartment.datalist.filter(d => d !== '20'));
  });

  it('CO-070 birth and death countries share the country list', () => {
    expect(fields.birthCountry.datalist).toBe(fields.deathCountry.datalist);
    expect(fields.birthCountry.datalist).toEqual(expect.arrayContaining(['France', 'Algerie', 'Pays Inconnu', 'Allemagne']));
  });

  it('CO-070 free-text fields have no datalist', () => {
    ['fullText', 'lastName', 'firstName', 'birthDate', 'birthCity', 'deathDate', 'deathAge', 'deathCity']
      .forEach(key => expect(fields[key].datalist).toBeUndefined());
  });
});

describe('CO-071 / CO-072 / CO-074 build-time values', () => {
  it('CO-071 linkFileSizeLimit derives from __API_MAX_BODY__ ("100m" -> "100000000")', () => {
    expect(get(stores.linkFileSizeLimit)).toBe('100000000');
    expect(Number(get(stores.linkFileSizeLimit))).toBe(100_000_000);
  });

  it('CO-072 themeDnum starts from __THEME_DNUM__ and alpha features are on for the public theme', () => {
    // vitest.config.mjs sets __THEME_DNUM__ to "0" (public site)
    expect(get(stores.themeDnum)).toBe(0);
    expect(get(stores.alphaFeatures)).toBe(true);
  });

  it('CO-074 maxResults and maxResultsPerPage come from __ES_MAX_RESULTS__', () => {
    expect(get(stores.maxResults)).toBe(10000);
    expect(get(stores.maxResultsPerPage)).toBe(10000);
  });

  it('CO-074 other build-time stores: version label and MITM url', () => {
    expect(get(stores.version)).toEqual({ ui: 'deces-ui version test' });
    expect(get(stores.mitmUrl)).toBe('/mitm/mitm.html');
  });
});

describe('CO-073 activeElement', () => {
  it('CO-073 follows focus and blur through capture-phase listeners on document', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(get(stores.activeElement)).toBe(input);
    input.blur();
    expect(get(stores.activeElement)).toBe(document.body);
    input.remove();
  });
});
