const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post(
  '/login',
  body('email').isEmail(),
  body('password').isString().notEmpty(),
  validate,
  ctrl.login
);
router.post('/refresh', body('refreshToken').isString().notEmpty(), validate, ctrl.refresh);
router.post('/logout', auth, ctrl.logout);
router.get('/me', auth, ctrl.me);

router.post('/verify-email/send', auth, ctrl.sendEmailOtp);
router.post(
  '/verify-email',
  auth,
  body('code').isLength({ min: 6, max: 6 }).isNumeric(),
  validate,
  ctrl.verifyEmail
);

module.exports = router;