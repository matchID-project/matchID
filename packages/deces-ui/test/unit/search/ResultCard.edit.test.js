import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import axios from 'axios';
import { collectWindowErrors, iconMarkup, mockFetch, person, resetSearchStores } from './helpers.js';

// Correction proposals and their administration (alpha features: enabled in
// the unit tests, where __THEME_DNUM__ is 0).
const { default: ResultCard } = await import('../../../src/components/views/ResultCard.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { icons } = await import('../../../src/components/tools/icons.js');

const cell = (container, table, label) => {
  const th = [...container.querySelectorAll('th[scope="colgroup"]')].find(t => t.textContent === table);
  const row = [...th.closest('table').querySelectorAll('tbody tr')].find(tr => tr.querySelector('td').textContent.trim() === label);
  return row && row.querySelectorAll('td')[1];
};
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const expanded = (result = person(), props = {}) => render(ResultCard, { result, index: 1, forceExpand: true, ...props });

const startEdit = async (result) => {
  const view = expanded(result);
  await fireEvent.click(screen.getByTitle('Proposer une correction'));
  return view;
};

// Hover a cell, type in its input(s) and leave it.
const editCell = async (container, table, label, values) => {
  const td = cell(container, table, label);
  await fireEvent.mouseEnter(td);
  const inputs = [...td.querySelectorAll('input')];
  for (const [i, value] of values.entries()) {
    await fireEvent.input(inputs[i], { target: { value } });
  }
  await fireEvent.mouseLeave(td);
  return td;
};

// "Charger un fichier" builds a hidden <input type=file> and clicks it.
const chooseFile = async (file) => {
  const originalCreate = document.createElement.bind(document);
  let picker;
  const create = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const el = originalCreate(tag, options);
    if (tag === 'input') {
      picker = el;
      vi.spyOn(el, 'click').mockImplementation(() => {});
    }
    return el;
  });
  await fireEvent.click(screen.getByTitle('Charger un fichier au format PDF'));
  create.mockRestore();
  expect(picker.type).toBe('file');
  expect(picker.click).toHaveBeenCalled();
  picker.onchange({ target: { files: [file] } });
};

const pdf = (name = 'acte-de-deces-dupont.pdf') => new File(['%PDF-1.4 fake'], name, { type: 'application/pdf' });

const modification = (overrides = {}) => ({
  id: 'm1',
  auth: 0,
  fields: { lastName: 'Durand' },
  proof: 'proof-m1.pdf',
  author: 'jo...hn@example.org',
  date: '2024-01-02T10:11:12.000Z',
  message: 'merci de corriger',
  ...overrides
});

describe('ResultCard corrections (alpha)', () => {
  let fetchMock;
  beforeEach(() => {
    resetSearchStores(stores);
    stores.route.set({ path: '/search' });
    stores.admin.set(false);
    stores.user.set(undefined);
    stores.accessToken.set('token-edit');
    fetchMock = mockFetch();
  });

  describe('proposal by a user', () => {
    it('SR-129 "Proposer une correction" toggles the edit mode', async () => {
      expanded();
      const button = screen.getByTitle('Proposer une correction');
      expect(text(button)).toBe('Proposer une correction');
      await fireEvent.click(button);
      expect(screen.getByText(/Vous pouver maintenant éditer les champs ci-dessous/)).toBeTruthy();
      await waitFor(() => expect(screen.queryByTitle('Proposer une correction')).toBeNull());
    });

    it('SR-130 the button is disabled with "Correction en cours de validation" while a modification is waiting', () => {
      expanded(person({ modifications: [modification()] }));
      const button = screen.getByTitle('Une modification est déjà en attende de validation');
      expect(button.disabled).toBe(true);
      expect(text(button)).toBe('Correction en cours de validation');
    });

    it('SR-131 editListMode labels it "Proposer une nouvelle correction"', () => {
      expanded(person(), { editListMode: true });
      expect(text(screen.getByTitle('Proposer une nouvelle correction'))).toBe('Proposer une nouvelle correction');
    });

    it('SR-132 shows the edit banner in edit mode', async () => {
      await startEdit();
      expect(screen.getByText('Vous pouver maintenant éditer les champs ci-dessous :')).toBeTruthy();
    });

    it('SR-133 hovering an editable cell shows its prefilled, focused input(s)', async () => {
      const { container } = await startEdit();
      const nom = cell(container, 'Naissance', 'Nom');
      await fireEvent.mouseEnter(nom);
      const input = nom.querySelector('input');
      expect(input.id).toBe('lastName');
      expect(input.value).toBe('Dupont');
      expect(document.activeElement).toBe(input);
      const commune = cell(container, 'Naissance', 'Commune');
      await fireEvent.mouseEnter(commune);
      expect([...commune.querySelectorAll('input')].map(i => [i.id, i.value])).toEqual([['birthCity', 'Eysines'], ['birthLocationCode', '33162']]);
    });

    it('SR-133 cells are not editable outside the edit mode', async () => {
      const { container } = expanded();
      const nom = cell(container, 'Naissance', 'Nom');
      await fireEvent.mouseEnter(nom);
      expect(nom.querySelector('input')).toBeNull();
    });

    it('SR-134 Age, Acte n° and Source are not editable', async () => {
      stores.dataGouvCatalog.set({ '2020-m01': '/data.gouv.fr/x' });
      const { container } = await startEdit();
      const caught = collectWindowErrors();
      try {
        for (const label of ['Age', 'Acte n°', 'Source INSEE']) {
          const td = cell(container, 'Décès', label);
          await fireEvent.mouseEnter(td);
          expect(td.querySelector('input')).toBeNull();
          await fireEvent.mouseLeave(td);
        }
      } finally {
        caught.stop();
        stores.dataGouvCatalog.set(null);
      }
    });

    // BUG: in edit mode, hovering a non-editable cell (Age, Acte n°, Source)
    // calls setEditInputValue(field) / updateEditValue(field) although the
    // field has no `update` list (ResultCard.svelte:176-182, 946, 951):
    // "Cannot read properties of undefined (reading 'forEach')" on every
    // mouseenter/mouseleave.
    it.fails('SR-134 hovering a non-editable cell in edit mode throws no error', async () => {
      const { container } = await startEdit();
      const caught = collectWindowErrors();
      try {
        const td = cell(container, 'Décès', 'Age');
        await fireEvent.mouseEnter(td);
        await fireEvent.mouseLeave(td);
      } finally {
        caught.stop();
      }
      expect(caught.errors).toEqual([]);
    });

    it('SR-135 edit inputs apply the per-field masks', async () => {
      const { container } = await startEdit();
      const typeIn = async (label, table, value) => {
        const td = cell(container, table, label);
        await fireEvent.mouseEnter(td);
        const input = td.querySelector('input');
        await fireEvent.input(input, { target: { value } });
        const result = input.value;
        await fireEvent.mouseLeave(td);
        return result;
      };
      expect(await typeIn('Nom', 'Naissance', 'durand2')).toBe('Durand');
      expect(await typeIn('Sexe', 'Naissance', 'f')).toBe('Féminin');
      expect(await typeIn('Date', 'Naissance', '03/1x')).toBe('03/10/1932');
      expect(await typeIn('Département', 'Décès', '2a')).toBe('2A');
      expect(await typeIn('Département', 'Naissance', '123')).toBe('33');
    });

    it('SR-136 leaving a cell stores the change and shows the struck old value with the new one', async () => {
      const { container } = await startEdit();
      const td = await editCell(container, 'Naissance', 'Nom', ['Durand']);
      expect(td.querySelector('strike').textContent).toBe('Dupont');
      expect(text(td)).toBe('Dupont Durand');
    });

    it('SR-137 restoring the original value removes the change', async () => {
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const td = await editCell(container, 'Naissance', 'Nom', ['Dupont']);
      expect(td.querySelector('strike')).toBeNull();
      expect(text(td)).toBe('Dupont');
    });

    it('SR-138 shows the message textarea (max 200) once a change exists', async () => {
      const { container } = await startEdit();
      expect(container.querySelector('textarea')).toBeNull();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      expect(container.querySelector('textarea').getAttribute('maxlength')).toBe('200');
      expect(screen.getByText('Transmettre un message')).toBeTruthy();
    });

    it('SR-139 the PDF requirement turns red when the chosen file is not a PDF', async () => {
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      expect(container.querySelector('span.rf-color--rm strong')).toBeNull();
      await chooseFile(new File(['hello world'], 'notes.txt', { type: 'text/plain' }));
      await waitFor(() => expect(container.querySelector('span.rf-color--rm strong').textContent).toBe('au format PDF'));
    });

    it('SR-140 asks for an email when the user is not logged in', async () => {
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      expect(screen.getByText(/Un courriel est demandé pour enregistrer votre demande/)).toBeTruthy();
      stores.user.set('john@example.org');
      await waitFor(() => expect(screen.queryByText(/Un courriel est demandé/)).toBeNull());
    });

    it('SR-141 the proof URL is validated on blur (http(s) regex + CORS fetch) with check/alert icons', async () => {
      fetchMock.mockImplementation(async (url) => new Response('', { status: `${url}`.includes('missing') ? 404 : 200 }));
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const url = document.getElementById('editUrl');
      const group = url.closest('.rf-input-group');
      const icon = () => container.querySelector('label[for="editUrl"] span');
      await fireEvent.input(url, { target: { value: 'not a url' } });
      await fireEvent.blur(url);
      await waitFor(() => expect(group.className).toContain('rf-input-group--error'));
      expect(icon().className).toContain('rf-fi-alert-line');
      await fireEvent.focus(url);
      await fireEvent.input(url, { target: { value: 'https://archives.example.org/missing' } });
      await fireEvent.blur(url);
      await waitFor(() => expect(group.className).toContain('rf-input-group--error'));
      expect(fetchMock).toHaveBeenCalledWith('https://archives.example.org/missing', { mode: 'cors' });
      await fireEvent.focus(url);
      await fireEvent.input(url, { target: { value: 'https://archives.example.org/acte' } });
      await fireEvent.blur(url);
      await waitFor(() => expect(group.className).toContain('rf-input-group--valid'));
      expect(icon().className).toContain('rf-fi-check-line');
      expect(url.className).toContain('rf-input--valid');
    });

    it('SR-142 focusing the proof URL resets its state; it is disabled once a file is chosen', async () => {
      fetchMock.mockImplementation(async () => new Response('', { status: 200 }));
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const url = document.getElementById('editUrl');
      await fireEvent.input(url, { target: { value: 'bad' } });
      await fireEvent.blur(url);
      await waitFor(() => expect(url.closest('.rf-input-group').className).toContain('rf-input-group--error'));
      await fireEvent.focus(url);
      expect(url.closest('.rf-input-group').className).not.toContain('rf-input-group--error');
      await fireEvent.input(url, { target: { value: '' } });
      await chooseFile(pdf());
      await waitFor(() => expect(url.disabled).toBe(true));
    });

    it('SR-143 "Charger un fichier" opens a file picker and is disabled once the URL is valid', async () => {
      fetchMock.mockImplementation(async () => new Response('', { status: 200 }));
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const button = screen.getByTitle('Charger un fichier au format PDF');
      expect(text(button)).toBe('Charger un fichier');
      expect(button.disabled).toBe(false);
      const url = document.getElementById('editUrl');
      await fireEvent.input(url, { target: { value: 'https://archives.example.org/acte' } });
      await fireEvent.blur(url);
      await waitFor(() => expect(button.disabled).toBe(true));
    });

    it('SR-144 a file is validated by its %PDF magic number; the label shows its ellipsised name or "PDF uniquement"', async () => {
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const button = () => screen.getByTitle('Charger un fichier au format PDF');
      await chooseFile(new File(['GIF89a'], 'image.pdf', { type: 'application/pdf' }));
      await waitFor(() => expect(text(button())).toBe('PDF uniquement'));
      expect(button().innerHTML).toContain(iconMarkup(icons, 'ri:alert-line'));
      await chooseFile(pdf('acte-de-deces-dupont.pdf'));
      await waitFor(() => expect(text(button())).toBe('acte-de...ont.pdf'));
      expect(button().innerHTML).toContain(iconMarkup(icons, 'ri:check-line'));
      await chooseFile(pdf('acte.pdf'));
      await waitFor(() => expect(text(button())).toBe('acte.pdf'));
    });

    it('SR-145 embeds the login (email) field in the edit form', async () => {
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      expect(screen.getByLabelText('Courriel').type).toBe('email');
      expect(screen.getByTitle('Valider le courriel')).toBeTruthy();
    });

    it('SR-146 "Annuler" (no valid proof) resets the edit state', async () => {
      const { container } = await startEdit();
      const td = await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const cancel = screen.getByTitle('Annuler');
      await fireEvent.click(cancel);
      await waitFor(() => expect(screen.queryByText(/Vous pouver maintenant éditer/)).toBeNull());
      expect(td.querySelector('strike')).toBeNull();
      expect(screen.getByTitle('Proposer une correction')).toBeTruthy();
    });

    it('SR-147 "Transmettre" posts the changes, message and proof to /id/<id> with the bearer token', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      fetchMock.mockImplementation(async () => new Response('', { status: 200 }));
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      await editCell(container, 'Naissance', 'Sexe', ['f']);
      await fireEvent.input(container.querySelector('textarea'), { target: { value: 'acte joint' } });
      const url = document.getElementById('editUrl');
      await fireEvent.input(url, { target: { value: 'https://archives.example.org/acte' } });
      await fireEvent.blur(url);
      await waitFor(() => expect(screen.getByTitle('Transmettre')).toBeTruthy());
      await fireEvent.click(screen.getByTitle('Transmettre'));
      expect(post).toHaveBeenCalledTimes(1);
      const [endpoint, formData, config] = post.mock.calls[0];
      expect(endpoint).toBe('/deces/api/v1/id/ba7582a6344757e6');
      expect(Object.fromEntries(formData.entries())).toEqual({
        lastName: 'Durand', sex: 'F', message: 'acte joint', proof: 'https://archives.example.org/acte'
      });
      expect(config).toEqual({ headers: { Authorization: 'Bearer token-edit' } });
    });

    it('SR-147 a valid PDF file is sent as the proof', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      const file = pdf();
      await chooseFile(file);
      await waitFor(() => expect(screen.getByTitle('Transmettre')).toBeTruthy());
      await fireEvent.click(screen.getByTitle('Transmettre'));
      expect(post.mock.calls[0][1].get('proof')).toBeInstanceOf(File);
      expect(post.mock.calls[0][1].get('proof').name).toBe(file.name);
    });

    it('SR-148 the submit button shows a spinner, then a check (success, disabled) or an alert (failure)', async () => {
      let resolvePost;
      vi.spyOn(axios, 'post').mockImplementation(() => new Promise(resolve => { resolvePost = resolve; }));
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      await chooseFile(pdf());
      const submit = await screen.findByTitle('Transmettre');
      await fireEvent.click(submit);
      await waitFor(() => expect(submit.querySelector('.spin')).not.toBeNull());
      resolvePost({ data: {} });
      await waitFor(() => expect(submit.querySelector('.spin')).toBeNull());
      expect(submit.innerHTML).toContain(iconMarkup(icons, 'ri:check-line'));
      expect(submit.disabled).toBe(true);
    });

    it('SR-148 a failed submission shows the alert icon', async () => {
      vi.spyOn(axios, 'post').mockRejectedValue(new Error('500'));
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      await chooseFile(pdf());
      const submit = await screen.findByTitle('Transmettre');
      await fireEvent.click(submit);
      await waitFor(() => expect(submit.innerHTML).toContain(iconMarkup(icons, 'ri:alert-line')));
      expect(submit.disabled).toBe(false);
    });

    it('SR-149 a successful non-admin submission thanks the user', async () => {
      vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      const { container } = await startEdit();
      await editCell(container, 'Naissance', 'Nom', ['Durand']);
      await chooseFile(pdf());
      await fireEvent.click(await screen.findByTitle('Transmettre'));
      expect(await screen.findByText('Merci !')).toBeTruthy();
      expect(screen.getByText(/Votre suggestion doit être examinée par un\s+administrateur/)).toBeTruthy();
    });
  });

  describe('history and consolidated view', () => {
    const history = () => [
      modification({ id: 'm1', auth: 1, author: 'john@example.org', fields: { lastName: 'Durand' }, message: 'mon message', review: { date: '2024-01-05T08:00:00Z', message: 'ok' } }),
      modification({ id: 'm2', auth: -1, author: 'other@example.org', fields: { firstName: 'Paul' }, proof: 'https://archives.example.org/acte', message: 'secret', review: { date: '2024-01-06T08:00:00Z', message: 'review secret' } }),
      modification({ id: 'm3', auth: -2, author: 'john@example.org', fields: { sex: 'F' }, message: '', date: '2024-02-01T10:00:00Z' }),
      modification({ id: 'm4', auth: 0, author: 'john@example.org', fields: { birthDate: '19321004' }, message: '', date: '2024-03-01T10:00:00Z' })
    ];

    it('SR-150 the author sees the history: proof link, fields, date, "(autre utilisateur)" and only their own messages', async () => {
      stores.user.set('john@example.org');
      const { container } = expanded(person({ modifications: history() }));
      expect(screen.getByText(/Nous vous remercions pour votre contribution/)).toBeTruthy();
      const rows = [...container.querySelectorAll('table:not(:has(th[scope="colgroup"])) tbody tr')];
      expect(rows).toHaveLength(4);
      expect(text(rows[0].querySelector('td'))).toBe('Nom: Durand 2024-01-02 message: mon message');
      expect(text(rows[1].querySelector('td'))).toBe('Prénom(s): Paul 2024-01-02 (autre utilisateur)');
      expect(rows[0].querySelector('a').getAttribute('href')).toBe('/deces/api/v1/updates/proof/ba7582a6344757e6-m1');
      expect(rows[1].querySelector('a').getAttribute('href')).toBe('https://archives.example.org/acte');
      await fireEvent.click(rows[1].querySelector('a'));
      expect(get(stores.showProof)).toBe('https://archives.example.org/acte');
    });

    it('SR-151 the history shows the status (en attente / validé / complément demandé / rejeté) and the review', () => {
      stores.user.set('john@example.org');
      const { container } = expanded(person({ modifications: history() }));
      const statuses = [...container.querySelectorAll('table:not(:has(th[scope="colgroup"])) tbody tr')].map(tr => text(tr.querySelectorAll('td')[1]));
      expect(statuses).toEqual(['validé 2024-01-05 : ok', 'complément demandé 2024-01-06', 'rejeté', 'en attente']);
    });

    it('SR-152 non-admins see the validated changes consolidated (struck old value + new value)', () => {
      const { container } = expanded(person({ modifications: [modification({ auth: 1, fields: { lastName: 'Durand' } })] }));
      const nom = cell(container, 'Naissance', 'Nom');
      expect(nom.querySelector('strike').textContent).toBe('Dupont');
      expect(text(nom)).toBe('Dupont Durand');
      expect(text(cell(container, 'Naissance', 'Sexe'))).toBe('Masculin');
    });
  });

  describe('administration', () => {
    const mods = () => [
      modification({ id: 'm1', auth: 1, fields: { lastName: 'Durand' }, review: { proofType: 'french death certificate' } }),
      modification({ id: 'm2', auth: 0, fields: { firstName: 'Paul' }, proof: 'https://archives.example.org/acte', date: '2024-02-03T14:05:00.000Z', message: 'voir acte' }),
      modification({ id: 'm3', auth: -1, fields: { sex: 'F' } })
    ];
    const adminCard = (modifications = mods()) => expanded(person({ modifications }));

    beforeEach(() => {
      stores.admin.set(true);
      stores.user.set('admin@example.org');
    });

    it('SR-153 shows a paginator over the modifications with valid/reject/active styles', () => {
      const { container } = adminCard();
      const items = [...container.querySelectorAll('li[title^="modification "]')];
      expect(items.map(li => li.title)).toEqual(['modification 0', 'modification 1', 'modification 2']);
      expect(items[0].className).toContain('rf-pagination__item--valid');
      expect(items[1].className).toContain('rf-pagination__item--active');
      expect(items[2].className).toContain('rf-pagination__item--reject');
      const single = adminCard([modification()]);
      expect(single.container.querySelector('li[title^="modification "]')).toBeNull();
    });

    it('SR-154 selects the last waiting modification by default', async () => {
      const { container } = adminCard();
      expect(screen.getByText('voir acte')).toBeTruthy();
      await fireEvent.click(container.querySelector('li[title="modification 0"]'));
      expect(container.querySelector('li[title="modification 0"]').className).toContain('rf-pagination__item--active');
      expect(screen.queryByText('voir acte')).toBeNull();
    });

    it('SR-155 summarises the counts of accepted, waiting and rejected modifications', () => {
      adminCard();
      expect(screen.getByText(/Cette fiche a fait l'objet de 3 demande de modifications\.\s+1 ont déjà été accetpées, 1 en attente, 1 rejetées\./)).toBeTruthy();
    });

    it('SR-156 the proof link goes through the backend proxy and opens the proof viewer', async () => {
      const { container } = adminCard();
      await fireEvent.click(container.querySelector('li[title="modification 0"]'));
      const link = screen.getByText('Preuve associée');
      expect(link.getAttribute('href')).toBe('/deces/api/v1/updates/proof/ba7582a6344757e6-m1');
      await fireEvent.click(link);
      expect(get(stores.showProof)).toBe('/deces/api/v1/updates/proof/ba7582a6344757e6-m1');
    });

    it('SR-157 offers the document type (2 groups, same field), scan quality and typography radios', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      adminCard();
      expect(screen.getByText('Type de document')).toBeTruthy();
      expect(screen.getByText('Qualité du scan')).toBeTruthy();
      expect(screen.getByText('Typographie')).toBeTruthy();
      await fireEvent.click(screen.getByLabelText('Acte de naissance'));
      await fireEvent.click(screen.getByLabelText('Pierre tombale'));
      expect(screen.getByLabelText('Acte de naissance').checked).toBe(false);
      await fireEvent.click(screen.getByLabelText('Bonne'));
      await fireEvent.click(screen.getByLabelText('Numérique'));
      await fireEvent.click(screen.getByTitle('Transmettre les validations'));
      expect(JSON.parse(post.mock.calls[0][1].get('m2'))).toEqual({ proofQuality: 'good', proofScript: 'numerical', proofType: 'grave' });
    });

    it('SR-158 Valider / Rejeter / Clore set auth 1 / -1 / -2 with the active styles', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      const { container } = adminCard();
      const valider = screen.getByText(/Valider/).closest('button');
      const rejeter = screen.getByTitle('Rejeter');
      const clore = screen.getByTitle('Clore');
      expect(valider.className).toContain('rf-btn--secondary');
      await fireEvent.click(valider);
      expect(valider.className).toContain('rf-btn--valid');
      await fireEvent.click(rejeter);
      expect(rejeter.className).toContain('rf-btn--reject');
      expect(valider.className).toContain('rf-btn--secondary');
      await fireEvent.click(clore);
      expect(clore.className).toContain('rf-btn--reject');
      await fireEvent.click(screen.getByTitle('Transmettre les validations'));
      expect(JSON.parse(post.mock.calls[0][1].get('m2'))).toEqual({ status: 'closed' });
      expect(container).toBeTruthy();
    });

    it('SR-159 shows the author, the date with the hour and the user message', () => {
      const { container } = adminCard();
      const p = [...container.querySelectorAll('p')].find(el => el.textContent.includes('jo...hn@example.org'));
      expect(text(p)).toBe('jo...hn@example.org (2024-02-03 14h) voir acte');
    });

    it('SR-160 the admin message textarea appears only when rejecting without the silent flag', async () => {
      adminCard();
      expect(document.getElementById('admin-message-1')).toBeNull();
      await fireEvent.click(screen.getByTitle('Rejeter'));
      expect(document.getElementById('admin-message-1').getAttribute('maxlength')).toBe('200');
      await fireEvent.click(screen.getByLabelText('Ne pas envoyer de mail'));
      expect(document.getElementById('admin-message-1')).toBeNull();
    });

    it('SR-161 has a "Ne pas envoyer de mail" checkbox bound to the review', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      adminCard();
      const silent = screen.getByLabelText('Ne pas envoyer de mail');
      expect(silent.type).toBe('checkbox');
      expect(silent.checked).toBe(false);
      await fireEvent.click(screen.getByText(/Valider/).closest('button'));
      await fireEvent.click(silent);
      await fireEvent.click(screen.getByTitle('Transmettre les validations'));
      expect(JSON.parse(post.mock.calls[0][1].get('m2'))).toEqual({ status: 'validated', silent: true });
    });

    it('SR-162 "Transmettre les validations" sends a review for every modification with a status or review data; the message only for a non-silent rejection', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });
      const { container } = adminCard();
      const submit = screen.getByTitle('Transmettre les validations');
      expect(submit.disabled).toBe(true);
      await fireEvent.click(screen.getByTitle('Rejeter'));
      expect(submit.disabled).toBe(false);
      await fireEvent.input(document.getElementById('admin-message-1'), { target: { value: 'illisible' } });
      await fireEvent.click(submit);
      expect(post).toHaveBeenCalledTimes(1);
      const [endpoint, formData, config] = post.mock.calls[0];
      expect(endpoint).toBe('/deces/api/v1/id/ba7582a6344757e6');
      expect(config).toEqual({ headers: { Authorization: 'Bearer token-edit' } });
      expect(Object.fromEntries([...formData.entries()].map(([k, v]) => [k, JSON.parse(v)]))).toEqual({
        m1: { status: 'validated', proofType: 'french death certificate' },
        m2: { status: 'rejected', message: 'illisible' },
        m3: { status: 'rejected' }
      });
      expect(formData.has('proof')).toBe(false);
      await waitFor(() => expect(submit.disabled).toBe(true));
      expect(container).toBeTruthy();
    });
  });
});
