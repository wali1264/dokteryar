
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Patient, Prescription, Book, PageView, PrescriptionTemplate, DoctorProfile, BackupSettings } from './types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  currentPage: PageView;
  setPage: (page: PageView) => void;
  
  doctorProfile: DoctorProfile;
  updateDoctorProfile: (profile: DoctorProfile) => void;

  backupSettings: BackupSettings;
  updateBackupSettings: (settings: Partial<BackupSettings>) => void;

  patients: Patient[];
  addPatient: (patient: Omit<Patient, 'id' | 'registeredAt'>) => void;
  updatePatient: (patient: Patient) => void;
  
  prescriptions: Prescription[];
  addPrescription: (rx: Omit<Prescription, 'id'>) => void;

  prescriptionTemplates: PrescriptionTemplate[];
  addPrescriptionTemplate: (template: Omit<PrescriptionTemplate, 'id'>) => void;
  updatePrescriptionTemplate: (template: PrescriptionTemplate) => void;
  deletePrescriptionTemplate: (id: string) => void;

  library: Book[];
  addToLibrary: (book: Omit<Book, 'id' | 'isDownloaded' | 'dateAdded'>) => void;
  downloadBook: (bookId: string, content: string) => void; // Simulate download
  deleteBook: (id: string) => void;

  aiUsageLog: string[]; // Timestamps of AI interactions
  logAiInteraction: () => void;

  importData: (data: Partial<AppState>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: 'DASHBOARD',
      setPage: (page) => set({ currentPage: page }),
      
      doctorProfile: {
        fullName: '',
        specialty: '',
        medicalSystemNumber: '',
        phone: '',
        address: '',
        headerImage: ''
      },
      updateDoctorProfile: (profile) => set({ doctorProfile: profile }),

      backupSettings: {
        enabled: false,
        intervalHours: 24,
        lastBackupAt: null
      },
      updateBackupSettings: (settings) => set((state) => ({
        backupSettings: { ...state.backupSettings, ...settings }
      })),

      patients: [],
      addPatient: (p) => set((state) => ({
        patients: [...state.patients, { ...p, id: uuidv4(), registeredAt: new Date().toISOString() }]
      })),
      updatePatient: (updatedPatient) => set((state) => ({
        patients: state.patients.map(p => p.id === updatedPatient.id ? updatedPatient : p)
      })),

      prescriptions: [],
      addPrescription: (rx) => set((state) => ({
        prescriptions: [...state.prescriptions, { ...rx, id: uuidv4() }]
      })),

      prescriptionTemplates: [],
      addPrescriptionTemplate: (template) => set((state) => ({
        prescriptionTemplates: [...state.prescriptionTemplates, { ...template, id: uuidv4() }]
      })),
      updatePrescriptionTemplate: (updatedTemplate) => set((state) => ({
        prescriptionTemplates: state.prescriptionTemplates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t)
      })),
      deletePrescriptionTemplate: (id) => set((state) => ({
        prescriptionTemplates: state.prescriptionTemplates.filter(t => t.id !== id)
      })),

      library: [],
      addToLibrary: (b) => set((state) => ({
        library: [...state.library, { ...b, id: uuidv4(), isDownloaded: !!b.content, dateAdded: new Date().toISOString() }]
      })),
      downloadBook: (id, content) => set((state) => ({
        library: state.library.map(b => b.id === id ? { ...b, isDownloaded: true, contentSnippets: [], content: content } : b)
      })),
      deleteBook: (id) => set((state) => ({
        library: state.library.filter(b => b.id !== id)
      })),

      aiUsageLog: [],
      logAiInteraction: () => set((state) => ({
        aiUsageLog: [...state.aiUsageLog, new Date().toISOString()]
      })),

      importData: (data) => set((state) => ({
        ...state,
        patients: data.patients || state.patients,
        prescriptions: data.prescriptions || state.prescriptions,
        prescriptionTemplates: data.prescriptionTemplates || state.prescriptionTemplates,
        library: data.library || state.library,
        doctorProfile: data.doctorProfile || state.doctorProfile,
        backupSettings: data.backupSettings || state.backupSettings,
        aiUsageLog: data.aiUsageLog || state.aiUsageLog
      })),
    }),
    {
      name: 'medimind-storage', // This ensures long-term persistence in localStorage
    }
  )
);
