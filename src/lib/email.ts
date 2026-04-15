import { Resend } from "resend";

const FROM_EMAIL = process.env.FROM_EMAIL || "xreso <noreply@xreso.dev>";

function appUrl(pathname: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || "https://xreso.dev"}${pathname}`;
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

// ── Welcome Email ─────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string) {
  try {
    const resend = getResendClient();
    if (!resend) return;

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Welcome to xreso! 🎉",
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #FF4D6A; font-size: 28px; font-weight: 900; margin: 0;">xreso</h1>
          </div>
          <h2 style="color: #f0f0f5; font-size: 22px;">Welcome, ${name}! 👋</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6;">
            Thanks for joining the xreso community. You can now:
          </p>
          <ul style="color: #9ca3af; font-size: 15px; line-height: 1.8;">
            <li>📚 Browse and bookmark programming notes</li>
            <li>📤 Upload your own handwritten notes</li>
            <li>🏷️ Get full author credit and choose your license</li>
          </ul>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/browse" 
               style="background: #FF4D6A; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Start Browsing Notes
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 40px;">
            You retain copyright on all content you upload to xreso.
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send welcome email:", e);
  }
}

// ── Note Approved Email ───────────────────────────────
export async function sendNoteApprovedEmail(
  to: string,
  userName: string,
  noteTitle: string,
  noteId: string
) {
  try {
    const resend = getResendClient();
    if (!resend) return;

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your note "${noteTitle}" is now live! ✅`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #FF4D6A; font-size: 28px; font-weight: 900; margin: 0;">xreso</h1>
          </div>
          <h2 style="color: #f0f0f5; font-size: 22px;">Great news, ${userName}! 🎉</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6;">
            Your note <strong style="color: #f0f0f5;">"${noteTitle}"</strong> has been reviewed and 
            approved by our moderation team. It's now live and available for the community!
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/note/${noteId}" 
               style="background: #FF4D6A; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              View Your Note
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center;">
            Thanks for contributing to the xreso community!
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send note approved email:", e);
  }
}

// ── Note Rejected Email ───────────────────────────────
export async function sendNoteRejectedEmail(
  to: string,
  userName: string,
  noteTitle: string
) {
  try {
    const resend = getResendClient();
    if (!resend) return;

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Update on your note "${noteTitle}"`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #FF4D6A; font-size: 28px; font-weight: 900; margin: 0;">xreso</h1>
          </div>
          <h2 style="color: #f0f0f5; font-size: 22px;">Hi ${userName},</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6;">
            Unfortunately, your note <strong style="color: #f0f0f5;">"${noteTitle}"</strong> 
            did not meet our content guidelines and was not approved. 
          </p>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6;">
            Common reasons include: low image quality, copyrighted content, or incomplete notes. 
            Feel free to upload a revised version!
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/upload" 
               style="background: #FF4D6A; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Upload Again
            </a>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send rejection email:", e);
  }
}

// ── Password Reset Email ──────────────────────────────
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string
) {
  try {
    const resend = getResendClient();
    if (!resend) return;

    const resetLink = appUrl(`/reset-password/${resetToken}`);

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Reset your xreso password",
      text: `Hi ${name},\n\nWe received a request to reset your xreso password. Use this link to choose a new password:\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #FF4D6A; font-size: 28px; font-weight: 900; margin: 0;">xreso</h1>
          </div>
          <h2 style="color: #f0f0f5; font-size: 22px;">Reset your password, ${name}</h2>
          <p style="color: #9ca3af; font-size: 15px; line-height: 1.6;">
            We received a request to reset your xreso password. Click the button below to choose a new password.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background: #FF4D6A; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Reset Password
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.7; text-align: center; margin-bottom: 0;">
            If the button does not work, copy and paste this link into your browser:
          </p>
          <p style="color: #FF4D6A; font-size: 13px; line-height: 1.7; text-align: center; word-break: break-all; margin-top: 8px;">
            <a href="${resetLink}" style="color: #FF4D6A; text-decoration: underline;">${resetLink}</a>
          </p>
          <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
            This link will expire soon for your security. If you did not request this, you can ignore this email.
          </p>
          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 28px; word-break: break-all;">
            Or paste this link into your browser:<br />
            <span style="color: #9ca3af;">${resetLink}</span>
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send password reset email:", e);
  }
}
