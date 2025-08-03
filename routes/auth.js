const express = require('express');
const { sendRegisterOtp, register, login, forgotPassword, changeDevice, verifyDeviceChange } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const router = express.Router();

router.post('/send-register-otp', validateRegistration, sendRegisterOtp);
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', forgotPassword);
router.post('/change-device', changeDevice);
router.post('/verify-device-change', verifyDeviceChange);

module.exports = router;