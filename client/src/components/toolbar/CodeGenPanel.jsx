import { useState, useRef, useEffect } from "react";
import { useEditorStore } from "../../store/editorStore";

const FRAMEWORKS = [
  { id: "react", label: "React", ext: ".jsx" },
  { id: "nextjs", label: "Next.js", ext: ".tsx" },
  { id: "vue", label: "Vue 3", ext: ".vue" },
  { id: "html", label: "HTML", ext: ".html" },
];

const CSS_METHODS = [
  { id: "inline", label: "Inline Styles" },
  { id: "classes", label: "CSS Classes" },
];

const EDITOR_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Raleway",
  "Nunito",
  "Ubuntu",
  "Comfortaa",
  "Oswald",
  "Bebas Neue",
  "Righteous",
  "Abril Fatface",
  "Playfair Display",
  "Merriweather",
  "Dancing Script",
  "Pacifico",
  "Lobster",
  "Permanent Marker",
  "Shadows Into Light",
  "Architects Daughter",
  "Courier Prime",
  "Source Code Pro",
  "Space Mono",
  "Special Elite",
];

function buildGoogleFontsUrl(usedFamilies) {
  const families = usedFamilies
    .filter((f) => !["Georgia"].includes(f))
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function getShapeBounds(shape) {
  switch (shape.type) {
    case "circle":
    case "triangle":
    case "pentagon":
    case "hexagon": {
      const r = shape.radius || 60;
      return { x: shape.x - r, y: shape.y - r, width: r * 2, height: r * 2 };
    }
    case "ellipse": {
      const rx = shape.radiusX || 70;
      const ry = shape.radiusY || 45;
      return {
        x: shape.x - rx,
        y: shape.y - ry,
        width: rx * 2,
        height: ry * 2,
      };
    }
    case "star": {
      const r = shape.outerRadius || 65;
      return { x: shape.x - r, y: shape.y - r, width: r * 2, height: r * 2 };
    }
    case "arrow":
    case "line": {
      const pts = shape.points || [0, 0, 120, 0];
      const xs = pts.filter((_, i) => i % 2 === 0);
      const ys = pts.filter((_, i) => i % 2 !== 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        x: shape.x + minX,
        y: shape.y + minY,
        width: Math.max(maxX - minX, 4),
        height: Math.max(maxY - minY, 4),
      };
    }
    default: {
      const scaleX = shape.scaleX ?? 1;
      const scaleY = shape.scaleY ?? 1;
      const offsetX = shape.offsetX ?? 0;
      const offsetY = shape.offsetY ?? 0;
      const w = (shape.width || 0) * scaleX;
      const h = (shape.height || 0) * scaleY;
      return {
        x: (shape.x || 0) - offsetX * scaleX,
        y: (shape.y || 0) - offsetY * scaleY,
        width: w,
        height: h,
      };
    }
  }
}

function inferTag(shape) {
  const name = (shape.name || "").toLowerCase();

  if (name.includes("btn") || name.includes("button")) return "button";
  if (name.includes("nav")) return "nav";
  if (name.includes("header")) return "header";
  if (name.includes("footer")) return "footer";
  if (name.includes("hero")) return "section";
  if (name.includes("card")) return "article";
  if (name.includes("input") || name.includes("field")) return "input";
  if (name.includes("link")) return "a";
  if (name.includes("list")) return "ul";
  if (name.includes("section") || name.includes("container")) return "section";
  if (name.includes("modal") || name.includes("dialog")) return "dialog";
  if (name.includes("badge") || name.includes("tag")) return "span";

  if (shape.type === "text") return inferTextTag(shape);
  if (shape.type === "image") return "img";
  if (shape.type === "video") return "video";

  return "div";
}

function inferTextTag(shape) {
  const size = shape.fontSize || 16;
  if (size >= 48) return "h1";
  if (size >= 36) return "h2";
  if (size >= 26) return "h3";
  if (size >= 20) return "h4";
  if (size >= 18) return "h5";
  if (size <= 11) return "span";
  return "p";
}

function inferClassName(shape) {
  if (shape.name) {
    return shape.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
  }
  return `${shape.type}-${(shape.id || "000000").slice(0, 6)}`;
}

function shapeToCSS(shape) {
  const bounds = getShapeBounds(shape);
  const css = {};

  css.position = "absolute";
  css.left = `${Math.round(bounds.x)}px`;
  css.top = `${Math.round(bounds.y)}px`;
  css.width = `${Math.round(bounds.width)}px`;
  css.height = `${Math.round(bounds.height)}px`;
  css.boxSizing = "border-box";
  const transforms = [];

  if (shape.rotation) {
    const scaleX = shape.scaleX ?? 1;
    const scaleY = shape.scaleY ?? 1;
    const offsetX = shape.offsetX ?? 0;
    const offsetY = shape.offsetY ?? 0;
    // In Konva, rotation pivot is at (offsetX, offsetY) in local space.
    // In CSS, left/top already subtract the scaled offset, so the pivot
    // relative to the element's top-left corner is (offsetX*scaleX, offsetY*scaleY).
    const pivotX = Math.round(offsetX * scaleX);
    const pivotY = Math.round(offsetY * scaleY);
    css.transformOrigin = `${pivotX}px ${pivotY}px`;
    transforms.push(`rotate(${shape.rotation}deg)`);
  }

  if ((shape.opacity ?? 1) !== 1) css.opacity = shape.opacity;

  if (!["text", "image", "video", "line", "arrow"].includes(shape.type)) {
    if (shape.fill) css.backgroundColor = shape.fill;
  }

  if (shape.stroke && (shape.strokeWidth || 0) > 0) {
    css.border = `${shape.strokeWidth}px solid ${shape.stroke}`;
  }

  if (shape.cornerRadius) {
    css.borderRadius = `${shape.cornerRadius}px`;
  }

  if (["circle", "ellipse"].includes(shape.type)) {
    css.borderRadius = "50%";
  }

  if (shape.type === "triangle") {
    css.backgroundColor = shape.fill || "#000";
    css.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    css.border = "none";
  }
  if (shape.type === "pentagon") {
    css.backgroundColor = shape.fill || "#000";
    css.clipPath = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
    css.border = "none";
  }
  if (shape.type === "hexagon") {
    css.backgroundColor = shape.fill || "#000";
    css.clipPath =
      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
    css.border = "none";
  }

  if (shape.type === "star") {
    css.backgroundColor = shape.fill || "#000";
    css.clipPath =
      "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)";
    css.border = "none";
  }

  if (shape.type === "line") {
    const pts = shape.points || [0, 0, 120, 0];
    const dx = (pts[2] || 0) - (pts[0] || 0);
    const dy = (pts[3] || 0) - (pts[1] || 0);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const len = Math.sqrt(dx * dx + dy * dy);
    css.width = `${Math.round(len)}px`;
    css.height = `${shape.strokeWidth || 2}px`;
    css.backgroundColor = shape.stroke || "#000";
    css.transformOrigin = "0 50%";
    transforms.push(`rotate(${angle}deg)`);
    delete css.border;
  }
  if (shape.type === "arrow") {
    const pts = shape.points || [0, 0, 120, 0];

    const dx = (pts[2] || 0) - (pts[0] || 0);
    const dy = (pts[3] || 0) - (pts[1] || 0);

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const len = Math.sqrt(dx * dx + dy * dy);

    const pointerLength = shape.pointerLength || 15;

    css.width = `${Math.round(len - pointerLength)}px`;
    css.height = `${shape.strokeWidth || 3}px`;
    css.backgroundColor = shape.stroke || "#000";

    css.transformOrigin = "0 50%";

    transforms.push(`rotate(${angle}deg)`);

    delete css.border;
  }

  if (shape.type === "text") {
    css.color = shape.fill || "#000000";
    css.fontSize = `${shape.fontSize || 16}px`;
    css.fontFamily = `'${shape.fontFamily || "Inter"}', sans-serif`;
    css.fontWeight =
      shape.fontWeight || shape.fontStyle?.includes("bold") ? "bold" : "normal";
    css.fontStyle = shape.fontStyle?.includes("italic") ? "italic" : "normal";
    css.textAlign = shape.align || "left";
    css.lineHeight = "1.4";
    css.whiteSpace = "pre-wrap";
    css.wordBreak = "break-word";
    delete css.backgroundColor;
  }

  if (shape.type === "image") {
    css.objectFit = "cover";
    if (shape.cornerRadius) css.borderRadius = `${shape.cornerRadius}px`;
  }

  const filters = [];
  if ((shape.brightness ?? 0) !== 0)
    filters.push(`brightness(${1 + shape.brightness})`);
  if ((shape.contrast ?? 0) !== 0)
    filters.push(`contrast(${1 + shape.contrast})`);
  if ((shape.blurRadius ?? 0) > 0) filters.push(`blur(${shape.blurRadius}px)`);
  if (shape.grayscale) filters.push("grayscale(1)");
  if ((shape.saturation ?? 0) !== 0)
    filters.push(`saturate(${1 + shape.saturation})`);
  if (filters.length) css.filter = filters.join(" ");

  if (shape.shadowColor && (shape.shadowBlur || 0) > 0) {
    const ox = shape.shadowOffsetX || 0;
    const oy = shape.shadowOffsetY || 0;
    css.boxShadow = `${ox}px ${oy}px ${shape.shadowBlur}px ${shape.shadowColor}`;
  }
  if (transforms.length) {
    css.transform = transforms.join(" ");
  }

  return css;
}

function camelToKebab(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function cssToString(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join("; ");
}

function cssToJSXObject(obj) {
  const entries = Object.entries(obj).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (!entries.length) return "{{}}";
  const inner = entries
    .map(([k, v]) => `  ${k}: '${String(v).replace(/'/g, '"')}'`)
    .join(",\n");
  return `{{\n${inner}\n}}`;
}

function buildCSSBlock(shapes) {
  return shapes
    .map((shape) => {
      const css = shapeToCSS(shape);
      const cls = inferClassName(shape);
      const body = Object.entries(css)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `  ${camelToKebab(k)}: ${v};`)
        .join("\n");
      return `.${cls} {\n${body}\n}`;
    })
    .join("\n\n");
}

function shapeToJSX(shape, cssMethod) {
  if (shape.type === "arrow") {
    const pts = shape.points || [0, 0, 120, 0];
    const x1 = pts[0] || 0;
    const y1 = pts[1] || 0;
    const x2 = pts[2] ?? 120;
    const y2 = pts[3] ?? 0;

    const color = shape.stroke || "#000";
    const strokeWidth = shape.strokeWidth || 3;
    const pointerLength = shape.pointerLength || 15;
    const pointerWidth = shape.pointerWidth || 12;
    const hw = pointerWidth / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const lineEndX = x2 - (pointerLength * dx) / len;
    const lineEndY = y2 - (pointerLength * dy) / len;

    const pad = Math.max(strokeWidth, pointerWidth) + 2;
    const svgW = Math.round(Math.abs(dx) + pointerLength + pad * 2);
    const svgH = Math.round(Math.abs(dy) + pointerWidth + pad * 2);
    const ox = pad - Math.min(x1, x2);
    const oy = pad - Math.min(y1, y2);

    const rotation = shape.rotation || 0;
    const rotateOriginX = x1 + ox;
    const rotateOriginY = y1 + oy;
    const transformStyle = rotation
      ? `, transform: 'rotate(${rotation}deg)', transformOrigin: '${rotateOriginX}px ${rotateOriginY}px'`
      : "";
    const posStyle = `{{ position: 'absolute', left: '${shape.x}px', top: '${shape.y}px', overflow: 'visible'${transformStyle} }}`;
    const markerId = `ah-${shape.id || "a"}`;

    return `      <svg style={${posStyle}} width="${svgW}" height="${svgH}">
        <defs>
          <marker id="${markerId}" markerUnits="userSpaceOnUse" markerWidth="${pointerLength}" markerHeight="${pointerWidth}" refX="0" refY="${hw}" orient="auto">
            <polygon points="0 0, ${pointerLength} ${hw}, 0 ${pointerWidth}" fill="${color}" />
          </marker>
        </defs>
        <line
          x1="${x1 + ox}" y1="${y1 + oy}"
          x2="${lineEndX + ox}" y2="${lineEndY + oy}"
          stroke="${color}"
          strokeWidth="${strokeWidth}"
          markerEnd="url(#${markerId})"
        />
      </svg>`;
  }
  const tag = inferTag(shape);
  const css = shapeToCSS(shape);
  const cls = inferClassName(shape);
  const self = tag === "img" || tag === "input";

  let attrs =
    cssMethod === "inline"
      ? ` style=${cssToJSXObject(css)}`
      : ` className="${cls}"`;

  if (tag === "img")
    attrs += `\n        src="${shape.src || ""}" alt="${shape.name || "image"}"`;
  if (tag === "video")
    attrs += ` src="${shape.src || ""}"${shape.muted ? " muted" : ""}${shape.loop ? " loop" : ""} controls`;
  if (tag === "input")
    attrs += ` type="text" placeholder="${shape.text || ""}"`;
  if (tag === "a") attrs += ` href="#"`;

  const inner = shape.type === "text" ? shape.text || "" : "";

  if (self) return `      <${tag}${attrs} />`;
  return `      <${tag}${attrs}>${inner}</${tag}>`;
}

function shapeToHTML(shape, cssMethod) {
  if (shape.type === "arrow") {
    const pts = shape.points || [0, 0, 120, 0];
    const x1 = pts[0] || 0;
    const y1 = pts[1] || 0;
    const x2 = pts[2] ?? 120;
    const y2 = pts[3] ?? 0;

    const color = shape.stroke || "#000";
    const strokeWidth = shape.strokeWidth || 3;
    const pointerLength = shape.pointerLength || 15;
    const pointerWidth = shape.pointerWidth || 12;
    const hw = pointerWidth / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const lineEndX = x2 - (pointerLength * dx) / len;
    const lineEndY = y2 - (pointerLength * dy) / len;

    const pad = Math.max(strokeWidth, pointerWidth) + 2;
    const svgW = Math.round(Math.abs(dx) + pointerLength + pad * 2);
    const svgH = Math.round(Math.abs(dy) + pointerWidth + pad * 2);
    const ox = pad - Math.min(x1, x2);
    const oy = pad - Math.min(y1, y2);
    const rotation = shape.rotation || 0;
    const rotateOriginX = x1 + ox;
    const rotateOriginY = y1 + oy;
    const transformStyle = rotation
      ? `;transform:rotate(${rotation}deg);transform-origin:${rotateOriginX}px ${rotateOriginY}px`
      : "";
    const markerId = `ah-${shape.id || "a"}`;

    return `    <svg style="position:absolute;left:${shape.x}px;top:${shape.y}px;overflow:visible${transformStyle}" width="${svgW}" height="${svgH}">
      <defs>
        <marker id="${markerId}" markerUnits="userSpaceOnUse" markerWidth="${pointerLength}" markerHeight="${pointerWidth}" refX="0" refY="${hw}" orient="auto">
          <polygon points="0 0, ${pointerLength} ${hw}, 0 ${pointerWidth}" fill="${color}" />
        </marker>
      </defs>
      <line x1="${x1 + ox}" y1="${y1 + oy}" x2="${lineEndX + ox}" y2="${lineEndY + oy}" stroke="${color}" stroke-width="${strokeWidth}" marker-end="url(#${markerId})" />
    </svg>`;
  }
  const tag = inferTag(shape);
  const css = shapeToCSS(shape);
  const cls = inferClassName(shape);
  const self = tag === "img" || tag === "input";

  let attrs =
    cssMethod === "inline" ? ` style="${cssToString(css)}"` : ` class="${cls}"`;

  if (tag === "img")
    attrs += ` src="${shape.src || ""}" alt="${shape.name || "image"}"`;
  if (tag === "video")
    attrs += ` src="${shape.src || ""}"${shape.muted ? " muted" : ""}${shape.loop ? " loop" : ""} controls`;
  if (tag === "input")
    attrs += ` type="text" placeholder="${shape.text || ""}"`;
  if (tag === "a") attrs += ` href="#"`;

  const inner = shape.type === "text" ? shape.text || "" : "";

  if (self) return `    <${tag}${attrs} />`;
  return `    <${tag}${attrs}>${inner}</${tag}>`;
}

function collectUsedFonts(shapes) {
  const used = new Set();
  shapes.forEach((s) => {
    console.log(JSON.stringify(s, null, 2));
    if (s.type === "text" && s.fontFamily) used.add(s.fontFamily);
  });
  return [...used];
}

function generateReact(shapes, cssMethod, canvasSize, componentName) {
  const cw = canvasSize?.width || 1200;
  const ch = canvasSize?.height || 800;
  const visible = shapes.filter((s) => s.visible !== false);
  const usedFonts = collectUsedFonts(visible);
  const fontUrl = usedFonts.length ? buildGoogleFontsUrl(usedFonts) : null;

  const elements = visible.map((s) => shapeToJSX(s, cssMethod)).join("\n");
  const cssBlock =
    cssMethod === "classes"
      ? `\n// Styles\nconst css = \`\n${buildCSSBlock(visible)}\n\``
      : "";
  const styleInject =
    cssMethod === "classes" ? "\n      <style>{css}</style>" : "";
  const fontImport = fontUrl
    ? `\n      <link rel="stylesheet" href="${fontUrl}" />`
    : "";

  return `import React from 'react'
${cssBlock}

export default function ${componentName}() {
  return (
    <>
      <head>${fontImport}
      </head>
      <div
        style={{
          position: 'relative',
          width: '${cw}px',
          height: '${ch}px',
          clipPath: 'inset(0)',
          background: '#ffffff',
        }}
      >${styleInject}
${elements}
      </div>
    </>
  )
}`;
}

function generateNextJS(shapes, cssMethod, canvasSize, componentName) {
  const cw = canvasSize?.width || 1200;
  const ch = canvasSize?.height || 800;
  const visible = shapes.filter((s) => s.visible !== false);
  const usedFonts = collectUsedFonts(visible);
  const fontUrl = usedFonts.length ? buildGoogleFontsUrl(usedFonts) : null;

  const elements = visible.map((s) => shapeToJSX(s, cssMethod)).join("\n");
  const cssBlock =
    cssMethod === "classes"
      ? `\nconst css = \`\n${buildCSSBlock(visible)}\n\``
      : "";
  const styleInject =
    cssMethod === "classes" ? "\n        <style>{css}</style>" : "";
  const fontLink = fontUrl ? `\nimport Head from 'next/head'\n` : "";
  const headBlock = fontUrl
    ? `\n      <Head>\n        <link rel="stylesheet" href="${fontUrl}" />\n      </Head>`
    : "";

  return `'use client'
${fontLink}import React from 'react'
${cssBlock}

export default function ${componentName}() {
  return (
    <>${headBlock}
      <div
        style={{
          position: 'relative',
          width: '${cw}px',
          height: '${ch}px',
          clipPath: 'inset(0)',
          background: '#ffffff',
        }}
      >${styleInject}
${elements}
      </div>
    </>
  )
}`;
}

function generateVue(shapes, cssMethod, canvasSize) {
  const cw = canvasSize?.width || 1200;
  const ch = canvasSize?.height || 800;
  const visible = shapes.filter((s) => s.visible !== false);
  const usedFonts = collectUsedFonts(visible);
  const fontUrl = usedFonts.length ? buildGoogleFontsUrl(usedFonts) : null;

  const elements = visible.map((s) => shapeToHTML(s, cssMethod)).join("\n");
  const fontLink = fontUrl
    ? `\n  <link rel="stylesheet" href="${fontUrl}" />`
    : "";
  const cssBlock =
    cssMethod === "classes"
      ? buildCSSBlock(visible)
      : `.design-canvas { position: relative; width: ${cw}px; height: ${ch}px; clip-path: inset(0); background: #ffffff; }`;

  return `<template>
  <div class="design-canvas">
${elements}
  </div>
</template>

<script setup>
// Generated by KonvaCraft Studio
</script>

<style>
${fontLink ? `@import url('${fontUrl}');` : ""}

.design-canvas {
  position: relative;
  width: ${cw}px;
  height: ${ch}px;
  clip-path: inset(0);
  background: #ffffff;
}

${cssMethod === "classes" ? buildCSSBlock(visible) : ""}
</style>`;
}

function generateHTML(shapes, cssMethod, canvasSize) {
  const cw = canvasSize?.width || 1200;
  const ch = canvasSize?.height || 800;
  const visible = shapes.filter((s) => s.visible !== false);
  const usedFonts = collectUsedFonts(visible);
  const fontUrl = usedFonts.length ? buildGoogleFontsUrl(usedFonts) : null;

  const elements = visible.map((s) => shapeToHTML(s, cssMethod)).join("\n");
  const fontLink = fontUrl
    ? `\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="stylesheet" href="${fontUrl}">`
    : "";

  const baseCSS = `.design-canvas {\n  position: relative;\n  width: ${cw}px;\n  height: ${ch}px;\n  clip-path: inset(0);\n  background: #ffffff;\n}`;
  const shapeCSS =
    cssMethod === "classes" ? `\n\n${buildCSSBlock(visible)}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Export</title>${fontLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${baseCSS}${shapeCSS}
  </style>
</head>
<body>
  <div class="design-canvas">
${elements}
  </div>
</body>
</html>`;
}

function generateFromDesign(pages, currentPageIndex, canvasSize, options = {}) {
  const {
    framework = "react",
    cssMethod = "inline",
    componentName = "DesignPage",
  } = options;
  const page = pages?.[currentPageIndex];
  const shapes = page?.shapes || [];

  if (!shapes.length) return "// No shapes on this page";

  const name =
    componentName.trim().replace(/[^a-zA-Z0-9]/g, "") || "DesignPage";

  if (framework === "react")
    return generateReact(shapes, cssMethod, canvasSize, name);
  if (framework === "nextjs")
    return generateNextJS(shapes, cssMethod, canvasSize, name);
  if (framework === "vue") return generateVue(shapes, cssMethod, canvasSize);
  if (framework === "html") return generateHTML(shapes, cssMethod, canvasSize);

  return generateReact(shapes, cssMethod, canvasSize, name);
}

// ─── SYNTAX HIGHLIGHTER ───────────────────────────────────────────────────────

function highlight(code) {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#6ee7b7">$1</span>')
    .replace(/(`[^`\n]*`)/g, '<span style="color:#fde68a">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#fcd34d">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#fcd34d">$1</span>')
    .replace(
      /\b(import|export|default|from|return|const|let|var|function|if|else|true|false|null|undefined)\b/g,
      '<span style="color:#c4b5fd">$1</span>',
    )
    .replace(
      /\b(React|useState|useEffect|style|className|src|alt|href|type|controls|muted|loop|placeholder)\b/g,
      '<span style="color:#93c5fd">$1</span>',
    );
}

// ─── PANEL COMPONENT ──────────────────────────────────────────────────────────

export default function CodeGenPanel({ designId, designTitle, onClose }) {
  const { pages, currentPageIndex, canvasSize } = useEditorStore();

  const dialogRef = useRef();

  const [framework, setFramework] = useState("react");
  const [cssMethod, setCssMethod] = useState("inline");
  const [componentName, setComponentName] = useState("DesignPage");
  const [generatedCode, setGeneratedCode] = useState("");
  const [activeTab, setActiveTab] = useState("config");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const currentPage = pages?.[currentPageIndex];
  const shapeCount =
    currentPage?.shapes?.filter((s) => s.visible !== false)?.length || 0;
  const fw = FRAMEWORKS.find((f) => f.id === framework);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Generate ──────────────────────────────────────────────────────────────
  function generate() {
    setError("");
    try {
      if (!pages?.length) throw new Error("No pages found in your design.");
      if (!shapeCount)
        throw new Error("This page has no visible shapes to export.");

      const code = generateFromDesign(pages, currentPageIndex, canvasSize, {
        framework,
        cssMethod,
        componentName,
      });
      setGeneratedCode(code);
      setActiveTab("code");
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Copy ──────────────────────────────────────────────────────────────────
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // ── Download ──────────────────────────────────────────────────────────────
  function handleDownload() {
    const ext = fw?.ext || ".jsx";
    const safeName = (designTitle || "design")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={dialogRef}
      className="absolute right-0 top-14 z-50"
      style={{ width: 500 }}
    >
      <div
        className="rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "#0f172a",
          border: "1px solid rgba(124,58,237,0.35)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
            >
              {"</>"}
            </div>
            <div>
              <p className="text-sm font-bold text-white">Export Code</p>
              <p className="text-xs text-white/40 mt-0.5">
                {shapeCount} shape{shapeCount !== 1 ? "s" : ""} ·{" "}
                {currentPage?.label || "Page 1"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/70 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1">
          {[
            { id: "config", label: "⚙ Config" },
            { id: "code", label: "</> Code", disabled: !generatedCode },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white"
                    : tab.disabled
                      ? "text-white/20 cursor-not-allowed"
                      : "text-white/50 hover:bg-white/10 hover:text-white/80"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 pt-4 space-y-4">
          {/* ── CONFIG TAB ── */}
          {activeTab === "config" && (
            <>
              {/* Framework */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Framework
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {FRAMEWORKS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFramework(f.id)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all
                        ${
                          framework === f.id
                            ? "border-violet-500 bg-violet-600/20 text-violet-300"
                            : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/70"
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CSS Method */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  CSS Method
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CSS_METHODS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCssMethod(c.id)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all
                        ${
                          cssMethod === c.id
                            ? "border-pink-500 bg-pink-600/15 text-pink-300"
                            : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/70"
                        }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Component name */}
              {(framework === "react" || framework === "nextjs") && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Component Name
                  </p>
                  <input
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                    placeholder="DesignPage"
                    className="w-full h-9 px-3 rounded-xl text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                </div>
              )}

              {/* Canvas info */}
              <div
                className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div>
                  <p className="text-xs font-semibold text-white/60">
                    {currentPage?.label || "Page 1"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {canvasSize?.width || 1200} × {canvasSize?.height || 800}px
                    · {shapeCount} element{shapeCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                  style={{
                    background: "rgba(124,58,237,0.2)",
                    color: "#a78bfa",
                  }}
                >
                  {fw?.ext}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="rounded-xl px-3 py-2 text-xs text-red-300"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  ⚠ {error}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={!shapeCount}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                }}
              >
                &lt;/&gt; Generate {fw?.label} Code
              </button>
            </>
          )}

          {/* ── CODE TAB ── */}
          {activeTab === "code" && generatedCode && (
            <>
              <div
                className="relative rounded-xl overflow-hidden"
                style={{
                  background: "#020617",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="overflow-auto" style={{ maxHeight: 360 }}>
                  <pre
                    className="text-[11px] font-mono p-4 leading-relaxed text-white/80"
                    dangerouslySetInnerHTML={{
                      __html: highlight(generatedCode),
                    }}
                  />
                </div>
                <button
                  onClick={handleCopy}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: copied ? "#059669" : "rgba(255,255,255,0.08)",
                    color: copied ? "#fff" : "#94a3b8",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {copied ? "✓ Copied!" : "⎘ Copy"}
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                <span>{shapeCount} elements</span>
                <span>·</span>
                <span>{generatedCode.split("\n").length} lines</span>
                <span>·</span>
                <span>{(generatedCode.length / 1024).toFixed(1)} KB</span>
                <span>·</span>
                <span className="text-violet-400/70">
                  {fw?.label} ·{" "}
                  {CSS_METHODS.find((c) => c.id === cssMethod)?.label}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/70 border border-white/10 hover:border-white/30 hover:text-white transition-all"
                >
                  ⬇ Download {fw?.ext}
                </button>
                <button
                  onClick={() => setActiveTab("config")}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/70 border border-white/10 hover:border-white/30 hover:text-white transition-all"
                >
                  ↺ Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
