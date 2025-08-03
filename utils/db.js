const mysql = require('mysql2/promise');
const logger = require('./logger');

const createPool = async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Optional: Add SSL for production
    // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : null
  });

  // Test connection on startup
  try {
    const connection = await pool.getConnection();
    logger.info('Successfully connected to the database');
    connection.release();
  } catch (error) {
    logger.error(`Failed to connect to the database: ${error.message}`);
    throw error;
  }

  // Handle connection errors with retry logic
  pool.on('error', async (err) => {
    logger.error(`Database pool error: ${err.message}`);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
      logger.info('Attempting to reconnect to the database...');
      setTimeout(async () => {
        try {
          const connection = await pool.getConnection();
          logger.info('Reconnected to the database');
          connection.release();
        } catch (retryError) {
          logger.error(`Reconnection failed: ${retryError.message}`);
        }
      }, 5000); // Retry after 5 seconds
    }
  });

  return pool;
};

// Export initialized pool
module.exports = { pool: createPool() };