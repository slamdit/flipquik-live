import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        await auth.signUp(email, password, fullName);
        toast.success('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
      } else {
        await auth.signIn(email, password);
        navigate('/Dashboard', { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Zap className="w-8 h-8 text-amber-400" />
        <span className="text-3xl font-bold text-white tracking-tight">FlipQuik</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        {/* Tab switcher */}
        <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="h-11 mt-1"
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 mt-1"
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              </div>
            ) : (
              mode === 'signup' ? 'Create Account' : 'Sign In'
            )}
          </Button>
        </form>

        {mode === 'signup' && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Free plan includes 3 months of full access from signup.
          </p>
        )}
      </div>
    </div>
  );
}
