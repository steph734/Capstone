import { useState } from 'react'
import Splash from './pages/Splash'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'

function App() {
  const [page, setPage] = useState('splash')

  if (page === 'forgot-password') {
    return (
      <ForgotPassword
        onLogoClick={() => setPage('splash')}
        onSignInClick={() => setPage('login')}
      />
    )
  }

  if (page === 'signup') {
    return (
      <SignUp
        onLogoClick={() => setPage('splash')}
        onLoginClick={() => setPage('login')}
      />
    )
  }

  if (page === 'login') {
    return (
      <Login
        onLogoClick={() => setPage('splash')}
        onSignUpClick={() => setPage('signup')}
        onForgotPasswordClick={() => setPage('forgot-password')}
      />
    )
  }

  return <Splash onLogoClick={() => setPage('login')} />
}

export default App
