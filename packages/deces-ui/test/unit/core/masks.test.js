import { describe, expect, it } from 'vitest';
import {
  ageTypingMask,
  ageValidationMask,
  ageRangeTypingMask,
  ageRangeValidationMask,
  ageRangeTransformMask,
  dateTypingMask,
  dateValidationMask,
  dateRangeTypingMask,
  dateRangeValidationMask,
  dateTransformMask,
  dateRangeTransformMask,
  sexTypingMask,
  sexValidationMask,
  sexTransformMask,
  capitalize,
  removeDiacritics,
  lastNameEditMask,
  lastNameStringify,
  lastNameParse,
  firstNameEditMask,
  firstNameStringify,
  firstNameParse,
  sexEditMask,
  sexStringify,
  sexParse,
  dateEditMask,
  dateStringify,
  dateParse,
  cityEditMask,
  countryEditMask,
  countryCodeEditMask,
  locationCodeEditMask,
  departmentCodeEditMask
} from '../../../src/components/tools/masks.js';

// Masks return a RegExp match (or null); only their truthiness matters.
const accepts = (mask, value) => Boolean(mask(value));

describe('CO-060 date typing mask (partial input)', () => {
  it.each([
    '', '<', '>', '0', '1', '18', '189', '1890', '19', '195', '1950',
    '2', '20', '202', '2020', '<2020', '>1950',
    '3', '31', '31/', '31/1', '31/12', '31/12/', '31/12/1', '31/12/19', '31/12/195', '31/12/1950',
    '01/01/2', '01/01/20', '01/01/2020'
  ])('CO-060 accepts the partial date %j', (value) => {
    expect(accepts(dateTypingMask, value)).toBe(true);
  });

  it.each([
    '4', '170', '1750', '2120', '31/2', '41/', 'abc', '2020x', '31/12/1750', '31/12/2120'
  ])('CO-060 rejects the impossible prefix %j', (value) => {
    expect(accepts(dateTypingMask, value)).toBe(false);
  });
});

describe('CO-061 date validation mask (complete values only)', () => {
  // BUG: day and month digits are only checked as [0-3]x and [0-1]x, so
  // impossible dates such as 39/19/2020 pass both masks and reach the backend.
  it.fails('CO-061 BUG: rejects impossible calendar dates (day > 31, month > 12)', () => {
    expect(accepts(dateValidationMask, '32/01/2020')).toBe(false);
    expect(accepts(dateValidationMask, '01/13/2020')).toBe(false);
  });

  it('CO-061 currently accepts day 39 / month 19 (only the first digit is range-checked)', () => {
    expect(accepts(dateValidationMask, '39/19/2020')).toBe(true);
    expect(accepts(dateTypingMask, '32/')).toBe(true);
  });

  it.each(['', '0000', '1950', '<1950', '>2020', '2020', '31/12/2020', '01/01/1890'])(
    'CO-061 accepts the complete date %j', (value) => {
      expect(accepts(dateValidationMask, value)).toBe(true);
    });

  it.each(['195', '31/12', '31/12/20', '1750', '2150', '31/12/1750', '<', 'x'])(
    'CO-061 rejects the incomplete or invalid date %j', (value) => {
      expect(accepts(dateValidationMask, value)).toBe(false);
    });
});

describe('CO-062 date range typing and validation', () => {
  it.each(['1950', '1950-', '1950-1', '1950-19', '1950-1960', '01/01/1950-3', '01/01/1950-31/12/1960'])(
    'CO-062 typing accepts %j', (value) => {
      expect(accepts(dateRangeTypingMask, value)).toBe(true);
    });

  it.each(['195-', '195-1960', '1950-4', '01/01/195-1960'])('CO-062 typing rejects %j', (value) => {
    expect(accepts(dateRangeTypingMask, value)).toBe(false);
  });

  it.each(['1950-1960', '01/01/1950-31/12/1950', '1950', ''])('CO-062 validation accepts %j', (value) => {
    expect(accepts(dateRangeValidationMask, value)).toBe(true);
  });

  it.each(['1960-1950', '1950-1950', '31/12/1950-01/01/1950', '1950-', '1950-196'])(
    'CO-062 validation rejects %j (incomplete or start not before end)', (value) => {
      expect(accepts(dateRangeValidationMask, value)).toBe(false);
    });
});

describe('CO-063 date transforms', () => {
  it('CO-063 converts dd/mm/yyyy to yyyymmdd and leaves years unchanged', () => {
    expect(dateTransformMask('31/12/2020')).toBe('20201231');
    expect(dateTransformMask('2020')).toBe('2020');
  });

  it('CO-063 converts a range into an array of transformed bounds', () => {
    expect(dateRangeTransformMask('01/01/1950-31/12/1960')).toEqual(['19500101', '19601231']);
    expect(dateRangeTransformMask('1950-1960')).toEqual(['1950', '1960']);
    expect(dateRangeTransformMask('01/02/1950')).toBe('19500201');
  });
});

describe('CO-064 age masks', () => {
  it.each(['', '0', '1', '9', '12', '99', '100', '139'])('CO-064 typing accepts the age %j', (value) => {
    expect(accepts(ageTypingMask, value)).toBe(true);
  });

  it.each(['01', '-1', 'a', '1000', '999'])('CO-064 typing rejects %j', (value) => {
    expect(accepts(ageTypingMask, value)).toBe(false);
  });

  it.each(['', '0', '9', '17', '99', '120', '139'])('CO-064 validation accepts the age %j', (value) => {
    expect(accepts(ageValidationMask, value)).toBe(true);
  });

  it.each(['00', '01', '1000', 'x'])('CO-064 validation rejects %j', (value) => {
    expect(accepts(ageValidationMask, value)).toBe(false);
  });

  // BUG: the age regexps use `[1-9]([0-9]|[0-3][0-9])`, so any three-digit
  // value whose second digit is 0-3 passes (200, 239, 939...). The intended
  // range (search form placeholder, inventory CO-064) is 0-139.
  it.fails('CO-064 BUG: rejects ages above 139 (e.g. 200, 939)', () => {
    expect(accepts(ageTypingMask, '200')).toBe(false);
    expect(accepts(ageValidationMask, '939')).toBe(false);
  });

  it('CO-064 range typing accepts an open range and rejects an invalid lower bound', () => {
    expect(accepts(ageRangeTypingMask, '20-')).toBe(true);
    expect(accepts(ageRangeTypingMask, '20-3')).toBe(true);
    expect(accepts(ageRangeTypingMask, '01-3')).toBe(false);
  });

  it('CO-064 range validation requires start < end', () => {
    expect(accepts(ageRangeValidationMask, '20-30')).toBe(true);
    expect(accepts(ageRangeValidationMask, '30-20')).toBe(false);
    expect(accepts(ageRangeValidationMask, '20-20')).toBe(false);
    expect(accepts(ageRangeValidationMask, '45')).toBe(true);
  });

  it('CO-064 range transform splits a range and keeps single values', () => {
    expect(ageRangeTransformMask('20-30')).toEqual(['20', '30']);
    expect(ageRangeTransformMask('20')).toBe('20');
    expect(ageRangeTransformMask(20)).toBe(20);
  });
});

describe('CO-065 sex masks', () => {
  it.each(['', 'F', 'M', 'H'])('CO-065 typing and validation accept %j', (value) => {
    expect(accepts(sexTypingMask, value)).toBe(true);
    expect(accepts(sexValidationMask, value)).toBe(true);
  });

  it.each(['f', 'X', 'FF', 'Femme'])('CO-065 typing and validation reject %j', (value) => {
    expect(accepts(sexTypingMask, value)).toBe(false);
    expect(accepts(sexValidationMask, value)).toBe(false);
  });

  it('CO-065 transform keeps the leading letter', () => {
    expect(sexTransformMask('Féminin')).toBe('F');
    expect(sexTransformMask('Masculin')).toBe('M');
    expect(sexTransformMask('x')).toBe('x');
  });
});

describe('CO-066 capitalize', () => {
  it('CO-066 upper-cases the first letter and lower-cases the rest', () => {
    expect(capitalize('dUPONT')).toBe('Dupont');
    expect(capitalize('jean')).toBe('Jean');
    expect(capitalize('')).toBe('');
  });
});

describe('CO-067 record-edit masks', () => {
  it('CO-067 removeDiacritics strips accents', () => {
    expect(removeDiacritics('Hélène Çàé')).toBe('Helene Cae');
  });

  it('CO-067 last name: accents removed, words capitalized, one invalid character dropped per keystroke', () => {
    expect(lastNameEditMask('de la fontaine', '')).toBe('De La Fontaine');
    expect(lastNameEditMask('dupont-éric', '')).toBe('Dupont-eric');
    expect(lastNameEditMask('dup0nt', '')).toBe('Dupnt');
    // the replace has no /g flag: only the first invalid character goes
    expect(lastNameEditMask('d1p2', '')).toBe('Dp2');
    expect(lastNameStringify('DUPONT')).toBe('Dupont');
    expect(lastNameParse('éric')).toBe('Eric');
  });

  it('CO-067 first names: parsed into capitalized words, stringified with a placeholder when empty', () => {
    expect(firstNameParse('jean, pierre;marie')).toEqual(['Jean', 'Pierre', 'Marie']);
    expect(firstNameEditMask('jean pierre', '')).toBe('Jean Pierre');
    expect(firstNameStringify(['Jean', 'Hélène'])).toBe('Jean Helene');
    expect(firstNameStringify('jean pierre')).toBe('Jean Pierre');
    expect(firstNameStringify('')).toBe('(sans prénom)');
    expect(firstNameStringify(undefined)).toBe('(sans prénom)');
  });

  it('CO-067 sex: edit mask, stringify and parse', () => {
    expect(sexEditMask('m', '')).toBe('Masculin');
    expect(sexEditMask('H', '')).toBe('Masculin');
    expect(sexEditMask('f', '')).toBe('Féminin');
    expect(sexEditMask('x', 'Masculin')).toBe('');
    expect(sexStringify('M')).toBe('Masculin');
    expect(sexStringify('F')).toBe('Féminin');
    expect(sexParse('homme')).toBe('M');
    expect(sexParse('Masculin')).toBe('M');
    expect(sexParse('Féminin')).toBe('F');
  });

  it('CO-067 date: edit mask keeps the old value on an impossible prefix, stringify/parse convert formats', () => {
    expect(dateEditMask('31/12', '31/1')).toBe('31/12');
    expect(dateEditMask('4', '3')).toBe('3');
    expect(dateStringify('20201231')).toBe('31/12/2020');
    expect(dateStringify('20201231', true)).toBe('2020');
    expect(dateParse('31/12/2020')).toBe('20201231');
  });

  it('CO-067 city and country: whitespace collapsed (first run), one invalid character dropped', () => {
    expect(cityEditMask('Saint  Denis')).toBe('Saint Denis');
    expect(cityEditMask("L'Haÿ-les-Roses")).toBe("L'Haÿ-les-Roses");
    expect(cityEditMask('Paris1')).toBe('Paris');
    expect(countryEditMask).toBe(cityEditMask);
  });

  it('CO-067 country code: up to 3 letters, upper-cased, else old value', () => {
    expect(countryCodeEditMask('fr', '')).toBe('FR');
    expect(countryCodeEditMask('fra', 'FR')).toBe('FRA');
    expect(countryCodeEditMask('fran', 'FRA')).toBe('FRA');
    expect(countryCodeEditMask('f1', 'F')).toBe('F');
  });

  it('CO-067 location code: INSEE commune codes incl. Corsica, else old value', () => {
    expect(locationCodeEditMask('2a004', '')).toBe('2A004');
    expect(locationCodeEditMask('75056', '')).toBe('75056');
    expect(locationCodeEditMask('750567', '75056')).toBe('75056');
    expect(locationCodeEditMask('x', '')).toBe('');
  });

  it('CO-067 department code: 2 chars (incl. 2A/2B) or 97x overseas, else old value', () => {
    expect(departmentCodeEditMask('33', '')).toBe('33');
    expect(departmentCodeEditMask('2b', '')).toBe('2B');
    expect(departmentCodeEditMask('974', '')).toBe('974');
    expect(departmentCodeEditMask('123', '12')).toBe('12');
  });
});

describe('CO-068 dateStringify with a number', () => {
  // BUG: masks.js:133 references the undefined identifier `dateSring`
  // (typo of `dateString`), so a numeric date throws a ReferenceError.
  it.fails('CO-068 BUG: formats a numeric yyyymmdd date', () => {
    expect(dateStringify(20201231)).toBe('31/12/2020');
  });

  it('CO-068 currently throws a ReferenceError on a numeric date', () => {
    expect(() => dateStringify(20201231)).toThrow(ReferenceError);
  });
});
