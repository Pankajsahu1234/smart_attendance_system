const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');
const auth = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

// Routes accessible to teachers and admins
router.use(auth, restrictTo('teacher', 'admin'));
router.get('/subjects', commonController.getAllSubjects);
router.get('/classes', commonController.getAllClasses);

module.exports = router;