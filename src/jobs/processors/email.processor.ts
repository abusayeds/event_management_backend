import { sendEmail } from '../../utils/sendEmail';
import { EmailJobData } from '../queues/email.queue';

export const sendEmailProcessor = async (data: EmailJobData): Promise<void> => {
  const { to, subject, template, data: templateData } = data;
  
  try {
    // In a real application, you would use an email template engine
    // For now, we'll use a simple text email
    const htmlContent = generateEmailTemplate(template, templateData, subject);
    
    await sendEmail({
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlContent,
    });
    
    console.log(`Email sent successfully to: ${Array.isArray(to) ? to.join(', ') : to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

// Simple email template generator
const generateEmailTemplate = (template: string, data?: Record<string, any>, subject?: string): string => {
  switch (template) {
    case 'welcome':
      return `
        <h1>Welcome to Dawabuyi!</h1>
        <p>Thank you for joining our platform. ${data?.name ? `Hello ${data.name},` : ''}</p>
        <p>We're excited to have you on board.</p>
        <p>Best regards,<br/>The Dawabuyi Team</p>
      `;
    
    case 'verification':
      return `
        <h1>Email Verification</h1>
        <p>Your verification code is: <strong>${data?.otp || 'N/A'}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `;
    
    case 'password-reset':
      return `
        <h1>Password Reset</h1>
        <p>Your password reset code is: <strong>${data?.otp || 'N/A'}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `;
    
    default:
      return `
        <h1>${subject}</h1>
        <p>${data?.message || 'No content available'}</p>
      `;
  }
};
