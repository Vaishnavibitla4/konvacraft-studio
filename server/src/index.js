import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import designsRouter from './routes/designs.js'
import assetsRouter from './routes/assets.js'
import codegenRouter from './routes/codegen.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
// In production the client is served from the SAME origin as the API,
// so CORS is only needed for local dev (or if CLIENT_URL is explicitly set).
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',').map(s => s.trim())
      : true)           // true = allow same-origin (no CORS header needed)
  : ['http://localhost:5173', 'http://localhost:4000']

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

// IMPORTANT: increase limit for thumbnails + large canvas JSON
app.use(express.json({ limit: '500mb' }))
app.use(express.urlencoded({
  extended: true,
  limit: '500mb',
}))

// Routes
app.use('/api/designs', designsRouter)
app.use('/api/assets', assetsRouter)
app.use('/api/codegen', codegenRouter)
// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ts: new Date(),
  })
})

// ── Serve built React app in production ──────────────────────────
// When deployed on Render (or any single-service host), the Express server
// serves the Vite-built static files AND handles client-side React Router
// routes by always falling back to index.html for non-API requests.
if (process.env.NODE_ENV === 'production') {
  // The built client lives at ../../client/dist relative to server/src/index.js
  const clientDist = join(__dirname, '../../client/dist')

  if (existsSync(clientDist)) {
    // Serve static assets (JS, CSS, images, etc.)
    app.use(express.static(clientDist))

    // SPA fallback — any GET that isn't an /api/* route returns index.html
    // so React Router handles /dashboard, /editor/:id, etc.
    app.get('*', (req, res) => {
      res.sendFile(join(clientDist, 'index.html'))
    })
  } else {
    console.warn('[warn] client/dist not found — run "npm run build" in client/')
    app.get('*', (req, res) => {
      res.status(503).send('Frontend not built. Run: cd client && npm run build')
    })
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[error]', err)

  const status = err.status || err.statusCode || 500

  res.status(status).json({
    error: err.message || 'Internal server error',
  })
})

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

// Increase timeout for large file uploads (videos up to 10 min can take a while)
server.timeout          = 15 * 60 * 1000  // 15 minutes
server.keepAliveTimeout = 15 * 60 * 1000