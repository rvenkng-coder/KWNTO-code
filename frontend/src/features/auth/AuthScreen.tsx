import { useState } from 'react'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'
import { useSession } from './useSession'

type View = 'signin' | 'signup'

export function AuthScreen() {
  const [view, setView] = useState<View>('signin')
  const { user } = useSession()

  if (user) {
    return null // AuthScreen is only shown when not signed in
  }

  return (
    <div>
      {view === 'signin' ? (
        <>
          <SignInForm />
          <p>
            Don't have an account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setView('signup') }}>
              Sign up
            </a>
          </p>
        </>
      ) : (
        <>
          <SignUpForm />
          <p>
            Already have an account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setView('signin') }}>
              Sign in
            </a>
          </p>
        </>
      )}
    </div>
  )
}
