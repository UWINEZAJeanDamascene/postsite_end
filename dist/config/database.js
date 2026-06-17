"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.client = exports.disconnectDB = exports.getDB = exports.connectDB = void 0;
const mongodb_1 = require("mongodb");
const index_1 = require("./index");
const uri = index_1.config.DATABASE_URL || 'mongodb://localhost:27017/siteSock';
let client;
let db;
async function connectDB() {
    if (db)
        return db;
    exports.client = client = new mongodb_1.MongoClient(uri);
    await client.connect();
    exports.db = db = client.db();
    console.log('Connected to MongoDB');
    return db;
}
exports.connectDB = connectDB;
function getDB() {
    if (!db) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return db;
}
exports.getDB = getDB;
async function disconnectDB() {
    if (client) {
        await client.close();
        console.log('Disconnected from MongoDB');
    }
}
exports.disconnectDB = disconnectDB;
exports.default = { connectDB, getDB, disconnectDB };
//# sourceMappingURL=database.js.map