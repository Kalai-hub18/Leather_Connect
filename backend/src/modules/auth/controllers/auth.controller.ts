import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../schemas/auth.schemas';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const user = await authService.register(input);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
};
