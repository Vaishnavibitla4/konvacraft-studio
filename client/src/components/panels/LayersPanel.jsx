import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'

const TYPE_ICONS = {
  rect:'▭',
  roundrect:'▢',
  circle:'●',
  ellipse:'⬭',
  triangle:'▲',
  pentagon:'⬠',
  hexagon:'⬡',
  star:'★',
  arrow:'→',
  line:'╱',
  text:'T',
  image:'🖼',
  video:'🎬',
}

export default function LayersPanel() {

  const store = useEditorStore()
  const {
    selectedId,
    setSelected,
    moveShapeUp,
    moveShapeDown,
    deleteShape,
    updateShape,
  } = store
  const shapes = store.pages[store.currentPageIndex]?.shapes ?? []

  const [hov, setHov] =
    useState(null)

  const safeShapes =
    Array.isArray(shapes)
      ? shapes
      : []

  const reversed =
    [...safeShapes].reverse()

  return (
    <div
      className="w-44 flex flex-col h-full"
      style={{
        background:
          'rgba(12,10,25,0.99)',

        borderRight:
          '1px solid rgba(255,255,255,0.07)',
      }}
    >

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/8 flex items-center gap-2">

        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex-1">
          Layers
        </span>

        <span className="text-[10px] text-white/20 bg-white/8 rounded-full px-1.5 py-0.5">
          {safeShapes.length}
        </span>

      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">

        {reversed.map(shape => {

          const isSel =
            selectedId === shape.id

          const isHov =
            hov === shape.id

          const isHid =
            shape.visible === false

          return (
            <div
              key={shape.id}

              onClick={() =>
                setSelected(shape.id)
              }

              onMouseEnter={() =>
                setHov(shape.id)
              }

              onMouseLeave={() =>
                setHov(null)
              }

              className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border-b text-xs transition-all border-l-2
                ${isSel
                  ? 'border-l-violet-500 border-b-white/8'
                  : 'border-l-transparent border-b-white/5 hover:border-b-white/10'}`}
            >

              {/* Visibility */}
              <button
                onClick={e => {

                  e.stopPropagation()

                  updateShape(shape.id, {
                    visible: isHid,
                  })
                }}

                className={`shrink-0 w-4 h-4 flex items-center justify-center rounded text-[10px] transition-all
                  ${isHid
                    ? 'text-white/15'
                    : 'text-white/30 hover:text-white/60'}`}
              >
                {isHid ? '○' : '●'}
              </button>

              {/* Icon */}
              <span
                className={`text-sm shrink-0 ${
                  isSel
                    ? 'text-violet-400'
                    : 'text-white/30'
                }`}
              >
                {TYPE_ICONS[shape.type] || '◻'}
              </span>

              {/* Name */}
              <span
                className={`flex-1 truncate font-medium ${
                  isSel
                    ? 'text-white/90'
                    : 'text-white/50'
                } ${isHid ? 'opacity-30' : ''}`}
              >
                {shape.type === 'text'
                  ? (
                      shape.text?.slice(
                        0,
                        8
                      ) || 'Text'
                    )
                  : shape.type ===
                    'roundrect'
                  ? 'Rounded'
                  : shape.type}
              </span>

              {(isSel || isHov) && (

                <div className="flex items-center gap-0.5 shrink-0">

                  <button
                    onClick={e => {

                      e.stopPropagation()

                      moveShapeUp(shape.id)
                    }}

                    className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 text-[10px]"
                  >
                    ↑
                  </button>

                  <button
                    onClick={e => {

                      e.stopPropagation()

                      moveShapeDown(shape.id)
                    }}

                    className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 text-[10px]"
                  >
                    ↓
                  </button>

                  <button
                    onClick={e => {

                      e.stopPropagation()

                      deleteShape(shape.id)
                    }}

                    className="w-4 h-4 rounded hover:bg-red-950/60 flex items-center justify-center text-red-400/60 hover:text-red-400 text-[10px]"
                  >
                    ✕
                  </button>

                </div>
              )}
            </div>
          )
        })}

        {safeShapes.length === 0 && (

          <div className="flex flex-col items-center justify-center py-10 px-3 text-center">

            <span className="text-2xl mb-2 opacity-30">
              🗂
            </span>

            <p className="text-[10px] text-white/20">
              Add elements to see layers
            </p>

          </div>
        )}
      </div>
    </div>
  )
}