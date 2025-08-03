-- Creating admins table
CREATE TABLE admins (
  admin_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_no VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Creating teachers table
CREATE TABLE teachers (
  teacher_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  teacher_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_no VARCHAR(20),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Creating students table
CREATE TABLE students (
  student_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  enrollment_no VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone_no VARCHAR(20),
  branch VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Creating login_users table
CREATE TABLE login_users (
  email VARCHAR(255) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL,
  reference_id BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role_reference (role, reference_id)
);

-- Creating subjects table
CREATE TABLE subjects (
  subject_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  subject_code VARCHAR(50) UNIQUE NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creating classes table
CREATE TABLE classes (
  class_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  class_name VARCHAR(100) NOT NULL,
  branch VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (class_name, branch, year)
);

-- Creating qr_sessions table
CREATE TABLE qr_sessions (
  session_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  qr_token VARCHAR(255) UNIQUE NOT NULL,
  teacher_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id),
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
  FOREIGN KEY (class_id) REFERENCES classes(class_id)
);

-- Creating device_sessions table
CREATE TABLE device_sessions (
  session_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  login_time TIMESTAMP NOT NULL,
  logout_time TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  UNIQUE (student_id, is_active)
);

-- Creating attendance table
CREATE TABLE attendance (
  attendance_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  status ENUM('present', 'absent') DEFAULT 'present',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (session_id) REFERENCES qr_sessions(session_id),
  UNIQUE (student_id, session_id)
);

-- Creating device_change_requests table
CREATE TABLE device_change_requests (
  request_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  student_id BIGINT NOT NULL,
  new_device_id VARCHAR(36) NOT NULL,
  otp VARCHAR(6),
  otp_expires_at TIMESTAMP,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
  FOREIGN KEY (email) REFERENCES login_users(email)
);

-- Creating device_change_logs table
CREATE TABLE device_change_logs (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  old_device_id VARCHAR(36),
  new_device_id VARCHAR(36),
  admin_id BIGINT,
  action ENUM('send_otp', 'otp_verified', 'approved', 'rejected') NOT NULL,
  message VARCHAR(255),
  ip_address VARCHAR(45),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (admin_id) REFERENCES admins(admin_id)
);

-- Creating attendance_logs table
CREATE TABLE attendance_logs (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  message VARCHAR(255),
  ip_address VARCHAR(45),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (session_id) REFERENCES qr_sessions(session_id)
);

-- Creating temp_otp table for registration
CREATE TABLE temp_otp (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  otp_expires_at TIMESTAMP NOT NULL,
  role ENUM('student', 'teacher') NOT NULL,
  name VARCHAR(255) NOT NULL,
  branch VARCHAR(100),
  year INT,
  enrollment_no VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email)
);