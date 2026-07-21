import { MongoClient, Db } from 'mongodb';
import { config } from './index';

/** Used only by the one-time Mongo → Postgres legacy migration script. */
const uri = config.MONGO_URL || 'mongodb://localhost:27017/siteSock';

let client: MongoClient;
let db: Db;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB (legacy migration)');
  return db;
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

export async function disconnectDB(): Promise<void> {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

export { client, db };
export default { connectDB, getDB, disconnectDB };
