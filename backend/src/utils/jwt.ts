import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export interface JWTPayload {
  id: number;
  staff_code: string;
  role: 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff';
  full_name: string;
  token_version?: number;
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
