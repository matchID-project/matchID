import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import axios from 'axios';
import LinkJob from '../../../src/components/views/LinkJob.svelte';
import {
  accessToken, linkFile, linkFileName, linkFileSize, linkJob, linkMapping, linkOptions, linkResults,
  linkCompleteResults, linkSourceHeader, linkStep, linkWaiter, themeDnum
} from '../../../src/components/tools/stores.js';
import { resetLinkStores, makeFile, stubFetch } from './helpers.js';

// setTimeout is faked in this file: flush pending callbacks through the clock.
const flush = () => vi.advanceTimersByTimeAsync(0);

const mapping = {
  direct: { nom: 'lastName', prenom: 'firstName', naissance: 'birthDate' },
  reverse: { lastName: 'nom', firstName: 'prenom', birthDate: 'naissance' }
};
const csvOptions = { sep: ',', quote: undefined, skipLines: 0, encoding: 'utf8', type: 'csv', dateFormat: 'dd/MM/yyyy', tmpfilePersistence: '3600000' };

const resultCsv = [
  'nom,prenom,naissance,sourceLineNumber,score,name.last',
  'Dupont,Jean,01/02/1950,1,0.9,DUPONT',
  'Dupont,Jean,01/02/1950,1,0.5,DUPOND',
  'Martin,Marie,03/04/1960,2,,',
  '"Durand, fils",Paul,05/06/1970,3,0.7,DURAND'
].join('\r\n');

// Session state of a file mapped at step 2 and validated by a logged-in user.
const prepareSession = ({ job = null, options = {} } = {}) => {
  accessToken.set('token-1');
  linkFile.set(makeFile('nom,prenom,naissance\nDupont,Jean,01/02/1950\n', 'clients.csv'));
  linkFileName.set('clients.csv');
  linkFileSize.set(1000);
  linkSourceHeader.set(['nom', 'prenom', 'naissance']);
  linkMapping.set(structuredClone(mapping));
  linkOptions.update(o => ({ ...o, csv: { ...csvOptions, ...options } }));
  linkStep.set(3);
  linkJob.set(job);
};

const text = () => document.body.textContent.replace(/\s+/g, ' ');
const httpError = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });

describe('LinkJob (upload, polling, results)', () => {
  beforeEach(() => {
    resetLinkStores();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // sleep(3000) between polls is driven by the fake clock
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    // the polling loop never stops on unmount: leave it parked on a fake timer
    vi.useRealTimers();
  });

  describe('upload', () => {
    it('LK-087 posts a multipart /search/csv with the bearer token, options, mapping and file', async () => {
      prepareSession();
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { msg: 'started', id: 'key-1' } });
      vi.spyOn(axios, 'get').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      const [url, form, config] = post.mock.calls[0];
      expect(url).toBe('/deces/api/v1/search/csv');
      expect(config.headers).toEqual({ Authorization: 'Bearer token-1' });
      expect(Object.fromEntries([...form.entries()].filter(([k]) => k !== 'csv'))).toEqual({
        sep: ',', encoding: 'utf8', skipLines: '0', candidateNumber: '10', pruneScore: '0.3',
        dateFormat: 'dd/MM/yyyy', tmpfilePersistence: '3600000',
        lastName: 'nom', firstName: 'prenom', birthDate: 'naissance'
      });
      expect(form.get('csv').name).toBe('clients.csv');
    });

    it('LK-087 pins the defaults: dateFormat "dd/MM/yyyy" and the literal "undefined" persistence; the quote is not sent', async () => {
      prepareSession({ options: { dateFormat: undefined, tmpfilePersistence: undefined, quote: '"' } });
      const post = vi.spyOn(axios, 'post').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      const form = post.mock.calls[0][1];
      expect(form.get('dateFormat')).toBe('dd/MM/yyyy');
      expect(form.get('tmpfilePersistence')).toBe('undefined');
      expect(form.has('quote')).toBe(false);
    });

    it('LK-088 a Gedcom upload sends the generated TSV instead of the file', async () => {
      prepareSession({ options: { type: 'gedcom', sep: '\t', csv: 'gedcom_id\tnom\n@i1@\tDupont' } });
      const post = vi.spyOn(axios, 'post').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      const blob = post.mock.calls[0][1].get('csv');
      expect(blob.name).toBe('blob');
      expect(await blob.text()).toBe('gedcom_id\tnom\n@i1@\tDupont');
    });

    it('LK-089 shows the upload progress "votre fichier est en cours de chargement N%"', async () => {
      prepareSession();
      const post = vi.spyOn(axios, 'post').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      expect(text()).toContain('votre fichier est en cours de chargement 0%');
      post.mock.calls[0][2].onUploadProgress({ loaded: 30, total: 120 });
      await flush();
      expect(text()).toContain('votre fichier est en cours de chargement 25%');
      expect(document.querySelector('progress')).not.toBeNull();
    });

    it('LK-090 stores the job id when the backend answers {msg: "started", id}', async () => {
      prepareSession();
      vi.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { msg: 'started', id: 'key-1' } });
      vi.spyOn(axios, 'get').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkJob)).toBe('key-1'));
    });

    it('LK-090 ignores an answer without "started" (no job id)', async () => {
      prepareSession();
      const post = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { msg: 'queued' } });
      render(LinkJob);
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      await flush();
      expect(get(linkJob)).toBe(null);
    });

    it('LK-092 shows "téléchargement terminé" and a full upload bar once the job id exists', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      expect(text()).toContain('téléchargement terminé');
      // value 100 > max 1: the bar is full
      expect(document.querySelector('progress').getAttribute('value')).toBe('100');
    });
  });

  describe('polling', () => {
    it('LK-091 polls GET /search/csv/{job} every 3 s until the results arrive', async () => {
      prepareSession({ job: 'key-1' });
      const getMock = vi.spyOn(axios, 'get')
        .mockResolvedValueOnce({ data: { status: 'active', progress: { percentage: 40 } } })
        .mockResolvedValueOnce({ data: { status: 'active', progress: { percentage: 80 } } })
        .mockResolvedValueOnce({ data: resultCsv });
      render(LinkJob);
      await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
      expect(getMock.mock.calls[0][0]).toBe('/deces/api/v1/search/csv/key-1');
      expect(getMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer token-1' });
      await vi.advanceTimersByTimeAsync(2999);
      expect(getMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(getMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(3000);
      expect(getMock).toHaveBeenCalledTimes(3);
      await vi.waitFor(() => expect(get(linkStep)).toBe(4));
      await vi.advanceTimersByTimeAsync(9000);
      expect(getMock).toHaveBeenCalledTimes(3);
    });

    it('LK-093 active job: "traitement en cours N% (fin dans environ N secondes)"', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get')
        .mockResolvedValueOnce({ data: { status: 'active', progress: { percentage: 40 } } })
        .mockResolvedValueOnce({ data: { status: 'active', progress: { percentage: 60 } } })
        .mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(text()).toContain('traitement en cours 40%'));
      expect(text()).not.toContain('fin dans environ');
      await vi.advanceTimersByTimeAsync(3000);
      // 20 % in 3 s: 40 % left -> 6 s
      await vi.waitFor(() => expect(text()).toContain('traitement en cours 60% (fin dans environ 6 secondes)'));
    });

    it('LK-094 waiting job: "traitement en attente (lancement dans environ N secondes)" (numeric queue sizes)', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get')
        .mockResolvedValueOnce({ data: { status: 'wait', remainingRowsWaiting: 100, remainingRowsActive: 50 } })
        .mockResolvedValueOnce({ data: { status: 'wait', remainingRowsWaiting: 50, remainingRowsActive: 25 } })
        .mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(text()).toContain('traitement en attente'));
      expect(text()).not.toContain('lancement dans environ');
      await vi.advanceTimersByTimeAsync(3000);
      // 75 rows in 3 s: 75 rows left -> 3 s
      await vi.waitFor(() => expect(text()).toContain('traitement en attente (lancement dans environ 3 secondes)'));
    });

    // BUG: the backend sends `remainingRowsActive` as an ARRAY of per-job
    // objects (processStream.ts returnBulkResults), so
    // `remainingRowsWaiting + remainingRowsActive` is a string and the queue
    // estimate is NaN: the waiting time is never displayed.
    it.fails('LK-094 shows the queue estimate with the backend payload (remainingRowsActive is an array)', async () => {
      prepareSession({ job: 'key-1' });
      const active = (rows) => [{ priority: 1, progress: 50, remainingRows: rows, rows: 2 * rows }];
      vi.spyOn(axios, 'get')
        .mockResolvedValueOnce({ data: { status: 'wait', remainingRowsWaiting: 100, remainingRowsActive: active(50) } })
        .mockResolvedValueOnce({ data: { status: 'wait', remainingRowsWaiting: 50, remainingRowsActive: active(25) } })
        .mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(text()).toContain('traitement en attente'));
      await vi.advanceTimersByTimeAsync(3000);
      await vi.waitFor(() => expect(text()).toContain('lancement dans environ'), { timeout: 200 });
    });

    it('LK-095 shows "traitement terminé / téléchargement des résultats N%" while downloading', async () => {
      prepareSession({ job: 'key-1' });
      const getMock = vi.spyOn(axios, 'get').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(getMock).toHaveBeenCalled());
      const { onDownloadProgress } = getMock.mock.calls[0][1];
      // 600 chars for a 1000-byte file (x 1.5 expected ratio) -> 40 %
      onDownloadProgress({ currentTarget: { response: 'x'.repeat(600) } });
      await flush();
      expect(text()).toContain('traitement terminé');
      expect(text()).toContain('téléchargement des résultats 40%');
      onDownloadProgress({ currentTarget: { response: 'x'.repeat(30) } });
      await flush();
      expect(text()).toContain('traitement en cours'); // < 5 %: still shown as processing
    });

    it('LK-096 at 100 % downloaded sets the waiter "Préparation de la visualisation des résultats" and hides the panel', async () => {
      prepareSession({ job: 'key-1' });
      const getMock = vi.spyOn(axios, 'get').mockReturnValue(new Promise(() => {}));
      render(LinkJob);
      await vi.waitFor(() => expect(getMock).toHaveBeenCalled());
      getMock.mock.calls[0][1].onDownloadProgress({ currentTarget: { response: 'x'.repeat(1500) } });
      await flush();
      expect(get(linkWaiter)).toBe('Préparation de la visualisation des résultats');
      expect(text().trim()).toBe('');
    });

    it('LK-097 parses the result CSV grouped by sourceLineNumber: complete results, scored results, step 4', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: resultCsv });
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkStep)).toBe(4));
      const header = ['nom', 'prenom', 'naissance', 'sourceLineNumber', 'score', 'name.last'];
      const complete = get(linkCompleteResults);
      expect(complete.header).toEqual(header);
      expect(complete.rows).toEqual([
        [['Dupont', 'Jean', '01/02/1950', '1', '0.9', 'DUPONT'], ['Dupont', 'Jean', '01/02/1950', '1', '0.5', 'DUPOND']],
        [['Martin', 'Marie', '03/04/1960', '2', '', '']],
        [['Durand, fils', 'Paul', '05/06/1970', '3', '0.7', 'DURAND']]
      ]);
      const scored = get(linkResults);
      expect(scored.header).toEqual(header);
      expect(scored.rows.map(group => group.map(r => r[0]))).toEqual([['Dupont', 'Dupont'], ['Durand, fils']]);
    });

    it('LK-098 restores the job metadata from /queue/jobs when the local state is missing', async () => {
      accessToken.set('token-1');
      linkJob.set('key-9');
      const fetchMock = stubFetch({
        'GET /deces/api/v1/queue/jobs': {
          jobs: [
            { id: 'other', data: { randomKey: 'zzz' } },
            {
              id: 'job-9', data: {
                randomKey: 'key-9', sep: ',', encoding: 'utf8', skipLines: '1', candidateNumber: '5', pruneScore: '0.4',
                dateFormat: 'yyyy-MM-dd', tmpfilePersistence: '60000', lastName: 'nom', birthDate: 'naissance'
              }
            }
          ]
        }
      });
      vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: resultCsv });
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkStep)).toBe(4));
      expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/queue/jobs', { headers: { Authorization: 'Bearer token-1' } });
      expect(get(linkFileName)).toBe('job-9.csv');
      expect(get(linkOptions).csv).toMatchObject({ sep: ',', encoding: 'utf8', skipLines: 1, dateFormat: 'yyyy-MM-dd', tmpfilePersistence: '60000' });
      expect(get(linkSourceHeader)).toEqual(['nom', 'naissance']);
      expect(get(linkMapping)).toEqual({
        direct: { nom: 'lastName', naissance: 'birthDate' },
        reverse: { lastName: 'nom', birthDate: 'naissance' }
      });
    });

    // BUG: `validColumns` (jobs.js) has no `firstName`: a job restored from
    // the server loses its first name column in the header and the mapping.
    it.fails('LK-098 restores the first name column of a server-side job', async () => {
      accessToken.set('token-1');
      linkJob.set('key-9');
      stubFetch({
        'GET /deces/api/v1/queue/jobs': { jobs: [{ id: 'job-9', data: { randomKey: 'key-9', sep: ',', lastName: 'nom', firstName: 'prenom' } }] }
      });
      vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: resultCsv });
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkStep)).toBe(4));
      expect(get(linkMapping).reverse.firstName).toBe('prenom');
    });
  });

  describe('errors', () => {
    const failWith = async (where, error) => {
      if (where === 'upload') {
        prepareSession();
        vi.spyOn(axios, 'post').mockRejectedValue(error);
      } else {
        prepareSession({ job: 'key-1' });
        vi.spyOn(axios, 'get').mockRejectedValue(error);
      }
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkJob)).toBe('failed'));
      await flush();
    };

    it('LK-099 a failed / unknown job shows "Le traitement a échoué" with the message and marks the job failed', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get').mockResolvedValue({ data: { msg: 'job doesn\'t exists' } });
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkJob)).toBe('failed'));
      await flush();
      expect(text()).toContain('Le traitement a échoué');
      expect(text()).toContain('job doesn\'t exists');
    });

    it('LK-099 a failed status without message shows "erreur inconnue"', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get').mockResolvedValue({ data: { status: 'failed' } });
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkJob)).toBe('failed'));
      await flush();
      expect(text()).toContain('Le traitement a échoué');
      expect(text()).toContain('erreur inconnue');
    });

    it('LK-100 expired results: "Les résultats ont expiré, merci de relancer le traitement"', async () => {
      prepareSession({ job: 'key-1' });
      vi.spyOn(axios, 'get').mockResolvedValue({ data: { msg: 'Job succeeded but results expired' } });
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkJob)).toBe('failed'));
      await flush();
      expect(text()).toContain('Les résultats ont expiré, merci de relancer le traitement');
    });

    it('LK-101 "Erreur {status}" with the column header mismatch message', async () => {
      await failWith('poll', httpError(400, { msg: 'Error: column header mismatch expected: 3 columns got: 6' }));
      expect(text()).toContain('Le traitement a échoué');
      expect(text()).toContain('Erreur 400');
      expect(text()).toContain('le nombre de colonnes n\'est pas conforme à l\'entête CSV');
    });

    it('LK-102 429 running job: "vous avez déja un traitement en cours - consulter les traitements" linking /jobs', async () => {
      await failWith('upload', httpError(429, { msg: 'There is already 1 running or waiting jobs' }));
      expect(text()).toContain('Erreur 429');
      expect(text()).toContain('vous avez déja un traitement en cours - consulter les traitements');
      expect(document.querySelector('a[href="/jobs"]').textContent).toBe('consulter les traitements');
    });

    it('LK-103 any other backend message is shown JSON-stringified', async () => {
      await failWith('upload', httpError(422, { msg: 'invalid mapping' }));
      expect(text()).toContain('Erreur 422');
      expect(text()).toContain('"invalid mapping"');
    });

    it('LK-104 400 without message: data format message with the contact mailto', async () => {
      await failWith('upload', httpError(400, {}));
      expect(text()).toContain('problème dans le format des données, merci de nous contacter à test@example.org');
      expect(document.querySelector('a[href="mailto:test@example.org"]')).not.toBeNull();
    });

    it('LK-105 502: "le serveur est indisponible…"', async () => {
      await failWith('upload', httpError(502, ''));
      expect(text()).toContain('Erreur 502');
      expect(text()).toContain('le serveur est indisponible, veuiller réessayer ultérieurement ou nous contacter à test@example.org');
    });

    it('LK-106 500: "le fichier a provoqué une erreur serveur…"', async () => {
      await failWith('poll', httpError(500, {}));
      expect(text()).toContain('le fichier a provoqué une erreur serveur, merci de nous contacter à test@example.org');
    });

    it('LK-107 429 without message: "trop de requêtes, merci de recommencer ultérieurement"', async () => {
      await failWith('upload', httpError(429, {}));
      expect(text()).toContain('trop de requêtes, merci de recommencer ultérieurement');
    });

    it('LK-108 other status: "erreur inconnue, merci de nous contacter à …"', async () => {
      await failWith('upload', httpError(418, {}));
      expect(text()).toContain('Erreur 418');
      expect(text()).toContain('erreur inconnue, merci de nous contacter à test@example.org');
    });

    it('LK-109 network error (no response): the raw error string', async () => {
      await failWith('upload', new Error('Network Error'));
      expect(text()).toContain('Error: Network Error');
    });

    it('LK-110 the contact address depends on the theme (DNUM: datalab@interieur.gouv.fr)', async () => {
      themeDnum.set(1);
      await failWith('upload', httpError(400, {}));
      expect(document.querySelector('a[href="mailto:datalab@interieur.gouv.fr"]')).not.toBeNull();
      expect(text()).not.toContain('test@example.org');
    });

    it('LK-111 an expired token (401) during upload is shown as an error, no refresh, job failed', async () => {
      const fetchMock = stubFetch();
      await failWith('upload', httpError(401, { msg: 'jwt expired' }));
      expect(text()).toContain('Erreur 401');
      expect(text()).toContain('"jwt expired"');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('LK-111 an expired token (401) while polling fails the job without retrying', async () => {
      const fetchMock = stubFetch();
      await failWith('poll', httpError(401, { msg: 'jwt expired' }));
      expect(text()).toContain('Erreur 401');
      const calls = axios.get.mock.calls.length;
      await vi.advanceTimersByTimeAsync(9000);
      expect(axios.get.mock.calls.length).toBe(calls);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('LK-112 results already present on mount: no upload, no polling, step 4', async () => {
      prepareSession({ job: 'key-1' });
      linkResults.set({ header: ['score'], rows: [] });
      linkStep.set(3);
      const post = vi.spyOn(axios, 'post');
      const getMock = vi.spyOn(axios, 'get');
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkStep)).toBe(4));
      await vi.advanceTimersByTimeAsync(6000);
      expect(post).not.toHaveBeenCalled();
      expect(getMock).not.toHaveBeenCalled();
    });

    it('LK-113 pins the leak: polling survives unmount (no cancellation from step 3)', async () => {
      prepareSession({ job: 'key-1' });
      const getMock = vi.spyOn(axios, 'get').mockResolvedValue({ data: { status: 'active', progress: { percentage: 10 } } });
      const { unmount } = render(LinkJob);
      await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
      unmount();
      await vi.advanceTimersByTimeAsync(6000);
      expect(getMock).toHaveBeenCalledTimes(3);
    });

    it('LK-113 pins that the loop keeps running (idle) after an error', async () => {
      prepareSession({ job: 'key-1' });
      const getMock = vi.spyOn(axios, 'get').mockRejectedValue(httpError(500, {}));
      render(LinkJob);
      await vi.waitFor(() => expect(get(linkJob)).toBe('failed'));
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(9000);
      expect(getMock).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });
});
