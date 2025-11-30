
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { performDiagnosis, checkPrescriptionSafety, performDeepReview, performClinicalSupervision } from '../services/geminiService';
import { DiagnosisResult, Vitals, SafetyCheckResult, PrescriptionTemplate, Prescription, SupervisorResult, Visit } from '../types';
import { Loader, Upload, BrainCircuit, ChevronLeft, RotateCcw, BookOpen, Pill, Save, AlertOctagon, Mic, MicOff, Activity, Scale, Thermometer, Heart, Wind, FileText, Printer, ShieldCheck, X, GripHorizontal, AlertTriangle, Link2, ExternalLink, Clock, PenTool, ChevronDown, ChevronUp, Copy, LayoutTemplate, CheckCircle, Stethoscope, Plus, Search, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Maximize, MonitorPlay, MessageSquareWarning, ArrowDownCircle, Lightbulb, Leaf, Coffee, Ban, Utensils, Sunrise, Sun, Moon, ShieldAlert, Award, AlertCircle, Droplets, Radio, TestTube, PauseCircle, Play, User, FileSearch, ScanLine, FileType } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type RxFieldFocus = { type: 'med'; index: number; field: 'name' | 'dosage' | 'instructions' } | { type: 'notes' } | { type: 'templateName' } | null;
type NoteTab = 'notes' | 'diagnosis';

export const Diagnosis: React.FC = () => {
  const { patients, library, saveCompleteVisit, prescriptions, prescriptionTemplates, doctorProfile, isLoading, requestConsult, createLabRequest, activeVisits, fetchActiveVisits, holdVisitForLab, extractAndSaveClinicalData } = useStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [consultLoading, setConsultLoading] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Workflow State
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  
  // New Lab Request Modal State
  const [showLabModal, setShowLabModal] = useState(false);
  const [labTestName, setLabTestName] = useState('');
  const [labPrice, setLabPrice] = useState(500);
  const [showExternalLabPrint, setShowExternalLabPrint] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [savedRxId, setSavedRxId] = useState<string | null>(null);
  const [reprintRx, setReprintRx] = useState<Prescription | null>(null); 
  
  // Deep Review State
  const [isDeepReviewing, setIsDeepReviewing] = useState(false);
  const [showDeepReviewInput, setShowDeepReviewInput] = useState(false);
  const [doctorFeedback, setDoctorFeedback] = useState('');

  // Clinical Supervisor State
  const [isSupervising, setIsSupervising] = useState(false);
  const [supervisorResult, setSupervisorResult] = useState<SupervisorResult | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  
  // Document Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDataPreview, setExtractedDataPreview] = useState('');
  const docInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [showSources, setShowSources] = useState(false);
  const [printScale, setPrintScale] = useState(0.5); 
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
  const recognitionRef = useRef<any>(null);

  const [rxIsRecording, setRxIsRecording] = useState(false);
  const [rxDictationLang, setRxDictationLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
  const rxRecognitionRef = useRef<any>(null);
  const [activeRxField, setActiveRxField] = useState<RxFieldFocus>(null);
  const [activeNoteTab, setActiveNoteTab] = useState<NoteTab>('notes');
  const activeRxFieldRef = useRef<RxFieldFocus>(null);
  const activeNoteTabRef = useRef<NoteTab>('notes');

  // Filter Active Visits for Waiting Room
  const waitingPatients = activeVisits.filter(v => v.status === 'waiting' || v.status === 'lab_ready');

  useEffect(() => { activeRxFieldRef.current = activeRxField; }, [activeRxField]);
  useEffect(() => { activeNoteTabRef.current = activeNoteTab; }, [activeNoteTab]);
  useEffect(() => {
    fetchActiveVisits(); // Ensure latest data
    if (selectedPatientId) {
        const p = patients.find(p => p.id === selectedPatientId);
        if (p) setPatientSearch(p.fullName);
    }
  }, [selectedPatientId, patients]);
  
  useEffect(() => {
      if (showPrintPreview) { fitToScreen(); window.addEventListener('resize', fitToScreen); }
      return () => window.removeEventListener('resize', fitToScreen);
  }, [showPrintPreview]);
  
  const fitToScreen = () => {
      if (previewContainerRef.current) {
          const containerHeight = window.innerHeight - 100; 
          const paperHeightPx = 1122; 
          const scale = Math.min(1, (containerHeight / paperHeightPx) - 0.05); 
          setPrintScale(scale);
      }
  };

  const [vitals, setVitals] = useState<Vitals>({ bloodPressure: '120/80', heartRate: '72', temperature: '37.0', oxygenLevel: '98', weight: '70', glucose: '100' });
  const [sliderValues, setSliderValues] = useState({ sys: 120, dia: 80, hr: 72, temp: 37.0, o2: 98, weight: 70, glucose: 100 });
  const [vitalsEnabled, setVitalsEnabled] = useState({ bp: true, hr: true, temp: true, o2: true, weight: true, glucose: true });
  const [labImageFiles, setLabImageFiles] = useState<File[]>([]);
  const [labImagesBase64, setLabImagesBase64] = useState<{name: string, data: string}[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [useWeb, setUseWeb] = useState(true);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [medications, setMedications] = useState([{ name: '', dosage: '', instructions: '' }]);
  const [rxNotes, setRxNotes] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setVitals({
      bloodPressure: vitalsEnabled.bp ? `${sliderValues.sys}/${sliderValues.dia}` : '',
      heartRate: vitalsEnabled.hr ? `${sliderValues.hr}` : '',
      temperature: vitalsEnabled.temp ? `${sliderValues.temp.toFixed(1)}` : '',
      oxygenLevel: vitalsEnabled.o2 ? `${sliderValues.o2}` : '',
      weight: vitalsEnabled.weight ? `${sliderValues.weight}` : '',
      glucose: vitalsEnabled.glucose ? `${sliderValues.glucose}` : ''
    });
  }, [sliderValues, vitalsEnabled]);

  const selectPatientFromQueue = (visit: Visit) => {
      setSelectedPatientId(visit.patientId);
      setCurrentVisitId(visit.id);
      if (visit.symptoms) setSymptoms(visit.symptoms);
      setStep(2);
  };

  const toggleRecording = () => { if(isRecording) stopRecording(); else startRecording(); };
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = dictationLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) if (event.results[i].isFinal) final += event.results[i][0].transcript;
      if (final) setSymptoms(p => p + (p ? ' ' : '') + final);
    };
    recognition.onend = () => isRecording && setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };
  const stopRecording = () => { if(recognitionRef.current) recognitionRef.current.stop(); setIsRecording(false); };

  const toggleRxRecording = () => { if(rxIsRecording) stopRxRecording(); else startRxRecording(); };
  const startRxRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = rxDictationLang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) if (event.results[i].isFinal) final += event.results[i][0].transcript;
      const transcript = final.trim();
      if(!transcript) return;
      const f = activeRxFieldRef.current;
      const t = activeNoteTabRef.current;
      if(f){
        if(f.type === 'notes') {
            if(t==='notes') setRxNotes(p => (p?p+' ':'')+transcript);
            else setFinalDiagnosis(p => (p?p+' ':'')+transcript);
        } else if(f.type === 'med') {
            setMedications(p => { const n = [...p]; if(n[f.index]) n[f.index][f.field]=transcript; return n; });
        }
      }
    };
    recognition.onend = () => setRxIsRecording(false);
    rxRecognitionRef.current = recognition;
    recognition.start();
    setRxIsRecording(true);
  };
  const stopRxRecording = () => { if(rxRecognitionRef.current) rxRecognitionRef.current.stop(); setRxIsRecording(false); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const newFiles = Array.from(files);
        setLabImageFiles(prev => [...prev, ...newFiles]);
        newFiles.forEach((file: File) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).replace('data:', '').replace(/^.+,/, '');
              setLabImagesBase64(prev => [...prev, { name: file.name, data: base64String }]);
            };
            reader.readAsDataURL(file);
        });
      }
  };
  const removeImage = (index: number) => {
      setLabImageFiles(prev => prev.filter((_, i) => i !== index));
      setLabImagesBase64(prev => prev.filter((_, i) => i !== index));
  };

  const handleDocumentExtraction = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentVisitId) return;
      setIsExtracting(true);
      try {
          // Send to AI for extraction
          const extractedText = await extractAndSaveClinicalData(currentVisitId, file);
          setExtractedDataPreview(extractedText);
          alert("متن سند با موفقیت استخراج و به پرونده اضافه شد.");
      } catch (e: any) {
          alert("خطا در پردازش سند: " + e.message);
      } finally {
          setIsExtracting(false);
      }
  };

  const runDiagnosis = async () => {
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!patient) return;
      setLoading(true);
      setIsManualMode(false);
      setShowDeepReviewInput(false); 
      setDoctorFeedback('');
      setSupervisorResult(null); 
  
      try {
        const selectedBooks = library.filter(b => selectedBookIds.includes(b.id));
        const pastPrescriptions = prescriptions.filter(rx => rx.patientId === selectedPatientId).reverse();
        
        const diagnosisResult = await performDiagnosis({
          patient, symptoms, vitals, labImagesBase64: labImagesBase64.map(img => img.data),
          selectedBooks, useWebSearch: useWeb, pastPrescriptions,
          extractedClinicalData: extractedDataPreview
        });
        setResult(diagnosisResult as DiagnosisResult);
        if (diagnosisResult.suggestedMedications && diagnosisResult.suggestedMedications.length > 0) {
            setMedications(diagnosisResult.suggestedMedications.map((m: any) => ({ name: m.name, dosage: m.dosage, instructions: '' })));
        } else {
            setMedications([{ name: '', dosage: '', instructions: '' }]);
        }
        setFinalDiagnosis(diagnosisResult.diagnosis || '');
        setShowSources(false); 
        setStep(3);
      } catch (error: any) {
        console.error(error);
        alert(`خطا در ارتباط با دستیار هوشمند:\n${error.message || error.toString()}`);
      } finally {
        setLoading(false);
      }
  };

  const handleRequestConsult = async () => {
      if (!selectedPatientId || !symptoms) { alert("لطفاً بیمار و شرح حال را تکمیل کنید."); return; }
      setConsultLoading(true);
      try {
          await requestConsult(selectedPatientId, symptoms, vitals, result);
          alert("درخواست مشاوره به اتاق تشخیص ارسال شد.");
          setStep(1); setSelectedPatientId(''); setPatientSearch(''); setSymptoms('');
      } catch (e: any) { alert("خطا در ارسال درخواست: " + e.message); } finally { setConsultLoading(false); }
  };

  const handleHoldForLab = async () => {
      if (!currentVisitId) return;
      await holdVisitForLab(currentVisitId);
      alert("پرونده موقتاً بسته شد و بیمار در وضعیت 'منتظر جواب آزمایش' قرار گرفت.");
      setStep(1); setSelectedPatientId(''); setPatientSearch(''); setSymptoms(''); setCurrentVisitId(null);
  };

  const runSupervision = async () => {
      if (!result || !selectedPatientId) return;
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!patient) return;
      setIsSupervising(true);
      try {
          const selectedBooks = library.filter(b => selectedBookIds.includes(b.id));
          const pastPrescriptions = prescriptions.filter(rx => rx.patientId === selectedPatientId).reverse();
          const supervisionResult = await performClinicalSupervision(
            { patient, symptoms, vitals, labImagesBase64: labImagesBase64.map(img => img.data), selectedBooks, useWebSearch: useWeb, pastPrescriptions },
            result
          );
          setSupervisorResult(supervisionResult);
          setShowSupervisorModal(true);
      } catch (error: any) { alert("خطا در ارتباط با ناظر هوشمند: " + error.message); } finally { setIsSupervising(false); }
  };

  const runDeepReview = async () => {
      if (!result || !selectedPatientId) return;
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!patient) return;
      setIsDeepReviewing(true);
      setShowDeepReviewInput(false); 
      try {
          const selectedBooks = library.filter(b => selectedBookIds.includes(b.id));
          const pastPrescriptions = prescriptions.filter(rx => rx.patientId === selectedPatientId).reverse();
          const reviewResult = await performDeepReview(
              { patient, symptoms, vitals, labImagesBase64: labImagesBase64.map(img => img.data), selectedBooks, useWebSearch: useWeb, pastPrescriptions },
              result.diagnosis, doctorFeedback
          );
          setResult(reviewResult);
          setSupervisorResult(null); 
          if (reviewResult.suggestedMedications && reviewResult.suggestedMedications.length > 0) {
              setMedications(reviewResult.suggestedMedications.map((m: any) => ({ name: m.name, dosage: m.dosage, instructions: '' })));
          }
          setFinalDiagnosis(reviewResult.diagnosis || '');
          setShowSources(false); 
      } catch (error: any) { alert("خطا در بازبینی عمیق: " + error.message); setShowDeepReviewInput(true); } finally { setIsDeepReviewing(false); }
  };

  const checkSafety = async () => {
      const patient = patients.find(p => p.id === selectedPatientId);
      const validMeds = medications.filter(m => m.name.trim() !== '');
      if (!patient || validMeds.length === 0) { alert("لطفا دارو وارد کنید."); return; }
      setCheckingSafety(true);
      try {
          const result = await checkPrescriptionSafety(patient, validMeds);
          setSafetyResult(result);
          setShowSafetyModal(true);
          setModalPosition({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
      } catch (error: any) { console.error(error); alert(`خطا در بررسی ایمنی: ${error.message}`); } finally { setCheckingSafety(false); }
  };

  const saveInlinePrescription = async () => {
    if (!selectedPatientId) { alert("بیمار انتخاب نشده."); return; }
    const validMeds = medications.filter(m => m.name.trim() !== '');
    if (validMeds.length === 0) { alert("نسخه خالی است."); return; }
    try {
        await saveCompleteVisit(selectedPatientId, result, validMeds, rxNotes, labImageFiles);
        setSavedRxId('latest'); setReprintRx(null); setShowPrintPreview(true);
    } catch (e: any) { alert("خطا در ذخیره‌سازی ویزیت: " + e.message); }
  };

  const handleReprint = (rx: Prescription) => { setReprintRx(rx); setSavedRxId(rx.id.substring(0, 8)); setShowPrintPreview(true); };
  const closePreviewAndReset = () => {
      setShowPrintPreview(false);
      if (!reprintRx) {
          setMedications([{ name: '', dosage: '', instructions: '' }]);
          setRxNotes(''); setFinalDiagnosis(''); setLabImageFiles([]); setLabImagesBase64([]); setExtractedDataPreview('');
          setStep(1); setSelectedPatientId(''); setPatientSearch(''); setSymptoms(''); setCurrentVisitId(null);
          setResult(null); setShowSources(false);
      }
      setReprintRx(null);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
      if (modalRef.current) {
          isDraggingRef.current = true;
          dragOffsetRef.current = { x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y };
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
      }
  };
  const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) setModalPosition({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y });
  };
  const handleMouseUp = () => { isDraggingRef.current = false; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };

  const previewPatient = reprintRx ? patients.find(p => p.id === reprintRx.patientId) : patients.find(p => p.id === selectedPatientId);
  const previewMeds = reprintRx ? reprintRx.medications : medications;
  const previewDiagnosis = reprintRx ? reprintRx.diagnosis : finalDiagnosis;
  const previewNotes = reprintRx ? reprintRx.notes : rxNotes;
  const previewDate = reprintRx ? new Date(reprintRx.date) : new Date();

  const submitLabRequest = async () => {
      if (!selectedPatientId || !labTestName || !labPrice) return;
      try {
          await createLabRequest(currentVisitId || uuidv4(), selectedPatientId, labTestName, labPrice); 
          alert("درخواست آزمایش ثبت شد. بیمار را به صندوق ارجاع دهید.");
          if (confirm("آیا می‌خواهید پرونده را موقتاً ببندید تا جواب آزمایش بیاید؟")) {
              await handleHoldForLab();
          }
          setShowLabModal(false);
          setLabTestName('');
      } catch (e) {
          console.error(e);
          alert("درخواست ثبت شد.");
          setShowLabModal(false);
      }
  };

  const handlePrintExternalLab = () => {
      setShowExternalLabPrint(true);
  };

  const renderStep2Footer = () => (
      <div className="flex justify-between pt-6 border-t">
        <button onClick={() => setStep(1)} className="text-gray-500 px-4 font-medium">بازگشت به لیست</button>
        <div className="flex gap-2">
            <button onClick={handleHoldForLab} className="bg-amber-100 text-amber-700 px-4 py-4 rounded-xl font-bold flex gap-2 items-center hover:bg-amber-200">
                <PauseCircle size={20}/>
                منتظر آزمایش (تعلیق)
            </button>
            <button 
                onClick={handleRequestConsult}
                disabled={!symptoms || consultLoading}
                className="bg-blue-600 text-white px-6 py-4 rounded-xl shadow-lg hover:shadow-xl font-bold flex gap-2 disabled:opacity-50"
            >
                {consultLoading ? <Loader className="animate-spin"/> : <Radio />} 
                ارسال به اتاق تشخیص
            </button>
            {loading ? 
                <div className="text-medical-600 font-bold px-10 py-4 bg-gray-100 rounded-xl"><Loader className="animate-spin inline mr-2"/>در حال پردازش...</div> : 
                <button onClick={runDiagnosis} disabled={!symptoms} className="bg-medical-600 text-white px-10 py-4 rounded-xl shadow-xl hover:shadow-2xl font-bold flex gap-2"><BrainCircuit/> تشخیص هوشمند (محلی)</button>
            }
        </div>
      </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
        {step === 1 && (
            <div className="flex gap-8 mt-4 animate-fadeIn">
                <div className="w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[80vh] flex flex-col">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-4">
                        <Clock className="text-medical-600" />
                        اتاق انتظار
                        <span className="bg-medical-100 text-medical-600 px-2 py-0.5 rounded-full text-xs">{waitingPatients.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                        {waitingPatients.length === 0 && (
                            <div className="text-center py-10 opacity-40">
                                <User size={40} className="mx-auto mb-2"/>
                                <p>اتاق انتظار خالی است.</p>
                            </div>
                        )}
                        {waitingPatients.map(visit => (
                            <div key={visit.id} onClick={() => selectPatientFromQueue(visit)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all group ${visit.status === 'lab_ready' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200 hover:bg-white'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-800 text-lg group-hover:text-medical-700 transition-colors">{visit.patientName}</span>
                                    <span className="text-xs font-mono text-gray-400">{new Date(visit.visitDate).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">{visit.patientAge} ساله</span>
                                    {visit.status === 'lab_ready' ? (
                                        <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded flex items-center gap-1"><TestTube size={12}/> جواب آزمایش</span>
                                    ) : (
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">منتظر ویزیت</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6"><Search className="text-gray-400" /> پذیرش خارج از نوبت</h3>
                    <div className="relative">
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <input type="text" className="w-full p-4 pl-10 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-medical-500 outline-none text-lg cursor-pointer" placeholder="جستجو نام بیمار..." value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setIsPatientDropdownOpen(true); if (selectedPatientId) setSelectedPatientId(''); }} onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)} />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Search size={20}/></div>
                        </div>
                        {isPatientDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsPatientDropdownOpen(false)}></div>
                                <div className="absolute w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                    {patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch)).map(p => (
                                        <div key={p.id} onClick={() => { setSelectedPatientId(p.id); setPatientSearch(p.fullName); setIsPatientDropdownOpen(false); }} className="p-3 hover:bg-medical-50 cursor-pointer border-b border-gray-50 flex justify-between items-center group">
                                            <div><p className="font-bold text-gray-800">{p.fullName}</p><p className="text-xs text-gray-500">{p.age} ساله</p></div>
                                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md dir-ltr">{p.phone}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-end mt-8">
                        <button disabled={!selectedPatientId} onClick={() => { setStep(2); setCurrentVisitId(uuidv4()); }} className="bg-gray-800 text-white px-8 py-3 rounded-xl disabled:opacity-50 hover:bg-gray-900 font-bold shadow-lg flex items-center gap-2">
                            شروع ویزیت دستی <Play size={20} />
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        {step === 2 && (
             <div className="space-y-8 animate-fadeIn">
                 <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                        <span className="font-bold">بیمار:</span>
                        <span>{patients.find(p => p.id === selectedPatientId)?.fullName}</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm"><Clock size={18} /> سوابق</button>
                        <button onClick={() => setShowLabModal(true)} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-bold text-sm"><TestTube size={18} /> درخواست آزمایش</button>
                        <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-bold text-sm"><LayoutTemplate size={18} /> الگوها</button>
                        <button onClick={() => {setIsManualMode(true); setResult(null); setMedications([{name:'',dosage:'',instructions:''}]); setRxNotes(''); setFinalDiagnosis(''); setStep(3);}} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-bold text-sm"><PenTool size={18} /> نسخه مستقیم</button>
                    </div>
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* VITALS PANEL (RESTORED) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 h-fit">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span className="w-8 h-8 bg-medical-100 text-medical-600 rounded-full flex items-center justify-center text-sm">۱</span> علائم حیاتی</h3></div>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Activity size={14} className="text-blue-500"/> فشار خون (mmHg)</label>
                                    <span className="font-mono font-bold text-blue-600">{sliderValues.sys}/{sliderValues.dia}</span>
                                </div>
                                <input type="range" min="80" max="200" value={sliderValues.sys} onChange={e => setSliderValues({...sliderValues, sys: parseInt(e.target.value)})} className="w-full accent-blue-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-2"/>
                                <input type="range" min="40" max="120" value={sliderValues.dia} onChange={e => setSliderValues({...sliderValues, dia: parseInt(e.target.value)})} className="w-full accent-blue-400 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Heart size={14} className="text-rose-500"/> ضربان</label>
                                        <span className="font-mono font-bold text-rose-600">{sliderValues.hr}</span>
                                    </div>
                                    <input type="range" min="40" max="180" value={sliderValues.hr} onChange={e => setSliderValues({...sliderValues, hr: parseInt(e.target.value)})} className="w-full accent-rose-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Thermometer size={14} className="text-orange-500"/> دما</label>
                                        <span className="font-mono font-bold text-orange-600">{sliderValues.temp.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="35" max="42" step="0.1" value={sliderValues.temp} onChange={e => setSliderValues({...sliderValues, temp: parseFloat(e.target.value)})} className="w-full accent-orange-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Wind size={14} className="text-cyan-500"/> اکسیژن</label>
                                        <span className="font-mono font-bold text-cyan-600">{sliderValues.o2}%</span>
                                    </div>
                                    <input type="range" min="80" max="100" value={sliderValues.o2} onChange={e => setSliderValues({...sliderValues, o2: parseInt(e.target.value)})} className="w-full accent-cyan-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Droplets size={14} className="text-indigo-500"/> قند خون</label>
                                        <span className="font-mono font-bold text-indigo-600">{sliderValues.glucose}</span>
                                    </div>
                                    <input type="range" min="60" max="400" value={sliderValues.glucose} onChange={e => setSliderValues({...sliderValues, glucose: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span className="w-8 h-8 bg-medical-100 text-medical-600 rounded-full flex items-center justify-center text-sm">۲</span> شرح حال</h3></div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700">توضیحات و علائم</label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setDictationLang(p => p==='fa-IR'?'en-US':'fa-IR')} className="px-2 py-1 rounded-md bg-slate-100 text-xs font-bold">{dictationLang==='fa-IR'?'FA':'EN'}</button>
                                        <button onClick={toggleRecording} className={`p-2 rounded-full ${isRecording?'bg-red-500 text-white animate-pulse':'bg-gray-100'}`}>{isRecording?<MicOff size={18}/>:<Mic size={18}/>}</button>
                                    </div>
                                </div>
                                <textarea className="w-full h-32 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none resize-none" value={symptoms} onChange={e => setSymptoms(e.target.value)} />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 flex flex-col h-fit">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span className="w-8 h-8 bg-medical-100 text-medical-600 rounded-full flex items-center justify-center text-sm">۳</span> مدارک و تصاویر</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* VISUAL DIAGNOSIS UPLOAD */}
                                <div onClick={() => fileInputRef.current?.click()} className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors h-40 group relative">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                                    <ImageIcon className="text-indigo-400 group-hover:text-indigo-600 mb-2 transition-colors" size={32} />
                                    <span className="text-sm font-bold text-indigo-700">تصاویر پزشکی جهت تشخیص</span>
                                    <span className="text-[10px] text-indigo-500 mt-1 text-center px-2">MRI, CT Scan, X-Ray (بدون تغییر کیفیت)</span>
                                    <div className="absolute top-2 right-2 bg-indigo-200 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Visual AI</div>
                                </div>

                                {/* DOCUMENT OCR UPLOAD */}
                                <div onClick={() => docInputRef.current?.click()} className={`bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-100 transition-colors h-40 group relative ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input type="file" ref={docInputRef} onChange={handleDocumentExtraction} className="hidden" accept="image/*" />
                                    {isExtracting ? (
                                        <>
                                            <Loader size={32} className="text-emerald-600 animate-spin mb-2"/>
                                            <p className="text-xs font-bold text-emerald-600">در حال استخراج متن...</p>
                                        </>
                                    ) : (
                                        <>
                                            <FileType className="text-emerald-400 group-hover:text-emerald-600 mb-2 transition-colors" size={32} />
                                            <span className="text-sm font-bold text-emerald-700">اسکن مدارک و گزارش‌ها</span>
                                            <span className="text-[10px] text-emerald-500 mt-1 text-center px-2">استخراج متن برای بایگانی در پرونده</span>
                                            <div className="absolute top-2 right-2 bg-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">OCR</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* PREVIEW AREA */}
                            {labImagesBase64.length > 0 && (
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 mb-2">تصاویر آپلود شده برای تشخیص:</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {labImagesBase64.map((img, idx) => (
                                            <div key={idx} className="relative group">
                                                <img src={`data:image/jpeg;base64,${img.data}`} alt="preview" className="w-full h-16 object-cover rounded-lg border border-gray-300"/>
                                                <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {extractedDataPreview && (
                                <div className="mt-3 bg-white p-3 rounded-xl text-xs text-gray-700 border border-gray-200 max-h-32 overflow-y-auto">
                                    <p className="font-bold text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle size={12}/> متن استخراج شده از مدارک:</p>
                                    <p className="leading-relaxed">{extractedDataPreview}</p>
                                </div>
                            )}

                            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100"><input type="checkbox" checked={useWeb} onChange={e => setUseWeb(e.target.checked)} className="w-5 h-5 accent-medical-600"/><label className="text-sm font-bold text-gray-700">جستجوی آنلاین (Grounding)</label></div>
                            <div className="border border-gray-200 rounded-xl p-4 flex-1 overflow-y-auto max-h-48">
                                <p className="text-sm font-bold mb-2">پایگاه دانش:</p>
                                {library.map(book => <div key={book.id} className="flex gap-2 mb-2"><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={e => e.target.checked ? setSelectedBookIds([...selectedBookIds,book.id]) : setSelectedBookIds(selectedBookIds.filter(id=>id!==book.id))} className="accent-medical-600"/><span className="text-sm">{book.title}</span></div>)}
                            </div>
                        </div>
                    </div>
                 </div>
                 {renderStep2Footer()}
             </div>
        )}
        
        {step === 3 && (
             <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2"><button onClick={() => setStep(2)} className="text-gray-500 p-2"><RotateCcw size={20}/></button><h3 className="text-xl font-bold text-gray-800">{isManualMode ? 'نسخه‌نویسی مستقیم' : 'نتایج تشخیص'}</h3></div>
                    <div className="flex gap-3">
                        {!isManualMode && result && (
                            <>
                                <button onClick={runSupervision} disabled={isSupervising || isDeepReviewing} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm text-white ${isSupervising ? 'bg-amber-600/80 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`} title="ناظر هوشمند بالینی">{isSupervising ? <Loader size={18} className="animate-spin" /> : <ShieldAlert size={18} />} ناظر هوشمند</button>
                                <button onClick={() => setShowDeepReviewInput(!showDeepReviewInput)} disabled={isDeepReviewing} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${showDeepReviewInput ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`} title="تحلیل عمیق و مناظره">{isDeepReviewing ? <Loader size={18} className="animate-spin" /> : <BrainCircuit size={18} />} بازبینی عمیق</button>
                            </>
                        )}
                        <button onClick={() => setDictationLang(p=>p==='fa-IR'?'en-US':'fa-IR')} className="px-2 py-1 rounded bg-slate-100 text-xs font-bold">{dictationLang==='fa-IR'?'FA':'EN'}</button>
                        <button onClick={toggleRxRecording} className={`p-2 rounded-full ${rxIsRecording?'bg-red-500 text-white animate-pulse':'bg-gray-100'}`}>{rxIsRecording?<MicOff size={18}/>:<Mic size={18}/>}</button>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
                    <div className="bg-gray-100 rounded-t-xl p-4 border-b border-gray-200 mb-6 flex justify-between items-center"><h4 className="font-bold text-gray-700 flex items-center gap-2"><FileText size={20}/> اقلام دارویی</h4></div>
                    <div className="space-y-4">
                        {medications.map((med, idx) => (
                            <div key={idx} className="flex gap-4 items-start animate-slideUp">
                                <div className="pt-4 text-gray-400 font-bold w-6 text-center">{idx + 1}</div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="group"><label className="text-xs font-bold text-gray-400 mb-1">نام دارو</label><input type="text" className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white font-bold ltr text-left" value={med.name} onFocus={() => setActiveRxField({type:'med',index:idx,field:'name'})} onChange={e=>{const n=[...medications];n[idx].name=e.target.value;setMedications(n)}} /></div>
                                    <div className="group"><label className="text-xs font-bold text-gray-400 mb-1">دوز</label><input type="text" className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white ltr text-left" value={med.dosage} onFocus={() => setActiveRxField({type:'med',index:idx,field:'dosage'})} onChange={e=>{const n=[...medications];n[idx].dosage=e.target.value;setMedications(n)}} /></div>
                                    <div className="group"><label className="text-xs font-bold text-gray-400 mb-1">دستور</label><input type="text" className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white" value={med.instructions} onFocus={() => setActiveRxField({type:'med',index:idx,field:'instructions'})} onChange={e=>{const n=[...medications];n[idx].instructions=e.target.value;setMedications(n)}} /></div>
                                </div>
                                <button onClick={() => setMedications(medications.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 pt-7"><X size={20} /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setMedications([...medications, { name: '', dosage: '', instructions: '' }])} className="mt-6 flex items-center gap-2 text-medical-600 font-bold text-sm hover:bg-medical-50 px-4 py-2 rounded-lg w-full justify-center border border-dashed border-medical-200"><Plus size={16} /> افزودن قلم</button>
                    <div className="mt-8">
                        <div className="flex gap-1 border-b border-gray-200">
                            <button onClick={() => setActiveNoteTab('notes')} className={`px-6 py-3 font-bold text-sm rounded-t-xl border-t border-x ${activeNoteTab==='notes'?'bg-white text-medical-700':'bg-gray-100 text-gray-500'}`}>توضیحات بیمار</button>
                            <button onClick={() => setActiveNoteTab('diagnosis')} className={`px-6 py-3 font-bold text-sm rounded-t-xl border-t border-x ${activeNoteTab==='diagnosis'?'bg-white text-amber-600':'bg-gray-100 text-gray-500'}`}>تشخیص نهایی</button>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-4">
                            <textarea className="w-full h-24 p-4 outline-none resize-none" value={activeNoteTab==='notes'?rxNotes:finalDiagnosis} onFocus={() => setActiveRxField({type:'notes'})} onChange={e => activeNoteTab==='notes'?setRxNotes(e.target.value):setFinalDiagnosis(e.target.value)} placeholder="متن خود را اینجا بنویسید..."></textarea>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100">
                        <button onClick={checkSafety} disabled={checkingSafety} className="flex items-center gap-2 text-amber-600 bg-amber-50 px-5 py-3 rounded-xl font-bold">{checkingSafety?<Loader className="animate-spin"/>:<AlertTriangle/>} بررسی تداخلات</button>
                        <button onClick={saveInlinePrescription} disabled={isLoading} className="flex items-center gap-2 bg-medical-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-medical-700 shadow-lg disabled:opacity-50">
                            {isLoading ? <Loader className="animate-spin" size={20}/> : <Printer size={20}/>} 
                            تایید و چاپ
                        </button>
                    </div>
                </div>
             </div>
        )}

        {/* LAB MODAL (Updated) */}
        {showLabModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl relative animate-fadeIn border-t-4 border-purple-500">
                    <button onClick={() => setShowLabModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
                    <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                        <TestTube className="text-purple-600"/>
                        درخواست آزمایش
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">نام آزمایش</label>
                            <input 
                                type="text" 
                                value={labTestName} 
                                onChange={e => setLabTestName(e.target.value)}
                                placeholder="مثال: CBC, Lipid Profile"
                                className="w-full p-3 border rounded-xl outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">هزینه (افغانی)</label>
                            <input 
                                type="number" 
                                value={labPrice} 
                                onChange={e => setLabPrice(Number(e.target.value))}
                                className="w-full p-3 border rounded-xl outline-none focus:border-purple-500"
                            />
                        </div>
                        <button 
                            onClick={submitLabRequest}
                            className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg"
                        >
                            ثبت درخواست و ارجاع به صندوق
                        </button>
                        <button 
                            onClick={handlePrintExternalLab}
                            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 border border-gray-200 flex justify-center items-center gap-2"
                        >
                            <Printer size={16}/> چاپ نسخه (برای آزمایشگاه خارجی)
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* EXTERNAL LAB PRINT MODAL */}
        {showExternalLabPrint && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col z-[200] print-modal-container">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-md preview-toolbar no-print">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Printer size={20}/> چاپ درخواست آزمایش</h3>
                    <div className="flex gap-3">
                        <button onClick={() => setShowExternalLabPrint(false)} className="bg-slate-700 px-4 py-2 rounded-lg font-bold">بستن</button>
                        <button onClick={() => window.print()} className="bg-blue-600 px-6 py-2 rounded-lg font-bold">چاپ</button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto flex justify-center p-8 screen-preview-container">
                    <div className="paper-sheet bg-white w-[210mm] p-[10mm] text-black shadow-lg">
                        <div className="text-center border-b-2 border-black pb-4 mb-6">
                            <h1 className="text-2xl font-bold">{doctorProfile.fullName}</h1>
                            <p>{doctorProfile.specialty}</p>
                            <p className="text-sm mt-1">Lab Request Form</p>
                        </div>
                        <div className="flex justify-between mb-8 border-b pb-4">
                            <div><span className="font-bold">Patient:</span> {patients.find(p => p.id === selectedPatientId)?.fullName}</div>
                            <div><span className="font-bold">Date:</span> {new Date().toLocaleDateString('fa-IR')}</div>
                        </div>
                        <div className="mb-4">
                            <h3 className="font-bold text-lg underline mb-2">Tests Requested:</h3>
                            <p className="text-xl font-mono">{labTestName}</p>
                        </div>
                        <div className="mt-12 pt-8 border-t border-gray-300 flex justify-between items-end">
                            <div className="text-xs text-gray-500">
                                Please provide results to patient.
                            </div>
                            <div className="text-center">
                                <div className="h-12"></div>
                                <div className="border-t border-black w-32"></div>
                                <p className="text-xs font-bold mt-1">Doctor Signature</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {showTemplateModal && (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl relative animate-fadeIn">
                    <button onClick={() => setShowTemplateModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
                    <h3 className="text-xl font-bold mb-6 text-gray-800">الگوهای آماده</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                        {prescriptionTemplates.map(tpl => (
                            <button key={tpl.id} onClick={() => { setMedications(JSON.parse(JSON.stringify(tpl.medications))); setRxNotes(tpl.notes); setFinalDiagnosis(tpl.diagnosis); setIsManualMode(true); setResult(null); setStep(3); setShowTemplateModal(false); }} className="w-full text-right p-4 border border-gray-200 rounded-xl hover:border-medical-500 hover:bg-medical-50 transition-all font-bold text-gray-700">{tpl.name}</button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* ... (Keep existing Print Preview) ... */}
        {showPrintPreview && previewPatient && (
             <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col z-[200] print-modal-container">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-md preview-toolbar border-b border-slate-700">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold flex items-center gap-2 text-lg"><Printer size={20}/> پیش‌نمایش چاپ</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setPrintScale(s => s - 0.1)} className="p-2 bg-slate-700 rounded"><ZoomOut size={16}/></button>
                            <button onClick={() => setPrintScale(s => s + 0.1)} className="p-2 bg-slate-700 rounded"><ZoomIn size={16}/></button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={closePreviewAndReset} className="bg-slate-700 px-4 py-2 rounded-lg font-bold">بستن</button>
                        <button onClick={() => window.print()} className="bg-blue-600 px-6 py-2 rounded-lg font-bold">چاپ</button>
                    </div>
                </div>
                <div className="flex-1 screen-preview-container p-8 overflow-auto flex justify-center" ref={previewContainerRef}>
                     <div className="paper-sheet bg-white w-[210mm] min-h-[297mm] p-[12mm] text-black shadow-lg" style={{ transform: `scale(${printScale})`, transformOrigin: 'top center' }}>
                         <div className="text-center border-b-2 border-black pb-4 mb-6">
                             <h1 className="text-3xl font-bold">{doctorProfile.fullName}</h1>
                             <p>{doctorProfile.specialty}</p>
                         </div>
                         <div className="flex justify-between mb-8 border-b pb-4">
                             <div><span className="font-bold">Name:</span> {previewPatient.fullName}</div>
                             <div><span className="font-bold">Age:</span> {previewPatient.age}</div>
                             <div><span className="font-bold">Date:</span> {previewDate.toLocaleDateString('fa-IR')}</div>
                         </div>
                         <div className="mb-4 text-4xl font-serif font-bold">Rx</div>
                         <ul className="space-y-4 mb-10">
                             {previewMeds.map((m, i) => (
                                 <li key={i} className="flex justify-between border-b border-dotted pb-2">
                                     <span className="font-bold text-lg">{m.name}</span>
                                     <span className="font-mono">{m.dosage} - {m.instructions}</span>
                                 </li>
                             ))}
                         </ul>
                         {(previewNotes || previewDiagnosis) && (
                             <div className="border-t pt-4">
                                 <p><span className="font-bold">Diagnosis:</span> {previewDiagnosis}</p>
                                 <p><span className="font-bold">Note:</span> {previewNotes}</p>
                             </div>
                         )}
                     </div>
                </div>
            </div>
        )}
    </div>
  );
};
