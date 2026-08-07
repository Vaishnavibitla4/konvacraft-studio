import { useRef, useEffect, useCallback, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Ellipse,
  Text,
  Line,
  RegularPolygon,
  Star,
  Arrow,
  Image as KonvaImage,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { useEditorStore } from "../../store/editorStore";
import { useAudioStore } from "../../store/audioStore";

export const videoRegistry = new Map();
function ImageShape({ shape, isSelected, onSelect, onChange }) {
  const [image] = useImage(shape.src, "anonymous");
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    const node = shapeRef.current;
    if (!node || !image) return;
    const filters = [];
    if ((shape.brightness ?? 0) !== 0) filters.push(Konva.Filters.Brighten);
    if ((shape.contrast ?? 0) !== 0) filters.push(Konva.Filters.Contrast);
    if ((shape.blurRadius ?? 0) > 0) filters.push(Konva.Filters.Blur);
    if (shape.grayscale) filters.push(Konva.Filters.Grayscale);
    node.filters(filters);
    node.clearCache();
    if (filters.length > 0) node.cache();
    node.getLayer()?.batchDraw();
  }, [
    image,
    shape.brightness,
    shape.contrast,
    shape.blurRadius,
    shape.grayscale,
  ]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        scaleX={shape.scaleX ?? 1}
        scaleY={shape.scaleY ?? 1}
        rotation={shape.rotation || 0}
        opacity={shape.opacity ?? 1}
        cornerRadius={shape.cornerRadius || 0}
        visible={shape.visible !== false}
        brightness={shape.brightness ?? 0}
        contrast={shape.contrast ?? 0}
        blurRadius={shape.blurRadius ?? 0}
        draggable
        onClick={() => onSelect(shape.id)}
        onTap={() => onSelect(shape.id)}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          onChange(shape.id, { x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * node.scaleX()),
            height: Math.max(5, node.height() * node.scaleY()),
            rotation: node.rotation(),
            scaleX: 1,
            scaleY: 1,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          ignoreStroke
          centeredScaling={false}
          boundBoxFunc={(o, n) => (n.width < 5 || n.height < 5 ? o : n)}
        />
      )}
    </>
  );
}

function VideoShape({ shape, isSelected, onSelect, onChange }) {
  const shapeRef = useRef();
  const trRef = useRef();
  const videoRef = useRef(null);
  const animRef = useRef(null);
  const shapePropsRef = useRef(shape);
  useEffect(() => {
    shapePropsRef.current = shape;
  });

  if (!videoRef.current) {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.muted = false;
    videoRef.current = v;
  }

  useEffect(() => {
    videoRegistry.set(shape.id, videoRef.current);
    return () => {
      videoRegistry.delete(shape.id);
    };
  }, [shape.id]);

  useEffect(() => {
    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
      videoRegistry.delete(shape.id);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !shape.src) return;

    v.pause();
    v.src = shape.src;
    v.loop = false;
    v.muted = shape.muted === true;
    v.volume = v.muted ? 0 : (shape.volume ?? 1);
    v.playbackRate = shape.playbackRate ?? 1;
    v.currentTime = shape.trimStart ?? 0;

    const wireTrim = () => {
      v.ontimeupdate = () => {
        const s = shapePropsRef.current;
        const te = s.trimEnd != null ? s.trimEnd : v.duration;
        if (isFinite(te) && v.currentTime >= te) {
          v.pause();
          v.currentTime = s.trimStart ?? 0;
        }
      };
    };

    const handleCanPlay = () => {
      wireTrim();
      const layer = shapeRef.current?.getLayer();
      if (!layer) return;
      if (animRef.current) animRef.current.stop();

      animRef.current = new Konva.Animation(() => {
        const node = shapeRef.current;
        if (!node) return;
        const s = shapePropsRef.current;
        const filters = [];
        if ((s.brightness ?? 0) !== 0) filters.push(Konva.Filters.Brighten);
        if ((s.contrast ?? 0) !== 0) filters.push(Konva.Filters.Contrast);
        if ((s.blurRadius ?? 0) > 0) filters.push(Konva.Filters.Blur);
        if (s.grayscale) filters.push(Konva.Filters.Grayscale);
        if ((s.saturation ?? 0) !== 0) filters.push(Konva.Filters.HSL);

        if (filters.length > 0) {
          node.cache();
          node.filters(filters);
          if ((s.brightness ?? 0) !== 0) node.brightness(s.brightness);
          if ((s.contrast ?? 0) !== 0) node.contrast(s.contrast);
          if ((s.blurRadius ?? 0) > 0) node.blurRadius(s.blurRadius);
          if ((s.saturation ?? 0) !== 0) node.saturation(s.saturation);
        } else {
          if (node.filters()?.length) {
            node.clearCache();
            node.filters([]);
          }
        }
      }, layer);
      animRef.current.start();
    };

    v.addEventListener("loadeddata", handleCanPlay, { once: true });
    v.load();

    return () => {
      v.removeEventListener("loadeddata", handleCanPlay);
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      v.pause();
    };
  }, [shape.src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = shape.muted === true;
    if (!v.muted) v.volume = shape.volume ?? 1;
    v.playbackRate = shape.playbackRate ?? 1;
  }, [shape.muted, shape.volume, shape.playbackRate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.ontimeupdate = () => {
      const s = shapePropsRef.current;
      const te = s.trimEnd != null ? s.trimEnd : v.duration;
      if (isFinite(te) && v.currentTime >= te) {
        v.pause();
        v.currentTime = s.trimStart ?? 0;
      }
    };
    const ts = shape.trimStart ?? 0;
    const te =
      shape.trimEnd != null
        ? shape.trimEnd
        : isFinite(v.duration)
          ? v.duration
          : Infinity;
    if (v.currentTime < ts || (isFinite(te) && v.currentTime > te)) {
      v.currentTime = ts;
    }
  }, [shape.trimStart, shape.trimEnd]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={videoRef.current}
        listening
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        scaleX={shape.scaleX ?? 1}
        scaleY={shape.scaleY ?? 1}
        rotation={shape.rotation || 0}
        opacity={shape.opacity ?? 1}
        cornerRadius={shape.cornerRadius || 0}
        visible={shape.visible !== false}
        draggable
        onClick={() => onSelect(shape.id)}
        onTap={() => onSelect(shape.id)}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          onChange(shape.id, { x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(50, node.width() * node.scaleX()),
            height: Math.max(50, node.height() * node.scaleY()),
            rotation: node.rotation(),
            scaleX: 1,
            scaleY: 1,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          ignoreStroke
          centeredScaling={false}
          boundBoxFunc={(o, n) => (n.width < 80 || n.height < 80 ? o : n)}
        />
      )}
    </>
  );
}

function ShapeRenderer({ shape, isSelected, onSelect, onChange }) {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (shape.type === "image")
    return (
      <ImageShape
        shape={shape}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onChange}
      />
    );
  if (shape.type === "video")
    return (
      <VideoShape
        shape={shape}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onChange}
      />
    );

  const commonProps = {
    ...shape,
    visible: shape.visible !== false,
    draggable: true,
    onClick: () => onSelect(shape.id),
    onTap: () => onSelect(shape.id),
    onDragStart: (e) => {
      e.cancelBubble = true;
    },
    onDragEnd: (e) => {
      e.cancelBubble = true;
      onChange(shape.id, { x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: () => {
      const node = shapeRef.current;
      const sx = node.scaleX();
      const sy = node.scaleY();
      const polyTypes = ["circle", "triangle", "pentagon", "hexagon"];
      onChange(shape.id, {
        x: node.x(),
        y: node.y(),
        width:
          !polyTypes.includes(shape.type) &&
          shape.type !== "ellipse" &&
          shape.type !== "star"
            ? Math.max(5, node.width() * sx)
            : undefined,
        height:
          !polyTypes.includes(shape.type) &&
          shape.type !== "ellipse" &&
          shape.type !== "star"
            ? Math.max(5, node.height() * sy)
            : undefined,
        radius: polyTypes.includes(shape.type)
          ? Math.max(5, (shape.radius || 60) * sx)
          : undefined,
        radiusX:
          shape.type === "ellipse"
            ? Math.max(5, (shape.radiusX || 70) * sx)
            : undefined,
        radiusY:
          shape.type === "ellipse"
            ? Math.max(5, (shape.radiusY || 45) * sy)
            : undefined,
        outerRadius:
          shape.type === "star"
            ? Math.max(5, (shape.outerRadius || 65) * sx)
            : undefined,
        innerRadius:
          shape.type === "star"
            ? Math.max(5, (shape.innerRadius || 30) * sx)
            : undefined,
        rotation: node.rotation(),
        scaleX: 1,
        scaleY: 1,
      });
    },
  };

  const tr = isSelected && (
    <Transformer
      ref={trRef}
      rotateEnabled
      ignoreStroke
      centeredScaling={false}
      boundBoxFunc={(o, n) => (n.width < 5 || n.height < 5 ? o : n)}
    />
  );

  return (
    <>
      {shape.type === "rect" && <Rect ref={shapeRef} {...commonProps} />}
      {shape.type === "roundrect" && (
        <Rect
          ref={shapeRef}
          {...commonProps}
          cornerRadius={shape.cornerRadius || 14}
        />
      )}
      {shape.type === "circle" && <Circle ref={shapeRef} {...commonProps} />}
      {shape.type === "ellipse" && <Ellipse ref={shapeRef} {...commonProps} />}
      {shape.type === "triangle" && (
        <RegularPolygon ref={shapeRef} {...commonProps} sides={3} />
      )}
      {shape.type === "pentagon" && (
        <RegularPolygon ref={shapeRef} {...commonProps} sides={5} />
      )}
      {shape.type === "hexagon" && (
        <RegularPolygon ref={shapeRef} {...commonProps} sides={6} />
      )}
      {shape.type === "star" && (
        <Star
          ref={shapeRef}
          {...commonProps}
          numPoints={shape.numPoints || 5}
          innerRadius={shape.innerRadius || 30}
          outerRadius={shape.outerRadius || 65}
        />
      )}
      {shape.type === "arrow" && (
        <Arrow
          ref={shapeRef}
          {...commonProps}
          points={shape.points || [0, 0, 120, 0]}
          pointerLength={shape.pointerLength || 15}
          pointerWidth={shape.pointerWidth || 12}
        />
      )}
      {shape.type === "line" && (
        <Line
          ref={shapeRef}
          {...commonProps}
          points={shape.points || [0, 0, 120, 0]}
          dash={shape.dash || []}
        />
      )}
      {shape.type === "text" && (
        <Text
          ref={shapeRef}
          {...commonProps}
          onDblClick={() => {
            const text = prompt("Edit text:", shape.text);
            if (text !== null) onChange(shape.id, { text });
          }}
        />
      )}
      {tr}
    </>
  );
}

function VideoTimeline({ shapes, onDurationChange }) {
  const videoShapes = shapes.filter((s) => s.type === "video");
  const audioStore = useAudioStore();
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const timelineRef = useRef();
  const rafRef = useRef();
  const startTimeRef = useRef(null);
  const startSecRef = useRef(0);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (videoShapes.length === 0) {
      setTotalDuration(0);
      return;
    }

    const compute = () => {
      const maxDur = videoShapes.reduce((max, s) => {
        const v = videoRegistry.get(s.id);
        let dur =
          v && isFinite(v.duration) && v.duration > 0
            ? v.duration
            : (s.duration ?? 0);
        const clipStart = s.trimStart ?? 0;
        const clipEnd = s.trimEnd != null ? s.trimEnd : dur;
        return Math.max(max, clipEnd - clipStart);
      }, 0);
      const final = maxDur > 0 ? maxDur : 10;
      setTotalDuration(final);
      onDurationChange?.(final);
    };

    compute();
    const timer = setTimeout(compute, 1200);
    return () => clearTimeout(timer);
  }, [
    videoShapes.map((s) => s.id).join(","),
    videoShapes.map((s) => `${s.trimStart}-${s.trimEnd}`).join(","),
  ]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      if (!isPlayingRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const cur = startSecRef.current + elapsed;

      if (cur >= totalDuration) {
        setPlayheadSec(totalDuration);
        setIsPlaying(false);
        videoShapes.forEach((s) => {
          const v = videoRegistry.get(s.id);
          if (v) {
            v.pause();
            v.currentTime = s.trimStart ?? 0;
          }
        });
        audioStore.pauseAll?.();
        setTimeout(() => setPlayheadSec(0), 300);
        return;
      }
      setPlayheadSec(cur);
      audioStore.syncToPlayhead?.(cur);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, totalDuration]);

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      videoShapes.forEach((s) => {
        const v = videoRegistry.get(s.id);
        if (v) v.pause();
      });
      audioStore.pauseAll?.();
    } else {
      const atEnd = playheadSec >= totalDuration - 0.05;
      const startSec = atEnd ? 0 : playheadSec;
      if (atEnd) setPlayheadSec(0);

      videoShapes.forEach((s) => {
        const v = videoRegistry.get(s.id);
        if (!v) return;
        const seekTo = (s.trimStart ?? 0) + startSec;
        v.currentTime = seekTo;
        v.muted = s.muted === true;
        v.volume = v.muted ? 0 : (s.volume ?? 1);
        v.play().catch((err) =>
          console.warn("Play failed for shape", s.id, err),
        );
      });

      audioStore.seekAllToPlayhead?.(startSec);

      startTimeRef.current = Date.now();
      startSecRef.current = startSec;
      setIsPlaying(true);
    }
  }

  function seekTimeline(e) {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newSec = pct * totalDuration;
    setPlayheadSec(newSec);

    videoShapes.forEach((s) => {
      const v = videoRegistry.get(s.id);
      if (v) v.currentTime = (s.trimStart ?? 0) + newSec;
    });

    audioStore.seekAllToPlayhead?.(newSec);

    if (isPlaying) {
      startTimeRef.current = Date.now();
      startSecRef.current = newSec;
    }
  }

  if (videoShapes.length === 0) return null;

  const dur = totalDuration || 1;
  const progress = Math.min(1, playheadSec / dur);

  function fmt(t) {
    if (!isFinite(t) || t < 0) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const CLIP_COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626"];

  return (
    <div
      className="shrink-0 select-none"
      style={{
        background: "rgba(10,8,22,0.97)",
        borderTop: "1px solid rgba(124,58,237,0.3)",
      }}
    >
      {/* Transport row */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-1">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shrink-0 transition-all hover:scale-110 shadow-lg"
          style={{
            background: isPlaying
              ? "rgba(236,72,153,0.75)"
              : "linear-gradient(135deg,#7c3aed,#6d28d9)",
          }}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <span className="text-[10px] font-mono text-white/50 shrink-0 w-24">
          {fmt(playheadSec)} / {fmt(totalDuration)}
        </span>

        {/* Scrubber */}
        <div
          ref={timelineRef}
          className="flex-1 relative h-1.5 rounded-full cursor-pointer"
          style={{ background: "rgba(255,255,255,0.08)" }}
          onClick={seekTimeline}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full pointer-events-none"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg,#7c3aed,#ec4899)",
            }}
          />
          {/* Playhead dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white pointer-events-none"
            style={{
              left: `calc(${progress * 100}% - 6px)`,
              background: "#ec4899",
            }}
          />
        </div>

        <span className="text-[9px] text-white/30 shrink-0">
          {videoShapes.length} clip{videoShapes.length !== 1 ? "s" : ""}
          {audioStore.tracks?.length ? ` · 🎵 ${audioStore.tracks.length}` : ""}
        </span>
      </div>

      {/* Clip track lanes */}
      <div className="px-4 pb-2 space-y-1">
        {videoShapes.map((shape, i) => {
          const v = videoRegistry.get(shape.id);
          const dur2 =
            v && isFinite(v.duration) && v.duration > 0
              ? v.duration
              : (shape.duration ?? totalDuration);
          const clipStart = shape.trimStart ?? 0;
          const clipEnd = shape.trimEnd != null ? shape.trimEnd : dur2;
          const clipDur = clipEnd - clipStart;
          const left =
            totalDuration > 0 ? (clipStart / totalDuration) * 100 : 0;
          const width =
            totalDuration > 0 ? (clipDur / totalDuration) * 100 : 100;
          const color = CLIP_COLORS[i % CLIP_COLORS.length];
          const name =
            shape.src
              ?.split("/")
              .pop()
              ?.split("?")[0]
              ?.replace(/\.[^.]+$/, "") || `Clip ${i + 1}`;

          return (
            <div
              key={shape.id}
              className="relative h-6 rounded overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="absolute top-0 h-full rounded flex items-center px-2 overflow-hidden"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(2, width)}%`,
                  background: `${color}44`,
                  border: `1px solid ${color}77`,
                }}
              >
                <span
                  className="text-[9px] font-semibold truncate"
                  style={{ color }}
                >
                  {name}
                </span>
              </div>
              {/* Playhead needle */}
              <div
                className="absolute top-0 h-full w-0.5 pointer-events-none"
                style={{ left: `${progress * 100}%`, background: "#ec4899" }}
              />
            </div>
          );
        })}

        {audioStore.tracks?.map((t, i) => {
          const clipDur =
            (t.trimEnd ?? t.track.duration ?? 0) - (t.trimStart || 0);
          const offset = t.timelineOffset || 0;
          const dur2 = totalDuration || 1;
          const leftPct = Math.min(100, (offset / dur2) * 100);
          const widthPct = Math.min(100 - leftPct, (clipDur / dur2) * 100);
          const TRACK_COLORS = [
            "rgba(16,185,129,0.18)",
            "rgba(124,58,237,0.18)",
            "rgba(236,72,153,0.18)",
            "rgba(245,158,11,0.18)",
          ];
          const BORDER_COLORS = [
            "rgba(16,185,129,0.55)",
            "rgba(124,58,237,0.55)",
            "rgba(236,72,153,0.55)",
            "rgba(245,158,11,0.55)",
          ];
          const TEXT_COLORS = ["#6ee7b7", "#c4b5fd", "#f9a8d4", "#fcd34d"];
          return (
            <div
              key={t.track.id}
              className="relative h-6 rounded overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Block representing where this track sits in the timeline */}
              <div
                className="absolute top-0 h-full rounded flex items-center px-2 overflow-hidden"
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.max(2, widthPct)}%`,
                  background: TRACK_COLORS[i % TRACK_COLORS.length],
                  border: `1px solid ${BORDER_COLORS[i % BORDER_COLORS.length]}`,
                }}
              >
                <span
                  className="text-[9px] font-semibold truncate"
                  style={{ color: TEXT_COLORS[i % TEXT_COLORS.length] }}
                >
                  🎵 {t.track.name || `Audio ${i + 1}`}
                </span>
              </div>
              {/* Playhead needle */}
              <div
                className="absolute top-0 h-full w-0.5 pointer-events-none"
                style={{ left: `${progress * 100}%`, background: "#ec4899" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CanvasArea({ stageRef, onDurationChange }) {
  const store = useEditorStore();
  const shapes = store.pages[store.currentPageIndex]?.shapes ?? [];
  const {
    selectedId,
    setSelected,
    tool,
    addShape,
    updateShapeAndSnapshot,
    zoom,
    setZoom,
    stagePosition,
    setStagePosition,
    canvasSize,
  } = store;

  const containerRef = useRef();
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const isPanningRef = useRef(false);
  const lastPtrRef = useRef(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (hasCenteredRef.current || stageSize.width < 100) return;
    hasCenteredRef.current = true;
    const cw = canvasSize?.width || 1200;
    const ch = canvasSize?.height || 800;
    const fit = Math.min(
      (stageSize.width - 80) / cw,
      (stageSize.height - 80) / ch,
      1,
    );
    setZoom(fit);
    setStagePosition({
      x: (stageSize.width - cw * fit) / 2,
      y: (stageSize.height - ch * fit) / 2,
    });
  }, [stageSize]);

  const handleWheel = useCallback(
    (e) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      if (e.evt.ctrlKey || e.evt.metaKey) {
        const by = 1.08;
        const old = zoom;
        const ptr = stage.getPointerPosition();
        const mp = {
          x: (ptr.x - stagePosition.x) / old,
          y: (ptr.y - stagePosition.y) / old,
        };
        const next = Math.max(
          0.05,
          Math.min(5, e.evt.deltaY < 0 ? old * by : old / by),
        );
        setZoom(next);
        setStagePosition({ x: ptr.x - mp.x * next, y: ptr.y - mp.y * next });
      } else {
        setStagePosition({
          x: stagePosition.x - e.evt.deltaX,
          y: stagePosition.y - e.evt.deltaY,
        });
      }
    },
    [zoom, stagePosition, setZoom, setStagePosition, stageRef],
  );

  const handleMouseDown = useCallback((e) => {
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.altKey)) {
      isPanningRef.current = true;
      lastPtrRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      e.evt.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isPanningRef.current || !lastPtrRef.current) return;
      const dx = e.evt.clientX - lastPtrRef.current.x;
      const dy = e.evt.clientY - lastPtrRef.current.y;
      lastPtrRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      setStagePosition({ x: stagePosition.x + dx, y: stagePosition.y + dy });
    },
    [stagePosition, setStagePosition],
  );

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    lastPtrRef.current = null;
  }, []);

  const handleStageClick = useCallback(
    (e) => {
      if (e.target === e.target.getStage()) setSelected(null);
      if (tool === "select" || isPanningRef.current) return;
      const pos = e.target.getStage().getPointerPosition();
      const ax = (pos.x - stagePosition.x) / zoom;
      const ay = (pos.y - stagePosition.y) / zoom;
      const defs = {
        rect: {
          type: "rect",
          x: ax - 60,
          y: ay - 40,
          width: 120,
          height: 80,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        roundrect: {
          type: "roundrect",
          x: ax - 60,
          y: ay - 40,
          width: 120,
          height: 80,
          cornerRadius: 14,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        circle: {
          type: "circle",
          x: ax,
          y: ay,
          radius: 50,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        ellipse: {
          type: "ellipse",
          x: ax,
          y: ay,
          radiusX: 70,
          radiusY: 45,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        triangle: {
          type: "triangle",
          x: ax,
          y: ay,
          radius: 60,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        pentagon: {
          type: "pentagon",
          x: ax,
          y: ay,
          radius: 60,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        hexagon: {
          type: "hexagon",
          x: ax,
          y: ay,
          radius: 60,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        star: {
          type: "star",
          x: ax,
          y: ay,
          numPoints: 5,
          innerRadius: 30,
          outerRadius: 65,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          opacity: 1,
        },
        arrow: {
          type: "arrow",
          x: ax - 60,
          y: ay,
          points: [0, 0, 120, 0],
          stroke: "#000000",
          fill: "#000000",
          strokeWidth: 3,
          pointerLength: 15,
          pointerWidth: 12,
          opacity: 1,
        },
        text: {
          type: "text",
          x: ax,
          y: ay,
          text: "Double-click to edit",
          fontSize: 28,
          fontFamily: "Inter",
          fill: "#1e293b",
          opacity: 1,
        },
        line: {
          type: "line",
          x: ax - 50,
          y: ay,
          points: [0, 0, 120, 0],
          stroke: "#000000",
          strokeWidth: 2,
          opacity: 1,
        },
      };
      if (defs[tool]) addShape(defs[tool]);
    },
    [tool, addShape, setSelected, zoom, stagePosition],
  );

  useEffect(() => {
    const cw = canvasSize?.width || 1200;
    const ch = canvasSize?.height || 800;
    function fitFn() {
      const fit = Math.min(
        (stageSize.width - 80) / cw,
        (stageSize.height - 80) / ch,
        1,
      );
      setZoom(fit);
      setStagePosition({
        x: (stageSize.width - cw * fit) / 2,
        y: (stageSize.height - ch * fit) / 2,
      });
    }
    function onKey(e) {
      const el = document.activeElement;
      if (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT"
      )
        return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        useEditorStore.getState().deleteShape(selectedId);
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        useEditorStore.getState().undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "z"))
      ) {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        fitFn();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedId,
    zoom,
    stagePosition,
    stageSize,
    canvasSize,
    setZoom,
    setStagePosition,
  ]);

  const cw = canvasSize?.width || 1200;
  const ch = canvasSize?.height || 800;
  const hasVideo = shapes.some((s) => s.type === "video");

  function fitCanvas() {
    const fit = Math.min(
      (stageSize.width - 80) / cw,
      (stageSize.height - 80) / ch,
      1,
    );
    setZoom(fit);
    setStagePosition({
      x: (stageSize.width - cw * fit) / 2,
      y: (stageSize.height - ch * fit) / 2,
    });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden canvas-bg relative"
        style={{ cursor: tool !== "select" ? "crosshair" : "default" }}
      >
        {/* Zoom controls */}
        <div className="absolute bottom-5 right-5 z-10 bg-white border border-gray-200 rounded-2xl shadow-lg px-1 py-1 flex items-center gap-1 select-none">
          <button
            onClick={() => setZoom(Math.max(0.05, zoom / 1.2))}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg"
          >
            −
          </button>
          <button
            onClick={fitCanvas}
            className="min-w-[52px] h-8 px-2 rounded-xl hover:bg-gray-100 text-xs font-semibold text-gray-700"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(Math.min(5, zoom * 1.2))}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg"
          >
            +
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={fitCanvas}
            title="Fit (Ctrl+0)"
            className="h-8 px-2.5 rounded-xl hover:bg-gray-100 text-xs font-medium text-gray-600"
          >
            Fit
          </button>
        </div>

        {tool !== "select" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
            Click canvas to place ·{" "}
            <kbd className="bg-white/20 px-1 rounded">V</kbd> to cancel
          </div>
        )}

        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={stagePosition.x}
          y={stagePosition.y}
          scaleX={zoom}
          scaleY={zoom}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
            <Rect
              x={-6}
              y={-6}
              width={cw + 12}
              height={ch + 12}
              fill="#bbb"
              cornerRadius={8}
              shadowBlur={30}
              shadowOpacity={0.2}
              shadowColor="#000"
            />
            <Rect
              x={0}
              y={0}
              width={cw}
              height={ch}
              fill="white"
              cornerRadius={2}
            />
            {shapes.map((shape) => (
              <ShapeRenderer
                key={shape.id}
                shape={shape}
                isSelected={selectedId === shape.id}
                onSelect={setSelected}
                onChange={updateShapeAndSnapshot}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Video timeline — only when video clips are on canvas */}
      {hasVideo && (
        <VideoTimeline shapes={shapes} onDurationChange={onDurationChange} />
      )}
    </div>
  );
}
