import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// The sample table (file reading) is covered by LinkSampleTable.test.js.
vi.mock('../../../src/components/views/LinkSampleTable.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('LinkSampleTable') }));
vi.mock('../../../src/components/views/GedcomTree.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('GedcomTree') }));

const { stubProps, stubText } = await import('./stubs/index.js');
const { default: LinkConfigure } = await import('../../../src/components/views/LinkConfigure.svelte');
const { default: LinkField } = await import('../../../src/components/views/LinkField.svelte');
const { user, linkStep, linkMapping, linkOptions, linkSourceHeaderTypes } = await import('../../../src/components/tools/stores.js');
const { resetLinkStores, makeDataTransfer, flush } = await import('./helpers.js');

const input = (name) => inputs().find(i => i.getAttribute('name') === name);
const inputs = () => [...document.querySelectorAll('input[list="LinkSampleTable"]')];
const fieldGroup = (name) => input(name).closest('.rf-input-group');
const valider = () => screen.queryByRole('button', { name: 'Valider' });

const types = {
  nom: { type: 'lastName', format: false, freq: 1 },
  prenom: { type: 'firstName', format: false, freq: 1 },
  naissance: { type: 'date', format: 'yyyy-MM-dd', freq: 1 },
  ville: { type: 'city', format: false, freq: 1 }
};

const dropColumn = async (name, payload) => {
  const dataTransfer = makeDataTransfer({ data: { 'text/plain': JSON.stringify(payload) } });
  const event = createEvent.drop(fieldGroup(name), { dataTransfer });
  await fireEvent(fieldGroup(name), event);
  return event;
};

const typeColumn = async (name, value) => {
  await fireEvent.input(input(name), { target: { value } });
};

describe('LinkConfigure / LinkFields / LinkField', () => {
  beforeEach(() => {
    resetLinkStores();
    linkStep.set(2);
    stubProps.length = 0;
  });

  it('LK-051 renders the 15 target fields in groups with the instructions', () => {
    render(LinkConfigure);
    expect(inputs()).toHaveLength(15);
    expect(inputs().map(i => i.getAttribute('name'))).toEqual([
      'Nom', 'Nom&nbsp;d\'usage', 'Prénom(s)', 'Sexe',
      'Date', 'Département', 'Pays', 'Commune', 'Code&nbsp;INSEE', 'Code&nbsp;Postal',
      'Date', 'Après&nbsp;le&nbsp;(date)', 'Département', 'Code&nbsp;INSEE', 'Code&nbsp;Postal'
    ]);
    expect(document.body.textContent).toContain('Choisissez les champs à apparier:');
    expect(document.body.textContent).toContain('cliquez dessus pour supprimer l\'association');
    expect(document.body.textContent).toContain('glissez-collez une colonne du bas sur un champ ci-contre');
  });

  it('LK-066 renders the groups in first-appearance order with headings', () => {
    render(LinkConfigure);
    const headings = [...document.querySelectorAll('.rf-col-12.rf-margin-top-2N.rf-padding-left-4px strong')]
      .map(s => s.textContent.trim());
    expect(headings).toEqual(['Naissance', 'Décès']);
    // ungrouped fields come first, without heading
    const container = inputs()[0].closest('.rf-grid-row');
    expect(container.firstElementChild.querySelector('input').getAttribute('name')).toBe('Nom');
  });

  it('LK-071 shows the placeholder "non associé" on every field', () => {
    render(LinkConfigure);
    expect(inputs().every(i => i.getAttribute('placeholder') === 'non associé')).toBe(true);
  });

  it('LK-052 auto-maps the first unmapped column of the matching guessed type to each field', async () => {
    render(LinkConfigure);
    linkSourceHeaderTypes.set(structuredClone(types));
    await flush();
    expect(input('Nom').value).toBe('nom');
    // the column is consumed by the first field of that type
    expect(input('Nom&nbsp;d\'usage').value).toBe('');
    expect(input('Prénom(s)').value).toBe('prenom');
    expect(inputs()[4].value).toBe('naissance'); // birth date
    expect(input('Commune').value).toBe('ville');
    expect(get(linkSourceHeaderTypes).nom.mapped.field).toBe('lastName');
  });

  it('LK-052 pins the tie-break: with two columns of the same type the first one wins (number vs string compare)', async () => {
    render(LinkConfigure);
    linkSourceHeaderTypes.set({
      nom1: { type: 'lastName', format: false, freq: 1 },
      nom2: { type: 'lastName', format: false, freq: 1 }
    });
    await flush();
    expect(input('Nom').value).toBe('nom1');
    expect(input('Nom&nbsp;d\'usage').value).toBe('nom2');
  });

  it('LK-053 sets the date format option from the guessed birth date format', async () => {
    linkOptions.update(o => ({ ...o, csv: { sep: ';' } }));
    render(LinkConfigure);
    linkSourceHeaderTypes.set(structuredClone(types));
    await flush();
    expect(get(linkOptions).csv.dateFormat).toBe('yyyy-MM-dd');
  });

  it('LK-053 keeps an explicit date format', async () => {
    linkOptions.update(o => ({ ...o, csv: { sep: ';', dateFormat: 'dd/MM/yyyy' } }));
    render(LinkConfigure);
    linkSourceHeaderTypes.set(structuredClone(types));
    await flush();
    expect(get(linkOptions).csv.dateFormat).toBe('dd/MM/yyyy');
  });

  it('LK-054 asks for at least 3 fields: "(aucun champ sélectionné)" then "(N champ(s) sélectionné(s))"', async () => {
    render(LinkConfigure);
    expect(document.body.textContent).toMatch(/Vous devez choisir au minimum 3 champs à apparier\s+\(aucun champ sélectionné\)/);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    expect(document.body.textContent).toMatch(/Vous devez choisir au minimum 3 champs à apparier\s+\(2 champ\(s\) sélectionné\(s\)\)/);
    await typeColumn('Sexe', 'sexe');
    expect(document.body.textContent).not.toContain('Vous devez choisir au minimum');
  });

  it('LK-055 shows the non-blocking warning for unrecognised column contents', async () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    await dropColumn('Nom', { col: 'ville', type: 'city' });
    await flush();
    const warning = document.querySelector('p.rf-color--rm');
    expect(warning.textContent).toContain('Le contenu des colonnes suivantes n\'est pas reconnu :');
    expect(warning.textContent).toContain('Nom (ville)');
    expect(warning.textContent).toContain('ceci n\'est pas bloquant pour le traitement');
    await typeColumn('Prénom(s)', 'prenom');
    await typeColumn('Sexe', 'sexe');
    expect(valider().disabled).toBe(false);
  });

  it('LK-056 a non-date column dropped on a date field shows the blocking date warning and disables Valider', async () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    await typeColumn('Sexe', 'sexe');
    expect(valider().disabled).toBe(false);
    const birthDate = inputs()[4];
    const dataTransfer = makeDataTransfer({ data: { 'text/plain': JSON.stringify({ col: 'ville', type: 'city' }) } });
    await fireEvent.drop(birthDate.closest('.rf-input-group'), { dataTransfer });
    expect(document.body.textContent).toContain('le champ date ne supporte que les format JJ/MM/AAAA, JJ-MM-AAAA, AAAA/MM/JJ et AAAA-MM-JJ');
    expect(valider().disabled).toBe(true);
  });

  it('LK-057 not logged in: RGPD message and the inline LoginField instead of Valider', () => {
    render(LinkConfigure);
    expect(document.body.textContent).toContain('Pour des raisons de traçabilité et conformité RGPD');
    expect(document.body.textContent).toContain('vous devez être identifié pour effectuer un appariement.');
    expect(valider()).toBeNull();
    expect(document.querySelector('input#email[type="email"]')).not.toBeNull();
    expect(screen.getByTitle('Valider le courriel')).toBeTruthy();
  });

  it('LK-058 logged in but form incomplete: "Vous êtes identifié(e)" and a disabled Valider', () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    const ok = [...document.querySelectorAll('span.rf-text--sm')].find(s => s.textContent.includes('Vous êtes identifié(e)'));
    expect(ok.textContent.trim()).toBe('Vous êtes identifié(e)');
    expect(valider().disabled).toBe(true);
    expect(document.querySelector('input#email')).toBeNull();
  });

  it('LK-059 logged in and valid: "Vous êtes identifié(e), vous pouvez poursuivre l\'appariement"', async () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    await typeColumn('Sexe', 'sexe');
    expect(document.body.textContent).toContain('Vous êtes identifié(e), vous pouvez poursuivre l\'appariement');
  });

  it('LK-060 Valider is disabled with < 3 fields, a blocking warning, or no user', async () => {
    linkSourceHeaderTypes.set({});
    render(LinkConfigure);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    await typeColumn('Sexe', 'sexe');
    expect(valider()).toBeNull(); // no user: no button at all
    user.set('bob@example.org');
    await flush();
    expect(valider().disabled).toBe(false);
    await fireEvent.click(fieldGroup('Sexe'));
    expect(valider().disabled).toBe(true);
  });

  it('LK-061 Valider saves $linkMapping and moves to step 3', async () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    await typeColumn('Sexe', 'sexe');
    await fireEvent.click(valider());
    expect(get(linkStep)).toBe(3);
    expect(get(linkMapping)).toEqual({
      direct: { nom: 'lastName', prenom: 'firstName', sexe: 'sex' },
      reverse: { lastName: 'nom', firstName: 'prenom', sex: 'sexe' }
    });
  });

  it('LK-062 Valider is also triggered by any keydown on the button', async () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    await typeColumn('Sexe', 'sexe');
    await fireEvent.keyDown(valider(), { key: 'a' });
    expect(get(linkStep)).toBe(3);
  });

  it('LK-063 the Options gear is shown only with csv options and toggles the csv + api options panel', async () => {
    const { unmount } = render(LinkConfigure);
    expect(document.querySelector('a[href="#options"]')).toBeNull();
    unmount();
    linkOptions.update(o => ({ ...o, csv: { sep: ';', encoding: 'utf8', skipLines: 0 } }));
    render(LinkConfigure);
    const gear = document.querySelector('a[href="#options"]');
    expect(gear.getAttribute('aria-label')).toBe('Options');
    expect(document.body.textContent).not.toContain('Formattage du fichier');
    await fireEvent.click(gear.closest('span'));
    expect(document.body.textContent).toContain('Formattage du fichier');
    expect(document.body.textContent).toContain('Paramètres de l\'algorithme');
    expect(document.body.textContent).not.toContain('Paramètres de validation');
    await fireEvent.click(document.querySelector('a[href="#options"]').closest('span'));
    expect(document.body.textContent).not.toContain('Formattage du fichier');
  });

  it('LK-064 shows the GedcomTree for a Gedcom input', async () => {
    render(LinkConfigure);
    expect(stubProps.map(p => p.name)).not.toContain('GedcomTree');
    const tree = { '@i1@': { name: 'Jean /Dupont/' } };
    linkOptions.update(o => ({ ...o, csv: { sep: '\t', type: 'gedcom', gedcom: tree } }));
    await flush();
    expect(stubText()).toContain('GedcomTree');
    expect(stubProps.find(p => p.name === 'GedcomTree').props.gedcom).toBe(tree);
  });

  it('LK-065 builds the mapping with direct/reverse keys, splitting deathDate and lastSeenAliveDate', async () => {
    user.set('bob@example.org');
    render(LinkConfigure);
    await typeColumn('Nom', 'nom');
    await typeColumn('Prénom(s)', 'prenom');
    const deathDate = inputs()[10];
    const lastSeen = inputs()[11];
    await fireEvent.input(deathDate, { target: { value: 'deces' } });
    await fireEvent.input(lastSeen, { target: { value: 'vu' } });
    await fireEvent.click(valider());
    expect(get(linkMapping)).toEqual({
      direct: { nom: 'lastName', prenom: 'firstName', deces: 'deathDate', vu: 'deathDate' },
      reverse: { lastName: 'nom', firstName: 'prenom', deathDate: 'deces', lastSeenAliveDate: 'vu' }
    });
  });

  it('LK-067 typing a column name in a field maps it', async () => {
    render(LinkConfigure);
    await typeColumn('Prénom(s)', 'firstnameLabel');
    expect(input('Prénom(s)').value).toBe('firstnameLabel');
    expect(input('Prénom(s)').getAttribute('list')).toBe('LinkSampleTable');
    expect(document.body.textContent).toContain('(1 champ(s) sélectionné(s))');
  });

  it('LK-068 dropping a column on a field maps it, without warning when the type matches', async () => {
    render(LinkConfigure);
    const event = await dropColumn('Nom', { col: 'nom', type: 'lastName', format: false, freq: 1 });
    expect(event.defaultPrevented).toBe(true);
    expect(input('Nom').value).toBe('nom');
    expect(fieldGroup('Nom').classList.contains('rf-input-group--valid')).toBe(true);
    expect(fieldGroup('Nom').classList.contains('rf-input-group--error')).toBe(false);
  });

  it('LK-068 dropping a column whose guessed type differs flags the field with a warning', async () => {
    render(LinkConfigure);
    await dropColumn('Nom', { col: 'ville', type: 'city' });
    expect(input('Nom').value).toBe('ville');
    expect(fieldGroup('Nom').classList.contains('rf-input-group--error')).toBe(true);
  });

  it('LK-069 field visual state: valid (check icon, green), error (alert), hover highlight', async () => {
    render(LinkConfigure);
    const nom = fieldGroup('Nom');
    expect(nom.querySelector('span.rf-fi-check-line')).toBeNull();
    await typeColumn('Nom', 'nom');
    expect(nom.classList.contains('rf-input-group--valid')).toBe(true);
    expect(nom.querySelector('span.rf-fi-check-line')).not.toBeNull();
    expect(input('Nom').classList.contains('rf-input--valid')).toBe(true);
    await dropColumn('Nom', { col: 'ville', type: 'city' });
    expect(nom.querySelector('span.rf-fi-alert-line')).not.toBeNull();
    expect(nom.classList.contains('rf-input-group--valid')).toBe(false);
    const sexe = fieldGroup('Sexe');
    const over = createEvent.dragOver(sexe);
    await fireEvent(sexe, over);
    // the field accepts the drop: its dragover default action is cancelled
    expect(over.defaultPrevented).toBe(true);
    expect(sexe.classList.contains('hovering')).toBe(true);
    expect(sexe.classList.contains('rf-background--hovering')).toBe(true);
    await fireEvent.dragLeave(sexe);
    expect(sexe.classList.contains('hovering')).toBe(false);
  });

  it('LK-070 a click anywhere on a field clears the association and frees the column', async () => {
    render(LinkConfigure);
    linkSourceHeaderTypes.set(structuredClone(types));
    await flush();
    expect(input('Nom').value).toBe('nom');
    await fireEvent.click(fieldGroup('Nom'));
    expect(input('Nom').value).toBe('');
    expect(fieldGroup('Nom').classList.contains('rf-input-group--valid')).toBe(false);
  });

  // BUG: freeing the column re-triggers the auto-mapping, which immediately
  // assigns it to the next field of the same type ("Nom d'usage"): a wrong
  // automatic association cannot be removed, it moves to another field.
  it.fails('LK-070 a cleared column stays free (not re-assigned to another field)', async () => {
    render(LinkConfigure);
    linkSourceHeaderTypes.set(structuredClone(types));
    await flush();
    await fireEvent.click(fieldGroup('Nom'));
    await flush();
    expect(get(linkSourceHeaderTypes).nom.mapped).toBeUndefined();
    expect(inputs().map(i => i.value)).not.toContain('nom');
  });

  it('LK-070 clearing also removes the warning of a field', async () => {
    const field = { group: '', label: 'Nom', field: 'lastName', type: 'lastName', mapTo: 'ville', warning: true };
    const { container } = render(LinkField, { field });
    const group = container.querySelector('.rf-input-group');
    expect(group.classList.contains('rf-input-group--error')).toBe(true);
    linkSourceHeaderTypes.set({});
    await fireEvent.click(group);
    expect(group.classList.contains('rf-input-group--error')).toBe(false);
    expect(container.querySelector('input').value).toBe('');
  });
});
