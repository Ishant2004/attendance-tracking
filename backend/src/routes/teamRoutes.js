const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/teamController');

const router = express.Router();

router.get('/', auth, authorize('leadership', 'admin'), ctrl.list);

// Teams the caller manages — must be registered before "/:id".
router.get('/managed', auth, authorize('manager', 'leadership', 'admin'), ctrl.managed);

router.post(
  '/',
  auth,
  authorize('admin'),
  body('name').isString().notEmpty(),
  body('managers').isArray({ min: 1 }).withMessage('At least one manager is required'),
  body('managers.*').isMongoId(),
  validate,
  ctrl.create
);

router.get('/:id', auth, authorize('manager', 'leadership', 'admin'), ctrl.get);

router.put(
  '/:id',
  auth,
  authorize('admin'),
  body('name').optional().isString().notEmpty(),
  body('managers').optional().isArray({ min: 1 }).withMessage('At least one manager is required'),
  body('managers.*').optional().isMongoId(),
  validate,
  ctrl.update
);

router.get('/:id/members', auth, authorize('manager', 'leadership', 'admin'), ctrl.members);

module.exports = router;