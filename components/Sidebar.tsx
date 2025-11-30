
import React from 'react';
import { LayoutDashboard, Users, Stethoscope, BookOpen, FileText, Settings, Activity, DollarSign, TestTube } from 'lucide-react';
import { useStore } from '../store';
import { PageView } from '../types';

export const Sidebar: React.FC = () => {
  const { currentPage, setPage, hasPermission, userRole, activeVisits } = useStore();

  const waitingCount = activeVisits.filter(v => v.status === 'waiting' || v.status === 'lab_ready').length;

  const NavItem = ({ page, icon: Icon, label, highlight, badge }: { page: PageView; icon: any; label: string; highlight?: boolean; badge?: number }) => (
    <button
      onClick={() => setPage(page)}
      className={`w-full flex items-center justify-between px-4 py-3 transition-colors rounded-lg mb-1 ${
        currentPage === page 
          ? 'bg-medical-600 text-white shadow-md' 
          : highlight 
            ? 'text-amber-400 hover:bg-slate-800 hover:text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
          <Icon size={20} className={highlight ? "animate-pulse" : ""} />
          <span className="font-medium">{label}</span>
      </div>
      {badge && badge > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-bounce">
              {badge}
          </span>
      )}
    </button>
  );

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col text-slate-100 fixed right-0 top-0 no-print shadow-xl z-50">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3 text-medical-500">
          <Stethoscope size={32} />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">دکتریار</h1>
            <p className="text-xs text-slate-500 mt-1">
                {userRole === 'admin' ? 'مدیریت کل سیستم' : 
                 userRole === 'accountant' ? 'پنل صندوق' : 
                 userRole === 'lab_tech' ? 'پنل آزمایشگاه' : 'دستیار پزشک'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        
        {/* --- COMMON --- */}
        <NavItem page="DASHBOARD" icon={LayoutDashboard} label="داشبورد" />

        {/* --- ADMIN / MISSION CONTROL --- */}
        {hasPermission('view_mission_control') && (
            <div className="mb-4 pt-2 border-t border-slate-800/50">
                <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">مدیریت مرکزی</p>
                <NavItem page="MISSION_CONTROL" icon={Activity} label="اتاق فرمان" highlight />
            </div>
        )}

        {/* --- OPERATIONS (CASHIER & LAB) --- */}
        {/* Admin sees these, OR specific roles see them */}
        {(hasPermission('*') || userRole === 'accountant' || userRole === 'lab_tech') && (
            <div className="mb-4 pt-2 border-t border-slate-800/50">
                <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">عملیات</p>
                
                {(hasPermission('*') || userRole === 'accountant') && (
                    <NavItem page="CASHIER" icon={DollarSign} label="صندوق و حسابداری" />
                )}
                
                {(hasPermission('*') || userRole === 'lab_tech') && (
                    <NavItem page="LAB" icon={TestTube} label="آزمایشگاه هوشمند" />
                )}
            </div>
        )}

        {/* --- MEDICAL TOOLS --- */}
        {(hasPermission('*') || userRole === 'doctor' || userRole === 'nurse') && (
            <div className="mb-4 pt-2 border-t border-slate-800/50">
                <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">پزشکی</p>
                
                {hasPermission('view_patients') && (
                    <NavItem page="PATIENTS" icon={Users} label="مدیریت بیماران" />
                )}
                
                {hasPermission('view_diagnosis') && (
                    <NavItem page="DIAGNOSIS" icon={Stethoscope} label="تشخیص هوشمند" badge={waitingCount} />
                )}
                
                {hasPermission('view_library') && (
                    <NavItem page="LIBRARY" icon={BookOpen} label="کتابخانه تخصصی" />
                )}
                
                {hasPermission('view_prescriptions') && (
                    <NavItem page="PRESCRIPTIONS" icon={FileText} label="مدیریت نسخه‌ها" />
                )}
            </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div 
          onClick={() => setPage('SETTINGS')}
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg transition-colors ${currentPage === 'SETTINGS' ? 'bg-medical-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
        >
          <Settings size={20} />
          <span>تنظیمات</span>
        </div>
      </div>
    </div>
  );
};
