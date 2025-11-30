
import React, { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { PatientManager } from './components/PatientManager';
import { Diagnosis } from './components/Diagnosis';
import { Library } from './components/Library';
import { PrescriptionPad } from './components/PrescriptionPad';
import { MissionControl } from './components/MissionControl';
import { Settings } from './components/Settings';
import { Cashier } from './components/Cashier';
import { Lab } from './components/Lab';
import { useStore } from './store';

const App: React.FC = () => {
  const { currentPage, session, setSession } = useStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  const renderPage = () => {
    switch (currentPage) {
      case 'DASHBOARD': return <Dashboard />;
      case 'PATIENTS': return <PatientManager />;
      case 'DIAGNOSIS': return <Diagnosis />;
      case 'LIBRARY': return <Library />;
      case 'PRESCRIPTIONS': return <PrescriptionPad />;
      case 'MISSION_CONTROL': return <MissionControl />;
      case 'SETTINGS': return <Settings />;
      case 'CASHIER': return <Cashier />;
      case 'LAB': return <Lab />;
      default: return <Dashboard />;
    }
  };

  if (!session) {
      return <Login />;
  }

  if (currentPage === 'MISSION_CONTROL') {
      return (
          <div className="h-screen w-full bg-slate-950">
               <div className="fixed top-4 left-4 z-50">
                   <button onClick={() => useStore.getState().setPage('DASHBOARD')} className="bg-slate-800 text-white px-4 py-2 rounded-full text-xs hover:bg-slate-700 border border-slate-700">
                       خروج از اتاق فرمان
                   </button>
               </div>
               <MissionControl />
          </div>
      );
  }

  return (
    <Layout>
        {renderPage()}
    </Layout>
  );
};

export default App;
