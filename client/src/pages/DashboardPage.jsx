import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { toast, confirm, prompt } from '../components/Toast'
import api from '../lib/api'

const TEMPLATES = [
  { label: 'Blank Canvas',    w: 1200, h: 800,  icon: '◻', color: 'from-gray-500 to-gray-700' },
  { label: 'Social Post',     w: 1080, h: 1080, icon: '📱', color: 'from-violet-500 to-purple-700' },
  { label: 'Presentation',    w: 1920, h: 1080, icon: '📊', color: 'from-blue-500 to-indigo-700', isPresentation: true },
  { label: 'Banner',          w: 1200, h: 400,  icon: '🖼', color: 'from-pink-500 to-rose-600' },
  { label: 'Poster',          w: 800,  h: 1200, icon: '📄', color: 'from-orange-500 to-amber-600' },
  { label: 'Thumbnail',       w: 1280, h: 720,  icon: '🎬', color: 'from-emerald-500 to-teal-600' },
  { label: 'Images to Video', w: 1280, h: 720,  icon: '🎞', color: 'from-fuchsia-500 to-pink-600', isImagesToVideo: true },
]

function getDisplayName(user) {
  if (!user) return 'User'
  if (user.displayName) return user.displayName
  if (user.email) return user.email.split('@')[0]
  return 'User'
}

function getInitial(user) {
  if (!user) return 'U'
  const name = getDisplayName(user)
  return name[0]?.toUpperCase() || 'U'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function DashboardPage() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const [designs, setDesigns]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [creating, setCreating]             = useState(false)
  const [title, setTitle]                   = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [showCreate, setShowCreate]         = useState(false)
  const [searchQ, setSearchQ]               = useState('')
  const [menuOpen, setMenuOpen]             = useState(null)
  const [view, setView]                     = useState('grid') // 'grid' | 'list'

  useEffect(() => { loadDesigns() }, [])
  useEffect(() => {
    function close() { setMenuOpen(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  async function loadDesigns() {
    try {
      const r = await api.get('/designs')
      setDesigns(r.data)
    } catch { toast.error('Failed to load designs') }
    finally  { setLoading(false) }
  }

  async function createDesign() {
    const tpl = TEMPLATES[selectedTemplate]
    // Images to Video has its own dedicated page — navigate directly
    if (tpl.isImagesToVideo) {
      navigate('/images-to-video')
      setShowCreate(false)
      return
    }
    const name = title.trim() || tpl.label
    setCreating(true)
    try {
      const startPage = { id: crypto.randomUUID(), label: 'Page 1', shapes: [] }
      const res = await api.post('/designs', {
        title: name,
        canvas_json: {
  shapes: [],
  pages: [startPage],
  canvasSize: { width: tpl.w, height: tpl.h },

  isPresentationMode: tpl.isPresentation || false,
  isImagesToVideo: !!tpl.isImagesToVideo,

templateType: tpl.isImagesToVideo
  ? 'images-to-video'
  : 'editor',
},
      })
      navigate(`/editor/${res.data.id}`)
    } catch {
      toast.error('Failed to create design. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function deleteDesign(e, id) {
    e.stopPropagation()
    setMenuOpen(null)
    const ok = await confirm('This will permanently delete your design and cannot be undone.', 'Delete Design?')
    if (!ok) return
    try {
      await api.delete(`/designs/${id}`)
      setDesigns(prev => prev.filter(d => d.id !== id))
      toast.success('Design deleted')
    } catch {
      toast.error('Failed to delete design')
    }
  }

  async function renameDesign(e, design) {
    e.stopPropagation()
    setMenuOpen(null)
    const newTitle = await prompt('Enter a new name for your design', design.title || 'Untitled', 'Design name…')
    if (!newTitle?.trim()) return
    try {
      await api.put(`/designs/${design.id}`, { title: newTitle.trim() })
      setDesigns(prev => prev.map(d => d.id === design.id ? { ...d, title: newTitle.trim() } : d))
      toast.success('Design renamed')
    } catch {
      toast.error('Failed to rename design')
    }
  }

  async function duplicateDesign(e, design) {
    e.stopPropagation()
    setMenuOpen(null)
    try {
      const res = await api.post('/designs', {
        title: (design.title || 'Untitled') + ' (copy)',
        canvas_json: {
  ...design.canvas_json,
  isImagesToVideo: design.canvas_json?.isImagesToVideo || false,
},
      })
      setDesigns(prev => [res.data, ...prev])
      toast.success('Design duplicated')
    } catch {
      toast.error('Failed to duplicate design')
    }
  }

  const filtered = designs.filter(d =>
    !searchQ || d.title?.toLowerCase().includes(searchQ.toLowerCase())
  )

  const displayName = getDisplayName(user)

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: 'linear-gradient(135deg,#0a0614 0%,#120a22 50%,#080d14 100%)' }}>
      <style>{`
        html,body,#root{height:100%;overflow-y:auto}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes shimmerMove{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .design-card{transition:all 0.25s cubic-bezier(0.34,1.2,0.64,1)}
        .design-card:hover{transform:translateY(-5px);box-shadow:0 24px 64px rgba(124,58,237,0.22)}
        .design-card:hover .card-actions{opacity:1}
        .shimmer-dark{background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);background-size:200% 100%;animation:shimmerMove 1.5s infinite}
        .card-actions{opacity:0;transition:opacity 0.2s}
        .glow-violet{box-shadow:0 0 40px rgba(124,58,237,0.3)}
      `}</style>

      {/* ── HEADER ── */}
      <header className="border-b border-white/8 sticky top-0 z-40 backdrop-blur-2xl"
        style={{ background: 'rgba(8,6,16,0.9)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 mr-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>K</div>
            <span className="font-black text-white text-lg tracking-tight hidden sm:block">KonvaCraft</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
              <input type="text" placeholder="Search designs…" value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-white/25 outline-none border border-white/8 focus:border-violet-500/50 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
          </div>

          <div className="flex-1" />

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pr-3 border-r border-white/10">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                {getInitial(user)}
              </div>
              <div className="hidden md:block">
                <p className="text-white text-xs font-semibold leading-tight">{displayName}</p>
                <p className="text-white/30 text-[10px] leading-tight">{user?.email}</p>
              </div>
            </div>
            <button onClick={signOut}
              className="text-xs text-white/40 hover:text-white/80 hover:bg-white/8 transition-all px-3 py-1.5 rounded-lg border border-white/8">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto px-6 py-8 pb-24">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black text-white mb-0.5">My Designs</h1>
            <p className="text-white/35 text-sm">
              {loading ? 'Loading…' : `${filtered.length} design${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-white/10 p-0.5 gap-0.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {[['grid','⊞'],['list','☰']].map(([v,icon]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`w-8 h-7 rounded-lg text-sm transition-all ${view === v ? 'text-white shadow' : 'text-white/30 hover:text-white/60'}`}
                  style={view === v ? { background: 'rgba(124,58,237,0.6)' } : {}}>
                  {icon}
                </button>
              ))}
            </div>
            <button onClick={() => { setTitle(''); setShowCreate(true) }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-white text-sm transition-all hover:scale-105 shadow-lg"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}>
              <span className="text-base font-black">+</span> New Design
            </button>
          </div>
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl shimmer-dark" style={{ height: 200 }} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && !searchQ && (
          <div className="flex flex-col items-center justify-center py-24 text-center"
            style={{ animation: 'fadeInUp 0.5s ease both' }}>
            {/* Floating illustration */}
            <div className="relative mb-8" style={{ animation: 'float 4s ease-in-out infinite' }}>
              <div className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl shadow-2xl"
                style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(236,72,153,0.15))', border: '1px solid rgba(124,58,237,0.3)' }}>
                🎨
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>✨</div>
            </div>

            <h2 className="text-3xl font-black text-white mb-3">Start creating today!</h2>
            <p className="text-white/45 text-base max-w-sm mb-2 leading-relaxed">
              You don't have any designs yet. Create your first design and bring your ideas to life.
            </p>
            <p className="text-white/25 text-sm mb-8">Choose from 6 templates to get started quickly.</p>

            {/* Template quick picks */}
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => { setSelectedTemplate(i); setTitle(''); setShowCreate(true) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white border border-white/10 hover:border-violet-500/40 transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className={`w-5 h-5 rounded-md bg-gradient-to-br ${t.color} flex items-center justify-center text-xs`}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <button onClick={() => { setTitle(''); setShowCreate(true) }}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-white text-base transition-all hover:scale-105 shadow-2xl"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 12px 40px rgba(124,58,237,0.45)' }}>
              ✦ Create Your First Design
            </button>
          </div>
        )}

        {/* ── No search results ── */}
        {!loading && filtered.length === 0 && searchQ && (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-white font-bold text-lg mb-1">No designs found</p>
            <p className="text-white/40 text-sm">Try a different search term</p>
          </div>
        )}

        {/* ── Grid view ── */}
        {!loading && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((d, idx) => (
              <div key={d.id} className="design-card relative rounded-2xl border border-white/8 overflow-hidden cursor-pointer group"
                style={{ background: 'rgba(255,255,255,0.03)', animation: `fadeInUp 0.4s ease ${idx * 0.04}s both` }}
                onClick={() => {
  const canvas = d.canvas_json || {}

  const isVideo =
    canvas.isImagesToVideo === true ||
    canvas.templateType === 'images-to-video' ||
    Array.isArray(canvas.slides)

  if (isVideo) {
    navigate(`/images-to-video/${d.id}`)
  } else {
    navigate(`/editor/${d.id}`)
  }
}}
                >

                {/* Thumbnail */}
                <div className="relative overflow-hidden" style={{ paddingBottom: '62.5%' }}>
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(236,72,153,0.08))' }}>
                    {d.thumbnail_url ? (
                      <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl opacity-20">🎨</span>
                      </div>
                    )}
                  </div>

                  {/* Hover overlay */}
                  <div className="card-actions absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(7,5,15,0.75)', backdropFilter: 'blur(4px)' }}>
                    <span className="text-white font-bold text-sm px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 transition-all"
                      style={{ background: 'rgba(124,58,237,0.4)' }}>
                      Open →
                    </span>
                  </div>

                  {/* Three-dots menu */}
                  <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === d.id ? null : d.id) }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      style={{ background: 'rgba(0,0,0,0.7)' }}>
                      ⋮
                    </button>
                    {menuOpen === d.id && (
                      <div className="absolute right-0 mt-1 w-40 rounded-2xl border border-white/10 overflow-hidden shadow-2xl py-1 z-50"
                        style={{ background: 'rgba(16,10,30,0.97)', backdropFilter: 'blur(12px)' }}>
                        {[
                          { icon: '✏️', label: 'Rename', action: e => renameDesign(e, d) },
                          { icon: '📋', label: 'Duplicate', action: e => duplicateDesign(e, d) },
                          { icon: '🗑', label: 'Delete', action: e => deleteDesign(e, d.id), red: true },
                        ].map(item => (
                          <button key={item.label} onClick={item.action}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors ${item.red ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300' : 'text-white/65 hover:text-white hover:bg-white/6'}`}>
                            <span>{item.icon}</span> {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card info */}
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-xs truncate">{d.title || 'Untitled'}</p>
                    <p className="text-white/30 text-[10px] mt-0.5">{timeAgo(d.updated_at)}</p>
                  </div>
                  <div className="shrink-0 ml-2">
                    <span className="text-[9px] text-white/20 font-mono">{d.width}×{d.height}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── List view ── */}
        {!loading && filtered.length > 0 && view === 'list' && (
          <div className="space-y-2" style={{ animation: 'fadeInUp 0.3s ease both' }}>
            {filtered.map((d, idx) => (
              <div key={d.id} className="flex items-center gap-4 px-4 py-3 rounded-2xl border border-white/8 cursor-pointer hover:border-violet-500/30 transition-all group"
                style={{ background: 'rgba(255,255,255,0.03)', animation: `fadeInUp 0.3s ease ${idx * 0.03}s both` }}
                 onClick={() => {
  const canvas = d.canvas_json || {}

  const isVideo =
    canvas.isImagesToVideo === true ||
    canvas.templateType === 'images-to-video' ||
    Array.isArray(canvas.slides)

  if (isVideo) {
    navigate(`/images-to-video/${d.id}`)
  } else {
    navigate(`/editor/${d.id}`)
  }
}} >
                <div className="w-16 h-10 rounded-xl overflow-hidden shrink-0"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(236,72,153,0.1))' }}>
                  {d.thumbnail_url
                    ? <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg opacity-30">🎨</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{d.title || 'Untitled'}</p>
                  <p className="text-white/30 text-xs">{timeAgo(d.updated_at)} · {d.width}×{d.height}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={e => renameDesign(e, d)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-all">✏️</button>
                  <button onClick={e => duplicateDesign(e, d)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-all">📋</button>
                  <button onClick={e => deleteDesign(e, d.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── NEW DESIGN MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="w-full max-w-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#140a26,#0d0d1a)', animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <h2 className="text-xl font-black text-white">New Design</h2>
                <p className="text-white/35 text-xs mt-0.5">Choose a template to get started</p>
              </div>
              <button onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">✕</button>
            </div>

            {/* Templates */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => setSelectedTemplate(i)}
                    className={`relative p-3.5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] ${selectedTemplate === i ? 'border-violet-500' : 'border-white/10 hover:border-white/20'}`}
                    style={{ background: selectedTemplate === i ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)' }}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-xl mb-2.5 shadow-lg`}>
                      {t.icon}
                    </div>
                    <p className="text-white text-xs font-bold leading-tight">{t.label}</p>
                    <p className="text-white/30 text-[9px] mt-0.5 font-mono">{t.w}×{t.h}</p>
                    {selectedTemplate === i && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center text-white text-[8px] font-black">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Title input */}
            <div className="px-6 pb-5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-2">Design Name</label>
              <input type="text" placeholder={TEMPLATES[selectedTemplate].label}
                value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !creating) createDesign() }}
                className="w-full px-4 py-3 rounded-xl text-white border border-white/10 focus:border-violet-500/60 outline-none text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Create button */}
            <div className="px-6 pb-6">
              <button onClick={createDesign} disabled={creating}
                className="w-full py-3.5 rounded-2xl font-black text-white text-sm transition-all hover:scale-[1.02] disabled:opacity-60 shadow-xl"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
                {creating
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating…</span>
                  : `✦ Create ${TEMPLATES[selectedTemplate].label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
