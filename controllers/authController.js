const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../utils/db');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

const sendRegisterOtp = async (req, res) => {
  const { email, role, name, branch, year, enrollment_no } = req.body;

  // Validate input
  if (!email || !role || !name) {
    logger.error(`Registration OTP request failed: Missing required fields for ${email}`);
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (role === 'student' && (!branch || !year || !enrollment_no)) {
    logger.error(`Registration OTP request failed: Missing student fields for ${email}`);
    return res.status(400).json({ success: false, message: 'Branch, year, and enrollment number required for students' });
  }
  const validBranches = ['CSE', 'ECE', 'ME', 'CE'];
  if (role === 'student' && !validBranches.includes(branch)) {
    logger.error(`Registration OTP request failed: Invalid branch ${branch} for ${email}`);
    return res.status(400).json({ success: false, message: 'Invalid branch' });
  }
  if (role === 'student' && (year < 1 || year > 4)) {
    logger.error(`Registration OTP request failed: Invalid year ${year} for ${email}`);
    return res.status(400).json({ success: false, message: 'Invalid year' });
  }

  try {
    // Check if email or enrollment_no exists
    const [existingUser] = await pool.query('SELECT * FROM login_users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      logger.error(`Registration OTP request failed: Email ${email} already registered`);
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    if (role === 'student') {
      const [existingStudent] = await pool.query('SELECT * FROM students WHERE enrollment_no = ?', [enrollment_no]);
      if (existingStudent.length > 0) {
        logger.error(`Registration OTP request failed: Enrollment number ${enrollment_no} already used`);
        return res.status(400).json({ success: false, message: 'Enrollment number already used' });
      }
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in temp_otp
    await pool.query(
      'INSERT INTO temp_otp (email, otp, otp_expires_at, role, name, branch, year, enrollment_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, otp, otpExpiresAt, role, name, branch || null, year || null, enrollment_no || null]
    );

    // Send OTP email
    await sendEmail(email, 'Registration OTP', `Your OTP is ${otp}. It expires in 10 minutes.`);
    logger.info(`Registration OTP sent to ${email}`);

    return res.json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    logger.error(`Failed to send OTP to ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

const register = async (req, res) => {
  const { email, otp, password, deviceId } = req.body;

  // Validate input
  if (!email || !otp || !password || (req.body.role === 'student' && !deviceId)) {
    logger.error(`Registration failed: Missing required fields for ${email}`);
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Verify OTP
    const [otpRecord] = await pool.query(
      'SELECT * FROM temp_otp WHERE email = ? AND otp = ? AND otp_expires_at > NOW()',
      [email, otp]
    );
    if (otpRecord.length === 0) {
      logger.error(`Registration failed: Invalid or expired OTP for ${email}`);
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const { role, name, branch, year, enrollment_no } = otpRecord[0];
    const passwordHash = await bcrypt.hash(password, 10);

    // Start transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert into login_users
      await connection.query(
        'INSERT INTO login_users (email, password_hash, role, reference_id, is_active) VALUES (?, ?, ?, ?, ?)',
        [email, passwordHash, role, 0, role === 'teacher' ? true : false]
      );

      // Insert into students or teachers
      let reference_id;
      if (role === 'student') {
        const [studentResult] = await connection.query(
          'INSERT INTO students (enrollment_no, name, branch, year) VALUES (?, ?, ?, ?)',
          [enrollment_no, name, branch, year]
        );
        reference_id = studentResult.insertId;
        await connection.query(
          'INSERT INTO device_sessions (student_id, device_id, login_time, is_active) VALUES (?, ?, NOW(), ?)',
          [reference_id, deviceId, true]
        );
      } else {
        const teacherCode = `T${Math.floor(1000 + Math.random() * 9000)}`;
        const [teacherResult] = await connection.query(
          'INSERT INTO teachers (teacher_code, name, email) VALUES (?, ?, ?)',
          [teacherCode, name, email]
        );
        reference_id = teacherResult.insertId;
      }

      // Update reference_id
      await connection.query(
        'UPDATE login_users SET reference_id = ? WHERE email = ?',
        [reference_id, email]
      );

      // Delete OTP record
      await connection.query('DELETE FROM temp_otp WHERE email = ?', [email]);

      await connection.commit();
      logger.info(`User registered: ${email} (${role})`);

      // Generate JWT
      const token = jwt.sign({ email, role, reference_id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
      return res.json({ success: true, token, message: role === 'student' ? 'Registration pending approval' : 'Registration successful' });
    } catch (error) {
      await connection.rollback();
      logger.error(`Registration failed for ${email}: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`Registration failed for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

const login = async (req, res) => {
  const { email, password, deviceId, role } = req.body;

  try {
    const [user] = await pool.query('SELECT * FROM login_users WHERE email = ? AND role = ?', [email, role]);
    if (user.length === 0 || !(await bcrypt.compare(password, user[0].password_hash))) {
      logger.error(`Login failed: Invalid credentials for ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user[0].is_active) {
      logger.error(`Login failed: Account not approved for ${email}`);
      return res.status(403).json({ success: false, message: 'Account not approved' });
    }
    if (role === 'student') {
      const [device] = await pool.query('SELECT * FROM device_sessions WHERE student_id = ? AND device_id = ? AND is_active = ?', [user[0].reference_id, deviceId, true]);
      if (device.length === 0) {
        logger.error(`Login failed: Device not authorized for ${email}`);
        return res.status(403).json({ success: false, message: 'Device not authorized' });
      }
    }

    const token = jwt.sign({ email, role, reference_id: user[0].reference_id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    logger.info(`User logged in: ${email} (${role})`);
    return res.json({ success: true, token });
  } catch (error) {
    logger.error(`Login failed for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const [user] = await pool.query('SELECT * FROM login_users WHERE email = ?', [email]);
    if (user.length === 0) {
      logger.error(`Forgot password failed: Email ${email} not found`);
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    const resetToken = uuidv4();
    await pool.query('UPDATE login_users SET reset_token = ?, reset_token_expires_at = ? WHERE email = ?', [resetToken, new Date(Date.now() + 10 * 60 * 1000), email]);
    await sendEmail(email, 'Password Reset', `Use this token to reset your password: ${resetToken}`);
    logger.info(`Password reset link sent to ${email}`);

    return res.json({ success: true, message: 'Reset link sent' });
  } catch (error) {
    logger.error(`Forgot password failed for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to send reset link' });
  }
};

const changeDevice = async (req, res) => {
  const { email, newDeviceId } = req.body;

  try {
    const [user] = await pool.query('SELECT * FROM login_users WHERE email = ? AND role = "student"', [email]);
    if (user.length === 0) {
      logger.error(`Device change failed: Student ${email} not found`);
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO device_change_requests (email, student_id, new_device_id, otp, otp_expires_at, status) VALUES (?, ?, ?, ?, ?, ?)',
      [email, user[0].reference_id, newDeviceId, otp, otpExpiresAt, 'pending']
    );
    await sendEmail(email, 'Device Change OTP', `Your OTP is ${otp}. It expires in 10 minutes.`);
    logger.info(`Device change OTP sent to ${email}`);

    return res.json({ success: true, message: 'OTP sent for device change' });
  } catch (error) {
    logger.error(`Device change failed for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to initiate device change' });
  }
};

const verifyDeviceChange = async (req, res) => {
  const { email, otp, newDeviceId } = req.body;

  try {
    const [request] = await pool.query(
      'SELECT * FROM device_change_requests WHERE email = ? AND otp = ? AND otp_expires_at > NOW() AND status = "pending"',
      [email, otp]
    );
    if (request.length === 0) {
      logger.error(`Device change OTP verification failed: Invalid or expired OTP for ${email}`);
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    await pool.query('UPDATE device_change_requests SET status = "otp_verified" WHERE email = ? AND otp = ?', [email, otp]);
    await pool.query(
      'INSERT INTO device_change_logs (student_id, new_device_id, action, message, created_at) VALUES (?, ?, ?, ?, NOW())',
      [request[0].student_id, newDeviceId, 'otp_verified', 'OTP verified for device change']
    );
    logger.info(`Device change OTP verified for ${email}`);

    return res.json({ success: true, message: 'Awaiting admin approval' });
  } catch (error) {
    logger.error(`Device change OTP verification failed for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
};

module.exports = { sendRegisterOtp, register, login, forgotPassword, changeDevice, verifyDeviceChange };