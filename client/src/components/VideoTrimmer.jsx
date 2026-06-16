import { useState, useRef, useEffect, useCallback } from "react";

export default function VideoTrimmer({
  src,
  duration: propDuration,
  trimStart = 0,
  trimEnd,
  onChange,
  onClose,
}) {
  const videoRef = useRef();
  const scrollRef = useRef();
  const [duration, setDuration] = useState(propDuration || 0);
  const [currentTime, setCurrentTime] = useState(trimStart || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [start, setStart] = useState(trimStart || 0);
  const [end, setEnd] = useState(trimEnd != null ? trimEnd : propDuration || 0);
  const [dragging, setDragging] = useState(null);
  const [frames, setFrames] = useState([]);
  const [loadingFrames, setLoadingFrames] = useState(true);

  const startRef = useRef(start);
  const endRef = useRef(end);
  const durationRef = useRef(duration);
  useEffect(() => {
    startRef.current = start;
  }, [start]);
  useEffect(() => {
    endRef.current = end;
  }, [end]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const FRAME_H = 54;
  const PX_PER_SEC = 80;
  const MIN_W = 640;

  const stripWidth = Math.max(MIN_W, Math.round(duration * PX_PER_SEC));

  const timeToX = useCallback(
    (t) => (duration > 0 ? (t / duration) * stripWidth : 0),
    [duration, stripWidth],
  );
  const xToTime = useCallback(
    (px) => (duration > 0 ? (px / stripWidth) * duration : 0),
    [duration, stripWidth],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.src = src;

    video.onloadedmetadata = async () => {
      const d = video.duration;
      if (!isFinite(d) || d <= 0) return;
      setDuration(d);
      setEnd((prev) => {
        if (trimEnd != null && trimEnd > 0 && trimEnd <= d) return trimEnd;
        if (prev <= 0 || prev > d) return d;
        return prev;
      });
      await extractFrames(video, d);
    };

    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= endRef.current) {
        video.currentTime = startRef.current;
      }
    };

    video.onplay = () => setIsPlaying(true);
    video.onpause = () => setIsPlaying(false);
    video.load();

    return () => {
      video.pause();
      video.src = "";
    };
  }, [src]);

  async function extractFrames(video, dur) {
    setLoadingFrames(true);
    const fc = Math.min(120, Math.max(8, Math.ceil(dur / 3)));
    const cvs = document.createElement("canvas");
    cvs.width = 120;
    cvs.height = 68;
    const ctx = cvs.getContext("2d");
    const result = [];

    for (let i = 0; i < fc; i++) {
      const targetTime = (dur / fc) * i;
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try {
            ctx.drawImage(video, 0, 0, 120, 68);
            result.push(cvs.toDataURL("image/jpeg", 0.45));
          } catch {}
          resolve();
        }, 3000);

        video.currentTime = targetTime;
        video.onseeked = () => {
          clearTimeout(timeout);
          try {
            ctx.drawImage(video, 0, 0, 120, 68);
            result.push(cvs.toDataURL("image/jpeg", 0.45));
          } catch {}
          resolve();
        };
      });
    }
    setFrames(result);
    setLoadingFrames(false);
    video.onseeked = null;
    video.currentTime = startRef.current;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
    } else {
      if (v.currentTime >= endRef.current || v.currentTime < startRef.current) {
        v.currentTime = startRef.current;
      }
      v.play();
    }
  }

  function getStripX(clientX) {
    const container = scrollRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const rawX = clientX - rect.left + container.scrollLeft;
    return Math.max(0, Math.min(stripWidth, rawX));
  }

  function onHandleMouseDown(handle, e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(handle);
  }

  useEffect(() => {
    if (!dragging) return;

    function onMove(e) {
      const px = getStripX(e.clientX);
      const t = xToTime(px);

      if (dragging === "start") {
        const ns = Math.max(0, Math.min(t, endRef.current - 0.1));
        setStart(ns);
        if (videoRef.current) videoRef.current.currentTime = ns;
      } else if (dragging === "end") {
        const ne = Math.max(
          startRef.current + 0.1,
          Math.min(t, durationRef.current),
        );
        setEnd(ne);
      } else if (dragging === "playhead") {
        const ct = Math.max(startRef.current, Math.min(t, endRef.current));
        if (videoRef.current) videoRef.current.currentTime = ct;
      }
    }

    function onUp() {
      setDragging(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, xToTime]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isPlaying) return;
    const px = timeToX(currentTime);
    const { scrollLeft, clientWidth } = container;
    const margin = 60;
    if (px < scrollLeft + margin || px > scrollLeft + clientWidth - margin) {
      container.scrollLeft = Math.max(0, px - clientWidth / 2);
    }
  }, [currentTime, isPlaying, timeToX]);

  function fmt(t) {
    if (!isFinite(t) || t < 0) return "0:00.0";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const d = Math.floor((t % 1) * 10);
    return `${m}:${String(s).padStart(2, "0")}.${d}`;
  }

  function handleApply() {
    onChange({ trimStart: start, trimEnd: end });
    onClose();
  }

  function rulerTicks() {
    if (duration <= 0) return [];
    let interval = 1;
    if (duration > 600) interval = 60;
    else if (duration > 120) interval = 30;
    else if (duration > 60) interval = 10;
    else if (duration > 20) interval = 5;
    const ticks = [];
    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ t, x: timeToX(t) });
    }
    return ticks;
  }

  const RULER_H = 20;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl"
        style={{
          background: "rgba(13,10,24,0.99)",
          border: "1px solid rgba(255,255,255,0.1)",
          width: 760,
          maxWidth: "96vw",
          maxHeight: "92vh",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
            >
              ✂️
            </div>
            <div>
              <p className="text-sm font-bold text-white">Trim Video</p>
              <p className="text-[10px] text-white/30">
                Drag the purple handles · scroll filmstrip to navigate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* ── Video preview ── */}
        <div className="relative shrink-0 bg-black" style={{ height: 200 }}>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted
            playsInline
          />
          <div
            className="absolute bottom-2 right-3 font-mono text-[11px] text-white/80 px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(0,0,0,0.65)" }}
          >
            {fmt(currentTime)} / {fmt(duration)}
          </div>
        </div>

        {/* ── Trim info bar ── */}
        <div
          className="flex items-center justify-between px-5 py-2 shrink-0"
          style={{
            background: "rgba(124,58,237,0.1)",
            borderBottom: "1px solid rgba(124,58,237,0.15)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">Start</span>
            <span className="font-mono text-xs text-violet-300 font-bold">
              {fmt(start)}
            </span>
            <span className="text-white/20 mx-1">→</span>
            <span className="text-[10px] text-white/40">End</span>
            <span className="font-mono text-xs text-violet-300 font-bold">
              {fmt(end)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/30">Duration:</span>
              <span className="font-mono text-xs text-white/70 font-bold">
                {fmt(end - start)}
              </span>
            </div>
            <button
              onClick={() => {
                setStart(0);
                setEnd(duration);
                if (videoRef.current) videoRef.current.currentTime = 0;
              }}
              className="text-[10px] text-white/35 hover:text-white/70 border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-lg transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Filmstrip (SCROLLABLE) ── */}
        <div className="shrink-0 px-4 pt-4 pb-3">
          {/*
            scrollRef is on THIS div — it is the overflow-x:auto container.
            All drag math reads scrollRef.current.scrollLeft and
            scrollRef.current.getBoundingClientRect() so it's always accurate.
          */}
          <div
            ref={scrollRef}
            className="overflow-x-auto rounded-xl select-none"
            style={{
              cursor: dragging ? "ew-resize" : "default",
              // Custom scrollbar styling
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(124,58,237,0.5) rgba(255,255,255,0.05)",
            }}
          >
            {/* Inner wide strip */}
            <div
              className="relative"
              style={{
                width: stripWidth,
                minWidth: "100%",
                height: FRAME_H + RULER_H + 8,
              }}
            >
              {/* ── Filmstrip images ── */}
              <div
                className="absolute top-0 left-0 right-0 flex rounded-lg overflow-hidden"
                style={{ height: FRAME_H }}
              >
                {loadingFrames ? (
                  <div
                    className="w-full h-full flex items-center justify-center gap-2 text-white/30 text-xs"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      minWidth: stripWidth,
                    }}
                  >
                    <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    Extracting frames…
                  </div>
                ) : (
                  frames.map((f, i) => (
                    <img
                      key={i}
                      src={f}
                      alt=""
                      draggable={false}
                      style={{
                        width: stripWidth / frames.length,
                        height: FRAME_H,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ))
                )}
              </div>

              {/* ── Dim region: before start ── */}
              <div
                className="absolute top-0 pointer-events-none rounded-l-lg"
                style={{
                  left: 0,
                  width: Math.max(0, timeToX(start)),
                  height: FRAME_H,
                  background: "rgba(0,0,0,0.72)",
                  zIndex: 2,
                }}
              />

              {/* ── Dim region: after end ── */}
              <div
                className="absolute top-0 pointer-events-none rounded-r-lg"
                style={{
                  left: timeToX(end),
                  right: 0,
                  height: FRAME_H,
                  background: "rgba(0,0,0,0.72)",
                  zIndex: 2,
                }}
              />

              {/* ── Active trim border ── */}
              <div
                className="absolute top-0 pointer-events-none"
                style={{
                  left: timeToX(start),
                  width: Math.max(0, timeToX(end) - timeToX(start)),
                  height: FRAME_H,
                  border: "2.5px solid #7c3aed",
                  borderRadius: 6,
                  boxShadow: "0 0 12px rgba(124,58,237,0.5)",
                  zIndex: 3,
                }}
              />

              {/* ── Start handle ── */}
              <div
                className="absolute top-0"
                style={{
                  left: timeToX(start) - 12,
                  width: 24,
                  height: FRAME_H,
                  zIndex: 10,
                  cursor: "ew-resize",
                }}
                onMouseDown={(e) => onHandleMouseDown("start", e)}
              >
                <div
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center gap-1"
                  style={{
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 14,
                    borderRadius: "4px 0 0 4px",
                    background: "#7c3aed",
                    boxShadow: "0 0 8px rgba(124,58,237,0.8)",
                  }}
                >
                  <div className="w-0.5 h-3 rounded-full bg-white/80" />
                  <div className="w-0.5 h-3 rounded-full bg-white/80" />
                </div>
                {/* Time label */}
                <div
                  className="absolute font-mono text-[9px] font-bold text-white px-1.5 py-0.5 rounded-md whitespace-nowrap"
                  style={{
                    bottom: FRAME_H + 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#7c3aed",
                    boxShadow: "0 2px 8px rgba(124,58,237,0.5)",
                  }}
                >
                  {fmt(start)}
                </div>
              </div>

              {/* ── End handle ── */}
              <div
                className="absolute top-0"
                style={{
                  left: timeToX(end) - 12,
                  width: 24,
                  height: FRAME_H,
                  zIndex: 10,
                  cursor: "ew-resize",
                }}
                onMouseDown={(e) => onHandleMouseDown("end", e)}
              >
                <div
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center gap-1"
                  style={{
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 14,
                    borderRadius: "0 4px 4px 0",
                    background: "#7c3aed",
                    boxShadow: "0 0 8px rgba(124,58,237,0.8)",
                  }}
                >
                  <div className="w-0.5 h-3 rounded-full bg-white/80" />
                  <div className="w-0.5 h-3 rounded-full bg-white/80" />
                </div>
                {/* Time label */}
                <div
                  className="absolute font-mono text-[9px] font-bold text-white px-1.5 py-0.5 rounded-md whitespace-nowrap"
                  style={{
                    bottom: FRAME_H + 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#7c3aed",
                    boxShadow: "0 2px 8px rgba(124,58,237,0.5)",
                  }}
                >
                  {fmt(end)}
                </div>
              </div>

              {/* ── Playhead ── */}
              <div
                className="absolute top-0"
                style={{
                  left: timeToX(currentTime) - 1,
                  width: 3,
                  height: FRAME_H,
                  zIndex: 11,
                  cursor: "ew-resize",
                }}
                onMouseDown={(e) => onHandleMouseDown("playhead", e)}
              >
                <div
                  className="w-full h-full rounded-full bg-white"
                  style={{ boxShadow: "0 0 10px rgba(255,255,255,0.9)" }}
                />
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-xl" />
              </div>

              {/* ── Ruler (time ticks below filmstrip) ── */}
              <div
                className="absolute left-0 right-0"
                style={{ top: FRAME_H + 2, height: RULER_H }}
              >
                {rulerTicks().map(({ t, x }) => (
                  <div
                    key={t}
                    className="absolute flex flex-col items-center"
                    style={{ left: x, transform: "translateX(-50%)" }}
                  >
                    <div className="w-px h-2 bg-white/20" />
                    <span className="text-[8px] text-white/25 font-mono whitespace-nowrap mt-0.5">
                      {t >= 60
                        ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
                        : `${t}s`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* /inner strip */}
          </div>
          {/* /scrollRef */}

          {duration > 10 && (
            <p className="text-center text-[9px] text-white/18 mt-1.5 tracking-wide">
              ← scroll to navigate the full timeline →
            </p>
          )}
        </div>

        {/* ── Playback controls ── */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = start;
            }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Go to trim start"
          >
            ⏮
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shadow-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <button
            onClick={() => {
              if (videoRef.current)
                videoRef.current.currentTime = Math.max(start, end - 0.05);
            }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Go to trim end"
          >
            ⏭
          </button>

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white/45 border border-white/10 hover:bg-white/5 hover:text-white transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#ec4899)",
              boxShadow: "0 4px 16px rgba(124,58,237,0.45)",
            }}
          >
            ✓ Apply Trim
          </button>
        </div>
      </div>
    </div>
  );
}
