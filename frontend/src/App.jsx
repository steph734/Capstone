import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { MessagesProvider } from './context/MessagesContext'
import { ProgressProvider } from './context/ProgressContext'
import { AnalyticsProvider } from './context/AnalyticsContext'
import { loadAccessibilityPrefs, applyAccessibilityPrefs } from './utils/accessibilityPrefs'
import { getResetPassword } from './utils/passwordResets'
import { TEMP_USERS, getEffectiveUsers, setCredentialOverride } from './utils/accounts'
import { sha256Hex } from './utils/hash'
import './GlobalToast.css'
import Splash from './pages/Splash'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import VerifyOtp from './pages/VerifyOtp'
import ForgotPassword from './pages/ForgotPassword'
import VerifyResetOtp from './pages/VerifyResetOtp'
import ResetPassword from './pages/ResetPassword'
import StaffSetup from './pages/StaffSetup'
import SetPassword from './pages/SetPassword'
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
import GamifiedLibraryDashboardPage from './pages/admin/GamifiedLibraryDashboardPage'
import GamifiedBadgesPage from './pages/admin/GamifiedBadgesPage'
import GamifiedStatsPage from './pages/admin/GamifiedStatsPage'
import AuditLogsPage from './pages/admin/AuditLogsPage'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import OwnerAppointmentsPage from './pages/owner/OwnerAppointmentsPage'
import OwnerPatientsPage from './pages/owner/OwnerPatientsPage'
import OwnerStaffPage from './pages/owner/OwnerStaffPage'
import OwnerReportsPage from './pages/owner/OwnerReportsPage'
import OwnerBillingPage from './pages/owner/OwnerBillingPage'
import OwnerBillingInvoicesPage from './pages/owner/OwnerBillingInvoicesPage'
import OwnerBillingPayoutsPage from './pages/owner/OwnerBillingPayoutsPage'
import OwnerBillingSettingsPage from './pages/owner/OwnerBillingSettingsPage'
import OwnerSubscriptionPage from './pages/owner/OwnerSubscriptionPage'
import OwnerSpeechToTextPage from './pages/owner/OwnerSpeechToTextPage'
import OwnerTextToSpeechPage from './pages/owner/OwnerTextToSpeechPage'
import OwnerSpeechFeaturesPage from './pages/owner/OwnerSpeechFeaturesPage'
import OwnerGamifiedActivitiesPage from './pages/owner/OwnerGamifiedActivitiesPage'
import OwnerActivityLibraryPage from './pages/owner/OwnerActivityLibraryPage'
import OwnerRequestGamePage from './pages/owner/OwnerRequestGamePage'
import OwnerSettingsPage from './pages/owner/OwnerSettingsPage'
import TherapistSpeechToTextPage from './pages/therapist/TherapistSpeechToTextPage'
import TherapistTextToSpeechPage from './pages/therapist/TherapistTextToSpeechPage'
import TherapistSpeechFeaturesPage from './pages/therapist/TherapistSpeechFeaturesPage'
import TherapistGamifiedActivitiesPage from './pages/therapist/TherapistGamifiedActivitiesPage'
import TherapistActivityLibraryPage from './pages/therapist/TherapistActivityLibraryPage'
import PatientSpeechToTextPage from './pages/PatientSpeechToTextPage'
import PatientTextToSpeechPage from './pages/PatientTextToSpeechPage'
import PatientSpeechFeaturesPage from './pages/PatientSpeechFeaturesPage'
import PatientGamifiedActivitiesPage from './pages/PatientGamifiedActivitiesPage'
import PatientProgressPage from './pages/PatientProgressPage'
import PatientEmailPage from './pages/PatientEmailPage'
import TherapistDashboard from './pages/therapist/TherapistDashboard'
import TherapistPatientsPage from './pages/therapist/TherapistPatientsPage'
import TherapistAppointmentsPage from './pages/therapist/TherapistAppointmentsPage'
import TherapistAttendancePage from './pages/therapist/TherapistAttendancePage'
import TherapistNotesProgressPage from './pages/therapist/TherapistNotesProgressPage'
import TherapistAssignExercisesPage from './pages/therapist/TherapistAssignExercisesPage'
import TherapistSubscriptionPage from './pages/therapist/TherapistSubscriptionPage'
import TherapistProfilePage from './pages/therapist/TherapistProfilePage'
import TherapistReportPage from './pages/therapist/TherapistReportPage'
import AdminProfilePage from './pages/admin/AdminProfilePage'
import OwnerProfilePage from './pages/owner/OwnerProfilePage'
import PatientProfilePage from './pages/PatientProfilePage'

// Prototype accounts and the "effective login email" logic live in
// ./utils/accounts so the forgot-password flow can resolve accounts the same way.

const getHomePath = (role) => {
  if (role === 'Super Admin') return '/admin/dashboard'
  if (role === 'Owner') return '/owner/dashboard'
  if (role === 'Therapist') return '/therapist/dashboard'
  return '/dashboard'
}

// Login wrapper to handle authentication
function LoginWrapper({ onLogin }) {
  const navigate = useNavigate()
  
  const handleLogin = async (email, password) => {
    const result = await onLogin(email, password)
    if (result.success) {
      navigate(getHomePath(result.user?.role))
    } else if (result.requiresVerification) {
      navigate('/verify-otp', { state: { email: result.email || email } })
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
  // The paid, active subscription tier ('silver' | 'gold' | null). Set once a
  // Stripe payment succeeds; supersedes the beta preview flag above.
  const [ownerActivePlan, setOwnerActivePlan] = useState(() => localStorage.getItem('activePlan') || null)
  // ISO date string when the current plan is on a free trial, else null.
  const [ownerPlanTrialEnds, setOwnerPlanTrialEnds] = useState(() => localStorage.getItem('activePlanTrialEnds') || null)
  // Shown as a top-right toast right after a successful login, on whichever
  // dashboard the user lands on — cleared automatically after a few seconds.
  const [loginToast, setLoginToast] = useState(null)

  useEffect(() => {
    applyAccessibilityPrefs(loadAccessibilityPrefs())
  }, [])

  useEffect(() => {
    if (!loginToast) return
    const timer = setTimeout(() => setLoginToast(null), 3500)
    return () => clearTimeout(timer)
  }, [loginToast])

  const handleOwnerBetaActivate = (tier) => {
    setOwnerBetaTier(tier)
    if (tier) {
      localStorage.setItem('betaTier', tier)
    } else {
      localStorage.removeItem('betaTier')
    }
  }

  const handleOwnerPlanActivate = (tier, { trial = false } = {}) => {
    setOwnerActivePlan(tier)
    if (tier) {
      localStorage.setItem('activePlan', tier)
      // A paid plan replaces the beta preview — drop the beta tags/features.
      setOwnerBetaTier(null)
      localStorage.removeItem('betaTier')

      if (trial) {
        const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        setOwnerPlanTrialEnds(ends)
        localStorage.setItem('activePlanTrialEnds', ends)
      } else {
        setOwnerPlanTrialEnds(null)
        localStorage.removeItem('activePlanTrialEnds')
      }
    } else {
      localStorage.removeItem('activePlan')
      setOwnerPlanTrialEnds(null)
      localStorage.removeItem('activePlanTrialEnds')
    }
  }

  const handleLogin = async (email, password) => {
    const typedEmail = String(email || '').trim().toLowerCase()

    // 1. Local check: built-in password, or one set via the reset flow in THIS
    //    browser. A local reset password replaces the built-in one.
    let matchedUser = getEffectiveUsers().find((user) => {
      if (user.email.trim().toLowerCase() !== typedEmail) return false
      const resetPassword = getResetPassword(user.email)
      return resetPassword ? password === resetPassword : password === user.password
    })

    // Hash before it ever hits the wire — the network payload (and any request
    // logs) should never carry the raw password, only this digest. The server
    // treats it as an opaque string, so it must be hashed the same way here as
    // it was when the password was set (see SignUp.jsx and ResetPassword.jsx).
    const passwordHash = await sha256Hex(password)

    // 2. Server check: a password changed on another browser/device lives only in
    //    the shared store. Ask the API to verify it and tell us which account.
    if (!matchedUser) {
      try {
        const res = await fetch('/api/verify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: typedEmail, password: passwordHash }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data.match) {
            const base = TEMP_USERS.find((user) => user.role === data.role)
            if (base) matchedUser = { ...base, email: typedEmail }
          }
        }
      } catch {
        // API unreachable (offline, or plain `npm run dev`) — step 1 is all we have.
      }
    }

    // 3. MongoDB check: accounts created through the Sign Up page live in the
    //    `users` collection, served by the Vercel function at /api/auth/login
    //    (frontend/api/_lib/routes/auth-login.js) — same origin, so it works
    //    both locally (`vercel dev`) and once deployed.
    if (!matchedUser) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: typedEmail, password: passwordHash }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.user) {
          matchedUser = { avatar: '/therapy-pro-logo.png', ...data.user }
        } else if (res.status === 403 && data.requiresVerification) {
          // Right password, but the email was never confirmed. The backend just
          // re-sent a code — route the user to the verification screen.
          return {
            success: false,
            requiresVerification: true,
            email: data.email || typedEmail,
            message: data.error || 'Please verify your email to continue.',
          }
        } else if (res.status === 423) {
          // 3 failed attempts in a row locks the account for 5 minutes.
          const mins = data.lockUntil
            ? Math.max(1, Math.ceil((new Date(data.lockUntil).getTime() - Date.now()) / 60000))
            : 5
          return {
            success: false,
            locked: true,
            message: data.error || `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
          }
        }
      } catch {
        // /api not reachable (plain `npm run dev`) — fall through to "invalid" below.
      }
    }

    if (matchedUser) {
      setIsAuthenticated(true)
      setCurrentUser(matchedUser)
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('currentUser', JSON.stringify(matchedUser))
      setLoginToast('Login successful!')
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

  const handleUpdateUser = (updates) => {
    setCurrentUser((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem('currentUser', JSON.stringify(next))

      // A profile email change automatically becomes the login email for this role.
      if (updates.email && updates.email !== prev?.email && prev?.role) {
        setCredentialOverride(prev.role, { email: updates.email })
      }

      return next
    })
  }

  return (
    <MessagesProvider>
    <ProgressProvider>
    <AnalyticsProvider>
    <Router>
      {loginToast && (
        <div className="global-toast-success" role="status" aria-live="polite">
          <span className="global-toast-icon">✓</span>
          {loginToast}
        </div>
      )}
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
          path="/verify-otp"
          element={<VerifyOtp />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/verify-reset-otp"
          element={<VerifyResetOtp />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/staff-setup"
          element={<StaffSetup />}
        />

        <Route
          path="/set-password"
          element={<SetPassword />}
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
          path="/owner/billing/invoices"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerBillingInvoicesPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/billing/payouts"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerBillingPayoutsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/billing/settings"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerBillingSettingsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={currentUser?.role === 'Super Admin' ? '/admin/dashboard' : '/dashboard'} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/settings"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerSettingsPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
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
                <OwnerSubscriptionPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} onBetaActivate={handleOwnerBetaActivate} activePlan={ownerActivePlan} planTrialEnds={ownerPlanTrialEnds} onPlanActivate={handleOwnerPlanActivate} />
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
          path="/therapist/attendance"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistAttendancePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
          path="/owner/gamified-activities/library"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerActivityLibraryPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner/gamified-activities/request"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Owner' ? (
                <OwnerRequestGamePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
          path="/therapist/gamified-activities/games"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Therapist' ? (
                <TherapistActivityLibraryPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <TherapistProfilePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} onUpdateUser={handleUpdateUser} />
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
                <AdminProfilePage user={currentUser} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
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
                <OwnerProfilePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} onUpdateUser={handleUpdateUser} />
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
                <PatientProfilePage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} onUpdateUser={handleUpdateUser} />
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
          path="/patient/progress"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Patient' ? (
                <PatientProgressPage user={currentUser} onLogout={handleLogout} betaTier={ownerBetaTier} />
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
                <GamifiedLibraryDashboardPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/games-library/games"
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
          path="/admin/games-library/badges"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <GamifiedBadgesPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/games-library/stats"
          element={
            isAuthenticated ? (
              currentUser?.role === 'Super Admin' ? (
                <GamifiedStatsPage user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to={getHomePath(currentUser?.role)} replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="/admin/games-library/points" element={<Navigate to="/admin/games-library/stats" replace />} />

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
    </AnalyticsProvider>
    </ProgressProvider>
    </MessagesProvider>
  )
}

export default App
