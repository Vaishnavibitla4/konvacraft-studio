// server/src/routes/codegen.js
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// Free model to use — switch anytime, all are $0 on OpenRouter free tier
 
// Other good free options:
// 'mistralai/mistral-7b-instruct:free'
// 'google/gemma-2-9b-it:free'
// 'qwen/qwen-2-7b-instruct:free'

// Try these models in order — if one is rate-limited, auto-falls to the next
const FREE_MODELS = ['openrouter/free']

async function callOpenRouter(prompt, maxTokens = 4000) {
  let lastError = null

  for (const model of FREE_MODELS) {
    console.log('[OpenRouter] trying model:', model)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'http://localhost:5173',
        'X-Title':       'KonvaCraft Studio',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    console.log('[OpenRouter] response status:', response.status, 'model:', model)

    // Rate limited or unavailable — try next model
    if (response.status === 429 || response.status === 404) {
      const err = await response.text()
      console.warn(`[OpenRouter] ${response.status} on ${model}, trying next...`)
      lastError = `${response.status} on ${model}: ${err}`
      continue
    }

    if (!response.ok) {
      const err = await response.text()
      console.error('[OpenRouter] fatal error:', err)
      throw new Error(`OpenRouter error ${response.status}: ${err}`)
    }

    const data = await response.json()
    console.log('[OpenRouter] success with model:', model)
    return data.choices?.[0]?.message?.content || ''
  }

  // All models failed
  throw new Error(`All free models rate-limited. Last error: ${lastError}`)
}

// ── POST /api/codegen/tag ─────────────────────────────────────────────────
// Stage 2: AI analyzes the serialized design and tags each node
router.post('/tag', async (req, res) => {
  console.log('[/tag] hit, body keys:', Object.keys(req.body))
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt required' })

  try {
    const text = await callOpenRouter(prompt, 8000)
    console.log('[/tag] raw response preview:', text.slice(0, 200))

    // Robustly extract JSON — handles markdown fences, leading text, trailing text
    const extracted = extractJSON(text)

    if (!extracted) {
      console.error('[/tag] could not extract JSON from:', text.slice(0, 500))
      return res.status(422).json({
        error: 'Model did not return valid JSON. Try again.',
        rawText: text.slice(0, 300),
      })
    }

    // After extractJSON succeeds, wrap array responses into the expected shape
let parsed = JSON.parse(extracted)
console.log('[/tag] full raw response:', text)

// If model returned a flat array of nodes instead of { pages: [...] }
if (Array.isArray(parsed)) {
  console.log('[/tag] model returned array, wrapping into pages structure')
  parsed = {
    canvasWidth:  req.body.designJson?.canvasWidth  || 1200,
    canvasHeight: req.body.designJson?.canvasHeight || 800,
    pages: [{
      id:    req.body.designJson?.pages?.[0]?.id    || 'page-1',
      label: req.body.designJson?.pages?.[0]?.label || 'Page 1',
      nodes: parsed,
    }]
  }
}

return res.json({ content: [{ text: JSON.stringify(parsed) }] })
  } catch (err) {
    console.error('[codegen/tag]', err)
    return res.status(500).json({ error: err.message || 'AI request failed' })
  }
})

// Extracts the first valid JSON object or array from a string
// Handles: ```json ... ```, plain JSON, JSON buried in prose
function extractJSON(text) {
  if (!text) return null

  // 1. Strip markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim()

  // 2. Find the start of the JSON object or array
  const firstBrace   = raw.indexOf('{')
  const firstBracket = raw.indexOf('[')
  let start = -1
  let isArray = false

  if (firstBrace === -1 && firstBracket === -1) return null

  if (firstBrace === -1) { start = firstBracket; isArray = true }
  else if (firstBracket === -1) { start = firstBrace }
  else if (firstBracket < firstBrace) { start = firstBracket; isArray = true }
  else { start = firstBrace }

  const slice = raw.slice(start)
  const openChar  = isArray ? '[' : '{'
  const closeChar = isArray ? ']' : '}'

  // 3. Try parsing as-is first
  try { JSON.parse(slice); return slice } catch {}

  // 4. JSON is truncated — repair by counting open braces/brackets
  // and appending the right number of closing chars
  console.log('[extractJSON] JSON appears truncated, attempting repair...')

  let repaired = slice
  let depth = 0
  let inString = false
  let escape = false

  for (const ch of repaired) {
    if (escape)          { escape = false; continue }
    if (ch === '\\')     { escape = true;  continue }
    if (ch === '"')      { inString = !inString; continue }
    if (inString)        continue
    if (ch === '{' || ch === '[') depth++
    if (ch === '}' || ch === ']') depth--
  }

  // Close any open string first
  if (inString) repaired += '"'

  // Close any trailing incomplete property (e.g. "key": <missing value>)
  const trimmed = repaired.trimEnd()
  if (trimmed.endsWith(':') || trimmed.endsWith(',')) {
    repaired = trimmed.slice(0, -1)
  }

  // Append missing closing braces/brackets
  while (depth > 0) {
    // Determine which char to close based on nesting context
    // Simple heuristic: close with } unless we opened with [
    repaired += depth === 1 && isArray ? closeChar : '}'
    depth--
  }
  if (isArray && depth === 0) repaired += ']'

  try { JSON.parse(repaired); console.log('[extractJSON] repair succeeded'); return repaired }
  catch (e) { console.error('[extractJSON] repair failed:', e.message); return null }
}

// ── POST /api/codegen/generate ────────────────────────────────────────────
// Stage 3: Generate framework-specific code from the tagged design AST
router.post('/generate', async (req, res) => {
  const { taggedDesign, framework, cssMethod, prompt: userPrompt } = req.body
  if (!taggedDesign) return res.status(400).json({ error: 'taggedDesign required' })

  const prompt = buildCodeGenPrompt(taggedDesign, framework, cssMethod, userPrompt)

  try {
    const code = await callOpenRouter(prompt, 6000)
    return res.json({ code })
  } catch (err) {
    console.error('[codegen/generate]', err)
    return res.status(500).json({ error: err.message || 'Code generation failed' })
  }
})

function buildCodeGenPrompt(taggedDesign, framework, cssMethod, extraInstructions) {
  const page  = taggedDesign.pages?.[0]
  const nodes = page?.nodes || []

  const frameworkInstructions = {
    react:  'Output React functional components using JSX. Use useState for interactive state.',
    nextjs: 'Output Next.js page components. Add "use client" if interactive.',
    vue:    'Output Vue 3 Single File Components with <template>, <script setup>, and <style>.',
    html:   'Output plain HTML5 with a <style> block. No frameworks.',
  }

  const cssInstructions = {
    tailwind:   'Use Tailwind CSS utility classes only. No custom CSS.',
    cssmodules: 'Use CSS Modules. Export a .module.css alongside the component.',
    inline:     'Use inline styles (style={{...}}) only.',
    plain:      'Use a plain <style> block with BEM class names.',
  }

  return `You are a senior frontend developer. Convert this tagged canvas design to clean ${framework} code.

Framework: ${frameworkInstructions[framework] || frameworkInstructions.react}
CSS: ${cssInstructions[cssMethod] || cssInstructions.tailwind}
Canvas: ${taggedDesign.canvasWidth}x${taggedDesign.canvasHeight}px
${extraInstructions ? `Extra instructions: ${extraInstructions}` : ''}

Rules:
1. Nodes with "isComponent: true" become their own exported components
2. Use each node's "htmlTag" as the element
3. Convert x/y/width/height to CSS (prefer flexbox over absolute positioning)
4. Convert fill to background-color or color for text
5. Use "componentName" as the React/Vue component name
6. Accept the listed "props" as component props
7. Add hover states to buttons and links
8. Stack columns below 768px for responsiveness

Nodes to convert:
${JSON.stringify(nodes, null, 2)}

Output clean, readable, production-quality code only. No explanations before or after.`
}

export default router