const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');

const router = express.Router();

router.get('/conversations', auth, ctrl.listConversations);

// Start (or fetch) a 1:1 conversation with another user.
router.post(
  '/conversations',
  auth,
  body('userId').isMongoId(),
  validate,
  ctrl.openConversation
);

router.get(
  '/conversations/:id/messages',
  auth,
  param('id').isMongoId(),
  validate,
  ctrl.getMessages
);

router.post(
  '/conversations/:id/messages',
  auth,
  param('id').isMongoId(),
  body('body').isString().trim().isLength({ min: 1, max: 4000 }),
  validate,
  ctrl.sendMessage
);

router.post(
  '/conversations/:id/read',
  auth,
  param('id').isMongoId(),
  validate,
  ctrl.markRead
);

module.exports = router;
