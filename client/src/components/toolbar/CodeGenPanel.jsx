// client/src/components/toolbar/CodeGenPanel.jsx
import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { serializeDesign } from '../../lib/designSerializer'
import { generateCode, FRAMEWORKS, CSS_METHODS } from '../../lib/codeGenerator'
import api from '../../lib/api'

// Syntax-highlight helper (basic, no external dep)
function highlight(code) {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\/.*)/g, '<span style="color:#6ee7b7">$1</span>')
    .replace(/(".*?")/g, '<span style="color:#fcd34d">$1</span>')
    .replace(/\b(import|export|const|let|function|return|default|from|if|else)\b/g,
      '<span style="color:#c4b5fd">$1</span>')
    .replace(/\b(useState|useEffect|useRef)\b/g,
      '<span style="color:#93c5fd">$1</span>')
}

export default function CodeGenPanel({ designId, designTitle, onClose }) {
  const store        = useEditorStore()
  const dialogRef    = useRef()

  // Config state
  const [framework,   setFramework]  = useState('react')
  const [cssMethod,   setCssMethod]  = useState('tailwind')
  const [agentPrompt, setAgentPrompt] = useState('')

  // Pipeline state
  const [step, setStep] = useState('idle')
  // idle → serializing → tagging → generating → done → error

  const [taggedDesign,    setTaggedDesign]    = useState(null)
  const [generatedCode,   setGeneratedCode]   = useState('')
  const [decisions,       setDecisions]       = useState([])
  const [activeTab,       setActiveTab]       = useState('config')
  // config | decisions | code | preview
  const [copied,          setCopied]          = useState(false)
  const [error,           setError]           = useState('')

  // Close on outside click
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

  // ── STAGE 1 + 2 + 3 orchestration ─────────────────────────────
  async function runPipeline() {
    setError('')
    setGeneratedCode('')
    setTaggedDesign(null)
    setDecisions([])

    try {
      // Stage 1: Serialize
      setStep('serializing')
      const { pages, canvasSize, currentPageIndex } = store
      const designJson = serializeDesign(pages, canvasSize, currentPageIndex)

        // Add above the setStep('tagging') call
const currentPage = store.pages[store.currentPageIndex]
if (currentPage?.shapes?.length > 40) {
  setError('Design has too many elements for the free model. Try selecting a single page with fewer than 40 shapes.')
  setStep('error')
  return
}

      // Stage 2: AI Tag via server proxy
      setStep('tagging')
      const tagRes = await api.post('/codegen/tag', {
        prompt: buildTagPrompt(designJson),
        designJson,
      })

      const rawText = tagRes.data?.content?.map(b => b.text || '').join('') || ''
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      let tagged
      try { tagged = JSON.parse(cleaned)
        // After: let tagged = JSON.parse(cleaned)
// Add this validation:
if (!tagged.pages || !Array.isArray(tagged.pages)) {
  throw new Error('Unexpected AI response shape. Please try again.')
}
       }
      catch { throw new Error('AI returned invalid JSON during tagging step.') }

      setTaggedDesign(tagged)

      // Extract decisions for review panel
      const allNodes = tagged.pages?.flatMap(p => p.nodes) || []
      setDecisions(allNodes.map(n => ({
        id:            n.id,
        name:          n.componentName || n.cssClass || n.rawType,
        htmlTag:       n.htmlTag,
        isComponent:   n.isComponent,
        componentName: n.componentName,
        props:         n.props || [],
        action:        n.action,
        responsive:    n.responsive,
      })))

      setActiveTab('decisions')
      setStep('tagged')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Pipeline failed.')
      setStep('error')
    }
  }

  async function runCodeGen(overrideDecisions) {
    if (!taggedDesign) return
    setStep('generating')
    setError('')

    try {
      // Apply any user overrides back onto the tagged design
      const finalDesign = applyOverrides(taggedDesign, overrideDecisions || decisions)

      // Stage 3: Generate code
      const code = await generateCode({ taggedDesign: finalDesign, framework, cssMethod, agentPrompt })
      setGeneratedCode(code)
      setActiveTab('code')
      setStep('done')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Code generation failed.')
      setStep('error')
    }
  }

  function applyOverrides(design, decisionsList) {
    return {
      ...design,
      pages: design.pages.map(page => ({
        ...page,
        nodes: page.nodes.map(node => {
          const override = decisionsList.find(d => d.id === node.id)
          if (!override) return node
          return {
            ...node,
            htmlTag:       override.htmlTag,
            isComponent:   override.isComponent,
            componentName: override.componentName,
            props:         override.props,
          }
        }),
      })),
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  function handleDownload() {
    const fw = FRAMEWORKS.find(f => f.id === framework)
    const ext = fw?.ext || '.jsx'
    const filename = (designTitle || 'design').replace(/\s+/g, '-').toLowerCase() + ext
    const blob = new Blob([generatedCode], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const isRunning = ['serializing', 'tagging', 'generating'].includes(step)

  const STEP_LABELS = {
    idle:        '',
    serializing: 'Reading canvas…',
    tagging:     'AI analyzing design…',
    tagged:      'Design analyzed',
    generating:  'Generating code…',
    done:        'Code ready',
    error:       'Error',
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div
      ref={dialogRef}
      className="absolute right-0 top-14 z-50"
      style={{ width: 520 }}
    >
      <div className="rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#0f172a', border: '1px solid rgba(124,58,237,0.3)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
              {'</>'}
            </div>
            <div>
              <p className="text-sm font-bold text-white">Export Code</p>
              <p className="text-xs text-white/40 mt-0.5 truncate" style={{ maxWidth: 260 }}>
                {step === 'idle' ? 'AI-powered design to code' : STEP_LABELS[step]}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/70 transition-all">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1">
          {[
            { id: 'config',    label: '⚙ Config' },
            { id: 'decisions', label: '🤖 AI Decisions', disabled: !taggedDesign },
            { id: 'code',      label: '</> Code',         disabled: !generatedCode },
          ].map(tab => (
            <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${activeTab === tab.id
                  ? 'bg-violet-600 text-white'
                  : tab.disabled
                    ? 'text-white/20 cursor-not-allowed'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 pt-4 space-y-4">

          {/* ── CONFIG TAB ──────────────────────────────────────── */}
          {activeTab === 'config' && (
            <>
              {/* Framework picker */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Framework
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {FRAMEWORKS.map(fw => (
                    <button key={fw.id} onClick={() => setFramework(fw.id)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all
                        ${framework === fw.id
                          ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                          : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
                        }`}>
                      {fw.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CSS method picker */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  CSS Method
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CSS_METHODS.map(css => (
                    <button key={css.id} onClick={() => setCssMethod(css.id)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all
                        ${cssMethod === css.id
                          ? 'border-pink-500 bg-pink-600/15 text-pink-300'
                          : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
                        }`}>
                      {css.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent prompt */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Agent Instructions (optional)
                </p>
                <textarea
                  value={agentPrompt}
                  onChange={e => setAgentPrompt(e.target.value)}
                  placeholder='e.g. "Make all buttons use rounded-full", "Add dark mode support", "Use TypeScript"'
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-xs text-white/80 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {error && (
                <div className="rounded-xl px-3 py-2 text-xs text-red-300"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ⚠ {error}
                </div>
              )}

              <button onClick={runPipeline} disabled={isRunning}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                {isRunning
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {STEP_LABELS[step]}</>
                  : '✦ Analyze Design with AI'
                }
              </button>
            </>
          )}

          {/* ── DECISIONS TAB ───────────────────────────────────── */}
          {activeTab === 'decisions' && taggedDesign && (
            <>
              <p className="text-xs text-white/40 mb-3">
                Review what the AI inferred. Edit any field before generating code.
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {decisions.map((d, i) => (
  <DecisionRow key={d.id || `decision-${i}`} decision={d}
                    onChange={updated => setDecisions(prev =>
                      prev.map((x, j) => j === i ? updated : x)
                    )} />
                ))}
              </div>

              {error && (
                <div className="rounded-xl px-3 py-2 text-xs text-red-300"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ⚠ {error}
                </div>
              )}

              <button onClick={() => runCodeGen(decisions)} disabled={isRunning}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                {isRunning
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating…</>
                  : `</> Generate ${FRAMEWORKS.find(f => f.id === framework)?.label} Code`
                }
              </button>
            </>
          )}

          {/* ── CODE TAB ────────────────────────────────────────── */}
          {activeTab === 'code' && generatedCode && (
            <>
              <div className="relative rounded-xl overflow-hidden"
                style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.07)', maxHeight: 340 }}>
                <div className="overflow-auto" style={{ maxHeight: 340 }}>
                  <pre className="text-[11px] font-mono p-4 leading-relaxed text-white/80"
                    dangerouslySetInnerHTML={{ __html: highlight(generatedCode) }} />
                </div>
                <button onClick={handleCopy}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: copied ? '#059669' : 'rgba(255,255,255,0.08)',
                    color: copied ? '#fff' : '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {copied ? '✓ Copied!' : '⎘ Copy'}
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={handleDownload}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/70 border border-white/10 hover:border-white/30 hover:text-white transition-all">
                  ⬇ Download File
                </button>
                <button onClick={() => { setActiveTab('config'); setStep('idle') }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/70 border border-white/10 hover:border-white/30 hover:text-white transition-all">
                  ↺ Start Over
                </button>
              </div>

              {/* Agent refinement */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Refine with Agent
                </p>
                <div className="flex gap-2">
                  <input
                    value={agentPrompt}
                    onChange={e => setAgentPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && agentPrompt.trim()) runCodeGen() }}
                    placeholder='e.g. "Add TypeScript types" or "Use semantic HTML"'
                    className="flex-1 h-9 px-3 rounded-xl text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button onClick={() => runCodeGen()} disabled={isRunning || !agentPrompt.trim()}
                    className="px-3 h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all"
                    style={{ background: 'rgba(124,58,237,0.5)', border: '1px solid rgba(124,58,237,0.4)' }}>
                    {isRunning ? '…' : '✦'}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// Single decision row with inline editing
function DecisionRow({ decision, onChange }) {
  const HTML_TAGS = [
    'div','section','article','main','header','footer','nav',
    'button','a','input','form','label',
    'h1','h2','h3','h4','p','span','ul','li',
    'img','video',
  ]

  return (
    <div className="rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-white/70 truncate" style={{ maxWidth: 160 }}>
          {decision.name || decision.id.slice(0, 10)}
        </span>
        {/* isComponent toggle */}
        <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
          <input type="checkbox" checked={decision.isComponent}
            onChange={e => onChange({ ...decision, isComponent: e.target.checked })}
            className="accent-violet-500 w-3 h-3" />
          Component
        </label>
      </div>

      <div className="flex gap-2">
        {/* HTML tag */}
        <div className="flex-1">
          <label className="block text-[9px] text-white/30 mb-0.5">HTML tag</label>
          <select value={decision.htmlTag}
            onChange={e => onChange({ ...decision, htmlTag: e.target.value })}
            className="w-full h-7 px-2 rounded-lg text-xs text-white/70 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {HTML_TAGS.map(t => <option key={t} value={t}>{`<${t}>`}</option>)}
          </select>
        </div>

        {/* Component name (when isComponent) */}
        {decision.isComponent && (
          <div className="flex-1">
            <label className="block text-[9px] text-white/30 mb-0.5">Component name</label>
            <input value={decision.componentName || ''}
              onChange={e => onChange({ ...decision, componentName: e.target.value })}
              placeholder="MyComponent"
              className="w-full h-7 px-2 rounded-lg text-xs text-white/70 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        )}
      </div>

      {/* Props (when isComponent) */}
      {decision.isComponent && decision.props?.length > 0 && (
        <p className="text-[9px] text-white/30 mt-1.5">
          Props: {decision.props.join(', ')}
        </p>
      )}

      {/* Action */}
      {decision.action && (
        <p className="text-[9px] text-violet-400/70 mt-1">
          Action: {decision.action.type} — {decision.action.description}
        </p>
      )}
    </div>
  )
}

function buildTagPrompt(designJson) {
  return `You are a design-to-code AI. Analyze this canvas design and return a tagged version.

Canvas size: ${designJson.canvasWidth}x${designJson.canvasHeight}px

For each node add:
- "htmlTag": semantic HTML element (button, h1, p, img, section, nav, div, etc.)
- "layoutType": "flex-row" | "flex-col" | "grid" | "absolute" | "none"
- "isComponent": true if clearly reusable UI component
- "componentName": PascalCase name if isComponent
- "props": array of prop names
- "responsive": { "mobile": "stack" | "hide" | "shrink", "breakpoint": 768 }
- "action": null or { "type": "navigate"|"submit"|"toggle", "description": "..." }
- "cssClass": kebab-case class name

Heuristics:
- Large text (fontSize > 24) = h1-h3
- Small text (< 14) = span or caption
- Rect behind text = div/card/button container
- Row of similar elements = nav items or list
- Full-width element at top = header/hero

Return ONLY valid JSON matching the input structure with added fields. No markdown, no explanation.

Design:
${JSON.stringify(designJson, null, 2)}`
}