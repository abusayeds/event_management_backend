import nodemailer, { Transporter } from 'nodemailer';
import config from './index';

let transporter: Transporter | null = null;

const createTransporter = (): Transporter => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.username,
      pass: config.email.password,
    },
  });
};

export const getEmailTransporter = (): Transporter => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

export const verifyEmailConnection = async (): Promise<void> => {
  const emailTransporter = getEmailTransporter();
  await emailTransporter.verify();
};
