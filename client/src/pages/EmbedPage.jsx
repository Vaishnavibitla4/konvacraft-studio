import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
} from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import api from "../lib/api";

export default function EmbedPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const showControls = params.get("controls") === "1";

  const containerRef = useRef();
  const [design, setDesign] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    async function load() {
      try {
        let data;
        try {
          data = (await api.get(`/designs/${id}/public`)).data;
        } catch {
          data = (await api.get(`/designs/${id}`)).data;
        }

        setDesign(data);
        setLoading(false);
      } catch (e) {
        setError("Could not load this design.");
        setLoading(false);
      }
    }
    load();
  }, [id]);
  useEffect(() => {
    if (!design || !containerRef.current) return;
    const cw = design.canvasSize?.width || 1200;
    const ch = design.canvasSize?.height || 800;
    const contW = containerRef.current.offsetWidth || 800;
    const contH = containerRef.current.offsetHeight || 600;
    const s = Math.min(contW / cw, contH / ch);
    const ox = (contW - cw * s) / 2;
    const oy = (contH - ch * s) / 2;
    setScale(s);
    setOffset({ x: ox, y: oy });
    setStageSize({ width: contW, height: contH });
    setZoom(Math.round(s * 100));
  }, [design]);

  useEffect(() => {
    function onResize() {
      if (!design || !containerRef.current) return;
      const cw = design.canvasSize?.width || 1200;
      const ch = design.canvasSize?.height || 800;
      const contW = containerRef.current.offsetWidth;
      const contH = containerRef.current.offsetHeight;
      const s = Math.min(contW / cw, contH / ch);
      setScale(s);
      setOffset({ x: (contW - cw * s) / 2, y: (contH - ch * s) / 2 });
      setStageSize({ width: contW, height: contH });
      setZoom(Math.round(s * 100));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [design]);

  const shapes = design?.pages?.[0]?.shapes ?? design?.shapes ?? [];
  const title = design?.title || "Design";
  const cw = design?.canvasSize?.width || 1200;
  const ch = design?.canvasSize?.height || 800;

  if (error)
    return (
      <div style={S.center}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
          <p style={{ fontWeight: 700, color: "#111", marginBottom: 4 }}>
            Design not found
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>{error}</p>
        </div>
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f3f4f6",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      {/* Optional controls bar */}
      {showControls && (
        <div style={S.bar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={S.logo}>K</div>
            <span style={S.barTitle}>{loading ? "Loading…" : title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              style={S.zoomBtn}
              onClick={() => {
                setScale((s) => {
                  const n = Math.min(s * 1.2, 4);
                  setZoom(Math.round(n * 100));
                  return n;
                });
              }}
            >
              +
            </button>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                minWidth: 42,
                textAlign: "center",
                fontFamily: "monospace",
              }}
            >
              {zoom}%
            </span>
            <button
              style={S.zoomBtn}
              onClick={() => {
                setScale((s) => {
                  const n = Math.max(s / 1.2, 0.05);
                  setZoom(Math.round(n * 100));
                  return n;
                });
              }}
            >
              −
            </button>
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            KonvaCraft
          </span>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
      >
        {loading && <Spinner />}

        {!loading && !error && (
          <Stage
            width={cw}
            height={ch}
            scaleX={scale}
            scaleY={scale}
            x={offset.x}
            y={offset.y}
            listening={false}
          >
            <Layer>
              {/* Canvas shadow */}
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

              {/* Actual canvas */}
              <Rect
                x={0}
                y={0}
                width={cw}
                height={ch}
                fill={design?.backgroundColor || "#ffffff"}
                cornerRadius={2}
              />

              {shapes.map((shape) => (
                <EmbedShape key={shape.id} shape={shape} />
              ))}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}

function EmbedShape({ shape }) {
  if (shape.type === "image") return <EmbedImage shape={shape} />;
  if (shape.type === "video") return <EmbedVideo shape={shape} />;

  const shadow =
    shape.shadowBlur || shape.shadowOffsetX || shape.shadowOffsetY
      ? {
          shadowColor: shape.shadowColor || "rgba(0,0,0,0.3)",
          shadowBlur: shape.shadowBlur || 0,
          shadowOffsetX: shape.shadowOffsetX || 0,
          shadowOffsetY: shape.shadowOffsetY || 0,
          shadowEnabled: true,
        }
      : {};

  const base = {
    x: shape.x ?? 0,
    y: shape.y ?? 0,
    rotation: shape.rotation ?? 0,
    opacity: shape.opacity ?? 1,
    fill: shape.fill || "transparent",
    stroke: shape.stroke || undefined,
    strokeWidth: shape.strokeWidth || 0,
    visible: shape.visible !== false,
    listening: false,
    ...shadow,
  };

  switch (shape.type) {
    case "rect":
      return (
        <Rect
          {...base}
          width={shape.width ?? 100}
          height={shape.height ?? 100}
        />
      );

    case "roundrect":
      return (
        <Rect
          {...base}
          width={shape.width ?? 100}
          height={shape.height ?? 100}
          cornerRadius={shape.cornerRadius ?? 14}
        />
      );

    case "circle":
      return <Circle {...base} radius={shape.radius ?? 50} />;

    case "ellipse":
      return (
        <Ellipse
          {...base}
          radiusX={shape.radiusX ?? (shape.width ?? 100) / 2}
          radiusY={shape.radiusY ?? (shape.height ?? 60) / 2}
        />
      );

    case "triangle":
      return <RegularPolygon {...base} sides={3} radius={shape.radius ?? 60} />;

    case "pentagon":
      return <RegularPolygon {...base} sides={5} radius={shape.radius ?? 60} />;

    case "hexagon":
      return <RegularPolygon {...base} sides={6} radius={shape.radius ?? 60} />;

    case "star":
      return (
        <Star
          {...base}
          numPoints={shape.numPoints ?? 5}
          innerRadius={shape.innerRadius ?? 30}
          outerRadius={shape.outerRadius ?? 65}
        />
      );

    case "arrow":
      return (
        <Arrow
          {...base}
          points={shape.points ?? [0, 0, 120, 0]}
          pointerLength={shape.pointerLength ?? 15}
          pointerWidth={shape.pointerWidth ?? 12}
        />
      );

    case "line":
      return (
        <Line
          {...base}
          points={shape.points ?? [0, 0, 120, 0]}
          dash={shape.dash ?? []}
        />
      );

    case "text":
      return (
        <Text
          {...base}
          text={shape.text || ""}
          fontSize={shape.fontSize ?? 16}
          fontFamily={shape.fontFamily ?? "Inter, sans-serif"}
          fontStyle={shape.fontStyle ?? "normal"}
          align={shape.align ?? "left"}
          width={shape.width}
          wrap="word"
        />
      );

    default:
      return null;
  }
}

function EmbedImage({ shape }) {
  const [image] = useImage(shape.src || "", "anonymous");
  const ref = useRef();

  useEffect(() => {
    const node = ref.current;
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

  if (!image) return null;
  return (
    <KonvaImage
      shadowColor={shape.shadowColor}
      shadowBlur={shape.shadowBlur || 0}
      shadowOffsetX={shape.shadowOffsetX || 0}
      shadowOffsetY={shape.shadowOffsetY || 0}
      ref={ref}
      image={image}
      x={shape.x ?? 0}
      y={shape.y ?? 0}
      width={shape.width ?? 100}
      height={shape.height ?? 100}
      rotation={shape.rotation ?? 0}
      opacity={shape.opacity ?? 1}
      cornerRadius={shape.cornerRadius ?? 0}
      brightness={shape.brightness ?? 0}
      contrast={shape.contrast ?? 0}
      blurRadius={shape.blurRadius ?? 0}
      visible={shape.visible !== false}
      listening={false}
    />
  );
}

function EmbedVideo({ shape }) {
  const videoRef = useRef(null);
  const nodeRef = useRef();
  const [ready, setReady] = useState(false);

  if (!videoRef.current) {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    videoRef.current = v;
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !shape.src) return;
    v.src = shape.src;
    v.currentTime = shape.trimStart ?? 0;
    v.onloadeddata = () => {
      setReady(true);
    };
    v.load();
  }, [shape.src, shape.trimStart]);

  if (!ready) return null;
  return (
    <KonvaImage
      shadowColor={shape.shadowColor}
      shadowBlur={shape.shadowBlur || 0}
      shadowOffsetX={shape.shadowOffsetX || 0}
      shadowOffsetY={shape.shadowOffsetY || 0}
      ref={nodeRef}
      image={videoRef.current}
      x={shape.x ?? 0}
      y={shape.y ?? 0}
      width={shape.width ?? 320}
      height={shape.height ?? 180}
      rotation={shape.rotation ?? 0}
      opacity={shape.opacity ?? 1}
      cornerRadius={shape.cornerRadius ?? 0}
      visible={shape.visible !== false}
      listening={false}
    />
  );
}

function Spinner() {
  return (
    <div style={S.center}>
      <div style={{ textAlign: "center" }}>
        <div style={S.logo}>K</div>
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid #7c3aed",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "12px auto 0",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

const S = {
  center: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    flexShrink: 0,
    background: "rgba(255,255,255,0.04)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    flexShrink: 0,
    background: "linear-gradient(135deg,#7c3aed,#ec4899)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 900,
    color: "#fff",
  },
  barTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.8)",
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
};
