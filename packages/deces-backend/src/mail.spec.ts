import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import nodemailer from 'nodemailer';
import RedisMock from 'ioredis-mock';

const { disposableMailPath } = vi.hoisted(() => {
  const path = '/tmp/disposable-mail.test.txt';
  process.env.DISPOSABLE_MAIL = path;
  return { disposableMailPath: path };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn((...args: any[]) => {
      if (args[0] === disposableMailPath) {
        return 'xoxy.net\n';
      }
      return (actual.readFileSync as any)(...args);
    }),
  };
});

// vi.mock calls are hoisted by vitest above any imports. The nodemailer stub
// is installed before mail.ts runs `nodemailer.createTransport(...)` at module
// load time so the OTP rate-limit / storage logic (subject under test) can
// run without an SMTP server.
vi.mock('nodemailer', async () => {
  const actual = await vi.importActual<typeof import('nodemailer')>('nodemailer');
  return {
    ...actual,
    default: {
      ...actual.default,
      createTransport: () => ({
        sendMail: vi.fn(() => Promise.resolve({ accepted: ['ok'], response: 'Accepted (mocked)' })),
      }),
    },
  };
});

import { sendOTP, validateOTP } from './mail';
import { __setRedisClientForTests } from './redisClient';

const mockRedis = new RedisMock();

beforeAll(() => {
  // Replace the singleton ioredis client with an in-memory mock so the OTP
  // store (now backed by Redis) works without a live broker. Real-Redis
  // exercise still happens through BullMQ integration smoke tests.
  __setRedisClientForTests(mockRedis as any);
});

beforeEach(async () => {
  await mockRedis.flushall();
});

describe('mail.ts - Sending emails', () => {

  it('Send test email using Ethereal', async () => {
    try {
      const account = await nodemailer.createTestAccount()
      expect(account.user.length, `account not created: ${JSON.stringify(account)}`).greaterThan(0);
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: account.user, // generated ethereal user
          pass: account.pass  // generated ethereal password
        }
      });
      const message = {
        from: 'Sender Name <sender@example.com>',
        to: 'Recipient <recipient@example.com>',
        subject: 'Nodemailer is unicode friendly ✔',
        text: 'Hello to myself!',
        html: '<p><b>Hello</b> to myself!</p>'
      };
      const info = await transporter.sendMail(message)
      expect(info.response, `mail not sended ${JSON.stringify(info)}`).to.include('Accepted');
    } catch (e) {
      throw new Error(e)
    }
  }, 10000);

  it('Send test email fake smtp server', async () => {
    let res: any;
    res = await sendOTP("recipient@example.com")
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(res.valid).to.be.true;

    res = await sendOTP("recipient@example.com")
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(res.valid).to.be.false;
    expect(res.msg).to.include('attendre');
  })

  it('Send test email fake smtp server to a disposable address', async () => {
    const res = await sendOTP("recipient@xoxy.net")
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(res.valid).to.be.false;
  })

  it('validateOTP returns false for unknown email', async () => {
    const ok = await validateOTP("nobody@example.com", "123456");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(ok).to.be.false;
  })

  it('validateOTP returns false for wrong code and does not consume entry', async () => {
    const email = "validate-wrong@example.com";
    const send = await sendOTP(email);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(send.valid).to.be.true;

    const bad = await validateOTP(email, "000000");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(bad).to.be.false;

    // Entry must still be in Redis since the wrong code did not consume it.
    const keys = await mockRedis.keys('otp:*');
    expect(keys.length).to.equal(1);
  })

  it('validateOTP succeeds with the stored code and deletes the entry', async () => {
    const email = "validate-ok@example.com";
    const send = await sendOTP(email);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(send.valid).to.be.true;

    const keys = await mockRedis.keys('otp:*');
    expect(keys.length).to.equal(1);
    const raw = await mockRedis.get(keys[0]);
    const stored = JSON.parse(raw);
    expect(stored.code).to.have.lengthOf(6);

    const ok = await validateOTP(email, stored.code);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(ok).to.be.true;

    // Single-use: the entry must be gone.
    const after = await mockRedis.keys('otp:*');
    expect(after.length).to.equal(0);
  })

  it('OTP key hides the raw email (sha256 prefix)', async () => {
    const email = "leak-check@example.com";
    await sendOTP(email);
    const keys = await mockRedis.keys('otp:*');
    expect(keys.length).to.equal(1);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(keys[0].includes(email)).to.be.false;
  })
})
