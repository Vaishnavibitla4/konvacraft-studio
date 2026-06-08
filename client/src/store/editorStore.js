import { create } from 'zustand'

function uid() {
  return crypto.randomUUID()
}

const MAX_HISTORY = 50

function makeEmptyPage(label = 'Page 1') {
  return { id: uid(), label, shapes: [] }
}

export const useEditorStore = create((set, get) => ({
  pages: [makeEmptyPage('Page 1')],
  currentPageIndex: 0,
  selectedId: null,
  tool: 'select',
  canvasSize: { width: 1200, height: 800 },
  isPresentationMode: false,
  zoom: 1,
  stagePosition: { x: 120, y: 80 },
  history: [JSON.stringify([makeEmptyPage('Page 1')])],
  historyIndex: 0,

  setTool: (tool) => set({ tool, selectedId: null }),
  setSelected: (id) => set({ selectedId: id }),
  setZoom: (zoom) => set({ zoom }),
  setStagePosition: (position) => set({ stagePosition: position }),

  _currentShapes() {
    const { pages, currentPageIndex } = get()
    return pages[currentPageIndex]?.shapes ?? []
  },

  _updateCurrentShapes(updaterFn) {
    const { pages, currentPageIndex } = get()
    const newPages = pages.map((page, i) =>
      i === currentPageIndex ? { ...page, shapes: updaterFn(page.shapes ?? []) } : page
    )
    set({ pages: newPages })
  },

  _snapshot() {
    const { pages, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(JSON.stringify(pages))
    if (newHistory.length > MAX_HISTORY) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  addPage() {
    get()._snapshot()
    const { pages } = get()
    const newPage = makeEmptyPage('Page ' + (pages.length + 1))
    set({ pages: [...pages, newPage], currentPageIndex: pages.length })
  },

  deletePage(index) {
    const { pages } = get()
    if (pages.length <= 1) return
    get()._snapshot()
    const newPages = pages.filter((_, i) => i !== index)
    const newIndex = Math.min(get().currentPageIndex, newPages.length - 1)
    set({ pages: newPages, currentPageIndex: newIndex, selectedId: null })
  },

  duplicatePage(index) {
    get()._snapshot()
    const { pages } = get()
    const page = pages[index]
    const newPage = { ...page, id: uid(), label: page.label + ' (copy)', shapes: page.shapes.map(s => ({ ...s, id: uid() })) }
    const newPages = [...pages.slice(0, index + 1), newPage, ...pages.slice(index + 1)]
    set({ pages: newPages, currentPageIndex: index + 1 })
  },

  renamePage(index, label) {
    const { pages } = get()
    set({ pages: pages.map((p, i) => i === index ? { ...p, label } : p) })
  },

  setCurrentPage(index) {
    set({ currentPageIndex: index, selectedId: null })
  },

  movePage(fromIndex, toIndex) {
    get()._snapshot()
    const { pages } = get()
    const newPages = [...pages]
    const [removed] = newPages.splice(fromIndex, 1)
    newPages.splice(toIndex, 0, removed)
    set({ pages: newPages, currentPageIndex: toIndex })
  },

  get shapes() {
    const { pages, currentPageIndex } = get()
    return pages[currentPageIndex]?.shapes ?? []
  },

  addShape(shape) {
    get()._snapshot()
    const newShape = { id: uid(), trimStart: 0, trimEnd: null, currentTime: 0, playbackRate: 1, volume: 1, loop: false, muted: false, brightness: 0, contrast: 0, saturation: 0, blurRadius: 0, grayscale: false, keyframes: [], ...shape }
    get()._updateCurrentShapes(shapes => [...shapes, newShape])
  },

  updateShape(id, attrs) {
    get()._updateCurrentShapes(shapes => shapes.map(s => s.id === id ? { ...s, ...attrs } : s))
  },

  updateShapeAndSnapshot(id, attrs) {
    get()._snapshot()
    get().updateShape(id, attrs)
  },

  deleteShape(id) {
    get()._snapshot()
    get()._updateCurrentShapes(shapes => shapes.filter(s => s.id !== id))
    set({ selectedId: null })
  },

  moveShapeUp(id) {
    get()._snapshot()
    get()._updateCurrentShapes(shapes => {
      const index = shapes.findIndex(s => s.id === id)
      if (index >= shapes.length - 1) return shapes
      const u = [...shapes];[u[index], u[index + 1]] = [u[index + 1], u[index]]; return u
    })
  },

  moveShapeDown(id) {
    get()._snapshot()
    get()._updateCurrentShapes(shapes => {
      const index = shapes.findIndex(s => s.id === id)
      if (index <= 0) return shapes
      const u = [...shapes];[u[index], u[index - 1]] = [u[index - 1], u[index]]; return u
    })
  },

  updateManyShapes(updates = []) {
    get()._updateCurrentShapes(shapes =>
      shapes.map(s => { const found = updates.find(u => u.id === s.id); return found ? { ...s, ...found.attrs } : s })
    )
  },

  undo() {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    let parsed = [makeEmptyPage()]
    try { parsed = JSON.parse(history[newIndex]) } catch {}
    set({ pages: Array.isArray(parsed) ? parsed : [makeEmptyPage()], historyIndex: newIndex })
  },

  redo() {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    let parsed = [makeEmptyPage()]
    try { parsed = JSON.parse(history[newIndex]) } catch {}
    set({ pages: Array.isArray(parsed) ? parsed : [makeEmptyPage()], historyIndex: newIndex })
  },

  addKeyframe(id, keyframe) {
    get()._snapshot()
    get()._updateCurrentShapes(shapes => shapes.map(s => s.id === id ? { ...s, keyframes: [...(s.keyframes || []), { id: uid(), ...keyframe }] } : s))
  },

  updateKeyframe(shapeId, keyframeId, attrs) {
    get()._updateCurrentShapes(shapes => shapes.map(s => s.id === shapeId ? { ...s, keyframes: (s.keyframes || []).map(kf => kf.id === keyframeId ? { ...kf, ...attrs } : kf) } : s))
  },

  deleteKeyframe(shapeId, keyframeId) {
    get()._snapshot()
    get()._updateCurrentShapes(shapes => shapes.map(s => s.id === shapeId ? { ...s, keyframes: (s.keyframes || []).filter(kf => kf.id !== keyframeId) } : s))
  },

  loadDesign({ shapes = [], canvasSize, pages, isPresentationMode } = {}) {
    let loadedPages
    if (Array.isArray(pages) && pages.length > 0) {
      loadedPages = pages
    } else {
      loadedPages = [{ id: uid(), label: 'Page 1', shapes: Array.isArray(shapes) ? shapes : [] }]
    }
    set({ pages: loadedPages, currentPageIndex: 0, canvasSize: canvasSize || { width: 1200, height: 800 }, isPresentationMode: isPresentationMode || false, history: [JSON.stringify(loadedPages)], historyIndex: 0, selectedId: null })
  },

  clearCanvas() {
    get()._snapshot()
    get()._updateCurrentShapes(() => [])
    set({ selectedId: null })
  },
}))
