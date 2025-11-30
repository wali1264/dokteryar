
import { create } from 'zustand';
import { supabase } from './lib/supabaseClient';
import { Patient, Prescription, Book, PageView, PrescriptionTemplate, DoctorProfile, BackupSettings, DiagnosisResult, Visit, UserRole, LabRequest, Payment, LabResultItem, VisitStatus } from './types';
import { v4 as uuidv4 } from 'uuid';
import { performDiagnosis, extractClinicalData } from './services/geminiService';

interface AppState {
  // UI State
  currentPage: PageView;
  setPage: (page: PageView) => void;
  isLoading: boolean;
  
  // Auth State
  session: any | null;
  userRole: UserRole | null;
  setSession: (session: any) => void;
  signOut: () => Promise<void>;
  
  // Permissions Logic
  hasPermission: (permission: string) => boolean;

  // Data State
  doctorProfile: DoctorProfile;
  fetchDoctorProfile: () => Promise<void>;
  updateDoctorProfile: (profile: DoctorProfile) => Promise<void>;

  // Admin: User Management
  allUsers: DoctorProfile[];
  fetchAllUsers: () => Promise<void>;
  updateUserRoleAndPermissions: (userId: string, role: UserRole, permissions: string[], isApproved: boolean) => Promise<void>;

  patients: Patient[];
  fetchPatients: () => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'registeredAt'>) => Promise<Patient | null>;
  updatePatient: (patient: Patient) => Promise<void>;
  
  prescriptions: Prescription[];
  fetchPrescriptions: () => Promise<void>;
  
  // Active Visits (Mission Control & Waiting Room)
  activeVisits: Visit[];
  fetchActiveVisits: () => Promise<void>;
  requestConsult: (patientId: string, symptoms: string, vitals: any, aiResult: DiagnosisResult | null) => Promise<void>;
  respondToConsult: (visitId: string, feedback: string) => Promise<void>;
  
  // Appointment Logic
  createPaidVisit: (patientId: string, doctorId: string, amount: number, isPaid: boolean) => Promise<number>;
  holdVisitForLab: (visitId: string) => Promise<void>;

  // Admin AI Actions
  runAdminDiagnosis: (visit: Visit, selectedBookIds?: string[], useWebSearch?: boolean) => Promise<void>;
  updateAiDiagnosis: (visitId: string, diagnosisId: string | null, updatedAnalysis: DiagnosisResult) => Promise<void>;
  
  // Document Extraction
  extractAndSaveClinicalData: (visitId: string, file: File) => Promise<string>;

  // Deep Record Saving
  saveCompleteVisit: (
      patientId: string, 
      diagnosisResult: DiagnosisResult | null, 
      medications: any[], 
      notes: string,
      labImages: File[]
  ) => Promise<string>; 

  prescriptionTemplates: PrescriptionTemplate[];
  fetchTemplates: () => Promise<void>;
  addPrescriptionTemplate: (template: Omit<PrescriptionTemplate, 'id'>) => Promise<void>;
  updatePrescriptionTemplate: (template: PrescriptionTemplate) => Promise<void>;
  deletePrescriptionTemplate: (id: string) => Promise<void>;

  library: Book[];
  fetchLibrary: () => Promise<void>;
  addToLibrary: (book: Omit<Book, 'id' | 'isDownloaded' | 'dateAdded'>) => Promise<void>;
  downloadBook: (bookId: string, content: string) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;

  // --- Cashier & Lab State ---
  unpaidVisits: Visit[];
  unpaidLabRequests: LabRequest[];
  pendingLabTests: LabRequest[]; // Paid but not completed
  labHistory: LabRequest[]; // Completed tests (Archive)
  todaysPayments: Payment[]; // New: History
  fetchCashierQueue: () => Promise<void>;
  processPayment: (type: 'VISIT_FEE' | 'LAB_TEST' | 'OTHER', id: string, amount: number, patientId?: string, description?: string) => Promise<void>;
  
  fetchLabQueue: () => Promise<void>;
  fetchLabHistory: () => Promise<void>;
  createLabRequest: (visitId: string, patientId: string, testName: string, price: number) => Promise<void>;
  completeLabTest: (requestId: string, resultFiles: File[], notes: string, structuredResults: LabResultItem[]) => Promise<void>;

  // Logs & Settings
  aiUsageLog: string[];
  logAiInteraction: () => void;
  backupSettings: BackupSettings;
  updateBackupSettings: (settings: Partial<BackupSettings>) => void;
  importData: (data: any) => void;

  // Realtime Logic
  initializeRealtime: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentPage: 'DASHBOARD',
  setPage: (page) => set({ currentPage: page }),
  isLoading: false,

  // --- Auth ---
  session: null,
  userRole: null,
  setSession: async (session) => {
    set({ session });
    if (session) {
       await get().fetchDoctorProfile();
       const role = get().userRole;
       
       if (role === 'accountant') {
           get().fetchCashierQueue();
           get().fetchPatients();
           get().fetchAllUsers(); 
       } else if (role === 'lab_tech') {
           get().fetchLabQueue();
           get().fetchLabHistory();
           get().fetchPatients();
       } else {
           get().fetchPatients();
           get().fetchPrescriptions();
           get().fetchTemplates();
           get().fetchLibrary();
           get().fetchActiveVisits();
       }
       
       if (role === 'admin') {
           get().fetchAllUsers();
           get().fetchCashierQueue(); 
       }
       get().initializeRealtime();
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, userRole: null, currentPage: 'DASHBOARD' });
  },

  hasPermission: (permission: string) => {
      const profile = get().doctorProfile;
      if (profile.role === 'admin') return true;
      if (profile.permissions?.includes('*')) return true;
      return profile.permissions?.includes(permission) || false;
  },

  // --- Realtime ---
  initializeRealtime: () => {
    supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => get().fetchPatients())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => get().fetchPrescriptions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
          get().fetchActiveVisits();
          get().fetchCashierQueue();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_requests' }, () => {
          get().fetchCashierQueue();
          get().fetchLabQueue();
          get().fetchLabHistory();
          get().fetchActiveVisits();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
          get().fetchCashierQueue(); 
      })
      .subscribe();
  },

  // --- Doctor Profile ---
  doctorProfile: {
    fullName: '',
    specialty: '',
    medicalSystemNumber: '',
    phone: '',
    address: '',
    headerImage: '',
    permissions: []
  },
  fetchDoctorProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (data) {
      set({ 
        doctorProfile: {
           id: data.id,
           fullName: data.full_name,
           specialty: data.specialty || '',
           medicalSystemNumber: data.medical_system_number || '',
           phone: data.phone || '',
           headerImage: data.avatar_url || '',
           address: '',
           role: data.role,
           permissions: data.permissions || [],
           isApproved: data.is_approved
        },
        userRole: data.role
      });
    }
  },
  updateDoctorProfile: async (profile) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updates = {
      id: user.id,
      full_name: profile.fullName,
      specialty: profile.specialty,
      medical_system_number: profile.medicalSystemNumber,
      phone: profile.phone,
      avatar_url: profile.headerImage,
      updated_at: new Date(),
    };
    const { error } = await supabase.from('profiles').upsert(updates);
    if (!error) { set({ doctorProfile: profile }); }
  },

  // --- Admin: User Management ---
  allUsers: [],
  fetchAllUsers: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!error && data) {
          const mappedUsers: DoctorProfile[] = data.map((u: any) => ({
              id: u.id,
              fullName: u.full_name,
              role: u.role,
              specialty: u.specialty,
              medicalSystemNumber: u.medical_system_number,
              phone: u.phone,
              permissions: u.permissions || [],
              isApproved: u.is_approved,
              address: '',
          }));
          set({ allUsers: mappedUsers });
      }
  },
  updateUserRoleAndPermissions: async (userId, role, permissions, isApproved) => {
      const { error } = await supabase.from('profiles').update({ role: role, permissions: permissions, is_approved: isApproved }).eq('id', userId);
      if (!error) { get().fetchAllUsers(); } 
      else { throw error; }
  },

  // --- Patients ---
  patients: [],
  fetchPatients: async () => {
    const { data, error } = await supabase.from('patients').select('*').order('registered_at', { ascending: false });
    if (!error && data) {
        const mappedPatients: Patient[] = data.map((p: any) => ({
            id: p.id,
            fullName: p.full_name,
            age: p.age,
            gender: p.gender,
            phone: p.phone,
            medicalHistory: p.medical_history,
            allergies: p.allergies,
            registeredAt: p.registered_at,
            national_id: p.national_id
        }));
        set({ patients: mappedPatients });
    }
  },
  addPatient: async (patient) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbPatient = {
        full_name: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        medical_history: patient.medicalHistory,
        allergies: patient.allergies,
        created_by: user.id
    };

    const { data, error } = await supabase.from('patients').insert(dbPatient).select().single();
    if (!error && data) {
        get().fetchPatients();
        return {
            id: data.id,
            fullName: data.full_name,
            age: data.age,
            gender: data.gender,
            phone: data.phone,
            medicalHistory: data.medical_history,
            allergies: data.allergies,
            registeredAt: data.registered_at
        };
    }
    return null;
  },
  updatePatient: async (patient) => {
    const updates = {
        full_name: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        medical_history: patient.medicalHistory,
        allergies: patient.allergies
    };
    const { error } = await supabase.from('patients').update(updates).eq('id', patient.id);
    if (!error) get().fetchPatients();
  },

  // --- Prescriptions ---
  prescriptions: [],
  fetchPrescriptions: async () => {
    const { data, error } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false });
    if (!error && data) {
        const mappedRx: Prescription[] = data.map((r: any) => ({
            id: r.id,
            patientId: r.patient_id,
            date: r.created_at,
            diagnosis: undefined, 
            medications: r.medications,
            notes: r.notes
        }));
        set({ prescriptions: mappedRx });
    }
  },

  // --- Mission Control & Visits ---
  activeVisits: [],
  fetchActiveVisits: async () => {
      const user = get().session?.user;
      if (!user) return;
      const role = get().userRole;

      let query = supabase
        .from('visits')
        .select(`*, patients (*), profiles (full_name), diagnoses (id, ai_analysis)`)
        .or('status.eq.waiting,status.eq.pending_lab,status.eq.lab_ready,status.eq.pending_review,status.eq.reviewed')
        .order('visit_date', { ascending: false });

      // DOCTOR ISOLATION: Doctors only see their own assigned patients
      if (role === 'doctor') {
          query = query.eq('doctor_id', user.id);
      }

      const { data, error } = await query;

      if (!error && data) {
          const mapped: Visit[] = data.map((v: any) => ({
              id: v.id,
              patientId: v.patient_id,
              doctorId: v.doctor_id,
              visitDate: v.visit_date,
              vitals: v.vitals,
              symptoms: v.symptoms,
              status: v.status,
              paymentStatus: v.payment_status,
              patientName: v.patients?.full_name,
              patientAge: v.patients?.age,
              doctorName: v.profiles?.full_name,
              aiAnalysis: v.diagnoses?.[0]?.ai_analysis,
              diagnosisId: v.diagnoses?.[0]?.id,
              fullPatientData: v.patients,
              extractedClinicalData: v.ai_analysis // Temporary placeholder or use separate field if DB schema updated
          }));
          set({ activeVisits: mapped });
      }
  },

  createPaidVisit: async (patientId, doctorId, amount, isPaid) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      // 1. Calculate Queue Number
      const today = new Date();
      today.setHours(0,0,0,0);
      const { count } = await supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', doctorId)
          .gte('visit_date', today.toISOString());
      
      const queueNumber = (count || 0) + 1;

      // 2. Create Visit Record
      const { data: visit, error: visitError } = await supabase.from('visits').insert({
          patient_id: patientId,
          doctor_id: doctorId,
          status: 'waiting',
          payment_status: isPaid ? 'paid' : 'unpaid',
          visit_date: new Date().toISOString(),
          symptoms: '',
          vitals: {}
      }).select().single();

      if (visitError) throw visitError;

      // 3. Create Payment Record (ONLY if isPaid is true)
      if (isPaid) {
          await supabase.from('payments').insert({
              patient_id: patientId,
              cashier_id: user.id,
              amount: amount,
              payment_type: 'VISIT_FEE',
              reference_id: visit.id
          });
      }

      get().fetchCashierQueue(); 
      get().fetchActiveVisits();
      
      return queueNumber;
  },

  holdVisitForLab: async (visitId) => {
      await supabase.from('visits').update({ status: 'pending_lab' }).eq('id', visitId);
      get().fetchActiveVisits();
  },

  requestConsult: async (patientId, symptoms, vitals, aiResult) => {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
          const { data: visit, error: visitError } = await supabase.from('visits').insert({
                patient_id: patientId, doctor_id: user.id, status: 'pending_review', payment_status: 'paid', symptoms: symptoms, vitals: vitals
            }).select().single();
          if (visitError) throw visitError;
          if (aiResult) {
              await supabase.from('diagnoses').insert({
                  visit_id: visit.id, final_diagnosis: aiResult.diagnosis, ai_analysis: JSON.stringify(aiResult), confidence_score: aiResult.confidence, lab_analysis_text: aiResult.labAnalysis
              });
          }
          get().fetchActiveVisits(); set({ isLoading: false });
      } catch (error) { console.error(error); set({ isLoading: false }); throw error; }
  },

  respondToConsult: async (visitId, feedback) => {
      const { error } = await supabase.from('visits').update({ status: 'reviewed' }).eq('id', visitId);
      if (!error) get().fetchActiveVisits();
  },

  runAdminDiagnosis: async (visit: any, selectedBookIds: string[] = [], useWebSearch: boolean = true) => {
      set({ isLoading: true });
      try {
          const patientData: Patient = {
              id: visit.patientId, fullName: visit.fullPatientData?.full_name || visit.patientName, age: visit.fullPatientData?.age || visit.patientAge, gender: visit.fullPatientData?.gender || 'Male', phone: visit.fullPatientData?.phone || '', medicalHistory: visit.fullPatientData?.medical_history || '', allergies: visit.fullPatientData?.allergies || '', registeredAt: new Date().toISOString()
          };
          const pastPrescriptions = get().prescriptions.filter(p => p.patientId === visit.patientId);
          const selectedBooks = get().library.filter(b => selectedBookIds.includes(b.id));
          const aiResult = await performDiagnosis({ 
              patient: patientData, 
              symptoms: visit.symptoms, 
              vitals: visit.vitals, 
              selectedBooks: selectedBooks, 
              useWebSearch: useWebSearch, 
              pastPrescriptions,
              extractedClinicalData: visit.extractedClinicalData // Pass any pre-extracted summary
          });

          if (!visit.aiAnalysis) {
             await supabase.from('diagnoses').insert({ visit_id: visit.id, final_diagnosis: aiResult.diagnosis, ai_analysis: JSON.stringify(aiResult), confidence_score: aiResult.confidence, lab_analysis_text: aiResult.labAnalysis });
          } else {
             const { data: d } = await supabase.from('diagnoses').select('id').eq('visit_id', visit.id).single();
             if (d) await supabase.from('diagnoses').update({ final_diagnosis: aiResult.diagnosis, ai_analysis: JSON.stringify(aiResult), confidence_score: aiResult.confidence, lab_analysis_text: aiResult.labAnalysis }).eq('id', d.id);
          }
          get().fetchActiveVisits();
      } catch (e) { console.error(e); alert("خطا در پردازش: " + e); } finally { set({ isLoading: false }); }
  },

  updateAiDiagnosis: async (visitId, diagnosisId, updatedAnalysis) => {
      set({ isLoading: true });
      try {
          if (diagnosisId) await supabase.from('diagnoses').update({ final_diagnosis: updatedAnalysis.diagnosis, ai_analysis: JSON.stringify(updatedAnalysis) }).eq('id', diagnosisId);
          else await supabase.from('diagnoses').insert({ visit_id: visitId, final_diagnosis: updatedAnalysis.diagnosis, ai_analysis: JSON.stringify(updatedAnalysis), confidence_score: 100 });
          get().fetchActiveVisits();
      } catch (e) { console.error(e); } finally { set({ isLoading: false }); }
  },

  extractAndSaveClinicalData: async (visitId, file) => {
      try {
          set({ isLoading: true });
          const text = await extractClinicalData(file);
          // Currently we don't have a dedicated field for extracted summary in 'visits' table in this mock.
          // We will append it to symptoms for now, OR update a JSONB field if available.
          // Ideally, we should have a `medical_documents_summary` text field.
          // For now, let's append to 'symptoms' with a separator so the AI sees it.
          
          const currentVisit = get().activeVisits.find(v => v.id === visitId);
          if (currentVisit) {
              const newSymptoms = currentVisit.symptoms + `\n\n[EXTRACTED DOCUMENT DATA]: ${text}`;
              await supabase.from('visits').update({ symptoms: newSymptoms }).eq('id', visitId);
              get().fetchActiveVisits();
          }
          set({ isLoading: false });
          return text;
      } catch (e) {
          set({ isLoading: false });
          throw e;
      }
  },

  saveCompleteVisit: async (patientId, diagnosisResult, medications, notes, labImages) => {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ isLoading: false }); throw new Error('User not logged in'); }
      try {
          const imageUrls: string[] = [];
          if (labImages.length > 0) {
              for (const file of labImages) {
                  const fileExt = file.name.split('.').pop();
                  const fileName = `${uuidv4()}.${fileExt}`;
                  const filePath = `${user.id}/${fileName}`;
                  const { error: uploadError } = await supabase.storage.from('lab_images').upload(filePath, file);
                  if (!uploadError) imageUrls.push(filePath); 
              }
          }
          const activeVisit = get().activeVisits.find(v => v.patientId === patientId && (v.status === 'waiting' || v.status === 'lab_ready'));
          let visitId = activeVisit?.id;
          if (visitId) {
              await supabase.from('visits').update({ status: 'completed', symptoms: diagnosisResult ? 'AI Diagnosis Session' : 'Manual Prescription' }).eq('id', visitId);
          } else {
              const { data: visit, error: visitError } = await supabase.from('visits').insert({ patient_id: patientId, doctor_id: user.id, status: 'completed', payment_status: 'paid', symptoms: diagnosisResult ? 'AI Diagnosis Session' : 'Manual Prescription', vitals: {} }).select().single();
              if (visitError) throw visitError;
              visitId = visit.id;
          }
          if (diagnosisResult) {
              await supabase.from('diagnoses').insert({ visit_id: visitId, final_diagnosis: diagnosisResult.diagnosis, ai_analysis: JSON.stringify(diagnosisResult), confidence_score: diagnosisResult.confidence, lab_analysis_text: diagnosisResult.labAnalysis, traditional_medicine_advice: diagnosisResult.traditionalMedicine });
          }
          const { data: rx, error: rxError } = await supabase.from('prescriptions').insert({ visit_id: visitId, patient_id: patientId, doctor_id: user.id, medications: medications, notes: notes }).select().single();
          if (rxError) throw rxError;
          get().fetchPrescriptions(); get().fetchActiveVisits(); set({ isLoading: false });
          return rx.id;
      } catch (error) { console.error(error); set({ isLoading: false }); throw error; }
  },

  // --- CASHIER & LAB ---
  unpaidVisits: [],
  unpaidLabRequests: [],
  pendingLabTests: [],
  labHistory: [],
  todaysPayments: [], 
  
  fetchCashierQueue: async () => {
      const { data: visits } = await supabase.from('visits').select('*, patients(full_name), profiles(full_name)').eq('payment_status', 'unpaid').order('visit_date', { ascending: false });
      const { data: labs } = await supabase.from('lab_requests').select('*, patients(full_name), profiles(full_name)').eq('status', 'pending_payment').order('created_at', { ascending: false });
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const { data: payments } = await supabase.from('payments').select('*, patients(full_name), profiles(full_name)').gte('created_at', today.toISOString()).order('created_at', { ascending: false });

      if (visits) {
          const mappedVisits = visits.map((v: any) => ({ ...v, visitDate: v.visit_date, patientName: v.patients?.full_name, doctorName: v.profiles?.full_name, paymentStatus: 'unpaid' }));
          set({ unpaidVisits: mappedVisits });
      }
      if (labs) {
          const mappedLabs = labs.map((l: any) => ({ id: l.id, visitId: l.visit_id, patientId: l.patient_id, doctorId: l.doctor_id, testName: l.test_name, price: l.price, status: l.status, createdAt: l.created_at, patientName: l.patients?.full_name, doctorName: l.profiles?.full_name }));
          set({ unpaidLabRequests: mappedLabs });
      }
      if (payments) {
          const mappedPayments: Payment[] = payments.map((p: any) => ({
             id: p.id, patientId: p.patient_id, cashierId: p.cashier_id, amount: p.amount, paymentType: p.payment_type, referenceId: p.reference_id, createdAt: p.created_at, patientName: p.patients?.full_name, cashierName: p.profiles?.full_name, description: p.description
          }));
          set({ todaysPayments: mappedPayments });
      }
  },

  processPayment: async (type, id, amount, patientId, description) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const paymentData: any = {
          cashier_id: user.id,
          amount: amount,
          payment_type: type,
          reference_id: id,
          description: description
      };
      
      if (patientId) paymentData.patient_id = patientId;

      await supabase.from('payments').insert(paymentData);
      
      if (type === 'VISIT_FEE') await supabase.from('visits').update({ payment_status: 'paid' }).eq('id', id);
      else if (type === 'LAB_TEST') await supabase.from('lab_requests').update({ status: 'paid' }).eq('id', id);
      // 'OTHER' type doesn't need to update any status table
      
      get().fetchCashierQueue();
  },

  fetchLabQueue: async () => {
      const { data } = await supabase.from('lab_requests').select('*, patients(full_name), profiles(full_name)').in('status', ['paid', 'processing']).order('created_at', { ascending: true });
      if (data) {
          const mapped: LabRequest[] = data.map((l: any) => ({ id: l.id, visitId: l.visit_id, patientId: l.patient_id, doctorId: l.doctor_id, testName: l.test_name, price: l.price, status: l.status, createdAt: l.created_at, patientName: l.patients?.full_name, doctorName: l.profiles?.full_name, resultFiles: l.result_files, technicianNotes: l.technician_notes }));
          set({ pendingLabTests: mapped });
      }
  },

  fetchLabHistory: async () => {
      const { data } = await supabase.from('lab_requests').select('*, patients(full_name), profiles(full_name)').eq('status', 'completed').order('completed_at', { ascending: false }).limit(50);
      if (data) {
          const mapped: LabRequest[] = data.map((l: any) => {
              let structured = [];
              try { structured = l.ai_analysis ? JSON.parse(l.ai_analysis) : []; } catch(e) {}
              return { id: l.id, visitId: l.visit_id, patientId: l.patient_id, doctorId: l.doctor_id, testName: l.test_name, price: l.price, status: l.status, createdAt: l.created_at, patientName: l.patients?.full_name, doctorName: l.profiles?.full_name, resultFiles: l.result_files, technicianNotes: l.technician_notes, structuredResults: Array.isArray(structured) ? structured : [] };
          });
          set({ labHistory: mapped });
      }
  },

  createLabRequest: async (visitId, patientId, testName, price) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('lab_requests').insert({ visit_id: visitId, patient_id: patientId, doctor_id: user?.id, test_name: testName, price: price, status: 'pending_payment' });
  },

  completeLabTest: async (requestId, resultFiles, notes, structuredResults) => {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      try {
        const uploadedUrls: string[] = [];
        for (const file of resultFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${requestId}_${uuidv4()}.${fileExt}`;
            const filePath = `${fileName}`;
            const { error: uploadError } = await supabase.storage.from('lab_results').upload(filePath, file);
            if (!uploadError) uploadedUrls.push(filePath);
        }
        await supabase.from('lab_requests').update({ status: 'completed', result_files: uploadedUrls, technician_notes: notes, ai_analysis: JSON.stringify(structuredResults), completed_at: new Date().toISOString() }).eq('id', requestId);
        const { data: req } = await supabase.from('lab_requests').select('visit_id').eq('id', requestId).single();
        if (req && req.visit_id) await supabase.from('visits').update({ status: 'lab_ready' }).eq('id', req.visit_id);
        get().fetchLabQueue(); get().fetchLabHistory(); get().fetchActiveVisits(); set({ isLoading: false });
      } catch (e) { console.error(e); set({ isLoading: false }); }
  },

  // --- Templates & Library ---
  prescriptionTemplates: [],
  fetchTemplates: async () => {
    const { data, error } = await supabase.from('prescription_templates').select('*');
    if (!error && data) {
         const mapped: PrescriptionTemplate[] = data.map((t: any) => ({ id: t.id, name: t.name, medications: t.medications, notes: t.default_notes || '', diagnosis: t.default_diagnosis || '' }));
         set({ prescriptionTemplates: mapped });
    }
  },
  addPrescriptionTemplate: async (tpl) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('prescription_templates').insert({ doctor_id: user?.id, name: tpl.name, medications: tpl.medications, default_notes: tpl.notes, default_diagnosis: tpl.diagnosis });
      get().fetchTemplates();
  },
  updatePrescriptionTemplate: async (tpl) => {
      await supabase.from('prescription_templates').update({ name: tpl.name, medications: tpl.medications, default_notes: tpl.notes, default_diagnosis: tpl.diagnosis }).eq('id', tpl.id);
      get().fetchTemplates();
  },
  deletePrescriptionTemplate: async (id) => {
      await supabase.from('prescription_templates').delete().eq('id', id);
      get().fetchTemplates();
  },

  library: [],
  fetchLibrary: async () => {
      const { data, error } = await supabase.from('library').select('*');
      if (!error && data) {
          const mapped: Book[] = data.map((b: any) => ({ id: b.id, title: b.title, author: b.author, category: b.category, summary: b.summary, content: b.content, sourceUrl: b.source_url, accessType: b.access_type, fileType: b.file_type, isDownloaded: b.is_downloaded, contentSnippets: [] }));
          set({ library: mapped });
      }
  },
  addToLibrary: async (book) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('library').insert({ title: book.title, author: book.author, category: book.category, summary: book.summary, content: book.content, source_url: book.sourceUrl, access_type: book.accessType, file_type: book.fileType, is_downloaded: !!book.content, added_by: user?.id });
      get().fetchLibrary();
  },
  downloadBook: async (id, content) => {
      await supabase.from('library').update({ content, is_downloaded: true }).eq('id', id);
      get().fetchLibrary();
  },
  deleteBook: async (id) => {
      await supabase.from('library').delete().eq('id', id);
      get().fetchLibrary();
  },

  aiUsageLog: [],
  logAiInteraction: () => set((state) => ({ aiUsageLog: [...state.aiUsageLog, new Date().toISOString()] })),
  backupSettings: { enabled: false, intervalHours: 24, lastBackupAt: null },
  updateBackupSettings: (s) => set((state) => ({ backupSettings: { ...state.backupSettings, ...s } })),
  importData: (json: any) => { console.log("Import not fully supported in Cloud mode yet."); }
}));
