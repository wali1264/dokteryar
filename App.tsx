
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PatientIntake from './pages/PatientIntake';
import Diagnosis from './pages/Diagnosis';
import Laboratory from './pages/Laboratory';
import Radiology from './pages/Radiology';
import PhysicalExam from './pages/PhysicalExam';
import Cardiology from './pages/Cardiology';
import Neurology from './pages/Neurology';
import Psychology from './pages/Psychology';
import Ophthalmology from './pages/Ophthalmology';
import Pediatrics from './pages/Pediatrics';
import Orthopedics from './pages/Orthopedics';
import Dentistry from './pages/Dentistry';
import Gynecology from './pages/Gynecology';
import Pulmonology from './pages/Pulmonology';
import Gastroenterology from './pages/Gastroenterology';
import Urology from './pages/Urology';
import Hematology from './pages/Hematology';
import Emergency from './pages/Emergency';
import Genetics from './pages/Genetics';
import Prescription from './pages/Prescription';
import Settings from './pages/Settings';
import AuthPage from './components/AuthPage';
import { AppRoute, PatientRecord } from './types';
import { keyManager } from './services/geminiService';
import { supabase } from './services/supabase';
import { Loader2, LogOut, Clock } from 'lucide-react';

function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.PRESCRIPTION);
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  
  // --- Auth State ---
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkUserStatus(session.user.id);
      else setAuthLoading(false);
    });

    // 2. Real-time Auth Listeners
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         setAuthLoading(true);
         checkUserStatus(session.user.id);
      } else {
         setAuthLoading(false);
         setIsApproved(null);
      }
    });

    // 3. Re-validation on Reconnect (SECURITY ENFORCEMENT)
    const handleOnline = () => {
      if (supabase.auth.getUser()) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) checkUserStatus(user.id);
        });
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // --- Real-time Session Invalidation (Online Only) ---
  useEffect(() => {
    if (!session?.user?.id || !navigator.onLine) return;

    const channel = supabase.channel('security_check')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
            (payload) => {
                const newSessionId = payload.new.active_session_id;
                const localSessionId = localStorage.getItem('tabib_session_id');
                
                if (localSessionId && newSessionId && newSessionId !== localSessionId) {
                    alert('حساب کاربری شما در دستگاه دیگری وارد شده است. جهت امنیت، دسترسی این دستگاه قطع می‌گردد.');
                    handleSignOut();
                }
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const checkUserStatus = async (userId: string) => {
    // HYBRID AUTH LOGIC:
    // If offline, assume the user is still valid if they have a local session.
    // Re-validation will happen automatically when they go back online.
    if (!navigator.onLine) {
      const hasLocalSession = !!localStorage.getItem('tabib_session_id');
      if (hasLocalSession) {
        setIsApproved(true); // Temporary trust in offline mode
      } else {
        await handleSignOut();
      }
      setAuthLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_approved, active_session_id')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
         console.error('Error fetching profile:', error);
      }

      // 1. Approval Check
      setIsApproved(data?.is_approved ?? false);

      // 2. Strict Session Integrity Check (Online)
      const localSessionId = localStorage.getItem('tabib_session_id');
      const dbSessionId = data?.active_session_id;

      if (dbSessionId && localSessionId && dbSessionId !== localSessionId) {
          await handleSignOut();
          alert('جلسه کاری شما منقضی شده یا در دستگاه دیگری وارد شده‌اید.');
          return;
      }

      // Self-healing for migration or sync issues
      if (!dbSessionId && localSessionId) {
          await supabase.from('profiles').update({ active_session_id: localSessionId }).eq('id', userId);
      }

    } catch (e) {
      console.error(e);
      // In case of unknown error (like network timeout), allow access if they have a local session
      if (localStorage.getItem('tabib_session_id')) setIsApproved(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (session?.user?.id && navigator.onLine) {
         await supabase.from('profiles').update({ 
           active_session_id: null,
           last_login_device: null 
         }).eq('id', session.user.id);
      }
    } catch (e) { console.error("Error cleaning session:", e); }

    localStorage.removeItem('tabib_session_id');
    await supabase.auth.signOut();
    setSession(null);
    setIsApproved(null);
  };

  const handleNavigate = (route: AppRoute, record?: PatientRecord) => {
    if (record) setCurrentRecord(record);
    setCurrentRoute(route);
  };

  const handleIntakeSubmit = (record: PatientRecord) => {
    setCurrentRecord(record);
    setCurrentRoute(AppRoute.DIAGNOSIS);
  };

  const renderContent = () => {
    switch (currentRoute) {
      case AppRoute.DASHBOARD: return <Dashboard onNavigate={handleNavigate} />;
      case AppRoute.INTAKE: return <PatientIntake onSubmit={handleIntakeSubmit} />;
      case AppRoute.DIAGNOSIS: return <Diagnosis patientRecord={currentRecord} onNavigate={handleNavigate} />;
      case AppRoute.PRESCRIPTION: return <Prescription initialRecord={currentRecord} />;
      case AppRoute.SETTINGS: return <Settings />;
      case AppRoute.LABORATORY: return <Laboratory />;
      case AppRoute.RADIOLOGY: return <Radiology />;
      case AppRoute.PHYSICAL_EXAM: return <PhysicalExam />;
      case AppRoute.CARDIOLOGY: return <Cardiology />;
      case AppRoute.NEUROLOGY: return <Neurology />;
      case AppRoute.PSYCHOLOGY: return <Psychology />;
      case AppRoute.OPHTHALMOLOGY: return <Ophthalmology />;
      case AppRoute.PEDIATRICS: return <Pediatrics />;
      case AppRoute.ORTHOPEDICS: return <Orthopedics />;
      case AppRoute.DENTISTRY: return <Dentistry />;
      case AppRoute.GYNECOLOGY: return <Gynecology />;
      case AppRoute.PULMONOLOGY: return <Pulmonology />;
      case AppRoute.GASTROENTEROLOGY: return <Gastroenterology />;
      case AppRoute.UROLOGY: return <Urology />;
      case AppRoute.HEMATOLOGY: return <Hematology />;
      case AppRoute.EMERGENCY: return <Emergency />;
      case AppRoute.GENETICS: return <Genetics />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
           <p className="text-gray-500 font-medium text-sm animate-pulse">در حال آماده‌سازی میز کار...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  if (isApproved === false) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4 font-sans" dir="rtl">
         <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center border border-amber-100">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
               <Clock size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">در انتظار تایید مدیر</h2>
            <p className="text-gray-600 leading-relaxed mb-8 text-sm">
               دسترسی شما پس از بررسی توسط مدیریت فعال خواهد شد.
            </p>
            <div className="flex gap-3">
               <button onClick={() => window.location.reload()} className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-amber-600">بررسی مجدد</button>
               <button onClick={handleSignOut} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200"><LogOut size={20} /></button>
            </div>
         </div>
      </div>
    );
  }

  return (
    <Layout currentRoute={currentRoute} onNavigate={(route) => handleNavigate(route)}>
      {renderContent()}
    </Layout>
  );
}

export default App;
