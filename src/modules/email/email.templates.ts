import emailQueue from '../../jobs/queues/email.queue';

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
      color: #9300D3;
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
      color: #9300D3;
      text-align: center;
      padding: 18px;
      background: #FFFFFF;
      border: 2px dashed #9300D3;
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
      color: #9300D3;
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
      background: linear-gradient(135deg, #9300D3 0%, #7a00b0 100%);
      color: #FFFFFF !important;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(147, 0, 211, 0.3);
      transition: all 0.3s ease;
    }

    .button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(147, 0, 211, 0.4);
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
              <img src="https://talenzy.s3.us-east-1.amazonaws.com/common/logo.png" alt="Talenzy" />
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
              <p class="footer-logo">Talenzy</p>
              <p style="margin: 8px 0;">
                <a href="mailto:contact@talenzy.app">contact@talenzy.app</a>
              </p>
              
              <!-- Social Media Links -->
              <div class="social-links">
                <a href="https://www.facebook.com/profile.php?id=61584142130553" target="_blank" rel="noopener">
                  <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" />
                </a>
                <a href="https://x.com/TalenzyApp" target="_blank" rel="noopener">
                  <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter" />
                </a>
                 <a href="https://www.youtube.com/@talenzyapp" target="_blank" rel="noopener">
                    <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" />
                 </a>
              </div>
              
              <p style="margin-top: 16px; color: #a0aec0; font-size: 11px;">
                © ${new Date().getFullYear()} Talenzy. All rights reserved.
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

const generateOTPSection = (otp: string, minutes: number = 30) => `
  <p>Please enter the following verification code to proceed:</p>
  <div class="otp-code">${otp}</div>
  <p style="text-align: center; color: #718096; font-size: 13px;">This code will expire in ${minutes} minutes</p>
`;

const generateHighlightBox = (html: string) => `
  <div class="highlight-box">${html}</div>
`;

const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  const subject = 'Welcome to Talenzy!';
  const content = `
    <h2>Welcome to Talenzy, ${name}!</h2>
    <p>We're excited to have you join our community of talented creators and enthusiasts.</p>
    ${generateHighlightBox(`
      <p><strong>What you can do on Talenzy:</strong></p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Share your photos and videos with the world</li>
        <li>Discover and connect with talented creators</li>
        <li>Hire talents for events or projects</li>
        <li>Send gifts to support your favorite creators</li>
      </ul>
    `)}
    <p>Start exploring and showcasing your talent today!</p>
    <p>If you have any questions, feel free to reach out to us at <a href="mailto:contact@talenzy.app" style="color: #9300D3;">contact@talenzy.app</a></p>
  `;

  const html = generateProfessionalEmailTemplate(content, {
    title: 'Welcome to Talenzy',
    preheader: `Welcome ${name}! Start your journey on Talenzy.`,
  });

  await emailQueue.add('sendEmail', { to, subject, html }, { priority: 5 });
};
const sendVerificationEmail = async (to: string, otp: string): Promise<void> => {
  const subject = 'Email Verification - Your OTP Code';
  const content = `
    <p>Thank you for signing up! Please use the One-Time Password (OTP) below to verify your email address:</p>
    ${generateOTPSection(otp, 30)}
  `;

  const html = generateProfessionalEmailTemplate(content, {
    title: 'Email Verification',
    preheader: `Your verification code: ${otp}`,
  });

  // High priority for OTP emails
  await emailQueue.add('sendEmail', { to, subject, html }, { priority: 1 });
};

const sendResetPasswordEmail = async (to: string, otp: string): Promise<void> => {
  const subject = 'Password Reset Request - Your OTP Code';
  const content = `
    <p>You requested to reset your password. Please use the One-Time Password (OTP) below to proceed:</p>
    ${generateOTPSection(otp, 30)}
  `;

  const html = generateProfessionalEmailTemplate(content, {
    title: 'Password Reset Request',
    preheader: `Your password reset code: ${otp}`,
  });

  // High priority for password reset emails
  await emailQueue.add('sendEmail', { to, subject, html }, { priority: 1 });
};


export const emailTemplates = {
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
