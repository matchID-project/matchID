import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { searchTrigger, searchString } from '../../../src/components/tools/search.js';
import { searchInput, displayMode, searchMinLength } from '../../../src/components/tools/stores.js';
import { resetSearchState, setFields } from './helpers.js';

const trigger = (values) => {
  setFields(values);
  return Boolean(searchTrigger(get(searchInput)));
};

const say = (values) => {
  setFields(values);
  return searchString(get(searchInput));
};

beforeEach(resetSearchState);

describe('searchTrigger', () => {
  it('CO-025 is always true in agg mode, even with an empty form', () => {
    expect(trigger({})).toBe(false);
    displayMode.set('agg');
    expect(trigger({})).toBe(true);
  });

  it.each([
    ['deathDepartment', '3', false],
    ['deathDepartment', '33', true],
    ['deathDepartment', '2A', true],
    ['deathDepartment', '20', false],
    ['birthDepartment', '20', true],
    ['birthDepartment', '974', true],
    ['birthCountry', 'Fran', false],
    ['birthCountry', 'France', true],
    ['deathCountry', 'france', false],
    ['sex', 'F', true],
    ['sex', 'H', false]
  ])('CO-026 datalist field %s=%j triggers a search: %s', (key, value, expected) => {
    expect(trigger({ [key]: value })).toBe(expected);
  });

  it('CO-027 other fields trigger from the minimum length (1 by default)', () => {
    expect(trigger({ lastName: 'd' })).toBe(true);
    resetSearchState();
    searchMinLength.set(3);
    expect(trigger({ lastName: 'du' })).toBe(false);
    expect(trigger({ lastName: 'dup' })).toBe(true);
  });

  it.each([
    ['deathDate', '195', false],
    ['deathDate', '1950', true],
    ['birthDate', '1950-', false],
    ['birthDate', '1950-1960', true],
    ['deathAge', '30-20', false],
    ['deathAge', '20-30', true]
  ])('CO-028 a field failing its mask validation blocks the search (%s=%j -> %s)', (key, value, expected) => {
    expect(trigger({ lastName: 'dupont', [key]: value })).toBe(expected);
  });
});

describe('searchString', () => {
  it('CO-029 full text: words capitalized', () => {
    expect(say({ fullText: 'dupont JEAN  pierre' })).toBe('Dupont Jean Pierre');
  });

  it('CO-030 name variants: last only (upper case), last + first, first only', () => {
    expect(say({ lastName: 'dupont' })).toBe('DUPONT');
    expect(say({ firstName: 'jEAN' })).toBe('DUPONT Jean');
    resetSearchState();
    expect(say({ firstName: 'jean' })).toBe('prénommé.e Jean');
  });

  it('CO-031 gender wording', () => {
    expect(say({})).toBe('personne');
    expect(say({ sex: 'F' })).toBe('femme');
    expect(say({ sex: 'M' })).toBe('homme');
    expect(say({ sex: 'F', firstName: 'marie' })).toBe('prénommée Marie (F)');
    expect(say({ sex: 'M', firstName: 'jean' })).toBe('prénommé Jean (M)');
    expect(say({ sex: 'M', lastName: 'dupont', firstName: '' })).toBe('DUPONT (M)');
    expect(say({ sex: '', birthDate: '1932' })).toBe('DUPONT né.e en 1932');
  });

  it.each([
    ['1932', 'né.e en 1932'],
    ['03/10/1932', 'né.e le 03/10/1932'],
    ['1930-1935', 'né.e entre 1930 et 1935'],
    ['01/01/1930-31/12/1935', 'né.e entre le 01/01/1930 et le 31/12/1935']
  ])('CO-032 birth date %j -> %j', (value, expected) => {
    expect(say({ birthDate: value })).toBe(`personne ${expected}`);
  });

  it('CO-033 birth place wording', () => {
    expect(say({ birthCity: 'eysines', birthDepartment: '33', birthCountry: 'france' }))
      .toBe('personne né.e à Eysines (33) France');
    resetSearchState();
    expect(say({ birthDepartment: '33', birthCountry: 'france' })).toBe('personne né.e dans le 33 France');
    resetSearchState();
    expect(say({ birthCountry: 'france' })).toBe('personne né.e en France');
  });

  it('CO-034 death wording: age, date, place', () => {
    expect(say({ sex: 'F', deathAge: '87' })).toBe("femme décédée à l'âge de 87 ans");
    resetSearchState();
    expect(say({ deathDate: '2020', deathCity: 'pessac', deathDepartment: '33' }))
      .toBe('personne décédé.e en 2020 à Pessac (33)');
    resetSearchState();
    expect(say({ deathDate: '16/01/2020', deathDepartment: '33', deathCountry: 'france' }))
      .toBe('personne décédé.e le 16/01/2020 dans le 33 France');
    resetSearchState();
    expect(say({ deathDate: '2019-2020', deathCountry: 'france' }))
      .toBe('personne décédé.e entre 2019 et 2020 en France');
  });

  it('CO-034 full advanced search summary', () => {
    expect(say({
      lastName: 'dupont', firstName: 'jean', sex: 'M', birthDate: '1932', birthCity: 'eysines',
      deathDate: '2020', deathDepartment: '33'
    })).toBe('DUPONT Jean (M) né en 1932 à Eysines décédé en 2020 dans le 33');
  });
});
