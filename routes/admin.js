const express = require('express');
const { approveDeviceChange } = require('../controllers/adminController');
const auth = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');
const router = express.Router();

router.post('/approve-device-change', auth, restrictTo('admin'), approveDeviceChange);

module.exports = router;