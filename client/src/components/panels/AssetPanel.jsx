import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../lib/api'
import { useEditorStore } from '../../store/editorStore'
import { useAudioStore } from '../../store/audioStore'
import ImageSearch from '../ImageSearch'
import { toast } from '../Toast'

const NAV_TABS = [
  { id: 'images', icon: '🖼', label: 'Images' },
  { id: 'videos', icon: '🎬', label: 'Videos' },
  { id: 'audio',  icon: '🎵', label: 'Audio'  },
  { id: 'shapes', icon: '◻', label: 'Shapes' },
  { id: 'text',   icon: 'T',  label: 'Text'   },
]

const SHAPE_PRESETS = [
  { id: 'rect',      icon: '▭', label: 'Rect'    },
  { id: 'roundrect', icon: '▢', label: 'Rounded' },
  { id: 'circle',    icon: '●', label: 'Circle'  },
  { id: 'ellipse',   icon: '⬭', label: 'Ellipse' },
  { id: 'triangle',  icon: '▲', label: 'Triangle'},
  { id: 'pentagon',  icon: '⬠', label: 'Pentagon'},
  { id: 'hexagon',   icon: '⬡', label: 'Hexagon' },
  { id: 'star',      icon: '★', label: 'Star'    },
  { id: 'arrow',     icon: '→', label: 'Arrow'   },
  { id: 'line',      icon: '╱', label: 'Line'    },
]

const TEXT_PRESETS = [
  { fontFamily: 'Inter',            fontSize: 48, fontStyle: 'bold',   label: 'Heading',     color: '#ffffff' },
  { fontFamily: 'Playfair Display', fontSize: 42, fontStyle: 'normal', label: 'Elegant',     color: '#ffffff' },
  { fontFamily: 'Montserrat',       fontSize: 36, fontStyle: '600',    label: 'Modern',      color: '#ffffff' },
  { fontFamily: 'Poppins',          fontSize: 32, fontStyle: 'normal', label: 'Friendly',    color: '#ffffff' },
  { fontFamily: 'Oswald',           fontSize: 36, fontStyle: 'bold',   label: 'Impact',      color: '#ffffff' },
  { fontFamily: 'Dancing Script',   fontSize: 40, fontStyle: 'normal', label: 'Script',      color: '#c4b5fd' },
  { fontFamily: 'Bebas Neue',       fontSize: 44, fontStyle: 'normal', label: 'Display',     color: '#f9a8d4' },
  { fontFamily: 'Special Elite',    fontSize: 28, fontStyle: 'normal', label: 'Typewriter',  color: '#ffffff' },
  { fontFamily: 'Lobster',          fontSize: 38, fontStyle: 'normal', label: 'Fun',         color: '#fcd34d' },
  { fontFamily: 'Permanent Marker', fontSize: 30, fontStyle: 'normal', label: 'Handwritten', color: '#6ee7b7' },
]

function formatDuration(secs) {
  if (!secs || !isFinite(secs)) return null
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Get video duration from a File safely ──────────────────────────────────
function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)

    const cleanup = () => {
      // Don't revoke immediately - some browsers need the URL during loadedmetadata
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    video.onloadedmetadata = () => {
      const d = video.duration
      cleanup()
      resolve(isFinite(d) && d > 0 ? d : null)
    }

    video.onerror = () => {
      cleanup()
      resolve(null)  // resolve null on error — don't block upload
    }

    // Timeout fallback: if metadata doesn't load in 8s, allow upload anyway
    setTimeout(() => {
      cleanup()
      resolve(null)
    }, 8000)

    video.src = url
  })
}

// ── Thumbnail for video grid ────────────────────────────────────────────────
function VideoThumbnail({ src, duration }) {
  const [thumbSrc, setThumbSrc] = useState(null)
  const [error, setError]       = useState(false)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload     = 'metadata'
    video.muted       = true
    video.src         = src

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1)
    }

    video.onseeked = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = video.videoWidth  || 320
        canvas.height = video.videoHeight || 180
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        setThumbSrc(canvas.toDataURL('image/jpeg', 0.7))
      } catch { setError(true) }
    }

    video.onerror = () => { if (!cancelled) setError(true) }
    video.load()

    return () => { cancelled = true }
  }, [src])

  return (
    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden">
      {thumbSrc
        ? <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
        : error
          ? <span className="text-2xl">🎬</span>
          : <span className="text-white/20 text-xs">…</span>
      }
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white text-xs">▶</div>
      </div>
      {duration && (
        <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
          {formatDuration(duration)}
        </div>
      )}
    </div>
  )
}


export default function AssetPanel() {
  const [tab,            setTab]            = useState('images')
  const [assets,         setAssets]         = useState([])
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [searchMode,     setSearchMode]     = useState(false)
  const fileRef = useRef()

  const { addShape, setTool } = useEditorStore()
  const audioStore = useAudioStore()

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    try {
      const res = await api.get('/assets')
      setAssets(res.data)
    } catch { toast.error('Failed to load assets') }
  }

  // ── Generic upload handler ─────────────────────────────────────────────
  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    fileRef.current.value = ''

    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')
    const MAX_MB  = isVideo ? 500 : 50

    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB}MB limit`)
      return
    }

    // Validate video duration client-side (non-blocking — null means skip check)
    if (isVideo) {
      const dur = await getVideoDuration(file)
      if (dur !== null && dur > 600) {
        toast.error('Video exceeds 10-minute limit. Please trim it first.')
        return
      }
    }

    setUploading(true)
    setUploadProgress('Uploading 0%…')

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await api.post('/assets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10 * 60 * 1000,  // 10-minute timeout for large videos
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(`Uploading ${pct}%…`)
          }
        },
      })

      setAssets(prev => [res.data, ...prev])
      toast.success(`${isAudio ? 'Audio' : isVideo ? 'Video' : 'Image'} uploaded!`)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed'
      toast.error(`Upload failed: ${msg}`)
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }, [])

  function addImageToCanvas(a) {
    addShape({
      type: 'image',
      src: a.cloudinary_url || a.secure_url || a.url,
      x: 80, y: 80, width: 320, height: 220, opacity: 1,
    })
  }

  function addVideoToCanvas(a) {
    addShape({
      type: 'video',
      src: a.cloudinary_url || a.secure_url || a.url,
      x: 80, y: 80, width: 640, height: 360,
      opacity: 1, rotation: 0, visible: true,
      loop: false, muted: false, volume: 1, playbackRate: 1,
      trimStart: 0, trimEnd: null,
      duration: a.duration || null,
      brightness: 0, contrast: 0, blurRadius: 0, grayscale: false,
      cornerRadius: 0, keyframes: [], isPlaying: true,
    })
  }

  function addTextPreset(preset) {
    addShape({
      type: 'text', x: 100, y: 100,
      text: preset.label,
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontStyle: preset.fontStyle === '600' ? 'bold' : preset.fontStyle,
      fill: preset.color,
      opacity: 1,
    })
  }

  const images = assets.filter(a => a.resource_type !== 'video' && !a.file_type?.startsWith('audio/'))
  const videos  = assets.filter(a => a.resource_type === 'video')
  const audios  = assets.filter(a => a.resource_type === 'audio' || a.file_type?.startsWith('audio/'))

  const dark = 'rgba(15,12,28,0.98)'
  const border = '1px solid rgba(255,255,255,0.08)'

  return (
    <div className="flex h-full">
      {/* ── Sidebar icons ── */}
      <div className="w-14 flex flex-col items-center py-3 gap-1.5"
        style={{ background: 'rgba(10,8,20,0.99)', borderRight: border }}>
        {NAV_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${tab === t.id ? 'text-white shadow-lg' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
            style={tab === t.id ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' } : {}}>
            <span className="text-base leading-none">{t.icon}</span>
            <span className="text-[9px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Panel body ── */}
      <div className="w-64 flex flex-col h-full overflow-hidden" style={{ background: dark }}>

        {/* ══ IMAGES ══ */}
        {tab === 'images' && (
          <>
            <div className="p-3" style={{ borderBottom: border }}>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Image Library</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <div className="flex gap-2">
                <button onClick={() => fileRef.current.click()} disabled={uploading}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold border border-violet-500/40 text-violet-300 hover:bg-violet-950/50 disabled:opacity-50 transition-all">
                  {uploading ? uploadProgress : '+ Upload'}
                </button>
                {searchMode
                  ? <button onClick={() => setSearchMode(false)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-violet-500/60 text-violet-300 bg-violet-950/40 hover:bg-violet-950/70 transition-all">📁 Files</button>
                  : <button onClick={() => setSearchMode(true)}
                      className="px-2.5 py-1.5 rounded-xl text-xs border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">🔍 Search</button>
                }
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchMode ? (
                <div className="p-2"><ImageSearch key="search" onSearch={() => {}} /></div>
              ) : (
                <>
                  <div className="p-2" style={{ borderBottom: border }}>
                    <button onClick={() => setSearchMode(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span>🔍</span><span>Search Unsplash / Pexels…</span>
                    </button>
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5">
                    {images.map(a => (
                      <div key={a.id} className="relative rounded-xl overflow-hidden cursor-pointer group" style={{ height: 80 }}
                        onClick={() => addImageToCanvas(a)}>
                        <img src={a.cloudinary_url || a.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          style={{ background: 'rgba(124,58,237,0.55)' }}>
                          <span className="text-white font-bold text-xl">+</span>
                        </div>
                      </div>
                    ))}
                    {images.length === 0 && (
                      <div className="col-span-2 flex flex-col items-center justify-center py-10 text-white/20">
                        <span className="text-3xl mb-2">🖼</span>
                        <p className="text-xs text-center">Upload images or search above</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ══ VIDEOS ══ */}
        {tab === 'videos' && (
          <>
            <div className="p-3" style={{ borderBottom: border }}>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Video Library</p>
              <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} className="hidden" />
              <button onClick={() => fileRef.current.click()} disabled={uploading}
                className="w-full py-1.5 rounded-xl text-xs font-bold border border-violet-500/40 text-violet-300 hover:bg-violet-950/50 disabled:opacity-50 transition-all">
                {uploading ? uploadProgress : '+ Upload Video'}
              </button>
              <p className="text-[9px] text-white/20 mt-1.5 text-center">Max 10 minutes · 500MB</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {videos.map(a => (
                  <div key={a.id} className="relative rounded-xl overflow-hidden cursor-pointer group" style={{ height: 80 }}
                    onClick={() => addVideoToCanvas(a)}>
                    <VideoThumbnail src={a.cloudinary_url || a.url} duration={a.duration} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: 'rgba(124,58,237,0.55)' }}>
                      <span className="text-white font-bold text-xl">+</span>
                    </div>
                  </div>
                ))}
                {videos.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center py-10 text-white/20">
                    <span className="text-3xl mb-2">🎬</span>
                    <p className="text-xs text-center">Upload videos to get started</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══ AUDIO ══ */}
        {tab === 'audio' && (
          <AudioPanel
            audios={audios}
            uploading={uploading}
            uploadProgress={uploadProgress}
            fileRef={fileRef}
            onUpload={handleUpload}
            audioStore={audioStore}
          />
        )}

        {/* ══ SHAPES ══ */}
        {tab === 'shapes' && (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Basic Shapes</p>
            <p className="text-[10px] text-white/20 mb-3">Select tool, then click canvas to place</p>
            <div className="grid grid-cols-3 gap-2">
              {SHAPE_PRESETS.map(s => (
                <button key={s.id} onClick={() => setTool(s.id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/10 hover:border-violet-500/50 transition-all group"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-2xl text-white/70 group-hover:text-white transition-colors">{s.icon}</span>
                  <span className="text-[10px] font-medium text-white/40 group-hover:text-white/70">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ TEXT ══ */}
        {tab === 'text' && (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Text Styles</p>
            <p className="text-[10px] text-white/20 mb-3">Click to add text to canvas</p>
            <div className="space-y-2">
              {TEXT_PRESETS.map((p, i) => (
                <button key={i} onClick={() => addTextPreset(p)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-white/10 hover:border-violet-500/40 transition-all group"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontFamily: p.fontFamily, fontSize: Math.min(p.fontSize * 0.45, 20), fontWeight: p.fontStyle === 'bold' || p.fontStyle === '600' ? 700 : 400, color: p.color }}>
                      {p.label}
                    </span>
                    <span className="text-[9px] text-white/20 shrink-0 group-hover:text-white/40 transition-colors truncate max-w-[80px]">
                      {p.fontFamily}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Audio Panel ────────────────────────────────────────────────────────────
function AudioPanel({ audios, uploading, uploadProgress, fileRef, onUpload, audioStore }) {
  const { tracks, addTrack, removeTrack } = audioStore
  const [previewId, setPreviewId] = useState(null)
  const previewRef = useRef(null)

  const activeIds = new Set((tracks || []).map(t => t.track.id))

  function playPreview(a) {
    if (previewId === a.id) {
      previewRef.current?.pause()
      setPreviewId(null)
    } else {
      if (previewRef.current) previewRef.current.pause()
      const audio = new Audio(a.cloudinary_url || a.url)
      audio.volume = 0.6
      audio.onended = () => setPreviewId(null)
      audio.play().catch(() => {})
      previewRef.current = audio
      setPreviewId(a.id)
    }
  }

  function useTrack(a) {
    if (previewRef.current) { previewRef.current.pause(); setPreviewId(null) }
    if (activeIds.has(a.id)) {
      removeTrack(a.id)
      return
    }
    addTrack({
      id:       a.id,
      src:      a.cloudinary_url || a.url,
      name:     a.original_filename || 'Audio Track',
      duration: a.duration || null,
    })
    toast.success('Audio added — timeline shown below canvas. Drag handles to trim.')
  }

  useEffect(() => () => { previewRef.current?.pause() }, [])

  return (
    <>
      <div className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Audio Library</p>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={onUpload} className="hidden" />
        <button onClick={() => fileRef.current.click()} disabled={uploading}
          className="w-full py-1.5 rounded-xl text-xs font-bold border border-violet-500/40 text-violet-300 hover:bg-violet-950/50 disabled:opacity-50 transition-all">
          {uploading ? uploadProgress : '+ Upload Audio'}
        </button>
        <p className="text-[9px] text-white/20 mt-1 text-center">MP3, WAV, OGG, M4A · Max 50MB</p>
      </div>

      {/* Active tracks summary */}
      {tracks && tracks.length > 0 && (
        <div className="mx-3 mt-3 rounded-xl px-3 py-2 flex items-center gap-2"
          style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <span className="text-sm">🎵</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-violet-300">
              {tracks.length} track{tracks.length > 1 ? 's' : ''} active
            </p>
            <p className="text-[9px] text-white/30">Timelines shown below canvas</p>
          </div>
        </div>
      )}

      {/* Audio list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {audios.map(a => {
          const isActive = activeIds.has(a.id)
          const trackIdx = (tracks || []).findIndex(t => t.track.id === a.id)
          return (
            <div key={a.id}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all group ${isActive ? 'border-violet-500/50 bg-violet-950/30' : 'border-white/8 hover:border-violet-500/30 hover:bg-white/3'}`}>
              <button onClick={() => playPreview(a)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 transition-all text-white"
                style={{ background: previewId === a.id ? 'linear-gradient(135deg,#ec4899,#7c3aed)' : 'rgba(124,58,237,0.3)' }}>
                {previewId === a.id ? '⏸' : '▶'}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-white/80 truncate">{a.original_filename || 'Audio'}</p>
                <p className="text-[9px] text-white/25">
                  {a.file_type?.split('/')[1]?.toUpperCase() || 'AUDIO'}
                  {a.duration ? ` · ${formatDuration(a.duration)}` : ''}
                  {isActive ? ` · Track ${trackIdx + 1}` : ''}
                </p>
              </div>
              <button onClick={() => useTrack(a)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                  isActive
                    ? 'text-red-300 bg-red-900/30 border-red-500/40 hover:bg-red-900/50'
                    : 'text-white/40 hover:text-white hover:bg-violet-900/50 border-white/10 opacity-0 group-hover:opacity-100'
                }`}
                title={isActive ? 'Remove track' : 'Add to design'}>
                {isActive ? '✕ Remove' : '+ Use'}
              </button>
            </div>
          )
        })}
        {audios.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-white/20">
            <span className="text-3xl mb-2">🎵</span>
            <p className="text-xs text-center">Upload audio files<br/>MP3, WAV, OGG, M4A</p>
          </div>
        )}
      </div>
    </>
  )
}
