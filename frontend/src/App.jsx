import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { MessagesProvider } from './context/MessagesContext'
import { loadAccessibilityPrefs, applyAccessibilityPrefs } from './utils/accessibilityPrefs'
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
import OwnerSpeechToTextPage from './pages/owner/OwnerSpeechToTextPage'
import OwnerTextToSpeechPage from './pages/owner/OwnerTextToSpeechPage'
import OwnerSpeechFeaturesPage from './pages/owner/OwnerSpeechFeaturesPage'
import OwnerGamifiedActivitiesPage from './pages/owner/OwnerGamifiedActivitiesPage'
import TherapistSpeechToTextPage from './pages/therapist/TherapistSpeechToTextPage'
import TherapistTextToSpeechPage from './pages/therapist/TherapistTextToSpeechPage'
import TherapistSpeechFeaturesPage from './pages/therapist/TherapistSpeechFeaturesPage'
import TherapistGamifiedActivitiesPage from './pages/therapist/TherapistGamifiedActivitiesPage'
import PatientSpeechToTextPage from './pages/PatientSpeechToTextPage'
import PatientTextToSpeechPage from './pages/PatientTextToSpeechPage'
import PatientSpeechFeaturesPage from './pages/PatientSpeechFeaturesPage'
import PatientGamifiedActivitiesPage from './pages/PatientGamifiedActivitiesPage'
import PatientEmailPage from './pages/PatientEmailPage'
import TherapistDashboard from './pages/therapist/TherapistDashboard'
import TherapistPatientsPage from './pages/therapist/TherapistPatientsPage'
import TherapistAppointmentsPage from './pages/therapist/TherapistAppointmentsPage'
import TherapistNotesProgressPage from './pages/therapist/TherapistNotesProgressPage'
import TherapistAssignExercisesPage from './pages/therapist/TherapistAssignExercisesPage'
import TherapistSubscriptionPage from './pages/therapist/TherapistSubscriptionPage'
import TherapistProfilePage from './pages/therapist/TherapistProfilePage'
import TherapistReportPage from './pages/therapist/TherapistReportPage'
import AdminProfilePage from './pages/admin/AdminProfilePage'
import OwnerProfilePage from './pages/owner/OwnerProfilePage'
import PatientProfilePage from './pages/PatientProfilePage'

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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true'
  })
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [ownerBetaTier, setOwnerBetaTier] = useState(() => localStorage.getItem('betaTier') || null)

  useEffect(() => {
    applyAccessibilityPrefs(loadAccessibilityPrefs())
  }, [])

  const handleOwnerBetaActivate = (tier) => {
    setOwnerBetaTier(tier)
    if (tier) {
      localStorage.setItem('betaTier', tier)
    } else {
      localStorage.removeItem('betaTier')
    }
  }

  const handleLogin = (email, password) => {
    const matchedUser = TEMP_USERS.find(user => user.email === email && user.password === password)

    if (matchedUser) {
      setIsAuthenticated(true)
      setCurrentUser(matchedUser)
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('currentUser', JSON.stringify(matchedUser))
      return { success: true, user: matchedUser }
    }
    return { success: false, message: 'Invalid email or password' }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('currentUser')
  }

  return (
    <MessagesProvider>
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
                <Dashboard user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerDashboard user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerAppointmentsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerPatientsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerStaffPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerReportsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerBillingPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <OwnerSubscriptionPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} onBetaActivate={handleOwnerBetaActivate} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/speech-to-text"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerSpeechToTextPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/text-to-speech"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerTextToSpeechPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistDashboard user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistPatientsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistAppointmentsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistSubscriptionPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistNotesProgressPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistAssignExercisesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/speech-to-text"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistSpeechToTextPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/text-to-speech"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistTextToSpeechPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patient/speech-to-text"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientSpeechToTextPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patient/text-to-speech"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientTextToSpeechPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/speech-features"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerSpeechFeaturesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/speech-features"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistSpeechFeaturesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patient/speech-features"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientSpeechFeaturesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/gamified-activities"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerGamifiedActivitiesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/gamified-activities"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistGamifiedActivitiesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/profile"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistProfilePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/therapist/reports"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistReportPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/profile"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <AdminProfilePage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/profile"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerProfilePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patient/profile"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientProfilePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patient/gamified-activities"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientGamifiedActivitiesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <AppointmentsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <NotesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <MessagesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patient/email"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientEmailPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <SubscriptionPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <SettingsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <HelpPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <UpdatePaymentPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <PaymentHistoryPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
    </MessagesProvider>
  )
}

export default App
