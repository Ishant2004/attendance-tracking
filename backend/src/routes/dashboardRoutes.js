const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const ctrl = require('../controllers/dashboardController');

const router = express.Router();

router.get('/individual/:userId', auth, ctrl.individual);                      // scoping in service
router.get('/team/:teamId', auth, authorize('manager', 'leadership', 'admin'), ctrl.team);
router.get('/leadership', auth, authorize('leadership', 'admin'), ctrl.leadership);
router.get('/wfo-wfh-ratio', auth, ctrl.wfoRatio);                             // scoping in service
router.get('/attendance-trends', auth, ctrl.trends);                          // scoping in service

module.exports = router;