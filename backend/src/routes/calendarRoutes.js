const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/calendarController');

const router = express.Router();

router.get('/', auth, ctrl.list); // any authenticated user

router.post(
  '/',
  auth,
  authorize('admin'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('name').isString().notEmpty(),
  validate,
  ctrl.create
);

router.put(
  '/:id',
  auth,
  authorize('admin'),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('name').optional().isString().notEmpty(),
  validate,
  ctrl.update
);

router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;