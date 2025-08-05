const { pool } = require('../utils/db');
     const logger = require('../utils/logger');
     const { v4: uuidv4 } = require('uuid');
     const { generateQRCode } = require('../utils/qrGenerator');

     const createQRSession = async (req, res) => {
       const { subject_id, class_id, latitude, longitude, session_name } = req.body;
       const teacher_id = req.user.reference_id;

       try {
         if (!subject_id || !class_id || !latitude || !longitude || !session_name) {
           return res.status(400).json({ success: false, message: 'Missing required fields' });
         }

         const qr_token = uuidv4();
         const start_time = new Date();
         const end_time = new Date(start_time.getTime() + (process.env.QR_EXPIRY_MINUTES || 10) * 60 * 1000);

         const [result] = await pool.query(
           'INSERT INTO qr_sessions (qr_token, teacher_id, subject_id, class_id, start_time, end_time, latitude, longitude, session_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
           [qr_token, teacher_id, subject_id, class_id, start_time, end_time, latitude, longitude, session_name]
         );

         const qrCodeUrl = await generateQRCode(qr_token);
         logger.info(`QR session created by teacher ${teacher_id} for subject ${subject_id}, class ${class_id}`);
         res.json({ 
           success: true, 
           data: { 
             session_id: result.insertId, 
             qr_token, 
             qrCodeUrl, 
             start_time, 
             end_time,
             session_name,
             expires_in_minutes: process.env.QR_EXPIRY_MINUTES || 10
           } 
         });
       } catch (error) {
         logger.error(`Error creating QR session: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error creating QR session' });
       }
     };

     const getActiveQRSessions = async (req, res) => {
       const teacher_id = req.user.reference_id;

       try {
         const [sessions] = await pool.query(
           `SELECT qs.*, s.subject_name, c.class_name, c.branch, c.year,
            COUNT(a.attendance_id) as attendance_count
            FROM qr_sessions qs
            LEFT JOIN subjects s ON qs.subject_id = s.subject_id
            LEFT JOIN classes c ON qs.class_id = c.class_id
            LEFT JOIN attendance a ON qs.session_id = a.session_id
            WHERE qs.teacher_id = ? AND qs.end_time > NOW()
            GROUP BY qs.session_id
            ORDER BY qs.start_time DESC`,
           [teacher_id]
         );

         res.json({ success: true, data: sessions });
       } catch (error) {
         logger.error(`Error fetching active QR sessions: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error fetching active sessions' });
       }
     };
     const getAttendance = async (req, res) => {
       const { session_id } = req.params;
       const teacher_id = req.user.reference_id;

       try {
         const [rows] = await pool.query(
           `SELECT a.attendance_id, a.student_id, s.enrollment_no, s.name, a.marked_at, a.latitude, a.longitude, a.status
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            WHERE a.session_id = ? AND EXISTS (
              SELECT 1 FROM qr_sessions qs WHERE qs.session_id = ? AND qs.teacher_id = ?
            )`,
           [session_id, session_id, teacher_id]
         );

         // Get session details
         const [sessionDetails] = await pool.query(
           `SELECT qs.*, sub.subject_name, c.class_name, c.branch, c.year
            FROM qr_sessions qs
            LEFT JOIN subjects sub ON qs.subject_id = sub.subject_id
            LEFT JOIN classes c ON qs.class_id = c.class_id
            WHERE qs.session_id = ? AND qs.teacher_id = ?`,
           [session_id, teacher_id]
         );

         if (sessionDetails.length === 0) {
           return res.status(404).json({ success: false, message: 'Session not found' });
         }

         res.json({ 
           success: true, 
           data: {
             session: sessionDetails[0],
             attendance: rows,
             total_present: rows.length
           }
         });
       } catch (error) {
         logger.error(`Error fetching attendance: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error fetching attendance' });
       }
     };

     const closeQRSession = async (req, res) => {
       const { session_id } = req.params;
       const teacher_id = req.user.reference_id;

       try {
         const [result] = await pool.query(
           'UPDATE qr_sessions SET end_time = NOW() WHERE session_id = ? AND teacher_id = ? AND end_time > NOW()',
           [session_id, teacher_id]
         );

         if (result.affectedRows === 0) {
           return res.status(404).json({ success: false, message: 'Active session not found' });
         }

         logger.info(`QR session ${session_id} closed by teacher ${teacher_id}`);
         res.json({ success: true, message: 'QR session closed successfully' });
       } catch (error) {
         logger.error(`Error closing QR session: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error closing QR session' });
    }
  };

  const getTeacherSubjects = async (req, res) => {
    const teacher_id = req.user.reference_id;

    try {
      const [subjects] = await pool.query(
        'SELECT subject_id, subject_code, subject_name FROM subjects WHERE teacher_id = ?',
        [teacher_id]
      );

      res.json({ success: true, data: subjects });
    } catch (error) {
      logger.error(`Error fetching teacher subjects: ${error.message}`);
      res.status(500).json({ success: false, message: 'Error fetching subjects' });
       }