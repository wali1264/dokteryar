
import React from 'react';
import { Sidebar } from './Sidebar';
import { useStore } from '../store';
import { LayoutDashboard, Users, Stethoscope, BookOpen, FileText } from 'lucide-react';
import { PageView } from '../types';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPage, setPage } = useStore();

  const MobileNavItem = ({ page, icon: Icon, label }: { page: PageView; icon: any; label: string }) => (
    <button
      onClick={() => setPage(page)}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
        currentPage === page 
          ? 'text-medical-600 bg-medical-50 scale-105' 
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <Icon size={24} strokeWidth={currentPage === page ? 2.5 : 2} />
      <span className="text-[10px] font-bold mt-1">{label}</span>
    </button>
  );

  return (
    <div className="h-screen bg-gray-50 font-sans flex flex-col md:flex-row-reverse overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
         <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto transition-all duration-300 md:mr-64 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-area-bottom">
         <MobileNavItem page="DASHBOARD" icon={LayoutDashboard} label="خانه" />
         <MobileNavItem page="PATIENTS" icon={Users} label="بیماران" />
         {/* Center Action Button */}
         <div className="-mt-8">
             <button 
                onClick={() => setPage('DIAGNOSIS')}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-transform ${currentPage === 'DIAGNOSIS' ? 'bg-amber-500 scale-110' : 'bg-medical-600'}`}
             >
                 <Stethoscope size={28} className="text-white" />
             </button>
         </div>
         <MobileNavItem page="LIBRARY" icon={BookOpen} label="منابع" />
         <MobileNavItem page="PRESCRIPTIONS" icon={FileText} label="نسخ" />
      </div>
    </div>
  );
};
