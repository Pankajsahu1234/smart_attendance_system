/*
  # Database Modifications for Smart Attendance System

  Run these additional SQL commands after creating the initial database structure.
  These modifications improve functionality and add missing constraints.
*/

-- Add email field to teachers table for login functionality
ALTER TABLE teachers ADD COLUMN email VARCHAR(100) UNIQUE;

-- Update teachers with sample email addresses (you should update these with real emails)
UPDATE teachers SET email = CONCAT(LOWER(REPLACE(name, ' ', '.')), '@university.edu');

-- Add indexes for better performance
CREATE INDEX idx_students_branch_year ON students(branch, year);
CREATE INDEX idx_qr_sessions_date_time ON qr_sessions(session_date, start_time, end_time);
CREATE INDEX idx_qr_sessions_token ON qr_sessions(qr_token);
CREATE INDEX idx_attendance_logs_qr_student ON attendance_logs(qr_id, student_id);
CREATE INDEX idx_login_users_email ON login_users(email);

-- Add some sample subjects (you can modify these according to your needs)
INSERT INTO subjects (subject_code, subject_name, branch, semester, teacher_id) VALUES
('CS301', 'Data Structures and Algorithms', 'CSE', 3, 1),
('CS302', 'Database Management Systems', 'CSE', 3, 2),
('CS303', 'Computer Networks', 'CSE', 3, 3),
('CS304', 'Operating Systems', 'CSE', 3, 4),
('CS305', 'Software Engineering', 'CSE', 3, 5),
('CS401', 'Machine Learning', 'CSE', 4, 6),
('CS402', 'Web Development', 'CSE', 4, 7);

-- Add some sample login users for testing
-- Default password for all: "password123"
-- Password hash for "password123": $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

-- Sample teacher login (teacher_id = 1)
INSERT INTO login_users (email, password_hash, role, reference_id) VALUES
('vivek.shrivastava@university.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher', 1);

-- Sample student logins (first 5 students)
INSERT INTO login_users (email, password_hash, role, reference_id) VALUES
('aakash.mishra@student.university.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 1),
('abhay.upadhyay@student.university.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 2),
('abhishek.mishra@student.university.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 3),
('abhishek.rajpoot@student.university.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 4),
('aditya.shrivastava@student.university.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 5);