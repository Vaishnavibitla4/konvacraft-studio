import axios from 'axios'
import { auth } from './firebase'

// In production the Express server serves the built React app from the SAME
// origin, so API calls use a relative base URL (/api).  In local dev,
// VITE_API_URL can be set to http://localhost:4000 (or left empty — Vite's
// proxy forwards /api to the dev server automatically).
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({ baseURL })

// Attach Firebase ID token to every request
api.interceptors.request.use(async config => {
  const user = await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u) })
  })
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
