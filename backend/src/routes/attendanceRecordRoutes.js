const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const AttendanceRecord = require('../models/AttendanceRecord');
const ctrl = require('../controllers/attendanceRecordController');

const router = express.Router();

router.get('/', auth, authorize('manager', 'leadership', 'admin'), ctrl.list);

router.post(
  '/mark-leave',
  auth,
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('userId').optional().isMongoId(),
  body('status').optional().isIn(['Leave', 'Holiday']),
  validate,
  ctrl.markLeave
);

// Two-segment route registered before the one-segment param route.
router.get(
  '/:userId/:date',
  auth,
  param('date').matches(/^\d{4}-\d{2}-\d{2}$/),
  validate,
  ctrl.getByDate
);
router.get('/:userId', auth, ctrl.getUserHistory);

router.put(
  '/:id',
  auth,
  authorize('manager', 'admin'),
  body('status').optional().isIn(AttendanceRecord.STATUSES),
  body('checkInTime').optional().isISO8601(),
  body('checkOutTime').optional().isISO8601(),
  body('totalHours').optional().isFloat({ min: 0 }),
  body('isLate').optional().isBoolean(),
  validate,
  ctrl.update
);

module.exports = router;