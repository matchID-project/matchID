import { BulkController } from './bulk.controller'
import { writeToBuffer } from '@fast-csv/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express';
import * as processStream from '../processStream';

describe('bulk.controller.ts', () => {
  const controller = new BulkController()

  beforeEach(() => {
    vi.spyOn(controller as any, 'handleFile').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no files attached', async () => {
    const req = {
      headers: {},
      body: {},
      files: []
    } as unknown as express.Request
    const result = await controller.uploadCsv(req)
    expect(result.msg).to.equal('no files attached');
  });

 it('read csv', async () => {
   // let res: any;
   const inputArray = [
     ['Prenom', 'Nom', 'Date', 'Sex'],
     ['jean', 'pierre', '04/08/1933', 'M'],
     ['georges', 'michel', '12/03/1939', 'M']
   ]
   const buf: any = await writeToBuffer(inputArray)
   vi.spyOn(processStream, 'csvHandle').mockResolvedValue({ msg: 'started' } as any);
   const req = {
     headers: {},
     body: {},
     files: [{ buffer: buf }],
     user: { user: 'tester' }
   } as unknown as express.Request
   const res = await controller.uploadCsv(req)
   expect(res.msg).to.equal('started');
   expect(processStream.csvHandle).toHaveBeenCalled();
 });
})
