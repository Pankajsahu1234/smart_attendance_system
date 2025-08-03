const express = require('express');
const router = express.Router();
const { 
  createQRSession, 
  getAttendance, 
  getActiveQRSessions, 
  closeQRSession, 
  getTeacherSubjects 
} = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

router.use(auth, restrictTo('teacher'));

// QR Session management
router.post('/create-qr-session', createQRSession);
router.get('/qr-sessions/active', getActiveQRSessions);
router.put('/qr-session/:session_id/close', closeQRSession);

// Attendance management
router.get('/attendance/:session_id', getAttendance);

// Teacher data
router.get('/subjects', getTeacherSubjects);

module.exports = router;