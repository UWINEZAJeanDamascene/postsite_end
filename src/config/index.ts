import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  WS_PORT: parseInt(process.env.WS_PORT || '3001', 10),
  DATABASE_URL: process.env.NODE_ENV === 'test'
    ? (process.env.TEST_DATABASE_URL || 'mysql://localhost:3306/lilstock_test')
    : (process.env.DATABASE_URL || process.env.MYSQL_URL || 'mysql://root:password@localhost:3306/lilstock'),
  MYSQL_URL: process.env.NODE_ENV === 'test'
    ? (process.env.TEST_DATABASE_URL || 'mysql://localhost:3306/lilstock_test')
    : (process.env.MYSQL_URL || process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/lilstock'),
  POSTGRES_URL: process.env.POSTGRES_URL,
  MONGO_URL: process.env.MONGO_URL,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  JWT: {
    SECRET: process.env.JWT_SECRET || 'dev-secret-key',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  },
} as const;

export default config;
