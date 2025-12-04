require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  databaseUrl: process.env.DATABASE_URL,
  finnhubApiKey: process.env.FINNHUB_API_KEY,
};

module.exports = config;

