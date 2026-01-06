
export interface PatientVitals {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  spO2: string;
  weight: string;
  height: string;
  respiratoryRate?: string; // RR
  bloodSugar?: string; // Glu
  bmi?: string;
  bsa?: string;
}

export interface PatientData {
  id?: string;
  displayId?: string; // e.g., "001", "002"
  name: string;
  age: string;
  gender: 'male' | 'female';
  phoneNumber?: string;
  chiefComplaint: string;
  history: string;
  allergies?: string;
  vitals: PatientVitals;
  image?: File | null;
  labReport?: File | null;
}

export interface PatientRecord extends PatientData {
  id: string;
  visitDate: number;
  status: 'waiting' | 'diagnosed' | 'completed';
  diagnosis?: DualDiagnosis;
  consensus?: string;
  imageBlob?: Blob;
  labReportBlob?: Blob;
  prescriptions?: PrescriptionRecord[];
}

export interface PrescriptionItem {
  drug: string;
  dosage: string;
  instruction: string;
}

export interface PrescriptionRecord {
  id: string;
  date: number;
  items: PrescriptionItem[];
  notes?: string;
  manualDiagnosis?: string;
  manualVitals?: PatientVitals;
  manualChiefComplaint?: string;
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  items: PrescriptionItem[];
}

// Drug Bank Types
export interface Drug {
  id: string;
  name: string; // Generic or Common Name
  category?: string;
  isCustom: boolean;
  createdAt: number;
}

export interface DrugUsage {
  drugName: string;
  count: number;
  lastUsed: number;
  commonInstructions: string[]; // Top 3 most used instructions for this drug
  lastDosage?: string;
  lastInstruction?: string;
}

export interface LayoutElement {
  id: string;
  type: 'text' | 'list' | 'container';
  label: string;
  x: number; // pixels
  y: number; // pixels
  width: number; // pixels
  height?: number; // pixels (optional for auto-height text)
  fontSize: number; // pt
  rotation: number; // degrees
  visible: boolean;
  align?: 'right' | 'center' | 'left';
}

export interface PrescriptionSettings {
  topPadding: number; 
  fontFamily: string;
  fontSize: number;
  paperSize: 'A4' | 'A5';
  backgroundImage?: string; // Base64
  printBackground: boolean; // Toggle to print the bg image or not
  elements: LayoutElement[]; // The coordinates for everything
  customDosages?: string[]; // Personal saved dosages like N=20
  customInstructions?: string[]; // Personal saved instructions like "Before sleep"
  autoBackupEnabled?: boolean; // New: Toggle for automatic hybrid backup
}

export interface DoctorProfile {
  name: string;
  specialty: string;
  medicalCouncilNumber: string;
  phone: string;
  address: string;
  logo?: string;
  digitalSignature?: string;
}

export interface DoctorDiagnosis {
  diagnosis: string;
  reasoning: string;
  treatmentPlan: string[];
  lifestyle: string[];
  warnings: string[];
  confidence?: string; 
}

export interface DualDiagnosis {
  modern: DoctorDiagnosis;
  traditional: DoctorDiagnosis;
  consensus?: string;
}

export interface LabAnalysis {
  sampleType: string;
  visualFindings: string;
  suspectedOrganism: string;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high';
  confidence?: string;
  nextSteps?: string[];
}

export interface RadiologyAnalysis {
  modality: string;
  region: string;
  findings: string[];
  impression: string;
  severity: 'normal' | 'abnormal' | 'critical';
  anatomicalLocation?: string;
  confidence?: string;
  nextSteps?: string[];
}

export interface PhysicalExamAnalysis {
  examType: 'skin' | 'tongue' | 'face';
  findings: string[];
  diagnosis: string;
  severity: 'low' | 'medium' | 'high';
  traditionalAnalysis?: string;
  recommendations: string[];
  confidence?: string;
  nextSteps?: string[];
}

export interface CardiologyAnalysis {
  type: 'ecg' | 'sound' | 'risk';
  findings: string[];
  impression: string;
  severity: 'normal' | 'abnormal' | 'critical';
  metrics?: {
    rate?: string;
    rhythm?: string;
    intervals?: string;
    prInterval?: string;
    qrsComplex?: string;
    qtInterval?: string;
  };
  recommendations: string[];
  confidence?: string;
  differentialDiagnosis?: string[];
}

export interface NeurologyAnalysis {
  type: 'tremor' | 'gait' | 'speech';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'abnormal' | 'critical';
  confidenceScore?: string;
  recommendations: string[];
  clinicalCorrelations?: string[];
}

export interface PsychologyAnalysis {
  type: 'art' | 'dream' | 'sentiment';
  findings: string[];
  interpretation: string;
  modernAnalysis?: string;
  traditionalAnalysis?: string;
  severity?: 'normal' | 'concern' | 'critical';
  recommendations: string[];
  confidence?: string;
}

export interface OphthalmologyAnalysis {
  type: 'fundus' | 'external' | 'vision_test';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'abnormal' | 'critical';
  systemicIndicators?: string[];
  recommendations: string[];
  confidence?: string;
}

export interface PediatricsAnalysis {
  type: 'cry' | 'development' | 'growth';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  confidenceScore?: string;
  recommendations: string[];
}

export interface OrthopedicsAnalysis {
  type: 'posture' | 'joints';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  angles?: string[];
  recommendations: string[];
  confidence?: string;
}

export interface DentistryAnalysis {
  type: 'caries' | 'opg' | 'smile';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  toothNumbers?: string[];
  recommendations: string[];
  confidence?: string;
}

export interface GynecologyAnalysis {
  type: 'ultrasound' | 'mammography' | 'fertility';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  measurements?: string[];
  recommendations: string[];
  confidence?: string;
}

export interface PulmonologyAnalysis {
  type: 'cough' | 'breath' | 'spirometry';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  metrics?: string[];
  recommendations: string[];
  confidence?: string;
  nextSteps?: string[];
}

export interface GastroenterologyAnalysis {
  type: 'meal' | 'endoscopy' | 'pain';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  mizaj?: string;
  nutrients?: string[];
  organ?: string;
  recommendations: string[];
  confidence?: string;
}

export interface UrologyAnalysis {
  type: 'dipstick' | 'stone' | 'function';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  dipstickValues?: { parameter: string; value: string; status: string }[];
  stoneDetails?: { size: string; location: string; passability: string };
  kidneyFunction?: { gfr: string; stage: string; mizaj: string };
  recommendations: string[];
  confidence?: string;
}

export interface HematologyAnalysis {
  type: 'smear' | 'pathology' | 'markers';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  cellTypes?: { name: string; count: string; status: string }[];
  markersTrend?: { name: string; trend: string; significance: string }[];
  recommendations: string[];
  confidence?: string;
}

export interface EmergencyAnalysis {
  type: 'wound' | 'toxicology' | 'triage';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'urgent' | 'critical';
  actions: string[];
  triageLevel?: string;
  antidote?: string;
  confidence?: string;
}

export interface GeneticsAnalysis {
  type: 'report' | 'pharma' | 'family';
  findings: string[];
  diagnosis: string;
  severity: 'normal' | 'concern' | 'critical';
  risks?: { condition: string; probability: string }[];
  drugCompatibility?: { drug: string; status: string; recommendation: string };
  recommendations: string[];
  confidence?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export enum AppRoute {
  DASHBOARD = 'dashboard',
  INTAKE = 'intake',
  DIAGNOSIS = 'diagnosis',
  LABORATORY = 'laboratory',
  RADIOLOGY = 'radiology',
  PHYSICAL_EXAM = 'physical_exam',
  CARDIOLOGY = 'cardiology',
  NEUROLOGY = 'neurology',
  PSYCHOLOGY = 'psychology',
  OPHTHALMOLOGY = 'ophthalmology',
  PEDIATRICS = 'pediatrics',
  ORTHOPEDICS = 'orthopedics',
  DENTISTRY = 'dentistry',
  GYNECOLOGY = 'gynecology',
  PULMONOLOGY = 'pulmonology',
  GASTROENTEROLOGY = 'gastroenterology',
  UROLOGY = 'urology',
  HEMATOLOGY = 'hematology',
  EMERGENCY = 'emergency',
  GENETICS = 'genetics',
  PRESCRIPTION = 'prescription',
  SETTINGS = 'settings'
}
