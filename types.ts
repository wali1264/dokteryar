
export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other'
}

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'accountant' | 'lab_tech';

export interface Patient {
  id: string;
  fullName: string;
  age: number;
  gender: Gender;
  phone: string;
  medicalHistory: string; 
  allergies: string; 
  registeredAt: string;
  national_id?: string;
}

export interface Vitals {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  oxygenLevel: string;
  weight: string;
  glucose: string;
}

export type VisitStatus = 'waiting' | 'pending_lab' | 'lab_ready' | 'completed' | 'pending_review' | 'reviewed';

export interface Visit {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  vitals: Vitals;
  symptoms: string;
  status: VisitStatus;
  paymentStatus?: 'paid' | 'unpaid';
  doctorName?: string; 
  patientName?: string; 
  patientAge?: number; 
  aiAnalysis?: string; 
  diagnosisId?: string;
  fullPatientData?: Patient;
  extractedClinicalData?: string; // New: To store extracted text from scans/docs
}

// New: Structured Lab Result Item
export interface LabResultItem {
  testName: string;
  result: string;
  unit: string;
  normalRange: string;
  flag: 'H' | 'L' | 'N' | 'A'; // High, Low, Normal, Abnormal
}

export interface LabRequest {
  id: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  testName: string;
  price: number;
  status: 'pending_payment' | 'paid' | 'processing' | 'completed';
  resultFiles?: string[];
  aiAnalysis?: string; // JSON string (Used for structured results now)
  technicianNotes?: string;
  createdAt: string;
  patientName?: string; 
  doctorName?: string; 
  structuredResults?: LabResultItem[]; // Helper for UI
}

export interface Payment {
  id: string;
  patientId?: string; // Optional for misc income
  cashierId: string;
  amount: number;
  paymentType: 'VISIT_FEE' | 'LAB_TEST' | 'OTHER';
  description?: string; // New: For misc income (e.g. "Injection")
  referenceId?: string;
  createdAt: string;
  patientName?: string; 
  cashierName?: string;
  queueNumber?: number; // Added for Receipt
}

export interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  category: string;
  isDownloaded: boolean; 
  isPlaceholder?: boolean;
  sourceUrl?: string; 
  accessType?: 'FREE' | 'PAID';
  contentSnippets: string[]; 
  content?: string; 
  fileType?: 'PDF' | 'TXT' | 'WEB' | 'MANUAL';
  dateAdded?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  date: string;
  diagnosis?: string; 
  medications: {
    name: string;
    dosage: string;
    instructions: string;
  }[];
  notes: string; 
  labFindings?: string; 
}

export interface PrescriptionTemplate {
  id: string;
  name: string; 
  medications: {
    name: string;
    dosage: string;
    instructions: string;
  }[];
  notes: string;
  diagnosis: string; 
}

export interface DoctorProfile {
  id?: string;
  fullName: string;
  specialty: string;
  medicalSystemNumber: string;
  phone: string;
  address: string;
  headerImage?: string; 
  role?: UserRole; 
  permissions?: string[]; 
  isApproved?: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  intervalHours: number; 
  lastBackupAt: string | null; 
}

// AI Types
export interface SafetyCheckResult {
  hasIssues: boolean;
  interactions: {
    type: 'DRUG-DRUG' | 'PATIENT-RISK';
    severity: 'HIGH' | 'MODERATE';
    description: string;
  }[];
}

export interface TraditionalMedicine {
    temperament: string;
    recommendedFoods: string[];
    forbiddenFoods: string[];
    herbalRemedies: string[];
    lifestyleTips: string[];
}

export interface SupervisorResult {
  verdict: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT';
  score: number;
  critiqueSummary: string;
  diagnosticFlaws: string[];
  safetyConcerns: string[];
  suggestedAction: string;
}

export interface DiagnosisResult {
  diagnosis: string;
  confidence: number;
  reasoning: string;
  simplifiedExplanation?: string;
  labAnalysis?: string;
  safetyWarnings: string[];
  suggestedMedications: {
    name: string;
    dosage: string;
    reason: string;
  }[];
  treatmentPlan: string[];
  dietaryAdvice: {
    recommended: string[];
    avoid: string[];
  };
  traditionalMedicine?: TraditionalMedicine;
  sources: { title: string; uri: string }[];
  debateResponse?: string;
  debateOutcome?: 'AGREE' | 'DEFEND';
}

export type PageView = 'DASHBOARD' | 'PATIENTS' | 'DIAGNOSIS' | 'LIBRARY' | 'PRESCRIPTIONS' | 'SETTINGS' | 'MISSION_CONTROL' | 'CASHIER' | 'LAB';
