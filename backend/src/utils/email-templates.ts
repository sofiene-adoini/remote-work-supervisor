interface ResetPasswordEmailOptions {
  resetUrl: string;
  intro: string;
  note: string;
}

const FOOTER = `
  <tr>
    <td align="center" style="padding:24px 0 0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Assas — Remote Work Supervisor</p>
    </td>
  </tr>
`;

const WRAPPER_OPEN = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;min-height:100vh;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td align="center" style="padding:0 0 32px;">
                <span style="font-size:24px;font-weight:800;color:#1e293b;letter-spacing:-0.03em;">Assas</span>
              </td>
            </tr>
`;

const WRAPPER_CLOSE = `
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;

export function buildResetPasswordEmail({ resetUrl, intro, note }: ResetPasswordEmailOptions): string {
  return `
    ${WRAPPER_OPEN}
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.06);">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e293b;">Reset your password</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748b;">
          ${intro}
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr>
            <td align="center" style="background-color:#2563eb;border-radius:8px;padding:12px 32px;">
              <a href="${resetUrl}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
                Reset password
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#94a3b8;">
          Or copy this link into your browser:
        </p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">
          <a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
        <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">
          ${note}
        </p>
      </td>
    </tr>
    ${FOOTER}
    ${WRAPPER_CLOSE}
  `.trim();
}

export function buildWelcomeEmail(fullName: string, setPasswordUrl: string): string {
  return `
    ${WRAPPER_OPEN}
    <tr>
      <td style="background-color:#ffffff;border-radius:12px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.06);">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e293b;">Welcome, ${fullName}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748b;">
          Your Assas account has been created. Click the button below to set your password and get started.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr>
            <td align="center" style="background-color:#2563eb;border-radius:8px;padding:12px 32px;">
              <a href="${setPasswordUrl}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
                Set your password
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#94a3b8;">Or copy this link into your browser:</p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">
          <a href="${setPasswordUrl}" style="color:#2563eb;">${setPasswordUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
        <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">
          If this wasn't you, you can safely ignore this email.
        </p>
      </td>
    </tr>
    ${FOOTER}
    ${WRAPPER_CLOSE}
  `.trim();
}
