import { readFileSync, writeFileSync } from 'fs';
import { Person } from './models/entities';

const loadAnonymizedIds = (): Set<string> => {
  try {
    const raw = JSON.parse(readFileSync(`${process.env.ANONYMIZED_IDS}`, 'utf8'));
    return new Set<string>(raw);
  } catch {
    return new Set();
  }
};

export const anonymizedIds = loadAnonymizedIds();

const persist = (): void => {
  if (!process.env.ANONYMIZED_IDS) return;
  writeFileSync(process.env.ANONYMIZED_IDS, JSON.stringify([...anonymizedIds]), 'utf8');
};

export const listAnonymizedIds = (): string[] => [...anonymizedIds];

export const addAnonymizedId = (id: string): boolean => {
  if (anonymizedIds.has(id)) return false;
  anonymizedIds.add(id);
  persist();
  return true;
};

export const removeAnonymizedId = (id: string): boolean => {
  if (!anonymizedIds.has(id)) return false;
  anonymizedIds.delete(id);
  persist();
  return true;
};

export const replaceAnonymizedId = (oldId: string, newId: string): boolean => {
  if (!anonymizedIds.has(oldId)) return false;
  anonymizedIds.delete(oldId);
  anonymizedIds.add(newId);
  persist();
  return true;
};

export const anonymizeAuthor = (author: string): string => {
  if (!author) return '';
  const local = author.replace(/@.*/, '');
  const domain = author.replace(/.*@/, '');
  return `${author.substring(0, 2)}...${local.substring(local.length - 2)}@${domain}`;
};

// Truncate YYYYMMDD to YYYYMM00 — removes day-level precision
const truncateDate = (date: string): string =>
  date && date.length >= 6 ? `${date.substring(0, 6)}00` : date;

export const anonymizePerson = (person: Person): Person => {
  if (person.birth?.date) person.birth.date = truncateDate(person.birth.date);
  if (person.death?.date) person.death.date = truncateDate(person.death.date);

  if (person.birth?.location) {
    delete person.birth.location.latitude;
    delete person.birth.location.longitude;
  }
  if (person.death?.location) {
    delete person.death.location.latitude;
    delete person.death.location.longitude;
  }

  // Strip internal references not needed by API consumers
  delete person.sourceLine;
  if (person.death) delete (person.death as any).certificateId;

  if (person.modifications) {
    person.modifications = person.modifications.map((mod: any) => ({
      ...mod,
      author: anonymizeAuthor(mod.author),
    }));
  }

  return person;
};
