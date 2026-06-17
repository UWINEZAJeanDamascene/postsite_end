"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = require("./index");
const uri = index_1.config.DATABASE_URL || 'mongodb://localhost:27017/siteSock';
async function connectDB() {
    try {
        await mongoose_1.default.connect(uri, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            maxPoolSize: 10, // Maintain up to 10 socket connections
            bufferCommands: false, // Disable mongoose buffering
        });
        // Add connection event listeners
        mongoose_1.default.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        console.log('Connected to MongoDB via Mongoose');
    }
    catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error;
    }
}
exports.connectDB = connectDB;
async function disconnectDB() {
    await mongoose_1.default.disconnect();
    console.log('Disconnected from MongoDB');
}
exports.disconnectDB = disconnectDB;
exports.default = mongoose_1.default;
//# sourceMappingURL=mongoose.js.map