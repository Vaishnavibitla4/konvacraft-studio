import api from "./api";

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
  });
  return res.data.code;
}

export const FRAMEWORKS = [
  { id: "react", label: "React", ext: ".jsx" },
  { id: "nextjs", label: "Next.js", ext: ".tsx" },
  { id: "vue", label: "Vue 3", ext: ".vue" },
  { id: "html", label: "HTML", ext: ".html" },
];

export const CSS_METHODS = [
  { id: "tailwind", label: "Tailwind CSS" },

  { id: "cssmodules", label: "CSS Modules" },

  { id: "inline", label: "Inline Styles" },

  { id: "plain", label: "Plain CSS" },
];

export function generateFromDesign(pages, currentPageIndex, options = {}) {
  const { framework = "react", cssMethod = "tailwind" } = options;
  const page = pages[currentPageIndex];
  if (!page) return "// No page found";

  const shapes = page.shapes || [];

  if (framework === "react") return generateReact(shapes, cssMethod);
  if (framework === "vue") return generateVue(shapes, cssMethod);
  if (framework === "html") return generateHTML(shapes, cssMethod);
  return generateReact(shapes, cssMethod);
}

function shapeToElement(shape, framework) {
  const tag = inferTag(shape);

  if (shape.type === "arrow") {
    const pts = shape.points || [0, 0, 120, 0];
    const x1 = pts[0] || 0;
    const y1 = pts[1] || 0;
    const x2 = pts[2] ?? 120;
    const y2 = pts[3] ?? 0;

    const strokeColor = shape.stroke || "#000";
    const strokeWidth = shape.strokeWidth || 3;
    const pointerLength = shape.pointerLength || 15;
    const pointerWidth = shape.pointerWidth || 12;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Stop the line short so it doesn't poke through the arrowhead
    const lineEndX = x2 - (pointerLength * dx) / len;
    const lineEndY = y2 - (pointerLength * dy) / len;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Half-width padding so strokes/arrowhead aren't clipped
    const pad = Math.max(strokeWidth, pointerWidth) + 2;
    const svgW = Math.round(Math.abs(dx) + pointerLength + pad * 2);
    const svgH = Math.round(Math.abs(dy) + pointerWidth + pad * 2);
    // Offset so the start point sits correctly inside the padded viewBox
    const ox = pad - Math.min(x1, x2);
    const oy = pad - Math.min(y1, y2);

    const rotation = shape.rotation || 0;
    const rotateOriginX = x1 + ox;
    const rotateOriginY = y1 + oy;

    const posStyle =
      framework === "react"
        ? `{{ position: 'absolute', left: '${shape.x}px', top: '${shape.y}px', overflow: 'visible'${rotation ? `, transform: 'rotate(${rotation}deg)', transformOrigin: '${rotateOriginX}px ${rotateOriginY}px'` : ""} }}`
        : `position:absolute;left:${shape.x}px;top:${shape.y}px;overflow:visible${rotation ? `;transform:rotate(${rotation}deg);transform-origin:${rotateOriginX}px ${rotateOriginY}px` : ""}`;
    const styleAttr =
      framework === "react" ? `style={${posStyle}}` : `style="${posStyle}"`;

    const hw = pointerWidth / 2;
    const markerId = `ah-${shape.id || "a"}`;
    return `<svg ${styleAttr} width="${svgW}" height="${svgH}">
  <defs>
    <marker id="${markerId}" markerUnits="userSpaceOnUse" markerWidth="${pointerLength}" markerHeight="${pointerWidth}" refX="0" refY="${hw}" orient="auto">
      <polygon points="0 0, ${pointerLength} ${hw}, 0 ${pointerWidth}" fill="${strokeColor}" />
    </marker>
  </defs>
  <line
    x1="${x1 + ox}" y1="${y1 + oy}"
    x2="${lineEndX + ox}" y2="${lineEndY + oy}"
    stroke="${strokeColor}"
    stroke-width="${strokeWidth}"
    marker-end="url(#${markerId})"
  />
</svg>`;
  }

  const styles = shapeToCSS(shape);
  const inner = shape.type === "text" ? shape.text || "" : "";
  if (framework === "react") {
    return `<${tag} style={${JSON.stringify(styles)}}>${inner}</${tag}>`;
  }
  return `<${tag} style="${cssObjectToString(styles)}">${inner}</${tag}>`;
}

// Infer semantic tag from type + name
function inferTag(shape) {
  const name = (shape.name || shape.type || "").toLowerCase();

  // Name-based conventions (Approach 3)
  if (name.includes("btn") || name.includes("button")) return "button";
  if (name.includes("nav")) return "nav";
  if (name.includes("header")) return "header";
  if (name.includes("footer")) return "footer";
  if (name.includes("hero")) return "section";
  if (name.includes("card")) return "article";
  if (name.includes("input") || name.includes("field")) return "input";
  if (name.includes("link")) return "a";
  if (name.includes("list")) return "ul";

  // Type-based fallbacks (Approach 1)
  if (shape.type === "text") return inferTextTag(shape);
  if (shape.type === "image") return "img";
  if (shape.type === "video") return "video";
  return "div";
}

function inferTextTag(shape) {
  const size = shape.fontSize || 16;
  if (size >= 40) return "h1";
  if (size >= 30) return "h2";
  if (size >= 22) return "h3";
  if (size >= 18) return "h4";
  if (size <= 12) return "span";
  return "p";
}

const _measureCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;
const _measureCtx = _measureCanvas ? _measureCanvas.getContext("2d") : null;

function measureTextSize(shape) {
  if (!_measureCtx) return { width: 200, height: 30 };
  const fontSize = shape.fontSize || 16;
  const fontFamily = shape.fontFamily || "Inter, sans-serif";
  const konvaFontStyle = shape.fontStyle || "normal";
  const isBold =
    konvaFontStyle.includes("bold") || /^\d+$/.test(konvaFontStyle);
  const isItalic = konvaFontStyle.includes("italic");
  const weight = isBold
    ? /^\d+$/.test(konvaFontStyle)
      ? konvaFontStyle
      : "bold"
    : "normal";
  const style = isItalic ? "italic" : "normal";
  _measureCtx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  const lines = (shape.text || "").split("\n");
  const lineHeight = fontSize * (shape.lineHeight || 1.2);
  const width = Math.ceil(
    Math.max(...lines.map((l) => _measureCtx.measureText(l || " ").width)) + 4,
  );
  const height = Math.ceil(lines.length * lineHeight + 4);
  return { width, height };
}

function shapeToCSS(shape) {
  const scaleX = shape.scaleX ?? 1;
  const scaleY = shape.scaleY ?? 1;
  const offsetX = shape.offsetX ?? 0;
  const offsetY = shape.offsetY ?? 0;
  const w = (shape.width || 0) * scaleX;
  const h = (shape.height || 0) * scaleY;
  const left = (shape.x || 0) - offsetX * scaleX;
  const top = (shape.y || 0) - offsetY * scaleY;
  const pivotX = Math.round(offsetX * scaleX);
  const pivotY = Math.round(offsetY * scaleY);

  const isAutoText = shape.type === "text" && (!shape.width || shape.width < 2);

  const css = {
    position: "absolute",
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: isAutoText ? "max-content" : `${Math.round(w)}px`,
    height: isAutoText ? "auto" : `${Math.round(h)}px`,
    opacity: shape.opacity ?? 1,
  };

  if (shape.fill && shape.type !== "text") css.backgroundColor = shape.fill;
  if (shape.stroke)
    css.border = `${shape.strokeWidth || 1}px solid ${shape.stroke}`;
  if (shape.cornerRadius) css.borderRadius = `${shape.cornerRadius}px`;
  if (shape.rotation) {
    css.transformOrigin = `${pivotX}px ${pivotY}px`;
    css.transform = `rotate(${shape.rotation}deg)`;
  }

  if (shape.type === "text") {
    css.color = shape.fill || "#000000";
    css.fontSize = `${shape.fontSize || 16}px`;
    css.fontFamily = shape.fontFamily || "Inter, sans-serif";

    // Konva stores bold/italic in a single combined `fontStyle` string.
    // e.g. "normal", "bold", "italic", "bold italic", or numeric weight "600".
    const konvaFontStyle = shape.fontStyle || "normal";
    const isBold =
      konvaFontStyle === "bold" ||
      konvaFontStyle.includes("bold") ||
      /^\d+$/.test(konvaFontStyle);
    const isItalic = konvaFontStyle.includes("italic");

    css.fontWeight = isBold
      ? /^\d+$/.test(konvaFontStyle)
        ? konvaFontStyle
        : "bold"
      : "normal";
    css.fontStyle = isItalic ? "italic" : "normal";

    css.textAlign = shape.align || "left";
    css.whiteSpace = "pre-wrap";
    css.wordBreak = "break-word";
    delete css.backgroundColor;
  }

  const filters = [];
  if (shape.brightness) filters.push(`brightness(${1 + shape.brightness})`);
  if (shape.contrast) filters.push(`contrast(${1 + shape.contrast})`);
  if (shape.blurRadius) filters.push(`blur(${shape.blurRadius}px)`);
  if (shape.grayscale) filters.push(`grayscale(1)`);
  if (filters.length) css.filter = filters.join(" ");

  return css;
}

function cssObjectToString(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join("; ");
}

function camelToKebab(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function generateReact(shapes, cssMethod) {
  const elements = shapes
    .map((s) => "  " + shapeToElement(s, "react"))
    .join("\n");
  return `import React from 'react'

export default function DesignPage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
${elements}
    </div>
  )
}`;
}

function generateHTML(shapes) {
  const elements = shapes
    .map((s) => "  " + shapeToElement(s, "html"))
    .join("\n");

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
</html>`;
}

function generateVue(shapes) {
  const elements = shapes
    .map((s) => "  " + shapeToElement(s, "html"))
    .join("\n");
  return `<template>
  <div style="position: relative; width: 100%; height: 100%;">
${elements}
  </div>
</template>

<script setup>
// Generated by KonvaCraft Studio
</script>`;
}
