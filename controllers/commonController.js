const { pool } = require('../utils/db');
     const logger = require('../utils/logger');

     const getAllSubjects = async (req, res) => {
       try {
         const [subjects] = await pool.query('SELECT subject_id, subject_code, subject_name FROM subjects');
         res.json({ success: true, data: subjects });
       } catch (error) {
         logger.error(`Error fetching subjects: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error fetching subjects' });
       }
     };

     const getAllClasses = async (req, res) => {
       try {
         const [classes] = await pool.query('SELECT class_id, class_name, branch, year FROM classes');
         res.json({ success: true, data: classes });
       } catch (error) {
         logger.error(`Error fetching classes: ${error.message}`);
         res.status(500).json({ success: false, message: 'Error fetching classes' });
       }
     };

     module.exports = { getAllSubjects, getAllClasses };