import { Resend } from 'resend';

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('RESEND_API_KEY is not defined in production');
    }
    return null;
  }
  return new Resend(apiKey);
};

export async function sendEmail({
  to,
  subject,
  html,
  domain,
}: {
  to: string | string[];
  subject: string;
  html: string;
  domain?: string;
}) {
  try {
    const resend = getResend();
    if (!resend) {
      console.warn('Skipping email send: RESEND_API_KEY not configured.');
      return { success: false, error: 'Email service not configured' };
    }

    const { data, error } = await resend.emails.send({
      from: domain?.includes('zonadelvestir') 
        ? 'Zona del Vestir <noreply@modazapotlanejo.com>'
        : domain?.includes('kalexa')
          ? 'Kalexa Fashion <noreply@modazapotlanejo.com>'
          : 'Moda Zapotlanejo <noreply@modazapotlanejo.com>',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email utility error:', error);
    return { success: false, error };
  }
}
