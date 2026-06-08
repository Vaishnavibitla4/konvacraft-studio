import { create } from 'zustand'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '../lib/firebase'

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    try {
      await firebaseSignOut(auth)
      set({ user: null })
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  },
}))
