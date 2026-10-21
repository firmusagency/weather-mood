import nodemailer from 'nodemailer';

/*
 * Optional email delivery for the evening message / plan-B note to the property's reception.
 * Configured with SMTP secrets (any provider: Gmail app password, Brevo, Resend SMTP, ...).
 * Without SMTP_HOST the scripts just write the files and skip sending.
 */
export interface MailEnv {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
}

export function mailEnv(env = process.env): MailEnv | null {
  if (!env.SMTP_HOST || !env.RECEPTION_EMAIL) return null;
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 587),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: env.RECEPTION_EMAIL,
  };
}

export async function sendMail(cfg: MailEnv, subject: string, text: string): Promise<void> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  await transport.sendMail({ from: cfg.from, to: cfg.to, subject, text });
}
