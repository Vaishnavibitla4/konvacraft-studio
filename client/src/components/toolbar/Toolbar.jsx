import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useAudioStore } from '../../store/audioStore'
import { videoRegistry } from '../canvas/CanvasArea'
import { toast } from '../Toast'
import CodeGenPanel from './CodeGenPanel'

const PRIMARY_SHAPES = [
  { id: 'rect',      icon: '▭', label: 'Rectangle',    key: 'R' },
  { id: 'roundrect', icon: '▢', label: 'Rounded Rect', key: '' },
  { id: 'circle',    icon: '●', label: 'Circle',       key: 'C' },
  { id: 'triangle',  icon: '▲', label: 'Triangle',     key: '' },
  { id: 'star',      icon: '★', label: 'Star',         key: '' },
  { id: 'line',      icon: '╱', label: 'Line',         key: 'L' },
]

const MORE_SHAPES = [
  { id: 'ellipse',  icon: '⬭', label: 'Ellipse'  },
  { id: 'pentagon', icon: '⬠', label: 'Pentagon' },
  { id: 'hexagon',  icon: '⬡', label: 'Hexagon'  },
  { id: 'arrow',    icon: '→', label: 'Arrow'    },
]

const MAIN_TOOLS = [
  { id: 'select', icon: '↖', label: 'Select (V)', key: 'v' },
  { id: 'text',   icon: 'T',  label: 'Text (T)',  key: 't' },
]

function ShapesDialog({ onClose, currentTool, onSelect }) {
  const ref = useRef()
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])
  const all = [...PRIMARY_SHAPES, ...MORE_SHAPES]
  return (
    <div ref={ref} className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-scale-in" style={{ width: 340 }}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All Shapes</p>
      <div className="grid grid-cols-5 gap-2">
        {all.map(s => (
          <button key={s.id} onClick={() => { onSelect(s.id); onClose() }} title={s.label}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-xl transition-all duration-150 ${currentTool === s.id ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'hover:bg-gray-100 text-gray-700'}`}>
            <span>{s.icon}</span>
            <span className="text-[9px] font-medium text-gray-500">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Export Dialog with full canvas-clipped export + PPT/PDF ─────────────────
function ExportDialog({ stageRef, onClose }) {
  const store = useEditorStore()
  const shapes = store.pages[store.currentPageIndex]?.shapes ?? []
  const { canvasSize, pages, isPresentationMode, currentPageIndex } = store
  const [exporting, setExporting] = useState(false)
  const [format, setFormat] = useState('png')
  const [quality, setQuality] = useState(2)
  const [exportProgress, setExportProgress] = useState('')
  const ref = useRef()

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  const hasVideo = shapes.some(s => s.type === 'video')
  const isPresentation = isPresentationMode || canvasSize.width === 1920

  // Export ONLY the whiteboard area at exact canvas dimensions.
  // Konva's toDataURL x/y/width/height are in STAGE coordinates (before zoom/pan).
  // We temporarily reset stage position and scale to identity so the stage
  // canvas pixels map 1-to-1 with canvas world units, then restore.
  function getCanvasDataURL(pixelRatio = 2, mime = 'image/png') {
    const stage = stageRef.current
    if (!stage) return null
    const cw = canvasSize?.width || 1200
    const ch = canvasSize?.height || 800

    // Save current transform
    const prevX = stage.x()
    const prevY = stage.y()
    const prevScale = stage.scaleX()

    // Reset to identity so world coordinates == pixel coordinates
    stage.position({ x: 0, y: 0 })
    stage.scale({ x: 1, y: 1 })

    const dataURL = stage.toDataURL({
      x: 0,
      y: 0,
      width: cw,
      height: ch,
      pixelRatio,
      mimeType: mime,
      quality: mime === 'image/jpeg' ? 0.95 : 1,
    })

    // Restore transform
    stage.position({ x: prevX, y: prevY })
    stage.scale({ x: prevScale, y: prevScale })

    return dataURL
  }

  // Returns a dataURL compositing video frames on top of the Konva canvas
  async function getPageDataURLWithVideos(pixelRatio = 2, mime = 'image/png') {
    const baseDataURL = getCanvasDataURL(pixelRatio, mime)
    const cw = canvasSize?.width || 1200
    const ch = canvasSize?.height || 800
    const currentShapes = store.pages[store.currentPageIndex]?.shapes || []
    const videoShapes = currentShapes.filter(s => s.type === 'video')

    if (videoShapes.length === 0) return baseDataURL

    const tw = Math.round(cw * pixelRatio)
    const th = Math.round(ch * pixelRatio)
    const oc = document.createElement('canvas')
    oc.width = tw; oc.height = th
    const ctx = oc.getContext('2d')

    await new Promise(resolve => {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, tw, th); resolve() }
      img.src = baseDataURL
    })

    for (const shape of videoShapes) {
      const v = videoRegistry.get(shape.id)
      if (v && v.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = shape.opacity ?? 1
        ctx.drawImage(v, shape.x * pixelRatio, shape.y * pixelRatio, shape.width * pixelRatio, shape.height * pixelRatio)
        ctx.restore()
      }
    }
    return oc.toDataURL(mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.95)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const stage = stageRef.current
      if (!stage) { toast.error('Stage not ready. Please wait and try again.'); return }

      if (format === 'png' || format === 'jpg') {
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
        const dataURL = await getPageDataURLWithVideos(quality, mime)
        const a = document.createElement('a')
        a.href = dataURL
        a.download = `design.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        onClose()
        return
      }

      if (format === 'pdf') {
        setExportProgress('Loading PDF library…')
        const { jsPDF } = await import('jspdf')
        const cw = canvasSize?.width || 1200
        const ch = canvasSize?.height || 800
        const orientation = cw > ch ? 'landscape' : 'portrait'
        const pdf = new jsPDF({ orientation, unit: 'px', format: [cw, ch], hotfixes: ['px_scaling'] })

        for (let i = 0; i < pages.length; i++) {
          setExportProgress(`Rendering page ${i + 1} of ${pages.length}…`)
          // Switch to page
          store.setCurrentPage(i)
          await new Promise(r => setTimeout(r, 300)) // let canvas re-render
          const dataURL = await getPageDataURLWithVideos(1.5, 'image/jpeg')
          if (i > 0) pdf.addPage([cw, ch], orientation)
          pdf.addImage(dataURL, 'JPEG', 0, 0, cw, ch, '', 'FAST')
        }
        store.setCurrentPage(0)
        pdf.save('design.pdf')
        toast.success('PDF exported successfully!')
        onClose()
        return
      }

      if (format === 'pptx') {
        setExportProgress('Loading PPTX library…')
        const PptxGenJS = (await import('pptxgenjs')).default
        const pptx = new PptxGenJS()

        const cw = canvasSize?.width || 1920
        const ch = canvasSize?.height || 1080
        // pptxgenjs uses inches; standard screen is 96 DPI
        const wInch = Math.round((cw / 96) * 100) / 100
        const hInch = Math.round((ch / 96) * 100) / 100

        pptx.defineLayout({ name: 'CUSTOM_LAYOUT', width: wInch, height: hInch })
        pptx.layout = 'CUSTOM_LAYOUT'

        const savedPage = currentPageIndex
        for (let i = 0; i < pages.length; i++) {
          setExportProgress(`Rendering slide ${i + 1} of ${pages.length}…`)
          store.setCurrentPage(i)
          // Give Konva time to re-render the new page's shapes
          await new Promise(r => setTimeout(r, 400))
          const dataURL = await getPageDataURLWithVideos(1.5, 'image/jpeg')
          if (!dataURL) continue
          const slide = pptx.addSlide()
          // addImage with data: accepts base64 data URL directly
          slide.addImage({ data: dataURL, x: 0, y: 0, w: wInch, h: hInch })
        }
        store.setCurrentPage(savedPage)

        // In browser, use write() with 'blob' output then manually trigger download
        // writeFile() may fail in browser environments without Node fs
        try {
          // Try writeFile first (works in some environments)
          await pptx.writeFile({ fileName: 'presentation.pptx' })
        toast.success('PowerPoint exported!')
        } catch {
          // Fallback: get blob and trigger download manually
          const blob = await pptx.write({ outputType: 'blob' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'presentation.pptx'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 2000)
        }
        onClose()
        return
      }

      if (format === 'webm') {
        // ── Get the Konva canvas element ──────────────────────────────
        const konvaStage  = stageRef.current?.getStage ? stageRef.current.getStage() : stageRef.current
        const layers      = konvaStage?.getLayers?.() || []
        let   exportCanvas = layers.length > 0
          ? layers[layers.length - 1].getCanvas()._canvas
          : konvaStage?.content?.querySelector('canvas')

        if (!exportCanvas || !exportCanvas.captureStream) {
          toast.warning('Video export is not supported in this browser')
          return
        }

        const currentShapes = store.pages[store.currentPageIndex]?.shapes || []
        const videoShapes   = currentShapes.filter(s => s.type === 'video')
        const imageShapes   = currentShapes.filter(s => s.type === 'image')

        // ── Calculate export duration using videoRegistry (actual durations) ──
        // NEVER use loop as reason to extend — always export the real clip length.
        let exportDurationMs = 10_000  // fallback

        if (videoShapes.length > 0) {
          const maxClipSec = videoShapes.reduce((max, s) => {
            const v = videoRegistry.get(s.id)
            // Prefer real duration from the live element; fall back to stored value
            const realDuration = (v && isFinite(v.duration) && v.duration > 0)
              ? v.duration
              : (s.duration ?? 30)
            const clipStart = s.trimStart ?? 0
            const clipEnd   = (s.trimEnd != null) ? s.trimEnd : realDuration
            return Math.max(max, clipEnd - clipStart)
          }, 0)
          exportDurationMs = Math.max(2_000, Math.ceil(maxClipSec) * 1_000)
        } else if (imageShapes.length > 0) {
          const audioState = useAudioStore.getState()
          const activeTracks = audioState.tracks || []
          if (activeTracks.length > 0) {
            // Use the longest audio track's trimmed duration
            const maxAudioSec = activeTracks.reduce((max, t) => {
              const end   = t.trimEnd   ?? t.track.duration ?? 10
              const start = t.trimStart ?? 0
              return Math.max(max, end - start)
            }, 0)
            exportDurationMs = Math.max(2_000, Math.ceil(maxAudioSec) * 1_000)
          } else {
            exportDurationMs = Math.max(2_000, imageShapes.length * 5_000)
          }
        }

        const exportSec = Math.round(exportDurationMs / 1000)
        setExportProgress(`Preparing ${exportSec}s export…`)

        // Declared here so onstop can access it (assigned in Step 1)
        let exportClones = []
        let drawActive = true

        // ── Step 1: Create hidden off-screen clones — NEVER touch canvas videos ─
        // Canvas-displayed videos (in videoRegistry) stay paused/untouched so
        // the play button and canvas remain fully interactive during export.
        exportClones = []
        for (const s of videoShapes) {
          const orig = videoRegistry.get(s.id)
          if (!orig) continue
          const clone = document.createElement('video')
          clone.crossOrigin = 'anonymous'
          clone.preload = 'auto'
          clone.muted = true            // audio captured via AudioContext below
          clone.src = orig.src || s.src
          clone.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none'
          document.body.appendChild(clone)
          clone.currentTime = s.trimStart ?? 0
          clone.ontimeupdate = () => {
            const te = (s.trimEnd != null) ? s.trimEnd : clone.duration
            if (isFinite(te) && clone.currentTime >= te) clone.pause()
          }
          await new Promise(resolve => {
            if (clone.readyState >= 2) { resolve(); return }
            clone.addEventListener('canplay', resolve, { once: true })
            clone.addEventListener('error',   resolve, { once: true })
            clone.load()
            setTimeout(resolve, 3000)
          })
          exportClones.push({ shape: s, clone })
        }

        // Play all clones from trimStart simultaneously
        for (const { shape: s, clone } of exportClones) {
          clone.currentTime = s.trimStart ?? 0
          await clone.play().catch(() => {})
        }

        // ── Step 2: Off-screen canvas compositing loop ─────────────────
        // We draw onto a fresh off-screen canvas (not the Konva stage) so
        // the main canvas is never touched.
        const cw2 = store.canvasSize?.width  || 1200
        const ch2 = store.canvasSize?.height || 800
        const oc  = document.createElement('canvas')
        oc.width  = cw2; oc.height = ch2
        const octx = oc.getContext('2d')

        // Snapshot non-video content from Konva as a static background
        let staticBg = null
        try {
          const konvaStage2 = stageRef.current?.getStage ? stageRef.current.getStage() : stageRef.current
          const prevX = konvaStage2.x(), prevY = konvaStage2.y(), prevSc = konvaStage2.scaleX()
          konvaStage2.position({ x: 0, y: 0 }); konvaStage2.scale({ x: 1, y: 1 })
          const dataUrl = konvaStage2.toDataURL({ x: 0, y: 0, width: cw2, height: ch2, pixelRatio: 1 })
          konvaStage2.position({ x: prevX, y: prevY }); konvaStage2.scale({ x: prevSc, y: prevSc })
          staticBg = await new Promise((res, rej) => {
            const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = dataUrl
          })
        } catch {}

        const drawFrame = () => {
          if (!drawActive) return
          octx.clearRect(0, 0, cw2, ch2)
          if (staticBg) octx.drawImage(staticBg, 0, 0, cw2, ch2)
          for (const { shape: s, clone } of exportClones) {
            if (clone.readyState >= 2) {
              octx.save()
              octx.globalAlpha = s.opacity ?? 1
              if (s.rotation) {
                const cx3 = s.x + s.width / 2, cy3 = s.y + s.height / 2
                octx.translate(cx3, cy3); octx.rotate((s.rotation * Math.PI) / 180)
                octx.translate(-cx3, -cy3)
              }
              octx.drawImage(clone, s.x, s.y, s.width, s.height)
              octx.restore()
            }
          }
          requestAnimationFrame(drawFrame)
        }
        drawFrame()

        // Small buffer so first frames render
        await new Promise(r => setTimeout(r, 120))

        const canvasStream = oc.captureStream(30)
        const combinedStream = new MediaStream()
        canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t))

        const audioState = useAudioStore.getState()
        let audioCtx = null
        let audioDest = null
        let exportAudioEl = null
        const exportAudioEls = [] // all audio elements created for export

        // ── Step 3: Capture ALL background audio tracks and mix them ──
        const activeTracks = audioState.tracks || []
        if (activeTracks.length > 0) {
          try {
            audioCtx  = new AudioContext()
            audioDest = audioCtx.createMediaStreamDestination()

            for (const trackState of activeTracks) {
              if (!trackState.track?.src) continue
              try {
                const el = new Audio()
                el.crossOrigin = 'anonymous'
                el.src = trackState.track.src
                el.volume = trackState.volume ?? 0.8
                el.loop = false

                await new Promise(resolve => {
                  el.oncanplay = resolve
                  el.onerror   = resolve
                  el.load()
                  setTimeout(resolve, 4000)
                })

                // Pre-position at trim start — do NOT play yet
                el.currentTime = trackState.trimStart ?? 0

                // Trim boundary for this track
                const trimEnd   = trackState.trimEnd
                const trimStart = trackState.trimStart ?? 0
                el.ontimeupdate = () => {
                  const end = trimEnd ?? el.duration
                  if (el.currentTime >= end) {
                    if (trackState.loop) { el.currentTime = trimStart }
                    else { el.pause() }
                  }
                }

                const src = audioCtx.createMediaElementSource(el)
                src.connect(audioDest)
                // intentionally NOT connecting to audioCtx.destination — captured into stream only

                // Respect timelineOffset: schedule this track to start at the right
                // moment in the exported video, not all at t=0.
                const offsetMs = Math.round((trackState.timelineOffset ?? 0) * 1000)
                if (offsetMs <= 0) {
                  // Starts at the beginning of the video
                  await el.play().catch(() => {})
                } else {
                  // Keep paused until the right moment in the recording timeline
                  setTimeout(() => {
                    el.currentTime = trimStart
                    el.play().catch(() => {})
                  }, offsetMs)
                }
                exportAudioEls.push(el)
              } catch (trackErr) {
                console.warn('Failed to capture track:', trackState.track.name, trackErr)
              }
            }

            if (exportAudioEls.length > 0) {
              audioDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
              setExportProgress(`Recording ${exportSec}s with ${exportAudioEls.length} audio track${exportAudioEls.length > 1 ? 's' : ''}…`)
            } else {
              setExportProgress(`Recording ${exportSec}s of video…`)
            }
          } catch (err) {
            console.warn('Audio capture failed:', err)
            setExportProgress(`Recording ${exportSec}s of video…`)
          }
        } else {
          setExportProgress(`Recording ${exportSec}s of video…`)
        }

        // ── Step 4: Record the stream ──────────────────────────────────
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'

        const recorder = new MediaRecorder(combinedStream, { mimeType: mime, videoBitsPerSecond: 15_000_000 })
        const chunks   = []

        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

        recorder.onstop = () => {
          // Stop off-screen draw loop
          drawActive = false

          // Cleanup clones — canvas videos are untouched throughout
          for (const { clone } of exportClones) {
            try { clone.pause(); clone.src = ''; document.body.removeChild(clone) } catch {}
          }

          if (exportAudioEls.length > 0) { try { exportAudioEls.forEach(el => el.pause()) } catch {} }
          if (audioCtx) { try { audioCtx.close() } catch {} }

          setExportProgress('')
          setExporting(false)
          const blob = new Blob(chunks, { type: mime })
          const url  = URL.createObjectURL(blob)
          const a    = document.createElement('a')
          a.href     = url
          a.download = 'design-video.webm'
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 3000)
          toast.success(`Video exported! (${exportSec}s${activeTracks.length > 0 ? ` · ${activeTracks.length} audio track${activeTracks.length > 1 ? 's' : ''}` : ''})`)
          onClose()
        }

        recorder.start(100)

        // Live countdown
        const startTime = Date.now()
        const interval  = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((exportDurationMs - (Date.now() - startTime)) / 1000))
          setExportProgress(`Recording… ${remaining}s remaining`)
        }, 500)

        // Stop recording after full duration
        setTimeout(() => {
          clearInterval(interval)
          recorder.stop()
        }, exportDurationMs)

        return
      }

    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
      setExportProgress('')
    }
  }

  const hasImages = shapes.some(s => s.type === 'image')
  const hasAudio = (useAudioStore.getState().tracks || []).length > 0

  const formats = [
    { id: 'png',  label: 'PNG',  desc: 'Best quality, transparent background', icon: '🖼' },
    { id: 'jpg',  label: 'JPG',  desc: 'Smaller file size, solid background',   icon: '📷' },
    ...(isPresentation ? [
      { id: 'pptx', label: 'PowerPoint (.pptx)', desc: 'Export all pages as slides', icon: '📊' },
      { id: 'pdf',  label: 'PDF',  desc: 'Export all pages as PDF',              icon: '📄' },
    ] : [
      { id: 'pdf',  label: 'PDF',  desc: 'Export canvas as PDF',                 icon: '📄' },
    ]),
    ...(hasVideo || hasImages ? [{
      id: 'webm',
      label: 'Video (.webm)',
      desc: hasVideo
        ? `Video export${hasAudio ? ' · includes audio' : ''} · loops = 2 min`
        : `Image slideshow${hasAudio ? ' · includes audio' : ' · 5s per image'}`,
      icon: '🎬',
    }] : []),
  ]

  return (
    <div ref={ref} className="absolute top-14 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 animate-scale-in" style={{ width: 300 }}>
      <p className="text-sm font-semibold text-gray-800 mb-1">Export Design</p>
      <p className="text-xs text-gray-400 mb-4">Exports whiteboard canvas area only</p>

      <div className="space-y-2 mb-4">
        {formats.map(f => (
          <label key={f.id} className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer border-2 transition-all ${format === f.id ? 'border-indigo-400 bg-indigo-50' : 'border-transparent hover:bg-gray-50'}`}>
            <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-0.5 accent-indigo-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">{f.icon} {f.label}</p>
              <p className="text-xs text-gray-500">{f.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {(format === 'png' || format === 'jpg') && (
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 block mb-1">Scale / Quality</label>
          <div className="flex gap-2">
            {[1, 2, 3].map(q => (
              <button key={q} onClick={() => setQuality(q)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${quality === q ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {q}x
              </button>
            ))}
          </div>
        </div>
      )}

      {exportProgress && (
        <div className="mb-3 text-xs text-indigo-600 font-medium flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          {exportProgress}
        </div>
      )}

      <button onClick={handleExport} disabled={exporting}
        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md disabled:opacity-60">
        {exporting ? 'Exporting…' : `Export ${format.toUpperCase()}`}
      </button>
    </div>
  )
}

export default function Toolbar({ stageRef, onSave, saving, designId, designTitle }) {
  const { tool, setTool, undo, redo, selectedId, deleteShape, zoom, setZoom, stagePosition, setStagePosition, canvasSize } = useEditorStore()
  const [showShapes, setShowShapes] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showCodeGen, setShowCodeGen] = useState(false)

  useEffect(() => {
    function onKey(e) {
      const active = document.activeElement
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return
      if (e.key === 'v' || e.key === 'V') setTool('select')
      if (e.key === 't' || e.key === 'T') setTool('text')
      if (e.key === 'r' || e.key === 'R') setTool('rect')
      if (e.key === 'c' || e.key === 'C') setTool('circle')
      if (e.key === 'l' || e.key === 'L') setTool('line')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool])

  function fitCanvas() {
    if (!stageRef.current) return
    const container = stageRef.current.container()
    const cw = canvasSize?.width || 1200
    const ch = canvasSize?.height || 800
    const w = container.offsetWidth
    const h = container.offsetHeight
    const fit = Math.min((w - 80) / cw, (h - 80) / ch, 1)
    setZoom(fit)
    setStagePosition({ x: (w - cw * fit) / 2, y: (h - ch * fit) / 2 })
  }

  const toolBtn = (id, icon, label) => (
    <button key={id} onClick={() => setTool(id)} title={label}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-150 ${tool === id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
      {icon}
    </button>
  )

  return (
    <div className="relative h-13 bg-white border-b border-gray-200 flex items-center px-4 gap-1.5 select-none shadow-sm" style={{ height: 52 }}>
      {MAIN_TOOLS.map(t => toolBtn(t.id, t.icon, t.label))}
      <Divider />
      {PRIMARY_SHAPES.map(s => toolBtn(s.id, s.icon, s.label))}
      <button onClick={() => setShowShapes(v => !v)}
        className={`flex items-center gap-1 px-2.5 h-9 rounded-xl text-xs font-semibold transition-all duration-150 ${showShapes ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
        <span className="text-base">⊕</span>
        <span>More</span>
      </button>
      <Divider />
      <button onClick={undo} title="Undo (Ctrl+Z)" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all text-base">↩</button>
      <button onClick={redo} title="Redo (Ctrl+Y)" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all text-base">↪</button>
      {selectedId && (
        <>
          <Divider />
          <button onClick={() => deleteShape(selectedId)} title="Delete selected (Del)"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-all">🗑</button>
        </>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 h-9">
        <button onClick={() => setZoom(Math.max(0.05, zoom / 1.2))} className="w-7 h-7 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 font-bold transition-all">−</button>
        <button onClick={fitCanvas} className="px-2 text-xs font-semibold text-gray-700 hover:text-indigo-600 min-w-[48px] text-center transition-colors">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(Math.min(5, zoom * 1.2))} className="w-7 h-7 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 font-bold transition-all">+</button>
      </div>
      <Divider />
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 h-9 rounded-xl transition-all disabled:opacity-50">
        {saving ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : '💾'}
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => setShowExport(v => !v)}
        className={`flex items-center gap-1.5 text-sm font-semibold px-4 h-9 rounded-xl transition-all shadow-sm ${showExport ? 'bg-purple-600 text-white' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'}`}>
        ⬇ Export
      </button>
      <button
  onClick={() => { setShowCodeGen(v => !v); setShowExport(false) }}
  className={`flex items-center gap-1.5 text-sm font-semibold px-4 h-9 rounded-xl transition-all shadow-sm ${
    showCodeGen
      ? 'bg-violet-700 text-white'
      : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-violet-200'
  }`}>
  &lt;/&gt; Export Code
</button>
{showCodeGen && (
  <CodeGenPanel
    designId={designId}
    designTitle={designTitle}
    onClose={() => setShowCodeGen(false)}
  />
)}
      
      {showShapes && <ShapesDialog currentTool={tool} onSelect={setTool} onClose={() => setShowShapes(false)} />}
      {showExport && <ExportDialog stageRef={stageRef} onClose={() => setShowExport(false)} />}
      
    </div>
  )
}

function Divider() {
  return <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />
}
