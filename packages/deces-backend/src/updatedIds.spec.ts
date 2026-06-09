import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./runRequest', () => ({ runBulkRequest: vi.fn() }));
vi.mock('./buildRequest', () => ({ buildRequest: vi.fn() }));
vi.mock('./models/result', () => ({ buildResultSingle: vi.fn() }));

describe('updatedIds', () => {
  const previousProofs = process.env.PROOFS;
  let proofsDir: string | undefined;

  afterEach(() => {
    vi.resetModules();
    if (proofsDir) {
      rmSync(proofsDir, { recursive: true, force: true });
      proofsDir = undefined;
    }
    if (previousProofs === undefined) {
      delete process.env.PROOFS;
    } else {
      process.env.PROOFS = previousProofs;
    }
  });

  it('keys persisted updates by person id when PROOFS is an absolute path', async () => {
    proofsDir = mkdtempSync(path.join(tmpdir(), 'matchid-proofs-'));
    const personId = '0Dts3lDwtRHX';
    const updateDate = '2026-06-09T12:00:00.000Z';
    const personProofsDir = path.join(proofsDir, personId);
    mkdirSync(personProofsDir, { recursive: true });
    writeFileSync(
      path.join(personProofsDir, `${updateDate}_${personId}.json`),
      JSON.stringify({
        id: 'update-1',
        date: updateDate,
        proof: '/tmp/proof.pdf',
        auth: 0,
        author: 'user@example.com',
        fields: { nom: 'DUBOEUF' },
      }),
    );

    process.env.PROOFS = proofsDir;
    vi.resetModules();
    const { getAllUpdates } = await import('./updatedIds');

    expect(Object.keys(getAllUpdates())).toEqual([personId]);
  });
});
