const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const AttendanceFlag = require('../models/AttendanceFlag');
const ctrl = require('../controllers/flagController');

const router = express.Router();

router.get('/', auth, authorize('manager', 'leadership', 'admin'), ctrl.list);

router.post(
  '/',
  auth,
  authorize('manager', 'admin'),
  body('user').isMongoId(),
  body('flagType').isIn(AttendanceFlag.FLAG_TYPES),
  body('severity').optional().isIn(AttendanceFlag.SEVERITIES),
  validate,
  ctrl.create
);

router.post('/run-detection', auth, authorize('admin'), ctrl.runDetection);

// Static/two-segment routes before the "/:userId" catch.
router.get('/team/:teamId', auth, authorize('manager', 'leadership', 'admin'), ctrl.teamFlags);
router.put('/:id/resolve', auth, authorize('manager', 'admin'), ctrl.resolve);
router.get('/:userId', auth, ctrl.userFlags);

module.exports = router;