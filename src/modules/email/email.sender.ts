import config from '../../config';
import { getEmailTransporter } from '../../config/email';
import { IEmailOptions } from './email.interface';

const sendEmail = async (options: IEmailOptions): Promise<void> => {
  const transporter = getEmailTransporter();

  const mailOptions = {
    from: config.email.emailFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
