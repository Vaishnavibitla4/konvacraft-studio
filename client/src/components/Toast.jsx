import { useState, useEffect, useCallback } from 'react'

// ── Global toast state (module-level singleton) ──────────────────────────────
let _setToasts = null
let _counter = 0

export function toast(message, type = 'info', duration = 4000) {
  if (!_setToasts) return
  const id = ++_counter
  _setToasts(prev => [...prev, { id, message, type, duration }])
  return id
}
toast.success = (msg, dur) => toast(msg, 'success', dur)
toast.error   = (msg, dur) => toast(msg, 'error',   dur ?? 6000)
toast.warning = (msg, dur) => toast(msg, 'warning', dur)
toast.info    = (msg, dur) => toast(msg, 'info',    dur)

// ── Confirm dialog (replaces window.confirm) ─────────────────────────────────
let _setConfirm = null
export function confirm(message, title = 'Are you sure?') {
  return new Promise(resolve => {
    if (!_setConfirm) { resolve(window.confirm(message)); return }
    _setConfirm({ message, title, resolve })
  })
}

// ── Prompt dialog (replaces window.prompt) ───────────────────────────────────
let _setPromptDialog = null
export function prompt(message, defaultValue = '', placeholder = '') {
  return new Promise(resolve => {
    if (!_setPromptDialog) { resolve(window.prompt(message, defaultValue)); return }
    _setPromptDialog({ message, defaultValue, placeholder, resolve })
  })
}

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

const COLORS = {
  success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', icon: '#10b981', bar: '#10b981' },
  error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  icon: '#ef4444', bar: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', icon: '#f59e0b', bar: '#f59e0b' },
  info:    { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', icon: '#818cf8', bar: '#818cf8' },
}

function ToastItem({ id, message, type, duration, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const c = COLORS[type] || COLORS.info

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100))
    }, 16)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(id), 300)
    }, duration)
    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [])

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(() => onDismiss(id), 300) }}
      className="cursor-pointer relative overflow-hidden rounded-2xl backdrop-blur-xl shadow-2xl"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        minWidth: 280, maxWidth: 380,
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(100%) scale(0.9)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
          style={{ background: c.icon, color: 'white' }}>
          {ICONS[type]}
        </div>
        <p className="text-white text-sm leading-relaxed font-medium pr-4">{message}</p>
      </div>
      <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full transition-none" style={{ width: `${progress}%`, background: c.bar }} />
      </div>
    </div>
  )
}

function ConfirmDialog({ data, onClose }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function respond(val) {
    setVisible(false)
    setTimeout(() => { data.resolve(val); onClose() }, 200)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s' }}>
      <div className="rounded-3xl border border-white/15 shadow-2xl p-6 max-w-sm w-full"
        style={{
          background: 'linear-gradient(135deg,rgba(26,10,46,0.98),rgba(13,13,24,0.98))',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl mb-4 mx-auto">
          ⚠️
        </div>
        <h3 className="text-white font-bold text-lg text-center mb-2">{data.title}</h3>
        <p className="text-white/60 text-sm text-center mb-6 leading-relaxed">{data.message}</p>
        <div className="flex gap-3">
          <button onClick={() => respond(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/15 hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button onClick={() => respond(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function PromptDialog({ data, onClose }) {
  const [value, setValue] = useState(data.defaultValue || '')
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function respond(val) {
    setVisible(false)
    setTimeout(() => { data.resolve(val); onClose() }, 200)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s' }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}>
      <div className="rounded-3xl border border-white/15 shadow-2xl p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg,rgba(26,10,46,0.98),rgba(13,13,24,0.98))',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
        <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-2xl mb-4 mx-auto">
          ✏️
        </div>
        <h3 className="text-white font-bold text-lg text-center mb-4">{data.message}</h3>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') respond(value.trim() || null); if (e.key === 'Escape') respond(null) }}
          placeholder={data.placeholder || ''}
          className="w-full px-4 py-3 rounded-xl text-white border border-white/10 outline-none focus:border-violet-500/60 mb-4 text-sm"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        />
        <div className="flex gap-3">
          <button onClick={() => respond(null)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/15 hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button onClick={() => respond(value.trim() || null)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Root provider — mount once in App.jsx ────────────────────────────────────
export function ToastProvider() {
  const [toasts, setToasts] = useState([])
  const [confirmData, setConfirmData] = useState(null)
  const [promptData, setPromptData] = useState(null)

  useEffect(() => {
    _setToasts = setToasts
    _setConfirm = setConfirmData
    _setPromptDialog = setPromptData
    return () => { _setToasts = null; _setConfirm = null; _setPromptDialog = null }
  }, [])

  const dismiss = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), [])

  return (
    <>
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
      {/* Confirm */}
      {confirmData && <ConfirmDialog data={confirmData} onClose={() => setConfirmData(null)} />}
      {/* Prompt */}
      {promptData && <PromptDialog data={promptData} onClose={() => setPromptData(null)} />}
    </>
  )
}
