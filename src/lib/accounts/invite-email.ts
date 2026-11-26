// The invite email: plain, warm, and says exactly how to sign in — the site
// uses a typed code, so the email explains that rather than linking to a
// magic URL (links in email get pre-fetched by security scanners and spent
// before the person clicks; see components/SignInFields.tsx).

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.weddingsweddings.co.uk").replace(/\/$/, "");
}

export function inviteEmail({
  fullName,
  email,
  reason,
  coupleName,
  baseUrl,
}: {
  fullName: string | null;
  email: string;
  reason: "new" | "reset";
  coupleName: string;
  baseUrl?: string;
}): { subject: string; html: string } {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "there";
  const loginUrl = `${(baseUrl ?? siteUrl()).replace(/\/$/, "")}/login`;
  const intro =
    reason === "reset"
      ? "Your sign-in on our wedding site has been reset — any old password no longer works, and you&rsquo;ve been signed out everywhere. Here&rsquo;s how to get back in:"
      : "We&rsquo;ve set you up with an account on our wedding site &mdash; RSVPs, plans and everything you need for the big day. Here&rsquo;s how to sign in:";

  const html = `
<div style="background-color:#faf6ef; padding:40px 20px; font-family: Georgia, 'Times New Roman', serif; color:#2b2620;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr><td style="text-align:center; padding-bottom:8px;">
      <p style="margin:0; font-size:12px; letter-spacing:3px; text-transform:uppercase; color:#574f43;">${escapeHtml(coupleName)}</p>
    </td></tr>
    <tr><td style="padding:20px 8px 8px; text-align:center;">
      <h1 style="margin:0; font-size:24px; font-weight:normal;">Hi ${escapeHtml(first)},</h1>
    </td></tr>
    <tr><td style="padding:8px 16px 0;">
      <p style="margin:0; font-size:15px; line-height:1.6; color:#574f43;">${intro}</p>
      <ol style="margin:16px 0 0 0; padding-left:20px; font-size:15px; line-height:1.7; color:#574f43;">
        <li>Go to <a href="${escapeHtml(loginUrl)}" style="color:#4c6b52;">${escapeHtml(loginUrl.replace(/^https?:\/\//, ""))}</a></li>
        <li>Enter this email address: <strong>${escapeHtml(email)}</strong></li>
        <li>Tap <strong>Send my code</strong>, then type in the code we email you.</li>
      </ol>
      <p style="margin:16px 0 0 0; font-size:14px; line-height:1.6; color:#8a8174;">
        The code is sent separately a moment later &mdash; check your spam folder if it doesn&rsquo;t show up.
        Once you&rsquo;re in you can set a password from <em>My Details</em> if you&rsquo;d rather not use codes.
      </p>
    </td></tr>
    <tr><td style="padding:24px 16px 0; text-align:center;">
      <p style="margin:0; font-size:13px; color:#8a8174;">With love, ${escapeHtml(coupleName)}</p>
    </td></tr>
  </table>
</div>`;

  return {
    subject: reason === "reset" ? `Your sign-in on ${coupleName}\u2019s wedding site` : `You\u2019re invited to ${coupleName}\u2019s wedding site`,
    html,
  };
}
