import { Router } from 'express';
import { login, logout, getMe } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema } from '../validations/authValidation';

const router = Router();

// POST /auth/login — Public route (no auth required)
router.post('/login', validate(loginSchema), login);

// POST /auth/logout — Protected
router.post('/logout', authMiddleware, logout);

// GET /auth/me — Protected
router.get('/me', authMiddleware, getMe);

export default router;
