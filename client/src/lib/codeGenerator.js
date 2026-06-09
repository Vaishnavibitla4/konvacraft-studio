// client/src/lib/codeGenerator.js
import api from './api'

export async function generateCode({ taggedDesign, framework, cssMethod, agentPrompt }) {
  const res = await api.post('/codegen/generate', {
    taggedDesign,
    framework,
    cssMethod,
    prompt: agentPrompt || '',
  })
  return res.data.code
}

export const FRAMEWORKS = [
  { id: 'react',  label: 'React',   ext: '.jsx' },
  { id: 'nextjs', label: 'Next.js', ext: '.tsx' },
  { id: 'vue',    label: 'Vue 3',   ext: '.vue' },
  { id: 'html',   label: 'HTML',    ext: '.html' },
]

export const CSS_METHODS = [
  { id: 'tailwind',   label: 'Tailwind CSS' },
  { id: 'cssmodules', label: 'CSS Modules' },
  { id: 'inline',     label: 'Inline Styles' },
  { id: 'plain',      label: 'Plain CSS' },
]