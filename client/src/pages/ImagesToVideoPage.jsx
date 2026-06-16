import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAudioStore } from "../store/audioStore";
import { useEditorStore } from "../store/editorStore";
import AssetPanel from "../components/panels/AssetPanel";
import AudioPlayerBar from "../components/AudioPlayerBar";
import { toast } from "../components/Toast";
import api from "../lib/api";

const TRANSITIONS = [
  { id: "none", label: "None", icon: "✕" },
  { id: "fade", label: "Fade", icon: "🌫" },
  { id: "dissolve", label: "Dissolve", icon: "💧" },
  { id: "slideLeft", label: "Slide ←", icon: "←" },
  { id: "slideRight", label: "Slide →", icon: "→" },
  { id: "slideUp", label: "Slide ↑", icon: "↑" },
  { id: "slideDown", label: "Slide ↓", icon: "↓" },
  { id: "zoomIn", label: "Zoom In", icon: "🔍" },
  { id: "zoomOut", label: "Zoom Out", icon: "🔎" },
  { id: "wipe", label: "Wipe", icon: "▶" },
  { id: "rotate", label: "Rotate", icon: "🔄" },
  { id: "kenBurns", label: "Ken Burns", icon: "🎥" },
];

const FILTERS = [
  { id: "none", label: "Original", css: "" },
  { id: "vivid", label: "Vivid", css: "saturate(1.9) contrast(1.1)" },
  {
    id: "cinematic",
    label: "Cinematic",
    css: "contrast(1.25) saturate(0.8) sepia(0.18)",
  },
  {
    id: "warm",
    label: "Warm",
    css: "sepia(0.35) saturate(1.4) brightness(1.05)",
  },
  { id: "cool", label: "Cool", css: "hue-rotate(25deg) saturate(1.25)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.4)" },
  {
    id: "vintage",
    label: "Vintage",
    css: "sepia(0.55) saturate(0.75) contrast(1.15)",
  },
  {
    id: "golden",
    label: "Golden",
    css: "sepia(0.45) saturate(1.6) brightness(1.1)",
  },
  { id: "dreamy", label: "Dreamy", css: "saturate(1.5) brightness(1.12)" },
  {
    id: "matte",
    label: "Matte",
    css: "contrast(0.85) saturate(0.9) brightness(1.05)",
  },
];

const ANIMATIONS = [
  { id: "none", label: "None" },
  { id: "kenBurns", label: "Ken Burns" },
  { id: "zoomIn", label: "Zoom In" },
  { id: "zoomOut", label: "Zoom Out" },
  { id: "slideLeft", label: "Slide Left" },
  { id: "slideRight", label: "Slide Right" },
  { id: "fadeIn", label: "Fade In" },
  { id: "rotateIn", label: "Rotate In" },
];

const RESOLUTIONS = [
  { label: "1920×1080 (Full HD)", w: 1920, h: 1080 },
  { label: "1280×720 (HD)", w: 1280, h: 720 },
  { label: "1080×1080 (Square)", w: 1080, h: 1080 },
  { label: "1080×1920 (Reel)", w: 1080, h: 1920 },
];

const CLIP_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#16a34a",
  "#9333ea",
  "#ea580c",
];

const TRANS_DUR = 0.5;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function fmt(t) {
  if (!isFinite(t) || t < 0) return "0:00";
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

function renderTransitionFrame(ctx, img1, img2, progress, transition, w, h) {
  const p = Math.max(0, Math.min(1, progress));
  ctx.clearRect(0, 0, w, h);
  switch (transition) {
    case "fade":
    case "dissolve":
      if (img1) {
        ctx.globalAlpha = 1;
        ctx.drawImage(img1, 0, 0, w, h);
      }
      if (img2) {
        ctx.globalAlpha = p;
        ctx.drawImage(img2, 0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      break;
    case "slideLeft":
      if (img1) ctx.drawImage(img1, -w * p, 0, w, h);
      if (img2) ctx.drawImage(img2, w * (1 - p), 0, w, h);
      break;
    case "slideRight":
      if (img1) ctx.drawImage(img1, w * p, 0, w, h);
      if (img2) ctx.drawImage(img2, -w * (1 - p), 0, w, h);
      break;
    case "slideUp":
      if (img1) ctx.drawImage(img1, 0, -h * p, w, h);
      if (img2) ctx.drawImage(img2, 0, h * (1 - p), w, h);
      break;
    case "slideDown":
      if (img1) ctx.drawImage(img1, 0, h * p, w, h);
      if (img2) ctx.drawImage(img2, 0, -h * (1 - p), w, h);
      break;
    case "zoomIn": {
      const s = 1 + p * 0.4;
      if (img1) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(s, s);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(img1, 0, 0, w, h);
        ctx.restore();
      }
      if (img2) {
        ctx.globalAlpha = p;
        ctx.drawImage(img2, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "zoomOut": {
      const s2 = 1.4 - p * 0.4;
      if (img1) ctx.drawImage(img1, 0, 0, w, h);
      if (img2) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(s2, s2);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = p;
        ctx.drawImage(img2, 0, 0, w, h);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "wipe":
      if (img1) ctx.drawImage(img1, 0, 0, w, h);
      if (img2) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w * p, h);
        ctx.clip();
        ctx.drawImage(img2, 0, 0, w, h);
        ctx.restore();
      }
      break;
    case "rotate":
      if (img1) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(p * Math.PI * 0.5);
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(img1, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      if (img2) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((p - 1) * Math.PI * 0.5);
        ctx.globalAlpha = p;
        ctx.drawImage(img2, -w / 2, -h / 2, w, h);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      break;
    case "kenBurns":
    default:
      if (img1) {
        ctx.globalAlpha = 1;
        ctx.drawImage(img1, 0, 0, w, h);
      }
      if (img2) {
        ctx.globalAlpha = p;
        ctx.drawImage(img2, 0, 0, w, h);
      }
      ctx.globalAlpha = 1;
  }
}

function drawAnimated(ctx, img, progress, animation, w, h, filterCss) {
  if (!img) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.save();
  switch (animation) {
    case "kenBurns": {
      const sc = 1.08 + progress * 0.07,
        ox = -(w * (sc - 1)) * 0.4 * (1 - progress),
        oy = -(h * (sc - 1)) * 0.3 * (1 - progress);
      if (filterCss) {
        const tmp = Object.assign(document.createElement("canvas"), {
          width: w,
          height: h,
        });
        const tc = tmp.getContext("2d");
        tc.filter = filterCss;
        tc.drawImage(img, ox, oy, w * sc, h * sc);
        ctx.drawImage(tmp, 0, 0);
      } else {
        ctx.drawImage(img, ox, oy, w * sc, h * sc);
      }
      break;
    }
    case "zoomIn": {
      const s = 1 + progress * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      ctx.drawImage(img, 0, 0, w, h);
      break;
    }
    case "zoomOut": {
      const s2 = 1.12 - progress * 0.12;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s2, s2);
      ctx.translate(-w / 2, -h / 2);
      ctx.drawImage(img, 0, 0, w, h);
      break;
    }
    case "slideLeft": {
      ctx.translate(-w * progress * 0.08, 0);
      ctx.drawImage(img, 0, 0, w, h);
      break;
    }
    case "slideRight": {
      ctx.translate(w * progress * 0.08, 0);
      ctx.drawImage(img, 0, 0, w, h);
      break;
    }
    case "fadeIn": {
      ctx.globalAlpha = progress;
      ctx.drawImage(img, 0, 0, w, h);
      break;
    }
    case "rotateIn": {
      ctx.translate(w / 2, h / 2);
      ctx.rotate((1 - progress) * Math.PI * 0.08);
      ctx.globalAlpha = progress;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      break;
    }
    default: {
      if (filterCss) {
        const tmp2 = Object.assign(document.createElement("canvas"), {
          width: w,
          height: h,
        });
        const tc2 = tmp2.getContext("2d");
        tc2.filter = filterCss;
        tc2.drawImage(img, 0, 0, w, h);
        ctx.drawImage(tmp2, 0, 0);
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function TransitionPill({ transition, onClick }) {
  const t = TRANSITIONS.find((x) => x.id === transition) || TRANSITIONS[0];
  return (
    <button
      onClick={onClick}
      title={`Transition: ${t.label} — click to change`}
      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm z-10 transition-all hover:scale-110 border"
      style={{
        background:
          transition === "none"
            ? "rgba(255,255,255,0.06)"
            : "rgba(124,58,237,0.35)",
        borderColor:
          transition === "none"
            ? "rgba(255,255,255,0.1)"
            : "rgba(124,58,237,0.6)",
      }}
    >
      {t.icon}
    </button>
  );
}

function TransitionPicker({ value, onSelect, onClose }) {
  return (
    <div
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-white/15 shadow-2xl p-3"
      style={{
        background: "rgba(18,14,36,0.98)",
        width: 260,
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
          Transition
        </p>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {TRANSITIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.id);
              onClose();
            }}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all ${value === t.id ? "border-violet-500 bg-violet-950/50" : "border-white/8 hover:border-white/25 hover:bg-white/4"}`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="text-[8px] text-white/50 leading-tight">
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VideoTimeline({
  slides,
  selectedIdx,
  onSelectSlide,
  onUpdateSlide,
  onDeleteSlide,
  audioStore,
  isPlaying,
  playheadSec,
  totalDuration,
  onTogglePlay,
  onSeek,
}) {
  const timelineRef = useRef();
  const [openTransIdx, setOpenTransIdx] = useState(null);
  const progress =
    totalDuration > 0 ? Math.min(1, playheadSec / totalDuration) : 0;

  useEffect(() => {
    if (openTransIdx === null) return;
    const h = (e) => {
      if (!e.target.closest("[data-trans-picker]")) setOpenTransIdx(null);
    };
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [openTransIdx]);

  function clickScrubber(e) {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSeek(
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) *
        totalDuration,
    );
  }

  return (
    <div
      className="shrink-0 select-none"
      style={{
        background: "rgba(10,8,22,0.97)",
        borderTop: "1px solid rgba(124,58,237,0.25)",
      }}
    >
      {/* ── Transport bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-2">
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          disabled={!slides.length}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shrink-0 transition-all hover:scale-110 disabled:opacity-30"
          style={{
            background: isPlaying
              ? "rgba(236,72,153,0.75)"
              : "linear-gradient(135deg,#7c3aed,#6d28d9)",
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Timecode */}
        <span className="text-[10px] font-mono text-white/50 shrink-0 w-24">
          {fmt(playheadSec)} / {fmt(totalDuration)}
        </span>

        {/* Scrubber */}
        <div
          ref={timelineRef}
          className="flex-1 relative h-1.5 rounded-full cursor-pointer"
          style={{ background: "rgba(255,255,255,0.08)" }}
          onClick={clickScrubber}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full pointer-events-none"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg,#7c3aed,#ec4899)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white pointer-events-none"
            style={{
              left: `calc(${progress * 100}% - 6px)`,
              background: "#ec4899",
            }}
          />
        </div>

        <span className="text-[9px] text-white/30 shrink-0">
          {slides.length} clip{slides.length !== 1 ? "s" : ""}
          {audioStore.tracks?.length > 0
            ? ` · 🎵×${audioStore.tracks.length}`
            : ""}
        </span>
      </div>

      {/* ── Audio track lanes (multi-track) ───────────────────────────── */}
      {audioStore.tracks?.length > 0 && (
        <div
          className="flex flex-col gap-0.5 px-4 pb-1 border-t border-white/5"
          style={{ background: "rgba(16,185,129,0.04)" }}
        >
          {audioStore.tracks.map((t, i) => {
            const trackDur =
              (t.trimEnd ?? t.track?.duration ?? totalDuration) -
              (t.trimStart ?? 0);
            const offset = t.timelineOffset ?? 0;
            const leftPct =
              totalDuration > 0
                ? Math.min(100, (offset / totalDuration) * 100)
                : 0;
            const widthPct =
              totalDuration > 0
                ? Math.min(100 - leftPct, (trackDur / totalDuration) * 100)
                : 100;
            const trackColor =
              i % 2 === 0 ? "rgba(16,185,129," : "rgba(124,58,237,";
            return (
              <div
                key={t.track.id}
                className="flex items-center gap-3 pt-1 pb-0.5"
              >
                <span
                  className="text-[9px] font-bold shrink-0 w-12"
                  style={{ color: i % 2 === 0 ? "#34d399" : "#a78bfa" }}
                >
                  AUDIO {i + 1}
                </span>
                <div
                  className="flex-1 relative h-5 rounded-lg overflow-visible"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="absolute top-0 h-full rounded-lg flex items-center px-2 overflow-hidden"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 4)}%`,
                      background: `${trackColor}0.25)`,
                      border: `1px solid ${trackColor}0.55)`,
                    }}
                  >
                    <span
                      className="text-[8px] font-semibold truncate"
                      style={{ color: i % 2 === 0 ? "#6ee7b7" : "#c4b5fd" }}
                    >
                      🎵 {t.track.name || `Track ${i + 1}`}
                      {t.loop ? " 🔁" : ""}
                    </span>
                  </div>
                  {/* Playhead needle on audio row */}
                  <div
                    className="absolute top-0 h-full w-px pointer-events-none z-10"
                    style={{
                      left: `${progress * 100}%`,
                      background: "#ec4899",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Clip track lane ────────────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-1">
        {slides.length === 0 ? (
          <div className="h-14 rounded-lg border border-dashed border-white/10 flex items-center justify-center">
            <p className="text-[10px] text-white/20">
              Click images in the left panel to add slides
            </p>
          </div>
        ) : (
          <>
            <div className="relative h-14" data-timeline="1">
              {/* Clickable scrub bg */}
              <div
                className="absolute inset-0 cursor-pointer rounded-lg"
                style={{ background: "rgba(255,255,255,0.025)" }}
                onClick={clickScrubber}
              />

              {/* Clips + transition pills — flex, proportional widths */}
              <div className="relative w-full h-full flex items-center">
                {slides.map((slide, i) => (
                  <div
                    key={slide.id}
                    className="relative flex items-center h-full"
                    style={{ flex: slide.duration || 4, minWidth: 50 }}
                  >
                    {/* Transition pill BEFORE this clip */}
                    {i > 0 && (
                      <div className="relative shrink-0" data-trans-picker>
                        <TransitionPill
                          transition={slide.transitionIn || "none"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenTransIdx(openTransIdx === i ? null : i);
                          }}
                        />
                        {openTransIdx === i && (
                          <TransitionPicker
                            value={slide.transitionIn || "none"}
                            onSelect={(v) =>
                              onUpdateSlide(i, { transitionIn: v })
                            }
                            onClose={() => setOpenTransIdx(null)}
                          />
                        )}
                      </div>
                    )}

                    {/* Clip block */}
                    <div
                      onClick={() => onSelectSlide(i)}
                      className={`flex-1 h-12 rounded-lg overflow-hidden cursor-pointer border-2 transition-all group relative ${selectedIdx === i ? "shadow-lg" : "hover:brightness-110"}`}
                      style={{
                        borderColor:
                          selectedIdx === i
                            ? CLIP_COLORS[i % CLIP_COLORS.length]
                            : "transparent",
                        background: `${CLIP_COLORS[i % CLIP_COLORS.length]}28`,
                      }}
                    >
                      {/* Thumbnail */}
                      {slide.src && (
                        <img
                          src={slide.src}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
                          style={{
                            filter:
                              FILTERS.find((f) => f.id === slide.filter)?.css ||
                              "none",
                          }}
                        />
                      )}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `${CLIP_COLORS[i % CLIP_COLORS.length]}1a`,
                        }}
                      />

                      {/* Text */}
                      <div className="relative z-10 h-full flex flex-col justify-between p-1.5 overflow-hidden">
                        <span className="text-[8px] font-bold text-white drop-shadow truncate">
                          {slide.name || `Slide ${i + 1}`}
                        </span>
                        <span className="text-[8px] font-mono text-white/60">
                          {slide.duration || 4}s
                        </span>
                      </div>

                      {/* Delete on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSlide(i);
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-red-600/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      >
                        ✕
                      </button>

                      {/* Right-edge resize handle */}
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: `${CLIP_COLORS[i % CLIP_COLORS.length]}88`,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const startX = e.clientX,
                            startDur = slide.duration || 4;
                          const parentW =
                            e.currentTarget
                              .closest("[data-timeline]")
                              ?.getBoundingClientRect().width || 1;
                          const secPerPx = totalDuration / parentW;
                          const onMove = (mv) =>
                            onUpdateSlide(i, {
                              duration: Math.max(
                                1,
                                Math.round(
                                  (startDur +
                                    (mv.clientX - startX) * secPerPx) *
                                    2,
                                ) / 2,
                              ),
                            });
                          const onUp = () => {
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                      >
                        <div className="w-px h-5 rounded bg-white/60" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Playhead needle */}
              <div
                className="absolute top-0 h-full w-0.5 pointer-events-none z-30"
                style={{
                  left: `${progress * 100}%`,
                  background: "#ec4899",
                  boxShadow: "0 0 6px #ec4899",
                }}
              >
                <div
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 rotate-45"
                  style={{ background: "#ec4899" }}
                />
              </div>
            </div>

            {/* Time ruler */}
            <div className="flex justify-between mt-1 px-0.5">
              {Array.from({
                length: Math.min(10, Math.ceil(totalDuration) + 1),
              }).map((_, i) => {
                const t =
                  (totalDuration /
                    Math.max(1, Math.min(9, Math.ceil(totalDuration)))) *
                  i;
                return (
                  <span key={i} className="text-[8px] font-mono text-white/20">
                    {fmt(t)}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SlideProperties({
  slide,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveLeft,
  onMoveRight,
  globalDuration,
  globalFilter,
  globalAnimation,
  globalTransition,
  setGlobalDuration,
  setGlobalFilter,
  setGlobalAnimation,
  setGlobalTransition,
  onApplyGlobal,
}) {
  if (!slide)
    return (
      <div className="flex-1 flex items-center justify-center text-white/20 text-sm p-4 text-center">
        <div>
          <p className="text-3xl mb-2">🎞</p>
          <p>Select a slide or add images from the left panel</p>
        </div>
      </div>
    );

  const filterCss = FILTERS.find((f) => f.id === slide.filter)?.css || "";

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Slide {index + 1} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onMoveLeft(index)}
              disabled={index === 0}
              className="w-6 h-6 rounded text-white/30 hover:text-white hover:bg-white/10 text-xs disabled:opacity-20 transition-all"
            >
              ←
            </button>
            <button
              onClick={() => onMoveRight(index)}
              disabled={index === total - 1}
              className="w-6 h-6 rounded text-white/30 hover:text-white hover:bg-white/10 text-xs disabled:opacity-20 transition-all"
            >
              →
            </button>
            <button
              onClick={() => onDelete(index)}
              className="w-6 h-6 rounded text-white/30 hover:text-red-400 hover:bg-red-950/30 text-xs transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Thumbnail preview with filter */}
        <div
          className="aspect-video rounded-xl overflow-hidden border border-white/10"
          style={{ background: "#000" }}
        >
          {slide.src && (
            <img
              src={slide.src}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: filterCss || "none" }}
            />
          )}
        </div>

        {/* Duration */}
        <div>
          <div className="flex justify-between text-[11px] text-white/60 mb-2">
            <span className="font-semibold">Duration</span>
            <span className="font-mono text-violet-300">
              {slide.duration || 4}s
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={15}
            step={0.5}
            value={slide.duration || 4}
            onChange={(e) =>
              onUpdate(index, { duration: Number(e.target.value) })
            }
            className="w-full accent-violet-500"
          />
        </div>

        {/* Motion / animation */}
        <div>
          <p className="text-[11px] font-semibold text-white/60 mb-2">Motion</p>
          <div className="grid grid-cols-2 gap-1">
            {ANIMATIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => onUpdate(index, { animation: a.id })}
                className={`text-[10px] py-1.5 px-2 rounded-lg border text-left transition-all ${slide.animation === a.id ? "border-violet-500 bg-violet-950/50 text-violet-300" : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transition In */}
        <div>
          <p className="text-[11px] font-semibold text-white/60 mb-2">
            Transition In
          </p>
          <div className="grid grid-cols-3 gap-1">
            {TRANSITIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => onUpdate(index, { transitionIn: t.id })}
                className={`text-[9px] py-1.5 px-1 rounded-lg border text-center transition-all ${slide.transitionIn === t.id ? "border-violet-500 bg-violet-950/50 text-violet-300" : "border-white/8 text-white/40 hover:text-white/70"}`}
                title={t.label}
              >
                <span className="block text-sm leading-none mb-0.5">
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div>
          <p className="text-[11px] font-semibold text-white/60 mb-2">Filter</p>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <div
                key={f.id}
                onClick={() => onUpdate(index, { filter: f.id })}
                className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${slide.filter === f.id ? "border-violet-500" : "border-white/10 hover:border-white/30"}`}
                style={{ width: 46 }}
              >
                {slide.src ? (
                  <img
                    src={slide.src}
                    alt=""
                    className="w-full h-7 object-cover"
                    style={{ filter: f.css || "none" }}
                  />
                ) : (
                  <div
                    className="w-full h-7"
                    style={{ background: "#333", filter: f.css || "none" }}
                  />
                )}
                <p className="text-[8px] text-center py-0.5 text-white/40 truncate px-0.5">
                  {f.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Apply to all */}
        <div className="border-t border-white/8 pt-4 space-y-3">
          <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">
            Apply to All Slides
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-white/35 block mb-1">
                Duration
              </label>
              <select
                value={globalDuration}
                onChange={(e) => setGlobalDuration(Number(e.target.value))}
                className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 15].map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-white/35 block mb-1">
                Transition
              </label>
              <select
                value={globalTransition}
                onChange={(e) => setGlobalTransition(e.target.value)}
                className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white"
              >
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-white/35 block mb-1">
                Motion
              </label>
              <select
                value={globalAnimation}
                onChange={(e) => setGlobalAnimation(e.target.value)}
                className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white"
              >
                {ANIMATIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-white/35 block mb-1">
                Filter
              </label>
              <select
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white"
              >
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onApplyGlobal}
            className="w-full py-2 rounded-xl text-[11px] font-bold text-white hover:brightness-110 transition-all"
            style={{ background: "linear-gradient(90deg,#7c3aed,#ec4899)" }}
          >
            Apply to All Slides
          </button>
        </div>
      </div>
    </div>
  );
}

function useAssetIntercept(onImageAdded) {
  const store = useEditorStore();
  useEffect(() => {
    const orig = store.addShape;
    store.addShape = (shape) => {
      if (shape?.type === "image" && shape?.src) {
        const name =
          shape.src
            .split("/")
            .pop()
            .split("?")[0]
            .replace(/\.[^.]+$/, "") || "Image";
        onImageAdded({ src: shape.src, name });
      }
    };
    return () => {
      store.addShape = orig;
    };
  }, [onImageAdded]);
}

export default function ImagesToVideoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const audioStore = useAudioStore();

  const [slides, setSlides] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [globalDuration, setGlobalDuration] = useState(4);
  const [globalFilter, setGlobalFilter] = useState("none");
  const [globalAnimation, setGlobalAnimation] = useState("kenBurns");
  const [globalTransition, setGlobalTransition] = useState("fade");

  const [resolution, setResolution] = useState(RESOLUTIONS[1]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const rafRef = useRef();
  const startTRef = useRef(null);
  const startSecRef = useRef(0);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const skipHistoryRef = useRef(false);

  const autosaveTimerRef = useRef(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef();

  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Untitled Video Design");
  const [exportProgress, setExportProgress] = useState("");

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    if (slides.length === 0) return;
    setHistory((h) => [...h.slice(-49), slides]);
    setFuture([]);
  }, [slides]);

  function undo() {
    setHistory((h) => {
      if (h.length < 2) return h;
      const prev = [...h];
      const current = prev.pop();
      const target = prev[prev.length - 1];
      skipHistoryRef.current = true;
      setSlides(target);
      setFuture((f) => [current, ...f]);
      return prev;
    });
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      skipHistoryRef.current = true;
      setSlides(next);
      setHistory((h) => [...h, next]);
      return rest;
    });
  }

  useEffect(() => {
    function onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!id || slides.length === 0) return;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        await doSave();
        setLastSaved(new Date());
      } catch {
        /* silent */
      } finally {
        setAutoSaving(false);
      }
    }, 3000);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [slides, title, resolution, id]);

  const previewCanvasRef = useRef();

  const totalDuration =
    slides.reduce((t, s) => t + (s.duration || 4), 0) +
    Math.max(0, slides.length - 1) * TRANS_DUR;
  const sel = slides[selectedIdx] ?? null;

  const handleImageAdded = useCallback(
    ({ src, name }) => {
      setSlides((prev) => {
        const ns = [
          ...prev,
          {
            id: uid(),
            src,
            name,
            duration: globalDuration,
            transitionIn: globalTransition,
            animation: globalAnimation,
            filter: globalFilter,
          },
        ];
        setSelectedIdx(ns.length - 1);
        return ns;
      });
    },
    [globalDuration, globalTransition, globalAnimation, globalFilter],
  );

  useAssetIntercept(handleImageAdded);

  useEffect(() => () => audioStore.cleanup(), []);

  useEffect(() => {
    if (!id) return;

    async function loadDesign() {
      try {
        const res = await api.get(`/designs/${id}`);

        const design = res.data;

        const canvas = design?.canvas_json || {};

        const isVideoTemplate =
          canvas?.isImagesToVideo === true ||
          canvas?.templateType === "images-to-video";

        if (!isVideoTemplate) {
          toast.error("This is not an Images-to-Video design");

          navigate("/dashboard");

          return;
        }

        setTitle(design.title || "Untitled Video Design");

        if (canvas.canvasSize) {
          setResolution({
            label: `${canvas.canvasSize.width}×${canvas.canvasSize.height}`,
            w: canvas.canvasSize.width || 1280,
            h: canvas.canvasSize.height || 720,
          });
        }

        let restoredSlides = [];
        if (Array.isArray(canvas.pages) && canvas.pages.length > 0) {
          const restoredSlides = canvas.pages

            .filter(
              (page) => Array.isArray(page?.shapes) && page.shapes.length > 0,
            )

            .map((page, index) => {
              const shape = page.shapes[0];

              return {
                id: page.id || crypto.randomUUID(),

                src: shape?.src || "",

                name: shape?.name || page.label || `Slide ${index + 1}`,

                duration: page.duration || 4,

                transitionIn: page.transitionIn || "fade",

                animation: shape?.animation || "none",

                filter: shape?.filter || "none",
              };
            });

          setSlides(restoredSlides);
        }

        if (typeof canvas.currentPageIndex === "number") {
          setSelectedIdx(
            Math.max(
              0,
              Math.min(canvas.currentPageIndex || 0, restoredSlides.length - 1),
            ),
          );
        }

        const savedAudio = canvas.audioTracks || canvas.audioTrack;
        if (savedAudio) {
          setTimeout(() => {
            useAudioStore.getState().restore(savedAudio);
          }, 0);
        }
      } catch (err) {
        console.error(err);

        toast.error("Failed to load design");
      }
    }

    loadDesign();
  }, [id, navigate]);

  function updateSlide(idx, updates) {
    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)),
    );
  }
  function deleteSlide(idx) {
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx((i) => Math.max(0, Math.min(i, slides.length - 2)));
  }
  function moveSlide(from, to) {
    if (to < 0 || to >= slides.length) return;
    setSlides((prev) => {
      const a = [...prev];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
    setSelectedIdx(to);
  }
  function applyGlobal() {
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        duration: globalDuration,
        filter: globalFilter,
        animation: globalAnimation,
        transitionIn: globalTransition,
      })),
    );
    toast.success("Applied to all slides");
  }

  async function doSave(currentTitle = title) {
    const pages = slides.map((slide, index) => ({
      id: slide.id || crypto.randomUUID(),
      label: slide.name || `Slide ${index + 1}`,
      duration: slide.duration || 4,
      transitionIn: slide.transitionIn || "fade",
      shapes: [
        {
          id: `shape-${slide.id || index}`,
          type: "image",
          src: slide.src,
          name: slide.name,
          animation: slide.animation || "none",
          filter: slide.filter || "none",
          x: 0,
          y: 0,
          width: resolution.w,
          height: resolution.h,
          rotation: 0,
          opacity: 1,
          objectFit: "cover",
        },
      ],
    }));

    const canvas_json = {
      pages,
      canvasSize: { width: resolution.w, height: resolution.h },
      isPresentationMode: false,
      isImagesToVideo: true,
      currentPageIndex: selectedIdx,
      templateType: "images-to-video",
      audioTracks:
        audioStore.tracks?.length > 0 ? audioStore.serialise() : null,
      audioTrack: null,
    };

    const thumbnail_url = slides[0]?.src || null;

    if (id) {
      await api.put(`/designs/${id}`, {
        title: currentTitle,
        canvas_json,
        thumbnail_url,
      });
    } else {
      const res = await api.post("/designs", {
        title: currentTitle,
        canvas_json,
        thumbnail_url,
      });
      navigate(`/images-to-video/${res.data.id}`);
    }
  }

  async function saveDesign() {
    try {
      setSaving(true);
      await doSave();
      toast.success("Design saved!");
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function commitTitleRename(newTitle) {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === title) {
      setEditingTitle(false);
      return;
    }
    setTitle(trimmed);
    setEditingTitle(false);
    if (id) {
      try {
        await api.put(`/designs/${id}`, { title: trimmed });
      } catch {
        /* silent */
      }
    }
  }

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      if (!isPlayingRef.current) return;
      const cur = startSecRef.current + (Date.now() - startTRef.current) / 1000;
      if (cur >= totalDuration) {
        setPlayheadSec(totalDuration);
        setIsPlaying(false);
        audioStore.pauseAll();
        setTimeout(() => setPlayheadSec(0), 400);
        return;
      }
      setPlayheadSec(cur);
      audioStore.syncToPlayhead(cur);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, totalDuration]);

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      audioStore.pauseAll();
    } else {
      const atEnd = playheadSec >= totalDuration - 0.05;
      const start = atEnd ? 0 : playheadSec;
      if (atEnd) setPlayheadSec(0);
      audioStore.pauseAll();
      audioStore.seekAllToPlayhead(start);
      startTRef.current = Date.now();
      startSecRef.current = start;
      setIsPlaying(true);
    }
  }

  function seekTo(sec) {
    const s = Math.max(0, Math.min(totalDuration, sec));
    setPlayheadSec(s);
    startTRef.current = Date.now();
    startSecRef.current = s;
    audioStore.seekAllToPlayhead(s);
    if (!isPlaying) audioStore.pauseAll();
  }

  const loadedImagesRef = useRef({});

  useEffect(() => {
    if (!slides.length) return;

    let cancelled = false;

    async function preload() {
      const entries = await Promise.all(
        slides.map((slide) => {
          return new Promise((resolve) => {
            if (loadedImagesRef.current[slide.src]) {
              resolve([slide.src, loadedImagesRef.current[slide.src]]);
              return;
            }

            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
              loadedImagesRef.current[slide.src] = img;
              resolve([slide.src, img]);
            };

            img.onerror = () => {
              resolve([slide.src, null]);
            };

            img.src = slide.src;
          });
        }),
      );

      if (cancelled) return;

      drawFrame();
    }

    function drawFrame() {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const { w, h } = resolution;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");

      let elapsed = 0;
      let slideIdx = 0;

      for (let i = 0; i < slides.length; i++) {
        const dur = slides[i].duration || 4;
        const transDur = i < slides.length - 1 ? TRANS_DUR : 0;

        if (playheadSec < elapsed + dur) {
          slideIdx = i;
          break;
        }

        elapsed += dur;

        if (playheadSec < elapsed + transDur) {
          const tp = (playheadSec - elapsed) / transDur;

          const img1 = loadedImagesRef.current[slides[i].src];

          const img2 = loadedImagesRef.current[slides[i + 1]?.src];

          renderTransitionFrame(
            ctx,
            img1,
            img2,
            tp,
            slides[i + 1]?.transitionIn || "fade",
            w,
            h,
          );

          return;
        }

        elapsed += transDur;
        slideIdx = Math.min(i + 1, slides.length - 1);
      }

      const slide = slides[slideIdx];

      if (!slide) return;

      const img = loadedImagesRef.current[slide.src];

      if (!img) return;

      const sp = Math.min(1, (playheadSec - elapsed) / (slide.duration || 4));

      const filterCss = FILTERS.find((f) => f.id === slide.filter)?.css || "";

      drawAnimated(ctx, img, sp, slide.animation, w, h, filterCss);
    }

    preload();

    return () => {
      cancelled = true;
    };
  }, [slides, playheadSec, resolution]);

  // ── Export video ───────────────────────────────────────────────────────
  async function exportVideo() {
    if (!slides.length) {
      toast.error("Add at least one image first");
      return;
    }
    setExporting(true);
    try {
      const { w, h } = resolution;
      const FPS = 30;
      setExportProgress("Loading images…");
      const imgs = await Promise.all(
        slides.map(
          (s) =>
            new Promise((res) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => res(img);
              img.onerror = () => res(null);
              img.src = s.src;
            }),
        ),
      );

      const oc = Object.assign(document.createElement("canvas"), {
        width: w,
        height: h,
      });
      const ctx = oc.getContext("2d");

      // ── Audio setup ─────────────────────────────────────────────────────
      // Each track is wired into a shared AudioContext mixer → MediaStream.
      // Audio is NEVER connected to speakers — only captured by the recorder.
      //
      // Key insight: the render loop tracks `rendered` (seconds of video rendered).
      // Each RAF tick calls syncExportAudio(rendered) which seeks/plays/pauses
      // each audio element exactly as syncToPlayhead() does during preview.
      // This replaces the old brittle setTimeout(offsetMs) approach.
      let audioCtx = null,
        audioDest = null;
      const exportAudioEls = []; // [{ el, trackState }, ...]

      const activeTracks = useAudioStore.getState().tracks || [];

      if (activeTracks.length > 0) {
        try {
          audioCtx = new AudioContext();
          audioDest = audioCtx.createMediaStreamDestination();

          for (const trackState of activeTracks) {
            if (!trackState.track?.src) continue;
            try {
              const el = new Audio();
              el.crossOrigin = "anonymous";
              el.src = trackState.track.src;
              el.volume = trackState.volume ?? 0.8;
              el.loop = false;
              el.muted = false;

              // Wait for full decode before starting recorder
              await new Promise((r) => {
                el.oncanplaythrough = r;
                el.onerror = r;
                el.load();
                setTimeout(r, 5000);
              });

              // Wire into AudioContext — silent to speakers, captured into stream
              const src = audioCtx.createMediaElementSource(el);
              src.connect(audioDest);

              // Park at trimStart; syncExportAudio will start it at the right moment
              el.currentTime = trackState.trimStart ?? 0;

              exportAudioEls.push({ el, trackState });
            } catch (trackErr) {
              console.warn(
                "Export: failed to load track",
                trackState.track?.name,
                trackErr,
              );
            }
          }

          setExportProgress(
            `Loaded ${exportAudioEls.length} audio track${exportAudioEls.length !== 1 ? "s" : ""}…`,
          );
        } catch (e) {
          console.warn("Export: AudioContext setup failed", e);
        }
      }

      // Frame-accurate audio sync — identical logic to audioStore.syncToPlayhead()
      // but operating on local export <audio> elements, not the store's live elements.
      function syncExportAudio(masterTimeSec) {
        for (const { el, trackState } of exportAudioEls) {
          const offset = trackState.timelineOffset ?? 0;
          const clipDur =
            (trackState.trimEnd ?? el.duration ?? 0) -
            (trackState.trimStart ?? 0);
          const clipEnd = offset + clipDur;
          const inWindow = masterTimeSec >= offset && masterTimeSec < clipEnd;

          if (inWindow) {
            const targetTime =
              (trackState.trimStart ?? 0) + (masterTimeSec - offset);
            // Seek if drift > 0.15s to maintain tight sync without constant seeking
            if (Math.abs(el.currentTime - targetTime) > 0.15) {
              el.currentTime = targetTime;
            }
            if (el.paused) el.play().catch(() => {});
          } else {
            if (!el.paused) el.pause();
            // Snap back to trimStart if we haven't reached this track yet
            if (masterTimeSec < offset) {
              el.currentTime = trackState.trimStart ?? 0;
            }
          }
        }
      }

      // ── MediaRecorder setup ────────────────────────────────────────────
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const stream = oc.captureStream(FPS);
      const combined = new MediaStream();
      stream.getVideoTracks().forEach((t) => combined.addTrack(t));
      if (audioDest)
        audioDest.stream.getAudioTracks().forEach((t) => combined.addTrack(t));

      const recorder = new MediaRecorder(combined, {
        mimeType: mime,
        videoBitsPerSecond: 16_000_000,
      });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Total export duration = max(slides duration, last audio track end)
      const slideDur =
        slides.reduce((t, s) => t + (s.duration || 4), 0) +
        Math.max(0, slides.length - 1) * TRANS_DUR;
      const maxAudioEnd = activeTracks.reduce((max, t) => {
        const clipDur =
          (t.trimEnd ?? t.track?.duration ?? 0) - (t.trimStart ?? 0);
        return Math.max(max, (t.timelineOffset ?? 0) + clipDur);
      }, 0);
      const totalExportDur = Math.max(slideDur, maxAudioEnd);

      recorder.onstop = () => {
        exportAudioEls.forEach(({ el }) => {
          try {
            el.pause();
            el.src = "";
          } catch {}
        });
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch {}
        }
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), {
          href: url,
          download: "images-to-video.webm",
        }).click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        setExporting(false);
        setExportProgress("");
        const nTracks = exportAudioEls.length;
        toast.success(
          `Exported ${Math.round(totalExportDur)}s video${nTracks > 0 ? ` · ${nTracks} audio track${nTracks !== 1 ? "s" : ""}` : ""}!`,
        );
      };

      recorder.start(100);

      // ── Render loop — draws video frames AND drives audio in sync ────────
      // `rendered` is the master clock. Every frame: draw the canvas, then
      // call syncExportAudio(rendered) so audio tracks play/pause/seek to
      // exactly match what the video is showing at that moment.
      await new Promise((resolve) => {
        let si = 0,
          se = 0,
          inT = false,
          te = 0,
          lastTs = null,
          rendered = 0;

        function tick(ts) {
          if (!lastTs) lastTs = ts;
          const dt = Math.min((ts - lastTs) / 1000, 0.1);
          lastTs = ts;
          rendered += dt;

          // ── Drive all audio tracks to match rendered time ──
          syncExportAudio(rendered);

          // ── Render the correct video frame ─────────────────
          const sli = slides[si];
          if (!sli) {
            resolve();
            return;
          }

          const i1 = imgs[si];
          const i2 = imgs[si + 1];
          const flt = FILTERS.find((f) => f.id === sli.filter)?.css || "";

          ctx.clearRect(0, 0, w, h);

          if (inT && i2) {
            te += dt;
            const tp = Math.min(1, te / TRANS_DUR);
            renderTransitionFrame(
              ctx,
              i1,
              i2,
              tp,
              slides[si + 1]?.transitionIn || "fade",
              w,
              h,
            );
            if (tp >= 1) {
              si++;
              inT = false;
              te = 0;
              se = 0;
              if (si >= slides.length) {
                resolve();
                return;
              }
            }
          } else {
            se += dt;
            const dur = sli.duration || 4;
            const sp = Math.min(1, se / dur);
            drawAnimated(ctx, i1, sp, sli.animation, w, h, flt);
            if (se >= dur) {
              if (si + 1 < slides.length) {
                inT = true;
                te = 0;
                se = 0;
              } else {
                resolve();
                return;
              }
            }
          }

          if (Math.floor(rendered) !== Math.floor(rendered - dt)) {
            setExportProgress(
              `Rendering ${Math.round(rendered)} / ${Math.round(totalExportDur)}s…`,
            );
          }

          requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });

      recorder.stop();
    } catch (err) {
      console.error(err);
      toast.error("Export failed: " + err.message);
      setExporting(false);
      setExportProgress("");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col overflow-hidden text-white"
      style={{ background: "#0a0814" }}
    >
      <style>{`
        .itv-scroll::-webkit-scrollbar{width:4px;height:4px}
        .itv-scroll::-webkit-scrollbar-track{background:transparent}
        .itv-scroll::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.4);border-radius:4px}
      `}</style>

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <div
        className="h-12 border-b border-white/10 flex items-center px-3 gap-2 shrink-0"
        style={{ background: "rgba(15,12,28,0.97)" }}
      >
        {/* Back */}
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs text-white/50 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-all shrink-0"
        >
          ← Dashboard
        </button>
        <div className="w-px h-5 bg-white/10 shrink-0" />

        {/* 🎞 icon */}
        <span className="text-base shrink-0">🎞</span>

        {/* Inline editable title — same pattern as EditorPage */}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            autoFocus
            defaultValue={title}
            onBlur={(e) => commitTitleRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitleRename(e.target.value);
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="text-sm font-bold bg-transparent border-b border-violet-500 outline-none text-white min-w-0 max-w-[220px]"
            style={{ background: "transparent" }}
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
            className="text-sm font-bold text-white hover:text-violet-300 transition-colors truncate max-w-[220px] text-left"
          >
            {title}
          </button>
        )}

        {/* Slide count + duration */}
        <span className="text-[10px] text-white/30 shrink-0">·</span>
        <span className="text-[10px] text-white/40 shrink-0">
          {slides.length} slide{slides.length !== 1 ? "s" : ""}
        </span>
        {totalDuration > 0 && (
          <>
            <span className="text-[10px] text-white/30 shrink-0">·</span>
            <span className="text-[10px] text-white/40 shrink-0">
              {fmt(totalDuration)}
            </span>
          </>
        )}

        <div className="flex-1" />

        {/* Autosave indicator */}
        {autoSaving && (
          <span className="text-[10px] text-white/30 shrink-0 flex items-center gap-1">
            <span className="w-2 h-2 border border-white/30 border-t-transparent rounded-full animate-spin inline-block" />
            Saving…
          </span>
        )}
        {!autoSaving && lastSaved && (
          <span className="text-[10px] text-white/25 shrink-0">
            Saved{" "}
            {lastSaved.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={undo}
            disabled={history.length < 2}
            title="Undo (Ctrl+Z)"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm"
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Redo (Ctrl+Y)"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm"
          >
            ↪
          </button>
        </div>

        <div className="w-px h-5 bg-white/10 shrink-0" />

        {/* Resolution — always visible with solid background */}
        <select
          value={`${resolution.w}x${resolution.h}`}
          onChange={(e) => {
            const r = RESOLUTIONS.find(
              (r) => `${r.w}x${r.h}` === e.target.value,
            );
            if (r) setResolution(r);
          }}
          className="text-xs rounded-lg px-2 py-1.5 text-white shrink-0 cursor-pointer outline-none focus:ring-1 focus:ring-violet-500"
          style={{
            background: "rgba(124,58,237,0.25)",
            border: "1px solid rgba(124,58,237,0.45)",
          }}
        >
          {RESOLUTIONS.map((r) => (
            <option
              key={r.label}
              value={`${r.w}x${r.h}`}
              style={{ background: "#1a0a2e" }}
            >
              {r.label}
            </option>
          ))}
        </select>

        {/* Manual save */}
        <button
          onClick={saveDesign}
          disabled={saving || !slides.length}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white hover:brightness-110 transition-all disabled:opacity-40 shrink-0"
          style={{ background: "linear-gradient(90deg,#2563eb,#06b6d4)" }}
        >
          {saving ? "Saving…" : "💾 Save"}
        </button>

        {/* Export */}
        <button
          onClick={exportVideo}
          disabled={exporting || !slides.length}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white hover:brightness-110 transition-all disabled:opacity-40 shrink-0"
          style={{ background: "linear-gradient(90deg,#7c3aed,#ec4899)" }}
        >
          {exporting ? `⏳ ${exportProgress || "Exporting…"}` : "⬇ Export"}
        </button>
      </div>

      {/* ── Main 3-column layout ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: existing AssetPanel — completely unchanged ──────────── */}
        {/* Images tab: clicking adds slide via useAssetIntercept            */}
        {/* Audio tab: clicking sets audioStore.track (shown in timeline)   */}
        <AssetPanel />

        {/* ── Center: canvas preview + timeline ────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Canvas preview area */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden relative"
            style={{
              background:
                "radial-gradient(ellipse at center, #1a1230 0%, #0a0814 100%)",
            }}
          >
            {slides.length === 0 ? (
              <div className="text-center text-white/20 pointer-events-none select-none px-8">
                <p className="text-6xl mb-4">🎞</p>
                <p className="text-lg font-semibold">
                  Click images in the left panel to add slides
                </p>
                <p className="text-sm mt-2 text-white/15">
                  Use the Images tab to browse uploads or search online · Audio
                  tab for background music
                </p>
              </div>
            ) : (
              <div
                className="relative rounded-xl overflow-hidden shadow-2xl border border-white/10"
                style={{
                  maxWidth: "85%",
                  maxHeight: "85%",
                  aspectRatio: `${resolution.w}/${resolution.h}`,
                  width: "100%",
                }}
              >
                <canvas ref={previewCanvasRef} className="w-full h-full" />
                {isPlaying && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-lg px-2.5 py-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-white font-semibold">
                      PREVIEW
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Export overlay */}
            {exporting && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ background: "rgba(10,8,20,0.88)" }}
              >
                <div className="w-14 h-14 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin mb-4" />
                <p className="text-sm font-semibold text-white mb-1">
                  Rendering video…
                </p>
                <p className="text-xs text-white/50 max-w-xs text-center">
                  {exportProgress}
                </p>
                <p className="text-[10px] text-white/25 mt-3">
                  Do not close this tab
                </p>
              </div>
            )}
          </div>

          {/* AudioPlayerBar — shows trimming/offset controls for each audio track */}
          <AudioPlayerBar masterDuration={totalDuration} />

          {/* Canva-style timeline — play button, scrubber, clip lanes, audio lanes */}
          <VideoTimeline
            slides={slides}
            selectedIdx={selectedIdx}
            onSelectSlide={setSelectedIdx}
            onUpdateSlide={updateSlide}
            onDeleteSlide={deleteSlide}
            audioStore={audioStore}
            isPlaying={isPlaying}
            playheadSec={playheadSec}
            totalDuration={totalDuration}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
          />
        </div>

        {/* ── Right: slide properties ───────────────────────────────────── */}
        <div
          className="w-72 shrink-0 border-l border-white/8 flex flex-col overflow-hidden"
          style={{ background: "rgba(12,9,24,0.98)" }}
        >
          <SlideProperties
            slide={sel}
            index={selectedIdx}
            total={slides.length}
            onUpdate={updateSlide}
            onDelete={deleteSlide}
            onMoveLeft={(i) => moveSlide(i, i - 1)}
            onMoveRight={(i) => moveSlide(i, i + 1)}
            globalDuration={globalDuration}
            globalFilter={globalFilter}
            globalAnimation={globalAnimation}
            globalTransition={globalTransition}
            setGlobalDuration={setGlobalDuration}
            setGlobalFilter={setGlobalFilter}
            setGlobalAnimation={setGlobalAnimation}
            setGlobalTransition={setGlobalTransition}
            onApplyGlobal={applyGlobal}
          />
        </div>
      </div>
    </div>
  );
}
