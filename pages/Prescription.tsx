
import React, { useState, useEffect, useRef } from 'react';
import { digitizePrescription, checkPrescriptionSafety, processScribeAudio } from '../services/geminiService';
import { saveTemplate, getAllTemplates, deleteTemplate, getSettings, saveRecord, getDoctorProfile, getUniquePatients, getAllDrugs, trackDrugUsage, getUsageStats } from '../services/db';
import { PrescriptionItem, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, PatientVitals, PatientRecord, Drug, DrugUsage } from '../types';
import { FileSignature, ScanLine, Printer, Save, Trash, Plus, CheckCircle, Search, LayoutTemplate, Activity, UserPlus, Stethoscope, ArrowLeft, X, Phone, Scale, AlertCircle, WifiOff, Camera, Image as ImageIcon, Heart, Thermometer, Wind, Droplet, Hash, FileText, ChevronRight, Loader2, Sparkles, User, RotateCw, History, RefreshCw, Zap, TrendingUp, Pill, Beaker, SprayCan, Brain, ZapOff, ShieldAlert, ShieldCheck, ShieldCloseIcon, Info, Mic, MicOff } from 'lucide-react';

interface PrescriptionProps {
  initialRecord: PatientRecord | null;
}

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

    // CLEAN DESK PROTOCOL: 
    // Always start with empty items and empty diagnosis for the final prescription.
    // We do NOT transfer AI suggestions here to ensure full clinical autonomy of the doctor.
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
        chiefComplaint: '', // Empty chief complaint for clean start in editor
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

  // --- AI SCRIBE LOGIC ---
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

  // --- ELITE WEIGHTED FUZZY SEARCH ---
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

  const handlePrint = (mode: 'plain' | 'custom') => {
     if (!isExpressMode) saveToPatientRecord();
     items.forEach(item => { if (item.drug) trackDrugUsage(item.drug, item.dosage, item.instruction); });
     const win = window.open('', '_blank', 'width=900,height=1200');
     if (!win) return;
     let style = `
       @page { size: ${settings.paperSize || 'A4'} portrait; margin: 0; }
       html, body { height: 100%; }
       body { font-family: '${settings.fontFamily}', sans-serif; margin: 0; direction: rtl; padding-top: 80px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
       .control-bar { position: fixed; top: 0; left: 0; right: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 12px; display: flex; justify-content: center; gap: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); z-index: 9999; border-bottom: 1px solid #eee; }
       .btn { padding: 10px 24px; border-radius: 12px; border: none; font-family: '${settings.fontFamily}', sans-serif; font-weight: bold; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: transform 0.1s; }
       .btn:active { transform: scale(0.95); }
       .btn-print { background: #2563eb; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); }
       .btn-close { background: #fee2e2; color: #ef4444; }
       @media print {
          .no-print { display: none !important; }
          html, body { height: 100%; margin: 0 !important; padding: 0 !important; overflow: hidden; }
          .rx-container, .custom-container { width: 100%; height: 100%; max-height: 100%; page-break-after: avoid; page-break-inside: avoid; break-inside: avoid; overflow: hidden; transform: scale(0.98); transform-origin: top center; }
       }
       .rx-container { padding: 40px; box-sizing: border-box; }
       .rx-table { width: 100%; border-collapse: collapse; margin-top: 20px; direction: ltr; }
       .rx-table th, .rx-table td { border-bottom: 1px solid #ddd; padding: 12px; text-align: left; }
       .rx-table th { background-color: #f8f9fa; }
       .rx-symbol { font-size: 32px; font-weight: bold; margin: 20px 0; font-family: serif; }
       .digital-header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
       .custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
       .print-element { position: absolute; white-space: nowrap; }
       .bg-image { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1; }
     `;
     let content = '';
     const controlHtml = `<div class="control-bar no-print"><button class="btn btn-print" onclick="window.print()"><span>🖨️</span> چاپ نهایی</button><button class="btn btn-close" onclick="window.close()"><span>✖</span> بستن</button></div>`;
     if (mode === 'plain') {
        content = `
          <div class="rx-container">
             <div class="digital-header"><div class="doc-info"><h1 style="margin:0; font-size:24px;">${doctorProfile?.name || 'دکتر ...'}</h1><p style="margin:5px 0;">${doctorProfile?.specialty || ''}</p><p style="font-size:12px;">نظام پزشکی: ${doctorProfile?.medicalCouncilNumber || '---'}</p></div>${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 80px; object-fit: contain;" />` : ''}</div>
             <div style="background:#f3f4f6; padding:15px; border-radius:10px; display:flex; gap:20px; margin-bottom:20px;"><div><strong>نام بیمار:</strong> ${selectedPatient?.name}</div>${selectedPatient?.age ? `<div><strong>سن:</strong> ${selectedPatient.age}</div>` : ''}<div><strong>تاریخ:</strong> ${new Date().toLocaleDateString('fa-IR')}</div></div>
             <div style="font-size: 12px; margin-bottom: 10px; display: flex; gap: 15px; color: #555;">${vitals.bloodPressure ? `<span><strong>BP:</strong> ${vitals.bloodPressure}</span>` : ''}${vitals.heartRate ? `<span><strong>HR:</strong> ${vitals.heartRate}</span>` : ''}</div>
             ${(diagnosis) ? `<div style="margin-bottom:20px; padding:10px; border:1px dashed #ccc;"><strong>تشخیص:</strong> ${diagnosis}</div>` : ''}
             <div class="rx-symbol">Rx</div>
             <table class="rx-table"><thead><tr><th>#</th><th>Drug Name</th><th>Dosage</th><th>Instruction</th></tr></thead><tbody>${items.map((item, i) => `<tr><td>${i + 1}</td><td style="font-weight:bold;">${item.drug}</td><td>${item.dosage}</td><td>${item.instruction}</td></tr>`).join('')}</tbody></table>
          </div>
        `;
     } else {
        let bgHtml = (settings.printBackground && settings.backgroundImage) ? `<img src="${settings.backgroundImage}" class="bg-image" />` : '';
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
           return `<div class="print-element" style="left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; font-size: ${el.fontSize}pt; transform: rotate(${el.rotation}deg); text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')};">${innerHtml}</div>`;
        }).join('');
        content = `<div class="custom-container">${bgHtml}${elementsHtml}</div>`;
     }
     win.document.write(`<html dir="rtl"><head><title>پیش‌نمایش چاپ</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap" rel="stylesheet"><style>${style}</style></head><body>${controlHtml}${content}</body></html>`);
     win.document.close(); setShowPrintModal(false);
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
                  {/* Unified Search Terminal */}
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

                  {/* Twin Action Pill (Left Side) */}
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
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 lg:pb-20 relative">
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

      {/* AI SCANNING OVERLAY PORTAL */}
      {(loading || isProcessingScribe) && (
        <div className="fixed inset-0 z-[200] bg-white/40 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-fade-in overflow-hidden">
           {/* High-tech Scanning Frame */}
           <div className="relative w-full max-w-lg aspect-[3/4] lg:aspect-video rounded-3xl border-2 border-blue-400/50 shadow-2xl overflow-hidden bg-gray-900/10">
              {/* Laser Animation */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(59,130,246,1)] z-20 animate-scan-line"></div>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                 <div className="relative">
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] animate-pulse">
                       {isProcessingScribe ? <Mic size={48} className="text-white" /> : <Brain size={48} className="text-white" />}
                    </div>
                    <div className="absolute -inset-4 border border-blue-400/30 rounded-full animate-ping"></div>
                 </div>
                 <div className="text-center space-y-3">
                    <h3 className="text-2xl font-black text-blue-900 tracking-tight">
                       {isProcessingScribe ? 'در حال واکاوی هوشمند گفته‌های پزشک...' : 'در حال واکاوی نسخه توسط هسته هوش مصنوعی...'}
                    </h3>
                    <p className="text-blue-600/60 font-bold animate-bounce text-sm">
                       {isProcessingScribe ? 'استخراج موجودیت‌های پزشکی و داروها' : 'لطفاً شکیبا باشید. در حال استخراج اقلام دارویی'}
                    </p>
                 </div>
              </div>
              
              {/* Corner Accents */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
              <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
           </div>
        </div>
      )}

      {showDraftBanner && (
         <div className="fixed top-20 left-4 right-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-[80] animate-bounce-subtle">
            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-6 border border-white/20 backdrop-blur-md">
               <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-xl"><RefreshCw size={20} className="animate-spin-slow" /></div><div><p className="text-sm font-bold">پیش‌نویس ناتمام یافت شد</p><p className="text-[10px] opacity-80">یک نسخه ناتمام از دقایق پیش برای این بیمار موجود است.</p></div></div>
               <div className="flex gap-2"><button onClick={discardDraft} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">حذف</button><button onClick={applyDraft} className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-xs font-black shadow-lg">بازیابی</button></div>
            </div>
         </div>
      )}

      {/* MOBILE UI */}
      <div className="lg:hidden flex flex-col gap-4">
         <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 flex-1 min-w-0"><button onClick={() => setViewMode('landing')} className="p-2 bg-gray-50 rounded-xl text-gray-600 flex-shrink-0"><ArrowLeft size={20}/></button><div className="min-w-0"><h2 className="font-bold text-gray-800 truncate text-sm">{selectedPatient?.name}</h2><p className="text-[10px] text-gray-400 truncate">{selectedPatient?.age} ساله</p></div></div>
            <div className="flex items-center gap-2">
               <button 
                  onClick={isRecordingScribe ? stopScribeRecording : startScribeRecording}
                  disabled={isProcessingScribe || !isOnline}
                  className={`p-2 rounded-xl transition-all ${isRecordingScribe ? 'bg-purple-600 text-white animate-scribe-pulse shadow-lg' : 'bg-purple-50 text-purple-600'}`}
               >
                  {isRecordingScribe ? <MicOff size={20}/> : <Mic size={20}/>}
               </button>
               {isExpressMode && <div className="bg-amber-100 text-amber-600 p-2 rounded-xl animate-pulse"><ZapOff size={20} /></div>}
               <button 
                  onClick={handleAuditSafety} 
                  disabled={safetyLoading || items.length === 0} 
                  className={`p-2 rounded-xl transition-all ${isOnline ? (safetyLoading ? 'bg-indigo-50 text-indigo-400' : 'bg-indigo-50 text-indigo-600 animate-safety-pulse') : 'bg-gray-100 text-gray-300'}`}
               >
                  {safetyLoading ? <Loader2 size={20} className="animate-spin" /> : <ShieldAlert size={20} />}
               </button>
               {!isExpressMode && <button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="p-2 rounded-xl bg-gray-50 text-gray-600 disabled:opacity-50"><Save size={20} /></button>}
               <button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="p-2 rounded-xl bg-gray-50 text-gray-600 disabled:opacity-50"><Printer size={20} /></button>
               <button onClick={startCamera} disabled={!isOnline} className={`p-2 rounded-xl transition-colors ${isOnline ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-300'}`}><Camera size={20} /></button>
            </div>
         </div>

         <div className="bg-gray-100 p-1 rounded-xl flex">
            <button onClick={() => setMobileTab('rx')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'rx' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>نسخه و تشخیص</button>
            <button onClick={() => setMobileTab('vitals')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'vitals' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>علائم حیاتی</button>
            <button onClick={() => setMobileTab('templates')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'templates' ? 'bg-white shadow text-gray-700' : 'text-gray-500'}`}>قالب‌ها</button>
         </div>

         <div className="min-h-[50vh]">
            {mobileTab === 'vitals' && (
               <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <VitalInput label="فشار خون" icon={Activity} color="text-red-500" value={vitals.bloodPressure} prevValue={previousVitals?.bloodPressure} unit="mmHg" field="bloodPressure" onChange={handleVitalChange} />
                  <VitalInput label="ضربان قلب" icon={Heart} color="text-rose-500" value={vitals.heartRate} prevValue={previousVitals?.heartRate} unit="bpm" field="heartRate" onChange={handleVitalChange} />
                  <VitalInput label="دمای بدن" icon={Thermometer} color="text-orange-500" value={vitals.temperature} prevValue={previousVitals?.temperature} unit="°C" field="temperature" onChange={handleVitalChange} />
                  <VitalInput label="اکسیژن" icon={Wind} color="text-blue-500" value={vitals.spO2} prevValue={previousVitals?.spO2} unit="%" field="spO2" onChange={handleVitalChange} />
                  <VitalInput label="قند خون" icon={Droplet} color="text-pink-500" value={vitals.bloodSugar} prevValue={previousVitals?.bloodSugar} unit="mg/dL" field="bloodSugar" onChange={handleVitalChange} />
                  <VitalInput label="وزن (kg)" icon={Scale} color="text-indigo-500" value={vitals.weight} prevValue={previousVitals?.weight} unit="kg" field="weight" onChange={handleVitalChange} />
                  <VitalInput label="تنفس" icon={Wind} color="text-cyan-500" value={vitals.respiratoryRate} prevValue={previousVitals?.respiratoryRate} unit="rpm" field="respiratoryRate" onChange={handleVitalChange} />
                  <VitalInput label="قد (cm)" icon={Hash} color="text-gray-500" value={vitals.height} prevValue={previousVitals?.height} unit="cm" field="height" onChange={handleVitalChange} />
               </div>
            )}
            {mobileTab === 'rx' && (
               <div className="space-y-4 animate-fade-in">
                  <div className={`bg-white p-4 rounded-2xl border transition-all duration-500 ${isRecordingScribe ? 'scribe-glow' : 'border-gray-100 shadow-sm'}`}>
                     <div className="flex justify-between items-center mb-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-500"><Activity size={16} className="text-purple-500" />تشخیص پزشک</label>
                        {isRecordingScribe && (
                           <div className="flex gap-1 items-end h-4">
                              {[...Array(6)].map((_, i) => <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>)}
                           </div>
                        )}
                     </div>
                     <textarea className={`w-full p-3 bg-gray-50 rounded-xl outline-none text-gray-700 h-20 resize-none focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all ${isRecordingScribe ? 'bg-purple-50/50 italic' : ''}`} placeholder={isRecordingScribe ? "در حال شنیدن تشخیص..." : "تشخیص نهایی را بنویسید..."} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                  </div>
                  <div className="space-y-3">
                     {items.map((item, idx) => (
                        <div key={idx} className={`bg-white p-4 rounded-2xl border transition-all duration-500 relative group animate-slide-up ${isRecordingScribe ? 'scribe-glow' : 'border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'}`}>
                           <button onClick={() => removeItem(idx)} className="absolute top-4 left-4 p-2 bg-red-50 text-red-500 rounded-xl"><Trash size={18} /></button>
                           <div className="mb-4 pl-12 relative">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">نام دارو</label>
                              <input 
                                 className="w-full font-bold text-gray-800 text-lg border-b border-gray-100 pb-2 outline-none focus:border-indigo-500 placeholder-gray-300" 
                                 placeholder="نام دارو..." 
                                 value={item.drug} 
                                 onFocus={() => { setActiveItemIndex(idx); setSuggestionType('drug'); setSearchQuery(item.drug); }}
                                 onBlur={() => setTimeout(() => { if(suggestionType === 'drug') setSuggestionType(null); }, 200)}
                                 onChange={e => updateItem(idx, 'drug', e.target.value)} 
                              />
                              {suggestionType === 'drug' && activeItemIndex === idx && getDrugSuggestions().length > 0 && (
                                <div className="absolute bottom-full right-0 left-0 bg-white shadow-2xl rounded-2xl border border-gray-200 z-[9999] overflow-hidden mb-2 animate-slide-up flex flex-col-reverse">
                                   {getDrugSuggestions().map(d => (
                                      <button key={d.id} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDrug(d.name); }} className="w-full text-right p-3 hover:bg-indigo-50 flex items-center justify-between border-b border-gray-50 last:border-0">
                                         <div className="flex items-center gap-3">
                                            {getFormIcon(d.name)}
                                            <span className="font-bold text-gray-700">{d.name}</span>
                                         </div>
                                         <Zap size={14} className="text-amber-500" />
                                      </button>
                                   ))}
                                </div>
                              )}
                           </div>
                           <div className="flex gap-3">
                              <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                 <label className="text-[10px] font-bold text-gray-400 block mb-1">دوز / تعداد</label>
                                 <input className="w-full bg-transparent font-mono text-center font-bold text-gray-700 outline-none" placeholder="N=30" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} />
                              </div>
                              <div className="flex-[2] bg-gray-50 p-2 rounded-xl border border-gray-100 relative">
                                 <label className="text-[10px] font-bold text-gray-400 block mb-1">دستور مصرف</label>
                                 <input 
                                    className="w-full bg-transparent font-medium text-gray-700 outline-none text-right" 
                                    placeholder="Sig..." 
                                    value={item.instruction} 
                                    onFocus={() => { setActiveItemIndex(idx); setSuggestionType('instruction'); setSearchQuery(item.instruction); }}
                                    onBlur={() => setTimeout(() => { if(suggestionType === 'instruction') setSuggestionType(null); }, 200)}
                                    onChange={e => updateItem(idx, 'instruction', e.target.value)} 
                                 />
                                 {suggestionType === 'instruction' && activeItemIndex === idx && item.drug && (
                                    <div className="absolute bottom-full right-0 left-0 bg-white/95 backdrop-blur-md shadow-2xl p-2 rounded-t-2xl flex gap-2 overflow-x-auto no-scrollbar border-t border-indigo-100 z-50">
                                       {getQuickInstructions(item.drug).map(ins => (
                                          <button key={ins} onMouseDown={(e) => { e.preventDefault(); selectSuggestedInstruction(ins); }} className="whitespace-nowrap bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg shadow-indigo-100">{ins}</button>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                  <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-500 font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"><Plus size={20} />افزودن قلم داروی جدید</button>
               </div>
            )}
            {mobileTab === 'templates' && (
               <div className="animate-fade-in space-y-3">
                  {templates.length === 0 ? <div className="text-center p-8 text-gray-400 bg-white rounded-2xl border border-gray-100">قالبی یافت نشد</div> : templates.map(t => (<div key={t.id} onClick={() => loadTemplate(t)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-95 transition-transform cursor-pointer"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><LayoutTemplate size={20} /></div><span className="font-bold text-gray-700">{t.name}</span></div><ChevronRight className="text-gray-300" size={20} /></div>))}
               </div>
            )}
         </div>
         <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe z-30 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden">
            {!isExpressMode && <button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="p-4 bg-gray-100 text-gray-600 rounded-2xl disabled:opacity-50"><Save size={24} /></button>}
            <button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="flex-1 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"><Printer size={20} />چاپ و اتمام نسخه</button>
         </div>
      </div>

      {/* DESKTOP UI */}
      <div className="hidden lg:block">
         <div className="flex justify-between items-center mb-4">
           <div className="flex items-center gap-3">
             <button onClick={() => setViewMode('landing')} className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 text-gray-500"><ArrowLeft /></button>
             <FileSignature className="text-indigo-600 w-8 h-8" />
             <div>
               <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  میز کار دکتر
                  {isExpressMode && <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1 animate-pulse"><ZapOff size={10} /> حالت نسخه سریع (بدون بایگانی)</span>}
               </h2>
               <p className="text-xs text-gray-400">پرونده: {selectedPatient?.name}</p>
             </div>
           </div>
         </div>
         
         <div className="grid grid-cols-12 gap-6">
              {/* LEFT SIDEBAR */}
              <div className="col-span-3 space-y-4">
                 <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm"><LayoutTemplate size={16} />قالب‌های آماده</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                       {templates.map(t => (<div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl group hover:bg-indigo-50 transition-colors"><button onClick={() => loadTemplate(t)} className="text-xs font-bold text-gray-700 hover:text-indigo-600 flex-1 text-right">{t.name}</button><button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={12} /></button></div>))}
                    </div>
                 </div>
                 <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
                    <h4 className="font-bold text-blue-700 mb-4 flex items-center gap-2 text-sm"><History size={16} />تاریخچه علائم</h4>
                    <div className="space-y-2">
                       {[ { l: 'BP', v: previousVitals?.bloodPressure, c: 'text-red-600' }, { l: 'HR', v: previousVitals?.heartRate, c: 'text-rose-600' }, { l: 'Temp', v: previousVitals?.temperature, c: 'text-orange-600' }, { l: 'BS', v: previousVitals?.bloodSugar, c: 'text-pink-600' }, { l: 'Wt', v: previousVitals?.weight, c: 'text-indigo-600' } ].map(iv => iv.v ? (<div key={iv.l} className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-50 shadow-sm"><span className="text-[10px] font-bold text-gray-400">{iv.l}</span><span className={`text-xs font-black ${iv.c}`}>{iv.v}</span></div>) : null)}
                       {!previousVitals && <p className="text-[10px] text-center text-blue-300 py-4">سابقه‌ای موجود نیست</p>}
                    </div>
                 </div>
              </div>

              {/* MAIN CONTENT AREA */}
              <div className="col-span-9 bg-white p-6 lg:p-7 rounded-[2.5rem] shadow-sm border border-gray-100 min-h-[750px] flex flex-col relative overflow-hidden">
                 
                 {/* COMPRESSED TOP HEADER */}
                 <div className="flex justify-between items-center bg-gray-50 p-3 lg:p-4 rounded-2xl border border-gray-100 mb-4">
                    <div className="flex gap-8">
                       <div><span className="text-[10px] text-gray-400 font-bold block mb-0.5 uppercase">نام بیمار</span><span className="font-bold text-base text-gray-800">{selectedPatient?.name}</span></div>
                       <div><span className="text-[10px] text-gray-400 font-bold block mb-0.5 uppercase">سن</span><span className="font-bold text-base text-gray-800">{selectedPatient?.age}</span></div>
                       <div><span className="text-[10px] text-gray-400 font-bold block mb-0.5 uppercase">جنسیت</span><span className="font-bold text-base text-gray-800">{selectedPatient?.gender === 'male' ? 'آقا' : 'خانم'}</span></div>
                    </div>
                    <div className="flex gap-2">
                       {/* AI Scribe Button - Primary Action */}
                       <button 
                          onClick={isRecordingScribe ? stopScribeRecording : startScribeRecording}
                          disabled={isProcessingScribe || !isOnline}
                          className={`px-6 py-2 rounded-xl font-black text-sm flex items-center gap-3 shadow-lg transition-all active:scale-95 ${isRecordingScribe ? 'bg-purple-600 text-white animate-scribe-pulse' : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'}`}
                       >
                          {isRecordingScribe ? <MicOff size={18} /> : <Mic size={18} />}
                          {isRecordingScribe ? 'توقف ضبط و پردازش...' : 'کاتب هوشمند صوتی'}
                       </button>

                       <button 
                          onClick={handleAuditSafety} 
                          disabled={safetyLoading || items.length === 0} 
                          className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-sm transition-all ${isOnline ? (safetyLoading ? 'bg-indigo-50 text-indigo-400' : 'bg-indigo-600 text-white animate-safety-pulse hover:bg-indigo-700') : 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200 border'}`}
                       >
                          {safetyLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} 
                          {safetyLoading ? 'پایش ایمنی...' : 'سپر ایمنی AI'}
                       </button>
                       <button onClick={startCamera} disabled={!isOnline} className={`bg-white border text-blue-600 px-5 py-2 rounded-xl font-black text-sm flex items-center gap-2 shadow-sm transition-all ${isOnline ? 'border-blue-200 hover:bg-blue-50 hover:shadow-md' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                          {isOnline ? <ScanLine size={18} /> : <WifiOff size={18} />} اسکن نسخه
                       </button>
                    </div>
                 </div>
                 
                 {/* COMPRESSED VITALS & DX */}
                 <div className={`p-4 rounded-2xl border mb-4 transition-all duration-500 ${isRecordingScribe ? 'bg-purple-50/50 scribe-glow' : 'bg-indigo-50/50 border-indigo-100'}`}>
                    <div className="flex justify-between items-center mb-2">
                       <div className="flex items-center gap-2 text-indigo-800 font-black text-xs uppercase tracking-wider"><Activity size={14} /><span>علائم حیاتی و تشخیص نهایی</span></div>
                       {isRecordingScribe && (
                          <div className="flex gap-1 items-end h-4 px-4">
                             {[...Array(12)].map((_, i) => <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }}></div>)}
                          </div>
                       )}
                    </div>
                    <div className="grid grid-cols-6 gap-2 mb-3">
                       {[ { l: 'فشار خون', k: 'bloodPressure', p: previousVitals?.bloodPressure }, { l: 'ضربان', k: 'heartRate', p: previousVitals?.heartRate }, { l: 'دما', k: 'temperature', p: previousVitals?.temperature }, { l: 'تنفس', k: 'respiratoryRate', p: previousVitals?.respiratoryRate }, { l: 'قند', k: 'bloodSugar', p: previousVitals?.bloodSugar }, { l: 'وزن', k: 'weight', p: previousVitals?.weight } ].map(f => (
                         <div key={f.k} className="relative group"><input className="w-full p-2 bg-white border border-indigo-100 rounded-xl text-xs font-black text-center outline-none focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm" placeholder={f.l} value={(vitals as any)[f.k]} onChange={e => handleVitalChange(f.k, e.target.value)} />{f.p && <div className="absolute -top-3 right-0 left-0 bg-indigo-600 text-white text-[7px] py-0.5 px-1 rounded-full text-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">آخرین: {f.p}</div>}</div>
                       ))}
                    </div>
                    <input className={`w-full p-2.5 bg-white border border-indigo-100 rounded-xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-100 outline-none transition-all ${isRecordingScribe ? 'placeholder:italic' : ''}`} placeholder={isRecordingScribe ? "در حال شنیدن تشخیص و اقلام دارویی..." : "تشخیص نهایی پزشک متخصص (Final Diagnosis)..."} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                 </div>

                 {/* EXPANDED PRESCRIPTION LIST */}
                 <div className={`flex-1 overflow-x-auto overflow-y-visible min-h-[400px] rounded-3xl p-4 transition-all duration-500 ${isRecordingScribe ? 'scribe-glow bg-purple-50/10' : ''}`}>
                    <table className="w-full text-right border-separate border-spacing-y-2">
                       <thead><tr className="border-b border-gray-100"><th className="pb-3 text-[10px] font-black text-gray-400 uppercase w-10">#</th><th className="pb-3 text-[10px] font-black text-gray-400 uppercase w-1/3">نام دارو (Drug Name)</th><th className="pb-3 text-[10px] font-black text-gray-400 uppercase w-1/4">تعداد (Qty)</th><th className="pb-3 text-[10px] font-black text-gray-400 uppercase">دستور مصرف (Sig)</th><th className="pb-3 w-10"></th></tr></thead>
                       <tbody className="divide-y divide-gray-50">
                          {items.map((item, idx) => (
                             <tr key={idx} className="group relative transition-all hover:bg-gray-50/50">
                                <td className="py-2 text-gray-400 text-xs font-bold">{idx + 1}</td>
                                <td className="py-2 px-1 relative">
                                   <input 
                                      className="w-full p-2 bg-transparent focus:bg-white focus:shadow-md rounded-xl outline-none font-black text-gray-700 transition-all" 
                                      value={item.drug} 
                                      onFocus={() => { setActiveItemIndex(idx); setSuggestionType('drug'); setSearchQuery(item.drug); }}
                                      onBlur={() => setTimeout(() => { if(suggestionType === 'drug') setSuggestionType(null); }, 200)}
                                      onChange={e => updateItem(idx, 'drug', e.target.value)} 
                                      placeholder="---" 
                                   />
                                   {suggestionType === 'drug' && activeItemIndex === idx && getDrugSuggestions().length > 0 && (
                                     <div className="absolute top-full right-0 left-0 bg-white shadow-2xl rounded-2xl border border-gray-200 z-[9999] overflow-hidden mt-2 min-w-[280px] animate-slide-up">
                                        {getDrugSuggestions().map(d => (
                                           <button key={d.id} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDrug(d.name); }} className="w-full text-right p-3 hover:bg-indigo-50 border-b border-gray-50 last:border-0 font-bold text-gray-700 flex justify-between items-center transition-colors">
                                              <div className="flex items-center gap-3">
                                                 {getFormIcon(d.name)}
                                                 <span className="text-sm">{d.name}</span>
                                              </div>
                                              <Zap size={14} className="text-amber-400" />
                                           </button>
                                        ))}
                                     </div>
                                   )}
                                </td>
                                <td className="py-2 px-1"><input className="w-full p-2 bg-transparent focus:bg-white focus:shadow-md rounded-xl outline-none font-bold text-sm text-gray-600 transition-all font-mono" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} placeholder="N=30" /></td>
                                <td className="py-2 px-1 relative">
                                   <input className="w-full p-2 bg-transparent focus:bg-white focus:shadow-md rounded-xl outline-none font-medium text-sm text-gray-600 text-right transition-all" value={item.instruction} onFocus={() => { setActiveItemIndex(idx); setSuggestionType('instruction'); setSearchQuery(item.instruction); }} onBlur={() => setTimeout(() => { if(suggestionType === 'instruction') setSuggestionType(null); }, 200)} onChange={e => updateItem(idx, 'instruction', e.target.value)} placeholder="---" />
                                   {suggestionType === 'instruction' && activeItemIndex === idx && item.drug && (
                                      <div className="absolute top-full right-0 left-0 bg-white shadow-2xl rounded-2xl border border-gray-100 z-[9999] overflow-hidden mt-2 p-2 flex flex-col gap-1 animate-slide-up">
                                         {getQuickInstructions(item.drug).map(ins => (<button key={ins} onMouseDown={(e) => { e.preventDefault(); selectSuggestedInstruction(ins); }} className="text-right p-2.5 hover:bg-indigo-50 rounded-xl text-xs font-black text-gray-600 transition-colors">{ins}</button>))}
                                      </div>
                                   )}
                                </td>
                                <td className="py-2 text-center"><button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"><Trash size={16} /></button></td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    <button onClick={addItem} className="mt-4 text-indigo-600 font-black text-xs flex items-center gap-2 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm"><Plus size={16} />افزودن قلم داروی جدید</button>
                 </div>

                 {/* STICKY BOTTOM ACTIONS */}
                 <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white pb-2 z-20">
                    {!isExpressMode && <button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="px-8 py-4 rounded-2xl font-black text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"><Save size={20} />ذخیره در قالب‌ها</button>}
                    <button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="px-10 py-4 rounded-2xl font-black text-sm text-white bg-indigo-600 shadow-2xl shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"><Printer size={20} />تایید نهایی و چاپ نسخه</button>
                 </div>
              </div>
           </div>
      </div>

      {/* Safety Report Modal */}
      {showSafetyModal && safetyReport && (
         <div className="fixed inset-0 z-[180] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
               <div className={`p-8 text-white flex items-center justify-between ${safetyReport.status === 'critical' ? 'bg-red-600' : safetyReport.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                  <div className="flex items-center gap-4">
                     <div className="bg-white/20 p-3 rounded-2xl"><ShieldAlert size={32} /></div>
                     <div>
                        <h3 className="text-2xl font-black">گزارش واکاوی ایمنی نسخه</h3>
                        <p className="text-white/80 text-sm font-bold mt-1">توسط واحد فارماکولوژی طبیب هوشمند</p>
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
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg"><ShieldCheck size={40} /></div>
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

      {/* Camera and Modals */}
      {showCamera && (<div className="fixed inset-0 z-[150] bg-black flex flex-col"><div className="flex justify-between items-center p-4 bg-black/50 text-white absolute top-0 left-0 right-0 z-10"><h3 className="font-bold text-lg flex items-center gap-2"><ScanLine /> اسکن نسخه</h3><button onClick={stopCamera} className="p-2 bg-white/20 rounded-full"><X /></button></div><div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"><video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" /><canvas ref={canvasRef} className="hidden" /></div><div className="bg-black p-6 pb-10 flex justify-between items-center"><button onClick={() => setScanOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')} className="text-white flex flex-col items-center gap-1 text-xs"><RotateCw size={24} /><span>چرخش</span></button><button onClick={capturePhoto} className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center shadow-lg"><div className="w-16 h-16 rounded-full bg-white border-2 border-black/10"></div></button><div className="w-12 relative overflow-hidden"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileUpload} /><button className="text-white flex flex-col items-center gap-1 text-xs"><ImageIcon size={24} /><span>گالری</span></button></div></div></div>)}
      {showSaveModal && (<div className="fixed inset-0 bg-black/50 z-[160] backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-fade-in"><h3 className="font-black text-xl text-gray-800 mb-6 flex items-center gap-2"><LayoutTemplate className="text-indigo-600" />ذخیره به عنوان قالب</h3><input autoFocus className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-6 outline-none focus:ring-4 focus:ring-indigo-100 font-bold" placeholder="نام قالب (مثال: سرماخوردگی)" value={templateName} onChange={e => setTemplateName(e.target.value)} /><div className="flex justify-end gap-3"><button onClick={() => setShowSaveModal(false)} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-800 transition-colors">لغو</button><button onClick={handleSaveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100">ذخیره نسخه</button></div></div></div>)}
      {showPrintModal && (
         <div className="fixed inset-0 bg-black/50 z-[160] backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-fade-in">
               <h3 className="font-black text-2xl text-gray-800 mb-8 flex items-center gap-3"><Printer className="text-indigo-600" />آماده‌سازی برای چاپ</h3>
               <div className="space-y-4">
                  <button onClick={() => handlePrint('plain')} className="w-full p-6 border-2 border-gray-100 rounded-3xl flex items-center justify-between hover:border-indigo-600 hover:bg-indigo-50/50 transition-all text-right group"><div><span className="font-black text-lg text-gray-800 block group-hover:text-indigo-700">چاپ دیجیتال (استاندارد)</span><span className="text-xs text-gray-500 font-medium">با سربرگ و لوگوی سیستم طبیب هوشمند</span></div><div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all"><CheckCircle size={20} /></div></button>
                  <button onClick={() => handlePrint('custom')} disabled={!settings.backgroundImage} className="w-full p-6 border-2 border-gray-100 rounded-3xl flex items-center justify-between hover:border-indigo-600 hover:bg-indigo-50/50 transition-all text-right group disabled:opacity-40 disabled:cursor-not-allowed"><div><span className="font-black text-lg text-gray-800 block group-hover:text-indigo-700">چاپ روی سربرگ مطب</span><span className="text-xs text-gray-500 font-medium">تطبیق دقیق متن با کاغذ طراحی شده شما</span></div><div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all"><CheckCircle size={20} /></div></button>
               </div>
               <div className="mt-10 flex justify-center"><button onClick={() => setShowPrintModal(false)} className="text-gray-400 font-bold hover:text-red-500 transition-colors">بازگشت به ویرایش</button></div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Prescription;
