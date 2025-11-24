
export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other'
}

export interface Patient {
  id: string;
  fullName: string;
  age: number;
  gender: Gender;
  phone: string;
  medicalHistory: string; // Past diseases, diabetes, etc.
  allergies: string; // Penicillin, etc.
  registeredAt: string;
}

export interface Vitals {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  oxygenLevel: string;
  weight: string;
  glucose: string; // New field for Blood Sugar
}

export interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  category: string;
  isDownloaded: boolean; 
  isPlaceholder?: boolean; // If true, it's just a recommendation without content
  sourceUrl?: string; // Link to the book source/publisher
  accessType?: 'FREE' | 'PAID'; // New field: Is it a direct download or a store link?
  contentSnippets: string[]; // Legacy snippets
  content?: string; // Full text content for RAG
  fileType?: 'PDF' | 'TXT' | 'WEB' | 'MANUAL';
  dateAdded?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  date: string;
  diagnosis?: string; // Final diagnosis by the doctor (Internal record)
  medications: {
    name: string;
    dosage: string;
    instructions: string;
  }[];
  notes: string; // Instructions for the patient (Visible on print)
  labFindings?: string; // Stored AI analysis of lab reports/images from this visit
}

export interface PrescriptionTemplate {
  id: string;
  name: string; // e.g., "Cold Protocol"
  medications: {
    name: string;
    dosage: string;
    instructions: string;
  }[];
  notes: string;
  diagnosis: string; // Default diagnosis for this template
}

export interface SafetyCheckResult {
  hasIssues: boolean;
  interactions: {
    type: 'DRUG-DRUG' | 'PATIENT-RISK';
    severity: 'HIGH' | 'MODERATE';
    description: string;
  }[];
}

export interface TraditionalMedicine {
    temperament: string; // e.g., "Sard-o-Tar" (Cold & Wet)
    recommendedFoods: string[]; // "Do's"
    forbiddenFoods: string[]; // "Don'ts"
    herbalRemedies: string[]; // Teas, plants
    lifestyleTips: string[]; // Sleep, environment, etc.
}

// New Interface for the Supervisor Feature
export interface SupervisorResult {
  verdict: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT'; // The final judgment
  score: number; // 0-100 score of the current diagnosis
  critiqueSummary: string; // A ruthless summary of what's wrong or right
  diagnosticFlaws: string[]; // 90% priority: Logic errors, missed differentials
  safetyConcerns: string[]; // 10% priority: Interactions, contraindications
  suggestedAction: string; // The text that will be fed back into the Deep Review loop
}

export interface DiagnosisResult {
  diagnosis: string;
  confidence: number; // 0-100
  reasoning: string; // Why this diagnosis?
  simplifiedExplanation?: string; // New: Simple summary for general understanding
  labAnalysis?: string; // Extracted text analysis from uploaded images
  safetyWarnings: string[]; // General patient warnings (not specific drug-drug interactions)
  suggestedMedications: {
    name: string;
    dosage: string;
    reason: string;
  }[];
  treatmentPlan: string[]; // Keep for legacy/simple string list compatibility if needed, or derive from suggestions
  dietaryAdvice: {
    recommended: string[];
    avoid: string[];
  };
  // New Field for the Wellness Card
  traditionalMedicine?: TraditionalMedicine;
  
  sources: { title: string; uri: string }[];
  
  // New Fields for Deep Review / Consilium
  debateResponse?: string; // The AI's conversational reply to the doctor's objection
  debateOutcome?: 'AGREE' | 'DEFEND'; // Did AI accept the doctor's view or defend its own?
}

export interface DoctorProfile {
  fullName: string;
  specialty: string;
  medicalSystemNumber: string;
  phone: string;
  address: string;
  headerImage?: string; // Base64 string of the uploaded background/header image
}

export interface BackupSettings {
  enabled: boolean;
  intervalHours: number; // e.g., 4, 12, 24
  lastBackupAt: string | null; // ISO Date string
}

export type PageView = 'DASHBOARD' | 'PATIENTS' | 'DIAGNOSIS' | 'LIBRARY' | 'PRESCRIPTIONS' | 'SETTINGS';