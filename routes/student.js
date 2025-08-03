const express = require('express');
     const router = express.Router();
     const { 
       markAttendance, 
       getAttendance, 
       getStudentSubjects, 
       getAttendanceStats 
     } = require('../controllers/studentController');
     const auth = require('../middleware/auth');
     const restrictTo = require('../middleware/restrictTo');

     router.use(auth, restrictTo('student'));
     
     // Attendance management
     router.post('/mark-attendance', markAttendance);
     router.get('/attendance', getAttendance);
     router.get('/attendance-stats', getAttendanceStats);
     
     // Student data
     router.get('/subjects', getStudentSubjects);

     module.exports = router;