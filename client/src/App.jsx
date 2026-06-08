import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import { ToastProvider } from './components/Toast'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import ImagesToVideoPage from './pages/ImagesToVideoPage'
import EmbedPage from './pages/EmbedPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0a0a0f' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>K</div>
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/editor/:id" element={<PrivateRoute><EditorPage /></PrivateRoute>} />
          <Route path="/images-to-video" element={<PrivateRoute><ImagesToVideoPage /></PrivateRoute>} />
          <Route path="/images-to-video/:id" element={<PrivateRoute><ImagesToVideoPage /></PrivateRoute>} />
          {/* Public embed route — no auth required, safe for iframe embeds */}
          <Route path="/embed/:id" element={<EmbedPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastProvider />
    </AuthProvider>
  )
}
