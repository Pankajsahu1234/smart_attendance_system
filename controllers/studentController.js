const { pool } = require('../utils/db');
const { haversineDistance } = require('../utils/geoLocation');
const logger = require('../utils/logger');

const getAttendance = async (req, res) => {
  const student_id = req.user.reference_id;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const [attendance] = await pool.query(
      `SELECT a.*, s.session_name, s.start_time, s.end_time 
       FROM attendance a 
       JOIN qr_sessions s ON a.session_id = s.session_id 
       WHERE a.student_id = ? 
       ORDER BY s.start_time DESC 
       LIMIT ? OFFSET ?`,
      [student_id, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM attendance WHERE student_id = ?',
      [student_id]
    );

    logger.info(`Attendance history retrieved for student ${student_id}`);
    return res.json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error(`Failed to retrieve attendance for student ${student_id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance' });
  }
};

const markAttendance = async (req, res) => {
  const { qr_token, deviceId, latitude, longitude } = req.body;
  const student_id = req.user.reference_id;

  if (!qr_token || !deviceId || !latitude || !longitude) {
    logger.error(`Attendance marking failed: Missing required fields for student ${student_id}`);
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const [session] = await pool.query('SELECT * FROM qr_sessions WHERE qr_token = ? AND start_time <= NOW() AND end_time >= NOW()', [qr_token]);
    if (session.length === 0) {
      logger.error(`Attendance marking failed: Invalid or expired QR code for student ${student_id}`);
      return res.status(400).json({ success: false, message: 'Invalid or expired QR code' });
    }

    const [device] = await pool.query('SELECT * FROM device_sessions WHERE student_id = ? AND device_id = ? AND is_active = ?', [student_id, deviceId, true]);
    if (device.length === 0) {
      logger.error(`Attendance marking failed: Device not authorized for student ${student_id}`);
      return res.status(403).json({ success: false, message: 'Device not authorized' });
    }

    const distance = haversineDistance(latitude, longitude, session[0].latitude, session[0].longitude);
    if (distance > parseInt(process.env.MAX_DISTANCE_METERS)) {
      await pool.query(
        'INSERT INTO attendance_logs (student_id, session_id, device_id, action, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student_id, session[0].session_id, deviceId, 'failed', `Location > ${process.env.MAX_DISTANCE_METERS}m`, latitude, longitude]
      );
      logger.error(`Attendance marking failed: Location > ${process.env.MAX_DISTANCE_METERS}m for student ${student_id}`);
      return res.status(400).json({ success: false, message: `Location > ${process.env.MAX_DISTANCE_METERS}m away` });
    }

    await pool.query(
      'INSERT INTO attendance (student_id, session_id, latitude, longitude, status) VALUES (?, ?, ?, ?, ?)',
      [student_id, session[0].session_id, latitude, longitude, 'present']
    );
    await pool.query(
      'INSERT INTO attendance_logs (student_id, session_id, device_id, action, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [student_id, session[0].session_id, deviceId, 'success', 'Attendance marked', latitude, longitude]
    );
    logger.info(`Attendance marked for student ${student_id} in session ${session[0].session_id}`);

    return res.json({ success: true, message: 'Attendance marked' });
  } catch (error) {
    logger.error(`Attendance marking failed for student ${student_id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
};

module.exports = { markAttendance, getAttendance };