// Cached MongoDB connection for Vercel serverless functions. Serverless
// invocations reuse the same warm container, so we must NOT open a new
// connection every call — that exhausts the Atlas connection limit fast.
import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI

let cached = global.__therapyproMongoose
if (!cached) {
  cached = global.__therapyproMongoose = { conn: null, promise: null }
}

export async function getMongo() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add it in Vercel > Settings > Environment Variables (and frontend/.env for `vercel dev`).')
  }
  if (cached.conn && cached.conn.connection.readyState === 1) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 5,
    })
  }
  cached.conn = await cached.promise
  return cached.conn
}

// Convenience: the raw driver Db, for collections we write with the native API
// (the collections carry $jsonSchema validators, so we build docs by hand).
export async function getDb() {
  const conn = await getMongo()
  return conn.connection.db
}
