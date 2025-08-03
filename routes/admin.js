const express = require('express');
const { approveDeviceChange } = require('../controllers/adminController');
const { verifyAdmin } = require('../middleware/auth');
const router = express.Router();

router.post('/approve-device-change', verifyAdmin, approveDeviceChange);

module.exports = router;