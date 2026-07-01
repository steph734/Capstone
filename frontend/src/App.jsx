import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Splash from './pages/Splash'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import TherapyDetail from './pages/TherapyDetail'
import AppointmentsPage from './pages/AppointmentsPage'
import NotesPage from './pages/NotesPage'
import MessagesPage from './pages/MessagesPage'
import SubscriptionPage from './pages/SubscriptionPage'
import SettingsPage from './pages/SettingsPage'
import HelpPage from './pages/HelpPage'
import UpdatePaymentPage from './pages/UpdatePaymentPage'
import PaymentHistoryPage from './pages/PaymentHistoryPage'

// Temporary user data (not connected to database)
const TEMP_USER = {
  email: 'admin@therapypro.com',
  password: 'admin123',
  name: 'Alvrin',
  role: 'Patient',
  avatar: '/therapy-pro-logo.png'
}

// Login wrapper to handle authentication
function LoginWrapper({ onLogin }) {
  const navigate = useNavigate()
  
  const handleLogin = (email, password) => {
    const result = onLogin(email, password)
    if (result.success) {
      navigate('/dashboard')
    }
    return result
  }

  return (
    <Login
      onLogoClick={() => navigate('/')}
      onSignUpClick={() => navigate('/signup')}
      onForgotPasswordClick={() => navigate('/forgot-password')}
      onLogin={handleLogin}
    />
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  const handleLogin = (email, password) => {
    // Temporary authentication logic
    if (email === TEMP_USER.email && password === TEMP_USER.password) {
      setIsAuthenticated(true)
      setCurrentUser(TEMP_USER)
      return { success: true }
    }
    return { success: false, message: 'Invalid email or password' }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Splash onLogoClick={() => {}} />
            )
          } 
        />
        
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginWrapper onLogin={handleLogin} />
            )
          } 
        />
        
        <Route 
          path="/signup" 
          element={<SignUp />} 
        />
        
        <Route 
          path="/forgot-password" 
          element={<ForgotPassword />} 
        />
        
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated ? (
              <Dashboard user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        <Route 
          path="/therapy/:category" 
          element={
            isAuthenticated ? (
              <TherapyDetail />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/appointments" 
          element={
            isAuthenticated ? (
              <AppointmentsPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/notes" 
          element={
            isAuthenticated ? (
              <NotesPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/messages" 
          element={
            isAuthenticated ? (
              <MessagesPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/subscription" 
          element={
            isAuthenticated ? (
              <SubscriptionPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/settings" 
          element={
            isAuthenticated ? (
              <SettingsPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/help" 
          element={
            isAuthenticated ? (
              <HelpPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/subscription/update-payment" 
          element={
            isAuthenticated ? (
              <UpdatePaymentPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/subscription/payment-history" 
          element={
            isAuthenticated ? (
              <PaymentHistoryPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  )
}

export default App
