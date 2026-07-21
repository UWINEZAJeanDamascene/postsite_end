"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    WS_PORT: parseInt(process.env.WS_PORT || '3001', 10),
    // Postgres is the primary database. MONGO_URL is only used by the one-time legacy migration script.
    POSTGRES_URL: process.env.POSTGRES_URL || process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/lilstock',
    DATABASE_URL: process.env.POSTGRES_URL || process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/lilstock',
    MONGO_URL: process.env.MONGO_URL || 'mongodb://localhost:27017/siteSock',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    JWT: {
        SECRET: process.env.JWT_SECRET || 'dev-secret-key',
        EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    },
};
exports.default = exports.config;
//# sourceMappingURL=index.js.map