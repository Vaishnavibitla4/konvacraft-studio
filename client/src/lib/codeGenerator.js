import api from "./api"

export async function generateCode({
  taggedDesign,
  framework,
  cssMethod,
  agentPrompt,
}) {
  const res = await api.post("/codegen/generate", {
    taggedDesign,
    framework,
    cssMethod,
    prompt: agentPrompt || "",
  })
  return res.data.code
}

export const FRAMEWORKS = [
  { id: "react", label: "React", ext: ".jsx" },
  { id: "nextjs", label: "Next.js", ext: ".tsx" },
  { id: "vue", label: "Vue 3", ext: ".vue" },
  { id: "html", label: "HTML", ext: ".html" },
]

export const CSS_METHODS = [
  { id: "tailwind", label: "Tailwind CSS" },

  { id: "cssmodules", label: "CSS Modules" },

  { id: "inline", label: "Inline Styles" },

  { id: "plain", label: "Plain CSS" },
]

export function generateFromDesign(pages, currentPageIndex, options = {}) {
  const { framework = "react", cssMethod = "tailwind" } = options
  const page = pages[currentPageIndex]
  if (!page) return "// No page found"

  const shapes = page.shapes || []

  if (framework === "react") return generateReact(shapes, cssMethod)
  if (framework === "vue") return generateVue(shapes, cssMethod)
  if (framework === "html") return generateHTML(shapes, cssMethod)
  return generateReact(shapes, cssMethod)
}

function shapeToElement(shape, framework) {
  const tag = inferTag(shape)
  const styles = shapeToCSS(shape)
  const inner = shape.type === "text" ? shape.text || "" : ""

  if (framework === "react") {
    return `<${tag} style={${JSON.stringify(styles)}}>${inner}</${tag}>`
  }
  return `<${tag} style="${cssObjectToString(styles)}">${inner}</${tag}>`
}

// Infer semantic tag from type + name
function inferTag(shape) {
  const name = (shape.name || shape.type || "").toLowerCase()

  // Name-based conventions (Approach 3)
  if (name.includes("btn") || name.includes("button")) return "button"
  if (name.includes("nav")) return "nav"
  if (name.includes("header")) return "header"
  if (name.includes("footer")) return "footer"
  if (name.includes("hero")) return "section"
  if (name.includes("card")) return "article"
  if (name.includes("input") || name.includes("field")) return "input"
  if (name.includes("link")) return "a"
  if (name.includes("list")) return "ul"

  // Type-based fallbacks (Approach 1)
  if (shape.type === "text") return inferTextTag(shape)
  if (shape.type === "image") return "img"
  if (shape.type === "video") return "video"
  return "div"
}

function inferTextTag(shape) {
  const size = shape.fontSize || 16
  if (size >= 40) return "h1"
  if (size >= 30) return "h2"
  if (size >= 22) return "h3"
  if (size >= 18) return "h4"
  if (size <= 12) return "span"
  return "p"
}

function shapeToCSS(shape) {
  const css = {
    position: "absolute",
    left: `${shape.x || 0}px`,
    top: `${shape.y || 0}px`,
    width: `${shape.width || 0}px`,
    height: `${shape.height || 0}px`,
    opacity: shape.opacity ?? 1,
  }

  if (shape.fill && shape.type !== "text") css.backgroundColor = shape.fill
  if (shape.stroke)
    css.border = `${shape.strokeWidth || 1}px solid ${shape.stroke}`
  if (shape.cornerRadius) css.borderRadius = `${shape.cornerRadius}px`
  if (shape.rotation) css.transform = `rotate(${shape.rotation}deg)`

  if (shape.type === "text") {
    css.color = shape.fill || "#000000"
    css.fontSize = `${shape.fontSize || 16}px`
    css.fontFamily = shape.fontFamily || "Inter, sans-serif"
    css.fontWeight = shape.fontWeight || "normal"
    css.textAlign = shape.align || "left"
    delete css.backgroundColor
  }

  const filters = []
  if (shape.brightness) filters.push(`brightness(${1 + shape.brightness})`)
  if (shape.contrast) filters.push(`contrast(${1 + shape.contrast})`)
  if (shape.blurRadius) filters.push(`blur(${shape.blurRadius}px)`)
  if (shape.grayscale) filters.push(`grayscale(1)`)
  if (filters.length) css.filter = filters.join(" ")

  return css
}

function cssObjectToString(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join("; ")
}

function camelToKebab(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase()
}

function generateReact(shapes, cssMethod) {
  const elements = shapes
    .map((s) => "  " + shapeToElement(s, "react"))
    .join("\n")
  return `import React from 'react'

export default function DesignPage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
${elements}
    </div>
  )
}`
}

function generateHTML(shapes) {
  const elements = shapes
    .map((s) => "  " + shapeToElement(s, "html"))
    .join("\n")
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Export</title>
</head>
<body>
  <div style="position:relative; width:100%; height:100%;">
${elements}
  </div>
</body>
</html>`
}

function generateVue(shapes) {
  const elements = shapes
    .map((s) => "  " + shapeToElement(s, "html"))
    .join("\n")
  return `<template>
  <div style="position: relative; width: 100%; height: 100%;">
${elements}
  </div>
</template>

<script setup>
// Generated by KonvaCraft Studio
</script>`
}
