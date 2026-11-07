import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LinkFile from '../../../src/components/views/LinkFile.svelte';
import { linkFile } from '../../../src/components/tools/stores.js';
import { resetLinkStores, makeFile, makeDataTransfer } from './helpers.js';

const renderDropzone = (props = {}) => render(LinkFile, {
  step: 1, title: 'Fichier', label: 'Glissez un fichier', error: false, ...props
}).container.querySelector('div.rf-callout');

// Capture the transient <input type=file> created by chooseFile().
const spyFileChooser = () => {
  const inputs = [];
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () { inputs.push(this); });
  return inputs;
};

const fileItem = (file) => ({ kind: 'file', getAsFile: () => file });
const stringItem = () => ({ kind: 'string', getAsFile: () => null });

describe('LinkFile dropzone', () => {
  beforeEach(() => resetLinkStores());

  it('LK-026 a click opens the native file chooser and stores the chosen file', async () => {
    const inputs = spyFileChooser();
    const zone = renderDropzone();
    const event = createEvent.click(zone);
    await fireEvent(zone, event);
    expect(event.defaultPrevented).toBe(true);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].type).toBe('file');
    const file = makeFile('a,b,c\n1,2,3');
    inputs[0].onchange({ target: { files: [file] } });
    expect(get(linkFile)).toBe(file);
  });

  it('LK-027 any keydown (Tab included) opens the file chooser and is prevented', async () => {
    const inputs = spyFileChooser();
    const zone = renderDropzone();
    for (const key of ['Enter', ' ', 'Tab']) {
      const event = createEvent.keyDown(zone, { key });
      await fireEvent(zone, event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(inputs).toHaveLength(3);
  });

  it('LK-028 dropping files sets $linkFile, the last file item wins', async () => {
    const zone = renderDropzone();
    const first = makeFile('1', 'first.csv');
    const last = makeFile('2', 'last.csv');
    const event = createEvent.drop(zone, { dataTransfer: makeDataTransfer({ items: [fileItem(first), fileItem(last)] }) });
    await fireEvent(zone, event);
    expect(event.defaultPrevented).toBe(true);
    expect(get(linkFile)).toBe(last);
  });

  it('LK-029 highlights the dropzone on dragover and removes it on dragleave / drop', async () => {
    const zone = renderDropzone();
    expect(zone.getAttribute('ondragover')).toBe('return false');
    await fireEvent.dragOver(zone);
    expect(zone.classList.contains('hovering')).toBe(true);
    await fireEvent.dragLeave(zone);
    expect(zone.classList.contains('hovering')).toBe(false);
    await fireEvent.dragOver(zone);
    await fireEvent.drop(zone, { dataTransfer: makeDataTransfer({ items: [stringItem()] }) });
    expect(zone.classList.contains('hovering')).toBe(false);
  });

  it('LK-029 keeps the highlight once a file is set, never in error', async () => {
    linkFile.set(makeFile('x'));
    expect(renderDropzone().classList.contains('hovering')).toBe(true);
    document.body.innerHTML = '';
    const zone = renderDropzone({ error: true });
    await fireEvent.dragOver(zone);
    expect(zone.classList.contains('hovering')).toBe(false);
  });

  it('LK-030 icon state: play when idle, checkbox with a file, alert in error', () => {
    const idle = renderDropzone();
    expect(idle.classList.contains('rf-fi-play-line')).toBe(true);
    expect(idle.classList.contains('rf-fi-checkbox-line')).toBe(false);
    document.body.innerHTML = '';
    linkFile.set(makeFile('x'));
    const withFile = renderDropzone();
    expect(withFile.classList.contains('rf-fi-checkbox-line')).toBe(true);
    expect(withFile.classList.contains('rf-fi-play-line')).toBe(false);
    document.body.innerHTML = '';
    linkFile.set(null);
    const inError = renderDropzone({ error: true });
    expect(inError.classList.contains('rf-fi-alert-line')).toBe(true);
    expect(inError.classList.contains('rf-text--error')).toBe(true);
    expect(inError.classList.contains('rf-fi-play-line')).toBe(false);
  });

  it('LK-031 ignores non-file drop items; the dataTransfer.files fallback is a no-op', async () => {
    const zone = renderDropzone();
    await fireEvent.drop(zone, { dataTransfer: makeDataTransfer({ items: [stringItem()] }) });
    expect(get(linkFile)).toBe(null);
    // Browsers without DataTransferItemList: files are not read (current gap)
    await fireEvent.drop(zone, { dataTransfer: makeDataTransfer({ items: undefined, files: [makeFile('x')] }) });
    expect(get(linkFile)).toBe(null);
  });

  it('LK-026 renders "Étape N. Title" and the HTML label inside a #stepN link', () => {
    const zone = renderDropzone({ label: 'a<br/>b' });
    expect(zone.querySelector('strong').textContent).toBe('Étape 1. Fichier');
    const link = zone.querySelector('a[href="#step1"]');
    expect(link.getAttribute('aria-label')).toBe('a<br/>b');
    expect(link.querySelector('br')).not.toBeNull();
  });
});
