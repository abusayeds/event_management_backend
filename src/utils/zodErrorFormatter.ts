import { ZodIssue } from 'zod';

export const formatZodField = (path: PropertyKey[]): string => {
  const normalizedPath =
    path[0] === 'body' || path[0] === 'params' || path[0] === 'query' || path[0] === 'cookies'
      ? path.slice(1)
      : path;

  return normalizedPath.length > 0 ? normalizedPath.map(String).join('.') : 'request';
};

export const formatZodMessage = (issue: ZodIssue, field: string): string => {
  if (
    issue.code === 'invalid_type' &&
    issue.message.toLowerCase().includes('received undefined') &&
    field !== 'request'
  ) {
    return `${field} is required`;
  }

  return issue.message;
};

export const buildCombinedMessage = (messages: string[]): string => {
  const uniqueMessages = Array.from(new Set(messages.map(msg => msg.trim()).filter(Boolean)));

  return uniqueMessages.length > 0 ? uniqueMessages.join(', ') : 'Validation failed';
};
