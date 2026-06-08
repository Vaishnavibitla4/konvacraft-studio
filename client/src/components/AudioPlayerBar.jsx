import { useState, useRef, useEffect } from 'react'
import { useAudioStore } from '../store/audioStore'
import AudioTrimmer from './AudioTrimmer'

/**
 * Multi-track audio bar — each added audio appears as its own timeline row.
 *
 * Canva-style interaction model:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  [#] [🎵] [Name]  [▶]  [════╠══════════╣════]  [vol] [🔁] [✂️] [✕] │
 *  └─────────────────────────────────────────────────────────────┘
 *
 *  The waveform strip has THREE interaction zones:
 *    • Left handle  (green/purple bar, ew-resize) → trim start
 *    • Right handle (green/purple bar, ew-resize) → trim end
 *    • Body of the active region (grab cursor)    → move entire track (timelineOffset)
 *
 *  The waveform background represents the MASTER TIMELINE (total video duration
 *  or a sensible default). The coloured active block sits at timelineOffset and
 *  spans the clip duration.
 */
export default function AudioPlayerBar({ isPresentation = false, masterDuration = 0 }) {
  const { tracks } = useAudioStore()

  if (!tracks || tracks.length === 0) return null

  if (isPresentation) {
    return <SingleTrackBar trackState={tracks[0]} />
  }

  return (
    <div className="shrink-0 flex flex-col" style={{ borderTop: '1px solid rgba(16,185,129,0.18)' }}>
      {tracks.map((trackState, idx) => (
        <TrackRow
          key={trackState.track.id}
          trackState={trackState}
          index={idx}
          total={tracks.length}
          masterDuration={masterDuration}
        />
      ))}
    </div>
  )
}

// ─── Single compact track row ────────────────────────────────────────────────
function TrackRow({ trackState, index, total, masterDuration = 30 }) {
  const { track, trimStart, trimEnd, timelineOffset = 0, volume, loop, isPlaying, currentTime } = trackState
  const { play, pause, togglePlay, setVolume, setLoop, seek, removeTrack, setTrim, setTimelineOffset } = useAudioStore()

  const [showTrimmer, setShowTrimmer] = useState(false)
  // 'trim-start' | 'trim-end' | 'move' | 'seek' | null
  const [dragging, setDragging] = useState(null)
  const [waveData, setWaveData] = useState([])
  const [loadingWave, setLoadingWave] = useState(true)

  const stripRef = useRef()

  // Refs to always-fresh values for drag handlers
  const trimStartRef    = useRef(trimStart)
  const trimEndRef      = useRef(trimEnd)
  const offsetRef       = useRef(timelineOffset)
  const durRef          = useRef(track.duration || 0)
  const masterDurRef    = useRef(masterDuration || 30)
  const dragStartXRef   = useRef(0)       // clientX when move-drag started
  const dragStartOffRef = useRef(0)       // timelineOffset when move-drag started

  useEffect(() => { trimStartRef.current    = trimStart },      [trimStart])
  useEffect(() => { trimEndRef.current      = trimEnd },        [trimEnd])
  useEffect(() => { offsetRef.current       = timelineOffset }, [timelineOffset])
  useEffect(() => { durRef.current          = track.duration || 0 }, [track.duration])
  useEffect(() => { masterDurRef.current    = masterDuration || 30 }, [masterDuration])

  const duration   = track.duration || 1
  const clipEnd    = trimEnd ?? duration
  const clipDur    = Math.max(0.01, clipEnd - trimStart)
  const elapsed    = Math.max(0, currentTime - trimStart)

  // Master timeline reference: use masterDuration if provided, else track duration
  const master     = Math.max(masterDurRef.current, clipDur + timelineOffset, 1)

  // Positions as fractions of the master timeline strip
  const blockLeft  = timelineOffset / master          // where block starts
  const blockWidth = clipDur / master                 // width of active block
  const blockRight = blockLeft + blockWidth

  // Trim handles as fractions of the master timeline strip (within the block)
  // The trim handles control which part of the audio file plays, not the block position
  // They are shown inside the block
  const currentPct = Math.min(blockRight, blockLeft + (elapsed / master))

  // Decode waveform once
  useEffect(() => {
    let cancelled = false
    async function decode() {
      setLoadingWave(true)
      try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)()
        const resp = await fetch(track.src, { mode: 'cors' })
        const buf  = await resp.arrayBuffer()
        const decoded = await ctx.decodeAudioData(buf)
        ctx.close()
        if (cancelled) return
        const raw  = decoded.getChannelData(0)
        const bars = 120
        const step = Math.floor(raw.length / bars)
        const data = []
        for (let i = 0; i < bars; i++) {
          let sum = 0
          for (let j = 0; j < step; j++) sum += Math.abs(raw[i * step + j] || 0)
          data.push(sum / step)
        }
        const max = Math.max(...data, 0.001)
        if (!cancelled) setWaveData(data.map(v => v / max))
      } catch {
        if (!cancelled) {
          setWaveData(Array.from({ length: 120 }, (_, i) =>
            0.3 + 0.6 * Math.abs(Math.sin(i * 0.18) * Math.cos(i * 0.07))
          ))
        }
      }
      if (!cancelled) setLoadingWave(false)
    }
    decode()
    return () => { cancelled = true }
  }, [track.src])

  // ── Unified drag logic ───────────────────────────────────────────────
  function getStripPct(clientX) {
    const el = stripRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function onTrimStartDown(e) {
    e.preventDefault(); e.stopPropagation()
    setDragging('trim-start')
  }
  function onTrimEndDown(e) {
    e.preventDefault(); e.stopPropagation()
    setDragging('trim-end')
  }
  function onMoveDown(e) {
    e.preventDefault(); e.stopPropagation()
    dragStartXRef.current   = e.clientX
    dragStartOffRef.current = offsetRef.current
    setDragging('move')
  }
  function onSeekDown(e) {
    // Clicking outside the block = seek within that block position
    e.preventDefault()
    setDragging('seek')
  }

  useEffect(() => {
    if (!dragging) return

    function onMove(e) {
      const pct = getStripPct(e.clientX)
      const m   = masterDurRef.current || 30

      if (dragging === 'trim-start') {
        // Trim start adjusts which part of the audio file plays (within the block)
        // Convert strip pct back relative to audio file
        const blockOff = offsetRef.current
        const posInMaster = pct * m
        // trim-start changes what part of audio plays, not the block position
        const newTrimStart = Math.max(0, Math.min(posInMaster - blockOff + (trimStartRef.current || 0), (trimEndRef.current ?? durRef.current) - 0.5))
        // Keep block position fixed, only change trim window
        const clampedTs = Math.max(0, Math.min(newTrimStart, (trimEndRef.current ?? durRef.current) - 0.5))
        setTrim(track.id, clampedTs, trimEndRef.current)

      } else if (dragging === 'trim-end') {
        const blockOff = offsetRef.current
        const posInMaster = pct * m
        const newTrimEnd = (trimStartRef.current || 0) + (posInMaster - blockOff - ((trimStartRef.current || 0) - (trimStartRef.current || 0)))
        // Simpler: trim-end moves right handle, shrinking/expanding clip window
        const clipRelative = posInMaster - blockOff
        const newTe = Math.max((trimStartRef.current || 0) + 0.5, Math.min((trimStartRef.current || 0) + clipRelative, durRef.current))
        setTrim(track.id, trimStartRef.current, newTe)

      } else if (dragging === 'move') {
        // Drag the ENTIRE block left/right on the master timeline
        const el = stripRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const deltaX = e.clientX - dragStartXRef.current
        const deltaSeconds = (deltaX / rect.width) * m
        const newOffset = Math.max(0, dragStartOffRef.current + deltaSeconds)
        setTimelineOffset(track.id, newOffset)

      } else if (dragging === 'seek') {
        const posInMaster = pct * m
        const off = offsetRef.current
        const clipD = (trimEndRef.current ?? durRef.current) - (trimStartRef.current || 0)
        if (posInMaster >= off && posInMaster <= off + clipD) {
          const posInClip = posInMaster - off
          const ct = (trimStartRef.current || 0) + posInClip
          seek(track.id, ct)
        }
      }
    }

    function onUp() { setDragging(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, track.id])

  function fmt(t) {
    if (!isFinite(t) || t < 0) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const color1 = index % 2 === 0 ? '#10b981' : '#7c3aed'
  const color2 = index % 2 === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(124,58,237,0.2)'

  return (
    <>
      <div
        className="shrink-0 flex flex-col gap-0"
        style={{
          background: index % 2 === 0
            ? 'linear-gradient(90deg,rgba(16,185,129,0.10),rgba(124,58,237,0.12),rgba(16,185,129,0.10))'
            : 'linear-gradient(90deg,rgba(124,58,237,0.10),rgba(16,185,129,0.12),rgba(124,58,237,0.10))',
          borderBottom: total > 1 && index < total - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}
      >
        {/* Controls row */}
        <div className="flex items-center gap-2.5 px-3 pt-2 pb-1">
          {/* Track number */}
          <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
            style={{ background: index % 2 === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)', color: color1 }}>
            {index + 1}
          </div>

          {/* Music icon */}
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0"
            style={{ background: index % 2 === 0 ? 'linear-gradient(135deg,#10b981,#7c3aed)' : 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            🎵
          </div>

          {/* Name + offset info */}
          <div className="min-w-0 shrink-0" style={{ maxWidth: 130 }}>
            <p className="text-[10px] font-bold text-white truncate">{track.name || 'Audio Track'}</p>
            <p className="text-[9px]" style={{ color: index % 2 === 0 ? '#6ee7b7' : '#c4b5fd' }}>
              {timelineOffset > 0 ? `@${fmt(timelineOffset)} · ` : ''}{fmt(trimStart)}–{fmt(clipEnd)}
            </p>
          </div>

          {/* Play/Pause — only controls THIS track */}
          <button
            onClick={() => togglePlay(track.id)}
            title={isPlaying ? 'Pause this track' : 'Preview this track'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shrink-0 transition-all hover:scale-110"
            style={{ background: isPlaying ? 'rgba(16,185,129,0.5)' : 'rgba(124,58,237,0.5)' }}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* ── MASTER TIMELINE STRIP ─────────────────────────────── */}
          {/* The strip represents the full master timeline.
              The coloured block sits at timelineOffset and can be dragged.
              Trim handles live at the edges of the block. */}
          <div
            ref={stripRef}
            className="flex-1 relative rounded-lg overflow-visible"
            style={{
              height: 36,
              minWidth: 80,
              cursor: dragging === 'move' ? 'grabbing' : 'default',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
            onMouseDown={onSeekDown}
          >
            {/* Waveform bars (full strip = master timeline context) */}
            {loadingWave ? (
              <div className="flex items-center justify-center h-full">
                <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-end gap-px px-px pointer-events-none">
                {waveData.map((amp, i) => {
                  // Only bars inside the active block are lit
                  const barPct = i / waveData.length
                  const inBlock = barPct >= blockLeft && barPct <= blockRight
                  return (
                    <div key={i} style={{
                      flex: 1,
                      height: `${Math.max(15, amp * 100)}%`,
                      background: inBlock ? color1 : color2,
                      borderRadius: 1,
                      transition: 'background 0.1s',
                    }} />
                  )
                })}
              </div>
            )}

            {/* Dark overlay for the area before the block */}
            {blockLeft > 0 && (
              <div className="absolute top-0 bottom-0 left-0 pointer-events-none rounded-l-lg"
                style={{ width: `${blockLeft * 100}%`, background: 'rgba(0,0,0,0.6)', zIndex: 2 }} />
            )}

            {/* Dark overlay after the block */}
            {blockRight < 1 && (
              <div className="absolute top-0 bottom-0 right-0 pointer-events-none rounded-r-lg"
                style={{ width: `${(1 - blockRight) * 100}%`, background: 'rgba(0,0,0,0.6)', zIndex: 2 }} />
            )}

            {/* ── ACTIVE BLOCK (moveable body) ── */}
            <div
              className="absolute top-0 bottom-0 pointer-events-auto"
              style={{
                left:   `${blockLeft * 100}%`,
                width:  `${Math.max(1, blockWidth * 100)}%`,
                cursor: dragging === 'move' ? 'grabbing' : 'grab',
                zIndex: 4,
                border: `2px solid ${color1}`,
                borderRadius: 4,
                boxShadow: `0 0 8px ${color1}55`,
              }}
              onMouseDown={onMoveDown}
              title="Drag to reposition on timeline"
            />

            {/* ── TRIM START HANDLE ── */}
            <div
              className="absolute top-0 bottom-0 flex items-center justify-center"
              style={{
                left:   `calc(${blockLeft * 100}% - 8px)`,
                width:  16,
                zIndex: 10,
                cursor: 'ew-resize',
              }}
              onMouseDown={e => { e.stopPropagation(); onTrimStartDown(e) }}
              title="Trim start"
            >
              <div
                className="w-3 h-full flex flex-col items-center justify-center gap-0.5 rounded-l"
                style={{ background: color1, boxShadow: `0 0 8px ${color1}bb` }}>
                <div className="w-px h-2.5 rounded-full bg-white/80" />
                <div className="w-px h-2.5 rounded-full bg-white/80" />
              </div>
            </div>

            {/* ── TRIM END HANDLE ── */}
            <div
              className="absolute top-0 bottom-0 flex items-center justify-center"
              style={{
                left:   `calc(${blockRight * 100}% - 8px)`,
                width:  16,
                zIndex: 10,
                cursor: 'ew-resize',
              }}
              onMouseDown={e => { e.stopPropagation(); onTrimEndDown(e) }}
              title="Trim end"
            >
              <div
                className="w-3 h-full flex flex-col items-center justify-center gap-0.5 rounded-r"
                style={{ background: color1, boxShadow: `0 0 8px ${color1}bb` }}>
                <div className="w-px h-2.5 rounded-full bg-white/80" />
                <div className="w-px h-2.5 rounded-full bg-white/80" />
              </div>
            </div>

            {/* Playhead (during preview playback) */}
            {(isPlaying || elapsed > 0) && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left:       `${currentPct * 100}%`,
                  width:      2,
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow:  '0 0 6px rgba(255,255,255,0.8)',
                  zIndex:     11,
                }}
              />
            )}

            {/* Offset label inside the block */}
            {timelineOffset > 0 && blockWidth > 0.08 && (
              <div className="absolute top-0 bottom-0 flex items-center pointer-events-none"
                style={{ left: `${blockLeft * 100}%`, paddingLeft: 6, zIndex: 5 }}>
                <span className="text-[8px] font-mono text-white/60">+{fmt(timelineOffset)}</span>
              </div>
            )}
          </div>

          {/* Elapsed */}
          <span className="text-[10px] font-mono text-white/35 shrink-0 w-8">{fmt(elapsed)}</span>

          {/* Volume */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-white/30">{volume === 0 ? '🔇' : '🔊'}</span>
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={e => setVolume(track.id, Number(e.target.value))}
              className="cursor-pointer" style={{ width: 50, height: 4, accentColor: color1 }} />
          </div>

          {/* Loop */}
          <button onClick={() => setLoop(track.id, !loop)}
            className={`text-xs px-1.5 py-1 rounded-lg border transition-all shrink-0 ${loop ? 'border-emerald-500/60 text-emerald-300 bg-emerald-950/50' : 'border-white/10 text-white/30 hover:text-white/60'}`}
            title="Loop">🔁</button>

          {/* Trim modal */}
          <button onClick={() => setShowTrimmer(true)}
            className="flex items-center gap-1 text-[10px] font-semibold text-white/50 hover:text-white px-2 py-1.5 rounded-lg border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/30 transition-all shrink-0">
            ✂️ Trim
          </button>

          {/* Remove */}
          <button onClick={() => removeTrack(track.id)}
            className="w-5 h-5 rounded-md flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-950/30 transition-all shrink-0 text-xs"
            title="Remove track">✕</button>
        </div>

        {/* Slim progress bar */}
        <div className="px-3 pb-2">
          <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="absolute h-full rounded-full"
              style={{
                left:  `${blockLeft * 100}%`,
                width: `${blockWidth * 100}%`,
                background: 'rgba(255,255,255,0.1)',
              }} />
            {(isPlaying || elapsed > 0) && (
              <div className="h-full rounded-full transition-none"
                style={{
                  width:      `${Math.min(currentPct, blockRight) * 100}%`,
                  background: index % 2 === 0
                    ? 'linear-gradient(90deg,#10b981,#7c3aed)'
                    : 'linear-gradient(90deg,#7c3aed,#ec4899)',
                }} />
            )}
          </div>
        </div>
      </div>

      {showTrimmer && (
        <AudioTrimmer
          src={track.src}
          duration={track.duration}
          trimStart={trimStart}
          trimEnd={trimEnd ?? track.duration}
          volume={volume}
          loop={loop}
          onApply={({ trimStart: ts, trimEnd: te, volume: v, loop: l }) => {
            setTrim(track.id, ts, te)
            setVolume(track.id, v)
            setLoop(track.id, l)
          }}
          onClose={() => setShowTrimmer(false)}
        />
      )}
    </>
  )
}

// ── Legacy single-track bar for presentation mode ─────────────────────────────
function SingleTrackBar({ trackState }) {
  const { track, isPlaying, volume, loop, currentTime, trimStart, trimEnd } = trackState
  const { togglePlay, setVolume, setLoop, seek, removeTrack, setTrim } = useAudioStore()
  const [showTrimmer, setShowTrimmer] = useState(false)
  const progressRef = useRef()

  if (!track) return null

  const duration = track.duration || 1
  const clipEnd  = trimEnd ?? duration
  const clipDur  = clipEnd - trimStart
  const elapsed  = Math.max(0, currentTime - trimStart)
  const progress = clipDur > 0 ? Math.min(1, elapsed / clipDur) : 0

  function seekOnBar(e) {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(track.id, trimStart + pct * clipDur)
  }

  function fmt(t) {
    if (!isFinite(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const BARS = 32

  return (
    <>
      <div className="shrink-0 flex items-center gap-3 px-4"
        style={{ height: 52, background: 'linear-gradient(90deg,rgba(16,185,129,0.12),rgba(124,58,237,0.14),rgba(16,185,129,0.12))', borderTop: '1px solid rgba(16,185,129,0.25)', backdropFilter: 'blur(12px)' }}>
        <style>{`@keyframes barDance{0%,100%{transform:scaleY(0.35)}50%{transform:scaleY(1)}}`}</style>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{ background: 'linear-gradient(135deg,#10b981,#7c3aed)' }}>🎵</div>
        <div className="min-w-0 shrink-0" style={{ maxWidth: 140 }}>
          <p className="text-[11px] font-bold text-white truncate">{track.name || 'Audio Track'}</p>
          {(trimStart > 0 || trimEnd != null) && (
            <p className="text-[9px] text-emerald-300/70">{fmt(trimStart)} – {fmt(clipEnd)}</p>
          )}
        </div>
        <button onClick={() => togglePlay(track.id)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm shrink-0 transition-all hover:scale-110"
          style={{ background: isPlaying ? 'rgba(16,185,129,0.5)' : 'rgba(124,58,237,0.5)' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="flex items-end gap-px shrink-0" style={{ height: 26, width: BARS * 4 }}>
          {Array.from({ length: BARS }).map((_, i) => {
            const seed = Math.abs(Math.sin(i * 2.3 + 1.1) * Math.cos(i * 0.7))
            const height = 28 + seed * 72
            return <div key={i} style={{ width: 3, height: `${height}%`, background: isPlaying ? `hsl(${160 + i * 2},70%,${50 + seed * 25}%)` : 'rgba(16,185,129,0.3)', borderRadius: 2, transformOrigin: 'bottom', animation: isPlaying ? `barDance ${0.4 + seed * 0.6}s ease-in-out infinite` : 'none', animationDelay: `${(i / BARS) * 0.4}s` }} />
          })}
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-white/40 shrink-0">{fmt(elapsed)}</span>
          <div ref={progressRef} className="flex-1 relative h-1.5 rounded-full cursor-pointer overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.1)' }} onClick={seekOnBar}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,#10b981,#7c3aed)' }} />
          </div>
          <span className="text-[10px] font-mono text-white/40 shrink-0">{fmt(clipDur)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-white/30">{volume === 0 ? '🔇' : '🔊'}</span>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => setVolume(track.id, Number(e.target.value))}
            className="accent-emerald-500 cursor-pointer" style={{ width: 60, height: 4 }} />
        </div>
        <button onClick={() => setLoop(track.id, !loop)}
          className={`text-xs px-2 py-1 rounded-lg border transition-all shrink-0 ${loop ? 'border-emerald-500/60 text-emerald-300 bg-emerald-950/50' : 'border-white/10 text-white/30 hover:text-white/60'}`}>🔁</button>
        <button onClick={() => setShowTrimmer(true)}
          className="flex items-center gap-1 text-[11px] font-semibold text-white/60 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/30 transition-all shrink-0">
          ✂️ Trim
        </button>
        <button onClick={() => removeTrack(track.id)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-950/30 transition-all shrink-0 text-xs">✕</button>
      </div>
      {showTrimmer && (
        <AudioTrimmer src={track.src} duration={track.duration} trimStart={trimStart}
          trimEnd={trimEnd ?? track.duration} volume={volume} loop={loop}
          onApply={({ trimStart: ts, trimEnd: te, volume: v, loop: l }) => { setTrim(track.id, ts, te); setVolume(track.id, v); setLoop(track.id, l) }}
          onClose={() => setShowTrimmer(false)} />
      )}
    </>
  )
}
