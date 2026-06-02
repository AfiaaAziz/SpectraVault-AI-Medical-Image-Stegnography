import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import EmbedPage from './pages/EmbedPage.jsx'
import ExtractPage from './pages/ExtractPage.jsx'
import MetricsPage from './pages/MetricsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('isAuthenticated')
  if (!isAuth) {
    return <Navigate to="/signup" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="embed" element={<EmbedPage />} />
          <Route path="extract" element={<ExtractPage />} />
          <Route path="metrics" element={<MetricsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
