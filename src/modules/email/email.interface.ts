export interface IEmailOptions {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path: string;
    cid?: string;
  }>;
}
