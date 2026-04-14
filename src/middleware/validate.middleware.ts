import { NextFunction, Request, Response } from 'express';
import { ZodObject, ZodRawShape } from 'zod';

const validateRequest =
  (schema: ZodObject<ZodRawShape>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
        cookies: req.cookies,
      })) as { body?: unknown };

      req.body = parsed.body;

      next();
    } catch (error) {
      next(error);
    }
  };

export default validateRequest;
