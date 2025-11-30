
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Fingerprint, Loader, LogIn, UserPlus, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: { full_name: fullName }
            }
        });
        if (error) throw error;
        alert("ثبت نام موفقیت آمیز بود! اکنون وارد شوید.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در عملیات احراز هویت');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Biometric Visual Header */}
        <div className="bg-medical-600 h-40 flex flex-col items-center justify-center text-white relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className={`p-4 rounded-full border-4 border-white/20 mb-2 transition-transform duration-700 ${loading ? 'scale-110 animate-pulse bg-medical-500' : 'bg-medical-700'}`}>
                {loading ? <Loader size={48} className="animate-spin"/> : <Fingerprint size={48} />}
            </div>
            <h1 className="text-2xl font-black tracking-tight">ورود امن دکتریار</h1>
            <p className="text-medical-200 text-sm">سیستم هوشمند کلینیک</p>
        </div>

        <div className="p-8">
            <h2 className="text-center text-gray-800 font-bold text-lg mb-6">
                {isLogin ? 'لطفاً هویت خود را تایید کنید' : 'ایجاد حساب کاربری جدید'}
            </h2>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 text-center border border-red-100">{error}</div>}

            <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                    <div className="relative">
                        <input 
                            type="text" 
                            required 
                            placeholder="نام و نام خانوادگی"
                            className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none transition-all"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                        />
                        <UserPlus size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                )}
                
                <div className="relative">
                    <input 
                        type="email" 
                        required 
                        placeholder="ایمیل / شناسه کاربری"
                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none transition-all dir-ltr"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <LogIn size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                </div>

                <div className="relative">
                    <input 
                        type="password" 
                        required 
                        placeholder="رمز عبور"
                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none transition-all dir-ltr"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <ShieldCheck size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? 'در حال پردازش...' : (isLogin ? 'ورود با اثر انگشت / رمز' : 'ثبت نام در سیستم')}
                </button>
            </form>

            <div className="mt-6 text-center">
                <button 
                    onClick={() => setIsLogin(!isLogin)} 
                    className="text-sm text-medical-600 font-bold hover:underline"
                >
                    {isLogin ? 'حساب کاربری ندارید؟ ثبت نام کنید' : 'قبلاً ثبت نام کرده‌اید؟ وارد شوید'}
                </button>
            </div>
        </div>
        
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Powered by Gemini AI & Supabase Secure Core</p>
        </div>
      </div>
    </div>
  );
};
