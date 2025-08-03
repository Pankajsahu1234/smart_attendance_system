const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

router.use(auth, restrictTo('teacher'));
router.post('/create-qr-session', teacherController.createQRSession);
router.get('/attendance/:session_id', teacherController.getAttendance);

module.exports = router;