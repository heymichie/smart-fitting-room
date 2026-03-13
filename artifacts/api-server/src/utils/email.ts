/**
 * Email utility — powered by Gmail via the Replit Google Mail connector.
 * getUncachableGmailClient() is called fresh on every send (tokens expire).
 */

let _getClient: (() => Promise<any>) | null = null;

async function loadGmailClient() {
  if (_getClient) return _getClient();
  try {
    // Dynamically import the generated Gmail connector snippet
    const mod = await import("./gmail-client.js");
    _getClient = mod.getUncachableGmailClient;
    return _getClient!();
  } catch {
    return null;
  }
}

export async function sendWelcomeEmail(opts: {
  to: string;
  forenames: string;
  username: string;
  resetToken: string;
  appBaseUrl: string;
}) {
  const { to, forenames, username, resetToken, appBaseUrl } = opts;
  const link = `${appBaseUrl}/user-login?token=${resetToken}`;

  const subject = "Welcome to Smart Fitting Room — Set Your Password";
  const body = [
    `Hello ${forenames},`,
    "",
    "Your Smart Fitting Room account has been created.",
    `Your username is: ${username}`,
    "",
    "Click the link below to set your password and activate your account:",
    link,
    "",
    "This link expires in 48 hours.",
    "",
    "If you did not expect this email, please contact your store manager.",
    "",
    "— Smart Fitting Room System",
  ].join("\n");

  const gmail = await loadGmailClient();
  if (!gmail) {
    console.log("[email] Gmail not yet connected — would have sent to:", to);
    console.log("[email] Reset link:", link);
    return { sent: false, link };
  }

  try {
    const raw = makeRawEmail({ to, subject, body });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    console.log("[email] Welcome email sent to:", to);
    return { sent: true, link };
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return { sent: false, link };
  }
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  forenames: string;
  username: string;
  resetToken: string;
  appBaseUrl: string;
}) {
  const { to, forenames, username, resetToken, appBaseUrl } = opts;
  const link = `${appBaseUrl}/user-login?token=${resetToken}`;

  const subject = "Smart Fitting Room — Password Reset";
  const body = [
    `Hello ${forenames},`,
    "",
    "A password reset was requested for your account.",
    `Your username is: ${username}`,
    "",
    "Click the link below to set a new password:",
    link,
    "",
    "This link expires in 48 hours. If you did not request this, please ignore this email.",
    "",
    "— Smart Fitting Room System",
  ].join("\n");

  const gmail = await loadGmailClient();
  if (!gmail) {
    console.log("[email] Gmail not yet connected — would have sent to:", to);
    console.log("[email] Reset link:", link);
    return { sent: false, link };
  }

  try {
    const raw = makeRawEmail({ to, subject, body });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    console.log("[email] Password reset email sent to:", to);
    return { sent: true, link };
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return { sent: false, link };
  }
}

function makeRawEmail(opts: { to: string; subject: string; body: string }): string {
  const { to, subject, body } = opts;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  const message = messageParts.join("\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
