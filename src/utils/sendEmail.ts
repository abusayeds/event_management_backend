import config from '../config';
import { getEmailTransporter } from '../config/email';

interface EmailOptions {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const transporter = getEmailTransporter();

  const mailOptions = {
    from: config.email.emailFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  await transporter.sendMail(mailOptions);
};

export const sendVerificationEmail = async (email: string, otp: string): Promise<void> => {
  await sendEmail({
    to: [email],
    subject: 'Verify Your Email Address',
    html: `
      <h2>Email Verification</h2>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `,
    text: `Your verification code is: ${otp}`,
  });
};

export const sendWelcomeEmail = async (email: string, fullName: string): Promise<void> => {
  await sendEmail({
    to: [email],
    subject: 'Welcome to Dawabuyi!',
    html: `
      <h2>Welcome to Dawabuyi, ${fullName}!</h2>
      <p>Thank you for registering with us. Your account has been successfully created.</p>
      <p>You can now start using our services.</p>
    `,
    text: `Welcome to Dawabuyi, ${fullName}! Your account has been successfully created.`,
  });
};

export const sendResetPasswordEmail = async (email: string, otp: string): Promise<void> => {
  await sendEmail({
    to: [email],
    subject: 'Reset Your Password',
    html: `
      <h2>Password Reset</h2>
      <p>Your password reset code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
    text: `Your password reset code is: ${otp}`,
  });
};
