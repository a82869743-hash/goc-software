import { Router } from 'express';
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  markAttendance,
  getTodayAttendance,
  staffCheckIn,
  staffCheckOut,
  requestLeave,
  approveLeave,
  getLeaves,
  getStaffPerformance,
  getAttendanceReport,
  getAttendanceHistory,
  getStaffAdvances,
  createStaffAdvance,
  settleStaffAdvance,
  kioskAttendance,
  getPaymentRequests,
  createPaymentRequest,
  approvePaymentRequest,
  uploadProfilePicture,
  uploadSelfProfilePicture,
  updateStaffPassword,
  resetAllStaffPasswords
} from '../controllers/staffController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createStaffSchema, updateStaffSchema, staffFiltersSchema, markAttendanceSchema } from '../validations/staffValidation';
import { uploadPhoto } from '../middleware/upload';

const router = Router();
router.use(authMiddleware);

// Payment Requests (Advances, Salary, etc.)
router.get('/payment-requests', getPaymentRequests);
router.post('/payment-requests', createPaymentRequest);
router.patch('/payment-requests/:id', approvePaymentRequest);

// Staff CRUD
router.get('/', validateQuery(staffFiltersSchema), getStaff);
router.get('/attendance/today', getTodayAttendance);
router.get('/attendance/report', rbac('admin', 'manager'), getAttendanceReport);
router.get('/attendance/history', rbac('admin', 'manager'), getAttendanceHistory);

// GPS check-in/out
router.post('/check-in', staffCheckIn);
router.post('/check-out', staffCheckOut);

// Leave management
router.post('/leaves', requestLeave);
router.patch('/leaves/:id', rbac('admin', 'manager'), approveLeave);
router.get('/leaves', getLeaves);

// Self-upload profile picture (any logged-in user, their own photo)
router.post('/me/profile-picture', uploadPhoto.single('photo'), uploadSelfProfilePicture);

// Staff advances
router.get('/:id/advances', rbac('admin', 'manager'), getStaffAdvances);
router.post('/advances', rbac('admin', 'manager'), createStaffAdvance);
router.patch('/advances/:id/settle', rbac('admin', 'manager'), settleStaffAdvance);

// Staff performance
router.get('/:id/performance', getStaffPerformance);

router.get('/:id', getStaffById);
router.post('/', rbac('admin', 'manager'), validate(createStaffSchema), createStaff);
router.put('/:id', rbac('admin', 'manager'), validate(updateStaffSchema), updateStaff);
router.delete('/:id', rbac('admin'), deleteStaff);

// Attendance manual marking
router.post('/attendance', rbac('admin', 'manager'), validate(markAttendanceSchema), markAttendance);

// Profile picture & password endpoints
router.post('/reset-all-passwords', rbac('admin'), resetAllStaffPasswords);
router.post('/:id/profile-picture', rbac('admin'), uploadPhoto.single('photo'), uploadProfilePicture);
router.put('/:id/password', rbac('admin'), updateStaffPassword);

// Kiosk Attendance route (snaps webcam photo, checks in/out)
router.post('/kiosk-attendance', kioskAttendance);

export default router;
