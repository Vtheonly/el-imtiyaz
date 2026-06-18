import { logger } from '../logger/logger';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
}

/**
 * Sends an email using the Resend HTTP API.
 * Uses native fetch (supported in Node v18+).
 */
export async function sendEmailWithResend(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY || 're_cVpZJBHd_BUZ5qcdpnX2jTCv9gyuS5VVw';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  
  const toList = Array.isArray(options.to) ? options.to : [options.to];

  logger.info('email.resend.sending', { to: toList, subject: options.subject });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `El-Imtiyaz School <${fromEmail}>`,
        to: toList,
        subject: options.subject,
        html: options.body.replace(/\n/g, '<br />') // Simple text to html conversion
      })
    });

    const data = await response.json() as any;

    if (!response.ok) {
      const errorMsg = data?.message || `HTTP ${response.status} ${response.statusText}`;
      logger.error('email.resend.error', { error: errorMsg, response: data });
      return { success: false, error: errorMsg };
    }

    logger.info('email.resend.success', { id: data.id });
    return { success: true, id: data.id };
  } catch (err) {
    const errorMsg = (err as Error).message;
    logger.error('email.resend.failed', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}
