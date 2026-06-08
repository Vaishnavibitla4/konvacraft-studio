import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import cloudinary from '../middleware/cloudinary.js'
import { query } from '../db/pool.js'

const router = Router()
router.use(requireAuth)

// ─────────────────────────────────────────────
// Multer (memory storage)
// ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB

  fileFilter(req, file, cb) {
    const allowed =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/')

    if (!allowed) {
      return cb(new Error('Only images, videos, and audio files are allowed'))
    }

    cb(null, true)
  },
})

// ─────────────────────────────────────────────
// GET all assets
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {

    const { rows } = await query(
      `SELECT
        id,
        cloudinary_url,
        cloudinary_public_id,
        file_type,
        resource_type,
        duration,
        original_filename,
        created_at
       FROM assets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    )

    res.json(rows)

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: 'Failed to fetch assets',
    })
  }
})
// ─────────────────────────────────────────────
// UPLOAD asset (image/video)
// ─────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // ───────── CLOUDINARY UPLOAD ─────────
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `design-editor/${req.user.id}`,
            use_filename: true,
            unique_filename: true,
            resource_type: req.file.mimetype.startsWith('video/')
              ? 'video'
              : req.file.mimetype.startsWith('audio/')
                ? 'video'   // Cloudinary uses 'video' resource_type for audio files too
                : 'image',
            transformation: req.file.mimetype.startsWith('image/')
              ? [{ quality: 'auto', fetch_format: 'auto' }]
              : [],
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        .end(req.file.buffer)
    })

    // ───────── VIDEO METADATA ─────────
    let duration = null
    const isAudio = req.file.mimetype.startsWith('audio/')
    const isVideo = result.resource_type === 'video' && !isAudio

    if (isVideo || isAudio) {
      duration = Math.floor(result.duration || 0)

      if (isVideo && duration > 600) {
        return res.status(400).json({
          error: "Video exceeds 10-minute limit",
        })
      }
    }

    // ───────── SAVE TO DB ─────────
    const { rows } = await query(
      `INSERT INTO assets (
        user_id,
        cloudinary_url,
        cloudinary_public_id,
        file_type,
        resource_type,
        duration,
        original_filename,
        bytes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        req.user.id,
        result.secure_url,
        result.public_id,
        req.file.mimetype,
        isAudio ? 'audio' : result.resource_type,
        duration,
        req.file.originalname,
        result.bytes,
      ]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('UPLOAD ERROR:')
console.error(err)

if (err.response) {
  console.error(err.response.data)
}
    res.status(500).json({ error: 'Upload failed' })
  }
})

// ─────────────────────────────────────────────
// Upload base64 thumbnail
// ─────────────────────────────────────────────
router.post('/upload-dataurl', async (req, res) => {
  try {
    const { dataURL, folder = 'thumbnails' } = req.body

    if (!dataURL) {
      return res.status(400).json({ error: 'No dataURL provided' })
    }

    const result = await cloudinary.uploader.upload(dataURL, {
      folder: `design-editor/${req.user.id}/${folder}`,
      transformation: [
        { quality: 'auto', width: 400, crop: 'limit' }
      ],
    })

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (err) {
    console.error('Thumbnail upload failed:', err)
    res.status(500).json({ error: 'Thumbnail upload failed' })
  }
})

// ─────────────────────────────────────────────
// DELETE asset
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM assets WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    await cloudinary.uploader.destroy(
  rows[0].cloudinary_public_id,
  {
    resource_type:
      rows[0].resource_type === 'video'
        ? 'video'
        : 'image',
  }
)
    await query(`DELETE FROM assets WHERE id = $1`, [req.params.id])

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Delete failed' })
  }
})

export default router