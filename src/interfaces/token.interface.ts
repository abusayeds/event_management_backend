export interface IDecodedToken {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
