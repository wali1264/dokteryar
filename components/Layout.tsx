
import React, { useState, useEffect, useRef } from 'react';
import { Activity, Beaker, Stethoscope, Menu, X, User, ScanEye, Eye, Archive, HeartPulse, BrainCircuit, Sparkles, Glasses, Baby, Bone, Smile, Flower, Wind, Utensils, Droplets, Droplet, Ambulance, Dna, FileSignature, Settings as SettingsIcon, Wifi, WifiOff, Shield, Key, BarChart3, Lock, AlertTriangle, Download, FolderOpen, UserPlus, Grid, LogOut, Loader2, CheckCircle2 } from 'lucide-react';
import { AppRoute } from '../types';
import { keyManager, KeyStats } from '../services/geminiService';
import { supabase } from '../services/supabase';
import { clearAuthMetadata, setAuthHardLock } from '../services/db';

interface LayoutProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentRoute, onNavigate, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // --- Secure Logout States ---
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutStage, setLogoutStage] = useState<'idle' | 'clearing' | 'success'>('idle');

  // --- Admin Mode Logic ---
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const [keyStats, setKeyStats] = useState<KeyStats[]>([]);

  // --- PWA Install Logic ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // --- ATOMIC SECURE LOGOUT LOGIC (Sentinel Purge) ---
  const handleSignOut = async () => {
    setIsLoggingOut(true);
    setLogoutStage('clearing');

    try {
      // 1. HARD LOCK (Instant sync blockade)
      setAuthHardLock(true);

      // 2. Wipe DB while potentially online
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            active_session_id: null,
            last_login_device: null 
          })
          .eq('id', user.id);
      }
      
      // 3. Purge Local Disk (IndexedDB)
      await clearAuthMetadata();
      
      // 4. Revoke Session
      await supabase.auth.signOut();

      setLogoutStage('success');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error("Purge failed:", error);
      // Even if error, force reload after lock
      setAuthHardLock(true);
      window.location.href = '/';
    }
  };

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 800) {
      clickCountRef.current++;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current === 5) {
      setShowAdminLogin(true);
      clickCountRef.current = 0;
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === 'Alliwali@1264') {
      setShowAdminLogin(false);
      setShowAdminDashboard(true);
      setKeyStats(keyManager.getStatistics());
      setAdminPassword('');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const NavItem = ({ route, icon: Icon, label, onClick }: { route?: AppRoute; icon: any; label: string, onClick?: () => void }) => {
    const isActive = currentRoute === route;
    return (
      <button
        onClick={() => {
          if (onClick) onClick();
          else if (route) {
             onNavigate(route);
             setIsSidebarOpen(false);
             setIsMoreMenuOpen(false);
          }
        }}
        className={`flex items-center w-full p-4 space-x-3 space-x-reverse rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
        }`}
      >
        <Icon size={24} />
        <span className="font-medium text-lg">{label}</span>
      </button>
    );
  };

  const BottomNavItem = ({ route, icon: Icon, label, isActive, onClick }: { route?: AppRoute, icon: any, label: string, isActive?: boolean, onClick?: () => void }) => (
    <button 
      onClick={() => onClick ? onClick() : (route && onNavigate(route))}
      className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300 ${isActive ? 'text-blue-600 -translate-y-2' : 'text-gray-400'}`}
    >
      <div className={`p-2 rounded-full transition-all ${isActive ? 'bg-blue-100 shadow-md' : 'bg-transparent'}`}>
        <Icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} />
      </div>
      <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
  );

  const totalRequests = keyStats.reduce((acc, curr) => acc + curr.usageCount, 0);
  const activeKeys = keyStats.filter(k => k.status === 'active').length;
  const sortedByUsage = [...keyStats].sort((a, b) => b.usageCount - a.usageCount);
  const mostUsed = sortedByUsage[0];
  const leastUsed = sortedByUsage[sortedByUsage.length - 1];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {isLoggingOut && (
        <div className="fixed inset-0 z-[1001] bg-white flex flex-col items-center justify-center animate-fade-in">
           {logoutStage === 'clearing' ? (
             <div className="flex flex-col items-center gap-6 animate-slide-up">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-blue-50 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={48} className="text-blue-600 animate-spin" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-gray-800">ابطال دسترسی‌ها...</h3>
                  <p className="text-gray-500 font-medium">پروتکل Sentinel در حال پاکسازی نهایی</p>
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center gap-6 animate-bounce-in">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle2 size={56} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-gray-800">خروج با موفقیت</h3>
                  <p className="text-emerald-600 font-bold">نشست شما با موفقیت از سیستم حذف گردید</p>
                </div>
             </div>
           )}
        </div>
      )}

      <aside className={`hidden lg:flex fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-2xl flex-col`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center cursor-pointer select-none" onClick={handleLogoClick}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white relative overflow-hidden">
              <Activity className="animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">طبیب هوشمند</h1>
          </div>
        </div>
        <div className={`px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 transition-colors ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
           {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
           {isOnline ? 'شبکه متصل است (Sentinel فعال)' : 'حالت آفلاین (محلی)'}
        </div>
        <nav className="p-4 space-y-2 mt-2 overflow-y-auto flex-1 custom-scrollbar">
          <NavItem route={AppRoute.PRESCRIPTION} icon={FileSignature} label="میز کار دکتر" />
          <NavItem route={AppRoute.INTAKE} icon={User} label="مشاوره هوشمند" />
          <NavItem route={AppRoute.DIAGNOSIS} icon={Stethoscope} label="اتاق تشخیص" />
          <NavItem route={AppRoute.DASHBOARD} icon={Archive} label="بایگانی" />
          <div className="border-t my-4 border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 px-4 mb-2">دپارتمان‌های تخصصی</p>
            <NavItem route={AppRoute.EMERGENCY} icon={Ambulance} label="اورژانس" />
            <NavItem route={AppRoute.CARDIOLOGY} icon={HeartPulse} label="قلب و عروق" />
            <NavItem route={AppRoute.PULMONOLOGY} icon={Wind} label="ریه" />
            <NavItem route={AppRoute.GASTROENTEROLOGY} icon={Utensils} label="گوارد" />
            <NavItem route={AppRoute.NEUROLOGY} icon={BrainCircuit} label="مغز" />
            <NavItem route={AppRoute.GENETICS} icon={Dna} label="ژنتیک" />
            <NavItem route={AppRoute.UROLOGY} icon={Droplets} label="کلیه" />
            <NavItem route={AppRoute.GYNECOLOGY} icon={Flower} label="زنان" />
            <NavItem route={AppRoute.PEDIATRICS} icon={Baby} label="کودکان" />
            <NavItem route={AppRoute.HEMATOLOGY} icon={Droplet} label="خون" />
            <NavItem route={AppRoute.ORTHOPEDICS} icon={Bone} label="ارتوپدی" />
            <NavItem route={AppRoute.OPHTHALMOLOGY} icon={Glasses} label="چشم" />
            <NavItem route={AppRoute.DENTISTRY} icon={Smile} label="دندان" />
            <NavItem route={AppRoute.PSYCHOLOGY} icon={Sparkles} label="روانشناسی" />
            <NavItem route={AppRoute.RADIOLOGY} icon={ScanEye} label="رادیولوژی" />
            <NavItem route={AppRoute.LABORATORY} icon={Beaker} label="آزمایشگاه" />
            <NavItem route={AppRoute.PHYSICAL_EXAM} icon={Eye} label="معاینه" />
          </div>
          <NavItem route={AppRoute.SETTINGS} icon={SettingsIcon} label="تنظیمات" />
        </nav>
        <div className="p-6 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="https://picsum.photos/100/100" className="w-12 h-12 rounded-full border-2 border-blue-200" alt="Dr Profile" />
            <div>
              <p className="font-bold text-gray-800 text-sm">دکتر متخصص</p>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Active Member</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut} 
            className="p-2.5 bg-white text-red-500 hover:bg-red-600 hover:text-white rounded-2xl transition-all shadow-sm active:scale-95"
            title="خروج امن"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative lg:mr-72 transition-all duration-300">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:hidden fixed top-0 left-0 right-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white" onClick={handleLogoClick}>
                <Activity size={18} />
             </div>
             <span className="font-black text-lg text-gray-800 tracking-tight">طبیب هوشمند</span>
          </div>
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
             {showInstallBtn && (
                <button onClick={handleInstallClick} className="bg-blue-50 text-blue-600 p-2 rounded-full">
                   <Download size={18} />
                </button>
             )}
             <button onClick={handleSignOut} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 active:scale-90 transition-all" title="خروج امن">
                <LogOut size={18} />
             </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto pt-20 pb-28 lg:pt-8 lg:pb-8 p-4 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-end pb-safe px-2 py-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-2xl">
           <BottomNavItem route={AppRoute.DASHBOARD} icon={FolderOpen} label="بایگانی" isActive={currentRoute === AppRoute.DASHBOARD} />
           <BottomNavItem route={AppRoute.INTAKE} icon={UserPlus} label="مشاوره" isActive={currentRoute === AppRoute.INTAKE} />
           <BottomNavItem route={AppRoute.PRESCRIPTION} icon={FileSignature} label="میز کار" isActive={currentRoute === AppRoute.PRESCRIPTION} />
           <BottomNavItem route={AppRoute.DIAGNOSIS} icon={Activity} label="تشخیص" isActive={currentRoute === AppRoute.DIAGNOSIS} />
           <BottomNavItem icon={Grid} label="بیشتر" isActive={isMoreMenuOpen} onClick={() => setIsMoreMenuOpen(true)} />
        </nav>

        {isMoreMenuOpen && (
           <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsMoreMenuOpen(false)}></div>
              <div className="bg-white rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto animate-slide-up transition-transform duration-200">
                 <div className="sticky top-0 bg-white pt-2 pb-4 mb-2 z-20 flex flex-col items-center">
                    <button 
                       onClick={() => setIsMoreMenuOpen(false)}
                       className="w-12 h-1.5 bg-gray-200 rounded-full mb-6 hover:bg-gray-300 active:scale-90 transition-all"
                    ></button>
                    <div className="w-full flex justify-between items-center px-2">
                       <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                          <Grid className="text-blue-600" />
                          دپارتمان‌های تخصصی
                       </h3>
                       <button 
                          onClick={() => setIsMoreMenuOpen(false)}
                          className="p-2 bg-gray-100 text-gray-500 rounded-full"
                       >
                          <X size={20} />
                       </button>
                    </div>
                 </div>
                 <div className="grid grid-cols-3 gap-3 mb-8">
                    {[
                      { r: AppRoute.EMERGENCY, i: Ambulance, l: 'اورژانس', c: 'bg-red-50 text-red-600' },
                      { r: AppRoute.CARDIOLOGY, i: HeartPulse, l: 'قلب', c: 'bg-rose-50 text-rose-600' },
                      { r: AppRoute.PEDIATRICS, i: Baby, l: 'کودکان', c: 'bg-pink-50 text-pink-600' },
                      { r: AppRoute.GYNECOLOGY, i: Flower, l: 'زنان', c: 'bg-purple-50 text-purple-600' },
                      { r: AppRoute.NEUROLOGY, i: BrainCircuit, l: 'مغز', c: 'bg-violet-50 text-violet-600' },
                      { r: AppRoute.ORTHOPEDICS, i: Bone, l: 'ارتوپدی', c: 'bg-orange-50 text-orange-600' },
                      { r: AppRoute.DENTISTRY, i: Smile, l: 'دندان', c: 'bg-cyan-50 text-cyan-600' },
                      { r: AppRoute.OPHTHALMOLOGY, i: Glasses, l: 'چشم', c: 'bg-teal-50 text-teal-700' },
                      { r: AppRoute.PSYCHOLOGY, i: Sparkles, l: 'روان', c: 'bg-indigo-50 text-indigo-600' },
                      { r: AppRoute.GASTROENTEROLOGY, i: Utensils, l: 'گوارش', c: 'bg-emerald-50 text-emerald-600' },
                      { r: AppRoute.PULMONOLOGY, i: Wind, l: 'ریه', c: 'bg-sky-50 text-sky-600' },
                      { r: AppRoute.UROLOGY, i: Droplets, l: 'کلیه', c: 'bg-blue-50 text-blue-600' },
                      { r: AppRoute.HEMATOLOGY, i: Droplet, l: 'خون', c: 'bg-red-50 text-red-700' },
                      { r: AppRoute.GENETICS, i: Dna, l: 'ژنتیک', c: 'bg-fuchsia-50 text-fuchsia-600' },
                      { r: AppRoute.LABORATORY, i: Beaker, l: 'آزمایشگاه', c: 'bg-gray-50 text-gray-600' },
                      { r: AppRoute.RADIOLOGY, i: ScanEye, l: 'رادیولوژی', c: 'bg-gray-50 text-gray-600' },
                      { r: AppRoute.PHYSICAL_EXAM, i: Eye, l: 'معاینه', c: 'bg-gray-50 text-gray-600' },
                    ].map(item => (
                       <button 
                         key={item.l}
                         onClick={() => { onNavigate(item.r); setIsMoreMenuOpen(false); }}
                         className={`${item.c} p-4 rounded-2xl flex flex-col items-center gap-2 transition-transform active:scale-95`}
                       >
                          <item.i size={24} />
                          <span className="text-xs font-bold">{item.l}</span>
                       </button>
                    ))}
                 </div>
                 <div className="border-t border-gray-100 pt-4 mb-4">
                    <button 
                      onClick={() => { onNavigate(AppRoute.SETTINGS); setIsMoreMenuOpen(false); }}
                      className="w-full bg-gray-50 text-gray-700 p-5 rounded-2xl flex items-center justify-between font-bold active:bg-gray-100 transition-colors"
                    >
                       <span className="flex items-center gap-3"><SettingsIcon size={20} className="text-blue-500" /> تنظیمات و مدیریت</span>
                       <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs shadow-sm font-black">➜</div>
                    </button>
                 </div>
              </div>
           </div>
        )}
      </main>

      {/* ADMIN MODALS */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdminLogin(false)}>
           <div className="bg-gray-900 border border-gray-700 text-white rounded-2xl p-8 w-full max-sm shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-6 text-emerald-500"><Shield size={48} /></div>
              <h3 className="text-xl font-bold text-center mb-2">ورود به اتاق فرمان</h3>
              <p className="text-gray-400 text-sm text-center mb-6">لطفا رمز عبور مدیریتی را وارد کنید</p>
              <div className="space-y-4">
                 <div className="relative">
                    <input type="password" autoFocus className={`w-full bg-gray-800 border ${loginError ? 'border-red-500' : 'border-gray-600'} rounded-xl p-3 pl-10 text-center outline-none focus:border-emerald-500 transition-colors`} placeholder="• • • • •" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAdminLogin()} />
                    <Key className="absolute left-3 top-3.5 text-gray-500" size={18} />
                 </div>
                 {loginError && <p className="text-red-500 text-xs text-center">رمز عبور اشتباه است</p>}
                 <button onClick={handleAdminLogin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-900/20">ورود</button>
              </div>
           </div>
        </div>
      )}

      {showAdminDashboard && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 overflow-y-auto">
           <div className="w-full max-w-5xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                 <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg"><BarChart3 className="text-emerald-500" size={28} /></div>
                    <div><h2 className="text-2xl font-bold text-white">اتاق فرمان</h2><p className="text-gray-400 text-xs uppercase tracking-widest">سیستم نظارت بر کلیدها و ترافیک</p></div>
                 </div>
                 <button onClick={() => setShowAdminDashboard(false)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-gray-400 transition-colors"><X size={24} /></button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700"><p className="text-gray-400 text-xs mb-1">کل درخواست‌ها</p><p className="text-3xl font-bold text-white">{totalRequests}</p></div>
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700"><p className="text-gray-400 text-xs mb-1">کلیدهای فعال</p><p className="text-3xl font-bold text-emerald-400">{activeKeys} <span className="text-sm text-gray-500 font-normal">/ {keyStats.length}</span></p></div>
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700"><p className="text-gray-400 text-xs mb-1">پرکارترین کلید</p><p className="text-lg font-bold text-blue-400 truncate">{mostUsed ? mostUsed.maskedKey : '---'}</p><p className="text-xs text-gray-500">{mostUsed ? `${mostUsed.usageCount} request` : ''}</p></div>
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700"><p className="text-gray-400 text-xs mb-1">کم‌کارترین کلید</p><p className="text-lg font-bold text-orange-400 truncate">{leastUsed ? leastUsed.maskedKey : '---'}</p><p className="text-xs text-gray-500">{leastUsed ? `${leastUsed.usageCount} request` : ''}</p></div>
                 </div>
                 <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                    <table className="w-full text-right text-gray-300">
                       <thead className="bg-gray-900 text-gray-500 text-xs uppercase"><tr><th className="p-4">شناسه کلید</th><th className="p-4">تعداد درخواست</th><th className="p-4">خطاها</th><th className="p-4">آخرین استفاده</th><th className="p-4">وضعیت</th></tr></thead>
                       <tbody className="divide-y divide-gray-700">
                          {keyStats.map(k => (
                             <tr key={k.key} className="hover:bg-gray-750 transition-colors"><td className="p-4 font-mono text-emerald-400">{k.maskedKey}</td><td className="p-4">{k.usageCount}</td><td className="p-4 text-red-400">{k.errorCount}</td><td className="p-4 text-sm text-gray-500">{k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : '-'}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${k.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{k.status === 'active' ? 'ACTIVE' : 'COOLDOWN'}</span></td></tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
