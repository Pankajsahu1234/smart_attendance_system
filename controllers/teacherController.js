const { pool } = require('../utils/db');
     const logger = require('../utils/logger');
     const { v4: uuidv4 } = require('uuid');
     const QRCode = require('../utils/qrGenerator');

     const createQRSession = async (req, res) => {
       const { subject_id, class_id, latitude, longitude } = req.body;
       const teacher_id = req.user.reference_id;

       try {
         if (!subject_id || !class_id || !latitude || !longitude) {
           return res.status(400).json({ success: false, message: 'Missing required fields' });
         }

         const qr_token = uuidv4();
         const start_time = new Date();
         const end_time = new Date(start_time.getTime() + process.env.QR_EXPIRY_MINUTES * 60 * 1000);

         const [result] = await pool.query(
           'INSERT INTO qr_sessions (qr_token, teacher_id, subject_id, class_id, start_time, end_time, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
           [qr_token, teacher_id, subject_id, class_id, start_time, end_time, latitude, longitude]
         );

         const qrCodeUrl = await QRCode.generateQRCode(qr_token);
         logger.info(`QR session created by teacher ${teacher_id} for subject ${subject_id}, class ${class_id}`);
         res.json({ success: true, data: { session_id: result.insertId, qr_token, qrCodeUrl, start_time, end_time } });
       } catch (error) {
         logger.error(`Error creating QR session: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error creating QR session' });
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

         res.json({ success: true, data: rows });
       } catch (error) {
         logger.error(`Error fetching attendance: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error fetching attendance' });
       }
     };

     module.exports = { createQRSession, getAttendance };