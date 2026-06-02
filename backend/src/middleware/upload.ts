import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5MB default

// Storage configuration for different file types
const createStorage = (subfolder: string) => {
  return multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb) => {
      cb(null, path.join(UPLOAD_PATH, subfolder));
    },
    filename: (_req: Request, file: Express.Multer.File, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });
};

// File filter for images only
const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, HEIC are allowed.`));
  }
};

// Photo uploads (job photos, attendance selfies)
export const uploadPhoto = multer({
  storage: createStorage('photos'),
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// PDF uploads
export const uploadPDF = multer({
  storage: createStorage('pdfs'),
  limits: { fileSize: MAX_FILE_SIZE * 2 }, // 10MB for PDFs
});

// General file upload
export const uploadGeneral = multer({
  storage: createStorage('general'),
  limits: { fileSize: MAX_FILE_SIZE },
});
