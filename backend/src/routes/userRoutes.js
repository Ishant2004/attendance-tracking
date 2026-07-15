const express = require('express');
const { body, query } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const User = require('../models/User');
const ctrl = require('../controllers/userController');

const router = express.Router();

router.get(
  '/',
  auth,
  authorize('manager', 'leadership', 'admin'),
  query('role').optional().isIn(User.ROLES),
  query('team').optional().isMongoId(),
  validate,
  ctrl.list
);

router.post(
  '/',
  auth,
  authorize('admin'),
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(User.ROLES),
  body('team').optional().isMongoId(),
  body('manager').optional().isMongoId(),
  body('officeLocations').optional().isArray(),
  body('officeLocations.*').optional().isMongoId(),
  validate,
  ctrl.create
);

router.get('/:id', auth, ctrl.get);            // scoping enforced in service
router.get('/:id/team', auth, ctrl.getTeam);   // scoping enforced in service

router.put(
  '/:id',
  auth,
  body('email').optional().isEmail(),
  body('role').optional().isIn(User.ROLES),
  body('team').optional().isMongoId(),
  body('manager').optional().isMongoId(),
  body('officeLocations').optional().isArray(),
  body('officeLocations.*').optional().isMongoId(),
  validate,
  ctrl.update
);

router.delete('/:id', auth, authorize('admin'), ctrl.remove);

module.exports = router;
