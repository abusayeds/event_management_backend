import { Request } from 'express';
import { IDecodedToken } from './token.interface';

export interface AuthenticatedRequest extends Request {
  user?: IDecodedToken;
}
