
import React, { useState, useEffect, useRef } from 'react';
import { digitizePrescription, checkPrescriptionSafety, processScribeAudio, transcribeMedicalAudio } from '../services/geminiService';
import { saveTemplate, getAllTemplates, deleteTemplate, getSettings, saveRecord, getDoctorProfile, getUniquePatients, getAllDrugs, trackDrugUsage, getUsageStats } from '../services/db';
import { PrescriptionItem, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, PatientVitals, PatientRecord, Drug, DrugUsage, PrescriptionRecord } from '../types';
import { FileSignature, ScanLine, Printer, Save, Trash, Plus, CheckCircle, Search, LayoutTemplate, Activity, UserPlus, Stethoscope, ArrowLeft, X, Phone, Scale, AlertCircle, WifiOff, Camera, Image as ImageIcon, Heart, Thermometer, Wind, Droplet, Hash, FileText, ChevronRight, Loader2, Sparkles, User, RotateCw, History, RefreshCw, Zap, TrendingUp, Pill, Beaker, SprayCan, Brain, ZapOff, ShieldAlert, ShieldCheck, Info, Mic, MicOff, List, Monitor, ListChecks } from 'lucide-react';

interface PrescriptionProps {
  initialRecord: PatientRecord | null;
}

// --- MOBILE SUB-COMPONENT ---
const MobileVitalInput = ({ label, icon: Icon, value, prevValue, unit, field, color, onChange }: any) => (
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
        placeholder="" 
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

// --- DESKTOP PROFESSIONAL VITAL INPUT - COMPACT VERSION ---
const DesktopVitalSidebarItem = ({ label, icon: Icon, value, unit, field, color, onChange }: any) => (
  <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 transition-all flex flex-col items-center gap-0">
    <div className="flex items-center justify-between w-full mb-0.5 px-1">
      <Icon size={12} className={color} />
      {unit && <span className="text-[7px] font-black text-gray-300 uppercase">{unit}</span>}
    </div>
    <input 
      className="w-full text-center text-base font-black text-gray-800 outline-none bg-transparent placeholder:text-gray-100"
      placeholder=""
      value={value}
      onChange={e => onChange(field, e.target.value)}
    />
    <div className={`text-[9px] font-black uppercase tracking-tighter ${color} opacity-90`}>
      {label}
    </div>
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
  const [chiefComplaint, setChiefComplaint] = useState('');
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

  const [templateName, setTemplateName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showQuickEntryModal, setShowQuickEntryModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // AI Safety State
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyReport, setSafetyReport] = useState<any | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // --- AI SCRIBE STATE ---
  const [isRecordingScribe, setIsRecordingScribe] = useState(false);
  const [isProcessingScribe, setIsProcessingScribe] = useState(false);
  const scribeMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scribeChunksRef = useRef<Blob[]>([]);

  // --- AUDIO DICTATION STATE FOR CC ---
  const [isRecordingCC, setIsRecordingCC] = useState(false);
  const [isProcessingCC, setIsProcessingCC] = useState(false);
  const ccMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ccChunksRef = useRef<Blob[]>([]);

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

  useEffect(() => {
    if (initialRecord) {
        handleSelectPatient(initialRecord);
    }
  }, [initialRecord]);

  useEffect(() => {
    if (!selectedPatient || viewMode !== 'editor' || isExpressMode) return;
    const draft = { items, diagnosis, chiefComplaint, vitals, timestamp: Date.now() };
    localStorage.setItem(`tabib_draft_${selectedPatient.id}`, JSON.stringify(draft));
  }, [items, diagnosis, chiefComplaint, vitals, selectedPatient, viewMode, isExpressMode]);

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
    setChiefComplaint('');

    if (!patient.id.startsWith('guest_')) {
      const savedDraft = localStorage.getItem(`tabib_draft_${patient.id}`);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.items.length > 0 || parsed.diagnosis || parsed.chiefComplaint || parsed.vitals.bloodPressure) {
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
      setChiefComplaint(activeDraft.chiefComplaint || '');
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

  const saveToPatientRecord = async () => {
    if (!selectedPatient || isExpressMode) return;

    const newPrescription: PrescriptionRecord = {
      id: crypto.randomUUID(),
      date: Date.now(),
      items: items.filter(it => it.drug.trim() !== ''),
      manualDiagnosis: diagnosis,
      manualVitals: vitals,
      manualChiefComplaint: chiefComplaint
    };

    const updatedRecord: PatientRecord = {
      ...selectedPatient,
      status: 'completed',
      prescriptions: [...(selectedPatient.prescriptions || []), newPrescription],
      vitals: vitals,
    };

    try {
      await saveRecord(updatedRecord);
      setSelectedPatient(updatedRecord);
      localStorage.removeItem(`tabib_draft_${selectedPatient.id}`);
    } catch (e) {
      console.error("Failed to auto-save patient record:", e);
    }
  };

  const startCCRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      ccMediaRecorderRef.current = mediaRecorder;
      ccChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) ccChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(ccChunksRef.current, { type: 'audio/webm' });
        setIsProcessingCC(true);
        try {
          const text = await transcribeMedicalAudio(audioBlob);
          setChiefComplaint(prev => prev + (prev ? " " : "") + text);
        } catch (error) { alert("خطا در تبدیل صدا"); } finally {
          setIsProcessingCC(false); setIsRecordingCC(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorder.start();
      setIsRecordingCC(true);
    } catch (err) { alert("دسترسی به میکروفون ندارید."); }
  };

  const stopCCRecording = () => {
    if (ccMediaRecorderRef.current && ccMediaRecorderRef.current.state === 'recording') {
      ccMediaRecorderRef.current.stop();
    }
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
    setShowTemplatesModal(false);
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

  const handlePrint = async (mode: 'plain' | 'custom') => {
     if (!isExpressMode) await saveToPatientRecord();
     items.forEach(item => { if (item.drug) trackDrugUsage(item.drug, item.dosage, item.instruction); });
     
     const iframeId = 'tabib-print-frame';
     let frame = document.getElementById(iframeId) as HTMLIFrameElement;
     if (frame) document.body.removeChild(frame);
     
     frame = document.createElement('iframe');
     frame.id = iframeId;
     frame.style.position = 'fixed';
     frame.style.visibility = 'hidden';
     document.body.appendChild(frame);

     const win = frame.contentWindow;
     if (!win) return;

     const fontFamily = settings?.fontFamily || 'Vazirmatn';
     const isA4 = settings?.paperSize === 'A4';
     const paperWidth = isA4 ? '210mm' : '148mm';
     const paperHeight = isA4 ? '297mm' : '210mm';

     let style = `
       @page { margin: 0 !important; size: ${settings?.paperSize || 'A4'} portrait; }
       html, body { 
         margin: 0 !important; 
         padding: 0 !important; 
         width: ${paperWidth}; 
         height: ${paperHeight}; 
         overflow: hidden;
         -webkit-print-color-adjust: exact !important;
         print-color-adjust: exact !important;
       }
       body { font-family: '${fontFamily}', 'Vazirmatn', sans-serif; direction: rtl; }
       
       .full-page-canvas {
         position: fixed;
         top: 0;
         left: 0;
         width: ${paperWidth};
         height: ${paperHeight};
         margin: 0 !important;
         padding: 0 !important;
         z-index: 9999;
         overflow: hidden;
       }

       .bg-image { 
         position: absolute; 
         top: 0; 
         left: 0; 
         width: 100%; 
         height: 100%; 
         object-fit: fill; 
         z-index: -1; 
       }

       .print-element { 
         position: absolute; 
         white-space: normal; 
         word-wrap: break-word; 
         line-height: 1.4; 
       }

       .majestic-container { 
         position: relative; 
         width: 100%; 
         height: 100%; 
         border: 4px double #1e3a8a; 
         padding: 12mm; 
         box-sizing: border-box; 
       }
       .rx-watermark { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); font-size: 350pt; opacity: 0.04; color: #1e3a8a; z-index: -1; font-family: 'Times New Roman', serif; font-weight: bold; pointer-events: none; }
       .header-pro { display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 5mm; margin-bottom: 6mm; }
       .dr-name { font-size: 22pt; font-weight: 900; color: #1e3a8a; margin: 0; }
       .dr-spec { font-size: 13pt; font-weight: 700; margin-top: 2mm; color: #475569; }
       .council-box { border: 1px solid #1e3a8a; padding: 2mm 4mm; border-radius: 4px; font-size: 10pt; font-weight: 800; display: inline-block; margin-top: 3mm; }
       .patient-summary { display: flex; justify-content: space-between; background: #f8fafc; padding: 4mm; border-radius: 8px; margin-bottom: 6mm; font-size: 11pt; font-weight: 700; border: 1px solid #e2e8f0; }
       .vitals-matrix { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #cbd5e1; margin-bottom: 6mm; background: #fff; }
       .vital-cell { border: 0.5px solid #cbd5e1; padding: 2mm; text-align: center; }
       .vital-label { font-size: 8pt; font-weight: 900; color: #64748b; display: block; margin-bottom: 1mm; text-transform: uppercase; }
       .vital-value { font-size: 11pt; font-weight: 900; color: #1e3a8a; }
       .clinical-section { margin-bottom: 5mm; }
       .section-title { font-size: 10pt; font-weight: 900; color: #1e3a8a; border-right: 4px solid #1e3a8a; padding-right: 3mm; margin-bottom: 2mm; text-transform: uppercase; }
       .clinical-content { font-size: 12pt; line-height: 1.6; color: #334155; padding: 2mm 4mm; background: #fdfdfd; border-radius: 4px; }
       .rx-symbol { font-size: 32pt; font-weight: bold; font-family: 'Times New Roman', serif; color: #1e3a8a; margin: 5mm 0 2mm 0; border-bottom: 1px solid #e2e8f0; }
       .drug-list { list-style: none; padding: 0; margin: 0; direction: ltr; }
       .drug-item { display: flex; align-items: flex-start; margin-bottom: 5mm; font-family: 'Georgia', 'Times New Roman', serif; }
       .drug-num { font-weight: 900; width: 30px; color: #1e3a8a; font-size: 14pt; }
       .drug-details { flex: 1; }
       .drug-name { font-size: 15pt; font-weight: 900; text-transform: capitalize; color: #0f172a; margin-bottom: 1mm; }
       .drug-sig { font-size: 12pt; color: #334155; font-style: italic; font-weight: 500; }
       .drug-qty { font-weight: 900; color: #1e3a8a; margin-left: 10px; font-size: 13pt; }
       .footer-pro { margin-top: auto; padding-top: 10mm; display: flex; justify-content: space-between; align-items: flex-end; }
       .signature-area { text-align: center; border-top: 1px solid #1e3a8a; padding-top: 2mm; width: 50mm; }
       .footer-motto { font-size: 8pt; font-style: italic; color: #94a3b8; text-align: center; width: 100%; border-top: 1px solid #f1f5f9; padding-top: 4mm; margin-top: 8mm; }
     `;

     let htmlBody = '';
     if (mode === 'plain') {
        htmlBody = `
          <div class="full-page-canvas">
            <div class="majestic-container">
               <div class="rx-watermark">℞</div>
               <div class="header-pro">
                  <div class="doc-info">
                     <h1 class="dr-name">${doctorProfile?.name || 'دکتر متخصص'}</h1>
                     <div class="dr-spec">${doctorProfile?.specialty || ''}</div>
                     <div class="council-box">نظام پزشکی: ${doctorProfile?.medicalCouncilNumber || '---'}</div>
                  </div>
                  ${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 90px; object-fit: contain;" />` : ''}
               </div>
               
               <div class="patient-summary">
                  <div><span>بیمار:</span> ${selectedPatient?.name}</div>
                  <div><span>ID:</span> ${selectedPatient?.displayId}</div>
                  <div><span>سن:</span> ${selectedPatient?.age || '--'}</div>
                  <div><span>تاریخ:</span> ${new Date().toLocaleDateString('fa-IR')}</div>
               </div>

               <div class="vitals-matrix">
                  <div class="vital-cell"><span class="vital-label">BP</span><span class="vital-value">${vitals.bloodPressure || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">HR</span><span class="vital-value">${vitals.heartRate || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">TEMP</span><span class="vital-value">${vitals.temperature || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">RR</span><span class="vital-value">${vitals.respiratoryRate || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">SPO2</span><span class="vital-value">${vitals.spO2 || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">BS</span><span class="vital-value">${vitals.bloodSugar || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">WT</span><span class="vital-value">${vitals.weight || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">HT</span><span class="vital-value">${vitals.height || '--'}</span></div>
               </div>

               ${chiefComplaint ? `
               <div class="clinical-section">
                  <div class="section-title">Clinical Findings (CC)</div>
                  <div class="clinical-content">${chiefComplaint}</div>
               </div>` : ''}

               ${diagnosis ? `
               <div class="clinical-section">
                  <div class="section-title">Impression / Diagnosis</div>
                  <div class="clinical-content" style="font-weight:bold; color:#1e3a8a;">${diagnosis}</div>
               </div>` : ''}

               <div class="rx-symbol">℞</div>
               
               <ul class="drug-list">
                  ${items.map((item, i) => `
                  <li class="drug-item">
                     <div class="drug-num">${i + 1}.</div>
                     <div class="drug-details">
                        <div class="drug-name">${item.drug}</div>
                        <div class="drug-sig">Sig: ${item.instruction}</div>
                     </div>
                     <div class="drug-qty">${item.dosage}</div>
                  </li>`).join('')}
               </ul>

               <div class="footer-pro">
                  <div style="font-size:9pt; color:#64748b;">
                     <div>${doctorProfile?.address || ''}</div>
                     <div style="margin-top:1mm;">تلفن: ${doctorProfile?.phone || ''}</div>
                  </div>
                  <div class="signature-area">Signature & Stamp</div>
               </div>
               <div class="footer-motto">"The art of medicine consists of amusing the patient while nature cures the disease."</div>
            </div>
          </div>
        `;
     } else {
        let bgHtml = (settings.printBackground && settings.backgroundImage) ? `<img id="bgImg" src="${settings.backgroundImage}" class="bg-image" />` : '';
        const elementsHtml = (settings.elements || []).filter(el => el.visible).map(el => {
           let innerHtml = '';
           switch (el.id) {
              case 'patientName': innerHtml = selectedPatient?.name || ''; break;
              case 'patientId': innerHtml = selectedPatient?.displayId || ''; break;
              case 'age': innerHtml = selectedPatient?.age || ''; break;
              case 'date': innerHtml = new Date().toLocaleDateString('fa-IR'); break;
              case 'diagnosis': innerHtml = diagnosis; break;
              case 'chiefComplaint': innerHtml = chiefComplaint; break;
              case 'vital_bp': innerHtml = vitals.bloodPressure || ''; break;
              case 'vital_hr': innerHtml = vitals.heartRate || ''; break;
              case 'vital_rr': innerHtml = vitals.respiratoryRate || ''; break;
              case 'vital_temp': innerHtml = vitals.temperature || ''; break;
              case 'vital_weight': innerHtml = vitals.weight || ''; break;
              case 'vital_o2': innerHtml = vitals.spO2 || ''; break;
              case 'vital_bs': innerHtml = vitals.bloodSugar || ''; break;
              case 'items': innerHtml = `<ul style="list-style:none; padding:0; margin:0; direction: ltr; text-align: left; font-family: serif;">${items.map((item, i) => `<li style="margin-bottom:8px; font-size:1.1em;"><span style="font-weight:900; color:#1e3a8a;">${i+1}. ${item.drug}</span> <span style="margin:0 10px; font-weight:800;">(${item.dosage})</span><div style="font-size:0.9em; color:#444; font-style:italic;">Sig: ${item.instruction}</div></li>`).join('')}</ul>`; break;
              default: innerHtml = '';
           }
           if (!innerHtml) return '';
           return `<div class="print-element" style="left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; font-size: ${el.fontSize}pt; transform: rotate(${el.rotation}deg); text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')};">${innerHtml}</div>`;
        }).join('');
        htmlBody = `<div class="full-page-canvas">${bgHtml}${elementsHtml}</div>`;
     }

     win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>Prescription</title><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet"><style>${style}</style></head><body>${htmlBody}</body></html>`);
     win.document.close();

     const bgImg = win.document.getElementById('bgImg') as HTMLImageElement;
     const triggerPrint = () => {
        setTimeout(() => {
          win.focus();
          win.print();
          if (isExpressMode) setViewMode('landing');
        }, 500);
     };

     if (bgImg && !bgImg.complete) {
        bgImg.onload = triggerPrint;
        bgImg.onerror = triggerPrint;
     } else {
        triggerPrint();
     }
  };

  const handleAutoPrint = () => {
    if (items.length === 0) return;
    const mode = settings.backgroundImage ? 'custom' : 'plain';
    handlePrint(mode);
  };

  const printButtonLabel = settings.backgroundImage ? 'چاپ روی سربرگ مطب' : 'چاپ نسخه دیجیتال (Majestic)';

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

         {showNewPatientModal && (
            <div className="fixed inset-0 z-[100] lg:bg-black/60 lg:backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
               <div className="bg-white w-full lg:max-w-lg h-[100dvh] lg:h-auto lg:rounded-3xl shadow-2xl relative animate-slide-up lg:animate-fade-in flex flex-col">
                  <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 lg:rounded-t-3xl"><h3 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2"><div className="bg-teal-100 p-2 rounded-xl text-teal-600"><UserPlus size={24} /></div>ثبت بیمار جدید</h3><button onClick={() => setShowNewPatientModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors"><X size={20} /></button></div>
                  <div className="flex-1 overflow-y-auto p-5 lg:p-8 space-y-5">
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">نام و نام خانوادگی</label><div className="relative"><User className="absolute right-3 top-3.5 text-gray-400" size={18} /><input autoFocus className="w-full p-3.5 pr-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-gray-100" placeholder="مثال: علی رضایی" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} /></div></div>
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">شماره تماس</label><div className="relative"><input type="tel" className="w-full p-3.5 pl-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-left border border-gray-100 font-mono" placeholder="0912..." value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)} dir="ltr" /><Phone className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
                     <div className="flex gap-4"><div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-2">سن</label><input type="text" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-center border border-gray-100 font-bold" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} placeholder="" /></div><div className="flex-[1.5]"><label className="block text-sm font-bold text-gray-600 mb-2">جنسیت</label><div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100"><button onClick={() => setNewPatientGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'male' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>آقا</button><button onClick={() => setNewPatientGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'female' ? 'bg-white shadow text-pink-600' : 'text-gray-400'}`}>خانم</button></div></div></div>
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">وزن</label><div className="relative"><input type="text" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-center border border-gray-100 font-bold" placeholder="" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} /><Scale className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
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
                        <input autoFocus className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold shadow-sm" placeholder="" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-xs font-black text-teal-600 mr-1">سن</label>
                           <input type="text" className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold text-center" placeholder="" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-black text-teal-600 mr-1">وزن</label>
                           <input type="text" className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold text-center" placeholder="" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} />
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
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 lg:pb-20 relative">
      {/* (Rest of Prescription component remains same until handlePrint calls) */}
      {/* ... (Unchanged UI logic) ... */}
    </div>
  );
};

export default Prescription;
