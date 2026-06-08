import { create } from 'zustand'

export const useAudioStore = create((set, get) => ({
  track: null,
  audio: null,
  isPlaying: false,

  setTrack: (track) => set({ track }),

  setAudio: (audio) => set({ audio }),

  play: () => {
    const { audio } = get()
    if (audio) {
      audio.play()
      set({ isPlaying: true })
    }
  },

  pause: () => {
    const { audio } = get()
    if (audio) {
      audio.pause()
      set({ isPlaying: false })
    }
  },

  cleanup: () => {
    const { audio } = get()

    if (audio) {
      audio.pause()
      audio.src = ''
    }

    set({
      audio: null,
      isPlaying: false,
    })
  },
}))