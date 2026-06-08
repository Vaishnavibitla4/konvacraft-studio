import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'

export default function PagePanel({ stageRef }) {
  const store = useEditorStore()
  const { pages, currentPageIndex, canvasSize } = store
  const [renamingIndex, setRenamingIndex] = useState(null)
  const [renameValue, setRenameValue]     = useState('')
  const [dragIndex, setDragIndex]         = useState(null)
  const [dragOver, setDragOver]           = useState(null)
  const renameRef = useRef()

  function startRename(i, label) {
    setRenamingIndex(i)
    setRenameValue(label)
    setTimeout(() => renameRef.current?.focus(), 50)
  }

  function commitRename(i) {
    if (renameValue.trim()) store.renamePage(i, renameValue.trim())
    setRenamingIndex(null)
  }

  const aspect = canvasSize?.height && canvasSize?.width
    ? (canvasSize.height / canvasSize.width) * 100
    : 56.25

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 148,
        background: 'rgba(10,8,20,0.99)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Pages</span>
        <button
          onClick={() => store.addPage()}
          title="Add page"
          className="w-5 h-5 rounded-md text-sm font-bold text-violet-400 hover:text-white hover:bg-violet-600 transition-all flex items-center justify-center"
        >+</button>
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
        {pages.map((page, i) => (
          <div
            key={page.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => { e.preventDefault(); setDragOver(i) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) store.movePage(dragIndex, i)
              setDragIndex(null); setDragOver(null)
            }}
            onClick={() => store.setCurrentPage(i)}
            className="relative rounded-xl overflow-visible cursor-pointer transition-all border-2 group"
            style={{
              borderColor: currentPageIndex === i
                ? '#7c3aed'
                : dragOver === i
                  ? 'rgba(124,58,237,0.4)'
                  : 'rgba(255,255,255,0.08)',
              boxShadow: currentPageIndex === i
                ? '0 0 0 2px rgba(124,58,237,0.25)'
                : 'none',
            }}
          >
            {/* Thumbnail */}
            <div className="relative rounded-lg overflow-hidden bg-white"
              style={{ paddingBottom: `${aspect}%` }}>
              <div className="absolute inset-0 flex items-center justify-center">
                {currentPageIndex === i ? (
                  <span className="text-gray-300 text-[9px] font-medium">Current page</span>
                ) : (
                  <span className="text-gray-300 text-[9px]">Page {i + 1}</span>
                )}
              </div>
            </div>

            {/* Page number badge */}
            <div
              className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full text-white text-[9px] font-black flex items-center justify-center shadow-lg z-10"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            >
              {i + 1}
            </div>

            {/* ⋮ menu — always in top-right */}
            <div className="absolute top-1.5 right-1.5 z-20"
              onClick={e => e.stopPropagation()}>
              <PageMenu
                canDelete={pages.length > 1}
                onRename={() => startRename(i, page.label)}
                onDuplicate={() => store.duplicatePage(i)}
                onDelete={() => store.deletePage(i)}
              />
            </div>

            {/* Label */}
            <div className="px-1.5 py-1 rounded-b-xl"
              style={{ background: 'rgba(15,12,28,0.97)' }}>
              {renamingIndex === i ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(i)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  commitRename(i)
                    if (e.key === 'Escape') setRenamingIndex(null)
                  }}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-[9px] text-white bg-transparent border-b border-violet-500 outline-none"
                />
              ) : (
                <p className="text-[9px] text-white/50 truncate">{page.label}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer add button */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={() => store.addPage()}
          className="w-full py-1.5 rounded-xl text-[10px] font-bold text-violet-400 border border-violet-500/30 hover:bg-violet-950/50 transition-all"
        >
          + Add Page
        </button>
      </div>
    </div>
  )
}

/* ── Dropdown menu ─────────────────────────────────────────────────────────── */
function PageMenu({ onRename, onDuplicate, onDelete, canDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        title="Page options"
      >
        ⋮
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-6 z-[999] rounded-2xl overflow-hidden shadow-2xl py-1.5"
          style={{
            width: 148,
            background: 'rgba(18,12,32,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            animation: 'menuPop 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
          onClick={e => e.stopPropagation()}
        >
          <style>{`@keyframes menuPop{from{opacity:0;transform:scale(0.9) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

          <MenuItem
            icon="✏️"
            label="Rename"
            onClick={() => { onRename(); setOpen(false) }}
          />
          <MenuItem
            icon="📋"
            label="Duplicate"
            onClick={() => { onDuplicate(); setOpen(false) }}
          />

          {/* Divider */}
          <div className="my-1 mx-3 border-t border-white/8" />

          {/* Delete — always visible, disabled when only 1 page */}
          <button
            onClick={() => { if (canDelete) { onDelete(); setOpen(false) } }}
            disabled={!canDelete}
            title={canDelete ? 'Delete this page' : 'Cannot delete the only page'}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
              canDelete
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer'
                : 'text-white/20 cursor-not-allowed'
            }`}
          >
            <span className="text-sm">🗑</span>
            <span>Delete Page</span>
          </button>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/6 transition-colors cursor-pointer"
    >
      <span className="text-sm">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
