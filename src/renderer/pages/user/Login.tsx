import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Lock, Mail, Loader2, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Mocking authentication delay
    await new Promise(r => setTimeout(r, 1200));
    
    setIsLoading(false);
    navigate('/user/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-purple-500/30 flex items-center justify-center relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
        <div className="w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full absolute -top-40 -left-40" />
        <div className="w-[600px] h-[600px] bg-cyan-600/10 blur-[120px] rounded-full absolute -bottom-40 -right-40" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo/Header */}
        <div className="flex flex-col items-center justify-center mb-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-2xl border border-white/10 shadow-2xl shadow-purple-500/20 flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-2">
            Viral Studio
          </h1>
          <p className="text-zinc-500 text-sm">
            {isLogin ? 'Sign in to your AI workspace.' : 'Create an account to start creating.'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-zinc-500" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-zinc-600"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">Password</label>
                {isLogin && (
                  <a href="#" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Forgot password?</a>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-zinc-500" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-zinc-600"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-4 relative w-full overflow-hidden group rounded-xl p-[1px]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 rounded-xl opacity-70 group-hover:opacity-100 transition-opacity blur-sm"></span>
              <div className="relative w-full flex items-center justify-center gap-2 bg-zinc-950 px-6 py-3.5 rounded-xl border border-white/10 transition-colors group-hover:bg-zinc-900/80">
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <span className="font-semibold text-white">Authenticating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-white tracking-wide">
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-white" />
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="mt-8 text-center relative z-10">
            <p className="text-sm text-zinc-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              {' '}
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Subtle overlay gradient to blend bottom */}
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-600/5 blur-[80px] rounded-full pointer-events-none" />
        </div>
      </motion.div>
    </div>
  );
}
