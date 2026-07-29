import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const user = await authService.getUser(userId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

export const authRoutes = router;
