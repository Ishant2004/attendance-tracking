const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/officeLocationController');

const router = express.Router();

const locationValidators = [
  body('name').isString().notEmpty(),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('radiusMeters').isFloat({ min: 1 }),
];

router.get('/', auth, ctrl.list);                              // any authenticated user
router.get('/:id', auth, authorize('admin'), ctrl.get);
router.post('/', auth, authorize('admin'), locationValidators, validate, ctrl.create);

router.put(
  '/:id',
  auth,
  authorize('admin'),
  body('name').optional().isString().notEmpty(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('radiusMeters').optional().isFloat({ min: 1 }),
  body('isActive').optional().isBoolean(),
  validate,
  ctrl.update
);

router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;