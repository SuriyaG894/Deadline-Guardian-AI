import React, { useState } from 'react';
import { 
  auth,
  logInWithEmail, 
  signUpWithEmail, 
  signInWithGoogleCalendar,
  seedUserData,
  saveUserMetadata
} from '../firebase';
import { Bot, Mail, Lock, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Please enter your name.');
        }
        const userCred = await signUpWithEmail(email, password, name);
        // Seed initial mock data for this user in Firestore so they get a functional playground
        if (userCred.user) {
          await seedUserData(userCred.user.uid, email, name);
        }
      } else {
        const userCred = await logInWithEmail(email, password);
        // Ensure user document exists or seed it if needed
        if (userCred.user) {
          await seedUserData(userCred.user.uid, email, userCred.user.displayName || "User");
        }
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email already exists.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Invalid email address format.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      // Connects Google Calendar and authenticates via Google
      const token = await signInWithGoogleCalendar();
      const currentUser = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user: any) => {
          unsubscribe();
          resolve(user);
        });
      }) as any;

      if (currentUser) {
        await seedUserData(currentUser.uid, currentUser.email || "", currentUser.displayName || "User");
        if (token) {
          // Save Google token in user metadata
          await saveUserMetadata(currentUser.uid, {
            calendarConnected: true,
            googleAccessToken: token
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const demoUser = {
        uid: 'demo-user',
        email: 'demo@guardian.ai',
        displayName: 'Demo Commander'
      };
      localStorage.setItem('guardian_demo_user', JSON.stringify(demoUser));
      // Seed user data locally
      await seedUserData(demoUser.uid, demoUser.email, demoUser.displayName);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setError('Failed to initialize local sandbox mode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col justify-center items-center px-4 relative overflow-hidden" id="auth-page-root">
      {/* Background Decorative Rings */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-red-950/10 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-red-900/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-red-900/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 bg-red-600 rounded-2xl items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)] transform hover:scale-105 transition duration-200">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-wider text-white">DEADLINE GUARDIAN AI</h1>
            <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase">Cognitive Chief of Staff for High-Stakes Deadlines</p>
          </div>
        </div>

        {/* Card Frame */}
        <div className="bg-[#111114]/90 border border-[#262626]/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {isRegister ? 'Create Secure Account' : 'Access Shield'}
            </h2>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-red-500 hover:text-red-400 font-bold uppercase tracking-wider transition duration-150 cursor-pointer"
            >
              {isRegister ? 'Sign In Instead' : 'Register Account'}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl text-red-400 text-xs leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Your Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Suriya Ganesh"
                    className="w-full bg-[#050505] border border-[#262626] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition duration-150"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full bg-[#050505] border border-[#262626] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition duration-150"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Passphrase</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#050505] border border-[#262626] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition duration-150"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-red-600 hover:bg-red-500 disabled:opacity-55 text-white font-bold rounded-xl text-sm transition duration-150 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)] cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'INITIALIZE SYSTEM' : 'AUTHENTICATE'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 h-px bg-zinc-800" />
            <span className="relative bg-[#111114] px-3.5 text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
              OR CHOOSE SECURE PROVIDER
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-11 bg-zinc-900 border border-[#262626] hover:bg-[#1c1c21] text-zinc-300 font-bold rounded-xl text-xs transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer uppercase"
          >
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={loading}
            className="w-full h-11 bg-red-950/30 border border-red-900/40 hover:bg-red-900/20 text-red-400 hover:text-red-300 font-bold rounded-xl text-xs transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer uppercase shadow-[0_0_15px_rgba(220,38,38,0.1)]"
          >
            <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Enter Demo Sandbox Mode</span>
          </button>
        </div>


        {/* Dynamic Safeguard Warning */}
        <div className="flex justify-center items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-red-500/60" />
          <span>REAL-TIME COGNITIVE PROTECTION ACTIVATED</span>
        </div>
      </div>
    </div>
  );
}
