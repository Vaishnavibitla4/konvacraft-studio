import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/pool.js'

const router = Router()

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC endpoint — no auth required
// GET /api/designs/:id/public
// Used by the embed viewer (/embed/:id) to load design data in iframes.
// Returns only the shape/canvas data, never sensitive user data.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/public', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, canvas_json FROM designs WHERE id = $1`,
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Design not found' })

    const design = rows[0]
    let canvasData = design.canvas_json
    if (typeof canvasData === 'string') {
      try { canvasData = JSON.parse(canvasData) } catch { canvasData = {} }
    }

    return res.json({
      id:         design.id,
      title:      design.title,
      canvasSize: canvasData?.canvasSize || { width: 1200, height: 800 },
      pages:      canvasData?.pages      || [],
      shapes:     canvasData?.shapes     || [],
    })
  } catch (err) {
    console.error('[Public embed] Error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// All routes below this line require authentication
router.use(requireAuth)

// ─────────────────────────────────────────────
// GET all user's designs
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
        id,
        title,
        thumbnail_url,
        width,
        height,
        updated_at,
        canvas_json
       FROM designs
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.user.id]
    )

    for (const design of rows) {
  if (typeof design.canvas_json === 'string') {
    try {
      design.canvas_json = JSON.parse(design.canvas_json)
    } catch {
      design.canvas_json = {}
    }
  }
}
    res.json(rows)
  } catch (err) {
    console.error(err)

    res.status(500).json({
      error: 'Failed to fetch designs',
    })
  }
})

// ─────────────────────────────────────────────
// CREATE design
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      title = 'Untitled Design',

      canvas_json = {
        shapes: [],
        canvasSize: {
          width: 1200,
          height: 800,
        },
      },
    } = req.body

    const safeCanvas = {
  ...canvas_json,

  shapes: Array.isArray(canvas_json?.shapes)
    ? canvas_json.shapes
    : [],

  pages: Array.isArray(canvas_json?.pages)
    ? canvas_json.pages
    : [],

  canvasSize: {
    width:
      canvas_json?.canvasSize?.width ||
      1200,

    height:
      canvas_json?.canvasSize?.height ||
      800,
  },
}

    const width =
      safeCanvas.canvasSize.width

    const height =
      safeCanvas.canvasSize.height

    const { rows } = await query(
      `INSERT INTO designs (
        user_id,
        title,
        width,
        height,
        canvas_json
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        req.user.id,
        title,
        width,
        height,
        JSON.stringify(safeCanvas),
      ]
    )

    const design = rows[0]

    if (
      typeof design.canvas_json ===
      'string'
    ) {
      try {
        design.canvas_json =
          JSON.parse(
            design.canvas_json
          )
      } catch {
        design.canvas_json =
          safeCanvas
      }
    }

    res.status(201).json(design)
  } catch (err) {
    console.error(err)

    res.status(500).json({
      error: 'Failed to create design',
    })
  }
})

// ─────────────────────────────────────────────
// GET single design
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT *
       FROM designs
       WHERE id = $1
       AND user_id = $2`,
      [req.params.id, req.user.id]
    )

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Design not found',
      })
    }

    const design = rows[0]

    // IMPORTANT FIX
    if (
      typeof design.canvas_json ===
      'string'
    ) {
      try {
        design.canvas_json =
          JSON.parse(
            design.canvas_json
          )
      } catch {
        design.canvas_json = {
          shapes: [],
          pages: [],
          canvasSize: {
            width: 1200,
            height: 800,
          },
        }
      }
    }

    // Extra safety
    if (
      !design.canvas_json ||
      typeof design.canvas_json !==
        'object'
    ) {
      design.canvas_json = {
        shapes: [],
        pages: [],
        canvasSize: {
          width: 1200,
          height: 800,
        },
      }
    }

    if (!Array.isArray(design.canvas_json.shapes)) {
      design.canvas_json.shapes = []
    }
    // Preserve pages for multi-page designs
    if (!Array.isArray(design.canvas_json.pages)) {
  design.canvas_json.pages = []
}
    if (!design.canvas_json.canvasSize) {
      design.canvas_json.canvasSize = {
        width: design.width || 1200,
        height: design.height || 800,
      }
    }

    res.json(design)
  } catch (err) {
    console.error(err)

    res.status(500).json({
      error: 'Failed to load design',
    })
  }
})

// ─────────────────────────────────────────────
// UPDATE design
// ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      canvas_json,
      thumbnail_url,
      width,
      height,
    } = req.body

    const safeCanvas = {
  ...canvas_json,

  shapes: Array.isArray(canvas_json?.shapes)
    ? canvas_json.shapes
    : [],

  pages: Array.isArray(canvas_json?.pages)
    ? canvas_json.pages
    : [],

  canvasSize: {
    width:
      canvas_json?.canvasSize?.width ||
      1200,

    height:
      canvas_json?.canvasSize?.height ||
      800,
  },
}

    const finalWidth =
      safeCanvas.canvasSize.width

    const finalHeight =
      safeCanvas.canvasSize.height

    const { rows } = await query(
      `UPDATE designs
       SET
         title = COALESCE($1, title),

         canvas_json = $2,

         thumbnail_url =
           COALESCE(
             $3,
             thumbnail_url
           ),

         width = $4,

         height = $5

       WHERE id = $6
       AND user_id = $7

       RETURNING *`,
      [
        title ?? null,

        JSON.stringify(safeCanvas),

        thumbnail_url ?? null,

        finalWidth,

        finalHeight,

        req.params.id,

        req.user.id,
      ]
    )

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Design not found',
      })
    }

    const design = rows[0]

    if (
      typeof design.canvas_json ===
      'string'
    ) {
      try {
        design.canvas_json =
          JSON.parse(
            design.canvas_json
          )
      } catch {
        design.canvas_json =
          safeCanvas
      }
    }

    res.json(design)
  } catch (err) {
    console.error(err)

    res.status(500).json({
      error: 'Failed to save design',
    })
  }
})

// ─────────────────────────────────────────────
// DELETE design
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM designs
       WHERE id = $1
       AND user_id = $2`,
      [req.params.id, req.user.id]
    )

    res.json({
      ok: true,
      deleted:
        result.rowCount > 0,
    })
  } catch (err) {
    console.error(err)

    res.status(500).json({
      error: 'Failed to delete design',
    })
  }
})

export default router