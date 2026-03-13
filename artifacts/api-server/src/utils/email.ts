/**
 * Email utility — currently in "console-only" mode.
 * When an email provider is configured, replace the stub below with real sending logic.
 * Note: Gmail/SendGrid/Resend integration can be added later via environment secrets.
 */

export async function sendWelcomeEmail(opts: {
  to: string;
  forenames: string;
  username: string;
  resetToken: string;
  appBaseUrl: string;
}): Promise<{ sent: boolean; link: string }> {
  const link = `${opts.appBaseUrl}/user-login?token=${opts.resetToken}`;
  console.log(`[email] Welcome email skipped (no provider configured).`);
  console.log(`[email] Setup link for ${opts.username} → ${link}`);
  return { sent: false, link };
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  forenames: string;
  username: string;
  resetToken: string;
  appBaseUrl: string;
}): Promise<{ sent: boolean; link: string }> {
  const link = `${opts.appBaseUrl}/user-login?token=${opts.resetToken}`;
  console.log(`[email] Password reset email skipped (no provider configured).`);
  console.log(`[email] Reset link for ${opts.username} → ${link}`);
  return { sent: false, link };
}
