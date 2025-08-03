const { pool } = require('../utils/db');
const { haversineDistance } = require('../utils/geoLocation');
const logger = require('../utils/logger');

const getStudentSubjects = async (req, res) => {
  const student_id = req.user.reference_id;

  try {
    // Get student's branch and year
    const [student] = await pool.query(
      'SELECT branch, year FROM students WHERE student_id = ?',
      [student_id]
    );

    if (student.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get subjects for student's branch and year
    const [subjects] = await pool.query(
      `SELECT s.subject_id, s.subject_code, s.subject_name, t.name as teacher_name
       FROM subjects s
       LEFT JOIN teachers t ON s.teacher_id = t.teacher_id
       WHERE s.branch = ? AND s.semester <= ?`,
      [student[0].branch, student[0].year * 2] // Assuming 2 semesters per year
    );

    res.json({ success: true, data: subjects });
  } catch (error) {
    logger.error(`Error fetching student subjects: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error fetching subjects' });
  }
};

const getAttendanceStats = async (req, res) => {
  const student_id = req.user.reference_id;
  const { subject_id } = req.query;

  try {
    let query = `
      SELECT 
        s.subject_id,
        s.subject_name,
        COUNT(DISTINCT qs.session_id) as total_sessions,
        COUNT(DISTINCT a.attendance_id) as attended_sessions,
        ROUND((COUNT(DISTINCT a.attendance_id) / COUNT(DISTINCT qs.session_id)) * 100, 2) as attendance_percentage
      FROM subjects s
      LEFT JOIN qr_sessions qs ON s.subject_id = qs.subject_id AND qs.end_time < NOW()
      LEFT JOIN attendance a ON qs.session_id = a.session_id AND a.student_id = ?
      WHERE 1=1
    `;
    
    const params = [student_id];
    
    if (subject_id) {
      query += ' AND s.subject_id = ?';
      params.push(subject_id);
    }
    
    query += ' GROUP BY s.subject_id, s.subject_name HAVING total_sessions > 0';
    
    const [stats] = await pool.query(query, params);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`Error fetching attendance stats: ${error.message}`);
    res.status(500).json({ success: false, message: 'Error fetching attendance statistics' });
  }
};

const getAttendance = async (req, res) => {
  const student_id = req.user.reference_id;
  const { page = 1, limit = 10, subject_id, from_date, to_date } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE a.student_id = ?';
    const params = [student_id];
    
    if (subject_id) {
      whereClause += ' AND qs.subject_id = ?';
      params.push(subject_id);
    }
    
    if (from_date) {
      whereClause += ' AND DATE(a.marked_at) >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      whereClause += ' AND DATE(a.marked_at) <= ?';
      params.push(to_date);
    }

    const [attendance] = await pool.query(
      `SELECT a.*, qs.session_name, qs.start_time, qs.end_time, 
              sub.subject_name, sub.subject_code, c.class_name
       FROM attendance a 
       JOIN qr_sessions qs ON a.session_id = qs.session_id 
       LEFT JOIN subjects sub ON qs.subject_id = sub.subject_id
       LEFT JOIN classes c ON qs.class_id = c.class_id
       ${whereClause}
       ORDER BY a.marked_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM attendance a 
       JOIN qr_sessions qs ON a.session_id = qs.session_id 
       ${whereClause}`,
      params
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
    // Check if student has already marked attendance for this session
    const [existingAttendance] = await pool.query(
      `SELECT a.* FROM attendance a 
       JOIN qr_sessions qs ON a.session_id = qs.session_id 
       WHERE qs.qr_token = ? AND a.student_id = ?`,
      [qr_token, student_id]
    );

    if (existingAttendance.length > 0) {
      logger.error(`Attendance marking failed: Already marked for student ${student_id}`);
      return res.status(400).json({ success: false, message: 'Attendance already marked for this session' });
    }

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
    const maxDistance = parseInt(process.env.MAX_DISTANCE_METERS) || 40;
    if (distance > maxDistance) {
      await pool.query(
        'INSERT INTO attendance_logs (student_id, session_id, device_id, action, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student_id, session[0].session_id, deviceId, 'failed', `Location > ${maxDistance}m`, latitude, longitude]
      );
      logger.error(`Attendance marking failed: Location > ${maxDistance}m for student ${student_id}`);
      return res.status(400).json({ success: false, message: `You must be within ${maxDistance} meters of the classroom` });
    }

    const [result] = await pool.query(
      'INSERT INTO attendance (student_id, session_id, latitude, longitude, status) VALUES (?, ?, ?, ?, ?)',
      [student_id, session[0].session_id, latitude, longitude, 'present']
    );
    await pool.query(
      'INSERT INTO attendance_logs (student_id, session_id, device_id, action, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [student_id, session[0].session_id, deviceId, 'success', 'Attendance marked', latitude, longitude]
    );
    logger.info(`Attendance marked for student ${student_id} in session ${session[0].session_id}`);

    // Get session details for response
    const [sessionDetails] = await pool.query(
      `SELECT qs.session_name, s.subject_name, s.subject_code
       FROM qr_sessions qs
       LEFT JOIN subjects s ON qs.subject_id = s.subject_id
       WHERE qs.session_id = ?`,
      [session[0].session_id]
    );

    return res.json({ 
      success: true, 
      message: 'Attendance marked successfully',
      data: {
        attendance_id: result.insertId,
        session: sessionDetails[0],
        marked_at: new Date(),
        distance: `${Math.round(distance)} meters`
      }
    });
  } catch (error) {
    logger.error(`Attendance marking failed for student ${student_id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
};

module.exports = { 
  markAttendance, 
  getAttendance, 
  getStudentSubjects, 
  getAttendanceStats 
};