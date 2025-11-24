
import React from 'react';
import { LayoutDashboard, Users, Stethoscope, BookOpen, FileText, Settings } from 'lucide-react';
import { useStore } from '../store';
import { PageView } from '../types';

export const Sidebar: React.FC = () => {
  const { currentPage, setPage } = useStore();

  const NavItem = ({ page, icon: Icon, label }: { page: PageView; icon: any; label: string }) => (
    <button
      onClick={() => setPage(page)}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-lg mb-1 ${
        currentPage === page 
          ? 'bg-medical-600 text-white shadow-md' 
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col text-slate-100 fixed right-0 top-0 no-print shadow-xl z-50">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3 text-medical-500">
          <Stethoscope size={32} />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">دکتریار</h1>
            <p className="text-xs text-slate-500 mt-1">دستیار هوشمند پزشک</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <NavItem page="DASHBOARD" icon={LayoutDashboard} label="داشبورد" />
        <NavItem page="PATIENTS" icon={Users} label="مدیریت بیماران" />
        <NavItem page="DIAGNOSIS" icon={Stethoscope} label="تشخیص هوشمند" />
        <NavItem page="LIBRARY" icon={BookOpen} label="کتابخانه تخصصی" />
        <NavItem page="PRESCRIPTIONS" icon={FileText} label="مدیریت نسخه‌ها" />
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
