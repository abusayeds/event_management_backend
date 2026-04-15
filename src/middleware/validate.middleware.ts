import { NextFunction, Request, Response } from 'express';
import { ZodObject, ZodRawShape } from 'zod';

const validateRequest =
  (schema: ZodObject<ZodRawShape>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body ?? {},
        params: req.params ?? {},
        query: req.query ?? {},
        cookies: req.cookies ?? {},
      })) as {
        body?: unknown;
        params?: unknown;
        query?: unknown;
        cookies?: unknown;
      };

      if (parsed.body && typeof parsed.body === 'object') {
        req.body = parsed.body as Request['body'];
      }

      if (parsed.params && typeof parsed.params === 'object') {
        Object.assign(req.params, parsed.params);
      }

      if (parsed.query && typeof parsed.query === 'object') {
        Object.assign(req.query, parsed.query);
      }

      if (parsed.cookies && typeof parsed.cookies === 'object') {
        Object.assign(req.cookies, parsed.cookies);
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export default validateRequest;
