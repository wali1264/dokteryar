
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
import AuthPage from './components/AuthPage'; // New Auth Component
import { AppRoute, PatientRecord } from './types';
import { keyManager } from './services/geminiService';
import { supabase } from './services/supabase'; // Database connection
import { Loader2, ShieldAlert, LogOut, Clock } from 'lucide-react';

function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.PRESCRIPTION);
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  
  // --- Auth State ---
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null); // null = checking, false = pending, true = approved

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkUserApproval(session.user.id);
      else setAuthLoading(false);
    });

    // 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         setAuthLoading(true);
         checkUserApproval(session.user.id);
      } else {
         setAuthLoading(false);
         setIsApproved(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserApproval = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
         console.error('Error fetching profile:', error);
      }

      // If data exists, use value. If not (maybe trigger lag), default false.
      setIsApproved(data?.is_approved ?? false);
    } catch (e) {
      console.error(e);
      setIsApproved(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsApproved(null);
  };

  const handleNavigate = (route: AppRoute, record?: PatientRecord) => {
    if (record) {
      setCurrentRecord(record);
    }
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

  // --- 1. Loading Screen ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
           <p className="text-gray-500 font-medium text-sm animate-pulse">در حال بررسی هویت...</p>
        </div>
      </div>
    );
  }

  // --- 2. Auth Screen (Login/Signup) ---
  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  // --- 3. Pending Approval Screen (The Gatekeeper) ---
  if (isApproved === false) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4 font-sans" dir="rtl">
         <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center border border-amber-100">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
               <Clock size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">در انتظار تایید مدیر</h2>
            <p className="text-gray-600 leading-relaxed mb-8 text-sm">
               ثبت‌نام شما با موفقیت انجام شد. <br/>
               دسترسی شما به سیستم پس از بررسی و تایید توسط مدیریت فعال خواهد شد.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-xl mb-6 text-right">
               <p className="text-xs text-gray-500 font-bold mb-1">ایمیل حساب کاربری:</p>
               <p className="text-sm font-mono text-gray-800">{session.user.email}</p>
            </div>

            <div className="flex gap-3">
               <button onClick={() => window.location.reload()} className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors">
                  بررسی مجدد
               </button>
               <button onClick={handleSignOut} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
                  <LogOut size={20} />
               </button>
            </div>
         </div>
      </div>
    );
  }

  // --- 4. Main App (Approved) ---
  if (!keyManager.hasKeys()) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">خطای پیکربندی کلیدها</h1>
          <p className="text-gray-700 leading-relaxed">
            هیچ کلید API یافت نشد. <br/>
            لطفا تنظیمات سرور را بررسی کنید.
          </p>
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
