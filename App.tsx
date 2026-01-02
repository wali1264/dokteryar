
import React, { useState, useEffect, useRef } from 'react';
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
import { supabase } from './services/supabase';
import { getAuthMetadata, saveAuthMetadata, clearAuthMetadata, isAuthHardLocked, getSessionAge, setAuthHardLock } from './services/db';
import { Loader2, LogOut, Clock, ShieldCheck, ShieldAlert, AlertTriangle, Smartphone, Monitor } from 'lucide-react';

function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.PRESCRIPTION);
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  
  // --- AUTH & SECURITY STATES ---
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true); 
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [securityStatus, setSecurityStatus] = useState<'idle' | 'syncing' | 'verified' | 'offline'>('idle');
  const [conflictDetected, setConflictDetected] = useState(false);

  const isVerifyingRef = useRef(false);
  const localSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Instant Hard-Lock Check (Sync)
      if (isAuthHardLocked()) {
        setAuthLoading(false);
        setIsApproved(null);
        return;
      }

      // 2. Load Local Identity
      const { sessionId, isApproved: localApproval } = await getAuthMetadata();
      localSessionIdRef.current = sessionId;
      
      if (sessionId && localApproval === true) {
         setIsApproved(true);
         // Don't set loading false yet, wait for Supabase session
      }

      // 3. Supabase Initial Session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession) {
        await verifySecurityOnce(currentSession.user.id);
        setupRealtimeSecurity(currentSession.user.id);
      } else if (!sessionId) {
        setAuthLoading(false);
        setIsApproved(null);
      } else {
        // We have local session but no supabase session (Offline probably)
        setAuthLoading(false);
      }
    };

    initAuth();

    // Listen for Auth Events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
         verifySecurityOnce(newSession.user.id);
         setupRealtimeSecurity(newSession.user.id);
      } else if (!newSession) {
         setAuthLoading(false);
         setIsApproved(null);
         setConflictDetected(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // REAL-TIME SENTINEL: Listens for device takeover active-broadcast
  const setupRealtimeSecurity = (userId: string) => {
    const channel = supabase
      .channel(`profile_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const remoteId = payload.new.active_session_id;
          const localId = localSessionIdRef.current;
          
          // CRITICAL: Trigger only if IDs mismatch AND session is not in birth grace period
          if (remoteId && localId && remoteId !== localId) {
             const age = getSessionAge();
             if (age > 8000) { // 8s grace period for sync
                console.warn("Sentinel: Active takeover detected!");
                setConflictDetected(true);
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const verifySecurityOnce = async (userId: string) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setSecurityStatus('syncing');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_approved, active_session_id')
        .eq('id', userId)
        .single();

      if (data) {
          setIsApproved(data.is_approved);
          const remoteId = data.active_session_id || null;
          const localId = localSessionIdRef.current;

          // SYNC PERMANENT STORAGE
          await saveAuthMetadata({ 
              isApproved: data.is_approved,
              sessionId: remoteId 
          });
          localSessionIdRef.current = remoteId;

          // Conflict Check (Grace period aware)
          const age = getSessionAge();
          if (remoteId && localId && remoteId !== localId && age > 8000) {
              setConflictDetected(true);
          }
          
          setSecurityStatus('verified');
          setTimeout(() => setSecurityStatus('idle'), 3000);
      }
    } catch (e) {
      console.warn("Security Sync Offline.");
      setSecurityStatus('offline');
    } finally {
      setAuthLoading(false);
      isVerifyingRef.current = false;
    }
  };

  const handleSignOutForced = async () => {
    setAuthLoading(true);
    setConflictDetected(false);
    setIsApproved(null);
    setSession(null);

    // 1. Synchronous hard-lock (Prevents G4 auto-login loop)
    setAuthHardLock(true);

    // 2. Atomic Purge
    try {
       await clearAuthMetadata();
       await supabase.auth.signOut();
    } catch (e) {
       console.error("Signout error", e);
    }

    // 3. Final memory flush
    window.location.href = '/';
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

  const handleNavigate = (route: AppRoute, record?: PatientRecord) => {
    if (record) setCurrentRecord(record);
    setCurrentRoute(route);
  };

  const handleIntakeSubmit = (record: PatientRecord) => {
    setCurrentRecord(record);
    setCurrentRoute(AppRoute.DIAGNOSIS);
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
           <p className="text-gray-400 text-sm font-black animate-pulse">در حال برقراری اتصال امن...</p>
        </div>
      </div>
    );
  }

  if (!session && !isApproved) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  // SECURITY BLOCKADE: Non-bypassable UI for device conflict
  if (conflictDetected) {
    return (
      <div className="fixed inset-0 z-[1000] bg-gray-900/95 backdrop-blur-xl flex items-center justify-center p-4 font-sans text-right" dir="rtl">
         <div className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl p-10 text-center border-t-8 border-red-600 animate-bounce-in">
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 relative">
               <AlertTriangle size={56} className="animate-pulse" />
               <div className="absolute -top-1 -right-1 bg-red-600 text-white p-2 rounded-full shadow-lg border-4 border-white">
                  <Smartphone size={16} />
               </div>
            </div>
            <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">تداخل نشست فعال</h2>
            <p className="text-gray-500 leading-relaxed mb-10 font-medium">
               دکتر عزیز، حساب شما هم‌زمان در <span className="text-red-600 font-black">دستگاه دیگری</span> باز گردید. 
               جهت جلوگیری از نشت اطلاعات بیمار، دسترسی در این دستگاه مسدود شد.
            </p>
            <button 
               onClick={handleSignOutForced}
               className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 text-lg group"
            >
               <LogOut size={24} className="group-hover:translate-x-1 transition-transform" />
               خروج و تایید امنیت
            </button>
            <p className="mt-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Protocol Sentinel v2.0 Activated</p>
         </div>
      </div>
    );
  }

  if (isApproved === false) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4" dir="rtl">
         <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center border border-amber-100">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
               <Clock size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">در انتظار تایید مدیر</h2>
            <p className="text-gray-600 mb-8 text-sm">دسترسی شما پس از بررسی فعال خواهد شد.</p>
            <button onClick={handleSignOutForced} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 font-bold">خروج از حساب</button>
         </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-2.5 lg:top-4 left-1/2 -translate-x-1/2 lg:left-10 lg:translate-x-0 z-[100] pointer-events-none transition-all duration-500">
        {securityStatus === 'syncing' && (
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-blue-100 animate-slide-down">
             <Loader2 size={14} className="text-blue-500 animate-spin" />
             <span className="text-[11px] font-black text-blue-700">همگام‌سازی امنیتی...</span>
          </div>
        )}
        {securityStatus === 'verified' && (
          <div className="flex items-center gap-2 bg-emerald-50/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-emerald-100 animate-slide-down">
             <ShieldCheck size={14} className="text-emerald-500" />
             <span className="text-[11px] font-black text-emerald-700">پروتکل فعال شد</span>
          </div>
        )}
        {securityStatus === 'offline' && (
          <div className="flex items-center gap-2 bg-amber-50/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-amber-100 animate-slide-down">
             <ShieldAlert size={14} className="text-amber-500" />
             <span className="text-[11px] font-black text-amber-700">پایداری آفلاین</span>
          </div>
        )}
      </div>

      <Layout currentRoute={currentRoute} onNavigate={handleNavigate}>
        {renderContent()}
      </Layout>
    </>
  );
}

export default App;
