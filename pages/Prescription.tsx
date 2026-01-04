
import React, { useState, useEffect, useRef } from 'react';
import { digitizePrescription, processDigitalPadAI, checkPrescriptionSafety, processScribeAudio, transcribeMedicalAudio } from '../services/geminiService';
import { saveTemplate, getAllTemplates, deleteTemplate, getSettings, saveSettings, saveRecord, getDoctorProfile, getUniquePatients, getAllDrugs, trackDrugUsage, getUsageStats, saveComplaintTemplate, getAllComplaintTemplates, deleteComplaintTemplate, getNextDisplayId, getRecordsByName } from '../services/db';
import { PrescriptionItem, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, PatientVitals, PatientRecord, Drug, DrugUsage, PrescriptionRecord, LayoutElement } from '../types';
import { FileSignature, ScanLine, Printer, Save, Trash, Plus, CheckCircle, Search, LayoutTemplate, Activity, UserPlus, Stethoscope, ArrowLeft, X, Phone, Scale, AlertCircle, WifiOff, Camera, Image as ImageIcon, Heart, Thermometer, Wind, Droplet, Hash, FileText, ChevronRight, Loader2, Sparkles, User, RotateCw, History, RefreshCw, Zap, TrendingUp, Pill, Beaker, SprayCan, Brain, ZapOff, ShieldAlert, ShieldCheck, Info, Mic, MicOff, List, Monitor, ListChecks, BookmarkPlus, PenTool, Eraser, RotateCcw, ZoomIn, ZoomOut, Check, Maximize, GripVertical, Settings2, Type, MonitorOff } from 'lucide-react';

interface PrescriptionProps {
  initialRecord: PatientRecord | null;
}

const A4_DIMS = { w: 794, h: 1123 };
const A5_DIMS = { w: 559, h: 794 };

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

// --- DESKTOP PROFESSIONAL VITAL INPUT ---
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
  const [complaintTemplates, setComplaintTemplates] = useState<any[]>([]);
  const [showComplaintTemplateMenu, setShowComplaintTemplateMenu] = useState(false);
  
  const [allDrugs, setAllDrugs] = useState<Drug[]>([]);
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [suggestionType, setSuggestionType] = useState<'drug' | 'dosage' | 'instruction' | null>(null);

  // Preference Hub State
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [customDosages, setCustomDosages] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState<string[]>([]);
  const [newPrefValue, setNewPrefValue] = useState('');

  const [vitals, setVitals] = useState<PatientVitals>({
    bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: '', height: '', respiratoryRate: '', bloodSugar: ''
  });

  const [previousVitals, setPreviousVitals] = useState<PatientVitals | null>(null);
  const [activeDraft, setActiveDraft] = useState<any | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  
  const [settings, setSettings] = useState<PrescriptionSettings>({
    topPadding: 50, fontSize: 14, fontFamily: 'Vazirmatn', printBackground: true, paperSize: 'A4', elements: [],
    customDosages: [], customInstructions: []
  });
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  const [templateName, setTemplateName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showQuickEntryModal, setShowQuickEntryModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showMobileRestrictModal, setShowMobileRestrictModal] = useState(false);

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

  // --- DIGITAL PAD ENHANCED STATE ---
  const [showDigitalPad, setShowDigitalPad] = useState(false);
  const padBgCanvasRef = useRef<HTMLCanvasElement>(null);
  const padInkCanvasRef = useRef<HTMLCanvasElement>(null);
  const [padIsDrawing, setPadIsDrawing] = useState(false);
  const [padHistory, setPadHistory] = useState<string[]>([]);
  const [padRotation, setPadRotation] = useState(0);
  const [padZoom, setPadZoom] = useState(1);
  const [padColor, setPadColor] = useState('#1e3a8a'); 
  const [padTool, setPadTool] = useState<'pen' | 'eraser' | 'idle' | 'type'>('idle');
  const [padPenThickness, setPadPenThickness] = useState(3);
  const [padEraserThickness, setPadEraserThickness] = useState(20);
  const [padThickness, setPadThickness] = useState(3);
  const [activeTypingFieldId, setActiveTypingFieldId] = useState<string | null>(null);
  
  // Floating Lever & Temporal State
  const [padToolbarPos, setPadToolbarPos] = useState({ x: 20, y: 20 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const toolbarDragOffset = useRef({ x: 0, y: 0 });
  const [showPadSettings, setShowPadSettings] = useState(false);
  const padSettingsTimerRef = useRef<any>(null);

  // Pad Search States
  const [showPadSearch, setShowPadSearch] = useState(false);
  const [padSearchTerm, setPadSearchTerm] = useState('');

  // New Patient Pad Mode
  const [isNewPatientPadMode, setIsNewPatientPadMode] = useState(false);

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

  // Sync Slider value with current tool's thickness memory
  useEffect(() => {
    if (padTool === 'pen') setPadThickness(padPenThickness);
    else if (padTool === 'eraser') setPadThickness(padEraserThickness);
  }, [padTool, padPenThickness, padEraserThickness]);

  const loadInitialData = async () => {
    try {
      const templatesData = await getAllTemplates();
      setTemplates(templatesData);
      const cTemplatesData = await getAllComplaintTemplates();
      setComplaintTemplates(cTemplatesData);
      const patientsData = await getUniquePatients();
      setAllPatients(patientsData);
      const drugsData = await getAllDrugs();
      setAllDrugs(drugsData);
      const stats = await getUsageStats();
      setUsageStats(stats);
      const s = await getSettings();
      if (s) {
        setSettings(s);
        setCustomDosages(s.customDosages || []);
        setCustomInstructions(s.customInstructions || []);
      }
      const p = await getDoctorProfile();
      if (p) setDoctorProfile(p);
    } catch (e) { console.error(e); }
  };

  const filteredPatients = allPatients.filter(p => 
    p.name.includes(searchTerm) || (p.displayId && p.displayId.includes(searchTerm))
  );
  
  const padFilteredPatients = allPatients.filter(p => 
    p.name.includes(padSearchTerm) || (p.displayId && p.displayId.includes(padSearchTerm))
  );

  const handleSelectPatient = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setIsExpressMode(patient.id.startsWith('guest_'));
    setViewMode('editor');
    setVitals({
      bloodPressure: patient.vitals?.bloodPressure || '', 
      heartRate: patient.vitals?.heartRate || '', 
      temperature: patient.vitals?.temperature || '', 
      spO2: patient.vitals?.spO2 || '', 
      weight: patient.vitals?.weight || '', 
      height: patient.vitals?.height || '', 
      respiratoryRate: patient.vitals?.respiratoryRate || '', 
      bloodSugar: patient.vitals?.bloodSugar || ''
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
    // Auto-close search if selecting from pad
    setShowPadSearch(false);
    setPadSearchTerm('');
    setIsNewPatientPadMode(false);
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
      
      const flashEl = document.createElement('div');
      flashEl.className = 'fixed inset-0 z-[300] bg-white animate-flash-effect pointer-events-none';
      document.body.appendChild(flashEl);
      setTimeout(() => { if (flashEl.parentNode) document.body.removeChild(flashEl); }, 500);

      canvas.width = video.videoWidth; 
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "prescription_scan.jpg", { type: "image/jpeg" });
            stopCamera(); 
            await processFile(file);
          }
        }, 'image/jpeg', 0.9);
      }
    }
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

  // --- DIGITAL PAD LOGIC ---
  const startDigitalPad = () => {
    if (window.innerWidth < 1024) {
       setShowMobileRestrictModal(true);
       return;
    }
    stopCamera();
    setShowDigitalPad(true);
    setPadHistory([]);
    setPadRotation(0);
    setPadZoom(1);
    setPadTool('idle'); 
    setPadThickness(padPenThickness); 
    setPadToolbarPos({ x: (window.innerWidth / 2) - 200, y: (window.innerHeight / 2) - 40 });
    setTimeout(initPadCanvas, 100);
  };

  const initPadCanvas = () => {
    const bgCanvas = padBgCanvasRef.current;
    const inkCanvas = padInkCanvasRef.current;
    if (!bgCanvas || !inkCanvas) return;
    
    const bgCtx = bgCanvas.getContext('2d');
    const inkCtx = inkCanvas.getContext('2d');
    if (!bgCtx || !inkCtx) return;

    const paperDims = settings.paperSize === 'A4' ? A4_DIMS : A5_DIMS;
    
    const img = new Image();
    img.src = settings.backgroundImage || '';
    img.onload = () => {
      bgCanvas.width = inkCanvas.width = paperDims.w;
      bgCanvas.height = inkCanvas.height = paperDims.h;
      bgCtx.drawImage(img, 0, 0, paperDims.w, paperDims.h);
      inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
      setPadHistory([inkCanvas.toDataURL()]);
    };
    img.onerror = () => {
      bgCanvas.width = inkCanvas.width = paperDims.w;
      bgCanvas.height = inkCanvas.height = paperDims.h;
      bgCtx.fillStyle = '#ffffff';
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
      setPadHistory([inkCanvas.toDataURL()]);
    };
  };

  const getCanvasMousePos = (e: any) => {
    const canvas = padInkCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const angleRad = -padRotation * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const rotatedX = (dx * cos - dy * sin) / padZoom;
    const rotatedY = (dx * sin + dy * cos) / padZoom;

    return { x: rotatedX + canvas.width / 2, y: rotatedY + canvas.height / 2 };
  };

  const handlePadStart = (e: any) => {
    if (padTool === 'type') return; 
    e.preventDefault();
    if (padTool === 'idle') return; 
    setPadIsDrawing(true);
    const { x, y } = getCanvasMousePos(e);
    const ctx = padInkCanvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      if (padTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = padEraserThickness; 
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = padColor;
        ctx.lineWidth = padPenThickness; 
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const handlePadMove = (e: any) => {
    if (!padIsDrawing) return;
    const { x, y } = getCanvasMousePos(e);
    const ctx = padInkCanvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handlePadEnd = () => {
    if (!padIsDrawing) return;
    setPadIsDrawing(false);
    const inkCanvas = padInkCanvasRef.current;
    if (inkCanvas) setPadHistory(prev => [...prev, inkCanvas.toDataURL()]);
  };

  const undoPad = () => {
    if (padHistory.length <= 1) return;
    const newHistory = [...padHistory];
    newHistory.pop();
    setPadHistory(newHistory);
    const last = newHistory[newHistory.length - 1];
    const canvas = padInkCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && last) {
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas!.width, canvas!.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const clearPad = () => {
    if (confirm('آیا از پاک کردن کل دست‌نوشته اطمینان دارید؟')) {
      const ctx = padInkCanvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, padInkCanvasRef.current!.width, padInkCanvasRef.current!.height);
        setPadHistory([padInkCanvasRef.current!.toDataURL()]);
      }
    }
  };

  const analyzePad = () => {
    const bgCanvas = padBgCanvasRef.current;
    const inkCanvas = padInkCanvasRef.current;
    if (!bgCanvas || !inkCanvas) return;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = bgCanvas.width;
    finalCanvas.height = bgCanvas.height;
    const fCtx = finalCanvas.getContext('2d');
    if (!fCtx) return;
    fCtx.drawImage(bgCanvas, 0, 0);
    fCtx.drawImage(inkCanvas, 0, 0);
    finalCanvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], "digital_handwritten_rx.jpg", { type: "image/jpeg" });
        setShowDigitalPad(false);
        setLoading(true);
        try {
          const res = await processDigitalPadAI(file);
          const guestRecord: PatientRecord = {
            id: `guest_${Date.now()}`,
            name: res.patientName || 'بیمار مهمان',
            age: res.patientAge || '',
            gender: res.patientGender || 'male',
            chiefComplaint: res.chiefComplaint || '',
            history: '',
            visitDate: Date.now(),
            status: 'waiting',
            vitals: {
                bloodPressure: res.vitals?.bloodPressure || '', 
                heartRate: res.vitals?.heartRate || '', 
                temperature: res.vitals?.temperature || '', 
                spO2: res.vitals?.spO2 || '', 
                weight: res.patientWeight || '', 
                height: '', 
                respiratoryRate: '', 
                bloodSugar: res.vitals?.bloodSugar || ''
            }
          };
          handleSelectPatient(guestRecord);
          if (res.items) setItems(res.items);
          if (res.diagnosis) setDiagnosis(res.diagnosis);
          if (res.chiefComplaint) setChiefComplaint(res.chiefComplaint);
          if (res.vitals) setVitals(prev => ({ ...prev, ...res.vitals, weight: res.patientWeight || prev.weight }));
        } catch (e) {
          alert("خطا در تحلیل دست‌خط دیجیتال");
        } finally {
          setLoading(false);
        }
      }
    }, 'image/jpeg', 0.95);
  };

  const handleToolbarStart = (e: any) => {
     const clientX = e.touches ? e.touches[0].clientX : e.clientX;
     const clientY = e.touches ? e.touches[0].clientY : e.clientY;
     setIsDraggingToolbar(true);
     toolbarDragOffset.current = { x: clientX - padToolbarPos.x, y: clientY - padToolbarPos.y };
  };

  const handleToolbarMove = (e: any) => {
     if (!isDraggingToolbar) return;
     const clientX = e.touches ? e.touches[0].clientX : e.clientX;
     const clientY = e.touches ? e.touches[0].clientY : e.clientY;
     setPadToolbarPos({ x: clientX - toolbarDragOffset.current.x, y: clientY - toolbarDragOffset.current.y });
  };

  const handleToolbarEnd = () => setIsDraggingToolbar(false);

  const triggerSettingsDisplay = () => {
     setShowPadSettings(true);
     if (padSettingsTimerRef.current) clearTimeout(padSettingsTimerRef.current);
     padSettingsTimerRef.current = setTimeout(() => {
        setShowPadSettings(false);
     }, 4000); 
  };

  const resetPadForNewPatient = () => {
    setSelectedPatient(null);
    setIsExpressMode(false);
    setVitals({
      bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: '', height: '', respiratoryRate: '', bloodSugar: ''
    });
    setDiagnosis('');
    setChiefComplaint('');
    setItems([]);
  };

  const saveToPatientRecord = async () => {
    let currentPatient = selectedPatient;
    
    // --- NEW PATIENT MODE COLLISION CHECK ---
    if (isNewPatientPadMode) {
        if (!selectedPatient?.name) {
            alert("لطفاً نام بیمار را وارد کنید.");
            return;
        }
        const existing = await getRecordsByName(selectedPatient.name);
        if (existing.length > 0) {
            alert(`خطا: پرونده‌ای با نام «${selectedPatient.name}» قبلاً در سیستم ثبت شده است.`);
            return;
        }
    }

    // If typing manually and no patient selected, or name changed, auto-create a patient record
    if (!currentPatient || currentPatient.name !== (selectedPatient?.name || '')) {
       const guestRecord: PatientRecord = {
          id: `guest_${Date.now()}`,
          name: selectedPatient?.name || 'بیمار مهمان',
          age: selectedPatient?.age || '',
          gender: selectedPatient?.gender || 'male',
          chiefComplaint: chiefComplaint,
          history: '',
          visitDate: Date.now(),
          status: 'completed',
          displayId: await getNextDisplayId(),
          vitals: vitals
       };
       await saveRecord(guestRecord);
       currentPatient = guestRecord;
    }

    const newPrescription: PrescriptionRecord = {
      id: crypto.randomUUID(), 
      date: Date.now(), 
      items: items.filter(it => it.drug.trim() !== ''), 
      manualDiagnosis: diagnosis, 
      manualVitals: vitals, 
      manualChiefComplaint: chiefComplaint
    };

    const updatedRecord: PatientRecord = {
      ...currentPatient, 
      status: 'completed', 
      prescriptions: [...(currentPatient.prescriptions || []), newPrescription], 
      vitals: vitals,
    };

    try { 
      await saveRecord(updatedRecord); 
      setSelectedPatient(updatedRecord); 
      if (currentPatient.id) localStorage.removeItem(`tabib_draft_${currentPatient.id}`); 
      setIsNewPatientPadMode(false); // Reset mode after successful unique save
    } catch (e) { 
      console.error(e); 
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

  const handleAddPreference = async (type: 'dosage' | 'instruction') => {
    if (!newPrefValue.trim()) return;
    const updatedSettings = { ...settings };
    if (type === 'dosage') {
      const newList = [...(updatedSettings.customDosages || []), newPrefValue.trim()];
      updatedSettings.customDosages = Array.from(new Set(newList));
      setCustomDosages(updatedSettings.customDosages);
    } else {
      const newList = [...(updatedSettings.customInstructions || []), newPrefValue.trim()];
      updatedSettings.customInstructions = Array.from(new Set(newList));
      setCustomInstructions(updatedSettings.customInstructions);
    }
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
    setNewPrefValue('');
  };

  const handleRemovePreference = async (type: 'dosage' | 'instruction', value: string) => {
    const updatedSettings = { ...settings };
    if (type === 'dosage') {
      updatedSettings.customDosages = (updatedSettings.customDosages || []).filter(v => v !== value);
      setCustomDosages(updatedSettings.customDosages);
    } else {
      updatedSettings.customInstructions = (updatedSettings.customInstructions || []).filter(v => v !== value);
      setCustomInstructions(updatedSettings.customInstructions);
    }
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  const addItem = () => setItems([...items, { drug: '', dosage: '', instruction: '' }]);

  const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    if (field === 'drug') setSearchQuery(value);
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

  const selectSuggestedDosage = (dosage: string) => {
    if (activeItemIndex === null) return;
    const newItems = [...items];
    newItems[activeItemIndex].dosage = dosage;
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

  const handleSaveComplaintTemplate = async () => {
    if (!chiefComplaint.trim()) return;
    try {
      await saveComplaintTemplate(chiefComplaint.trim());
      loadInitialData();
      alert('شکایت به عنوان قالب ذخیره شد.');
    } catch (e) { console.error(e); }
  };

  const selectComplaintTemplate = (text: string) => {
    setChiefComplaint(prev => prev + (prev ? " " : "") + text);
    setShowComplaintTemplateMenu(false);
  };

  const handleDeleteComplaintTemplate = async (id: string) => {
    if (confirm('آیا از حذف این قالب اطمینان دارید؟')) {
      await deleteComplaintTemplate(id);
      loadInitialData();
    }
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
    const results = allDrugs.filter(d => d.name.toLowerCase().includes(q) || (d.category && d.category.toLowerCase().includes(q)));
    return results.sort((a, b) => {
        const aStart = a.name.toLowerCase().startsWith(q);
        const bStart = b.name.toLowerCase().startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
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

  const getSmartDosages = () => {
    const historical = usageStats.map(u => u.lastDosage).filter(Boolean);
    const top3 = Array.from(new Set(historical)).slice(0, 3);
    return [...top3, ...customDosages];
  };

  const getSmartInstructions = (drugName: string) => {
    const stats = usageStats.find(u => u.drugName === drugName);
    const learned = stats?.commonInstructions || [];
    return [...learned, ...customInstructions].slice(0, 20);
  };

  // Helper for digital pad UI placeholders (Updated to Standard English Abbreviations)
  const getCleanLabel = (id: string, originalLabel: string) => {
      switch(id) {
          case 'vital_bp': return 'BP';
          case 'vital_hr': return 'HR';
          case 'vital_rr': return 'RR';
          case 'vital_temp': return 'T';
          case 'vital_o2': return 'O2';
          case 'vital_bs': return 'BS';
          case 'vital_weight': return 'WT (KG)';
          case 'chiefComplaint': return 'شکایت اصلی';
          case 'patientId': return 'شماره پرونده (ID)';
          case 'patientName': return 'نام کامل بیمار';
          case 'age': return 'سن';
          case 'diagnosis': return 'تشخیص نهایی';
          case 'date': return 'تاریخ';
          default: return originalLabel.replace(/\(.*\)/, '').trim();
      }
  };

  const handlePrint = async (mode: 'plain' | 'custom') => {
     //commit to database first
     await saveToPatientRecord();
     
     items.forEach(item => { if (item.drug) trackDrugUsage(item.drug, item.dosage, item.instruction); });
     
     const iframeId = 'tabib-print-frame';
     let frame = document.getElementById(iframeId) as HTMLIFrameElement;
     if (frame) document.body.removeChild(frame);
     frame = document.createElement('iframe');
     frame.id = iframeId;
     frame.style.position = 'fixed';
     frame.style.right = '0';
     frame.style.bottom = '0';
     frame.style.width = '0';
     frame.style.height = '0';
     frame.style.border = '0';
     document.body.appendChild(frame);
     const win = frame.contentWindow;
     if (!win) return;
     let style = `
       @page { margin: 0 !important; size: auto; }
       html, body { margin: 0 !important; padding: 0 !important; width: 100%; height: 100%; overflow: hidden; box-sizing: border-box; }
       body { font-family: '${settings.fontFamily}', 'Vazirmatn', sans-serif; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #1e293b; }
       .print-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0 !important; padding: 0 !important; }
       .majestic-container { position: relative; width: 100%; height: 100%; border: 4px double #1e3a8a; padding: 12mm; box-sizing: border-box; overflow: hidden; }
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
       .custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; padding: 0 !important; margin: 0 !important; }
       .print-element { position: absolute; white-space: normal; word-wrap: break-word; line-height: 1.4; }
       .bg-image { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1; }
     `;
     let content = '';
     if (mode === 'plain') {
        content = `
          <div class="print-wrapper">
            <div class="majestic-container">
               <div class="rx-watermark">℞</div>
               <div class="header-pro">
                  <div class="doc-info"><h1 class="dr-name">${doctorProfile?.name || 'دکتر متخصص'}</h1><div class="dr-spec">${doctorProfile?.specialty || ''}</div><div class="council-box">نظام پزشکی: ${doctorProfile?.medicalCouncilNumber || '---'}</div></div>
                  ${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 90px; object-fit: contain;" />` : ''}
               </div>
               <div class="patient-summary"><div><span>بیمار:</span> ${selectedPatient?.name || '---'}</div><div><span>ID:</span> ${selectedPatient?.displayId || '---'}</div><div><span>سن:</span> ${selectedPatient?.age || '--'}</div><div><span>تاریخ:</span> ${new Date().toLocaleDateString('fa-IR')}</div></div>
               <div class="vitals-matrix"><div class="vital-cell"><span class="vital-label">BP</span><span class="vital-value">${vitals.bloodPressure || '--'}</span></div><div class="vital-cell"><span class="vital-label">HR</span><span class="vital-value">${vitals.heartRate || '--'}</span></div><div class="vital-cell"><span class="vital-label">TEMP</span><span class="vital-value">${vitals.temperature || '--'}</span></div><div class="vital-cell"><span class="vital-label">RR</span><span class="vital-value">${vitals.respiratoryRate || '--'}</span></div><div class="vital-cell"><span class="vital-label">SPO2</span><span class="vital-value">${vitals.spO2 || '--'}</span></div><div class="vital-cell"><span class="vital-label">BS</span><span class="vital-value">${vitals.bloodSugar || '--'}</span></div><div class="vital-cell"><span class="vital-label">WT</span><span class="vital-value">${vitals.weight || '--'}</span></div><div class="vital-cell"><span class="vital-label">HT</span><span class="vital-value">${vitals.height || '--'}</span></div></div>
               ${chiefComplaint ? `<div class="clinical-section"><div class="section-title">Clinical Findings (CC)</div><div class="clinical-content">${chiefComplaint}</div></div>` : ''}
               ${diagnosis ? `<div class="clinical-section"><div class="section-title">Impression / Diagnosis</div><div class="clinical-content" style="font-weight:bold; color:#1e3a8a;">${diagnosis}</div></div>` : ''}
               <div class="rx-symbol">℞</div>
               <ul class="drug-list">${items.map((item, i) => `<li class="drug-item"><div class="drug-num">${i + 1}.</div><div class="drug-details"><div class="drug-name">${item.drug}</div><div class="drug-sig: ${item.instruction}</div></div><div class="drug-qty">${item.dosage}</div></li>`).join('')}</ul>
               <div class="footer-pro"><div style="font-size:9pt; color:#64748b;"><div>${doctorProfile?.address || ''}</div><div style="margin-top:1mm;">تلفن: ${doctorProfile?.phone || ''}</div></div><div class="signature-area">Signature & Stamp</div></div>
               <div class="footer-motto">"Preserving the integrity of the profession with AI precision."</div>
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
        content = `<div class="print-wrapper"><div class="custom-container">${bgHtml}${elementsHtml}</div></div>`;
     }
     win.document.write(`<html dir="rtl"><head><title>Prescription</title><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet"><style>${style}</style></head><body>${content}</body></html>`);
     win.document.close();
     const bgImg = win.document.getElementById('bgImg') as HTMLImageElement;
     const triggerPrint = () => { setTimeout(() => { win.print(); if (isExpressMode) setViewMode('landing'); }, 400); };
     if (bgImg && !bgImg.complete) { bgImg.onload = triggerPrint; bgImg.onerror = triggerPrint; } else { triggerPrint(); }
  };

  const handleAutoPrint = () => { if (items.length === 0) return; const mode = settings.backgroundImage ? 'custom' : 'plain'; handlePrint(mode); };
  const printButtonLabel = settings.backgroundImage ? 'چاپ روی سربرگ مطب' : 'چاپ نسخه دیجیتال (Majestic)';

  const renderLanding = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fade-in gap-8">
       <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-blue-50 w-full max-w-3xl text-center relative overflow-hidden -mt-[120px]">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-teal-400"></div>
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><Stethoscope size={48} /></div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">میز کار نسخه نویسی</h1>
          <p className="text-gray-500 mb-8 font-medium">نام بیمار را جستجو کنید یا از کپچر عملیاتی برای ثبت آنی استفاده کنید</p>
          
          <div className="flex justify-center gap-6 mb-10 animate-slide-up">
             <button onClick={() => setShowQuickEntryModal(true)} title="نسخه سریع (بدون بایگانی)" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 bg-white border-2 border-teal-50 rounded-[1.5rem] flex items-center justify-center text-teal-600 shadow-sm group-hover:shadow-xl group-hover:bg-teal-50 group-hover:border-teal-100 transition-all active:scale-95">
                   <User size={30} />
                </div>
                <span className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">نسخه سریع</span>
             </button>
             
             <button onClick={() => setShowNewPatientModal(true)} title="ثبت نام و تشکیل پرونده" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 bg-teal-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-teal-100 group-hover:bg-teal-600 group-hover:scale-105 transition-all active:scale-95">
                   <UserPlus size={30} />
                </div>
                <span className="text-[10px] font-black text-teal-700 uppercase tracking-tighter">تشکیل پرونده</span>
             </button>
             
             <button onClick={startDigitalPad} title="نگارش دیجیتال (Digital Pad)" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 bg-white border-2 border-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-sm group-hover:shadow-xl group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all active:scale-95">
                   <PenTool size={30} />
                </div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">نگارش دیجیتال</span>
             </button>
          </div>

          <div className="relative max-w-2xl mx-auto mb-4">
             <div className="relative group">
                <div className="absolute inset-y-2 right-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-600 transition-colors"><Search size={24} /></div>
                <input type="text" autoFocus placeholder="نام یا کد بیمار (001) را جستجو کنید..." className="w-full p-6 pr-14 text-xl bg-gray-50 border border-gray-200 rounded-3xl focus:ring-8 focus:ring-teal-50 focus:border-teal-500 outline-none transition-all shadow-inner font-bold text-gray-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             {searchTerm && filteredPatients.length > 0 && (
               <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-20 max-h-72 overflow-y-auto animate-slide-up">
                  {filteredPatients.map(p => (<button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full text-right p-5 hover:bg-teal-50 border-b border-gray-50 last:border-0 flex justify-between items-center transition-all group"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-all"><span className="text-[10px] font-black">#{p.displayId}</span></div><span className="font-bold text-gray-700 text-lg">{p.name}</span></div><span className="text-sm font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-full group-hover:bg-white group-hover:shadow-sm">{p.age} ساله</span></button>))}
               </div>
             )}
          </div>
       </div>
    </div>
  );

  const paperDims = settings.paperSize === 'A4' ? A4_DIMS : A5_DIMS;

  return (
    <div className="space-y-8 animate-fade-in pb-24 lg:pb-20 relative min-h-[80vh]">
      <style>{`
        @keyframes scan-line { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
        .animate-scan-line { animation: scan-line 3s linear infinite; }
        @keyframes safety-pulse { 0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); } 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); } }
        .animate-safety-pulse { animation: safety-pulse 2s infinite; }
        @keyframes scribe-pulse { 0% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.5); transform: scale(1); } 50% { box-shadow: 0 0 0 15px rgba(147, 51, 234, 0); transform: scale(1.05); } 100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0); transform: scale(1); } }
        .animate-scribe-pulse { animation: scribe-pulse 1.5s infinite ease-in-out; }
        .scribe-glow { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); border-color: rgba(168, 85, 247, 0.5) !important; }
        @keyframes waveform { 0%, 100% { height: 4px; } 50% { height: 16px; } }
        .waveform-bar { width: 3px; background-color: #a855f7; border-radius: 2px; animation: waveform 0.8s ease-in-out infinite; }
        @keyframes flash-effect { 0% { opacity: 0.8; } 100% { opacity: 0; } }
        .animate-flash-effect { animation: flash-effect 0.5s ease-out forwards; }
        .digital-pad-canvas { touch-action: none; display: block; }
        .satellite-bar {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border-radius: 2rem;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s;
        }
        .satellite-bar:active { transform: scale(0.98); }
        .temporal-settings {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 1.5rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .ai-small-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #4f46e5;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(79, 70, 229, 0.4);
          transition: all 0.3s ease;
        }
        .ai-small-btn:hover { background: #4338ca; transform: rotate(12deg) scale(1.1); }
        .tool-active-glow { box-shadow: 0 0 20px #4f46e5 !important; color: #4f46e5 !important; background: white !important; }
        .rx-typing-overlay { 
          position: absolute; 
          inset: 0; 
          z-index: 20; 
          pointer-events: none;
        }
        .rx-field-input { 
          pointer-events: auto; 
          border: 1px solid transparent; 
          background: transparent; 
          outline: none; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          padding: 4px 10px;
          border-radius: 10px;
          font-weight: 900;
        }
        .rx-field-input:hover { background: rgba(59, 130, 246, 0.04); }
        .rx-field-input:focus { border-color: #3b82f6; background: rgba(255, 255, 255, 0.95); box-shadow: 0 0 0 12px rgba(59, 130, 246, 0.05); }
        .rx-field-placeholder { opacity: 0.15; color: #1e3a8a; font-weight: 900; transition: opacity 0.3s; }
        .rx-field-input:focus + .rx-field-placeholder, .rx-field-input:not(:placeholder-shown) + .rx-field-placeholder { opacity: 0; }
        
        .rx-field-input-patient {
          font-size: 1.4em !important;
          background: rgba(255,255,255,0.3);
          border-bottom: 2px solid rgba(59, 130, 246, 0.1);
          width: 100% !important;
        }

        .rx-field-input-med {
          font-size: 1.4em !important;
          font-weight: 900 !important;
          color: #1e293b;
        }

        .rx-item-row { 
          display: flex; 
          align-items: center; 
          gap: 4px; 
          pointer-events: auto; 
          background: rgba(255,255,255,0.7); 
          border-radius: 12px; 
          margin-bottom: 4px; 
          padding: 4px; 
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .rx-item-row:hover { border-color: rgba(59, 130, 246, 0.1); background: white; }
        .rx-item-input { background: transparent; border: none; outline: none; padding: 2px 4px; transition: background 0.2s; border-radius: 8px; }
        .rx-item-input:focus { background: rgba(59, 130, 246, 0.05); }
        .majestic-input-group { position: relative; width: 100%; height: 100%; display: flex; align-items: center; }
        
        .suggestion-box-overlay {
           position: absolute;
           top: 100%;
           right: 0;
           left: 0;
           background: white;
           border: 1px solid #e2e8f0;
           border-radius: 16px;
           box-shadow: 0 15px 40px rgba(0,0,0,0.15);
           z-index: 100;
           margin-top: 8px;
           overflow: hidden;
           pointer-events: auto;
           animation: slideUpIn 0.2s ease-out;
        }
        @keyframes slideUpIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .pad-search-glass {
           background: rgba(255,255,255,0.9);
           backdrop-filter: blur(12px);
           border-radius: 1.5rem;
           padding: 6px 12px;
           border: 1px solid rgba(59, 130, 246, 0.1);
           width: 250px;
           box-shadow: 0 8px 32px rgba(0,0,0,0.08);
           animation: fadeInRight 0.3s ease-out;
        }
        @keyframes fadeInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        
        .pad-search-results {
           position: absolute;
           bottom: 100%;
           left: 0;
           right: 0;
           background: white;
           border-radius: 1.5rem;
           box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
           margin-bottom: 10px;
           max-height: 250px;
           overflow-y: auto;
           z-index: 460;
           border: 1px solid #f1f5f9;
        }
        
        .med-matrix-header {
           display: grid;
           grid-template-columns: 5fr 1.5fr 3.5fr 36px;
           gap: 8px;
           padding: 12px 16px;
           background: rgba(59, 130, 246, 0.08);
           border-radius: 14px;
           margin-bottom: 12px;
           text-align: right;
           font-weight: 900;
           font-size: 11px;
           color: #1e3a8a;
           text-transform: uppercase;
           letter-spacing: 0.05em;
        }
        .auto-height-textarea {
           overflow: hidden;
           resize: none;
           min-height: 40px;
        }
      `}</style>

      {(loading || isProcessingScribe || isProcessingCC) && (
        <div className="fixed inset-0 z-[500] bg-white/40 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-fade-in overflow-hidden">
           <div className="relative w-full max-w-lg aspect-[3/4] lg:aspect-video rounded-3xl border-2 border-blue-400/50 shadow-2xl overflow-hidden bg-gray-900/10">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(59,130,246,1)] z-20 animate-scan-line"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                 <div className="relative"><div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] animate-pulse">{(isProcessingScribe || isProcessingCC) ? <Mic size={48} className="text-white" /> : <Brain size={48} className="text-white" />}</div><div className="absolute -inset-4 border border-blue-400/30 rounded-full animate-ping"></div></div>
                 <div className="text-center space-y-3"><h3 className="text-2xl font-black text-blue-900 tracking-tight">{isProcessingCC ? 'در حال تبدیل گفته‌های شما به متن شکایات...' : isProcessingScribe ? 'در حال واکاوی هوشمند گفته‌های پزشک...' : 'در حال واکاوی اطلاعات توسط هسته هوش مصنوعی...'}</h3><p className="text-blue-600/60 font-bold animate-bounce text-sm">لطفاً شکیبا باشید. در حال پردازش داده‌های پزشکی</p></div>
              </div>
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

      {/* Main View Control */}
      {viewMode === 'landing' ? renderLanding() : (
        <>
          {/* MOBILE EDITOR UI */}
          <div className="lg:hidden flex flex-col gap-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 flex-1 min-w-0"><button onClick={() => setViewMode('landing')} className="p-2 bg-gray-50 rounded-xl text-gray-600 flex-shrink-0"><ArrowLeft size={20}/></button><div className="min-w-0"><h2 className="font-bold text-gray-800 truncate text-sm">{selectedPatient?.name}</h2><p className="text-[10px] text-gray-400 truncate">{selectedPatient?.age} ساله</p></div></div>
                <div className="flex items-center gap-2">
                   <button onClick={isRecordingScribe ? stopScribeRecording : startScribeRecording} disabled={isProcessingScribe || !isOnline} className={`p-2 rounded-xl transition-all ${isRecordingScribe ? 'bg-purple-600 text-white animate-scribe-pulse shadow-lg' : 'bg-purple-50 text-purple-600'}`}>{isRecordingScribe ? <MicOff size={20}/> : <Mic size={20}/>}</button>
                   {isExpressMode && <div className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-200 animate-pulse flex items-center gap-1">Guest</div>}
                   <button onClick={handleAuditSafety} disabled={safetyLoading || items.length === 0} className={`p-2 rounded-xl transition-all ${isOnline ? (safetyLoading ? 'bg-indigo-50 text-indigo-400' : 'bg-indigo-50 text-indigo-600 animate-safety-pulse') : 'bg-gray-100 text-gray-300'}`}>{safetyLoading ? <Loader2 size={20} className="animate-spin" /> : <ShieldAlert size={20} />}</button>
                   <button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="p-2 rounded-xl bg-gray-50 text-gray-600 disabled:opacity-50"><Save size={20} /></button>
                   <button onClick={handleAutoPrint} disabled={items.length === 0} className="p-2 rounded-xl bg-gray-50 text-gray-600 disabled:opacity-50"><Printer size={20} /></button>
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
                      <MobileVitalInput label="BP" icon={Activity} color="text-red-500" value={vitals.bloodPressure} prevValue={previousVitals?.bloodPressure} unit="mmHg" field="bloodPressure" onChange={handleVitalChange} />
                      <MobileVitalInput label="HR" icon={Heart} color="text-rose-500" value={vitals.heartRate} prevValue={previousVitals?.heartRate} unit="bpm" field="heartRate" onChange={handleVitalChange} />
                      <MobileVitalInput label="T" icon={Thermometer} color="text-orange-500" value={vitals.temperature} prevValue={previousVitals?.temperature} unit="°C" field="temperature" onChange={handleVitalChange} />
                      <MobileVitalInput label="O2" icon={Wind} color="text-blue-500" value={vitals.spO2} prevValue={previousVitals?.spO2} unit="%" field="spO2" onChange={handleVitalChange} />
                      <MobileVitalInput label="BS" icon={Droplet} color="text-pink-500" value={vitals.bloodSugar} unit="mg/dL" field="bloodSugar" onChange={handleVitalChange} />
                      <MobileVitalInput label="WT (KG)" icon={Scale} color="text-indigo-500" value={vitals.weight} unit="kg" field="weight" onChange={handleVitalChange} />
                      <MobileVitalInput label="RR" icon={Wind} color="text-cyan-500" value={vitals.respiratoryRate} unit="rpm" field="respiratoryRate" onChange={handleVitalChange} />
                      <MobileVitalInput label="HT" icon={Hash} color="text-gray-500" value={vitals.height} unit="cm" field="height" onChange={handleVitalChange} />
                   </div>
                )}
                {mobileTab === 'rx' && (
                   <div className="space-y-4 animate-fade-in">
                      <div className={`bg-white p-4 rounded-2xl border transition-all duration-500 ${isRecordingScribe ? 'scribe-glow' : 'border-gray-100 shadow-sm'}`}><div className="flex justify-between items-center mb-2"><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm font-bold text-gray-500"><Activity size={16} className="text-purple-500" />تشخیص پزشک</label><div className="flex gap-1"><button onClick={() => setShowComplaintModal(true)} className={`p-1.5 rounded-lg transition-all ${chiefComplaint ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}><ListChecks size={14} /></button><button onClick={() => setShowPreferenceModal(true)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><RotateCw size={14} /></button></div></div>{isRecordingScribe && (<div className="flex gap-1 items-end h-4">{[...Array(6)].map((_, i) => <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>)}</div>)}</div><textarea className={`w-full p-3 bg-gray-50 rounded-xl outline-none text-gray-700 h-20 resize-none focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all ${isRecordingScribe ? 'bg-purple-50/50 italic' : ''}`} placeholder={isRecordingScribe ? "در حال شنیدن تشخیص..." : "تشخیص نهایی را بنویسید..."} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></div>
                      <div className="space-y-3">{items.map((item, idx) => (<div key={idx} className={`bg-white p-4 rounded-2xl border transition-all duration-500 relative group animate-slide-up ${isRecordingScribe ? 'scribe-glow' : 'border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'}`}><button onClick={() => removeItem(idx)} className="absolute top-4 left-4 p-2 bg-red-50 text-red-500 rounded-xl"><Trash size={18} /></button><div className="mb-4 pl-12 relative"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">نام دارو</label><input className="w-full font-bold text-gray-800 text-lg border-b border-gray-100 pb-2 outline-none focus:border-indigo-500 placeholder-gray-300" placeholder="مثال: Tab Amoxicillin 500" value={item.drug} onFocus={() => { setActiveItemIndex(idx); setSuggestionType('drug'); setSearchQuery(item.drug); }} onBlur={() => { setTimeout(() => { setSuggestionType(prev => prev === 'drug' ? null : prev); }, 200); }} onChange={e => updateItem(idx, 'drug', e.target.value)} />{suggestionType === 'drug' && activeItemIndex === idx && getDrugSuggestions().length > 0 && (<div className="absolute bottom-full right-0 left-0 bg-white shadow-2xl rounded-2xl border border-gray-200 z-[9999] overflow-hidden mb-2 animate-slide-up flex flex-col-reverse">{getDrugSuggestions().map(d => (<button key={d.id} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDrug(d.name); }} className="w-full text-right p-3 hover:bg-indigo-50 border-b border-gray-50 last:border-0 flex items-center justify-between transition-colors font-bold text-gray-700"><div className="flex items-center gap-3">{getFormIcon(d.name)}<span>{d.name}</span></div><Zap size={14} className="text-amber-500" /></button>))}</div>)}</div><div className="flex gap-3"><div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 relative"><label className="text-[10px] font-bold text-gray-400 block mb-1">تعداد</label><input className="w-full bg-transparent font-mono text-center font-bold text-gray-700 outline-none placeholder-gray-300" placeholder="N=30" value={item.dosage} onFocus={() => { setActiveItemIndex(idx); setSuggestionType('dosage'); }} onBlur={() => { setTimeout(() => { setSuggestionType(prev => prev === 'dosage' ? null : prev); }, 200); }} onChange={e => updateItem(idx, 'dosage', e.target.value)} />{suggestionType === 'dosage' && activeItemIndex === idx && (<div className="absolute bottom-full right-0 left-0 bg-white/95 backdrop-blur-md shadow-2xl p-2 rounded-t-2xl flex gap-2 overflow-x-auto no-scrollbar border-t border-indigo-100 z-50">{getSmartDosages().map(d => (<button key={d} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDosage(d); }} className="whitespace-nowrap bg-teal-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg">{d}</button>))}</div>)}</div><div className="flex-[2] bg-gray-50 p-2 rounded-xl border border-gray-100 relative"><label className="text-[10px] font-bold text-gray-400 block mb-1">دستور مصرف</label><input className="w-full bg-transparent font-medium text-gray-700 outline-none text-right placeholder-gray-300" placeholder="N=30" value={item.instruction} onFocus={() => { setActiveItemIndex(idx); setSuggestionType('instruction'); }} onBlur={() => { setTimeout(() => { setSuggestionType(prev => prev === 'instruction' ? null : prev); }, 200); }} onChange={e => updateItem(idx, 'instruction', e.target.value)} />{suggestionType === 'instruction' && activeItemIndex === idx && (<div className="absolute bottom-full right-0 left-0 bg-white/95 backdrop-blur-md shadow-2xl p-2 rounded-t-2xl flex gap-2 overflow-x-auto no-scrollbar border-t border-indigo-100 z-50">{getSmartInstructions(item.drug).map(ins => (<button key={ins} onMouseDown={(e) => { e.preventDefault(); selectSuggestedInstruction(ins); }} className="whitespace-nowrap bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg">{ins}</button>))}</div>)}</div></div></div>))}</div>
                    <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-500 font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"><Plus size={20} />افزودن قلم داروی جدید</button>
                 </div>
              )}
              {mobileTab === 'templates' && (
                 <div className="animate-fade-in space-y-3">{templates.length === 0 ? <div className="text-center p-8 text-gray-400 bg-white rounded-2xl border border-gray-100">قالبی یافت نشد</div> : templates.map(t => (<div key={t.id} onClick={() => loadTemplate(t)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-95 transition-transform cursor-pointer"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><LayoutTemplate size={20} /></div><span className="font-bold text-gray-700">{t.name}</span></div><ChevronRight className="text-gray-300" size={20} /></div>))}</div>
              )}
           </div>
           <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe z-30 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden"><button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="p-4 bg-gray-100 text-gray-600 rounded-2xl disabled:opacity-50"><Save size={24} /></button><button onClick={handleAutoPrint} disabled={items.length === 0} className="flex-1 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"><Printer size={20} />{printButtonLabel}</button></div>
        </div>

        {/* DESKTOP EDITOR UI */}
        <div className="hidden lg:block min-h-screen">
           <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100">
             <div className="flex items-center gap-5"><div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner"><Monitor size={32} /></div><div><h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">کنسول نسخه الکترونیک{isExpressMode && <span className="bg-amber-100 text-amber-700 text-xs font-black px-3 py-1 rounded-full border border-amber-200 animate-pulse flex items-center gap-1"><ZapOff size={14} /> حالت موقت</span>}</h2><p className="text-sm text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2"><User size={14} /> {selectedPatient?.name || 'بدون انتخاب'} • {selectedPatient?.age || '--'} ساله ({selectedPatient?.gender === 'male' ? 'آقا' : (selectedPatient?.gender === 'female' ? 'خانم' : '---')})</p></div></div>
             <div className="flex gap-2"><button onClick={() => setShowPreferenceModal(true)} className="px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-all shadow-sm"><RotateCw size={20} /> ترجیحات</button><button onClick={() => setShowTemplatesModal(true)} className="px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-all shadow-sm"><List size={20} /> قالب‌ها</button><button onClick={startCamera} disabled={!isOnline} className="px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 transition-all shadow-sm"><Camera size={20} /> اسکن دوربین</button><button onClick={isRecordingScribe ? stopScribeRecording : startScribeRecording} disabled={isProcessingScribe || !isOnline} className={`px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg transition-all active:scale-95 ${isRecordingScribe ? 'bg-purple-600 text-white animate-scribe-pulse' : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'}`}>{isRecordingScribe ? <MicOff size={20} /> : <Mic size={20} />}{isRecordingScribe ? 'ضبط صوت...' : 'کاتب هوشمند'}</button><button onClick={handleAuditSafety} disabled={safetyLoading || items.length === 0} className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-sm transition-all ${isOnline ? (safetyLoading ? 'bg-indigo-50 text-indigo-400' : 'bg-indigo-50 text-indigo-600 animate-safety-pulse') : 'bg-gray-100 text-gray-300 border border-gray-200 cursor-not-allowed'}`}>{safetyLoading ? <Loader2 size={20} className="animate-spin" /> : <ShieldAlert size={20} />}{safetyLoading ? 'پایش AI...' : 'سپر ایمنی'}</button><button onClick={() => setViewMode('landing')} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-red-500 transition-colors"><ArrowLeft size={24} /></button></div>
           </div>
           <div className="flex gap-6 items-start">
              <div className="w-28 flex flex-col gap-1.5 shrink-0"><div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg flex items-center justify-center mb-0.5"><Activity size={20} /></div><DesktopVitalSidebarItem label="BP" icon={Activity} color="text-red-500" value={vitals.bloodPressure} unit="mmHg" field="bloodPressure" onChange={handleVitalChange} /><DesktopVitalSidebarItem label="HR" icon={Heart} color="text-rose-500" value={vitals.heartRate} unit="bpm" field="heartRate" onChange={handleVitalChange} /><DesktopVitalSidebarItem label="T" icon={Thermometer} color="text-orange-500" value={vitals.temperature} unit="°C" field="temperature" onChange={handleVitalChange} /><DesktopVitalSidebarItem label="RR" icon={Wind} color="text-cyan-500" value={vitals.respiratoryRate} unit="rpm" field="respiratoryRate" onChange={handleVitalChange} /><DesktopVitalSidebarItem label="BS" icon={Droplet} color="text-pink-500" value={vitals.bloodSugar} unit="mg/dL" field="bloodSugar" onChange={handleVitalChange} /><DesktopVitalSidebarItem label="O2" icon={Wind} color="text-blue-500" value={vitals.spO2} unit="%" field="spO2" onChange={handleVitalChange} /><DesktopVitalSidebarItem label="WT" icon={Scale} color="text-slate-500" value={vitals.weight} unit="kg" field="weight" onChange={handleVitalChange} /></div>
              <div className="flex-1 flex flex-col gap-6"><div className={`p-4 rounded-[2rem] border transition-all duration-500 shadow-sm ${isRecordingScribe ? 'bg-purple-50/50 scribe-glow border-purple-200' : 'bg-white border-gray-100'}`}><div className="flex items-center justify-between mb-2 px-4"><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-indigo-800 font-black text-xs uppercase tracking-widest"><Activity size={16} /> <span>تشخیص نهایی پزشک متخصص</span></label><div className="flex gap-2"><button onClick={() => setShowComplaintModal(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${chiefComplaint ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}><ListChecks size={14} />{chiefComplaint ? 'شکایات ثبت شد' : 'ثبت شکایات بیمار'}</button><button onClick={() => setShowPreferenceModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"><RotateCw size={14} />مدیریت ترجیحات</button></div></div>{isRecordingScribe && (<div className="flex gap-1 items-end h-4">{[...Array(10)].map((_, i) => <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }}></div>)}</div>)}</div><input className={`w-full p-4 bg-gray-50/50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl text-xl font-black text-gray-800 outline-none transition-all ${isRecordingScribe ? 'placeholder:italic' : ''}`} placeholder={isRecordingScribe ? "در حال استخراج تشخیص..." : "Working Diagnosis (Differential Diagnosis)..."} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></div><div className={`flex-1 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 min-h-[400px] flex flex-col transition-all duration-500 ${isRecordingScribe ? 'scribe-glow' : ''}`}><table className="w-full text-right border-separate border-spacing-y-4"><thead><tr className="border-b border-gray-50"><th className="pb-4 text-[11px] font-black text-gray-400 uppercase w-10 text-center">#</th><th className="pb-4 text-[11px] font-black text-gray-400 uppercase w-3/5">نام دارو و شکل دارویی (Drug Name, Strength, Form)</th><th className="pb-4 text-[11px] font-black text-gray-400 uppercase w-32 text-center">تعداد (Qty)</th><th className="pb-4 text-[11px] font-black text-gray-400 uppercase">دستور مصرف (Sig)</th><th className="pb-4 w-12"></th></tr></thead><tbody className="divide-y divide-gray-50">{items.map((item, idx) => (
                <tr key={idx} className="group hover:bg-indigo-50/20 transition-all rounded-2xl overflow-hidden">
                  <td className="py-2 text-gray-400 text-sm font-black text-center">{idx + 1}</td>
                  <td className="py-2 px-2 relative">
                    <input 
                      className="w-full p-4 bg-transparent focus:bg-white focus:shadow-lg rounded-2xl outline-none font-black text-gray-800 text-xl transition-all border border-transparent focus:border-indigo-100 placeholder-gray-300" 
                      value={item.drug} 
                      onFocus={() => { setActiveItemIndex(idx); setSuggestionType('drug'); setSearchQuery(item.drug); }} 
                      onBlur={() => { setTimeout(() => { setSuggestionType(prev => prev === 'drug' ? null : prev); }, 200); }} 
                      onChange={e => updateItem(idx, 'drug', e.target.value)} 
                      placeholder="مثال: Tab Amoxicillin 500" 
                    />
                    {suggestionType === 'drug' && activeItemIndex === idx && getDrugSuggestions().length > 0 && (
                      <div className="absolute top-full right-0 left-0 bg-white shadow-2xl rounded-[2rem] border border-gray-100 z-[9999] overflow-hidden mt-2 animate-slide-up">
                        {getDrugSuggestions().map(d => (
                          <button key={d.id} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDrug(d.name); }} className="w-full text-right p-5 hover:bg-indigo-50 border-b border-gray-50 last:border-0 font-bold text-gray-700 flex justify-between items-center transition-colors">
                            <div className="flex items-center gap-4">{getFormIcon(d.name)}<span className="text-lg">{d.name}</span></div>
                            <Zap size={18} className="text-amber-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 relative">
                    <input 
                      className="w-full p-4 bg-transparent focus:bg-white focus:shadow-lg rounded-2xl outline-none font-black text-lg text-indigo-700 transition-all font-mono border border-transparent focus:border-indigo-100 text-center placeholder-gray-200" 
                      value={item.dosage} 
                      onFocus={() => { setActiveItemIndex(idx); setSuggestionType('dosage'); }} 
                      onBlur={() => { setTimeout(() => { setSuggestionType(prev => prev === 'dosage' ? null : prev); }, 200); }} 
                      onChange={e => updateItem(idx, 'dosage', e.target.value)} 
                      placeholder="N=30" 
                    />
                    {suggestionType === 'dosage' && activeItemIndex === idx && (
                      <div className="absolute top-full right-0 left-0 bg-white shadow-2xl rounded-2xl border border-gray-100 z-[9999] overflow-hidden mt-2 p-3 flex flex-col gap-1 animate-slide-up min-w-[120px]">
                        <p className="text-[9px] font-black text-gray-300 uppercase px-2 mb-1">پیشنهادات دوز</p>
                        {getSmartDosages().map(d => (
                          <button key={d} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDosage(d); }} className="text-center p-3 hover:bg-teal-50 rounded-xl text-sm font-black text-teal-700 transition-colors border border-transparent hover:border-teal-100">{d}</button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 relative">
                    <input 
                      className="w-full p-4 bg-transparent focus:bg-white focus:shadow-lg rounded-2xl outline-none font-bold text-lg text-gray-600 text-right transition-all border border-transparent focus:border-indigo-100 placeholder-gray-200" 
                      value={item.instruction} 
                      onFocus={() => { setActiveItemIndex(idx); setSuggestionType('instruction'); }} 
                      onBlur={() => { setTimeout(() => { setSuggestionType(prev => prev === 'instruction' ? null : prev); }, 200); }} 
                      onChange={e => updateItem(idx, 'instruction', e.target.value)} 
                      placeholder="N=30" 
                    />
                    {suggestionType === 'instruction' && activeItemIndex === idx && (
                      <div className="absolute top-full right-0 left-0 bg-white shadow-2xl rounded-2xl border border-gray-100 z-[9999] overflow-hidden mt-2 p-3 flex flex-col gap-1 animate-slide-up min-w-[250px]">
                        <p className="text-[9px] font-black text-gray-300 uppercase px-2 mb-1">پیشنهادات دستور مصرف</p>
                        {getSmartInstructions(item.drug).map(ins => (
                          <button key={ins} onMouseDown={(e) => { e.preventDefault(); selectSuggestedInstruction(ins); }} className="text-right p-3 hover:bg-indigo-50 rounded-xl text-xs font-black text-gray-700 transition-colors border border-transparent hover:border-indigo-100">{ins}</button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-3 rounded-2xl hover:bg-red-50"><Trash size={22} /></button>
                  </td>
                </tr>
              ))}</tbody></table><button onClick={addItem} className="mt-8 text-indigo-600 font-black text-sm flex items-center gap-3 hover:bg-indigo-50 px-8 py-4 rounded-[1.5rem] transition-all border-2 border-dashed border-indigo-100 self-start"><Plus size={24} /> افزودن قلم داروی جدید</button><div className="mt-12 pt-10 border-t border-gray-50 flex justify-end gap-5 pb-10"><button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="px-10 py-5 rounded-[1.5rem] font-black text-lg text-gray-600 bg-gray-100 hover:bg-gray-200 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-sm"><Save size={26} /> ذخیره در قالب‌ها</button><button onClick={handleAutoPrint} disabled={items.length === 0} className="px-16 py-5 rounded-[1.5rem] font-black text-lg text-white bg-indigo-600 shadow-2xl shadow-indigo-200 hover:bg-indigo-700 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"><Printer size={26} />{printButtonLabel}</button></div></div></div>
           </div>
        </div>
        </>
      )}

      {/* SHARED OVERLAYS / MODALS */}
      {showNewPatientModal && (
          <div className="fixed inset-0 z-[100] lg:bg-black/60 lg:backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
             <div className="bg-white w-full lg:max-w-lg h-[100dvh] lg:h-auto lg:rounded-3xl shadow-2xl relative animate-slide-up lg:animate-fade-in flex flex-col">
                <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 lg:rounded-t-3xl"><h3 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2"><div className="bg-teal-100 p-2 rounded-xl text-teal-600"><UserPlus size={24} /></div>ثبت بیمار جدید</h3><button onClick={() => setShowNewPatientModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors"><X size={20} /></button></div>
                <div className="flex-1 overflow-y-auto p-5 lg:p-8 space-y-5">
                   <div><label className="block text-sm font-bold text-gray-600 mb-2">نام و نام خانوادگی</label><div className="relative"><User className="absolute right-3 top-3.5 text-gray-400" size={18} /><input autoFocus className="w-full p-3.5 pr-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-50 transition-all border border-gray-100" placeholder="مثال: علی رضایی" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} /></div></div>
                   <div><label className="block text-sm font-bold text-gray-600 mb-2">شماره تماس</label><div className="relative"><input type="tel" className="w-full p-3.5 pl-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-50 transition-all text-left border border-gray-100 font-mono" placeholder="0912..." value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)} dir="ltr" /><Phone className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
                   <div className="flex gap-4"><div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-2">سن</label><input type="text" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-50 text-center border border-gray-100 font-bold" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} placeholder="" /></div><div className="flex-[1.5]"><label className="block text-sm font-bold text-gray-600 mb-2">جنسیت</label><div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100"><button onClick={() => setNewPatientGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'male' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>آقا</button><button onClick={() => setNewPatientGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'female' ? 'bg-white shadow text-pink-600' : 'text-gray-400'}`}>خانم</button></div></div></div>
                   <div><label className="block text-sm font-bold text-gray-600 mb-2">وزن</label><div className="relative"><input type="text" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-50 text-center border border-gray-100 font-bold" placeholder="" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} /><Scale className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
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
                <div className="flex justify-between items-center mb-8 relative z-10"><div><h3 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Zap className="text-teal-600" /> نسخه سریع</h3><p className="text-xs text-gray-500 font-bold mt-1">نشست موقت - بدون ثبت در بایگانی</p></div><button onClick={() => { setShowQuickEntryModal(false); clearFormStates(); }} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button></div>
                <div className="space-y-5 relative z-10">
                   <div className="space-y-1"><label className="text-xs font-black text-teal-600 mr-1">نام بیمار (اختیاری)</label><input autoFocus className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold shadow-sm" placeholder="" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} /></div>
                   <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs font-black text-teal-600 mr-1">سن</label><input type="text" className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold text-center" placeholder="" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} /></div><div className="space-y-1"><label className="text-xs font-black text-teal-600 mr-1">وزن</label><input type="text" className="w-full p-4 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 font-bold text-center" placeholder="" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} /></div></div>
                   <div className="space-y-1"><label className="text-xs font-black text-teal-600 mr-1">جنسیت</label><div className="flex bg-gray-100/50 p-1.5 rounded-2xl"><button onClick={() => setNewPatientGender('male')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newPatientGender === 'male' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}>آقا</button><button onClick={() => setNewPatientGender('female')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newPatientGender === 'female' ? 'bg-white shadow-md text-pink-600' : 'text-gray-400'}`}>خانم</button></div></div>
                   <button onClick={handleQuickEntry} className="w-full bg-teal-600 text-white py-5 rounded-[1.5rem] font-black shadow-xl shadow-teal-200 mt-4 flex items-center justify-center gap-3 text-lg hover:bg-teal-700 transition-all active:scale-95"><FileSignature size={24} /> شروع نسخه‌نویسی</button>
                </div>
             </div>
          </div>
      )}

      {showPreferenceModal && (
          <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col h-[80vh]">
                  <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><RotateCw size={24} /></div><div><h3 className="text-2xl font-black text-gray-800">مدیریت ترجیحات نسخه‌نویسی</h3><p className="text-xs text-gray-500 font-bold mt-1">شخصی‌سازی دوزها و دستورات مصرف متداول</p></div></div><button onClick={() => setShowPreferenceModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X size={24} /></button></div>
                  <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-10 custom-scrollbar"><div className="space-y-6"><h4 className="font-black text-teal-600 flex items-center gap-2 text-sm uppercase tracking-widest border-b border-teal-100 pb-2"><Hash size={18} /> مقادیر و دوزها (Qty)</h4><div className="flex gap-2"><input className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-100 font-bold text-sm" placeholder="مثلاً N=20" value={newPrefValue} onChange={e => setNewPrefValue(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddPreference('dosage')} /><button onClick={() => handleAddPreference('dosage')} className="bg-teal-600 text-white p-3 rounded-xl shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all"><Plus size={20}/></button></div><div className="space-y-2">{customDosages.length === 0 ? (<p className="text-center text-xs text-gray-400 py-10">موردی ثبت نشده</p>) : (customDosages.map(v => (<div key={v} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 group"><span className="font-black text-gray-700">{v}</span><button onClick={() => handleRemovePreference('dosage', v)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button></div>)))}</div></div><div className="space-y-6"><h4 className="font-black text-indigo-600 flex items-center gap-2 text-sm uppercase tracking-widest border-b border-indigo-100 pb-2"><FileText size={18} /> دستورات مصرف (Sig)</h4><div className="flex gap-2"><input className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-sm" placeholder="مثلاً قبل از خواب" value={newPrefValue} onChange={e => setNewPrefValue(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddPreference('instruction')} /><button onClick={() => handleAddPreference('instruction')} className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"><Plus size={20}/></button></div><div className="space-y-2">{customInstructions.length === 0 ? (<p className="text-center text-xs text-gray-400 py-10">موردی ثبت نشده</p>) : (customInstructions.map(v => (<div key={v} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 group"><span className="font-bold text-gray-700 text-xs">{v}</span><button onClick={() => handleRemovePreference('instruction', v)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button></div>)))}</div></div></div>
                  <div className="p-6 bg-gray-50 border-t border-gray-100 text-center"><button onClick={() => setShowPreferenceModal(false)} className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">تایید و بستن</button></div>
              </div>
          </div>
      )}

      {showComplaintModal && (
          <div className="fixed inset-0 z-[195] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white w-full max-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col relative"><div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><ListChecks size={24} /></div><h3 className="text-2xl font-black text-gray-800">شکایات اصلی بیمار (CC)</h3><div className="relative"><button onClick={() => setShowComplaintTemplateMenu(!showComplaintTemplateMenu)} className={`p-2 rounded-xl transition-all ${showComplaintTemplateMenu ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`} title="قالب‌های شکایات"><LayoutTemplate size={20} /></button>{showComplaintTemplateMenu && (<div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-white shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl border border-gray-100 z-[220] overflow-hidden animate-slide-down"><div className="p-3 bg-indigo-50 border-b border-gray-100 text-[10px] font-black uppercase text-indigo-400 text-center">لیست قالب‌های شکایات</div><div className="max-h-64 overflow-y-auto custom-scrollbar bg-white">{complaintTemplates.length === 0 ? (<div className="p-6 text-center text-xs text-gray-400 font-bold">هنوز قالبی ذخیره نکرده‌اید</div>) : (complaintTemplates.map(t => (<div key={t.id} className="flex items-center justify-between p-4 hover:bg-indigo-50 border-b border-gray-50 last:border-0 group cursor-pointer transition-colors" onClick={() => selectComplaintTemplate(t.text)}><span className="text-xs font-black text-gray-700 truncate flex-1 leading-relaxed">{t.text}</span><button onClick={(e) => { e.stopPropagation(); handleDeleteComplaintTemplate(t.id); }} className="p-2 text-gray-300 hover:text-red-500 transition-all ml-2"><Trash size={16} /></button></div>)))}</div></div>)}</div></div><button onClick={() => { stopCCRecording(); setShowComplaintModal(false); setShowComplaintTemplateMenu(false); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X size={24} /></button></div><div className="p-8 space-y-6"><div className="relative"><textarea autoFocus className="w-full p-6 bg-gray-50 border border-gray-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-100 font-bold text-gray-700 h-64 resize-none leading-relaxed text-lg" placeholder="شکایات و علائم اصلی بیمار را اینجا بنویسید یا دیکته کنید..." value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} /><div className="absolute bottom-4 left-4 flex gap-2"><button onClick={handleSaveComplaintTemplate} disabled={!chiefComplaint.trim()} className="p-4 bg-white text-indigo-600 border border-indigo-100 rounded-2xl shadow-lg hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50" title="ذخیره به عنوان قالب جدید"><BookmarkPlus size={24} /></button><button onClick={isRecordingCC ? stopCCRecording : startCCRecording} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${isRecordingCC ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`} title="دیکته صوتی شکایات">{isProcessingCC ? <Loader2 size={24} className="animate-spin" /> : isRecordingCC ? <MicOff size={24} /> : <Mic size={24} />}</button></div></div><div className="flex gap-4"><button onClick={() => { setChiefComplaint(''); }} className="px-8 py-4 rounded-2xl font-black text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-all">پاک‌سازی</button><button onClick={() => { setShowComplaintModal(false); setShowComplaintTemplateMenu(false); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all text-lg">ثبت و تایید شکایات</button></div></div></div>
          </div>
      )}

      {showTemplatesModal && (
         <div className="fixed inset-0 z-[190] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col h-[70vh]"><div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><LayoutTemplate size={24} /></div><h3 className="text-2xl font-black text-gray-800">قالب‌های نسخه آماده</h3></div><button onClick={() => setShowTemplatesModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X size={24} /></button></div><div className="p-6"><div className="relative mb-4"><Search className="absolute right-4 top-4 text-gray-400" /><input className="w-full p-4 pr-12 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-bold" placeholder="جستجوی عنوان قالب (سرماخوردگی، میگرن...)" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} /></div></div><div className="flex-1 overflow-y-auto px-6 pb-8 space-y-3 custom-scrollbar">{templates.filter(t => t.name.includes(templateSearch)).length === 0 ? (<div className="text-center py-20 text-gray-400 font-bold">قالبی مطابق با جستجوی شما یافت نشد</div>) : (templates.filter(t => t.name.includes(templateSearch)).map(t => (<div key={t.id} className="flex justify-between items-center p-5 bg-white border border-gray-100 rounded-3xl hover:border-indigo-400 hover:shadow-xl transition-all group cursor-pointer" onClick={() => loadTemplate(t)}><div className="flex items-center gap-4"><div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><FileText size={24} /></div><div><p className="font-black text-lg text-gray-800">{t.name}</p><p className="text-xs text-gray-400 font-bold mt-1">{t.items.length} قلم دارو در این قالب</p></div></div><div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash size={20} /></button><div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all"><ChevronRight size={20} /></div></div></div>)))}</div></div>
         </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black/50 text-white absolute top-0 left-0 right-0 z-10"><h3 className="font-bold text-lg flex items-center gap-2"><ScanLine /> اسکن نسخه</h3><button onClick={stopCamera} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><X /></button></div>
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"><video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" /><canvas ref={canvasRef} className="hidden" /></div>
          <div className="bg-black p-6 pb-12 flex justify-center items-center">
            <button 
              onClick={capturePhoto} 
              className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-white border-2 border-black/10"></div>
            </button>
          </div>
        </div>
      )}

      {showMobileRestrictModal && (
         <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 text-center shadow-2xl animate-bounce-in">
               <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MonitorOff size={40} />
               </div>
               <h3 className="text-xl font-black text-gray-800 mb-4 tracking-tight">بهینه‌سازی نمایشگر</h3>
               <p className="text-gray-500 leading-relaxed font-bold text-sm mb-10">
                  پزشک گرامی، قابلیت نگارش دیجیتال و استفاده از قلم، برای دقت بالاتر در نمایشگرهای بزرگ (رایانه یا تبلت) بهینه‌سازی شده است. لطفاً از نسخه دسکتاپ استفاده فرمایید.
               </p>
               <button onClick={() => setShowMobileRestrictModal(false)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100">متوجه شدم</button>
            </div>
         </div>
      )}

      {showDigitalPad && (
        <div className="fixed inset-0 z-[420] bg-gray-950 flex flex-col overflow-hidden animate-fade-in"
             onMouseMove={handleToolbarMove} onTouchMove={handleToolbarMove}
             onMouseUp={handleToolbarEnd} onTouchEnd={handleToolbarEnd}>
           
           <div 
              style={{ 
                left: padToolbarPos.x,
                top: padToolbarPos.y,
                transform: `rotate(${padRotation}deg)`,
                zIndex: 450
              }}
              className={`fixed satellite-bar p-1.5 lg:p-2 flex items-center gap-1.5 lg:gap-3 touch-none shadow-[0_0_50px_rgba(0,0,0,0.3)] ${padRotation % 180 === 90 ? 'flex-row' : 'flex-col'}`}
           >
              <div onMouseDown={handleToolbarStart} onTouchStart={handleToolbarStart} className="p-1 lg:p-2 text-gray-300 cursor-move hover:text-indigo-400">
                 <GripVertical size={20} />
              </div>
              
              <button onPointerDown={(e) => { e.stopPropagation(); setShowDigitalPad(false); }} className="p-2 lg:p-3 text-gray-400 hover:text-red-500 bg-gray-50 rounded-2xl transition-all">
                <X size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
              </button>

              <div className={`${padRotation % 180 === 90 ? 'w-[1px] h-6' : 'w-6 h-[1px]'} bg-gray-200`}></div>

              <div className={`flex gap-1.5 p-1 bg-gray-50 rounded-2xl shadow-inner relative ${padRotation % 180 === 90 ? 'flex-row' : 'flex-col'}`}>
                 <button onPointerDown={(e) => { e.stopPropagation(); setShowPadSearch(!showPadSearch); }} className={`p-2 lg:p-3 rounded-xl transition-all ${showPadSearch ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400'}`}>
                    <Search size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
                 
                 {showPadSearch && (
                    <div className="absolute left-0 top-full mt-3 flex flex-col gap-2 pointer-events-auto">
                        {padSearchTerm && padFilteredPatients.length > 0 && (
                            <div className="pad-search-results">
                                {padFilteredPatients.map(p => (
                                    <button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full p-4 text-right hover:bg-indigo-50 border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">{p.displayId}</div>
                                            <span className="font-bold text-sm text-gray-700">{p.name}</span>
                                        </div>
                                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-400">#{p.displayId}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="pad-search-glass">
                            <input 
                                autoFocus
                                className="w-full bg-transparent outline-none font-bold text-gray-700 text-sm placeholder-indigo-300"
                                placeholder="نام یا کد (001)..."
                                value={padSearchTerm}
                                onChange={e => setPadSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                 )}

                 <button onPointerDown={(e) => { e.stopPropagation(); setIsNewPatientPadMode(!isNewPatientPadMode); if(!isNewPatientPadMode) resetPadForNewPatient(); }} className={`p-2 lg:p-3 rounded-xl transition-all ${isNewPatientPadMode ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'}`}>
                    <UserPlus size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
              </div>

              <div className={`${padRotation % 180 === 90 ? 'w-[1px] h-6' : 'w-6 h-[1px]'} bg-gray-200`}></div>

              <div className={`flex gap-1 ${padRotation % 180 === 90 ? 'flex-row' : 'flex-col'}`}>
                 <button onPointerDown={(e) => { e.stopPropagation(); undoPad(); }} disabled={padHistory.length <= 1} className="p-2 lg:p-3 text-gray-500 hover:text-indigo-600 disabled:opacity-20 transition-all">
                    <RotateCcw size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
                 <button onPointerDown={(e) => { e.stopPropagation(); clearPad(); }} className="p-2 lg:p-3 text-red-400 hover:text-red-600 transition-all">
                    <Trash size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
              </div>

              <div className={`${padRotation % 180 === 90 ? 'w-[1px] h-6' : 'w-6 h-[1px]'} bg-gray-200`}></div>

              <div className={`flex gap-1.5 p-1 bg-gray-50 rounded-2xl shadow-inner ${padRotation % 180 === 90 ? 'flex-row' : 'flex-col'}`}>
                 <button onPointerDown={(e) => { e.stopPropagation(); setPadTool(prev => prev === 'pen' ? 'idle' : 'pen'); triggerSettingsDisplay(); }} className={`p-2 lg:p-3 rounded-xl transition-all ${padTool === 'pen' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>
                    <PenTool size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
                 <button onPointerDown={(e) => { e.stopPropagation(); setPadTool(prev => prev === 'eraser' ? 'idle' : 'eraser'); triggerSettingsDisplay(); }} className={`p-2 lg:p-3 rounded-xl transition-all ${padTool === 'eraser' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}>
                    <Eraser size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
                 <button onPointerDown={(e) => { e.stopPropagation(); setPadTool(prev => prev === 'type' ? 'idle' : 'type'); triggerSettingsDisplay(); }} className={`p-2 lg:p-3 rounded-xl transition-all ${padTool === 'type' ? 'tool-active-glow' : 'text-gray-400'}`}>
                    <Type size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                 </button>
                 {padTool === 'type' && (
                    <button onPointerDown={(e) => { e.stopPropagation(); handleAutoPrint(); }} className="p-2 lg:p-3 rounded-xl transition-all bg-indigo-600 text-white shadow-lg animate-pulse-subtle">
                       <Printer size={18} style={{ transform: `rotate(${-padRotation}deg)` }} />
                    </button>
                 )}
              </div>

              <div className={`${padRotation % 180 === 90 ? 'w-[1px] h-6' : 'w-6 h-[1px]'} bg-gray-200`}></div>

              <div className={`flex gap-1 ${padRotation % 180 === 90 ? 'flex-row' : 'flex-col'}`}>
                 <button onPointerDown={(e) => { e.stopPropagation(); setPadRotation(r => (r + 90) % 360); }} className="p-2 lg:p-3 text-gray-500 hover:text-indigo-600 transition-all">
                    <RotateCw size={18} />
                 </button>
                 <button onPointerDown={(e) => { e.stopPropagation(); setPadZoom(z => Math.max(0.2, z - 0.1)); }} className="p-2 lg:p-3 text-gray-500 hover:text-indigo-600 transition-all">
                    <ZoomOut size={18} />
                 </button>
                 <button onPointerDown={(e) => { e.stopPropagation(); setPadZoom(z => Math.min(5, z + 0.1)); }} className="p-2 lg:p-3 text-gray-500 hover:text-indigo-600 transition-all">
                    <ZoomIn size={18} />
                 </button>
              </div>

              <div className={`${padRotation % 180 === 90 ? 'w-[1px] h-6' : 'w-6 h-[1px]'} bg-gray-200`}></div>

              <button onPointerDown={(e) => { e.stopPropagation(); analyzePad(); }} className="ai-small-btn group">
                 <Zap size={22} className="group-hover:animate-pulse" />
              </button>

              {showPadSettings && (padTool === 'pen' || padTool === 'eraser') && (
                 <div className={`absolute ${padRotation % 180 === 90 ? 'top-full left-1/2 -translate-x-1/2 mt-3' : 'left-full top-1/2 -translate-y-1/2 ml-3'} animate-slide-up z-[460]`}>
                    <div className="temporal-settings p-4 flex items-center gap-6 border border-gray-100 shadow-2xl">
                       <div className="flex items-center gap-3">
                          <Maximize size={16} className="text-gray-400" />
                          <input type="range" min="1" max="100" step="1" className="w-32 lg:w-48 accent-indigo-600" value={padThickness} onChange={e => { 
                            const val = parseInt(e.target.value);
                            if (padTool === 'pen') setPadPenThickness(val);
                            else if (padTool === 'eraser') setPadEraserThickness(val);
                            triggerSettingsDisplay(); 
                          }} />
                          <span className="text-xs font-black text-indigo-600 w-6">{padThickness}</span>
                       </div>
                       {padTool === 'pen' && (
                          <div className="flex gap-2">
                             <button onPointerDown={(e) => { e.stopPropagation(); setPadColor('#1e3a8a'); triggerSettingsDisplay(); }} className={`w-8 h-8 rounded-full border-4 ${padColor === '#1e3a8a' ? 'border-indigo-300' : 'border-transparent'} bg-blue-900 shadow-sm transition-all`}></button>
                             <button onPointerDown={(e) => { e.stopPropagation(); setPadColor('#000000'); triggerSettingsDisplay(); }} className={`w-8 h-8 rounded-full border-4 ${padColor === '#000000' ? 'border-gray-300' : 'border-transparent'} bg-black shadow-sm transition-all`}></button>
                          </div>
                       )}
                    </div>
                 </div>
              )}
           </div>

           <div className="flex-1 relative bg-[#0f172a] overflow-auto flex items-center justify-center p-6 lg:p-20 custom-scrollbar z-10">
              <div 
                style={{ 
                  transform: `rotate(${padRotation}deg) scale(${padZoom})`, 
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', 
                  boxShadow: '0 40px 120px rgba(0,0,0,0.5)', 
                  width: `${paperDims.w}px`,
                  height: `${paperDims.h}px`
                }} 
                className="bg-white rounded-lg overflow-hidden relative cursor-crosshair shrink-0"
              >
                 <canvas ref={padBgCanvasRef} width={paperDims.w} height={paperDims.h} className="absolute inset-0 z-0 pointer-events-none" />
                 <canvas 
                   ref={padInkCanvasRef} 
                   width={paperDims.w} 
                   height={paperDims.h}
                   onMouseDown={handlePadStart} 
                   onMouseMove={handlePadMove} 
                   onMouseUp={handlePadEnd} 
                   onMouseLeave={handlePadEnd} 
                   onTouchStart={handlePadStart} 
                   onTouchMove={handlePadMove} 
                   onTouchEnd={handlePadEnd} 
                   className="relative z-10 digital-pad-canvas" 
                 />
                 
                 {/* TYPE-ON-RX OVERLAY - SYNCED TO DIMENSIONS */}
                 {padTool === 'type' && (
                    <div className="rx-typing-overlay" style={{ width: `${paperDims.w}px`, height: `${paperDims.h}px` }}>
                       {settings.elements.filter(el => el.visible).map(el => {
                          if (el.id === 'patientId') return null; // ID is system managed

                          let content = null;
                          const isPatientField = el.id === 'patientName' || el.id === 'age' || el.id === 'vital_weight';
                          
                          // Balanced Expansion Logic (25% on each side)
                          const isItems = el.id === 'items';
                          const displayWidth = isItems ? el.width * 1.5 : el.width;
                          const displayX = isItems ? el.x - (el.width * 0.25) : el.x;

                          const baseStyle: React.CSSProperties = {
                             position: 'absolute',
                             left: `${displayX}px`,
                             top: `${el.y}px`,
                             width: `${displayWidth}px`,
                             fontSize: `${el.fontSize}pt`,
                             transform: `rotate(${el.rotation}deg)`,
                             textAlign: el.align || 'right',
                             zIndex: activeTypingFieldId?.includes(el.id) ? 30 : 25,
                             fontFamily: settings.fontFamily,
                             direction: 'rtl'
                          };

                          if (isItems) {
                             content = (
                                <div style={{ width: `${displayWidth}px` }} className="space-y-1 pointer-events-auto bg-white/70 backdrop-blur-xl p-5 rounded-[2.5rem] border-2 border-dashed border-indigo-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-visible animate-slide-up">
                                   <div className="flex justify-between items-center mb-4 px-2">
                                      <span className="text-[12px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2"><Pill size={16}/> لیست اقلام دارویی</span>
                                      <button onClick={addItem} className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:rotate-90 transition-all active:scale-90"><Plus size={18}/></button>
                                   </div>
                                   
                                   {/* Pro Matrix Header (Farsi Only) */}
                                   <div className="med-matrix-header">
                                      <div>نام و شکل دارو</div>
                                      <div className="text-center">تعداد</div>
                                      <div className="text-center">دستور مصرف</div>
                                      <div></div>
                                   </div>

                                   <div className="space-y-2">
                                      {items.map((item, idx) => (
                                         <div key={idx} className="rx-item-row group relative overflow-visible bg-white/50 border border-transparent hover:border-indigo-100 hover:bg-white transition-all shadow-sm">
                                            <div className="flex-[5] relative overflow-visible">
                                               <input 
                                                   className="rx-item-input rx-field-input-med w-full px-2" 
                                                   placeholder="نام دارو..." 
                                                   value={item.drug} 
                                                   onChange={e => updateItem(idx, 'drug', e.target.value)} 
                                                   onFocus={() => { setActiveItemIndex(idx); setSuggestionType('drug'); setSearchQuery(item.drug); setActiveTypingFieldId(`item_drug_${idx}`); }}
                                                   onBlur={() => { setTimeout(() => { if (activeTypingFieldId === `item_drug_${idx}`) { setSuggestionType(null); setActiveTypingFieldId(null); } }, 200); }}
                                               />
                                               {suggestionType === 'drug' && activeItemIndex === idx && getDrugSuggestions().length > 0 && (
                                                   <div className="suggestion-box-overlay">
                                                       {getDrugSuggestions().map(d => (
                                                           <button key={d.id} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDrug(d.name); }} className="w-full text-right p-3 hover:bg-indigo-50 border-b border-gray-50 last:border-0 flex items-center gap-3 transition-colors">
                                                               {getFormIcon(d.name)}
                                                               <span className="text-sm font-black text-gray-700 truncate">{d.name}</span>
                                                           </button>
                                                       ))}
                                                   </div>
                                               )}
                                            </div>
                                            <div className="flex-[1.5] relative overflow-visible">
                                               <input 
                                                   className="rx-item-input rx-field-input-med w-full font-mono text-center text-indigo-700" 
                                                   placeholder="N=30" 
                                                   value={item.dosage} 
                                                   onChange={e => updateItem(idx, 'dosage', e.target.value)} 
                                                   onFocus={() => { setActiveItemIndex(idx); setSuggestionType('dosage'); setActiveTypingFieldId(`item_dosage_${idx}`); }}
                                                   onBlur={() => { setTimeout(() => { if (activeTypingFieldId === `item_dosage_${idx}`) { setSuggestionType(null); setActiveTypingFieldId(null); } }, 200); }}
                                               />
                                               {suggestionType === 'dosage' && activeItemIndex === idx && (
                                                   <div className="suggestion-box-overlay p-2 flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar min-w-[120px]">
                                                       <p className="text-[9px] font-black text-gray-400 mr-2 mb-1 uppercase">پیشنهاد تعداد</p>
                                                       {getSmartDosages().map(d => (
                                                           <button key={d} onMouseDown={(e) => { e.preventDefault(); selectSuggestedDosage(d); }} className="text-center p-3 hover:bg-indigo-50 rounded-xl text-[11px] font-black text-teal-700 border border-gray-50 transition-colors active:scale-95">{d}</button>
                                                       ))}
                                                   </div>
                                               )}
                                            </div>
                                            <div className="flex-[3.5] relative overflow-visible">
                                               <input 
                                                   className="rx-item-input rx-field-input-med w-full text-gray-500 font-bold text-center" 
                                                   placeholder="N=30" 
                                                   value={item.instruction} 
                                                   onChange={e => updateItem(idx, 'instruction', e.target.value)} 
                                                   onFocus={() => { setActiveItemIndex(idx); setSuggestionType('instruction'); setActiveTypingFieldId(`item_instruction_${idx}`); }}
                                                   onBlur={() => { setTimeout(() => { if (activeTypingFieldId === `item_instruction_${idx}`) { setSuggestionType(null); setActiveTypingFieldId(null); } }, 200); }}
                                               />
                                               {suggestionType === 'instruction' && activeItemIndex === idx && (
                                                   <div className="suggestion-box-overlay p-2 flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar">
                                                       <p className="text-[9px] font-black text-gray-400 mr-2 mb-1 uppercase">پیشنهاد مصرف</p>
                                                       {getSmartInstructions(item.drug).map(ins => (
                                                           <button key={ins} onMouseDown={(e) => { e.preventDefault(); selectSuggestedInstruction(ins); }} className="text-right p-3 hover:bg-indigo-50 rounded-xl text-[11px] font-black text-gray-600 border border-gray-50 transition-colors">{ins}</button>
                                                       ))}
                                                   </div>
                                               )}
                                            </div>
                                            <button onClick={() => removeItem(idx)} className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash size={18}/></button>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             );
                          } else {
                             let val = "";
                             let updateFn = (v: string) => {};
                             let placeholderText = getCleanLabel(el.id, el.label);

                             switch(el.id) {
                                case 'patientName': 
                                    val = selectedPatient?.name || ""; 
                                    updateFn = (v) => setSelectedPatient(prev => ({ ...(prev || {} as PatientRecord), name: v }));
                                    break;
                                case 'age': 
                                    val = selectedPatient?.age || ""; 
                                    updateFn = (v) => setSelectedPatient(prev => ({ ...(prev || {} as PatientRecord), age: v }));
                                    break;
                                case 'diagnosis': val = diagnosis; updateFn = setDiagnosis; break;
                                case 'chiefComplaint': val = chiefComplaint; updateFn = setChiefComplaint; break;
                                case 'vital_bp': val = vitals.bloodPressure; updateFn = (v) => handleVitalChange('bloodPressure', v); break;
                                case 'vital_hr': val = vitals.heartRate; updateFn = (v) => handleVitalChange('heartRate', v); break;
                                case 'vital_rr': val = vitals.respiratoryRate; updateFn = (v) => handleVitalChange('respiratoryRate', v); break;
                                case 'vital_temp': val = vitals.temperature; updateFn = (v) => handleVitalChange('temperature', v); break;
                                case 'vital_weight': val = vitals.weight; updateFn = (v) => handleVitalChange('weight', v); break;
                                case 'vital_o2': val = vitals.spO2; updateFn = (v) => handleVitalChange('spO2', v); break;
                                case 'vital_bs': val = vitals.bloodSugar; updateFn = (v) => handleVitalChange('bloodSugar', v); break;
                                case 'date': val = new Date().toLocaleDateString('fa-IR'); break;
                             }

                             const isCC = el.id === 'chiefComplaint';
                             
                             content = (
                                <div className="majestic-input-group">
                                   {isCC ? (
                                      <textarea 
                                         className={`rx-field-input w-full auto-height-textarea ${activeTypingFieldId === el.id ? 'active' : ''}`}
                                         value={val}
                                         onChange={e => {
                                            updateFn(e.target.value);
                                            e.target.style.height = 'inherit';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                         }}
                                         onFocus={(e) => {
                                            setActiveTypingFieldId(el.id);
                                            e.target.style.height = 'inherit';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                         }}
                                         onBlur={() => setActiveTypingFieldId(null)}
                                         placeholder=" "
                                         style={{ textAlign: el.align as any, fontSize: `${el.fontSize}pt`, fontWeight: 900 }}
                                      />
                                   ) : (
                                      <input 
                                         className={`rx-field-input w-full ${activeTypingFieldId === el.id ? 'active' : ''} ${isPatientField ? 'rx-field-input-patient' : ''}`}
                                         value={val}
                                         onChange={e => updateFn(e.target.value)}
                                         onFocus={() => setActiveTypingFieldId(el.id)}
                                         onBlur={() => setActiveTypingFieldId(null)}
                                         placeholder=" "
                                         style={{ textAlign: el.align as any, fontSize: isPatientField ? `${el.fontSize * 1.2}pt` : `${el.fontSize}pt`, fontWeight: 900 }}
                                      />
                                   )}
                                   <span className="rx-field-placeholder absolute inset-0 flex items-center pointer-events-none" style={{ justifyContent: el.align === 'center' ? 'center' : (el.align === 'left' ? 'flex-start' : 'flex-end'), padding: '0 12px' }}>
                                      {placeholderText}
                                   </span>
                                </div>
                             );
                          }

                          return (
                             <div key={el.id} style={baseStyle}>
                                {content}
                             </div>
                          );
                       })}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {showSaveModal && (<div className="fixed inset-0 bg-black/50 z-[160] backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[2rem] p-8 w-full max-sm shadow-2xl animate-fade-in"><h3 className="font-black text-xl text-gray-800 mb-6 flex items-center gap-2"><LayoutTemplate className="text-indigo-600" />ذخیره به عنوان قالب</h3><input autoFocus className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-6 outline-none focus:ring-4 focus:ring-indigo-100 font-bold" placeholder="نام قالب (مثال: سرماخوردگی)" value={templateName} onChange={e => setTemplateName(e.target.value)} /><div className="flex justify-end gap-3"><button onClick={() => setShowSaveModal(false)} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-800 transition-colors">لغو</button><button onClick={handleSaveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100">ذخیره نسخه</button></div></div></div>)}
    </div>
  );
};

export default Prescription;
