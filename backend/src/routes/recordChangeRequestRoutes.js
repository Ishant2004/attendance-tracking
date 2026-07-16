const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const AttendanceRecord = require('../models/AttendanceRecord');
const ctrl = require('../controllers/recordChangeRequestController');

const router = express.Router();

// Any authenticated user can request a correction to one of their own records.
router.post(
  '/',
  auth,
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('requestedStatus').isIn(AttendanceRecord.STATUSES).withMessage('invalid requestedStatus'),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate,
  ctrl.create
);

router.get('/mine', auth, ctrl.mine);
router.get('/inbox', auth, authorize('manager', 'leadership', 'admin'), ctrl.inbox);

router.put(
  '/:id/approve',
  auth,
  authorize('manager', 'leadership', 'admin'),
  param('id').isMongoId(),
  validate,
  ctrl.approve
);
router.put(
  '/:id/reject',
  auth,
  authorize('manager', 'leadership', 'admin'),
  param('id').isMongoId(),
  validate,
  ctrl.reject
);
router.put('/:id/cancel', auth, param('id').isMongoId(), validate, ctrl.cancel);

module.exports = router;
