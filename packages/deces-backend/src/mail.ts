import nodemailer  from 'nodemailer';
import { ReviewStatus, sendOTPResponse } from './models/entities';
import loggerStream from './logger';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { getRedisClient } from './redisClient';

interface MailConfig {
  host: string;
  port: number;
  tls: {
    rejectUnauthorized: boolean;
  };
  auth?: {
    user: string;
    pass: string;
  };
}

let disposableMails: string[] = [];

try {
  disposableMails = readFileSync(`${process.env.DISPOSABLE_MAIL}`,'utf8').split("\n");
} catch(e) {
  // eslint-disable-next-line no-console
  console.log('Failed loading disposable email',e);
}

const mailConfig: MailConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  tls: {
    rejectUnauthorized: process.env.SMTP_TLS_SELFSIGNED ? false : true,
  },
 };

if (process.env.SMTP_PWD !== undefined) {
  mailConfig.auth = {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PWD
  }
}

const transporter = nodemailer.createTransport(mailConfig);

const log = (json:any) => {
    loggerStream.write(JSON.stringify({
      "backend": {
        "server-date": new Date(Date.now()).toISOString(),
        ...json
      }
    }));
}

interface OTPEntry {
  code: string;
  lastSendTime?: number;
  recentSendCount: number;
}

const OTP_RATE_LIMIT_MS = 60000; // 1 minute base rate limit
const OTP_EXPIRE_MS = 6 * 60 * 60 * 1000; // 6 hours
const OTP_EXPIRE_TOLERANCE_MS = 60 * 1000; // 60 seconds
const OTP_TTL_SECONDS = Math.floor(OTP_EXPIRE_MS / 1000); // Redis SET EX value

// OTP_EXPIRE_TOLERANCE_MS is kept as an exported-shape constant so the previous
// behaviour is documented; with Redis TTL handling expiry, it is no longer
// applied to a JS setTimeout. Reads after key expiry return null automatically.
void OTP_EXPIRE_TOLERANCE_MS;

const otpKey = (email: string): string => {
  // sha256(email) so a Redis dump never leaks the raw address. Same hash space
  // as the subject-line short hash already in use, full 64 hex chars to keep
  // collisions vanishingly unlikely.
  const digest = crypto.createHash('sha256').update(email).digest('hex');
  return `otp:${digest}`;
};

const readOtpEntry = async (email: string): Promise<OTPEntry | null> => {
  const redis = getRedisClient();
  const raw = await redis.get(otpKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OTPEntry;
  } catch (e) {
    // Corrupted entry — treat as absent so the caller regenerates.
    log({ warn: 'Corrupted OTP entry in Redis', details: (e && (e as Error).message) });
    return null;
  }
};

const writeOtpEntry = async (email: string, entry: OTPEntry): Promise<void> => {
  const redis = getRedisClient();
  await redis.set(otpKey(email), JSON.stringify(entry), 'EX', OTP_TTL_SECONDS);
};

const deleteOtpEntry = async (email: string): Promise<void> => {
  const redis = getRedisClient();
  await redis.del(otpKey(email));
};

const generateOtpCode = (): string => {
    const digits = '0123456789';
    let tmp = '';
    for (let i = 0; i < 6; i++ ) {
        tmp += digits[Math.floor(Math.random() * 10)];
    }
    return tmp;
}

export const sendOTP = async (email: string): Promise<sendOTPResponse> => {
    try {
      const provider = email.split("@")[1].toLowerCase();
      if (disposableMails.includes(provider)) {
        return {
          msg: "Le courriel fourni appartient à un fournisseur d'addresses temporaires",
          valid: false
        };
      }

      let existing: OTPEntry | null;
      try {
        existing = await readOtpEntry(email);
      } catch (err) {
        // Graceful degradation: Redis unreachable. Refuse the request rather
        // than crash the pod or silently bypass the rate-limit.
        log({ error: 'Redis unreachable in sendOTP (read)', details: (err && (err as Error).message) });
        return {
          msg: "Service temporairement indisponible",
          valid: false
        };
      }

      if (existing && existing.lastSendTime) {
        const timeSinceLastSend = Date.now() - existing.lastSendTime;
        const effectiveCount = Math.max(0, existing.recentSendCount - 1);
        const rateLimit = OTP_RATE_LIMIT_MS * Math.pow(2, effectiveCount);

        if (timeSinceLastSend < rateLimit) {
          const secondsLeft = Math.ceil((rateLimit - timeSinceLastSend) / 1000);
          const maxSecondsLeft = Math.ceil(OTP_EXPIRE_MS / 1000);
          const clampedSecondsLeft = Math.min(secondsLeft, maxSecondsLeft);
          if (clampedSecondsLeft > 120) {
            const minutesLeft = Math.ceil(clampedSecondsLeft / 60);
            return {
              msg: `Veuillez attendre ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} avant de demander à nouveau un code`,
              valid: false
            };
          }
          return {
            msg: `Veuillez attendre ${clampedSecondsLeft} seconde${clampedSecondsLeft > 1 ? 's' : ''} avant de demander à nouveau un code`,
            valid: false
          };
        }
      }

      const code = generateOtpCode();
      const hash = crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);
      await transporter.sendMail({
          subject: `Validez votre identité - ${process.env.APP_DNS} - ${hash}`,
          text: `Votre code, valide 6 heures: ${code}`,
          from: process.env.API_EMAIL,
          to: `${email}`,
      } as any);

      const entry: OTPEntry = {
        code,
        lastSendTime: Date.now(),
        recentSendCount: (existing?.recentSendCount ?? 0) + 1
      };
      try {
        await writeOtpEntry(email, entry);
      } catch (err) {
        // Mail already left — but we cannot validate without persistence.
        // Surface the failure rather than pretending success.
        log({ error: 'Redis unreachable in sendOTP (write)', details: (err as any)?.message });
        return {
          msg: "Service temporairement indisponible",
          valid: false
        };
      }
      return {
        msg: "Un code vous a été envoyé à l'adresse indiquée",
        valid: true
      };
    } catch (err) {
        log({
            error: "SendOTP error",
            details: err
        });
        return {
          msg: `Erreur lors de l'envoi du code par mail`,
          valid: false
        };
    }
}

export const validateOTP = async (email: string, otp: string): Promise<boolean> => {
    if (!otp) return false;
    try {
        const entry = await readOtpEntry(email);
        if (entry && entry.code === otp) {
            await deleteOtpEntry(email);
            return true;
        }
    } catch (err) {
        log({ error: 'Redis unreachable in validateOTP', details: (err as any)?.message });
        return false;
    }
    return false;
}

export const sendJobUpdate = async (email:string, content: string, jobId: string): Promise<boolean> => {
    try {
        const message: any = {
            from: process.env.API_EMAIL,
            to: `${email}`,
        }
        message.subject = `Traitement sur un fichier - ${process.env.APP_DNS}`;
        message.text = `${content ? 'Traitement fichier: ' + content : ''}\nVous pouvez consulter le status du traitement <a href="${process.env.APP_URL}/link?job=${jobId}"></a>ici.<br>`
        message.html = `<html style="font-family:Helvetica;">
              <h4> Traitement d'un fichier </h4>
              Vous avez lancé une tache d'appariement,<br>
              <br>
              ${content ? '<br>' + content + '<br>' : ''}<br>
              Vous pouvez consulter le status du traitement <a href="${process.env.APP_URL}/link?job=${jobId}">en utilisant ce lien</a>.<br>
              <br>
              l'équipe matchID
              </html>
              `
        await transporter.sendMail(message);
        return true;
    } catch (err) {
        return false;
    }
}


export const sendUpdateConfirmation = async (email:string, status: ReviewStatus, rejectMsg: string, id: string): Promise<boolean> => {
    try {
        const message: any = {
            from: process.env.API_EMAIL,
            to: `${email}`,
        }
        if (status === 'validated') {
            message.subject = `Suggestion validée ! - ${process.env.APP_DNS}`;
            message.attachment = { data: `<html style="font-family:Helvetica;">
            <h4> Merci de votre contibution !</h4>
            Votre proposition de correction a été acceptée.<br>
            Retrouvez <a href="${process.env.APP_URL}/id/${id}"> la fiche modifiée </a>.<br>
            <br>
            Vous pouvez à tout moment <a href="${process.env.APP_URL}/edits">revenir sur vos contributions</a>.<br>
            <br>
            l'équipe matchID
            </html>
            `, alternative: true};
        } else if (status === 'rejected') {
            message.subject = `Suggestion incomplète - ${process.env.APP_DNS}`;
            message.attachment = { data: `<html style="font-family:Helvetica;">
            Nous vous remercions de votre contribution,<br>
            <br>
            Néanmoins les éléments fournis ne nous ont pas permis de retenir votre proposition à ce stade.<br>
            ${rejectMsg ? '<br>' + rejectMsg + '<br>' : ''}<br>
            Vous pourrez de nouveau soumettre une nouvelle proposition sur la fiche <a href="${process.env.APP_URL}/edits#${id}">ici</a>.<br>
            <br>
            l'équipe matchID
            </html>
            `, alternative: true};
        }
        await transporter.sendMail(message);
        return true;
    } catch (err) {
        return false;
    }
}
