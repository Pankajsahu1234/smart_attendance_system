# Smart Attendance System Backend

A comprehensive Node.js backend for managing university attendance using dynamic QR codes and geo-location verification.

## Features

- **Dynamic QR Code Generation**: Teachers can generate time-limited QR codes for attendance sessions
- **Geo-location Verification**: Students must be within classroom proximity to mark attendance
- **Role-based Authentication**: Separate login systems for teachers and students
- **Real-time Attendance Tracking**: Live attendance monitoring and statistics
- **Comprehensive API**: RESTful APIs for all attendance management operations

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **QR Code Generation**: qrcode library
- **Geo-location**: Haversine formula for distance calculation
- **Password Security**: bcryptjs for hashing
- **Validation**: Joi for request validation

## Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Database Setup

1. Create the database and tables using the provided MySQL script:

```sql
-- Run the original MySQL script first
-- Then run the additional modifications from database_modifications.sql
```

2. Update the `.env` file with your database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=smart_attendance_system
DB_PORT=3306

# JWT Configuration (CHANGE THIS!)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_complex_and_long_2024
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Step 3: Run the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### POST /auth/login
Login for teachers and students.

**Request Body:**
```json
{
  "email": "user@university.edu",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "userId": 1,
      "email": "user@university.edu",
      "role": "teacher",
      "profile": {...}
    }
  }
}
```

#### POST /auth/register
Register new users.

**Request Body:**
```json
{
  "email": "user@university.edu",
  "password": "password123",
  "role": "teacher",
  "referenceId": 1
}
```

### Teacher Endpoints

All teacher endpoints require authentication with teacher role.

#### GET /teacher/subjects
Get subjects assigned to the teacher.

#### POST /teacher/qr-session
Create a new QR attendance session.

**Request Body:**
```json
{
  "subjectId": 1,
  "startTime": "09:00",
  "endTime": "10:30",
  "latitude": 23.2599,
  "longitude": 77.4126
}
```

**Response:**
```json
{
  "success": true,
  "message": "QR session created successfully",
  "data": {
    "qrId": 1,
    "qrToken": "QR_1641234567890_uuid",
    "qrCodeImage": "data:image/png;base64,...",
    "sessionDate": "2024-01-15",
    "startTime": "09:00",
    "endTime": "10:30"
  }
}
```

#### GET /teacher/qr-sessions/active
Get currently active QR sessions.

#### GET /teacher/attendance/:qrId
Get attendance for a specific QR session.

#### PUT /teacher/qr-session/:qrId/close
Manually close a QR session.

### Student Endpoints

All student endpoints require authentication with student role.

#### POST /student/attendance
Mark attendance by scanning QR code.

**Request Body:**
```json
{
  "qrToken": "QR_1641234567890_uuid",
  "latitude": 23.2599,
  "longitude": 77.4126
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "attendanceId": 1,
    "subject": {
      "name": "Data Structures and Algorithms",
      "code": "CS301"
    },
    "markedAt": "2024-01-15T09:15:00.000Z",
    "distance": "15 meters"
  }
}
```

#### GET /student/attendance/history
Get student's attendance history with pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `subjectId`: Filter by subject
- `fromDate`: Start date filter
- `toDate`: End date filter

#### GET /student/subjects
Get subjects for student's branch.

#### GET /student/attendance-stats
Get attendance statistics for the student.

### Common Endpoints

#### GET /common/students
Get all students (with pagination and filters).

#### GET /common/teachers
Get all teachers.

#### GET /common/branches
Get all available branches.

#### GET /common/search/students
Search students by name, enrollment, or phone.

## Sample Login Credentials

### Teacher Login:
- **Email**: vivek.shrivastava@university.edu
- **Password**: password123

### Student Logins:
- **Email**: aakash.mishra@student.university.edu
- **Password**: password123

(More sample accounts available in `database_modifications.sql`)

## Configuration

### Environment Variables

- `DB_HOST`: MySQL host (default: localhost)
- `DB_USER`: MySQL username
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: Database name
- `JWT_SECRET`: Secret key for JWT tokens (MUST be changed in production)
- `PORT`: Server port (default: 3000)
- `MAX_DISTANCE_METERS`: Maximum allowed distance for attendance (default: 50 meters)

### QR Code & Geo-location Settings

- QR codes are valid only during the specified time window
- Students must be within 50 meters (configurable) of the classroom location
- Each QR code has a unique token that expires when the session ends

## Security Features

- JWT-based authentication with configurable expiration
- Password hashing using bcryptjs
- Role-based access control
- Request validation using Joi
- SQL injection prevention using parameterized queries
- CORS configuration for frontend integration

## Development Features

- Comprehensive error handling and logging
- Request/response logging
- Health check endpoint
- Development vs production environment handling
- Hot reloading with nodemon

## Database Schema

The system uses 6 main tables:
- `students`: Student information
- `teachers`: Teacher information
- `subjects`: Course subjects
- `qr_sessions`: QR code sessions with geo-location
- `attendance_logs`: Attendance records
- `login_users`: Authentication data

## Testing the System

1. **Start the server**: `npm run dev`
2. **Test health check**: GET `http://localhost:3000/api/health`
3. **Login as teacher**: POST `/auth/login` with teacher credentials
4. **Create QR session**: POST `/teacher/qr-session` with session details
5. **Login as student**: POST `/auth/login` with student credentials
6. **Mark attendance**: POST `/student/attendance` with QR token and location

## Troubleshooting

### Common Issues:

1. **Database Connection Failed**
   - Check MySQL is running
   - Verify credentials in `.env` file
   - Ensure database exists

2. **JWT Token Invalid**
   - Check JWT_SECRET in `.env`
   - Ensure token is passed in Authorization header as "Bearer token"

3. **QR Code Not Working**
   - Verify session is active (current time within start/end time)
   - Check geo-location is within allowed range
   - Ensure student hasn't already marked attendance

4. **Geo-location Issues**
   - Verify latitude/longitude values are valid
   - Check MAX_DISTANCE_METERS setting
   - Ensure location permissions are granted in frontend

## Production Deployment

Before deploying to production:

1. Change `JWT_SECRET` to a strong, unique value
2. Set `NODE_ENV=production`
3. Use HTTPS for all communications
4. Set up proper database backups
5. Configure proper CORS origins
6. Set up logging and monitoring
7. Use environment-specific database credentials

## Support

For issues or questions, please check:
1. Server logs for error messages
2. Database connectivity
3. Environment variable configuration
4. API request format and authentication headers

The system provides comprehensive error messages to help debug issues during development.