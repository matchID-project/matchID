import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import axios from 'axios';
import LinkJobs from '../../../src/components/views/LinkJobs.svelte';
import { accessToken, admin } from '../../../src/components/tools/stores.js';
import { getJobsFilteredData, getJobData, validColumns } from '../../../src/components/tools/jobs.js';
import { resetLinkStores, stubFetch, flush } from './helpers.js';

const now = new Date(2026, 10, 7, 12, 0, 0).getTime();
const min = 60000;

const job = (overrides = {}) => ({
  id: 'job-0123456789abcdef',
  status: 'completed',
  timestamp: now - 30 * min,
  processedOn: now - 29 * min,
  finishedOn: now - 20 * min,
  progress: { percentage: 100 },
  ...overrides,
  data: { totalRows: 600, randomKey: 'key-a', user: 'bob@example.org', lastName: 'nom', birthDate: 'naissance', firstName: 'prenom', ...(overrides.data || {}) }
});

const jobs = [
  job(),
  job({ id: 'job-failed-0000', status: 'failed', timestamp: now - 10 * min, finishedOn: now - 9 * min, data: { randomKey: 'key-f' } }),
  job({ id: 'job-active-0000', status: 'active', timestamp: now - 5 * min, processedOn: now - 4 * min, finishedOn: undefined, progress: { percentage: 42.4 }, data: { randomKey: 'key-r', totalRows: 1000 } }),
  job({ id: 'job-waiting-000', status: 'waiting', timestamp: now - 2 * min, processedOn: undefined, finishedOn: undefined, progress: {}, data: { randomKey: 'key-w' } }),
  job({ id: 'job-old-0000000', status: 'completed', timestamp: now - 300 * min, processedOn: now - 299 * min, finishedOn: now - 290 * min, data: { randomKey: 'key-o', tmpfilePersistence: 60000 } }),
  job({ id: 'job-cancel-0000', status: 'cancelled', timestamp: now - 400 * min, processedOn: undefined, finishedOn: now - 399 * min, data: { randomKey: 'key-c' } })
];

const rows = () => [...document.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
const tile = (label) => [...document.querySelectorAll('.rf-tile__desc')].find(p => p.textContent.trim() === label)
  .closest('.rf-tile').querySelector('.rf-tile__title').textContent.trim();

describe('/jobs (LinkJobs.svelte, jobs.js)', () => {
  beforeEach(() => {
    resetLinkStores();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it('LK-149 renders nothing until a token exists', async () => {
    const fetchMock = stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    const { container } = render(LinkJobs);
    await flush();
    expect(container.textContent.trim()).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
    accessToken.set('token-1');
    await waitFor(() => expect(container.textContent).toContain('Liste des traitements'));
  });

  it('LK-150 fetches the jobs with GET /queue/jobs and the bearer token', async () => {
    const fetchMock = stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    accessToken.set('token-1');
    render(LinkJobs);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/queue/jobs', { headers: { Authorization: 'Bearer token-1' } });
  });

  it('LK-150 getJobData finds a job by its random key', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    expect((await getJobData('t', 'key-f')).id).toBe('job-failed-0000');
    expect(await getJobData('t', 'nope')).toBeUndefined();
  });

  it('LK-151 shows the stats tiles: Traitements, Appariements, Échecs, Lignes / Seconde', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    expect(tile('Traitements')).toBe('2');
    expect(tile('Appariements')).toBe('1k');
    expect(tile('Échecs')).toBe('1');
    // 1200 rows / (540 s + 540 s)
    expect(tile('Lignes / Seconde')).toBe('1');
  });

  it('LK-152 lists the jobs newest first with "YYYY-MM-DD HH:mm" dates and the 8 columns', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    expect([...document.querySelectorAll('thead th')].map(th => th.textContent)).toEqual([
      'création', 'fin', 'suppression', 'id', 'statut', 'lignes', 'colonnes', 'velocité (l/s)'
    ]);
    const table = rows();
    expect(table.map(r => r[0])).toEqual([
      '2026-11-07 11:58', '2026-11-07 11:55', '2026-11-07 11:50', '2026-11-07 11:30', '2026-11-07 07:00', '2026-11-07 05:20'
    ]);
    expect(table[3]).toEqual(['2026-11-07 11:30', '2026-11-07 11:40', '2026-11-07 12:40', 'job-012345...', 'succès', '600', '2', '1']);
  });

  it('LK-152 getJobsFilteredData computes progress, rates, waiting and processing times', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    const list = await getJobsFilteredData('t');
    const active = list.find(j => j.id === 'job-active-0000');
    expect(active).toMatchObject({ status: 'active', progress: 42, rows: 1000, waiting_time: 60, processing_time: 240, processing_rate: 1 });
    expect(list.find(j => j.id === 'job-0123456789abcdef').progress).toBe('100');
  });

  it('LK-153 shows "Aucun job" when the list is empty', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs: [] } });
    accessToken.set('token-1');
    render(LinkJobs);
    await waitFor(() => expect(document.body.textContent).toContain('Aucun job'));
    expect(document.querySelector('table')).toBeNull();
  });

  it('LK-154 admin: the id column shows the job owner', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs: [job({ data: { user: 'alice@example.org' } })] } });
    accessToken.set('token-1');
    admin.set('admin@example.org');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    expect(rows()[0][3]).toBe('alice@example.org');
    expect(document.querySelector('tbody a')).toBeNull();
  });

  it('LK-155 non-admin: the id links to /link?job=<randomKey> for active/waiting or unexpired completed jobs, else plain truncated id', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    const links = [...document.querySelectorAll('tbody tr')].map(tr => tr.querySelector('a')?.getAttribute('href') || null);
    // waiting, active, failed, completed (fresh), completed (expired), cancelled
    expect(links).toEqual(['/link?job=key-w', '/link?job=key-r', null, '/link?job=key-a', null, null]);
    expect(rows()[2][3]).toBe('job-failed...');
  });

  it('LK-156 maps the statuses to labels (succès, échec, annulé, en cours, en attente)', async () => {
    stubFetch({
      'GET /deces/api/v1/queue/jobs': {
        jobs: ['completed', 'failed', 'cancelled', 'created', 'waiting', 'wait', 'stuck'].map((status, i) =>
          job({ id: `job-${status}-xxxxxxxx`, status, timestamp: now - i * min, data: { randomKey: status } }))
      }
    });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    expect(rows().map(r => r[4])).toEqual(['succès', 'échec', 'annulé', 'en cours', 'en attente', 'en attente', 'stuck']);
  });

  it('LK-157 an active job shows its progress and a stop icon sending DELETE /search/csv/{id}', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    const del = vi.spyOn(axios, 'delete').mockResolvedValue({ data: { msg: 'Job job-active-0000 cancelled' } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    expect(rows()[1][4]).toBe('42%');
    await fireEvent.click(screen.getByTitle('arrêter'));
    expect(del).toHaveBeenCalledWith('/deces/api/v1/search/csv/job-active-0000', { headers: { Authorization: 'Bearer token-1' } });
    await waitFor(() => expect(rows()[1][4]).toBe('arrêté'));
  });

  it('LK-157 keeps the job when the backend does not confirm the cancellation', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    vi.spyOn(axios, 'delete').mockResolvedValue({ data: { msg: 'not found' } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    await fireEvent.click(screen.getByTitle('arrêter'));
    await flush();
    expect(rows()[1][4]).toBe('42%');
  });

  it('LK-158 the stop icon also reacts to a keypress', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    const del = vi.spyOn(axios, 'delete').mockResolvedValue({ data: { msg: 'cancelled' } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    await fireEvent.keyPress(screen.getByTitle('arrêter'), { key: 'Enter', charCode: 13 });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('LK-159 "fin" is "en cours" until finished; "suppression" = finishedOn + persistence (failed: finishedOn)', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    const table = rows();
    expect(table[1].slice(1, 3)).toEqual(['en cours', 'en cours']); // active
    expect(table[2].slice(1, 3)).toEqual(['2026-11-07 11:51', '2026-11-07 11:51']); // failed
    expect(table[3].slice(1, 3)).toEqual(['2026-11-07 11:40', '2026-11-07 12:40']); // default 1 h
    expect(table[4].slice(1, 3)).toEqual(['2026-11-07 07:10', '2026-11-07 07:11']); // 1 min persistence
  });

  it('LK-160 "vélocité" shows the rate or "N/A"', async () => {
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    expect(rows().map(r => r[7])).toEqual(['N/A', '1', 'N/A', '1', '1', 'N/A']);
  });

  it('LK-161 "colonnes" counts the validColumns present in the job data (firstName not counted)', async () => {
    expect(validColumns).not.toContain('firstName');
    stubFetch({ 'GET /deces/api/v1/queue/jobs': { jobs: [job({ data: { sex: 's', deathDate: 'd' } })] } });
    accessToken.set('token-1');
    render(LinkJobs);
    await screen.findByText('Liste des traitements');
    // lastName, birthDate, sex, deathDate (+ firstName ignored)
    expect(rows()[0][6]).toBe('4');
  });
});
