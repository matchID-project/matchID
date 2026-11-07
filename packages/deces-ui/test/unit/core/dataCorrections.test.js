import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// search.js computes "today" when it is imported: freeze the clock first so
// that the "deceased minor less than 10 years ago" rule (CO-041) is stable.
vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z'), toFake: ['Date'] });

vi.mock('../../../src/components/tools/runRequest.js', () => ({
  runSearchRequest: vi.fn(),
  runIdRequest: vi.fn()
}));

// Real corrections plus one "cancel" entry that keeps the default
// anonymization (the real list only has a cancel with anonymize:false).
vi.mock('../../../src/components/tools/dataCorrections.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    dataCorrections: {
      ...original.dataCorrections,
      TestCancel01: { permalink: '/id/TestCancel01', change: 'cancel', reason: 'test' }
    }
  };
});

const { runSearchRequest, runIdRequest } = await import('../../../src/components/tools/runRequest.js');
const { dataCorrections } = await import('../../../src/components/tools/dataCorrections.js');
const search = await import('../../../src/components/tools/search.js');
const stores = await import('../../../src/components/tools/stores.js');
const { resetSearchState, setFields, person } = await import('./helpers.js');

const REAL_CANCEL_KEEP = 'H9HBeGybba1K'; // change: cancel, anonymize: false
const REAL_REMOVE = 'Sx46mXzoiNo5'; // change: remove

const searchReturning = async (persons) => {
  runSearchRequest.mockResolvedValue({ response: { total: persons.length, size: 20, persons } });
  setFields({ lastName: 'dupont' });
  await search.searchSubmit();
  return get(stores.searchResults);
};

const byId = async (p) => {
  runIdRequest.mockResolvedValue({ response: { persons: [p] } });
  return search.getById({ id: p.id });
};

beforeEach(() => {
  resetSearchState();
  runSearchRequest.mockReset();
  runIdRequest.mockReset();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('CO-039 data correction "cancel"', () => {
  it('CO-039 the fixture ids have the expected corrections', () => {
    expect(dataCorrections[REAL_CANCEL_KEEP]).toMatchObject({ change: 'cancel', anonymize: false });
    expect(dataCorrections[REAL_REMOVE]).toMatchObject({ change: 'remove' });
  });

  it('CO-039 removes the death, masks extra first names and reduces the birth location', async () => {
    const [p] = await searchReturning([person({ id: 'TestCancel01' })]);
    expect(p.correction.change).toBe('cancel');
    expect(p.death).toBeUndefined();
    expect(p.name.first).toEqual(['Jean', 'P****']);
    expect(p.name.last).toBe('DUPONT');
    expect(p.birth.location).toEqual({ departmentCode: '33', country: 'France', countryCode: 'FRA' });
    expect(p.birth.date).toBe('19321003');
  });

  it('CO-039 keeps names and birth place when the person asked for anonymize:false', async () => {
    const p = await byId(person({ id: REAL_CANCEL_KEEP }));
    expect(p.death).toBeUndefined();
    expect(p.name.first).toEqual(['Jean', 'Pierre']);
    expect(p.birth.location.city).toBe('Eysines');
  });
});

describe('CO-040 data correction "remove"', () => {
  it('CO-040 filters the record out of the search results', async () => {
    const results = await searchReturning([person({ id: REAL_REMOVE }), person({ id: 'kept-person0' })]);
    expect(results.map(p => p.id)).toEqual(['kept-person0']);
    // totals still come from the backend
    expect(get(stores.totalResults)).toBe(2);
  });

  it('CO-040 /id shows an INCONNU record without sex, birth place or death', async () => {
    const p = await byId(person({ id: REAL_REMOVE }));
    expect(p.name).toEqual({ first: ['INCONNU'], last: 'INCONNU' });
    expect(p.sex).toBeUndefined();
    expect(p.birth.date).toBe('XXXX');
    expect(p.birth.location).toEqual({ departmentCode: undefined, country: undefined, countryCode: undefined });
    expect(p.death).toBeUndefined();
  });
});

describe('CO-041 deceased minors (< 18) less than 10 years ago', () => {
  const minor = (deathDate, age = 10) => person({
    id: `minor${deathDate}`,
    death: { date: deathDate, age, location: { city: 'Pessac', departmentCode: '33', country: 'France', countryCode: 'FRA' } }
  });

  it('CO-041 reduces names to initials and hides the birth city (death 6 years ago)', async () => {
    const [p] = await searchReturning([minor('20200101')]);
    expect(p.name).toEqual({ first: ['J****'], last: 'D****' });
    expect(p.birth.location).toEqual({ departmentCode: '33', country: 'France', countryCode: 'FRA' });
    expect(p.anonymize).toBe('recentKidDeath');
  });

  it('CO-041 boundary: 9 full years -> anonymized, 10 full years -> names kept', async () => {
    // today is 2026-06-15 (frozen); only year and month are compared
    const [recent, old] = await searchReturning([minor('20160701'), minor('20160601')]);
    expect(recent.name.last).toBe('D****');
    expect(old.name.last).toBe('DUPONT');
    // the flag is set for every minor death with a date, even when not reduced
    expect(old.anonymize).toBe('recentKidDeath');
  });

  it('CO-041 leaves adults and records without age untouched', async () => {
    const [adult, unknownAge] = await searchReturning([
      minor('20250101', 18),
      person({ id: 'noAge0000000', death: { date: '20250101', age: null, location: {} } })
    ]);
    expect(adult.name.last).toBe('DUPONT');
    expect(adult.anonymize).toBeUndefined();
    expect(unknownAge.name.last).toBe('DUPONT');
  });

  it('CO-041 also applies on /id', async () => {
    const p = await byId(minor('20240301', 3));
    expect(p.name).toEqual({ first: ['J****'], last: 'D****' });
  });
});
