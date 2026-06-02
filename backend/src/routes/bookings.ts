import { Router } from 'express';
import { getBookings, getBookingById, createBooking, updateBooking, deleteBooking, getCalendar, getAvailableSlots, convertToJobCard, rescheduleBooking, cancelBooking } from '../controllers/bookingController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createBookingSchema, updateBookingSchema, bookingFiltersSchema } from '../validations/bookingValidation';

const router = Router();

router.use(authMiddleware);

// Calendar view (must be before /:id)
router.get('/calendar', getCalendar);

// Available slots for a date
router.get('/slots', getAvailableSlots);

// List
router.get('/', validateQuery(bookingFiltersSchema), getBookings);

// Reschedule booking
router.put('/:id/reschedule', rescheduleBooking);

// Cancel booking
router.put('/:id/cancel', cancelBooking);

// Convert booking to job card
router.post('/:id/convert-to-job', convertToJobCard);

// Get by ID
router.get('/:id', getBookingById);

// Create
router.post('/', validate(createBookingSchema), createBooking);

// Update
router.put('/:id', validate(updateBookingSchema), updateBooking);

// Delete — owner/manager only
router.delete('/:id', rbac('admin', 'manager'), deleteBooking);

export default router;
