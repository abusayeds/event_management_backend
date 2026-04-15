import path from 'path';
import config from '../../config';
import emailQueue from '../../jobs/queues/email.queue';

const APP_NAME = 'Daiwabui';
const BRAND_COLOR = '#4C7E95';
const CONTACT_EMAIL = 'support@daiwabui.com';
const LOGO_CID = 'daiwabui-logo';
const LOGO_FILE_PATH = path.join(process.cwd(), 'assets', 'logo', 'daiwabuyi.png');
const OTP_EXPIRY_MINUTES = config.auth.otpExpiryMinutes;

const getLogoAttachment = () => [
  {
    filename: 'daiwabuyi.png',
    path: LOGO_FILE_PATH,
    cid: LOGO_CID,
  },
];


const generateProfessionalEmailTemplate = (
  content: string,
  options: { title: string; preheader?: string }
): string => {
  const { title, preheader = '' } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #F6F6F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #2d3748;
      line-height: 1.6;
    }
    table { border-collapse: collapse; }

    .email-wrapper {
      background: #F6F6F6;
       padding: 40px 20px;
    }

    .container {
      max-width: 520px;
       margin: 30px auto; 
      background-color: #FFFFFF;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .logo-section {
      text-align: center;
      padding: 15px;
      background: #FFFFFF;
      border-bottom: 1px solid #e2e8f0;
    }

    .logo-section img {
      max-width: 100px;
      height: auto;
      display: inline-block;
    }

    .content {
      padding: 32px 28px;
      font-size: 15px;
      color: #4a5568;
    }

    .content h2 {
      color: ${BRAND_COLOR};
      font-size: 20px;
      margin: 0 0 16px 0;
      font-weight: 600;
      letter-spacing: -0.3px;
    }

    .content p {
      margin: 0 0 14px;
      color: #4a5568;
    }

    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 6px;
      color: ${BRAND_COLOR};
      text-align: center;
      padding: 18px;
      background: #FFFFFF;
      border: 2px dashed ${BRAND_COLOR};
      border-radius: 8px;
      margin: 20px 0;
    }

    .highlight-box {
      padding: 18px 20px;
      margin: 20px 0;
      border-radius: 6px;
      font-size: 14px;
    }

    .highlight-box p {
      margin: 0 0 10px;
    }

    .highlight-box ul {
      margin: 8px 0;
      padding-left: 20px;
    }

    .highlight-box li {
      margin-bottom: 6px;
      color: #4a5568;
    }

    .credentials-table {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin: 18px 0;
      font-size: 14px;
    }

    .credentials-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #edf2f7;
    }

    .credentials-table tr:last-child td {
      border-bottom: none;
    }

    .credentials-table td:first-child {
      background-color: #f7fafc;
      font-weight: 600;
      width: 38%;
      color: #2d3748;
    }

    .credentials-table td:last-child {
      color: #4a5568;
    }

    .footer {
      background: #FFFFFF;
      padding: 20px 28px;
      text-align: center;
      font-size: 13px;
      color: #718096;
      border-top: 1px solid #e2e8f0;
    }

    .footer p {
      margin: 0 0 6px;
    }

    .footer a {
      color: ${BRAND_COLOR};
      text-decoration: none;
      font-weight: 500;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    .footer-logo {
      font-weight: 700;
      font-size: 14px;
      color: #2d3748;
      margin-bottom: 8px;
    }

    .footer-tagline {
      color: #a0aec0;
      font-size: 12px;
      font-style: italic;
      margin-top: 12px;
    }

    .social-links {
      margin: 16px 0;
    }

    .social-links a {
      display: inline-block;
      margin: 0 8px;
      transition: transform 0.2s ease;
    }

    .social-links a:hover {
      transform: translateY(-2px);
    }

    .social-links img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }

    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #3d6678 100%);
      color: #FFFFFF !important;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(76, 126, 149, 0.3);
      transition: all 0.3s ease;
    }

    .button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(76, 126, 149, 0.4);
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .badge-approved {
      background: #d1fae5;
      color: #065f46;
    }

    .badge-rejected {
      background: #fee2e2;
      color: #991b1b;
    }

    @media (max-width: 600px) {
      .email-wrapper { padding: 24px 12px; }
      .container { margin: 0; border-radius: 8px; }
      .logo-section { padding: 20px 16px 16px; }
      .logo-section img { max-width: 80px; }
      .content { padding: 24px 20px; font-size: 14px; }
      .content h2 { font-size: 18px; }
      .footer { padding: 20px 20px; }
      .otp-code { font-size: 24px; letter-spacing: 4px; padding: 16px; }
      .credentials-table { font-size: 13px; }
      .credentials-table td { padding: 8px 12px; }
      .social-links img { width: 28px; height: 28px; }
    }
  </style>
</head>
<body>
  ${
    preheader
      ? `<div style="display:none;font-size:1px;color:#f5f7fa;line-height:1px;max-height:0;overflow:hidden;">${preheader}</div>`
      : ''
  }

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper">
    <tr>
      <td align="center">
        <table class="container" role="presentation">
          <!-- Logo -->
          <tr>
            <td class="logo-section">
              <img src="cid:${LOGO_CID}" alt="${APP_NAME}" />
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <p class="footer-logo">${APP_NAME}</p>
              <p style="margin: 8px 0;">
                <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
              </p>

              <p style="margin-top: 16px; color: #a0aec0; font-size: 11px;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const generateOTPSection = (otp: string, minutes: number = OTP_EXPIRY_MINUTES) => `
  <p>Please enter the following verification code to proceed:</p>
  <div class="otp-code">${otp}</div>
  <p style="text-align: center; color: #718096; font-size: 13px;">This code will expire in ${minutes} minutes</p>
`;

const generateHighlightBox = (html: string) => `
  <div class="highlight-box">${html}</div>
`;

const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  const subject = `Welcome to ${APP_NAME}!`;
  const content = `
    <h2>Welcome to ${APP_NAME}, ${name}!</h2>
    <p>Thank you for joining ${APP_NAME}, a public knowledge-style event platform designed for parents and families.</p>
    ${generateHighlightBox(`
      <p><strong>What you can do on ${APP_NAME}:</strong></p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Create and publish public events like competitions, concerts, performances, and shows</li>
        <li>Track repeating events where each repetition is a new session</li>
        <li>Edit and verify event sessions with transparent public change history</li>
        <li>Contribute to event quality and grow your contribution score</li>
        <li>Manage family members and shared family event activity</li>
      </ul>
    `)}
    <p>All events are public, community-driven, and designed for collective contribution.</p>
    <p>If you have any questions, reach us at <a href="mailto:${CONTACT_EMAIL}" style="color: ${BRAND_COLOR};">${CONTACT_EMAIL}</a></p>
  `;

  const html = generateProfessionalEmailTemplate(content, {
    title: `Welcome to ${APP_NAME}`,
    preheader: `Welcome ${name}! Start exploring public event sessions on ${APP_NAME}.`,
  });

  await emailQueue.add('sendEmail', { to, subject, html, attachments: getLogoAttachment() }, { priority: 5 });
};
const sendVerificationEmail = async (to: string, otp: string): Promise<void> => {
  const subject = `${APP_NAME} Email Verification - Your OTP Code`;
  const content = `
    <h2>Verify Your Email</h2>
    <p>Use the One-Time Password (OTP) below to verify your ${APP_NAME} account and continue setting up your profile.</p>
    ${generateOTPSection(otp)}
    <p style="font-size: 13px; color: #718096;">If you did not request this, you can safely ignore this email.</p>
  `;

  const html = generateProfessionalEmailTemplate(content, {
    title: 'Email Verification',
    preheader: `Your verification code: ${otp}`,
  });

  // High priority for OTP emails
  await emailQueue.add('sendEmail', { to, subject, html, attachments: getLogoAttachment() }, { priority: 1 });
};

const sendResetPasswordEmail = async (to: string, otp: string): Promise<void> => {
  const subject = `${APP_NAME} Password Reset - Your OTP Code`;
  const content = `
    <h2>Reset Your Password</h2>
    <p>Use the One-Time Password (OTP) below to continue your password reset request.</p>
    ${generateOTPSection(otp)}
    <p style="font-size: 13px; color: #718096;">For security, only continue if you initiated this request.</p>
  `;

  const html = generateProfessionalEmailTemplate(content, {
    title: 'Password Reset Request',
    preheader: `Your password reset code: ${otp}`,
  });

  // High priority for password reset emails
  await emailQueue.add('sendEmail', { to, subject, html, attachments: getLogoAttachment() }, { priority: 1 });
};


export const emailTemplates = {
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
