// client/src/lib/designSerializer.js
// Converts KonvaCraft's internal canvas state → normalized Design JSON

export function serializeDesign(pages, canvasSize, currentPageIndex) {
  return {
    canvasWidth:  canvasSize?.width  || 1200,
    canvasHeight: canvasSize?.height || 800,
    pages: pages.map((page, i) => ({
      id:       page.id,
      label:    page.label,
      isCurrent: i === currentPageIndex,
      nodes:    page.shapes
        .filter(s => s.visible !== false)   // skip hidden layers
        .map(serializeNode),
    })),
  }
}

function serializeNode(shape) {
  const base = {
    id:       shape.id,
    name:     shape.type + '_' + shape.id.slice(0, 6),
    type:     mapType(shape.type),
    rawType:  shape.type,
    bounds: {
      x:        shape.x        || 0,
      y:        shape.y        || 0,
      width:    shape.width    || 0,
      height:   shape.height   || 0,
      rotation: shape.rotation || 0,
    },
    styles: {
      fill:         shape.fill        || null,
      stroke:       shape.stroke      || null,
      strokeWidth:  shape.strokeWidth || 0,
      opacity:      shape.opacity     ?? 1,
      cornerRadius: shape.cornerRadius || 0,
      // filters
      brightness:   shape.brightness  || 0,
      contrast:     shape.contrast    || 0,
      blurRadius:   shape.blurRadius  || 0,
      grayscale:    shape.grayscale   || false,
    },
  }

  // Text-specific
  if (shape.type === 'text') {
    base.text = {
      content:    shape.text       || '',
      fontSize:   shape.fontSize   || 16,
      fontFamily: shape.fontFamily || 'Inter',
      fontWeight: shape.fontWeight || 'normal',
      fill:       shape.fill       || '#000000',
      align:      shape.align      || 'left',
    }
  }

  // Image-specific
  if (shape.type === 'image') {
    base.image = { src: shape.src || '' }
  }

  // Video-specific
  if (shape.type === 'video') {
    base.video = {
      src:         shape.src         || '',
      trimStart:   shape.trimStart   || 0,
      trimEnd:     shape.trimEnd     || null,
      volume:      shape.volume      ?? 1,
      muted:       shape.muted       || false,
      playbackRate: shape.playbackRate ?? 1,
    }
  }

  return base
}

function mapType(konvaType) {
  const map = {
    rect:      'rectangle',
    roundrect: 'rectangle',
    circle:    'circle',
    ellipse:   'ellipse',
    triangle:  'polygon',
    pentagon:  'polygon',
    hexagon:   'polygon',
    star:      'star',
    arrow:     'arrow',
    line:      'line',
    text:      'text',
    image:     'image',
    video:     'video',
  }
  return map[konvaType] || 'shape'
}