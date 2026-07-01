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
import BookAppointmentPage from './pages/BookAppointmentPage'
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard'
import BranchesPage from './pages/admin/BranchesPage'
import AdminSubscriptionPage from './pages/admin/AdminSubscriptionPage'
import GamesLibraryPage from './pages/admin/GamesLibraryPage'
import AuditLogsPage from './pages/admin/AuditLogsPage'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import OwnerAppointmentsPage from './pages/owner/OwnerAppointmentsPage'
import OwnerPatientsPage from './pages/owner/OwnerPatientsPage'
import OwnerStaffPage from './pages/owner/OwnerStaffPage'
import OwnerReportsPage from './pages/owner/OwnerReportsPage'
import OwnerBillingPage from './pages/owner/OwnerBillingPage'
import OwnerSubscriptionPage from './pages/owner/OwnerSubscriptionPage'
import TherapistDashboard from './pages/therapist/TherapistDashboard'
import TherapistPatientsPage from './pages/therapist/TherapistPatientsPage'
import TherapistAppointmentsPage from './pages/therapist/TherapistAppointmentsPage'
import TherapistNotesProgressPage from './pages/therapist/TherapistNotesProgressPage'
import TherapistAssignExercisesPage from './pages/therapist/TherapistAssignExercisesPage'
import TherapistSubscriptionPage from './pages/therapist/TherapistSubscriptionPage'

// Temporary accounts (not connected to database)
const TEMP_USERS = [
  {
    email: 'patient@gmail.com',
    password: 'patient123',
    name: 'Alvrin',
    role: 'Patient',
    avatar: '/therapy-pro-logo.png'
  },
  {
    email: 'superadmin@gmail.com',
    password: 'superadmin123',
    name: 'Super Admin',
    role: 'Super Admin',
    avatar: '/therapy-pro-logo.png'
  },
  {
    email: 'owner@gmail.com',
    password: 'owner123',
    name: 'Owner',
    role: 'Owner',
    avatar: '/therapy-pro-logo.png'
  },
  {
    email: 'therapists@gmail.com',
    password: 'therapist123',
    name: 'Therapist',
    role: 'Therapist',
    avatar: '/therapy-pro-logo.png'
  }
]

const getHomePath = (role) => {
  if (role === 'Super Admin') return '/admin/dashboard'
  if (role === 'Owner') return '/owner/dashboard'
  if (role === 'Therapist') return '/therapist/dashboard'
  return '/dashboard'
}

// Login wrapper to handle authentication
function LoginWrapper({ onLogin }) {
  const navigate = useNavigate()
  
  const handleLogin = (email, password) => {
    const result = onLogin(email, password)
    if (result.success) {
      navigate(getHomePath(result.user?.role))
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
    const matchedUser = TEMP_USERS.find(user => user.email === email && user.password === password)

    if (matchedUser) {
      setIsAuthenticated(true)
      setCurrentUser(matchedUser)
      return { success: true, user: matchedUser }
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
              <Navigate to={getHomePath(currentUser?.role)} replace />
            ) : (
              <Splash onLogoClick={() => {}} />
            )
          } 
        />
        
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              <Navigate to={getHomePath(currentUser?.role)} replace />
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
              currentUser?.role === 'Super Admin' ? (
                <Navigate to="/admin/dashboard" replace />
              ) : currentUser?.role === 'Owner' ? (
                <Navigate to="/owner/dashboard" replace />
              ) : currentUser?.role === 'Therapist' ? (
                <Navigate to="/therapist/dashboard" replace />
              ) : (
                <Dashboard user={currentUser} onLogout={handleLogout} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route
          path="/admin/dashboard"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <SuperAdminDashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/dashboard"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerDashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/appointments"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerAppointmentsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/patients"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerPatientsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/staff"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerStaffPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/reports"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerReportsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/billing"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerBillingPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/subscription"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerSubscriptionPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/dashboard"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistDashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/patients"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistPatientsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/appointments"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistAppointmentsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/subscription"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistSubscriptionPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/notes-progress"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistNotesProgressPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/assign-exercises"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistAssignExercisesPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/branches"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <BranchesPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/subscription"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <AdminSubscriptionPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/games-library"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <GamesLibraryPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/audit-logs"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <AuditLogsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
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
              currentUser?.role === 'Patient' ? (
                <AppointmentsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/appointments/book" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <BookAppointmentPage user={currentUser} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/notes" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <NotesPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/messages" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <MessagesPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/subscription" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <SubscriptionPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/settings" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <SettingsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/help" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <HelpPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/subscription/update-payment" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <UpdatePaymentPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/subscription/payment-history" 
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PaymentHistoryPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
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
