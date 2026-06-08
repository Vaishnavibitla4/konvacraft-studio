import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import VideoTrimmer from '../VideoTrimmer'

const FONTS = [
  { family:'Inter', cat:'Sans-serif' }, { family:'Roboto', cat:'Sans-serif' },
  { family:'Open Sans', cat:'Sans-serif' }, { family:'Lato', cat:'Sans-serif' },
  { family:'Poppins', cat:'Sans-serif' }, { family:'Montserrat', cat:'Sans-serif' },
  { family:'Raleway', cat:'Sans-serif' }, { family:'Nunito', cat:'Sans-serif' },
  { family:'Ubuntu', cat:'Sans-serif' }, { family:'Comfortaa', cat:'Sans-serif' },
  { family:'Oswald', cat:'Display' }, { family:'Bebas Neue', cat:'Display' },
  { family:'Righteous', cat:'Display' }, { family:'Abril Fatface', cat:'Display' },
  { family:'Playfair Display', cat:'Serif' }, { family:'Merriweather', cat:'Serif' },
  { family:'Georgia', cat:'Serif' },
  { family:'Dancing Script', cat:'Script' }, { family:'Pacifico', cat:'Script' },
  { family:'Lobster', cat:'Script' }, { family:'Permanent Marker', cat:'Script' },
  { family:'Shadows Into Light', cat:'Script' }, { family:'Architects Daughter', cat:'Script' },
  { family:'Courier Prime', cat:'Mono' }, { family:'Source Code Pro', cat:'Mono' },
  { family:'Space Mono', cat:'Mono' }, { family:'Special Elite', cat:'Vintage' },
]

function Sec({ title, children }) {
  return (
    <div className="px-3 py-3 border-b border-white/8">
      <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-2.5">{title}</p>
      {children}
    </div>
  )
}

function Lbl({ children }) {
  return <p className="text-[10px] text-white/35 mb-1">{children}</p>
}

function NumIn({ value, onChange, min, max, step = 1 }) {
  return (
    <input type="number" value={Math.round(value ?? 0)}
      onChange={e => onChange(Number(e.target.value))}
      min={min} max={max} step={step}
      className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none transition-all"
      style={{ background:'rgba(255,255,255,0.06)' }}
      onFocus={e => e.target.style.borderColor='rgba(124,58,237,0.7)'}
      onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
    />
  )
}

function ColorIn({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/15 shrink-0 cursor-pointer"
        style={{ background: value || '#000' }}>
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ transform:'scale(2)' }} />
      </div>
      <input type="text" value={value || '#000000'} onChange={e => onChange(e.target.value)}
        className="flex-1 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-white/80 outline-none transition-all"
        style={{ background:'rgba(255,255,255,0.06)' }}
        onFocus={e => e.target.style.borderColor='rgba(124,58,237,0.7)'}
        onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
      />
    </div>
  )
}

function SliderRow({ label, value, min, max, step = 0.01, display, onChange }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-white/35">{label}</span>
        <span className="text-[10px] font-medium text-white/60">{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer accent-violet-500" />
    </div>
  )
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
      style={{ background:'rgba(20,15,40,0.9)' }}>
      {children}
    </select>
  )
}

function Check({ id, label, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer group">
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${checked ? 'border-violet-500 bg-violet-600' : 'border-white/20 group-hover:border-white/40'}`}
        onClick={() => onChange(!checked)}>
        {checked && <span className="text-white text-[8px] font-black">✓</span>}
      </div>
      <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">{label}</span>
    </label>
  )
}

function TimeInput({ value, onChange, max = 600 }) {
  return (
    <input
      type="range"
      min={0}
      max={max}
      step={0.1}
      value={value || 0}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full cursor-pointer accent-violet-500"
    />
  )
}

export default function PropertiesPanel() {
  const { shapes: _shapes, selectedId, updateShapeAndSnapshot: snap, updateShape: live } = useEditorStore()
  const store = useEditorStore()
  const shapes = store.pages[store.currentPageIndex]?.shapes ?? []
  const [showTrimmer, setShowTrimmer] = useState(false)
  const shape = shapes.find(s => s.id === selectedId)

  if (!shape) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
          style={{ background:'rgba(124,58,237,0.15)' }}>✏️</div>
        <p className="text-sm font-semibold text-white/50 mb-1">No element selected</p>
        <p className="text-xs text-white/25">Click any element on the canvas to edit its properties</p>
      </div>
    )
  }

  const u = (k, v) => snap(shape.id, { [k]: v })
  const l = (k, v) => live(shape.id, { [k]: v })

  const isVec = !['text','image','video','line','arrow'].includes(shape.type)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/8"
        style={{ background:'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(236,72,153,0.1))' }}>
        <p className="text-[10px] font-bold text-violet-300 uppercase tracking-widest capitalize">
          {shape.type === 'roundrect' ? 'Rounded Rect' : shape.type}
        </p>
      </div>

      {/* Position */}
      <Sec title="Position & Size">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><Lbl>X</Lbl><NumIn value={shape.x} onChange={v=>u('x',v)} /></div>
          <div><Lbl>Y</Lbl><NumIn value={shape.y} onChange={v=>u('y',v)} /></div>
        </div>
        {!['line','arrow'].includes(shape.type) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Lbl>Width</Lbl>
              <NumIn min={1} value={
                shape.width ?? (shape.radius ? shape.radius*2 : shape.radiusX ? shape.radiusX*2 : shape.outerRadius ? shape.outerRadius*2 : 0)
              } onChange={v => {
                if (shape.type === 'circle') u('radius', v/2)
                else if (shape.type === 'ellipse') u('radiusX', v/2)
                else if (['triangle','pentagon','hexagon','star'].includes(shape.type)) u('radius', v/2)
                else u('width', v)
              }} />
            </div>
            <div>
              <Lbl>Height</Lbl>
              <NumIn min={1} value={
                shape.height ?? (shape.radius ? shape.radius*2 : shape.radiusY ? shape.radiusY*2 : 0)
              } onChange={v => {
                if (shape.type === 'circle') u('radius', v/2)
                else if (shape.type === 'ellipse') u('radiusY', v/2)
                else u('height', v)
              }} />
            </div>
          </div>
        )}
      </Sec>

      {/* Transform */}
      <Sec title="Transform">
        <SliderRow label="Rotation" value={shape.rotation||0} min={-180} max={180} step={1}
          display={`${Math.round(shape.rotation||0)}°`} onChange={v=>l('rotation',v)} />
        <SliderRow label="Opacity" value={shape.opacity??1} min={0} max={1}
          display={`${Math.round((shape.opacity??1)*100)}%`} onChange={v=>l('opacity',v)} />
      </Sec>

      {/* Fill / stroke for shapes */}
      {!['image','video'].includes(shape.type) && (
        <Sec title="Appearance">
          {!['line','arrow'].includes(shape.type) && (
            <div className="mb-3">
              <Lbl>Fill Color</Lbl>
              <ColorIn value={shape.fill} onChange={v=>l('fill',v)} />
            </div>
          )}
          <div className="mb-2">
            <Lbl>Stroke</Lbl>
            <div className="flex gap-2 items-center mb-1">
              <div className="flex-1"><ColorIn value={shape.stroke||'#000000'} onChange={v=>l('stroke',v)} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Lbl>Width</Lbl>
              <div className="flex-1"><NumIn value={shape.strokeWidth||0} onChange={v=>u('strokeWidth',v)} min={0} max={40} /></div>
            </div>
          </div>
          {shape.type === 'roundrect' && (
            <div>
              <Lbl>Corner Radius</Lbl>
              <NumIn value={shape.cornerRadius||14} onChange={v=>u('cornerRadius',v)} min={0} max={300} />
            </div>
          )}
        </Sec>
      )}

      {/* Shadow for vector shapes */}
      {isVec && (
        <Sec title="Shadow">
          <div className="mb-2">
            <Check id="shad" label="Enable shadow" checked={!!shape.shadowEnabled}
              onChange={v=>u('shadowEnabled',v)} />
          </div>
          {shape.shadowEnabled && (
            <>
              <div className="mb-2"><Lbl>Color</Lbl><ColorIn value={shape.shadowColor||'#000000'} onChange={v=>l('shadowColor',v)} /></div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div><Lbl>X</Lbl><NumIn value={shape.shadowOffsetX||0} onChange={v=>l('shadowOffsetX',v)} /></div>
                <div><Lbl>Y</Lbl><NumIn value={shape.shadowOffsetY||0} onChange={v=>l('shadowOffsetY',v)} /></div>
                <div><Lbl>Blur</Lbl><NumIn value={shape.shadowBlur||10} onChange={v=>l('shadowBlur',v)} min={0} /></div>
              </div>
              <SliderRow label="Shadow Opacity" value={shape.shadowOpacity??0.5} min={0} max={1}
                display={`${Math.round((shape.shadowOpacity??0.5)*100)}%`} onChange={v=>l('shadowOpacity',v)} />
            </>
          )}
        </Sec>
      )}

      {/* Text */}
      {shape.type === 'text' && (
        <Sec title="Text">
          <div className="mb-2">
            <Lbl>Content</Lbl>
            <textarea value={shape.text||''} onChange={e=>l('text',e.target.value)}
              onBlur={e=>u('text',e.target.value)} rows={3}
              className="w-full border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white resize-none outline-none"
              style={{ background:'rgba(255,255,255,0.06)' }}
            />
          </div>
          <div className="mb-2">
            <Lbl>Font Family</Lbl>
            <Select value={shape.fontFamily||'Inter'} onChange={v=>u('fontFamily',v)}>
              {FONTS.map(f => (
                <option key={f.family} value={f.family}>{f.family} — {f.cat}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div><Lbl>Size</Lbl><NumIn value={shape.fontSize||24} onChange={v=>u('fontSize',v)} min={6} max={400} /></div>
            <div>
              <Lbl>Style</Lbl>
              <Select value={shape.fontStyle||'normal'} onChange={v=>u('fontStyle',v)}>
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="italic bold">Bold Italic</option>
              </Select>
            </div>
          </div>
          <div className="mb-2">
            <Lbl>Align</Lbl>
            <div className="flex gap-1">
              {['left','center','right'].map(a => (
                <button key={a} onClick={()=>u('align',a)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border-2 transition-all
                    ${shape.align===a ? 'border-violet-500 text-violet-300' : 'border-white/10 text-white/40 hover:border-white/20'}`}
                  style={shape.align===a ? {background:'rgba(124,58,237,0.2)'} : {}}>
                  {a[0].toUpperCase()+a.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2"><Lbl>Color</Lbl><ColorIn value={shape.fill} onChange={v=>l('fill',v)} /></div>
          <SliderRow label="Letter Spacing" value={shape.letterSpacing||0} min={-5} max={20} step={0.5}
            display={`${shape.letterSpacing||0}px`} onChange={v=>l('letterSpacing',v)} />
          <SliderRow label="Line Height" value={shape.lineHeight||1.2} min={0.8} max={3} step={0.05}
            display={`${shape.lineHeight||1.2}`} onChange={v=>l('lineHeight',v)} />
          <Check id="underline" label="Underline" checked={shape.textDecoration==='underline'}
            onChange={v=>u('textDecoration', v ? 'underline' : '')} />
        </Sec>
      )}

      {/* Image */}
      {shape.type === 'image' && (
        <Sec title="Image">
          <div className="mb-2"><Lbl>Border Radius</Lbl><NumIn value={shape.cornerRadius||0} onChange={v=>u('cornerRadius',v)} min={0} max={400} /></div>
          <SliderRow label="Brightness" value={shape.brightness??0} min={-1} max={1}
            display={`${Math.round((shape.brightness??0)*100)}%`} onChange={v=>l('brightness',v)} />
          <SliderRow label="Contrast" value={shape.contrast??0} min={-100} max={100} step={1}
            display={`${Math.round(shape.contrast??0)}`} onChange={v=>l('contrast',v)} />
          <SliderRow label="Blur" value={shape.blurRadius??0} min={0} max={40} step={1}
            display={`${Math.round(shape.blurRadius??0)}px`} onChange={v=>l('blurRadius',v)} />
          <Check id="gs" label="Grayscale" checked={!!shape.grayscale} onChange={v=>u('grayscale',v)} />
        </Sec>
      )}

      {/* Video */}
      {/* Video */}
{shape.type === 'video' && (
  <Sec title="Video">
    
    {/* Playback */}
    <div className="space-y-2 mb-4">
      <Check
        id="vloop"
        label="Loop"
        checked={shape.loop !== false}
        onChange={v => u('loop', v)}
      />

      <Check
        id="vmute"
        label="Muted"
        checked={shape.muted !== false}
        onChange={v => u('muted', v)}
      />
    </div>

    <SliderRow
      label="Volume"
      value={shape.volume ?? 1}
      min={0}
      max={1}
      step={0.01}
      display={`${Math.round((shape.volume ?? 1) * 100)}%`}
      onChange={v => u('volume', v)}
    />

    <SliderRow
      label="Playback Speed"
      value={shape.playbackRate ?? 1}
      min={0.25}
      max={4}
      step={0.25}
      display={`${shape.playbackRate ?? 1}×`}
      onChange={v => u('playbackRate', v)}
    />

    {/* Trim */}
    <div className="mt-4 mb-3">
      <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-widest mb-2">
        Trim
      </p>

      <div className="mb-3">
        <Lbl>
          Start Time ({(shape.trimStart || 0).toFixed(1)}s)
        </Lbl>

        <TimeInput
          value={shape.trimStart || 0}
          max={shape.duration || 600}
          onChange={v => u('trimStart', v)}
        />
      </div>

      <div>
        <Lbl>
          End Time ({(shape.trimEnd || shape.duration || 0).toFixed(1)}s)
        </Lbl>

        <TimeInput
          value={shape.trimEnd || shape.duration || 0}
          max={shape.duration || 600}
          onChange={v => u('trimEnd', v)}
        />
      </div>
    </div>

    {/* Effects */}
    <div className="mt-4">
      <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-widest mb-2">
        Effects
      </p>

      <SliderRow
        label="Brightness"
        value={shape.brightness ?? 0}
        min={-1}
        max={1}
        step={0.01}
        display={`${Math.round((shape.brightness ?? 0) * 100)}%`}
        onChange={v => l('brightness', v)}
      />

      <SliderRow
        label="Contrast"
        value={shape.contrast ?? 0}
        min={-100}
        max={100}
        step={1}
        display={`${Math.round(shape.contrast ?? 0)}`}
        onChange={v => l('contrast', v)}
      />

      <SliderRow
        label="Blur"
        value={shape.blurRadius ?? 0}
        min={0}
        max={40}
        step={1}
        display={`${Math.round(shape.blurRadius ?? 0)}px`}
        onChange={v => l('blurRadius', v)}
      />

      <SliderRow
        label="Saturation"
        value={shape.saturation ?? 0}
        min={-2}
        max={2}
        step={0.05}
        display={`${(shape.saturation ?? 0).toFixed(2)}`}
        onChange={v => l('saturation', v)}
      />

      <Check
        id="grayscale-video"
        label="Grayscale"
        checked={!!shape.grayscale}
        onChange={v => u('grayscale', v)}
      />
    </div>

    {/* Fade */}
    <div className="mt-4">
      <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-widest mb-2">
        Fade
      </p>

      <SliderRow
        label="Fade In"
        value={shape.fadeIn ?? 0}
        min={0}
        max={10}
        step={0.1}
        display={`${(shape.fadeIn ?? 0).toFixed(1)}s`}
        onChange={v => u('fadeIn', v)}
      />

      <SliderRow
        label="Fade Out"
        value={shape.fadeOut ?? 0}
        min={0}
        max={10}
        step={0.1}
        display={`${(shape.fadeOut ?? 0).toFixed(1)}s`}
        onChange={v => u('fadeOut', v)}
      />
    </div>

    {/* Keyframes */}
    <div className="mt-4">
      <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-widest mb-2">
        Animation
      </p>

      <Select
        value={shape.animationType || 'none'}
        onChange={v => u('animationType', v)}
      >
        <option value="none">None</option>
        <option value="fade">Fade</option>
        <option value="slide-left">Slide Left</option>
        <option value="slide-right">Slide Right</option>
        <option value="zoom-in">Zoom In</option>
        <option value="zoom-out">Zoom Out</option>
        <option value="rotate">Rotate</option>
        <option value="bounce">Bounce</option>
      </Select>

      <div className="mt-2">
        <Lbl>Animation Duration</Lbl>

        <NumIn
          value={shape.animationDuration || 2}
          min={0.1}
          max={30}
          step={0.1}
          onChange={v => u('animationDuration', v)}
        />
      </div>
    </div>

    {/* Styling */}
    <div className="mt-4">
      <Lbl>Corner Radius</Lbl>

      <NumIn
        value={shape.cornerRadius || 0}
        onChange={v => u('cornerRadius', v)}
        min={0}
        max={200}
      />
    </div>

    {/* Trim Video Button */}
    <button
      onClick={() => setShowTrimmer(true)}
      className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.02]"
      style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
    >
      ✂️ Trim Video
    </button>

    {/* Download */}
    <a
      href={shape.src}
      download
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white/70 border border-white/20 hover:bg-white/10 transition-all"
    >
      ⬇ Download Video File
    </a>

    {/* Video Trimmer Modal */}
    {showTrimmer && (
      <VideoTrimmer
        src={shape.src}
        duration={shape.duration}
        trimStart={shape.trimStart || 0}
        trimEnd={shape.trimEnd || shape.duration}
        onChange={({ trimStart, trimEnd }) => {
          snap(shape.id, { trimStart, trimEnd })
        }}
        onClose={() => setShowTrimmer(false)}
      />
    )}
  </Sec>
)}

      {/* Line / Arrow */}
      {(shape.type==='line'||shape.type==='arrow') && (
        <Sec title="Line">
          <div className="mb-2"><Lbl>Color</Lbl><ColorIn value={shape.stroke} onChange={v=>l('stroke',v)} /></div>
          <div className="mb-2"><Lbl>Stroke Width</Lbl><NumIn value={shape.strokeWidth||2} onChange={v=>u('strokeWidth',v)} min={1} max={40} /></div>
          {shape.type==='arrow' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><Lbl>Ptr Length</Lbl><NumIn value={shape.pointerLength||15} onChange={v=>u('pointerLength',v)} min={5} max={60} /></div>
              <div><Lbl>Ptr Width</Lbl><NumIn value={shape.pointerWidth||12} onChange={v=>u('pointerWidth',v)} min={5} max={60} /></div>
            </div>
          )}
          <div><Lbl>Style</Lbl>
            <Select value={JSON.stringify(shape.dash||[])} onChange={v=>u('dash',JSON.parse(v))}>
              <option value="[]">Solid</option>
              <option value="[8,4]">Dashed</option>
              <option value="[2,4]">Dotted</option>
              <option value="[16,4,4,4]">Dash-Dot</option>
            </Select>
          </div>
        </Sec>
      )}
    </div>
  )
}
