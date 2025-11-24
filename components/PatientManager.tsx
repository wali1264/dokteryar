
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Gender, Prescription } from '../types';
import { Plus, Search, User, X, FileText, Clock, Printer, Pencil, ChevronDown, ChevronUp, FileSignature, Mic, MicOff, MonitorPlay, ZoomIn, ZoomOut } from 'lucide-react';

// Speech Recognition Type Definition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const PatientManager: React.FC = () => {
  const { patients, addPatient, updatePatient, prescriptions, doctorProfile } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null); // ID of patient to show history for
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Printing State
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedRxForPrint, setSelectedRxForPrint] = useState<Prescription | null>(null);
  const [printScale, setPrintScale] = useState(0.5);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
  const recognitionRef = useRef<any>(null);
  const [activeField, setActiveField] = useState<keyof typeof formData | null>(null);
  const activeFieldRef = useRef<keyof typeof formData | null>(null); // For closure access

  useEffect(() => {
      activeFieldRef.current = activeField;
  }, [activeField]);

  // Auto-Fit Logic on Open Print Preview
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

  const handlePrintRx = (rx: Prescription) => {
      setSelectedRxForPrint(rx);
      setShowPrintPreview(true);
  };

  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    gender: Gender.Male,
    phone: '',
    medicalHistory: '',
    allergies: ''
  });

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("مرورگر شما از تایپ صوتی پشتیبانی نمی‌کند.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = dictationLang;
    recognition.continuous = true;
    recognition.interimResults = false; // Append mode doesn't need interim usually

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      const transcript = finalTranscript.trim();
      const currentField = activeFieldRef.current;

      if (transcript && currentField) {
          // Always APPEND logic for registration form
          setFormData(prev => ({
              ...prev,
              [currentField]: prev[currentField] + (prev[currentField] ? ' ' : '') + transcript
          }));
      }
    };

    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsRecording(false);
        }
    };

    recognition.onend = () => {
       setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleEditClick = (patient: any) => {
    setFormData({
      fullName: patient.fullName,
      age: patient.age.toString(),
      gender: patient.gender,
      phone: patient.phone,
      medicalHistory: patient.medicalHistory,
      allergies: patient.allergies
    });
    setEditingId(patient.id);
    setShowForm(true);
  };

  const handleAddNewClick = () => {
    setFormData({ fullName: '', age: '', gender: Gender.Male, phone: '', medicalHistory: '', allergies: '' });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // Update existing patient
      const existingPatient = patients.find(p => p.id === editingId);
      if (existingPatient) {
        updatePatient({
          id: editingId,
          registeredAt: existingPatient.registeredAt, // Keep original registration date
          fullName: formData.fullName,
          age: Number(formData.age),
          gender: formData.gender as Gender,
          phone: formData.phone,
          medicalHistory: formData.medicalHistory,
          allergies: formData.allergies
        });
        alert("اطلاعات بیمار با موفقیت بروزرسانی شد.");
      }
    } else {
      // Add new patient
      addPatient({
        fullName: formData.fullName,
        age: Number(formData.age),
        gender: formData.gender as Gender,
        phone: formData.phone,
        medicalHistory: formData.medicalHistory,
        allergies: formData.allergies
      });
      alert("پرونده بیمار با موفقیت ایجاد شد.");
    }

    setShowForm(false);
    setEditingId(null);
    setFormData({ fullName: '', age: '', gender: Gender.Male, phone: '', medicalHistory: '', allergies: '' });
  };

  const filteredPatients = patients.filter(p => 
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  const getPatientPrescriptions = (pid: string) => prescriptions.filter(rx => rx.patientId === pid).reverse();

  // Helper for printing
  const printPatient = selectedRxForPrint ? patients.find(p => p.id === selectedRxForPrint.patientId) : null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">مدیریت بیماران</h2>
          <p className="text-gray-500 text-sm mt-1">لیست، ویرایش و پرونده‌های الکترونیک بیماران</p>
        </div>
        <button 
          onClick={handleAddNewClick}
          className="flex items-center gap-2 bg-medical-600 text-white px-5 py-2.5 rounded-xl hover:bg-medical-700 transition-colors shadow-md font-medium"
        >
          <Plus size={20} />
          <span>ثبت بیمار جدید</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text"
          placeholder="جستجو با نام یا شماره تماس..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-medical-500 focus:ring-2 focus:ring-medical-200 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-600 text-sm">نام بیمار</th>
              <th className="px-6 py-4 font-semibold text-gray-600 text-sm">سن / جنسیت</th>
              <th className="px-6 py-4 font-semibold text-gray-600 text-sm">شماره تماس</th>
              <th className="px-6 py-4 font-semibold text-gray-600 text-sm">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPatients.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-medical-50 p-2 rounded-full text-medical-600">
                      <User size={18} />
                    </div>
                    <span className="font-bold text-gray-900">{p.fullName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{p.age} ساله / {p.gender === 'Male' ? 'مرد' : p.gender === 'Female' ? 'زن' : 'سایر'}</td>
                <td className="px-6 py-4 text-gray-600 dir-ltr text-right">{p.phone}</td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                          onClick={() => handleEditClick(p)}
                          className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors text-sm font-bold"
                          title="ویرایش مشخصات"
                      >
                          <Pencil size={16} />
                          ویرایش
                      </button>
                      <button 
                          onClick={() => setShowHistory(p.id)}
                          className="flex items-center gap-1 text-medical-600 bg-medical-50 px-3 py-1.5 rounded-lg hover:bg-medical-100 transition-colors text-sm font-bold"
                      >
                          <Clock size={16} />
                          سوابق
                      </button>
                    </div>
                </td>
              </tr>
            ))}
            {filteredPatients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 flex flex-col items-center justify-center">
                  <User size={48} className="mb-3 opacity-20" />
                  بیماری یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Patient Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fadeIn">
            <button onClick={() => setShowForm(false)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600">
                <X size={24} />
            </button>
            
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800">
                {editingId ? 'ویرایش اطلاعات بیمار' : 'تشکیل پرونده جدید'}
                </h3>
                {/* Voice Controls with increased margin to avoid close button overlap */}
                <div className="flex items-center gap-2 ml-12">
                    <button 
                        onClick={() => setDictationLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR')}
                        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors border border-slate-200"
                    >
                        {dictationLang === 'fa-IR' ? 'FA' : 'EN'}
                    </button>
                    <button 
                        onClick={toggleRecording}
                        className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-200 shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-medical-100 hover:text-medical-600'}`}
                        title={isRecording ? 'توقف ضبط' : 'شروع تایپ صوتی (اضافه کردن)'}
                    >
                        {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نام و نام خانوادگی</label>
                <input 
                    required type="text" 
                    className={`w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none ${activeField === 'fullName' ? 'bg-blue-50' : ''}`}
                    value={formData.fullName} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                    onFocus={() => setActiveField('fullName')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">سن</label>
                  <input 
                    required type="number" 
                    className={`w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none ${activeField === 'age' ? 'bg-blue-50' : ''}`}
                    value={formData.age} 
                    onChange={e => setFormData({...formData, age: e.target.value})} 
                    onFocus={() => setActiveField('age')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">جنسیت</label>
                  <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none bg-white" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value as Gender})}>
                    <option value={Gender.Male}>مرد</option>
                    <option value={Gender.Female}>زن</option>
                    <option value={Gender.Other}>سایر</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">شماره تماس</label>
                <input 
                    required type="tel" 
                    className={`w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none text-left ${activeField === 'phone' ? 'bg-blue-50' : ''}`}
                    placeholder="09..." 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    onFocus={() => setActiveField('phone')}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سوابق بیماری (بسیار مهم)</label>
                <textarea 
                    className={`w-full p-3 border border-gray-300 rounded-xl h-24 focus:ring-2 focus:ring-medical-500 outline-none ${activeField === 'medicalHistory' ? 'bg-blue-50' : ''}`}
                    value={formData.medicalHistory} 
                    onChange={e => setFormData({...formData, medicalHistory: e.target.value})} 
                    onFocus={() => setActiveField('medicalHistory')}
                    placeholder="بارداری، دیابت، فشار خون، مشکلات قلبی..." 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">حساسیت‌های دارویی/غذایی (بسیار مهم)</label>
                <input 
                    type="text" 
                    className={`w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none ${activeField === 'allergies' ? 'bg-blue-50' : ''}`}
                    value={formData.allergies} 
                    onChange={e => setFormData({...formData, allergies: e.target.value})} 
                    onFocus={() => setActiveField('allergies')}
                    placeholder="مثال: پنی‌سیلین، بادام زمینی..." 
                />
              </div>
              
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors">انصراف</button>
                <button type="submit" className="flex-1 py-3 bg-medical-600 text-white rounded-xl hover:bg-medical-700 font-bold shadow-lg shadow-medical-500/30 transition-all">
                  {editingId ? 'بروزرسانی اطلاعات' : 'ثبت پرونده'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-fadeIn">
                <button onClick={() => setShowHistory(null)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>
                <h3 className="text-xl font-bold mb-2 text-gray-800">سوابق پزشکی و نسخه‌ها</h3>
                <p className="text-gray-500 mb-6 border-b pb-4">بیمار: {patients.find(p => p.id === showHistory)?.fullName}</p>

                <div className="space-y-4">
                      {getPatientPrescriptions(showHistory).length === 0 ? (
                          <p className="text-center text-gray-400 py-10">هیچ نسخه ثبت شده‌ای برای این بیمار یافت نشد.</p>
                      ) : (
                          getPatientPrescriptions(showHistory).map(rx => (
                              <div key={rx.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                  {/* History Header Item - Always Visible */}
                                  <div 
                                    className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => setExpandedHistoryId(expandedHistoryId === rx.id ? null : rx.id)}
                                  >
                                      <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-800 text-lg">{new Date(rx.date).toLocaleDateString('fa-IR')}</span>
                                            <span className="text-xs text-gray-400 px-2 py-0.5 border rounded-full">{new Date(rx.date).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'})}</span>
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                              <FileSignature size={16} className="text-medical-600" />
                                              <span className={`font-bold text-sm ${rx.diagnosis ? 'text-medical-700' : 'text-gray-400 italic'}`}>
                                                {rx.diagnosis || 'تشخیص نهایی ثبت نشده است'}
                                              </span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                handlePrintRx(rx);
                                            }}
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-bold px-3 py-2 bg-white border border-blue-100 rounded-lg shadow-sm z-10"
                                          >
                                              <Printer size={16} />
                                              چاپ مجدد
                                          </button>
                                          {expandedHistoryId === rx.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                                      </div>
                                  </div>
                                  
                                  {/* Expanded Details */}
                                  {expandedHistoryId === rx.id && (
                                    <div className="p-4 border-t border-gray-200 animate-fadeIn">
                                        <p className="text-xs text-gray-500 font-bold mb-2">اقلام دارویی تجویز شده:</p>
                                        <ul className="space-y-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            {rx.medications.map((m, i) => (
                                                <li key={i} className="flex justify-between text-sm">
                                                    <span className="font-bold ltr text-left">{m.name}</span>
                                                    <span className="text-gray-600 dir-ltr">{m.dosage} - {m.instructions}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {rx.notes && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <p className="text-xs text-gray-500 font-bold">توضیحات تکمیلی برای بیمار:</p>
                                                <p className="text-sm text-gray-700 mt-1">{rx.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                  )}
                              </div>
                          ))
                      )}
                </div>
            </div>
        </div>
      )}

      {/* --- PROFESSIONAL PRINT PREVIEW MODAL (MODERNIZED) --- */}
      {showPrintPreview && selectedRxForPrint && printPatient && (
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
                    <button onClick={() => {setShowPrintPreview(false); setSelectedRxForPrint(null);}} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold transition-colors">بستن</button>
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
                                     <span className="text-xl font-bold border-b border-slate-300 pb-1">{printPatient.fullName}</span>
                                 </div>
                                 <div>
                                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Age:</span>
                                     <span className="text-xl font-bold border-b border-slate-300 pb-1 w-10 text-center inline-block">{printPatient.age}</span>
                                 </div>
                             </div>
                             
                             <div>
                                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Date:</span>
                                 <span className="text-lg font-bold font-mono border-b border-slate-300 pb-1">{new Date(selectedRxForPrint.date).toLocaleDateString('fa-IR')}</span>
                             </div>
                        </div>

                        {/* 3. Rx Symbol */}
                        <div className="mb-4 px-2">
                             <span className="text-6xl font-serif font-black text-slate-900">Rx</span>
                        </div>

                        {/* 4. Medications List (Clean Layout) */}
                        <div className="flex-1 px-4">
                            <ul className="space-y-6">
                                {selectedRxForPrint.medications.map((m, i) => (
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
                            {(selectedRxForPrint.notes || selectedRxForPrint.diagnosis) && (
                                <div className="mt-12 pt-4 border-t border-dotted border-slate-300 print-break-inside-avoid">
                                    <div className="flex gap-6 text-xs font-bold text-slate-400 uppercase mb-2">
                                        {selectedRxForPrint.diagnosis && <span>Dx: {selectedRxForPrint.diagnosis}</span>}
                                        {selectedRxForPrint.notes && <span>Note</span>}
                                    </div>
                                    <p className="text-sm leading-relaxed text-justify text-slate-600">{selectedRxForPrint.notes}</p>
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
