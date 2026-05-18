import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './pages/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Discovery from './pages/Discovery'
import Pipeline from './pages/Pipeline'
import Settings from './pages/Settings'
import ProspectPage from './pages/Prospect'

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="discovery" element={<Discovery />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="prospect/:id" element={<ProspectPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}
