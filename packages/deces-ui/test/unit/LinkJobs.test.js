import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import axios from 'axios';
import LinkJobs from '../../src/components/views/LinkJobs.svelte';
import { accessToken } from '../../src/components/tools/stores.js';

const activeJob = {
  id: 'job-0123456789',
  status: 'active',
  timestamp: Date.now() - 60000,
  processedOn: Date.now() - 50000,
  progress: { percentage: 42 },
  data: { totalRows: 100, randomKey: 'abc', user: 'bob@example.org', lastName: 'nom' }
};

describe('LinkJobs', () => {
  it('lists jobs fetched with the bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jobs: [activeJob] }))
    );
    accessToken.set('token-123');
    render(LinkJobs);
    expect(await screen.findByText('42%', { exact: false })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/queue/jobs', {
      headers: { Authorization: 'Bearer token-123' }
    });
  });

  // Regression: deleteJob referenced an undeclared `headers` variable, so
  // clicking "arrêter" threw a ReferenceError and never reached the backend.
  it('stops an active job with an authenticated DELETE request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jobs: [activeJob] }))
    );
    const deleteMock = vi.spyOn(axios, 'delete').mockResolvedValue({
      data: { msg: `Job ${activeJob.id} cancelled` }
    });
    accessToken.set('token-456');
    render(LinkJobs);
    await fireEvent.click(await screen.findByTitle('arrêter'));
    expect(deleteMock).toHaveBeenCalledWith(
      `/deces/api/v1/search/csv/${activeJob.id}`,
      { headers: { Authorization: 'Bearer token-456' } }
    );
    await waitFor(() => expect(screen.getByText('arrêté')).toBeTruthy());
  });
});
