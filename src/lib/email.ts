import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "xreso <noreply@xreso.dev>";

// ── Welcome Email ─────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string) {
  try {
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
