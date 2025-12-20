
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
import { Loader2, LogOut, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';

function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.PRESCRIPTION);
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  
  // --- INSTANT-FLIGHT AUTH LOGIC ---
  const hasLocalKey = !!localStorage.getItem('tabib_session_id');
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(!hasLocalKey); 
  const [isApproved, setIsApproved] = useState<boolean | null>(hasLocalKey ? true : null);
  const [securityStatus, setSecurityStatus] = useState<'idle' | 'syncing' | 'verified' | 'offline'>('idle');

  // --- AUTO-DISMISS TIMER ---
  useEffect(() => {
    let timer: any;
    if (securityStatus === 'verified' || securityStatus === 'offline') {
      timer = setTimeout(() => {
        setSecurityStatus('idle');
      }, 3000); // Dissapear after 3 seconds
    }
    return () => clearTimeout(timer);
  }, [securityStatus]);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession) {
        verifySecurityInBackground(currentSession.user.id);
      } else {
        setAuthLoading(false);
        setIsApproved(null);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
         verifySecurityInBackground(newSession.user.id);
      } else {
         setAuthLoading(false);
         setIsApproved(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const verifySecurityInBackground = async (userId: string) => {
    setSecurityStatus('syncing');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Verification Timeout")), 3000)
    );

    const verificationPromise = (async () => {
      if (!navigator.onLine) throw new Error("Offline");

      const { data, error } = await supabase
        .from('profiles')
        .select('is_approved, active_session_id')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    })();

    try {
      const result: any = await Promise.race([verificationPromise, timeoutPromise]);
      setIsApproved(result.is_approved);
      
      const localSessionId = localStorage.getItem('tabib_session_id');
      if (result.active_session_id && localSessionId && result.active_session_id !== localSessionId) {
          alert('امنیت: این حساب در دستگاه دیگری باز شده است. خروج اجباری...');
          handleSignOutForced();
          return;
      }

      setSecurityStatus('verified');
      setAuthLoading(false);
    } catch (e: any) {
      if (hasLocalKey) {
        setIsApproved(true);
        setSecurityStatus('offline');
      } else {
        setIsApproved(false);
      }
      setAuthLoading(false);
    }
  };

  const handleSignOutForced = async () => {
    localStorage.removeItem('tabib_session_id');
    await supabase.auth.signOut();
    setSession(null);
    setIsApproved(null);
    setAuthLoading(false);
    window.location.reload();
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
           <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-50 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
           </div>
           <div className="text-center space-y-1">
              <p className="text-gray-800 font-black text-xl">طبیب هوشمند</p>
              <p className="text-gray-400 text-sm font-medium animate-pulse">در حال آماده‌سازی آنی سیستم...</p>
           </div>
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
               <button onClick={handleSignOutForced} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200"><LogOut size={20} /></button>
            </div>
         </div>
      </div>
    );
  }

  return (
    <>
      {/* 
         DYNAMIC ISLAND STATUS CAPSULE 
         - Centered on mobile to avoid overlapping buttons
         - Side-aligned on desktop for focus
         - Automatically dismisses after success/offline detected
      */}
      <div className="fixed top-2.5 lg:top-4 left-1/2 -translate-x-1/2 lg:left-10 lg:translate-x-0 z-[100] pointer-events-none transition-all duration-500">
        {securityStatus === 'syncing' && (
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-blue-100 animate-slide-down">
             <Loader2 size={14} className="text-blue-500 animate-spin" />
             <span className="text-[11px] font-black text-blue-700 whitespace-nowrap">همگام‌سازی امنیتی...</span>
          </div>
        )}
        {securityStatus === 'verified' && (
          <div className="flex items-center gap-2 bg-emerald-50/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-emerald-100 animate-slide-down">
             <ShieldCheck size={14} className="text-emerald-500" />
             <span className="text-[11px] font-black text-emerald-700 whitespace-nowrap">امنیت تایید شد</span>
          </div>
        )}
        {securityStatus === 'offline' && (
          <div className="flex items-center gap-2 bg-amber-50/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-amber-100 animate-slide-down">
             <ShieldAlert size={14} className="text-amber-500" />
             <span className="text-[11px] font-black text-amber-700 whitespace-nowrap">حالت آفلاین امن</span>
          </div>
        )}
      </div>

      <Layout currentRoute={currentRoute} onNavigate={(route) => handleNavigate(route)}>
        {renderContent()}
      </Layout>
    </>
  );
}

export default App;
