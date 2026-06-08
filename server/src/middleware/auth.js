import admin from './firebase.js'
import { query } from '../db/pool.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.firebaseUser = decoded

    // Upsert user in our DB
    const { rows } = await query(
      `INSERT INTO users (firebase_uid, email, display_name, photo_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid) DO UPDATE
         SET email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             photo_url = EXCLUDED.photo_url
       RETURNING *`,
      [decoded.uid, decoded.email || null, decoded.name || null, decoded.picture || null]
    )
    req.user = rows[0]
    next()
  } catch (err) {
    console.error('Auth error:', err.message)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
