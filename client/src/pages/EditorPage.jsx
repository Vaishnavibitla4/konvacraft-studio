import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Toolbar from "../components/toolbar/Toolbar";
import CanvasArea, { videoRegistry } from "../components/canvas/CanvasArea";
import PropertiesPanel from "../components/panels/PropertiesPanel";
import LayersPanel from "../components/panels/LayersPanel";
import AssetPanel from "../components/panels/AssetPanel";
import PagePanel from "../components/panels/PagePanel";
import { useEditorStore } from "../store/editorStore";
import api from "../lib/api";
import { toast } from "../components/Toast";
import { useAudioStore } from "../store/audioStore";
import AudioPlayerBar from "../components/AudioPlayerBar";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef();
  const store = useEditorStore();
  const {
    canvasSize,
    loadDesign,
    selectedId,
    setSelected,
    pages,
    currentPageIndex,
    isPresentationMode,
  } = store;
  const shapes = pages[currentPageIndex]?.shapes ?? [];

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState("Untitled Design");
  const [editingTitle, setEditingTitle] = useState(false);
  const [masterDuration, setMasterDuration] = useState(30);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/designs/${id}`);
        const design = res.data;
        setTitle(design.title || "Untitled Design");
        const canvas = design.canvas_json || {};

        loadDesign({
          shapes: Array.isArray(canvas.shapes) ? canvas.shapes : [],
          canvasSize: canvas.canvasSize || { width: 1200, height: 800 },
          pages: Array.isArray(canvas.pages) ? canvas.pages : undefined,
          isPresentationMode: canvas.isPresentationMode || false,
        });
        const savedAudio = canvas.audioTracks || canvas.audioTrack;
        if (savedAudio) {
          setTimeout(() => useAudioStore.getState().restore(savedAudio), 0);
        }
      } catch (err) {
        console.error("Failed to load design", err);
      }
    }
    load();
  }, [id, loadDesign]);

  const audioStore = useAudioStore();
  useEffect(() => {
    return () => audioStore.cleanup();
  }, []);

  const handleSave = useCallback(
    async (silent = false) => {
      if (!silent) setSaving(true);
      try {
        const currentStore = useEditorStore.getState();
        const allPages = currentStore.pages.map((page) => ({
          ...page,
          shapes: page.shapes.map((shape) =>
            shape.type === "video" ? { ...shape, isPlaying: false } : shape,
          ),
        }));
        const cIdx = currentStore.currentPageIndex;
        const cSize = currentStore.canvasSize;
        const isPM = currentStore.isPresentationMode;

        let thumbnail_url;
        const stage = stageRef.current;
        if (stage) {
          try {
            const cw = cSize?.width || 1200;
            const ch = cSize?.height || 800;
            const thumbRatio = 0.4;

            const prevX = stage.x();
            const prevY = stage.y();
            const prevScale = stage.scaleX();
            stage.position({ x: 0, y: 0 });
            stage.scale({ x: 1, y: 1 });

            const baseDataURL = stage.toDataURL({
              x: 0,
              y: 0,
              width: cw,
              height: ch,
              pixelRatio: thumbRatio,
              mimeType: "image/jpeg",
              quality: 0.8,
            });

            stage.position({ x: prevX, y: prevY });
            stage.scale({ x: prevScale, y: prevScale });

            const currentPageShapes = allPages[cIdx]?.shapes || [];
            const videoShapes = currentPageShapes.filter(
              (s) => s.type === "video",
            );

            let dataURL = baseDataURL;

            if (videoShapes.length > 0) {
              const oc = document.createElement("canvas");
              const tw = Math.round(cw * thumbRatio);
              const th = Math.round(ch * thumbRatio);
              oc.width = tw;
              oc.height = th;
              const ctx = oc.getContext("2d");

              await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  ctx.drawImage(img, 0, 0, tw, th);
                  resolve();
                };
                img.src = baseDataURL;
              });

              for (const shape of videoShapes) {
                const v = videoRegistry.get(shape.id);
                if (v && v.readyState >= 2) {
                  ctx.save();
                  const sx = (shape.x / cw) * tw;
                  const sy = (shape.y / ch) * th;
                  const sw = (shape.width / cw) * tw;
                  const sh = (shape.height / ch) * th;
                  ctx.globalAlpha = shape.opacity ?? 1;
                  ctx.drawImage(v, sx, sy, sw, sh);
                  ctx.restore();
                }
              }
              dataURL = oc.toDataURL("image/jpeg", 0.8);
            }

            const thumbRes = await api.post("/assets/upload-dataurl", {
              dataURL,
              folder: "thumbnails",
            });
            thumbnail_url = thumbRes.data?.url;
          } catch (thumbErr) {
            console.warn("Thumbnail generation failed:", thumbErr);
          }
        }

        const currentAudio = useAudioStore.getState();
        await api.put(`/designs/${id}`, {
          title,
          canvas_json: {
            pages: allPages,
            shapes: allPages[cIdx]?.shapes || [],
            canvasSize: cSize,
            isPresentationMode: isPM,
            audioTracks: currentAudio.serialise(),
            audioTrack: null,
          },
          thumbnail_url,
        });

        if (!silent) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          toast.success("Design saved!");
        }
      } catch (err) {
        console.error("Save failed", err);
        if (!silent) toast.error("Save failed. Please try again.");
      } finally {
        if (!silent) setSaving(false);
      }
    },
    [id, title],
  );

  const hasUnsavedRef = useRef(false);
  useEffect(() => {
    hasUnsavedRef.current = true;
  }, [shapes, pages, title]);

  useEffect(() => {
    const t = setInterval(() => {
      if (hasUnsavedRef.current) {
        handleSave(true).then(() => {
          hasUnsavedRef.current = false;
        });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [handleSave]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedRef.current) {
        handleSave(true);
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleSave]);

  const isPresentation = isPresentationMode || canvasSize?.width === 1920;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "#111118" }}
    >
      <style>{`
        @keyframes fadeInDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .editor-nav { background: rgba(15,12,28,0.97); backdrop-filter: blur(16px); }
        .saved-badge { animation: fadeInDown 0.3s ease both; }
      `}</style>

      {/* Top nav */}
      <div className="editor-nav h-11 border-b border-white/10 flex items-center px-4 gap-3 shrink-0 z-30 shadow-xl">
        <button
          onClick={async () => {
            if (hasUnsavedRef.current) {
              try {
                await handleSave(true);
                hasUnsavedRef.current = false;
              } catch {}
            }
            navigate("/dashboard");
          }}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors font-medium px-2.5 py-1.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/10"
        >
          ← Dashboard
        </button>
        <div className="w-px h-5 bg-white/10" />

        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditingTitle(false);
            }}
            className="text-sm font-semibold outline-none px-2.5 py-1 rounded-lg w-56 text-white border border-violet-500/60"
            style={{ background: "rgba(124,58,237,0.15)" }}
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors max-w-xs truncate border border-transparent hover:border-white/10"
            title="Click to rename"
          >
            {title}
          </button>
        )}

        {isPresentation && (
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold text-violet-300 border border-violet-500/40 uppercase tracking-wider"
            style={{ background: "rgba(124,58,237,0.15)" }}
          >
            Presentation · {pages.length}{" "}
            {pages.length === 1 ? "slide" : "slides"}
          </span>
        )}

        {saving && (
          <span className="text-xs text-white/40 flex items-center gap-1.5 ml-1">
            <span className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
            Saving…
          </span>
        )}
        {saved && !saving && (
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 ml-1 saved-badge">
            ✓ Saved
          </span>
        )}

        <div className="flex-1" />

        <div className="hidden xl:flex items-center gap-3 text-[10px] text-white/25">
          {[
            ["Ctrl+Z", "Undo"],
            ["Ctrl+0", "Fit"],
            ["Del", "Delete"],
            ["V", "Select"],
          ].map(([k, l]) => (
            <span key={k}>
              <kbd className="bg-white/10 border border-white/15 rounded px-1 py-0.5 font-mono">
                {k}
              </kbd>{" "}
              {l}
            </span>
          ))}
        </div>

        {selectedId && (
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Esc
          </button>
        )}
      </div>

      {/* Toolbar */}
      <Toolbar
        stageRef={stageRef}
        onSave={() => handleSave(false)}
        saving={saving}
        designId={id}
        designTitle={title}
      />

      {/* Main editor layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: AssetPanel + LayersPanel */}
        <div className="flex shrink-0 h-full">
          <AssetPanel />
          <LayersPanel />
        </div>

        {/* Canvas area with built-in video timeline */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <CanvasArea
            stageRef={stageRef}
            onDurationChange={setMasterDuration}
          />
          <AudioPlayerBar
            isPresentation={isPresentation}
            masterDuration={masterDuration}
          />
        </div>

        {/* Right panels */}
        <div className="flex shrink-0 h-full">
          {/* Page panel for presentations */}
          {isPresentation && (
            <div
              className="shrink-0 border-l border-white/10 overflow-hidden flex flex-col"
              style={{ animation: "fadeIn 0.2s ease both" }}
            >
              <PagePanel stageRef={stageRef} />
            </div>
          )}

          {/* Properties panel */}
          {selectedId && (
            <div
              className="w-72 shrink-0 border-l border-white/10 overflow-hidden flex flex-col"
              style={{
                background: "rgba(15,12,28,0.97)",
                animation: "fadeIn 0.2s ease both",
              }}
            >
              <PropertiesPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
