// @ts-check
const { expect } = require('@playwright/test');

// MailDev runs as the `smtp` service on the docker network (deces-infra).
const maildevApiUrl = process.env.MAILDEV_API_URL || 'http://smtp:1080/email';

/**
 * Wait for the one-time password mailed to `address` and return it.
 * @param {string} address
 * @returns {Promise<string>}
 */
async function getOtp(address) {
  let code;
  await expect.poll(async () => {
    const response = await fetch(maildevApiUrl);
    expect(response.ok, `MailDev API status ${response.status}`).toBe(true);
    /** @type {Array<{to?: Array<{address: string}>, date: string, text?: string}>} */
    const emails = await response.json();
    const mail = emails
      .filter(email => (email.to || []).some(recipient => recipient.address === address))
      .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))[0];
    // e.g. "Votre code, valide 10 minutes : 123456"
    const match = mail?.text?.match(/Votre code,\s*valide\s+\d+\s+\S+\s*:\s*(\d{6})/);
    code = match?.[1];
    return code;
  }, { message: `OTP mail for ${address}`, timeout: 15_000, intervals: [1_000] }).toMatch(/^\d{6}$/);
  return /** @type {string} */ (code);
}

module.exports = { getOtp };
