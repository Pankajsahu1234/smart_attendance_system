const jwt = require('jsonwebtoken');
     const { pool } = require('../utils/db');
     const logger = require('../utils/logger');

     const auth = async (req, res, next) => {
       try {
         const token = req.header('Authorization')?.replace('Bearer ', '');
         if (!token) {
           throw new Error('Authentication failed: No token provided');
         }

         const decoded = jwt.verify(token, process.env.JWT_SECRET);
         const [rows] = await pool.query(
           'SELECT email, role, reference_id, is_active FROM login_users WHERE email = ? AND is_active = true',
           [decoded.email]
         );

         if (!rows[0]) {
           throw new Error('Authentication failed: User not found or inactive');
         }

         req.user = rows[0];
         next();
       } catch (error) {
         logger.error(`Auth middleware error: ${error.message}`);
         res.status(401).json({ success: false, message: 'Please authenticate' });
       }
     };

     module.exports = auth;