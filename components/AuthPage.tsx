
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { saveAuthMetadata, setSessionBirth, setAuthHardLock } from '../services/db';
import { Activity, Lock, Mail, User, ArrowLeft, Loader2, Stethoscope, ShieldCheck, CheckCircle } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        // 1. Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data.user) {
          // 2. Generate NEW Session ID (Forced Takeover Strategy)
          // Robust ID for older browsers
          const newSessionId = (crypto && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
          
          // 3. Mark the birth of this session locally
          setSessionBirth();
          setAuthHardLock(false);

          // 4. Update Database PROFILE while authenticated
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              active_session_id: newSessionId,
              last_login_device: navigator.userAgent
            })
            .eq('id', data.user.id);
          
          if (updateError) throw updateError;

          // 5. Save to permanent local storage (IndexedDB)
          await saveAuthMetadata({ 
            sessionId: newSessionId, 
            isApproved: true 
          });

          // 6. Success
          onAuthSuccess();
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        setMessage('لینک تایید به ایمیل شما ارسال شد. لطفا ایمیل خود را چک کنید.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'خطا در برقراری ارتباط');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row-reverse animate-fade-in border border-white/50">
        
        {/* Form Section */}
        <div className="flex-1 p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-200 transform rotate-3">
              <Stethoscope size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">طبیب هوشمند</h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">دستیار هوشمند پزشکان و متخصصان</p>
          </div>

          {/* Toggle */}
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8 relative">
            <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${isLogin ? 'right-1.5' : 'right-[calc(50%+4px)]'}`}></div>
            <button 
              onClick={() => { setIsLogin(true); setError(null); setMessage(null); }} 
              className={`flex-1 py-2.5 text-sm font-bold relative z-10 transition-colors ${isLogin ? 'text-blue-700' : 'text-gray-500'}`}
            >
              ورود
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); setMessage(null); }} 
              className={`flex-1 py-2.5 text-sm font-bold relative z-10 transition-colors ${!isLogin ? 'text-blue-700' : 'text-gray-500'}`}
            >
              ثبت‌نام
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 mr-1">نام و نام خانوادگی</label>
                <div className="relative">
                  <User className="absolute right-3 top-3.5 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-700 placeholder-gray-300"
                    placeholder="دکتر ..."
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 mr-1">ایمیل</label>
              <div className="relative">
                <Mail className="absolute right-3 top-3.5 text-gray-400" size={18} />
                <input 
                  type="email" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-700 placeholder-gray-300 text-left"
                  placeholder="name@example.com"
                  dir="ltr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 mr-1">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-3.5 text-gray-400" size={18} />
                <input 
                  type="password" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-700 placeholder-gray-300 text-left"
                  placeholder="••••••••"
                  dir="ltr"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 flex items-center gap-2">
                <ShieldCheck size={16} />
                {error.includes('Invalid login') ? 'ایمیل یا رمز عبور اشتباه است' : error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 text-green-600 text-xs font-bold p-3 rounded-xl border border-green-100 flex items-center gap-2">
                <CheckCircle size={16} /> 
                {message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none mt-6"
            >
              {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'ورود به حساب' : 'ایجاد حساب کاربری')}
              {!loading && <ArrowLeft size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
