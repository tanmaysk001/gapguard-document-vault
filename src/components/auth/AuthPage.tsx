
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GapGuard</h1>
          <p className="text-gray-600 mb-8">Secure Document Management Platform</p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setIsSignUp(false)}
                className={`flex-1 rounded-md py-2 px-4 text-sm font-medium transition-colors ${
                  !isSignUp
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsSignUp(true)}
                className={`flex-1 rounded-md py-2 px-4 text-sm font-medium transition-colors ${
                  isSignUp
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            {isSignUp ? (
              <SignUp 
                appearance={{
                  elements: {
                    rootBox: "mx-auto",
                    card: "shadow-none border-0"
                  }
                }}
                forceRedirectUrl="/dashboard"
                signInFallbackRedirectUrl="/dashboard"
              />
            ) : (
              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "mx-auto",
                    card: "shadow-none border-0"
                  }
                }}
                forceRedirectUrl="/dashboard"
                signUpFallbackRedirectUrl="/dashboard"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
