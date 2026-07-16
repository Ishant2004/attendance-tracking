const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/leaveRequestController');

const router = express.Router();

// Any authenticated user can request time off for themselves.
router.post(
  '/',
  auth,
  body('type').isIn(['leave', 'half_day']).withMessage('type must be leave or half_day'),
  body('fromDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('fromDate must be YYYY-MM-DD'),
  body('toDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('toDate must be YYYY-MM-DD'),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate,
  ctrl.create
);

// The caller's own requests.
router.get('/mine', auth, ctrl.mine);

// Requests from the caller's direct reports (approval queue).
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

// The requester withdraws their own pending request (any role).
router.put('/:id/cancel', auth, param('id').isMongoId(), validate, ctrl.cancel);

module.exports = router;
