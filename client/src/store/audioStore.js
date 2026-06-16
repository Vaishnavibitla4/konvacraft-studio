import { create } from "zustand";

const audioElements = new Map(); // trackId → HTMLAudioElement

function getOrCreateEl(id) {
  if (!audioElements.has(id)) {
    const el = new Audio();
    el.preload = "auto";
    audioElements.set(id, el);
  }
  return audioElements.get(id);
}

function destroyEl(id) {
  const el = audioElements.get(id);
  if (el) {
    el.pause();
    el.src = "";
    el.ontimeupdate = null;
    el.onplay = null;
    el.onpause = null;
    el.onended = null;
    audioElements.delete(id);
  }
}

function makeDefaultTrackState(track) {
  return {
    track,
    trimStart: 0,
    trimEnd: null,
    timelineOffset: 0, // ← seconds into the master timeline where this track starts
    volume: 0.8,
    loop: false,
    isPlaying: false,
    currentTime: 0,
  };
}

export const useAudioStore = create((set, get) => ({
  tracks: [],

  // ── Add a new track ─────────────────────────────────────────────────
  addTrack(trackInfo) {
    const existing = get().tracks.find((t) => t.track.id === trackInfo.id);
    if (existing) return;

    const newState = makeDefaultTrackState(trackInfo);
    set((s) => ({ tracks: [...s.tracks, newState] }));

    const audio = getOrCreateEl(trackInfo.id);
    audio.src = trackInfo.src;
    audio.volume = newState.volume;
    audio.loop = false;
    audio.currentTime = 0;

    audio.onloadedmetadata = () => {
      const realDur = isFinite(audio.duration) ? audio.duration : null;
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.track.id === trackInfo.id
            ? {
                ...t,
                track: realDur ? { ...t.track, duration: realDur } : t.track,
                trimEnd: t.trimEnd == null ? realDur : t.trimEnd,
              }
            : t,
        ),
      }));
    };

    audio.ontimeupdate = () => {
      set((s) => {
        const idx = s.tracks.findIndex((t) => t.track.id === trackInfo.id);
        if (idx < 0) return s;
        const t = s.tracks[idx];
        const end = t.trimEnd ?? audio.duration;
        if (end && audio.currentTime >= end) {
          if (t.loop) {
            audio.currentTime = t.trimStart || 0;
          } else {
            audio.pause();
            audio.currentTime = t.trimStart || 0;
            const updated = [...s.tracks];
            updated[idx] = {
              ...t,
              isPlaying: false,
              currentTime: t.trimStart || 0,
            };
            return { tracks: updated };
          }
        }
        const updated = [...s.tracks];
        updated[idx] = { ...t, currentTime: audio.currentTime };
        return { tracks: updated };
      });
    };

    audio.onplay = () =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.track.id === trackInfo.id ? { ...t, isPlaying: true } : t,
        ),
      }));
    audio.onpause = () =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.track.id === trackInfo.id ? { ...t, isPlaying: false } : t,
        ),
      }));
    audio.onended = () =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.track.id === trackInfo.id ? { ...t, isPlaying: false } : t,
        ),
      }));

    audio.load();
  },

  // ── Individual playback (AudioPlayerBar buttons) ─────────────────────
  // Playing one track from the bar does NOT affect any other track.
  play(trackId) {
    const t = get().tracks.find((t) => t.track.id === trackId);
    if (!t) return;
    const audio = getOrCreateEl(trackId);
    if (!audio.src) {
      audio.src = t.track.src;
      audio.load();
    }
    if (
      audio.currentTime < (t.trimStart || 0) ||
      audio.currentTime >= (t.trimEnd ?? audio.duration ?? Infinity)
    ) {
      audio.currentTime = t.trimStart || 0;
    }
    audio.play().catch(() => {});
  },

  pause(trackId) {
    getOrCreateEl(trackId)?.pause();
  },

  togglePlay(trackId) {
    const t = get().tracks.find((t) => t.track.id === trackId);
    if (!t) return;
    if (t.isPlaying) get().pause(trackId);
    else get().play(trackId);
  },

  seek(trackId, time) {
    const audio = getOrCreateEl(trackId);
    if (audio) audio.currentTime = time;
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.track.id === trackId ? { ...t, currentTime: time } : t,
      ),
    }));
  },

  // ── Timeline-driven playback (called by VideoTimeline) ───────────────
  // playheadSec = current position in the master video timeline.
  // Each track plays only when playheadSec is within its window:
  //   [timelineOffset, timelineOffset + clipDuration]
  syncToPlayhead(playheadSec) {
    get().tracks.forEach((t) => {
      const audio = getOrCreateEl(t.track.id);
      if (!audio) return;

      const clipDur = (t.trimEnd ?? t.track.duration ?? 0) - (t.trimStart || 0);
      const offset = t.timelineOffset || 0;
      const trackEnd = offset + clipDur;

      const shouldPlay = playheadSec >= offset && playheadSec < trackEnd;

      if (shouldPlay) {
        // Position within the audio file
        const posInTrack = (t.trimStart || 0) + (playheadSec - offset);
        // Only seek if meaningfully out of sync (>0.2s) to avoid glitches
        if (Math.abs(audio.currentTime - posInTrack) > 0.2) {
          audio.currentTime = posInTrack;
        }
        if (audio.paused) {
          audio.volume = t.volume ?? 0.8;
          audio.play().catch(() => {});
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });
  },

  // Pause all tracks (called when video timeline pauses)
  pauseAll() {
    get().tracks.forEach((t) => {
      getOrCreateEl(t.track.id)?.pause();
    });
  },

  // Seek all tracks to the right position for a given playhead (without playing)
  seekAllToPlayhead(playheadSec) {
    get().tracks.forEach((t) => {
      const audio = getOrCreateEl(t.track.id);
      if (!audio) return;
      const offset = t.timelineOffset || 0;
      const posInTrack = (t.trimStart || 0) + (playheadSec - offset);
      const clipDur = (t.trimEnd ?? t.track.duration ?? 0) - (t.trimStart || 0);
      if (playheadSec >= offset && playheadSec < offset + clipDur) {
        audio.currentTime = Math.max(
          t.trimStart || 0,
          Math.min(posInTrack, t.trimEnd ?? audio.duration ?? Infinity),
        );
      }
    });
  },

  // ── Settings ─────────────────────────────────────────────────────────
  setVolume(trackId, v) {
    const audio = getOrCreateEl(trackId);
    if (audio) audio.volume = v;
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.track.id === trackId ? { ...t, volume: v } : t,
      ),
    }));
  },

  setLoop(trackId, v) {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.track.id === trackId ? { ...t, loop: v } : t,
      ),
    }));
  },

  setTrim(trackId, trimStart, trimEnd) {
    const audio = getOrCreateEl(trackId);
    if (audio) {
      if (
        audio.currentTime < trimStart ||
        (trimEnd && audio.currentTime > trimEnd)
      ) {
        audio.currentTime = trimStart;
      }
    }
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.track.id === trackId ? { ...t, trimStart, trimEnd } : t,
      ),
    }));
  },

  // ── Set the timeline offset (drag track left/right on master timeline) ──
  setTimelineOffset(trackId, offsetSec) {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.track.id === trackId
          ? { ...t, timelineOffset: Math.max(0, offsetSec) }
          : t,
      ),
    }));
  },

  // ── Remove a single track ─────────────────────────────────────────────
  removeTrack(trackId) {
    destroyEl(trackId);
    set((s) => ({ tracks: s.tracks.filter((t) => t.track.id !== trackId) }));
  },

  reorderTracks(fromIdx, toIdx) {
    set((s) => {
      const arr = [...s.tracks];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return { tracks: arr };
    });
  },

  serialise() {
    return get().tracks.map(
      ({ track, trimStart, trimEnd, timelineOffset, volume, loop }) => ({
        track,
        trimStart,
        trimEnd,
        timelineOffset: timelineOffset || 0,
        volume,
        loop,
      }),
    );
  },

  restore(saved) {
    if (!Array.isArray(saved)) {
      if (saved?.track?.src) {
        const {
          track,
          trimStart = 0,
          trimEnd = null,
          timelineOffset = 0,
          volume = 0.8,
          loop = false,
        } = saved;
        get().addTrack(track);
        setTimeout(() => {
          get().setTrim(track.id, trimStart, trimEnd);
          get().setVolume(track.id, volume);
          get().setLoop(track.id, loop);
          get().setTimelineOffset(track.id, timelineOffset);
        }, 100);
      }
      return;
    }
    saved.forEach(
      ({
        track,
        trimStart = 0,
        trimEnd = null,
        timelineOffset = 0,
        volume = 0.8,
        loop = false,
      }) => {
        if (!track?.src) return;
        get().addTrack(track);
        setTimeout(() => {
          get().setTrim(track.id, trimStart, trimEnd);
          get().setVolume(track.id, volume);
          get().setLoop(track.id, loop);
          get().setTimelineOffset(track.id, timelineOffset);
        }, 100);
      },
    );
  },

  cleanup() {
    audioElements.forEach((el) => {
      el.pause();
    });
    set((s) => ({ tracks: s.tracks.map((t) => ({ ...t, isPlaying: false })) }));
  },

  stopAll() {
    audioElements.forEach((_, id) => destroyEl(id));
    set({ tracks: [] });
  },

  // Legacy compat
  get track() {
    return get().tracks[0]?.track ?? null;
  },
  setTrack(trackInfo) {
    get().addTrack(trackInfo);
  },
  stop() {
    get().stopAll();
  },
}));
