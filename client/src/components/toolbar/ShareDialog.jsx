import { useState, useRef, useEffect } from 'react'

export default function ShareDialog({ designId, designTitle, onClose }) {
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef()

  const origin    = window.location.origin
  const embedCode = `<iframe\n  src="${origin}/embed/${designId}"\n  width="100%"\n  height="600"\n  style="border:none;border-radius:12px;"\n  title="${designTitle || 'KonvaCraft Design'}"\n></iframe>`

  useEffect(() => {
    function handler(e) {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(embedCode)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = embedCode
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div ref={dialogRef} className="absolute right-0 top-14 z-50"
      style={{ width: 400 }}>
      <div className="rounded-2xl shadow-2xl"
        style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid #f1f1f3' }}>
          <p className="text-sm font-bold text-gray-900">Get Embed Code</p>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all text-sm">
            ✕
          </button>
        </div>

        {/* Code block */}
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-3">
            Paste this code into any webpage to embed your design.
          </p>
          <div className="relative rounded-xl overflow-hidden"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <pre className="text-xs font-mono text-emerald-300 p-4 pr-20 leading-relaxed overflow-x-auto whitespace-pre">
{embedCode}
            </pre>
            <button onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: copied ? '#059669' : 'rgba(255,255,255,0.12)',
                color:      copied ? '#fff'    : '#94a3b8',
                border:     '1px solid rgba(255,255,255,0.1)',
              }}>
              {copied ? '✓ Copied!' : '⎘ Copy'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
