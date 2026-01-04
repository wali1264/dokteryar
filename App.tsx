
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
import { getAuthMetadata, saveAuthMetadata, clearAuthMetadata, isAuthHardLocked, getSessionAge, setAuthHardLock, getSettings, exportDatabase, uploadBackupOnline, updateLastBackupTime, getLastBackupTime, isDatabaseEmpty, getOnlineBackupMetadata, fetchOnlineBackup, importDatabase } from './services/db';
import { Loader2, LogOut, Clock, ShieldCheck, ShieldAlert, AlertTriangle, Smartphone, Database, CloudDownload, RefreshCcw, X, History, Sparkles } from 'lucide-react';

function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.PRESCRIPTION);
  const [currentRecord, setCurrentRecord] = useState<PatientRecord | null>(null);
  
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true); 
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [securityStatus, setSecurityStatus] = useState<'idle' | 'syncing' | 'verified' | 'offline'>('idle');
  const [conflictDetected, setConflictDetected] = useState(false);

  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [onlineBackupDate, setOnlineBackupDate] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const isVerifyingRef = useRef(false);
  const localSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      // ۱. بررسی قفل سخت‌افزاری امنیتی
      if (isAuthHardLocked()) {
        setAuthLoading(false);
        setIsApproved(null);
        return;
      }

      // ۲. اولویت با حافظه محلی پایدار (IndexedDB) برای باز شدن آنی در حالت آفلاین
      const localData = await getAuthMetadata();
      localSessionIdRef.current = localData.sessionId;
      
      if (localData.sessionId && localData.isApproved === true) {
         // کاربر قبلاً لاگین بوده، بلافاصله دسترسی می‌دهیم
         setIsApproved(true);
         setSession({ user: { id: 'local_user' } });
         setAuthLoading(false); // لودینگ را می‌بندیم تا برنامه در حالت آفلاین بالا بیاید
         
         if (!navigator.onLine) {
            setSecurityStatus('offline');
         }
      }

      // ۳. تلاش برای همگام‌سازی با سرور (Non-blocking)
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          await verifySecurityOnce(currentSession.user.id, true);
          setupRealtimeSecurity(currentSession.user.id);
          handleAutoBackup(currentSession.user.id);
          checkDatabaseMigration(currentSession.user.id);
        } else if (!localData.sessionId) {
          // اگر نه دیتای محلی داریم و نه سشن سروری، به صفحه لاگین می‌رویم
          setAuthLoading(false);
          setIsApproved(null);
        }
      } catch (e) {
        console.warn("Could not sync with Supabase, continuing in standalone offline mode.");
        // در صورت قطع بودن اینترنت، اگر لاگین قبلی داشتیم، مرحله ۳ متوقف می‌شود ولی مرحله ۲ برنامه را باز نگه می‌دارد
        setAuthLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
         setSession(newSession);
         verifySecurityOnce(newSession.user.id, false);
         setupRealtimeSecurity(newSession.user.id);
         handleAutoBackup(newSession.user.id);
         checkDatabaseMigration(newSession.user.id);
      } else if (!newSession && !localSessionIdRef.current) {
         setAuthLoading(false);
         setIsApproved(null);
         setConflictDetected(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkDatabaseMigration = async (userId: string) => {
     try {
        const isEmpty = await isDatabaseEmpty();
        if (isEmpty && navigator.onLine) {
           const { updatedAt } = await getOnlineBackupMetadata(userId);
           if (updatedAt) {
              setOnlineBackupDate(updatedAt);
              setShowRestorePrompt(true);
           }
        }
     } catch (e) {
        console.warn("Migration check skipped.", e);
     }
  };

  const handleConfirmRestore = async () => {
     if (!session?.user?.id) return;
     setRestoreLoading(true);
     try {
        const json = await fetchOnlineBackup(session.user.id);
        if (json) {
           await importDatabase(json);
           setShowRestorePrompt(false);
           window.location.reload();
        }
     } catch (e) {
        alert("خطا در بازیابی اطلاعات ابری.");
     } finally {
        setRestoreLoading(false);
     }
  };

  const handleAutoBackup = async (userId: string) => {
    try {
      const settings = await getSettings();
      if (!settings?.autoBackupEnabled) return;

      const lastBackup = getLastBackupTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const now = Date.now();

      if (now - lastBackup >= twentyFourHours) {
        const json = await exportDatabase();
        if (navigator.onLine) {
          try {
            await uploadBackupOnline(userId, json);
            updateLastBackupTime();
          } catch (e) {
            console.warn("Auto-Backup Online Failed.");
          }
        }
      }
    } catch (error) {
      console.error("Auto Backup Engine Error:", error);
    }
  };

  const setupRealtimeSecurity = (userId: string) => {
    if (!navigator.onLine) return;
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
          
          if (remoteId && localId && remoteId !== localId) {
             const age = getSessionAge();
             if (age > 8000) { 
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

  const verifySecurityOnce = async (userId: string, silent: boolean = false) => {
    if (isVerifyingRef.current || !navigator.onLine) return;
    if (!silent) setSecurityStatus('syncing');
    isVerifyingRef.current = true;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_approved, active_session_id')
        .eq('id', userId)
        .single();
      if (data) {
          setIsApproved(data.is_approved);
          const remoteId = data.active_session_id || null;
          const localId = localSessionIdRef.current;
          await saveAuthMetadata({ 
              isApproved: data.is_approved,
              sessionId: remoteId 
          });
          localSessionIdRef.current = remoteId;
          const age = getSessionAge();
          if (remoteId && localId && remoteId !== localId && age > 8000) {
              setConflictDetected(true);
          }
          setSecurityStatus('verified');
          setTimeout(() => setSecurityStatus('idle'), 3000);
      }
    } catch (e) {
      setSecurityStatus('offline');
      setTimeout(() => setSecurityStatus('idle'), 3000);
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
    setAuthHardLock(true);
    try {
       await clearAuthMetadata();
       await supabase.auth.signOut();
    } catch (e) {
       console.error("Signout error", e);
    }
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
           <p className="text-gray-400 text-sm font-black animate-pulse">در حال آماده‌سازی میز کار...</p>
        </div>
      </div>
    );
  }

  if (!session && !isApproved) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

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
             <span className="text-[11px] font-black text-blue-700">به‌روزرسانی امنیت...</span>
          </div>
        )}
        {securityStatus === 'verified' && (
          <div className="flex items-center gap-2 bg-emerald-50/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-emerald-100 animate-slide-down">
             <ShieldCheck size={14} className="text-emerald-500" />
             <span className="text-[11px] font-black text-emerald-700">امنیت تایید شد</span>
          </div>
        )}
        {securityStatus === 'offline' && (
          <div className="flex items-center gap-2 bg-amber-50/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-amber-100 animate-slide-down">
             <ShieldAlert size={14} className="text-amber-500" />
             <span className="text-[11px] font-black text-amber-700">حالت آفلاین (Disk Safe)</span>
          </div>
        )}
      </div>

      {showRestorePrompt && (
        <div className="fixed inset-0 z-[2000] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans text-right" dir="rtl">
           <div className="bg-white max-w-lg w-full rounded-[2.5rem] shadow-2xl p-10 border border-blue-100 animate-slide-up relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
              <div className="flex justify-between items-start mb-8">
                 <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner">
                    <CloudDownload size={48} className="animate-bounce" />
                 </div>
                 <button onClick={() => setShowRestorePrompt(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <X size={24} />
                 </button>
              </div>
              
              <h3 className="text-2xl font-black text-gray-800 mb-4 flex items-center gap-2">
                 <Sparkles className="text-blue-500" size={24} />
                 انتقال سوابق به دستگاه جدید
              </h3>
              
              <p className="text-gray-600 leading-relaxed mb-8 font-medium">
                 دکتر عزیز، خوش آمدید. سیستم شناسایی کرد که حافظه این دستگاه خالی است، اما شما یک <span className="text-blue-600 font-black">نسخه پشتیبان آنلاین</span> در ابر دارید.
              </p>
              
              <div className="bg-gray-50 rounded-2xl p-4 mb-10 flex items-center gap-4 border border-gray-100">
                 <div className="bg-white p-2 rounded-xl shadow-sm text-gray-400"><History size={20} /></div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Online Backup</p>
                    <p className="text-sm font-black text-gray-700">
                       {onlineBackupDate ? new Date(onlineBackupDate).toLocaleString('fa-IR') : 'نامشخص'}
                    </p>
                 </div>
              </div>
              
              <div className="flex flex-col gap-3">
                 <button 
                    onClick={handleConfirmRestore}
                    disabled={restoreLoading}
                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 text-lg"
                 >
                    {restoreLoading ? <Loader2 className="animate-spin" /> : <RefreshCcw size={20} />}
                    بازیابی و همگام‌سازی تمام داده‌ها
                 </button>
                 <button 
                    onClick={() => setShowRestorePrompt(false)}
                    className="w-full bg-white text-gray-400 font-bold py-3 rounded-xl hover:text-gray-600 transition-all text-sm"
                 >
                    فعلاً نه، شروع با میز کار خالی
                 </button>
              </div>
           </div>
        </div>
      )}

      <Layout currentRoute={currentRoute} onNavigate={handleNavigate}>
        {renderContent()}
      </Layout>
    </>
  );
}

export default App;
