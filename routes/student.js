const express = require('express');
     const router = express.Router();
     const studentController = require('../controllers/studentController');
     const auth = require('../middleware/auth');
     const restrictTo = require('../middleware/restrictTo');

     router.use(auth, restrictTo('student'));
     router.post('/mark-attendance', studentController.markAttendance);
     router.get('/attendance', studentController.getAttendance);

     module.exports = router;