
import React, { useState, useEffect, useRef } from 'react';
import { digitizePrescription, checkPrescriptionSafety, processScribeAudio } from '../services/geminiService';
import { saveTemplate, getAllTemplates, deleteTemplate, getSettings, saveRecord, getDoctorProfile, getUniquePatients, getAllDrugs, trackDrugUsage, getUsageStats } from '../services/db';
import { PrescriptionItem, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, PatientVitals, PatientRecord, Drug, DrugUsage } from '../types';
import { FileSignature, ScanLine, Printer, Save, Trash, Plus, CheckCircle, Search, LayoutTemplate, Activity, UserPlus, Stethoscope, ArrowLeft, X, Phone, Scale, AlertCircle, WifiOff, Camera, Image as ImageIcon, Heart, Thermometer, Wind, Droplet, Hash, FileText, ChevronRight, Loader2, Sparkles, User, RotateCw, History, RefreshCw, Zap, TrendingUp, Pill, Beaker, SprayCan, Brain, ZapOff, ShieldAlert, ShieldCheck, Info, Mic, MicOff, Check, FileCheck, Smartphone } from 'lucide-react';

interface PrescriptionProps {
  initialRecord: PatientRecord | null;
}

// Standard A4 dimensions in pixels at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// --- STABLE SUB-COMPONENT ---
const VitalInput = ({ label, icon: Icon, value, prevValue, unit, field, color, onChange }: any) => (
  <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col gap-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-200 transition-all relative">
     <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Icon size={18} className={color} />
           <label className="text-xs font-bold text-gray-500">{label}</label>
        </div>
        {unit && <span className="text-[10px] text-gray-300 font-mono uppercase">{unit}</span>}
     </div>
     <input 
        className="w-full text-center text-xl font-bold text-gray-800 outline-none bg-transparent placeholder-gray-200" 
        placeholder="---" 
        value={value} 
        onChange={e => onChange(field, e.target.value)} 
     />
     {prevValue && (
        <div className="flex items-center justify-center gap-1 opacity-40 group hover:opacity-100 transition-opacity">
           <History size={10} className="text-gray-400" />
           <span className="text-[10px] text-gray-400 font-bold">قبلی: {prevValue}</span>
        </div>
     )}
  </div>
);

const Prescription: React.FC<PrescriptionProps> = ({ initialRecord }) => {
  const [viewMode, setViewMode] = useState<'landing' | 'editor'>('landing');
  const [mobileTab, setMobileTab] = useState<'rx' | 'vitals' | 'templates'>('rx');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isExpressMode, setIsExpressMode] = useState(false);
  
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  
  const [allDrugs, setAllDrugs] = useState<Drug[]>([]);
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [suggestionType, setSuggestionType] = useState<'drug' | 'instruction' | null>(null);

  const [vitals, setVitals] = useState<PatientVitals>({
    bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: '', height: '', respiratoryRate: '', bloodSugar: ''
  });

  const [previousVitals, setPreviousVitals] = useState<PatientVitals | null>(null);
  const [activeDraft, setActiveDraft] = useState<any | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  
  const [settings, setSettings] = useState<PrescriptionSettings>({
    topPadding: 50, fontSize: 14, fontFamily: 'Vazirmatn', printBackground: true, paperSize: 'A4', elements: []
  });
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<'plain' | 'custom'>('plain');
  const [previewScale, setPreviewScale] = useState(0.5);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [templateName, setTemplateName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showQuickEntryModal, setShowQuickEntryModal] = useState(false);

  // AI Safety State
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyReport, setSafetyReport] = useState<any | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // --- AI SCRIBE STATE ---
  const [isRecordingScribe, setIsRecordingScribe] = useState(false);
  const [isProcessingScribe, setIsProcessingScribe] = useState(false);
  const scribeMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scribeChunksRef = useRef<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [scanOrientation, setScanOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // New Patient / Quick Form States
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'male' | 'female'>('male');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientWeight, setNewPatientWeight] = useState('');
  const [newPatientHistory, setNewPatientHistory] = useState('');
  const [newPatientAllergies, setNewPatientAllergies] = useState('');

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update scale for preview modal on resize
  useEffect(() => {
    if (showPrintModal) {
      const updateScale = () => {
        if (previewContainerRef.current) {
          const container = previewContainerRef.current;
          const availableWidth = container.offsetWidth - 48; // padding
          const availableHeight = container.offsetHeight - 48;
          const scaleX = availableWidth / A4_WIDTH;
          const scaleY = availableHeight / A4_HEIGHT;
          setPreviewScale(Math.min(scaleX, scaleY, 1) * 0.95);
        }
      };
      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [showPrintModal]);

  useEffect(() => {
    if (initialRecord) {
        handleSelectPatient(initialRecord);
    }
  }, [initialRecord]);

  useEffect(() => {
    if (!selectedPatient || viewMode !== 'editor' || isExpressMode) return;
    const draft = { items, diagnosis, vitals, timestamp: Date.now() };
    localStorage.setItem(`tabib_draft_${selectedPatient.id}`, JSON.stringify(draft));
  }, [items, diagnosis, vitals, selectedPatient, viewMode, isExpressMode]);

  const loadInitialData = async () => {
    try {
      const templatesData = await getAllTemplates();
      setTemplates(templatesData);
      const patientsData = await getUniquePatients();
      setAllPatients(patientsData);
      const drugsData = await getAllDrugs();
      setAllDrugs(drugsData);
      const stats = await getUsageStats();
      setUsageStats(stats);
      const s = await getSettings();
      if (s) setSettings(s);
      const p = await getDoctorProfile();
      if (p) setDoctorProfile(p);
    } catch (e) { console.error(e); }
  };

  const filteredPatients = allPatients.filter(p => p.name.includes(searchTerm));

  const handleSelectPatient = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setIsExpressMode(patient.id.startsWith('guest_'));
    setViewMode('editor');
    setVitals({
      bloodPressure: '', heartRate: '', temperature: '', spO2: '', 
      weight: patient.vitals?.weight || '', height: patient.vitals?.height || '', 
      respiratoryRate: '', bloodSugar: ''
    });
    setPreviousVitals(patient.vitals || null);
    setItems([]);
    setDiagnosis('');

    if (!patient.id.startsWith('guest_')) {
      const savedDraft = localStorage.getItem(`tabib_draft_${patient.id}`);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.items.length > 0 || parsed.diagnosis || parsed.vitals.bloodPressure) {
            setActiveDraft(parsed);
            setShowDraftBanner(true);
          }
        } catch (e) { console.error("Draft parse error", e); }
      }
    }
  };

  const handleVitalChange = (field: string, value: string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const applyDraft = () => {
    if (activeDraft) {
      setItems(activeDraft.items);
      setDiagnosis(activeDraft.diagnosis);
      setVitals(activeDraft.vitals);
      setShowDraftBanner(false);
      setActiveDraft(null);
    }
  };

  const discardDraft = () => {
    if (selectedPatient) localStorage.removeItem(`tabib_draft_${selectedPatient.id}`);
    setShowDraftBanner(false);
    setActiveDraft(null);
  };

  const handleRegisterPatient = async () => {
    if (!newPatientName) return;
    const newRecord: PatientRecord = {
      id: crypto.randomUUID(), name: newPatientName, age: newPatientAge, gender: newPatientGender,
      phoneNumber: newPatientPhone, chiefComplaint: '', history: newPatientHistory, allergies: newPatientAllergies,
      vitals: { bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: newPatientWeight, height: '', respiratoryRate: '', bloodSugar: '' },
      visitDate: Date.now(), status: 'waiting'
    };
    await saveRecord(newRecord);
    setShowNewPatientModal(false);
    clearFormStates();
    loadInitialData(); handleSelectPatient(newRecord);
  };

  const handleQuickEntry = () => {
    const guestRecord: PatientRecord = {
        id: `guest_${Date.now()}`,
        name: newPatientName || 'بیمار مهمان',
        age: newPatientAge,
        gender: newPatientGender,
        chiefComplaint: '', 
        history: '',
        visitDate: Date.now(),
        status: 'waiting',
        vitals: {
            bloodPressure: '', heartRate: '', temperature: '', spO2: '', 
            weight: newPatientWeight, height: '', respiratoryRate: '', bloodSugar: ''
        }
    };
    setShowQuickEntryModal(false);
    clearFormStates();
    handleSelectPatient(guestRecord);
  };

  const clearFormStates = () => {
    setNewPatientName(''); setNewPatientAge(''); setNewPatientGender('male'); setNewPatientPhone('');
    setNewPatientWeight(''); setNewPatientHistory(''); setNewPatientAllergies('');
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { alert("دسترسی به دوربین امکان‌پذیر نیست."); }
  };

  const stopCamera = () => {
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "prescription_scan.jpg", { type: "image/jpeg" });
            stopCamera(); await processFile(file);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) { stopCamera(); processFile(e.target.files[0]); }
  };

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const res = await digitizePrescription(file);
      if (res.items) setItems(res.items);
      if (res.diagnosis) setDiagnosis(res.diagnosis);
      if (res.vitals) setVitals(prev => ({ ...prev, ...res.vitals }));
    } catch (e) { alert('خطا در اسکن نسخه'); } finally { setLoading(false); }
  };

  const startScribeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                      ? { mimeType: 'audio/webm;codecs=opus' } 
                      : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      scribeMediaRecorderRef.current = mediaRecorder;
      scribeChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) scribeChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(scribeChunksRef.current, { type: options?.mimeType || 'audio/webm' });
        setIsProcessingScribe(true);
        try {
          const res = await processScribeAudio(audioBlob);
          if (res.diagnosis) setDiagnosis(res.diagnosis);
          if (res.items && res.items.length > 0) setItems(res.items);
        } catch (error) { 
          alert("خطا در واکاوی صوتی نسخه"); 
        } finally {
          setIsProcessingScribe(false); 
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorder.start();
      setIsRecordingScribe(true);
    } catch (err) { alert("لطفا دسترسی به میکروفون را فعال کنید."); }
  };

  const stopScribeRecording = () => { 
    if (scribeMediaRecorderRef.current && scribeMediaRecorderRef.current.state === 'recording') {
      scribeMediaRecorderRef.current.stop();
      setIsRecordingScribe(false);
    }
  };

  const addItem = () => setItems([...items, { drug: '', dosage: '', instruction: '' }]);

  const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    setSearchQuery(value);
  };

  const selectSuggestedDrug = (drugName: string) => {
    if (activeItemIndex === null) return;
    const newItems = [...items];
    newItems[activeItemIndex].drug = drugName;
    const stats = usageStats.find(u => u.drugName === drugName);
    if (stats) {
        if (stats.lastDosage) newItems[activeItemIndex].dosage = stats.lastDosage;
        if (stats.lastInstruction) newItems[activeItemIndex].instruction = stats.lastInstruction;
    }
    setItems(newItems); setActiveItemIndex(null); setSuggestionType(null);
  };

  const selectSuggestedInstruction = (instruction: string) => {
    if (activeItemIndex === null) return;
    const newItems = [...items];
    newItems[activeItemIndex].instruction = instruction;
    setItems(newItems); setActiveItemIndex(null); setSuggestionType(null);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSaveTemplate = async () => {
    if (!templateName) return;
    try {
      await saveTemplate({ id: crypto.randomUUID(), name: templateName, items });
      setShowSaveModal(false); setTemplateName(''); loadInitialData();
    } catch (e) { console.error(e); }
  };

  const handleAuditSafety = async () => {
    if (!isOnline) {
      alert("دکتر عزیز، واکاوی ایمنی هوشمند نیازمند اتصال به شبکه می‌باشد.");
      return;
    }
    if (items.length === 0 || !items.some(it => it.drug)) {
      alert("لطفاً ابتدا اقلام دارویی را وارد کنید.");
      return;
    }
    
    setSafetyLoading(true);
    try {
      const report = await checkPrescriptionSafety(items, { ...selectedPatient!, vitals });
      setSafetyReport(report);
      setShowSafetyModal(true);
    } catch (e) {
      alert("خطا در واکاوی ایمنی. لطفاً دوباره تلاش کنید.");
    } finally {
      setSafetyLoading(false);
    }
  };

  const loadTemplate = (t: PrescriptionTemplate) => {
    setItems(t.items);
    if(window.innerWidth < 1024) setMobileTab('rx'); 
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('آیا مطمئن هستید؟')) { await deleteTemplate(id); loadInitialData(); }
  };

  const getDrugSuggestions = () => {
    if (!searchQuery || searchQuery.length < 1) return [];
    const q = searchQuery.toLowerCase();
    const getWeight = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('tab') || n.includes('cap') || n.includes('قرص') || n.includes('کپسول')) return 10;
      if (n.includes('syr') || n.includes('susp') || n.includes('شربت') || n.includes('ساشه')) return 8;
      if (n.includes('inj') || n.includes('amp') || n.includes('vial') || n.includes('آمپول')) return 6;
      if (n.includes('oint') || n.includes('cream') || n.includes('gel') || n.includes('پماد')) return 4;
      return 0;
    };
    const results = allDrugs.filter(d => d.name.toLowerCase().includes(q) || (d.category && d.category.toLowerCase().includes(q)));
    return results.sort((a, b) => {
        const aStart = a.name.toLowerCase().startsWith(q);
        const bStart = b.name.toLowerCase().startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        const weightA = getWeight(a.name);
        const weightB = getWeight(b.name);
        if (weightA !== weightB) return weightB - weightA;
        return a.name.localeCompare(b.name);
    }).slice(0, 10);
  };

  const getFormIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('tab') || n.includes('cap') || n.includes('قرص') || n.includes('کپسول')) return <Pill className="text-blue-500" size={14} />;
    if (n.includes('syr') || n.includes('susp') || n.includes('شربت') || n.includes('ساشه')) return <Beaker className="text-emerald-500" size={14} />;
    if (n.includes('inj') || n.includes('amp') || n.includes('vial') || n.includes('آمپول')) return <Activity className="text-red-500" size={14} />;
    if (n.includes('oint') || n.includes('cream') || n.includes('gel') || n.includes('پماد')) return <Sparkles className="text-orange-500" size={14} />;
    if (n.includes('drop')) return <Droplet className="text-cyan-500" size={14} />;
    if (n.includes('spray')) return <SprayCan className="text-indigo-500" size={14} />;
    return <Zap className="text-gray-400" size={14} />;
  };

  const getQuickInstructions = (drugName: string) => {
    const stats = usageStats.find(u => u.drugName === drugName);
    return stats?.commonInstructions || ['هر ۸ ساعت', 'روزی یک عدد', 'قبل از غذا'];
  };

  // --- PREMIUM PRINT ENGINE ---
  const generateDigitalPrescriptionHtml = () => {
    const now = new Date().toLocaleDateString('fa-IR');
    const doctor = doctorProfile?.name || 'دکتر معالج';
    const specialty = doctorProfile?.specialty || 'متخصص و جراح';
    const medicalCouncil = doctorProfile?.medicalCouncilNumber || '---';

    return `
      <div style="padding: 40px; box-sizing: border-box; background: white; height: 100%; border: 15px solid #f8fafc; position: relative;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
          <div style="direction: rtl; text-align: right;">
            <h1 style="margin: 0; font-size: 26px; color: #1e293b; font-weight: 900;">${doctor}</h1>
            <p style="margin: 4px 0; font-size: 14px; color: #64748b; font-weight: 700;">${specialty}</p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 500;">نظام پزشکی: ${medicalCouncil}</p>
          </div>
          ${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 70px; width: 70px; object-fit: contain; border-radius: 12px; background: #f1f5f9; padding: 5px;" />` : `<div style="width:70px; height:70px; background:#f1f5f9; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-weight:black;">LOGO</div>`}
        </div>

        <!-- Patient Info Capsule -->
        <div style="background: #f8fafc; border-radius: 20px; padding: 20px; display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px; direction: rtl; border: 1px solid #e2e8f0;">
          <div style="flex: 1; min-width: 150px;"><span style="font-size: 10px; color: #94a3b8; font-weight: 900; text-transform: uppercase; display: block; margin-bottom: 4px;">بیمار</span><span style="font-size: 16px; color: #334155; font-weight: 900;">${selectedPatient?.name}</span></div>
          <div style="flex: 1; min-width: 50px;"><span style="font-size: 10px; color: #94a3b8; font-weight: 900; text-transform: uppercase; display: block; margin-bottom: 4px;">سن</span><span style="font-size: 16px; color: #334155; font-weight: 900;">${selectedPatient?.age}</span></div>
          <div style="flex: 1; min-width: 100px;"><span style="font-size: 10px; color: #94a3b8; font-weight: 900; text-transform: uppercase; display: block; margin-bottom: 4px;">تاریخ</span><span style="font-size: 16px; color: #334155; font-weight: 900;">${now}</span></div>
        </div>

        <!-- Vitals Bar -->
        <div style="display: flex; gap: 10px; margin-bottom: 30px; direction: ltr;">
          ${vitals.bloodPressure ? `<div style="padding: 6px 12px; background: #fee2e2; color: #ef4444; border-radius: 10px; font-size: 11px; font-weight: 900; border: 1px solid #fecaca;">BP: ${vitals.bloodPressure}</div>` : ''}
          ${vitals.heartRate ? `<div style="padding: 6px 12px; background: #fff1f2; color: #f43f5e; border-radius: 10px; font-size: 11px; font-weight: 900; border: 1px solid #ffe4e6;">HR: ${vitals.heartRate}</div>` : ''}
          ${vitals.spO2 ? `<div style="padding: 6px 12px; background: #ecfdf5; color: #10b981; border-radius: 10px; font-size: 11px; font-weight: 900; border: 1px solid #d1fae5;">SpO2: ${vitals.spO2}%</div>` : ''}
          ${vitals.weight ? `<div style="padding: 6px 12px; background: #f0f9ff; color: #0ea5e9; border-radius: 10px; font-size: 11px; font-weight: 900; border: 1px solid #e0f2fe;">WT: ${vitals.weight}kg</div>` : ''}
        </div>

        ${diagnosis ? `<div style="margin-bottom: 30px; padding: 15px; border-right: 4px solid #3b82f6; background: #eff6ff; border-radius: 4px 12px 12px 4px; direction: rtl; text-align: right;"><span style="font-size: 11px; color: #3b82f6; font-weight: 900; display: block; margin-bottom: 4px; text-transform: uppercase;">تشخیص / Diagnosis</span><p style="margin: 0; font-size: 14px; color: #1e3a8a; font-weight: 700;">${diagnosis}</p></div>` : ''}

        <div style="font-family: serif; font-size: 50px; color: #1e293b; margin-bottom: 10px; opacity: 0.1; font-style: italic; position: absolute; top: 380px; left: 40px;">Rx</div>
        <div style="font-family: serif; font-size: 38px; color: #1e293b; margin-bottom: 20px; font-weight: bold; position: relative; z-index: 1;">Rx</div>

        <!-- Medications Table -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 0 10px; direction: ltr;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 900; width: 40px;">#</th>
              <th style="text-align: left; padding: 10px; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 900;">Drug Description</th>
              <th style="text-align: right; padding: 10px; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 900; width: 100px;">Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr style="background: #ffffff; border: 1px solid #f1f5f9;">
                <td style="padding: 15px 10px; border-bottom: 1px solid #f1f5f9; color: #cbd5e1; font-weight: bold;">${i + 1}</td>
                <td style="padding: 15px 10px; border-bottom: 1px solid #f1f5f9;">
                  <div style="font-size: 15px; color: #334155; font-weight: 900;">${item.drug}</div>
                  <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 4px;">Sig: ${item.instruction}</div>
                </td>
                <td style="padding: 15px 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">
                  <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 900; font-family: monospace;">${item.dosage}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Footer Seal -->
        <div style="position: absolute; bottom: 60px; right: 40px; left: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; direction: rtl;">
          <div style="color: #94a3b8; font-size: 9px; font-weight: bold; max-width: 300px;">این نسخه توسط سامانه هوشمند طبیب واکاوی و ثبت گردیده است. اصالت نسخه از طریق پنل بایگانی مطب قابل استعلام می‌باشد.</div>
          <div style="text-align: center; opacity: 0.3;">
            <div style="width: 80px; height: 80px; border: 2px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; color: #94a3b8; transform: rotate(-15deg);">محل مهر و امضا</div>
          </div>
        </div>
      </div>
    `;
  };

  const generateCustomPrescriptionHtml = () => {
    let bgHtml = (settings.printBackground && settings.backgroundImage) ? `<img src="${settings.backgroundImage}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1;" />` : '';
    const elementsHtml = (settings.elements || []).filter(el => el.visible).map(el => {
       let innerHtml = '';
       switch (el.id) {
          case 'patientName': innerHtml = selectedPatient?.name || ''; break;
          case 'age': innerHtml = selectedPatient?.age || ''; break;
          case 'date': innerHtml = new Date().toLocaleDateString('fa-IR'); break;
          case 'diagnosis': innerHtml = diagnosis; break;
          case 'vital_bp': innerHtml = vitals.bloodPressure || ''; break;
          case 'vital_hr': innerHtml = vitals.heartRate || ''; break;
          case 'vital_rr': innerHtml = vitals.respiratoryRate || ''; break;
          case 'vital_temp': innerHtml = vitals.temperature || ''; break;
          case 'vital_weight': innerHtml = vitals.weight || ''; break;
          case 'items': innerHtml = `<ul style="list-style:none; padding:0; margin:0; direction: ltr; text-align: left;">${items.map((item, i) => `<li style="margin-bottom:8px;"><span style="font-weight:bold;">${i+1}. ${item.drug}</span><span style="margin:0 10px;">${item.dosage}</span><div style="font-size:0.9em; color:#444;">${item.instruction}</div></li>`).join('')}</ul>`; break;
          default: innerHtml = '';
       }
       if (!innerHtml) return '';
       return `<div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; font-size: ${el.fontSize}pt; transform: rotate(${el.rotation}deg); text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')}; white-space: nowrap;">${innerHtml}</div>`;
    }).join('');
    return `<div style="position: relative; width: 100%; height: 100%; overflow: hidden;">${bgHtml}${elementsHtml}</div>`;
  };

  const handlePrint = () => {
     if (!isExpressMode) saveToPatientRecord();
     items.forEach(item => { if (item.drug) trackDrugUsage(item.drug, item.dosage, item.instruction); });
     const win = window.open('', '_blank', 'width=900,height=1200');
     if (!win) return;

     const content = printMode === 'plain' ? generateDigitalPrescriptionHtml() : generateCustomPrescriptionHtml();

     let style = `
       @page { size: A4 portrait; margin: 0; }
       html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
       body { font-family: '${settings.fontFamily}', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
       .print-container { width: ${A4_WIDTH}px; height: ${A4_HEIGHT}px; overflow: hidden; position: relative; }
       @media print {
          .no-print { display: none !important; }
          .print-container { width: 100%; height: 100%; }
       }
       .control-bar { position: fixed; top: 0; left: 0; right: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 12px; display: flex; justify-content: center; gap: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); z-index: 9999; border-bottom: 1px solid #eee; }
       .btn { padding: 10px 24px; border-radius: 12px; border: none; font-family: '${settings.fontFamily}', sans-serif; font-weight: bold; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px; }
       .btn-print { background: #2563eb; color: white; }
     `;

     win.document.write(`
       <html dir="rtl">
       <head>
         <title>چاپ نسخه نهایی</title>
         <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100;400;700;900&display=swap" rel="stylesheet">
         <style>${style}</style>
       </head>
       <body>
         <div class="control-bar no-print">
            <button class="btn btn-print" onclick="window.print()">🖨️ تایید و چاپ</button>
            <button class="btn" style="background:#f1f5f9; color:#475569;" onclick="window.close()">بستن</button>
         </div>
         <div class="print-container">${content}</div>
       </body>
       </html>
     `);
     win.document.close();
     setShowPrintModal(false);
     if (isExpressMode) setViewMode('landing');
  };

  const saveToPatientRecord = async () => {
     if (!selectedPatient || isExpressMode) return;
     try {
       const record: PatientRecord = { ...selectedPatient, vitals: { ...selectedPatient.vitals, ...vitals }, status: 'completed', prescriptions: [ ...(selectedPatient.prescriptions || []), { id: crypto.randomUUID(), date: Date.now(), items: items, manualDiagnosis: diagnosis, manualVitals: vitals } ] };
       await saveRecord(record); localStorage.removeItem(`tabib_draft_${selectedPatient.id}`);
     } catch (e) { console.error(e); }
  };

  if (viewMode === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fade-in gap-8">
         <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-blue-50 w-full max-w-3xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-teal-400"></div>
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><Stethoscope size={48} /></div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">میز کار نسخه نویسی</h1>
            <p className="text-gray-500 mb-10 font-medium">نام بیمار را جستجو کنید یا از کپسول عملیاتی برای ثبت آنی استفاده کنید</p>
            
            <div className="relative max-w-2xl mx-auto mb-8">
               <div className="relative group">
                  <div className="absolute inset-y-2 right-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-600 transition-colors">
                     <Search size={24} />
                  </div>
                  
                  <input 
                     type="text" 
                     autoFocus 
                     placeholder="جستجوی نام بیمار..." 
                     className="w-full p-6 pr-14 pl-36 text-xl bg-gray-50 border border-gray-200 rounded-3xl focus:ring-8 focus:ring-teal-50 focus:border-teal-500 outline-none transition-all shadow-inner font-bold text-gray-700" 
                     value={searchTerm} 
                     onChange={e => setSearchTerm(e.target.value)} 
                  />

                  <div className="absolute top-2 left-2 bottom-2 bg-white rounded-2xl flex items-center shadow-sm border border-gray-100 p-1 gap-1">
                     <button 
                        onClick={() => setShowQuickEntryModal(true)} 
                        title="نسخه سریع (بدون بایگانی)"
                        className="h-full px-4 flex items-center justify-center bg-white hover:bg-teal-50 text-teal-600 rounded-xl transition-all active:scale-95 group/quick"
                     >
                        <User size={26} className="group-hover/quick:scale-110 transition-transform" />
                     </button>
                     
                     <div className="w-[1px] h-2/3 bg-gray-100 rounded-full"></div>

                     <button 
                        onClick={() => setShowNewPatientModal(true)} 
                        title="ثبت نام و تشکیل پرونده" 
                        className="h-full px-4 flex items-center justify-center bg-teal-500 hover:bg-teal-600 text-white rounded-xl shadow-md shadow-teal-100 transition-all active:scale-95 group/plus"
                     >
                        <UserPlus size={26} className="group-hover/plus:rotate-12 transition-transform" />
                     </button>
                  </div>
               </div>

               {searchTerm && filteredPatients.length > 0 && (
                 <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-20 max-h-72 overflow-y-auto animate-slide-up">
                    {filteredPatients.map(p => (
                       <button 
                          key={p.id} 
                          onClick={() => handleSelectPatient(p)} 
                          className="w-full text-right p-5 hover:bg-teal-50 border-b border-gray-50 last:border-0 flex justify-between items-center transition-all group"
                       >
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-all"><User size={20}/></div>
                             <span className="font-bold text-gray-700 text-lg">{p.name}</span>
                          </div>
                          <span className="text-sm font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full group-hover:bg-white group-hover:shadow-sm">{p.age} ساله</span>
                       </button>
                    ))}
                 </div>
               )}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 lg:pb-20 relative h-full">
      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        .animate-scan-line {
          animation: scan-line 3s linear infinite;
        }
        @keyframes safety-pulse {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .animate-safety-pulse {
          animation: safety-pulse 2s infinite;
        }
        @keyframes scribe-pulse {
          0% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.5); transform: scale(1); }
          50% { box-shadow: 0 0 0 15px rgba(147, 51, 234, 0); transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0); transform: scale(1); }
        }
        .animate-scribe-pulse {
          animation: scribe-pulse 1.5s infinite ease-in-out;
        }
        .scribe-glow {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
          border-color: rgba(168, 85, 247, 0.5) !important;
        }
        @keyframes waveform {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        .waveform-bar {
          width: 3px;
          background-color: #a855f7;
          border-radius: 2px;
          animation: waveform 0.8s ease-in-out infinite;
        }
      `}</style>

      {/* MOBILE HEADER UI */}
      <div className="lg:hidden flex flex-col gap-4">
         <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 flex-1 min-w-0"><button onClick={() => setViewMode('landing')} className="p-2 bg-gray-50 rounded-xl text-gray-600 flex-shrink-0"><ArrowLeft size={20}/></button><div className="min-w-0"><h2 className="font-bold text-gray-800 truncate text-sm">{selectedPatient?.name}</h2><p className="text-[10px] text-gray-400 truncate">{selectedPatient?.age} ساله</p></div></div>
            <div className="flex items-center gap-2">
               <button onClick={isRecordingScribe ? stopScribeRecording : startScribeRecording} disabled={isProcessingScribe || !isOnline} className={`p-2 rounded-xl transition-all ${isRecordingScribe ? 'bg-purple-600 text-white animate-scribe-pulse shadow-lg' : 'bg-purple-50 text-purple-600'}`}><Mic size={20}/></button>
               <button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg"><Printer size={20} /></button>
            </div>
         </div>
         {/* ... rest of mobile content same as previous ... */}
      </div>

      {/* DESKTOP UI */}
      <div className="hidden lg:flex flex-col h-full space-y-6">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <button onClick={() => setViewMode('landing')} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-gray-50 text-gray-500 border border-gray-100 transition-all"><ArrowLeft /></button>
               <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100"><FileSignature size={28} /></div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">میز کار نسخه نویسی</h2>
                    <p className="text-xs text-gray-400 font-bold">بیمار: <span className="text-indigo-600">{selectedPatient?.name}</span></p>
                  </div>
               </div>
            </div>
            <div className="flex gap-3">
               <button onClick={isRecordingScribe ? stopScribeRecording : startScribeRecording} disabled={isProcessingScribe} className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg transition-all active:scale-95 ${isRecordingScribe ? 'bg-purple-600 text-white animate-scribe-pulse' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'}`}><Mic size={18} /> {isRecordingScribe ? 'در حال شنیدن...' : 'دستیار صوتی'}</button>
               <button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="px-8 py-3 rounded-2xl font-black text-sm text-white bg-indigo-600 shadow-xl shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-3 transition-all active:scale-95"><Printer size={20} /> چاپ و تایید نهایی</button>
            </div>
         </div>

         <div className="grid grid-cols-12 gap-6 flex-1">
            {/* Editor Sidebar */}
            <div className="col-span-3 space-y-4">
               <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                  <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2"><LayoutTemplate size={14}/> قالب‌های تجویز</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                     {templates.map(t => (<div key={t.id} onClick={() => loadTemplate(t)} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl group hover:bg-indigo-600 cursor-pointer transition-all border border-transparent hover:border-indigo-400"><span className="text-xs font-black text-gray-700 group-hover:text-white">{t.name}</span><ChevronRight size={14} className="text-gray-300 group-hover:text-white" /></div>))}
                  </div>
               </div>
               
               <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100/50">
                  <h4 className="font-black text-blue-600 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2"><History size={14}/> سوابق علائم حیاتی</h4>
                  <div className="space-y-2">
                     {[ { l: 'BP', v: previousVitals?.bloodPressure, c: 'text-red-600' }, { l: 'HR', v: previousVitals?.heartRate, c: 'text-rose-600' }, { l: 'Temp', v: previousVitals?.temperature, c: 'text-orange-600' } ].map(iv => iv.v ? (<div key={iv.l} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-blue-50 shadow-sm"><span className="text-[10px] font-black text-gray-400">{iv.l}</span><span className={`text-xs font-black ${iv.c}`}>{iv.v}</span></div>) : null)}
                  </div>
               </div>
            </div>

            {/* Editor Main */}
            <div className="col-span-9 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col">
               <div className={`p-6 rounded-3xl border mb-6 transition-all duration-500 ${isRecordingScribe ? 'bg-purple-50/50 scribe-glow' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">تشخیص پزشک و علائم حیاتی</span>
                     {isRecordingScribe && <div className="flex gap-1 items-end h-4">{[...Array(10)].map((_, i) => <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>)}</div>}
                  </div>
                  <div className="grid grid-cols-6 gap-3 mb-4">
                     {[{l:'BP',k:'bloodPressure'},{l:'HR',k:'heartRate'},{l:'T',k:'temperature'},{l:'RR',k:'respiratoryRate'},{l:'Glu',k:'bloodSugar'},{l:'Wt',k:'weight'}].map(f=>(
                        <div key={f.k} className="bg-white p-2 rounded-xl border border-gray-100 shadow-inner"><input className="w-full text-center font-black text-xs outline-none bg-transparent" placeholder={f.l} value={(vitals as any)[f.k]} onChange={e => handleVitalChange(f.k, e.target.value)} /></div>
                     ))}
                  </div>
                  <textarea className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-700 resize-none h-24 outline-none focus:ring-4 focus:ring-indigo-50 shadow-inner" placeholder="تشخیص نهایی متخصص..." value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
               </div>

               <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar px-2">
                  {items.map((item, idx) => (
                     <div key={idx} className="flex gap-4 items-end bg-white border border-gray-100 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all group">
                        <div className="flex-1 space-y-1">
                           <label className="text-[9px] font-black text-gray-400 uppercase mr-1">Drug Name</label>
                           <input className="w-full p-2.5 bg-gray-50 border border-gray-50 rounded-xl text-sm font-black text-gray-800 focus:bg-white focus:border-indigo-500 outline-none" value={item.drug} onChange={e => updateItem(idx, 'drug', e.target.value)} placeholder="---" />
                        </div>
                        <div className="w-32 space-y-1">
                           <label className="text-[9px] font-black text-gray-400 uppercase mr-1">Qty</label>
                           <input className="w-full p-2.5 bg-gray-50 border border-gray-50 rounded-xl text-sm font-black text-center text-gray-600 font-mono focus:bg-white focus:border-indigo-500 outline-none" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} placeholder="N=--" />
                        </div>
                        <div className="flex-[1.5] space-y-1">
                           <label className="text-[9px] font-black text-gray-400 uppercase mr-1">Instruction</label>
                           <input className="w-full p-2.5 bg-gray-50 border border-gray-50 rounded-xl text-sm font-bold text-gray-600 focus:bg-white focus:border-indigo-500 outline-none text-right" value={item.instruction} onChange={e => updateItem(idx, 'instruction', e.target.value)} placeholder="Sig..." />
                        </div>
                        <button onClick={() => removeItem(idx)} className="p-3 text-gray-300 hover:text-red-500 bg-gray-50 rounded-xl mb-0.5"><Trash size={18}/></button>
                     </div>
                  ))}
                  <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-gray-100 rounded-[2rem] text-gray-400 font-black flex items-center justify-center gap-3 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-[0.98]"><Plus size={24} /> افزودن قلم داروی جدید</button>
               </div>
            </div>
         </div>
      </div>

      {/* --- PREMIUM PRINT PREVIEW MODAL --- */}
      {showPrintModal && (
         <div className="fixed inset-0 z-[200] bg-gray-900/80 backdrop-blur-xl flex flex-col lg:flex-row animate-fade-in overflow-hidden">
            {/* Control Sidebar */}
            <div className="w-full lg:w-96 bg-white shadow-2xl p-8 flex flex-col z-50">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3"><Printer className="text-indigo-600" /> پیش‌نمایش چاپ</h3>
                  <button onClick={() => setShowPrintModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"><X /></button>
               </div>

               <div className="space-y-6 flex-1">
                  <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">حالت نسخه</label>
                     <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-2xl">
                        <button 
                           onClick={() => setPrintMode('plain')} 
                           className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${printMode === 'plain' ? 'bg-white shadow-lg text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                           <Smartphone size={20} />
                           <span className="text-xs font-black">نسخه دیجیتال</span>
                        </button>
                        <button 
                           onClick={() => setPrintMode('custom')} 
                           disabled={!settings.backgroundImage}
                           className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${printMode === 'custom' ? 'bg-white shadow-lg text-indigo-600' : 'text-gray-400 hover:bg-gray-50 disabled:opacity-30'}`}
                        >
                           <ImageIcon size={20} />
                           <span className="text-xs font-black">روی سربرگ مطب</span>
                        </button>
                     </div>
                  </div>

                  <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                     <h4 className="font-black text-indigo-800 text-sm mb-2 flex items-center gap-2"><Info size={18} /> راهنمای چاپ</h4>
                     <p className="text-[11px] text-indigo-900/70 font-medium leading-relaxed">
                        دکتر عزیز، آنچه در کادر مقابل مشاهده می‌کنید دقیقاً با نسبت ابعاد کاغذ A4 تنظیم شده است (WYSIWYG). جهت بهترین نتیجه، در تنظیمات پرینتر مرورگر، گزینه <span className="font-black">Margins</span> را روی <span className="font-black">None</span> قرار دهید.
                     </p>
                  </div>
               </div>

               <button 
                  onClick={handlePrint} 
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 text-lg hover:bg-indigo-700 transition-all active:scale-95 mt-8"
               >
                  <Printer size={24} /> تایید و ارسال به چاپگر
               </button>
            </div>

            {/* Virtual Paper Preview Area */}
            <div ref={previewContainerRef} className="flex-1 bg-gray-950/40 p-6 flex items-center justify-center relative overflow-hidden">
               {/* Fixed Aspect Ratio Container */}
               <div 
                  className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.3)] origin-center transition-all duration-300"
                  style={{ 
                     width: `${A4_WIDTH}px`, 
                     height: `${A4_HEIGHT}px`,
                     transform: `scale(${previewScale})`,
                     flexShrink: 0
                  }}
               >
                  <div className="w-full h-full pointer-events-none select-none">
                     {printMode === 'plain' ? (
                        <div dangerouslySetInnerHTML={{ __html: generateDigitalPrescriptionHtml() }} className="h-full" />
                     ) : (
                        <div dangerouslySetInnerHTML={{ __html: generateCustomPrescriptionHtml() }} className="h-full" />
                     )}
                  </div>
               </div>

               {/* Scale Badge */}
               <div className="absolute bottom-6 right-6 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white/40 text-[10px] font-mono">
                  SCALE: ${Math.round(previewScale * 100)}% | A4 VIRTUAL PAPER
               </div>
            </div>
         </div>
      )}

      {/* Safety and Form Modals (Unchanged logic) */}
      {showNewPatientModal && (
            <div className="fixed inset-0 z-[100] lg:bg-black/60 lg:backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
               <div className="bg-white w-full lg:max-w-lg h-[100dvh] lg:h-auto lg:rounded-3xl shadow-2xl relative animate-slide-up lg:animate-fade-in flex flex-col">
                  <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 lg:rounded-t-3xl"><h3 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2"><div className="bg-teal-100 p-2 rounded-xl text-teal-600"><UserPlus size={24} /></div>ثبت بیمار جدید</h3><button onClick={() => setShowNewPatientModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors"><X size={20} /></button></div>
                  <div className="flex-1 overflow-y-auto p-5 lg:p-8 space-y-5">
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">نام و نام خانوادگی</label><div className="relative"><User className="absolute right-3 top-3.5 text-gray-400" size={18} /><input autoFocus className="w-full p-3.5 pr-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-gray-100" placeholder="مثال: علی رضایی" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} /></div></div>
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">شماره تماس</label><div className="relative"><input type="tel" className="w-full p-3.5 pl-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-left border border-gray-100 font-mono" placeholder="0912..." value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)} dir="ltr" /><Phone className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
                     <div className="flex gap-4"><div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-2">سن</label><input type="number" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-center border border-gray-100" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} placeholder="سال" /></div><div className="flex-[1.5]"><label className="block text-sm font-bold text-gray-600 mb-2">جنسیت</label><div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100"><button onClick={() => setNewPatientGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'male' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>آقا</button><button onClick={() => setNewPatientGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'female' ? 'bg-white shadow text-pink-600' : 'text-gray-400'}`}>خانم</button></div></div></div>
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">وزن (کیلوگرم)</label><div className="relative"><input type="number" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-center border border-gray-100" placeholder="kg" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} /><Scale className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
                     <div className="pt-2"><label className="flex items-center gap-2 text-sm font-bold text-orange-600 mb-2"><Activity size={16} />سابقه بیماری</label><input className="w-full p-3.5 bg-orange-50/30 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-200" placeholder="دیابت، فشار خون و..." value={newPatientHistory} onChange={e => setNewPatientHistory(e.target.value)} /></div>
                     <div><label className="flex items-center gap-2 text-sm font-bold text-red-600 mb-2"><AlertCircle size={16} />حساسیت‌ها و آلرژی</label><input className="w-full p-3.5 bg-red-50/30 border border-red-100 rounded-xl outline-none focus:ring-2 focus:ring-red-200" placeholder="پنی‌سیلین، آسپرین..." value={newPatientAllergies} onChange={e => setNewPatientAllergies(e.target.value)} /></div>
                  </div>
                  <div className="p-4 lg:p-6 border-t border-gray-100 bg-white lg:rounded-b-3xl"><button onClick={handleRegisterPatient} disabled={!newPatientName} className="w-full bg-gradient-to-r from-teal-600 to-teal-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-teal-200 flex items-center justify-center gap-3 text-lg"><Save size={22} />ذخیره پرونده اولیه</button></div>
               </div>
            </div>
         )}
      {showQuickEntryModal && (
            <div className="fixed inset-0 z-[100] bg-white/10 backdrop-blur-xl flex items-center justify-center p-4">
               <div className="bg-white/80 backdrop-blur-md w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/50 p-8 lg:p-10 animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><User size={120} /></div>
                  <div className="flex justify-between items-center mb-8 relative z-10">
                     <div>
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                           <Zap className="text-teal-600" /> نسخه سریع
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1">نشست موقت - بدون ثبت در بایگانی</p>
                     </div>
                     <button onClick={() => { setShowQuickEntryModal(false); clearFormStates(); }} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
                  </div>
                  <div className="space-y-5 relative z-10">
                     <div className="space-y-1">
                        <label className="text-xs font-black text-teal-600 mr-1">نام بیمار (اختیاری)</label>
                        <input autoFocus className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold shadow-sm" placeholder="---" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-xs font-black text-teal-600 mr-1">سن</label>
                           <input type="number" className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold text-center" placeholder="-" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-black text-teal-600 mr-1">وزن (kg)</label>
                           <input type="number" className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold text-center" placeholder="-" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-black text-teal-600 mr-1">جنسیت</label>
                        <div className="flex bg-gray-100/50 p-1.5 rounded-2xl">
                           <button onClick={() => setNewPatientGender('male')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newPatientGender === 'male' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}>آقا</button>
                           <button onClick={() => setNewPatientGender('female')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newPatientGender === 'female' ? 'bg-white shadow-md text-pink-600' : 'text-gray-400'}`}>خانم</button>
                        </div>
                     </div>
                     <button onClick={handleQuickEntry} className="w-full bg-teal-600 text-white py-5 rounded-[1.5rem] font-black shadow-xl shadow-teal-200 mt-4 flex items-center justify-center gap-3 text-lg hover:bg-teal-700 transition-all active:scale-95">
                        <FileSignature size={24} /> شروع نسخه‌نویسی
                     </button>
                  </div>
               </div>
            </div>
         )}
         {showSaveModal && (<div className="fixed inset-0 bg-black/50 z-[160] backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-fade-in"><h3 className="font-black text-xl text-gray-800 mb-6 flex items-center gap-2"><LayoutTemplate className="text-indigo-600" />ذخیره به عنوان قالب</h3><input autoFocus className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-6 outline-none focus:ring-4 focus:ring-indigo-100 font-bold" placeholder="نام قالب (مثال: سرماخوردگی)" value={templateName} onChange={e => setTemplateName(e.target.value)} /><div className="flex justify-end gap-3"><button onClick={() => setShowSaveModal(false)} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-800 transition-colors">لغو</button><button onClick={handleSaveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100">ذخیره نسخه</button></div></div></div>)}
         {showSafetyModal && safetyReport && (
         <div className="fixed inset-0 z-[280] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
               <div className={`p-8 text-white flex items-center justify-between ${safetyReport.status === 'critical' ? 'bg-red-600' : safetyReport.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                  <div className="flex items-center gap-4">
                     <div className="bg-white/20 p-3 rounded-2xl"><ShieldAlert size={32} /></div>
                     <div>
                        <h3 className="text-2xl font-black">گزارش واکاوی ایمنی نسخه</h3>
                        <p className="text-white/80 text-sm font-bold mt-1">واحد فارماکولوژی طبیب هوشمند</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSafetyModal(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><X /></button>
               </div>
               <div className="p-8 overflow-y-auto space-y-6">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 italic text-gray-600 text-lg leading-relaxed shadow-inner">
                     "{safetyReport.summary}"
                  </div>
                  
                  {safetyReport.alerts && safetyReport.alerts.length > 0 ? (
                     <div className="space-y-4">
                        <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest border-b pb-2">تداخلات و هشدارهای شناسایی شده</h4>
                        {safetyReport.alerts.map((alert: any, i: number) => (
                           <div key={i} className={`p-5 rounded-3xl border flex gap-4 items-start ${alert.severity === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                              <div className={`p-2 rounded-xl shrink-0 ${alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                 {alert.severity === 'critical' ? <AlertCircle size={20} /> : <Info size={20} />}
                              </div>
                              <div className="space-y-1">
                                 <h5 className={`font-black ${alert.severity === 'critical' ? 'text-red-800' : 'text-amber-800'}`}>{alert.title}</h5>
                                 <p className="text-sm text-gray-700 leading-relaxed font-medium">{alert.description}</p>
                                 {alert.alternative && (
                                    <div className="mt-3 pt-3 border-t border-white/50">
                                       <span className="text-[10px] font-black uppercase text-indigo-500 block mb-1">پیشنهاد جایگزین / اصلاح:</span>
                                       <p className="text-sm font-black text-indigo-900">{alert.alternative}</p>
                                    </div>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="py-12 text-center space-y-4">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg"><CheckCircle size={40} /></div>
                        <h4 className="text-xl font-black text-emerald-800">نسخه فاقد تداخل بحرانی</h4>
                        <p className="text-gray-500 max-w-xs mx-auto font-bold">هیچ تداخل دارویی یا منعی برای این بیمار شناسایی نشد.</p>
                     </div>
                  )}
               </div>
               <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-center">
                  <button onClick={() => setShowSafetyModal(false)} className="px-12 py-3 bg-gray-800 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all">تایید و بازگشت</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Prescription;
