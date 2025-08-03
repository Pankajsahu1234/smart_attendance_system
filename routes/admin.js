const express = require('express');
const { 
  getAllUsers, 
  updateUser, 
  getDeviceChangeRequests, 
  approveDeviceChange, 
  rejectDeviceChange 
} = require('../controllers/adminController');
const auth = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');
const router = express.Router();

router.use(auth, restrictTo('admin'));

// User management
router.get('/users', getAllUsers);
// Device change management
router.get('/device-requests', getDeviceChangeRequests);
router.post('/device-requests/approve', approveDeviceChange);
router.post('/device-requests/reject', rejectDeviceChange);
router.patch('/users/:email', updateUser);
module.exports = router;