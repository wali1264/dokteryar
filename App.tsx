
import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PatientManager } from './components/PatientManager';
import { Diagnosis } from './components/Diagnosis';
import { Library } from './components/Library';
import { PrescriptionPad } from './components/PrescriptionPad';
import { Settings } from './components/Settings';
import { useStore } from './store';

const App: React.FC = () => {
  const { currentPage, backupSettings, updateBackupSettings } = useStore();

  // --- Auto-Backup Watcher Engine ---
  useEffect(() => {
    const checkBackup = () => {
      if (!backupSettings.enabled) return;

      const lastBackup = backupSettings.lastBackupAt ? new Date(backupSettings.lastBackupAt).getTime() : 0;
      const now = Date.now();
      const intervalMs = backupSettings.intervalHours * 60 * 60 * 1000;

      if (now - lastBackup > intervalMs) {
        // Time to backup!
        console.log("Triggering Auto-Backup...");
        
        const state = useStore.getState();
        const backupData = {
          doctorProfile: state.doctorProfile,
          patients: state.patients,
          prescriptions: state.prescriptions,
          prescriptionTemplates: state.prescriptionTemplates,
          library: state.library,
          backupSettings: state.backupSettings, // Save settings too
          exportDate: new Date().toISOString(),
          version: '1.0'
        };

        try {
          const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Medimind_AutoBackup_${new Date().toISOString().split('T')[0]}_${new Date().getHours()}h.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Update timestamp
          updateBackupSettings({ lastBackupAt: new Date().toISOString() });
        } catch (error) {
          console.error("Auto backup failed:", error);
        }
      }
    };

    // Check immediately on mount (in case we missed it while closed)
    checkBackup();

    // Then check periodically (e.g., every 1 minute)
    const intervalId = setInterval(checkBackup, 60000); 

    return () => clearInterval(intervalId);
  }, [backupSettings.enabled, backupSettings.intervalHours, backupSettings.lastBackupAt, updateBackupSettings]);

  const renderPage = () => {
    switch (currentPage) {
      case 'DASHBOARD': return <Dashboard />;
      case 'PATIENTS': return <PatientManager />;
      case 'DIAGNOSIS': return <Diagnosis />;
      case 'LIBRARY': return <Library />;
      case 'PRESCRIPTIONS': return <PrescriptionPad />;
      case 'SETTINGS': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-row-reverse">
      <Sidebar />
      <main className="flex-1 mr-64 transition-all duration-300">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
