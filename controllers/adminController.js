const { pool } = require('../utils/db');
const logger = require('../utils/logger');

const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (role) {
      whereClause += ' AND lu.role = ?';
      params.push(role);
    }

    if (search) {
      whereClause += ' AND (lu.email LIKE ? OR s.name LIKE ? OR t.name LIKE ? OR s.enrollment_no LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [users] = await pool.query(
      `SELECT 
        lu.email, lu.role, lu.reference_id, lu.is_active, lu.created_at,
        CASE 
          WHEN lu.role = 'student' THEN s.name
          WHEN lu.role = 'teacher' THEN t.name
          WHEN lu.role = 'admin' THEN a.name
        END as name,
        CASE 
          WHEN lu.role = 'student' THEN s.enrollment_no
          WHEN lu.role = 'teacher' THEN t.teacher_code
          WHEN lu.role = 'admin' THEN a.admin_code
        END as code,
        CASE 
          WHEN lu.role = 'student' THEN CONCAT(s.branch, ' - Year ', s.year)
          WHEN lu.role = 'teacher' THEN t.department
          ELSE NULL
        END as additional_info
       FROM login_users lu
       LEFT JOIN students s ON lu.role = 'student' AND lu.reference_id = s.student_id
       LEFT JOIN teachers t ON lu.role = 'teacher' AND lu.reference_id = t.teacher_id
       LEFT JOIN admins a ON lu.role = 'admin' AND lu.reference_id = a.admin_id
       ${whereClause}
       ORDER BY lu.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM login_users lu
       LEFT JOIN students s ON lu.role = 'student' AND lu.reference_id = s.student_id
       LEFT JOIN teachers t ON lu.role = 'teacher' AND lu.reference_id = t.teacher_id
       LEFT JOIN admins a ON lu.role = 'admin' AND lu.reference_id = a.admin_id
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
};

const updateUser = async (req, res) => {
  const { email } = req.params;
  const { is_active } = req.body;
  const admin_id = req.user.reference_id;

  try {
    const [result] = await pool.query(
      'UPDATE login_users SET is_active = ? WHERE email = ?',
      [is_active, email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`User ${email} ${is_active ? 'activated' : 'deactivated'} by admin ${admin_id}`);
    res.json({ 
      success: true, 
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (error) {
    logger.error(`Error updating user ${email}: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
};

const getDeviceChangeRequests = async (req, res) => {
  const { status = 'otp_verified' } = req.query;

  try {
    const [requests] = await pool.query(
      `SELECT dcr.*, s.name as student_name, s.enrollment_no, s.branch, s.year
       FROM device_change_requests dcr
       JOIN students s ON dcr.student_id = s.student_id
       WHERE dcr.status = ?
       ORDER BY dcr.created_at DESC`,
      [status]
    );

    res.json({ success: true, data: requests });
  } catch (error) {
    logger.error(`Error fetching device change requests: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error fetching device change requests' });
  }
};

const approveDeviceChange = async (req, res) => {
  const { request_id } = req.body;
  const admin_id = req.user.reference_id;

  try {
    const [request] = await pool.query(
      'SELECT * FROM device_change_requests WHERE request_id = ? AND status = "otp_verified"', 
      [request_id]
    );
    
    if (request.length === 0) {
      logger.error(`Device change approval failed: Invalid or processed request ${request_id} by admin ${admin_id}`);
      return res.status(400).json({ success: false, message: 'Invalid or already processed request' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Deactivate old device
      await connection.query(
        'UPDATE device_sessions SET is_active = false WHERE student_id = ? AND is_active = ?', 
        [request[0].student_id, true]
      );
      
      // Add new device
      await connection.query(
        'INSERT INTO device_sessions (student_id, device_id, login_time, is_active) VALUES (?, ?, NOW(), ?)',
        [request[0].student_id, request[0].new_device_id, true]
      );
      
      // Log the change
      await connection.query(
        'INSERT INTO device_change_logs (student_id, old_device_id, new_device_id, admin_id, action, message) VALUES (?, ?, ?, ?, ?, ?)',
        [request[0].student_id, request[0].device_id, request[0].new_device_id, admin_id, 'approved', 'Device change approved']
      );

      // Update request status
      await connection.query(
        'UPDATE device_change_requests SET status = ?, admin_id = ? WHERE request_id = ?', 
        ['approved', admin_id, request_id]
      );
      
      await connection.commit();
      logger.info(`Device change approved for student ${request[0].student_id} by admin ${admin_id}`);

      return res.json({ success: true, message: 'Device change approved successfully' });
    } catch (error) {
      await connection.rollback();
      logger.error(`Device change approval failed for request ${request_id}: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`Device change approval failed for request ${request_id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

const rejectDeviceChange = async (req, res) => {
  const { request_id, reason } = req.body;
  const admin_id = req.user.reference_id;

  try {
    const [request] = await pool.query(
      'SELECT * FROM device_change_requests WHERE request_id = ? AND status = "otp_verified"', 
      [request_id]
    );
    
    if (request.length === 0) {
      logger.error(`Device change rejection failed: Invalid or processed request ${request_id} by admin ${admin_id}`);
      return res.status(400).json({ success: false, message: 'Invalid or already processed request' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Log the rejection
      await connection.query(
        'INSERT INTO device_change_logs (student_id, new_device_id, admin_id, action, message) VALUES (?, ?, ?, ?, ?)',
        [request[0].student_id, request[0].new_device_id, admin_id, 'rejected', reason || 'Device change rejected']
      );

      // Update request status
      await connection.query(
        'UPDATE device_change_requests SET status = ?, admin_id = ? WHERE request_id = ?', 
        ['rejected', admin_id, request_id]
      );
      
      await connection.commit();
      logger.info(`Device change rejected for student ${request[0].student_id} by admin ${admin_id}`);

      return res.json({ success: true, message: 'Device change rejected successfully' });
    } catch (error) {
      await connection.rollback();
      logger.error(`Device change rejection failed for request ${request_id}: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`Device change rejection failed for request ${request_id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

module.exports = { 
  getAllUsers, 
  updateUser, 
  getDeviceChangeRequests, 
  approveDeviceChange, 
  rejectDeviceChange 
};