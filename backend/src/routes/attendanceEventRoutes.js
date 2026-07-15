const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/attendanceEventController');

const router = express.Router();

// Devices may ping frequently — cap the burst per IP.
const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const coordValidators = [
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('timestamp').optional().isISO8601(),
];

router.post('/', auth, pingLimiter, coordValidators, validate, ctrl.logPing);
router.post('/check-in', auth, coordValidators, validate, ctrl.checkIn);
router.post('/check-out', auth, coordValidators, validate, ctrl.checkOut);

// Static path before the param route so it isn't captured by "/:userId".
router.get('/current-status/:userId', auth, ctrl.currentStatus);
router.get('/:userId', auth, ctrl.history);

module.exports = router;