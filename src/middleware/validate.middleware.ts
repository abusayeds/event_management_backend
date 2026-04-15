import { NextFunction, Request, Response } from 'express';
import { ZodObject, ZodRawShape } from 'zod';

const validateRequest =
  (schema: ZodObject<ZodRawShape>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body ?? {},
        params: req.params,
        query: req.query,
        cookies: req.cookies,
      })) as {
        body?: unknown;
        params?: unknown;
        query?: unknown;
        cookies?: unknown;
      };

      req.body = parsed.body;
      req.params = (parsed.params ?? req.params) as Request['params'];
      req.query = (parsed.query ?? req.query) as Request['query'];

      next();
    } catch (error) {
      next(error);
    }
  };

export default validateRequest;
