// client/src/lib/designTagger.js
// Sends the serialized design to Claude and gets back tagged nodes

export async function tagDesign(serializedDesign) {
  const prompt = buildTaggingPrompt(serializedDesign)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const rawText = data.content?.map(b => b.text || '').join('')

  // Strip any markdown code fences Claude might add
  const cleaned = rawText.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('Failed to parse AI tagging response:', rawText)
    throw new Error('AI returned invalid JSON. Try again.')
  }
}

function buildTaggingPrompt(design) {
  return `You are a design-to-code AI. Analyze this canvas design and return a tagged version of the nodes array.

Canvas size: ${design.canvasWidth}x${design.canvasHeight}px

For each node, add these fields:
- "htmlTag": the correct semantic HTML element. Choose from:
    "button", "a", "input", "img", "video", "nav", "header", "footer",
    "section", "article", "main", "div", "h1", "h2", "h3", "h4", "p", "span", "ul", "li", "form", "label"
- "layoutType": how children should be laid out (only for container elements):
    "flex-row", "flex-col", "grid", "absolute", "none"
- "isComponent": true if this element is clearly a reusable UI component (button, card, navbar, etc.)
- "componentName": PascalCase name if isComponent is true (e.g. "PrimaryButton", "NavBar", "HeroCard")
- "props": array of prop names this component could accept (e.g. ["label", "onClick", "variant"])
- "responsive": object with hints — e.g. { "mobile": "stack", "breakpoint": 768 }
- "action": null, or { "type": "navigate" | "submit" | "toggle" | "open-modal", "description": "..." }
- "cssClass": a short kebab-case CSS class name for this element (e.g. "hero-button", "nav-link")

Rules:
- Text nodes with large fontSize (>24) are likely headings (h1-h3)
- Text nodes with small fontSize (<16) are likely labels or captions (span, p)  
- Rect/roundrect shapes behind text are likely card containers or buttons
- Images near the top of the canvas spanning full width are likely hero images
- Rows of similar shapes are likely list items or nav items
- Never assign htmlTag "div" if a more semantic tag clearly fits

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "canvasWidth": ${design.canvasWidth},
  "canvasHeight": ${design.canvasHeight},
  "pages": [
    {
      "id": "...",
      "label": "...",
      "nodes": [
        {
          ... (all original node fields) ...,
          "htmlTag": "...",
          "layoutType": "...",
          "isComponent": false,
          "componentName": null,
          "props": [],
          "responsive": {},
          "action": null,
          "cssClass": "..."
        }
      ]
    }
  ]
}

Design JSON to analyze:
${JSON.stringify(design, null, 2)}`
}