
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { performDiagnosis, checkPrescriptionSafety, performDeepReview, performClinicalSupervision } from '../services/geminiService';
import { DiagnosisResult, Vitals, SafetyCheckResult, PrescriptionTemplate, Prescription, SupervisorResult } from '../types';
import { Loader, Upload, BrainCircuit, ChevronLeft, RotateCcw, BookOpen, Pill, Save, AlertOctagon, Mic, MicOff, Activity, Scale, Thermometer, Heart, Wind, FileText, Printer, ShieldCheck, X, GripHorizontal, AlertTriangle, Link2, ExternalLink, Clock, PenTool, ChevronDown, ChevronUp, Copy, LayoutTemplate, CheckCircle, Stethoscope, Plus, Search, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Maximize, MonitorPlay, MessageSquareWarning, ArrowDownCircle, Lightbulb, Leaf, Coffee, Ban, Utensils, Sunrise, Sun, Moon, ShieldAlert, Award, AlertCircle, Droplets } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type RxFieldFocus = { type: 'med'; index: number; field: 'name' | 'dosage' | 'instructions' } | { type: 'notes' } | { type: 'templateName' } | null;
type NoteTab = 'notes' | 'diagnosis';

export const Diagnosis: React.FC = () => {
  const { patients, library, addPrescription, prescriptions, prescriptionTemplates, doctorProfile } = useStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [savedRxId, setSavedRxId] = useState<string | null>(null);
  const [reprintRx, setReprintRx] = useState<Prescription | null>(null); // For history reprinting
  
  // Deep Review State
  const [isDeepReviewing, setIsDeepReviewing] = useState(false);
  const [showDeepReviewInput, setShowDeepReviewInput] = useState(false);
  const [doctorFeedback, setDoctorFeedback] = useState('');

  // Clinical Supervisor State
  const [isSupervising, setIsSupervising] = useState(false);
  const [supervisorResult, setSupervisorResult] = useState<SupervisorResult | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  
  // UI State
  const [showSources, setShowSources] = useState(false);

  // Print Scale State - Default to Fit logic
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

  useEffect(() => { activeRxFieldRef.current = activeRxField; }, [activeRxField]);
  useEffect(() => { activeNoteTabRef.current = activeNoteTab; }, [activeNoteTab]);

  useEffect(() => {
    if (selectedPatientId) {
        const p = patients.find(p => p.id === selectedPatientId);
        if (p) setPatientSearch(p.fullName);
    }
  }, [selectedPatientId, patients]);

  // Auto-Fit Logic on Open
  useEffect(() => {
      if (showPrintPreview) {
         fitToScreen();
         window.addEventListener('resize', fitToScreen);
      }
      return () => window.removeEventListener('resize', fitToScreen);
  }, [showPrintPreview]);

  const fitToScreen = () => {
      if (previewContainerRef.current) {
          const containerHeight = window.innerHeight - 100; // Subtract header/toolbar
          const paperHeightPx = 1122; // A4 height at 96 DPI approx (297mm)
          const scale = Math.min(1, (containerHeight / paperHeightPx) - 0.05); // Leave 5% margin
          setPrintScale(scale);
      }
  };

  const [vitals, setVitals] = useState<Vitals>({ bloodPressure: '120/80', heartRate: '72', temperature: '37.0', oxygenLevel: '98', weight: '70', glucose: '100' });
  const [sliderValues, setSliderValues] = useState({ sys: 120, dia: 80, hr: 72, temp: 37.0, o2: 98, weight: 70, glucose: 100 });
  const [vitalsEnabled, setVitalsEnabled] = useState({ bp: true, hr: true, temp: true, o2: true, weight: true, glucose: true });

  const [labImages, setLabImages] = useState<{name: string, data: string}[]>([]);
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
      Array.from(files).forEach((file: File) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).replace('data:', '').replace(/^.+,/, '');
            setLabImages(prev => [...prev, { name: file.name, data: base64String }]);
          };
          reader.readAsDataURL(file);
      });
    }
  };

  const runDiagnosis = async () => {
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;
    setLoading(true);
    setIsManualMode(false);
    setShowDeepReviewInput(false); // Reset UI state on new diagnosis
    setDoctorFeedback('');
    setSupervisorResult(null); // Reset Supervisor

    try {
      const selectedBooks = library.filter(b => selectedBookIds.includes(b.id));
      const pastPrescriptions = prescriptions.filter(rx => rx.patientId === selectedPatientId).reverse();
      const diagnosisResult = await performDiagnosis({
        patient, symptoms, vitals, labImagesBase64: labImages.map(img => img.data),
        selectedBooks, useWebSearch: useWeb, pastPrescriptions
      });
      setResult(diagnosisResult as DiagnosisResult);
      if (diagnosisResult.suggestedMedications && diagnosisResult.suggestedMedications.length > 0) {
          setMedications(diagnosisResult.suggestedMedications.map((m: any) => ({ name: m.name, dosage: m.dosage, instructions: '' })));
      } else {
          setMedications([{ name: '', dosage: '', instructions: '' }]);
      }
      setFinalDiagnosis(diagnosisResult.diagnosis || '');
      setShowSources(false); // Default collapse sources
      setStep(3);
    } catch (error: any) {
      console.error(error);
      alert(`خطا در ارتباط با دستیار هوشمند:\n${error.message || error.toString()}`);
    } finally {
      setLoading(false);
    }
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
            {
                patient, symptoms, vitals, labImagesBase64: labImages.map(img => img.data),
                selectedBooks, useWebSearch: useWeb, pastPrescriptions
            },
            result
          );
          setSupervisorResult(supervisionResult);
          setShowSupervisorModal(true);
      } catch (error: any) {
          alert("خطا در ارتباط با ناظر هوشمند: " + error.message);
      } finally {
          setIsSupervising(false);
      }
  };

  const applySupervisorFeedback = () => {
      if (supervisorResult && supervisorResult.suggestedAction) {
          setDoctorFeedback(supervisorResult.suggestedAction);
          setShowSupervisorModal(false);
          setShowDeepReviewInput(true); // Open the deep review input so doctor can see and start
      }
  };

  const runDeepReview = async () => {
      if (!result || !selectedPatientId) return;
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!patient) return;

      setIsDeepReviewing(true);
      setShowDeepReviewInput(false); // Hide input while processing
      
      try {
          const selectedBooks = library.filter(b => selectedBookIds.includes(b.id));
          const pastPrescriptions = prescriptions.filter(rx => rx.patientId === selectedPatientId).reverse();
          
          const reviewResult = await performDeepReview(
              {
                patient, symptoms, vitals, labImagesBase64: labImages.map(img => img.data),
                selectedBooks, useWebSearch: useWeb, pastPrescriptions
              },
              result.diagnosis,
              doctorFeedback
          );
          
          setResult(reviewResult);
          setSupervisorResult(null); // Reset supervisor after new result
          
          // Update Form
          if (reviewResult.suggestedMedications && reviewResult.suggestedMedications.length > 0) {
              setMedications(reviewResult.suggestedMedications.map((m: any) => ({ name: m.name, dosage: m.dosage, instructions: '' })));
          }
          setFinalDiagnosis(reviewResult.diagnosis || '');
          setShowSources(false); // Default collapse sources again if they change
          
      } catch (error: any) {
          alert("خطا در بازبینی عمیق: " + error.message);
          setShowDeepReviewInput(true); // Show input again if failed
      } finally {
          setIsDeepReviewing(false);
      }
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
      } catch (error: any) { 
        console.error(error);
        alert(`خطا در بررسی ایمنی: ${error.message}`); 
      } finally { setCheckingSafety(false); }
  };

  const saveInlinePrescription = () => {
    if (!selectedPatientId) { alert("بیمار انتخاب نشده."); return; }
    const validMeds = medications.filter(m => m.name.trim() !== '');
    if (validMeds.length === 0) { alert("نسخه خالی است."); return; }
    addPrescription({
        patientId: selectedPatientId, date: new Date().toISOString(),
        medications: validMeds, notes: rxNotes, diagnosis: finalDiagnosis,
        labFindings: result?.labAnalysis
    });
    setSavedRxId('latest'); 
    setReprintRx(null); // Clear any reprint data
    setShowPrintPreview(true);
  };

  const handleReprint = (rx: Prescription) => {
    // Logic to open print preview for a specific historical prescription
    setReprintRx(rx);
    setSavedRxId(rx.id.substring(0, 8)); // Use partial ID for display
    setShowPrintPreview(true);
  };

  const closePreviewAndReset = () => {
      setShowPrintPreview(false);
      // Only reset form if we were just printing a NEW prescription
      if (!reprintRx) {
          setMedications([{ name: '', dosage: '', instructions: '' }]);
          setRxNotes(''); setFinalDiagnosis(''); setLabImages([]);
          setStep(1); setSelectedPatientId(''); setPatientSearch(''); setSymptoms('');
          setResult(null); // Clear result
          setShowSources(false);
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
  const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
  };

  // Determine what data to show in preview (New vs Reprint)
  const previewPatient = reprintRx 
      ? patients.find(p => p.id === reprintRx.patientId) 
      : patients.find(p => p.id === selectedPatientId);
      
  const previewMeds = reprintRx ? reprintRx.medications : medications;
  const previewDiagnosis = reprintRx ? reprintRx.diagnosis : finalDiagnosis;
  const previewNotes = reprintRx ? reprintRx.notes : rxNotes;
  const previewDate = reprintRx ? new Date(reprintRx.date) : new Date();

  const renderStep1 = () => {
    const filteredPatients = patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch));
    return (
        <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-10">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-medical-100 text-medical-600 rounded-full flex items-center justify-center text-sm">۱</span>
            انتخاب بیمار
          </h3>
          <div className="relative">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                   <input 
                      type="text"
                      className="w-full p-4 pl-10 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-medical-500 outline-none text-lg cursor-pointer"
                      placeholder="جستجو یا انتخاب نام بیمار..."
                      value={patientSearch}
                      onChange={(e) => { setPatientSearch(e.target.value); setIsPatientDropdownOpen(true); if (selectedPatientId) setSelectedPatientId(''); }}
                      onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
                   />
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{isPatientDropdownOpen?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</div>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Search size={20}/></div>
              </div>
              {isPatientDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsPatientDropdownOpen(false)}></div>
                    <div className="absolute w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredPatients.map(p => (
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
            <button disabled={!selectedPatientId} onClick={() => setStep(2)} className="bg-medical-600 text-white px-8 py-3 rounded-xl disabled:opacity-50 hover:bg-medical-700 font-bold shadow-lg">مرحله بعد <ChevronLeft size={20} /></button>
          </div>
        </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-700">
              <span className="font-bold">بیمار:</span>
              <span>{patients.find(p => p.id === selectedPatientId)?.fullName}</span>
          </div>
          <div className="flex gap-3">
              <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm"><Clock size={18} /> سوابق</button>
              <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-bold text-sm"><LayoutTemplate size={18} /> الگوها</button>
              <button onClick={() => {setIsManualMode(true); setResult(null); setMedications([{name:'',dosage:'',instructions:''}]); setRxNotes(''); setFinalDiagnosis(''); setStep(3);}} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-bold text-sm"><PenTool size={18} /> نسخه مستقیم</button>
          </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 h-fit">
            <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span className="w-8 h-8 bg-medical-100 text-medical-600 rounded-full flex items-center justify-center text-sm">۲</span> علائم بالینی</h3></div>
            <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">شرح حال</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDictationLang(p => p==='fa-IR'?'en-US':'fa-IR')} className="px-2 py-1 rounded-md bg-slate-100 text-xs font-bold">{dictationLang==='fa-IR'?'FA':'EN'}</button>
                    <button onClick={toggleRecording} className={`p-2 rounded-full ${isRecording?'bg-red-500 text-white animate-pulse':'bg-gray-100'}`}>{isRecording?<MicOff size={18}/>:<Mic size={18}/>}</button>
                  </div>
                </div>
                <textarea className="w-full h-32 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none resize-none" value={symptoms} onChange={e => setSymptoms(e.target.value)} />
            </div>

            {/* RESTORED VITAL SIGNS CONTROLS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Blood Pressure (Shrunk from col-span-full) */}
                <div className={`p-4 border rounded-xl transition-all ${vitalsEnabled.bp ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={vitalsEnabled.bp} onChange={e => setVitalsEnabled({...vitalsEnabled, bp: e.target.checked})} className="w-5 h-5 accent-medical-600 cursor-pointer" />
                            <span className="font-bold text-gray-700">فشار خون (BP)</span>
                        </div>
                        <span className="ltr font-mono font-bold text-lg text-medical-700">{vitalsEnabled.bp ? `${sliderValues.sys}/${sliderValues.dia}` : '--'}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                        <span className="text-xs font-bold text-gray-400 w-8">SYS</span>
                        <input type="range" disabled={!vitalsEnabled.bp} min="80" max="220" value={sliderValues.sys} onChange={e => setSliderValues({...sliderValues, sys: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-medical-600" />
                    </div>
                    <div className="flex gap-4 items-center mt-2">
                        <span className="text-xs font-bold text-gray-400 w-8">DIA</span>
                        <input type="range" disabled={!vitalsEnabled.bp} min="40" max="130" value={sliderValues.dia} onChange={e => setSliderValues({...sliderValues, dia: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-medical-600" />
                    </div>
                </div>

                 {/* Blood Glucose (New) */}
                 <div className={`p-4 border rounded-xl transition-all ${vitalsEnabled.glucose ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={vitalsEnabled.glucose} onChange={e => setVitalsEnabled({...vitalsEnabled, glucose: e.target.checked})} className="w-5 h-5 accent-pink-600 cursor-pointer" />
                            <span className="font-bold text-gray-700 flex items-center gap-2"><Droplets size={16} className="text-pink-500"/> قند خون (BS)</span>
                        </div>
                        <span className="ltr font-mono font-bold text-lg text-pink-600">{vitalsEnabled.glucose ? sliderValues.glucose + ' mg/dL' : '--'}</span>
                    </div>
                    <input type="range" disabled={!vitalsEnabled.glucose} min="40" max="600" value={sliderValues.glucose} onChange={e => setSliderValues({...sliderValues, glucose: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600" />
                </div>

                {/* Heart Rate */}
                <div className={`p-4 border rounded-xl transition-all ${vitalsEnabled.hr ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={vitalsEnabled.hr} onChange={e => setVitalsEnabled({...vitalsEnabled, hr: e.target.checked})} className="w-5 h-5 accent-rose-600 cursor-pointer" />
                            <span className="font-bold text-gray-700 flex items-center gap-2"><Heart size={16} className="text-rose-500"/> ضربان (HR)</span>
                        </div>
                        <span className="ltr font-mono font-bold text-lg text-rose-600">{vitalsEnabled.hr ? sliderValues.hr : '--'}</span>
                    </div>
                    <input type="range" disabled={!vitalsEnabled.hr} min="40" max="180" value={sliderValues.hr} onChange={e => setSliderValues({...sliderValues, hr: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                </div>

                {/* SPO2 */}
                <div className={`p-4 border rounded-xl transition-all ${vitalsEnabled.o2 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={vitalsEnabled.o2} onChange={e => setVitalsEnabled({...vitalsEnabled, o2: e.target.checked})} className="w-5 h-5 accent-cyan-600 cursor-pointer" />
                            <span className="font-bold text-gray-700 flex items-center gap-2"><Wind size={16} className="text-cyan-500"/> اکسیژن (SPO2)</span>
                        </div>
                        <span className="ltr font-mono font-bold text-lg text-cyan-600">{vitalsEnabled.o2 ? sliderValues.o2 + '%' : '--'}</span>
                    </div>
                    <input type="range" disabled={!vitalsEnabled.o2} min="70" max="100" value={sliderValues.o2} onChange={e => setSliderValues({...sliderValues, o2: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600" />
                </div>

                {/* Temp */}
                <div className={`p-4 border rounded-xl transition-all ${vitalsEnabled.temp ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={vitalsEnabled.temp} onChange={e => setVitalsEnabled({...vitalsEnabled, temp: e.target.checked})} className="w-5 h-5 accent-orange-500 cursor-pointer" />
                            <span className="font-bold text-gray-700 flex items-center gap-2"><Thermometer size={16} className="text-orange-500"/> دما (Temp)</span>
                        </div>
                        <span className="ltr font-mono font-bold text-lg text-orange-600">{vitalsEnabled.temp ? sliderValues.temp.toFixed(1) + '°c' : '--'}</span>
                    </div>
                    <input type="range" disabled={!vitalsEnabled.temp} min="35" max="42" step="0.1" value={sliderValues.temp} onChange={e => setSliderValues({...sliderValues, temp: parseFloat(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                </div>

                {/* Weight */}
                <div className={`p-4 border rounded-xl transition-all ${vitalsEnabled.weight ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={vitalsEnabled.weight} onChange={e => setVitalsEnabled({...vitalsEnabled, weight: e.target.checked})} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                            <span className="font-bold text-gray-700 flex items-center gap-2"><Scale size={16} className="text-indigo-500"/> وزن (kg)</span>
                        </div>
                        <span className="ltr font-mono font-bold text-lg text-indigo-600">{vitalsEnabled.weight ? sliderValues.weight + ' kg' : '--'}</span>
                    </div>
                    <input type="range" disabled={!vitalsEnabled.weight} min="5" max="150" value={sliderValues.weight} onChange={e => setSliderValues({...sliderValues, weight: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                </div>
            </div>
            {/* END VITAL SIGNS */}

        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 flex flex-col h-fit">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span className="w-8 h-8 bg-medical-100 text-medical-600 rounded-full flex items-center justify-center text-sm">۳</span> مدارک</h3>
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 flex-1"><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple /><Upload className="text-gray-400 mb-3" size={32} /><span className="text-sm font-bold text-gray-600">آپلود تصاویر</span></div>
            {labImages.length > 0 && <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{labImages.map((img, idx) => <div key={idx} className="bg-gray-50 p-2 rounded flex gap-2"><span className="truncate flex-1 text-xs">{img.name}</span><button onClick={() => setLabImages(p => p.filter((_,i)=>i!==idx))} className="text-red-500"><Trash2 size={14}/></button></div>)}</div>}
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100"><input type="checkbox" checked={useWeb} onChange={e => setUseWeb(e.target.checked)} className="w-5 h-5 accent-medical-600"/><label className="text-sm font-bold text-gray-700">جستجوی آنلاین (Grounding)</label></div>
            <div className="border border-gray-200 rounded-xl p-4 flex-1 overflow-y-auto max-h-48">
                <p className="text-sm font-bold mb-2">پایگاه دانش:</p>
                {library.map(book => <div key={book.id} className="flex gap-2 mb-2"><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={e => e.target.checked ? setSelectedBookIds([...selectedBookIds,book.id]) : setSelectedBookIds(selectedBookIds.filter(id=>id!==book.id))} className="accent-medical-600"/><span className="text-sm">{book.title}</span></div>)}
            </div>
        </div>
      </div>
      <div className="flex justify-between pt-6 border-t">
        <button onClick={() => setStep(1)} className="text-gray-500 px-4 font-medium">بازگشت</button>
        {loading ? <div className="text-medical-600 font-bold px-10 py-4 bg-gray-100 rounded-xl"><Loader className="animate-spin inline mr-2"/>در حال پردازش...</div> : <button onClick={runDiagnosis} disabled={!symptoms} className="bg-medical-600 text-white px-10 py-4 rounded-xl shadow-xl hover:shadow-2xl font-bold flex gap-2"><BrainCircuit/> شروع تشخیص</button>}
      </div>
    </div>
  );

  const renderStep3 = () => (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
             <div className="flex items-center gap-2"><button onClick={() => setStep(2)} className="text-gray-500 p-2"><RotateCcw size={20}/></button><h3 className="text-xl font-bold text-gray-800">{isManualMode ? 'نسخه‌نویسی مستقیم' : 'نتایج تشخیص'}</h3></div>
             
             {/* Header Tools */}
             <div className="flex gap-3">
                 {!isManualMode && result && (
                     <>
                        {/* Clinical Supervisor Button */}
                        <button 
                            onClick={runSupervision}
                            disabled={isSupervising || isDeepReviewing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm text-white ${isSupervising ? 'bg-amber-600/80 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}
                            title="ناظر هوشمند بالینی"
                        >
                            {isSupervising ? <Loader size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
                            ناظر هوشمند
                        </button>

                        <button 
                            onClick={() => setShowDeepReviewInput(!showDeepReviewInput)}
                            disabled={isDeepReviewing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${showDeepReviewInput ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                            title="تحلیل عمیق و مناظره"
                        >
                            {isDeepReviewing ? <Loader size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                            بازبینی عمیق
                        </button>
                     </>
                 )}
                 <button onClick={() => setDictationLang(p=>p==='fa-IR'?'en-US':'fa-IR')} className="px-2 py-1 rounded bg-slate-100 text-xs font-bold">{dictationLang==='fa-IR'?'FA':'EN'}</button>
                 <button onClick={toggleRxRecording} className={`p-2 rounded-full ${rxIsRecording?'bg-red-500 text-white animate-pulse':'bg-gray-100'}`}>{rxIsRecording?<MicOff size={18}/>:<Mic size={18}/>}</button>
             </div>
        </div>

        {/* Deep Review Input Area - Collapsible */}
        {!isManualMode && showDeepReviewInput && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 animate-slideDown shadow-inner">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-indigo-800 mb-2 block">اعتراض، نکته یا سوال شما برای بازبینی (اختیاری):</label>
                        <textarea 
                            value={doctorFeedback}
                            onChange={(e) => setDoctorFeedback(e.target.value)}
                            placeholder="مثال: بیمار تنگی نفس ندارد، پس تشخیص آسم بعید است. لطفاً رفلاکس را بررسی کن..."
                            className="w-full h-20 p-3 rounded-lg border border-indigo-300 focus:ring-2 focus:ring-indigo-400 outline-none text-sm resize-none"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <button 
                            onClick={runDeepReview}
                            disabled={isDeepReviewing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-70 h-fit"
                        >
                            {isDeepReviewing ? <Loader size={20} className="animate-spin"/> : <Search size={20}/>}
                            شروع بازبینی
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-indigo-600 mt-2 flex items-center gap-1">
                    <Clock size={12}/>
                    در این حالت، هوش مصنوعی ۱۰ برابر بیشتر فکر می‌کند (۳۰-۶۰ ثانیه).
                </p>
            </div>
        )}

        {!isManualMode && result && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-medical-100">
                {/* Debate/Review Response Card */}
                {result.debateResponse && (
                    <div className={`p-4 rounded-xl border mb-6 animate-fadeIn ${result.debateOutcome === 'AGREE' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
                        <div className="flex items-start gap-3">
                             <div className={`p-2 rounded-full mt-1 ${result.debateOutcome === 'AGREE' ? 'bg-green-200 text-green-700' : 'bg-purple-200 text-purple-700'}`}>
                                 {result.debateOutcome === 'AGREE' ? <CheckCircle size={24}/> : <MessageSquareWarning size={24}/>}
                             </div>
                             <div>
                                 <h4 className={`font-bold text-lg mb-1 ${result.debateOutcome === 'AGREE' ? 'text-green-800' : 'text-purple-800'}`}>
                                     {result.debateOutcome === 'AGREE' ? 'پذیرش نقد و اصلاح تشخیص' : 'دفاع از تشخیص با استدلال عمیق'}
                                 </h4>
                                 <p className={`text-sm leading-relaxed whitespace-pre-line ${result.debateOutcome === 'AGREE' ? 'text-green-900' : 'text-purple-900'}`}>
                                     {result.debateResponse}
                                 </p>
                             </div>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-4 mb-6"><div className="bg-medical-50 p-3 rounded-full"><BrainCircuit size={32} className="text-medical-600"/></div><div><h4 className="text-2xl font-bold text-medical-800 mb-2">{result.diagnosis}</h4><span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">اطمینان: {result.confidence}%</span></div></div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                    <h5 className="font-bold text-gray-700 mb-2">استدلال تخصصی:</h5>
                    <p className="text-gray-700 text-justify">{result.reasoning}</p>
                    
                    {/* SOURCES LIST - COLLAPSIBLE */}
                    {result.sources && result.sources.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-gray-200">
                             {/* Header / Toggle Button */}
                            <button 
                                onClick={() => setShowSources(!showSources)}
                                className="w-full flex justify-between items-center text-gray-600 hover:bg-gray-100 p-2 -mx-2 rounded-lg transition-colors group"
                            >
                                <div className="flex items-center gap-2 font-bold text-sm">
                                    <Link2 size={16} className="text-blue-500"/>
                                    منابع و مستندات تحقیق 
                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{result.sources.length}</span>
                                </div>
                                <div className={`transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`}>
                                     <ChevronDown size={18} className="text-gray-400 group-hover:text-gray-600"/>
                                </div>
                            </button>
                            
                            {/* Collapsible Content */}
                            {showSources && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 animate-slideDown">
                                    {result.sources.map((source, idx) => (
                                        <a 
                                            key={idx} 
                                            href={source.uri} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="flex items-center gap-2 text-xs text-blue-600 bg-white hover:bg-blue-50 border border-blue-100 p-2 rounded-lg transition-colors truncate group shadow-sm"
                                        >
                                            <ExternalLink size={12} className="flex-shrink-0"/>
                                            <span className="truncate">{source.title || source.uri}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* SIMPLIFIED SUMMARY */}
                {result.simplifiedExplanation && (
                    <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 mb-6">
                        <h5 className="font-bold text-teal-800 mb-2 flex items-center gap-2">
                            <Lightbulb size={20} className="text-teal-600"/>
                            توضیح به زبان ساده (خلاصه):
                        </h5>
                        <p className="text-teal-900 leading-relaxed text-sm">{result.simplifiedExplanation}</p>
                    </div>
                )}

                {/* WELLNESS & LIFESTYLE CARD (New Feature) */}
                {result.traditionalMedicine && (
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 overflow-hidden mb-6 animate-slideUp">
                        {/* Card Header */}
                        <div className="bg-emerald-100/50 p-4 flex items-center justify-between border-b border-emerald-200">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                                    <Leaf size={20} />
                                </div>
                                <div>
                                    <h5 className="font-bold text-emerald-900">کارت سلامت و طب مکمل</h5>
                                    <p className="text-xs text-emerald-700 mt-0.5">پیشنهادات اصلاح مزاج و سبک زندگی</p>
                                </div>
                            </div>
                            {result.traditionalMedicine.temperament && (
                                <span className="text-xs font-bold bg-white text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm">
                                    تشخیص مزاج: {result.traditionalMedicine.temperament}
                                </span>
                            )}
                        </div>

                        <div className="p-5">
                            {/* Food Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                                {/* DO's */}
                                <div className="bg-white/60 rounded-lg p-3 border border-emerald-100">
                                    <h6 className="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-2">
                                        <CheckCircle size={14} className="text-emerald-600" />
                                        غذاهای مفید (بخورید)
                                    </h6>
                                    <div className="flex flex-wrap gap-2">
                                        {result.traditionalMedicine.recommendedFoods?.length > 0 ? (
                                            result.traditionalMedicine.recommendedFoods.map((item, idx) => (
                                                <span key={idx} className="text-xs font-medium text-emerald-900 bg-emerald-100/50 px-2 py-1 rounded">
                                                    {item}
                                                </span>
                                            ))
                                        ) : <span className="text-xs text-gray-400">موردی ذکر نشده</span>}
                                    </div>
                                </div>
                                {/* DON'Ts */}
                                <div className="bg-white/60 rounded-lg p-3 border border-red-100">
                                    <h6 className="font-bold text-red-800 text-sm mb-2 flex items-center gap-2">
                                        <Ban size={14} className="text-red-600" />
                                        پرهیزات (نخورید)
                                    </h6>
                                    <div className="flex flex-wrap gap-2">
                                        {result.traditionalMedicine.forbiddenFoods?.length > 0 ? (
                                            result.traditionalMedicine.forbiddenFoods.map((item, idx) => (
                                                <span key={idx} className="text-xs font-medium text-red-900 bg-red-50 px-2 py-1 rounded">
                                                    {item}
                                                </span>
                                            ))
                                        ) : <span className="text-xs text-gray-400">موردی ذکر نشده</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Herbal Teas */}
                            <div className="mb-4">
                                <h6 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                                    <Coffee size={16} className="text-amber-600" />
                                    دمنوش‌ها و گیاهان دارویی پیشنهادی:
                                </h6>
                                <p className="text-sm text-amber-900 leading-relaxed bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                                    {result.traditionalMedicine.herbalRemedies?.join('، ') || 'موردی پیشنهاد نشده است.'}
                                </p>
                            </div>

                            {/* Lifestyle Tips */}
                            {result.traditionalMedicine.lifestyleTips?.length > 0 && (
                                <div>
                                    <h6 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                                        <Sunrise size={16} className="text-slate-500" />
                                        توصیه‌های سبک زندگی (Lifestyle):
                                    </h6>
                                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        {result.traditionalMedicine.lifestyleTips.map((tip, idx) => (
                                            <li key={idx}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {result.labAnalysis && <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6"><h5 className="font-bold text-blue-800 mb-2">تحلیل آزمایشات:</h5><p className="text-blue-900 whitespace-pre-line text-sm">{result.labAnalysis}</p></div>}
                {result.safetyWarnings && result.safetyWarnings.length > 0 && <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-6"><h5 className="font-bold text-amber-800 mb-2">هشدارها:</h5><ul className="list-disc list-inside text-amber-900">{result.safetyWarnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
            </div>
        )}
        
        {/* Prescription Form Section */}
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
                 <button onClick={saveInlinePrescription} className="flex items-center gap-2 bg-medical-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-medical-700 shadow-lg"><Printer size={20}/> تایید و چاپ</button>
             </div>
        </div>
      </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Modals */}
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

        {showHistoryModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fadeIn">
                    <button onClick={() => setShowHistoryModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
                    <h3 className="text-xl font-bold mb-6 text-gray-800">سوابق بیمار</h3>
                    {prescriptions.filter(rx => rx.patientId === selectedPatientId).reverse().map(rx => (
                        <div key={rx.id} className="border border-gray-200 rounded-xl mb-3 bg-white">
                            <div className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer" onClick={() => setExpandedHistoryId(expandedHistoryId === rx.id ? null : rx.id)}>
                                <span className="font-bold">{new Date(rx.date).toLocaleDateString('fa-IR')} - {rx.diagnosis}</span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            handleReprint(rx);
                                        }}
                                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-bold px-3 py-1 bg-white border border-blue-100 rounded-lg shadow-sm"
                                    >
                                        <Printer size={16} />
                                        چاپ مجدد
                                    </button>
                                    {expandedHistoryId===rx.id?<ChevronUp/>:<ChevronDown/>}
                                </div>
                            </div>
                            {expandedHistoryId === rx.id && (
                                <div className="p-4 border-t">
                                    {rx.medications.map((m,i)=><div key={i} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{m.name}</span><span>{m.dosage}</span></div>)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {showSafetyModal && (
            <div ref={modalRef} style={{ left: modalPosition.x, top: modalPosition.y }} className="fixed bg-white w-96 rounded-xl shadow-2xl border-2 border-amber-300 z-[100] overflow-hidden">
                <div onMouseDown={handleMouseDown} className="bg-amber-100 p-3 flex justify-between cursor-move"><span className="font-bold text-amber-800">ایمنی</span><button onClick={() => setShowSafetyModal(false)}><X size={16}/></button></div>
                <div className="p-4 max-h-80 overflow-y-auto space-y-2">{safetyResult?.interactions.map((w,i)=><div key={i} className="bg-orange-50 p-2 rounded text-xs text-orange-800 border border-orange-200">{w.description}</div>)}</div>
            </div>
        )}

        {/* SUPERVISOR MODAL */}
        {showSupervisorModal && supervisorResult && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                <div className="bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl relative animate-fadeIn border border-amber-600/50 flex flex-col max-h-[90vh] overflow-hidden">
                    
                    {/* Premium Header */}
                    <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-amber-900/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <ShieldAlert size={28} className="text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-amber-100">ناظر هوشمند بالینی</h3>
                                <p className="text-xs text-amber-500/80">بازبینی سطح ارشد (۹۰٪ تشخیص، ۱۰٪ ایمنی)</p>
                            </div>
                        </div>
                        <button onClick={() => setShowSupervisorModal(false)} className="text-slate-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        
                        {/* Verdict Banner */}
                        <div className={`flex items-center gap-4 p-4 rounded-xl border ${
                            supervisorResult.verdict === 'APPROVED' ? 'bg-green-900/20 border-green-500/30' :
                            supervisorResult.verdict === 'REJECTED' ? 'bg-red-900/20 border-red-500/30' :
                            'bg-yellow-900/20 border-yellow-500/30'
                        }`}>
                            <div className={`p-3 rounded-full ${
                                supervisorResult.verdict === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                supervisorResult.verdict === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                            }`}>
                                {supervisorResult.verdict === 'APPROVED' ? <CheckCircle size={32} /> : 
                                supervisorResult.verdict === 'REJECTED' ? <Ban size={32} /> : 
                                <AlertCircle size={32} />}
                            </div>
                            <div>
                                <h4 className={`text-2xl font-black ${
                                    supervisorResult.verdict === 'APPROVED' ? 'text-green-400' :
                                    supervisorResult.verdict === 'REJECTED' ? 'text-red-400' :
                                    'text-yellow-400'
                                }`}>
                                    {supervisorResult.verdict === 'APPROVED' ? 'تایید تشخیص' :
                                    supervisorResult.verdict === 'REJECTED' ? 'رد تشخیص' :
                                    'نیازمند اصلاح'}
                                </h4>
                                <p className="text-slate-400 text-sm mt-1">امتیاز صحت و منطق بالینی: <span className="font-bold text-white">{supervisorResult.score}/100</span></p>
                            </div>
                        </div>

                        {/* Main Critique */}
                        <div className="space-y-2">
                            <h5 className="font-bold text-amber-500 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Award size={16}/> خلاصه نظر کارشناسی
                            </h5>
                            <p className="text-slate-300 leading-relaxed bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                {supervisorResult.critiqueSummary}
                            </p>
                        </div>

                        {/* Flaws (90% Priority) */}
                        {supervisorResult.diagnosticFlaws.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="font-bold text-red-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <AlertTriangle size={16}/> خطاهای تشخیص و منطق
                                </h5>
                                <ul className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 space-y-2">
                                    {supervisorResult.diagnosticFlaws.map((flaw, i) => (
                                        <li key={i} className="flex gap-2 text-red-200 text-sm items-start">
                                            <span className="text-red-500 mt-0.5">•</span>
                                            {flaw}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Safety (10% Priority) */}
                        {supervisorResult.safetyConcerns.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="font-bold text-orange-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <ShieldAlert size={16}/> هشدارهای ایمنی و تداخل
                                </h5>
                                <ul className="bg-orange-950/20 border border-orange-900/30 rounded-xl p-4 space-y-2">
                                    {supervisorResult.safetyConcerns.map((issue, i) => (
                                        <li key={i} className="flex gap-2 text-orange-200 text-sm items-start">
                                            <span className="text-orange-500 mt-0.5">•</span>
                                            {issue}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Footer Action */}
                    <div className="p-5 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                        <button 
                            onClick={() => setShowSupervisorModal(false)}
                            className="px-5 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            بستن
                        </button>
                        
                        {supervisorResult.verdict !== 'APPROVED' && (
                            <button 
                                onClick={applySupervisorFeedback}
                                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-900/20 flex items-center gap-2 transition-all"
                            >
                                <BrainCircuit size={18} />
                                اعمال اصلاحات و بازبینی مجدد
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

      {/* --- PROFESSIONAL PRINT PREVIEW MODAL --- */}
      {showPrintPreview && previewPatient && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col z-[200] print-modal-container">
            {/* Toolbar (Screen Only) */}
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-md preview-toolbar border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold flex items-center gap-2 text-lg"><Printer size={20}/> پیش‌نمایش چاپ</h3>
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
                        <button onClick={() => setPrintScale(s => Math.max(0.3, s - 0.1))} className="p-2 hover:bg-slate-600 rounded text-slate-300 hover:text-white" title="کوچک‌نمایی"><ZoomOut size={18}/></button>
                        <span className="text-xs font-mono min-w-[3ch] text-center text-slate-300">{Math.round(printScale * 100)}%</span>
                        <button onClick={() => setPrintScale(s => Math.min(1.5, s + 0.1))} className="p-2 hover:bg-slate-600 rounded text-slate-300 hover:text-white" title="بزرگ‌نمایی"><ZoomIn size={18}/></button>
                        <div className="w-px h-4 bg-slate-600 mx-1"></div>
                        <button onClick={fitToScreen} className="px-3 py-1.5 hover:bg-slate-600 rounded text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1" title="Fit to Screen">
                            <MonitorPlay size={14}/> Auto Fit
                        </button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={closePreviewAndReset} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold transition-colors">بستن</button>
                    <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-colors"><Printer size={18}/> چاپ نهایی</button>
                </div>
            </div>

            {/* Scrollable Preview Area */}
            <div 
                className="flex-1 screen-preview-container p-8"
                ref={previewContainerRef}
            >
                <div 
                    className="paper-sheet"
                    style={{ 
                        transform: `scale(${printScale})`,
                        marginTop: '20px',
                        marginBottom: '100px'
                    }}
                >
                    {/* Header Image / Watermark */}
                    {doctorProfile.headerImage && (
                        <div className="watermark-layer" style={{ backgroundImage: `url(${doctorProfile.headerImage})` }}></div>
                    )}
                    
                    {/* Content Layer */}
                    <div className="paper-content h-full flex flex-col p-[12mm] text-black">
                        
                        {/* 1. Modern Minimal Header */}
                        <header className="flex flex-col items-center mb-10 pb-4 border-b-2 border-slate-900">
                            <h1 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">{doctorProfile.fullName || 'نام پزشک...'}</h1>
                            <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                <span>{doctorProfile.specialty || 'تخصص...'}</span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                <span className="font-mono">N.P: {doctorProfile.medicalSystemNumber}</span>
                            </div>
                        </header>

                        {/* 2. Clean Patient Row (No Box, No Phone) */}
                        <div className="flex justify-between items-center mb-8 px-2">
                             <div className="flex items-baseline gap-6 text-slate-800">
                                 <div>
                                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Name:</span>
                                     <span className="text-xl font-bold border-b border-slate-300 pb-1">{previewPatient.fullName}</span>
                                 </div>
                                 <div>
                                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Age:</span>
                                     <span className="text-xl font-bold border-b border-slate-300 pb-1 w-10 text-center inline-block">{previewPatient.age}</span>
                                 </div>
                             </div>
                             
                             <div>
                                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Date:</span>
                                 <span className="text-lg font-bold font-mono border-b border-slate-300 pb-1">{previewDate.toLocaleDateString('fa-IR')}</span>
                             </div>
                        </div>

                        {/* 3. Rx Symbol */}
                        <div className="mb-4 px-2">
                             <span className="text-6xl font-serif font-black text-slate-900">Rx</span>
                        </div>

                        {/* 4. Medications List (Clean Layout) */}
                        <div className="flex-1 px-4">
                            <ul className="space-y-6">
                                {previewMeds.map((m, i) => (
                                    <li key={i} className="relative pl-6 pb-2 print-break-inside-avoid">
                                        <div className="absolute left-0 top-2 text-slate-300 font-bold text-xs font-mono">{i + 1}.</div>
                                        <div className="flex justify-between items-baseline gap-4 mb-1">
                                            <span className="font-bold text-xl text-slate-900 ltr text-left">{m.name}</span>
                                            <span className="font-mono text-lg font-bold text-slate-600">{m.dosage}</span>
                                        </div>
                                        {m.instructions && (
                                            <div className="text-sm font-medium text-slate-500 italic pr-2">
                                                {m.instructions}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            {/* Diagnosis/Notes - Clean & Bottom */}
                            {(previewNotes || previewDiagnosis) && (
                                <div className="mt-12 pt-4 border-t border-dotted border-slate-300 print-break-inside-avoid">
                                    <div className="flex gap-6 text-xs font-bold text-slate-400 uppercase mb-2">
                                        {previewDiagnosis && <span>Dx: {previewDiagnosis}</span>}
                                        {previewNotes && <span>Note</span>}
                                    </div>
                                    <p className="text-sm leading-relaxed text-justify text-slate-600">{previewNotes}</p>
                                </div>
                            )}
                        </div>

                        {/* 5. Minimal Footer */}
                        <footer className="mt-auto pt-4 flex justify-between items-end">
                            <div className="text-[10px] text-slate-500 max-w-md">
                                <div className="font-bold mb-0.5">{doctorProfile.address}</div>
                                <div className="font-mono">{doctorProfile.phone}</div>
                            </div>
                            <div className="text-center">
                                <div className="h-16 w-32 mb-1"></div> {/* Signature Space */}
                                <div className="border-t border-slate-300 w-32"></div>
                                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Signature</p>
                            </div>
                        </footer>

                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};