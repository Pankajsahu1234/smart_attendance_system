const { pool: poolPromise } = require('../utils/db');
const logger = require('../utils/logger');

const approveDeviceChange = async (req, res) => {
  const pool = await poolPromise; // Resolve pool Promise
  const { request_id, approve } = req.body;
  const admin_id = req.user.reference_id;

  try {
    const [request] = await pool.query('SELECT * FROM device_change_requests WHERE request_id = ? AND status = "otp_verified"', [request_id]);
    if (request.length === 0) {
      logger.error(`Device change approval failed: Invalid or processed request ${request_id} by admin ${admin_id}`);
      return res.status(400).json({ success: false, message: 'Invalid or already processed request' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (approve) {
        await connection.query('UPDATE device_sessions SET is_active = false WHERE student_id = ? AND is_active = ?', [request[0].student_id, true]);
        await connection.query(
          'INSERT INTO device_sessions (student_id, device_id, login_time, is_active) VALUES (?, ?, NOW(), ?)',
          [request[0].student_id, request[0].new_device_id, true]
        );
        await connection.query(
          'INSERT INTO device_change_logs (student_id, old_device_id, new_device_id, admin_id, action, message) VALUES (?, ?, ?, ?, ?, ?)',
          [request[0].student_id, request[0].device_id, request[0].new_device_id, admin_id, 'approved', 'Device change approved']
        );
      } else {
        await connection.query(
          'INSERT INTO device_change_logs (student_id, new_device_id, admin_id, action, message) VALUES (?, ?, ?, ?, ?)',
          [request[0].student_id, request[0].new_device_id, admin_id, 'rejected', 'Device change rejected']
        );
      }

      await connection.query('UPDATE device_change_requests SET status = ?, admin_id = ? WHERE request_id = ?', [approve ? 'approved' : 'rejected', admin_id, request_id]);
      await connection.commit();
      logger.info(`Device change ${approve ? 'approved' : 'rejected'} for student ${request[0].student_id} by admin ${admin_id}`);

      return res.json({ success: true, message: approve ? 'Device change approved' : 'Device change rejected' });
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

module.exports = { approveDeviceChange };