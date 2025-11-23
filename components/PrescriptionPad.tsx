
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Printer, Save, Trash, FileText, Pill, ShieldCheck, Plus, LayoutTemplate, Mic, MicOff, Pencil, RefreshCw, Search } from 'lucide-react';

type NoteTab = 'notes' | 'diagnosis';
// Added 'templateName' to the active field types
type RxFieldFocus = { type: 'med'; index: number; field: 'name' | 'dosage' | 'instructions' } | { type: 'notes' } | { type: 'templateName' } | null;

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const PrescriptionPad: React.FC = () => {
  const { addPrescriptionTemplate, prescriptionTemplates, updatePrescriptionTemplate, deletePrescriptionTemplate } = useStore();
  
  // Template State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [medications, setMedications] = useState([{ name: '', dosage: '', instructions: '' }]);
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [activeTab, setActiveTab] = useState<NoteTab>('notes');
  const [searchTerm, setSearchTerm] = useState('');

  // Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
  const recognitionRef = useRef<any>(null);
  const [activeField, setActiveField] = useState<RxFieldFocus>(null);
  const activeFieldRef = useRef<RxFieldFocus>(null);
  const activeTabRef = useRef<NoteTab>('notes');

  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // --- Voice Dictation Logic ---
  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("مرورگر شما پشتیبانی نمی‌کند."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = dictationLang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      const transcript = finalTranscript.trim();
      if (!transcript) return;
      
      const currentField = activeFieldRef.current;
      const currentTab = activeTabRef.current;

      if (currentField) {
        if (currentField.type === 'templateName') {
             // Overwrite Logic for Template Name
             setTemplateName(transcript);
        } else if (currentField.type === 'notes') {
            // Append Logic
            if (currentTab === 'notes') setNotes(prev => (prev ? prev + ' ' : '') + transcript);
            else setDiagnosis(prev => (prev ? prev + ' ' : '') + transcript);
        } else if (currentField.type === 'med') {
            // Overwrite Logic
            setMedications(prev => {
                const newMeds = [...prev];
                if (newMeds[currentField.index]) newMeds[currentField.index][currentField.field] = transcript;
                return newMeds;
            });
        }
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  };

  const handleAddMed = () => {
    setMedications([...medications, { name: '', dosage: '', instructions: '' }]);
  };

  const handleEditTemplate = (template: any) => {
      setEditingId(template.id);
      setTemplateName(template.name);
      // Deep copy meds
      setMedications(JSON.parse(JSON.stringify(template.medications)));
      setNotes(template.notes || '');
      setDiagnosis(template.diagnosis || '');
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setTemplateName('');
      setMedications([{ name: '', dosage: '', instructions: '' }]);
      setNotes('');
      setDiagnosis('');
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
        alert('لطفاً نام الگو را وارد کنید (مثلاً: پروتکل سرماخوردگی).');
        return;
    }
    const validMeds = medications.filter(m => m.name.trim() !== '');
    if (validMeds.length === 0) {
        alert('حداقل یک قلم دارو وارد کنید.');
        return;
    }

    if (editingId) {
        // Update Logic
        updatePrescriptionTemplate({
            id: editingId,
            name: templateName,
            medications: validMeds,
            notes,
            diagnosis
        });
        alert('الگوی نسخه با موفقیت بروزرسانی شد.');
        handleCancelEdit(); // Reset form
    } else {
        // Add Logic
        addPrescriptionTemplate({
            name: templateName,
            medications: validMeds,
            notes,
            diagnosis
        });
        alert('الگوی نسخه با موفقیت ذخیره شد و در بخش تشخیص قابل استفاده است.');
        // Reset form
        setTemplateName('');
        setMedications([{ name: '', dosage: '', instructions: '' }]);
        setNotes('');
        setDiagnosis('');
    }
  };

  // Filter templates
  const filteredTemplates = prescriptionTemplates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">مدیریت نسخه‌های آماده (الگوها)</h2>
            <p className="text-gray-500 text-sm mt-1">در این بخش نسخه‌های پرتکرار را تعریف کنید تا در هنگام ویزیت با یک کلیک بارگذاری شوند.</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
          
        {/* Left Side: Template List */}
        <div className="w-1/3 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <LayoutTemplate size={20}/>
                        الگوهای ذخیره شده
                    </h3>
                    {editingId && (
                        <button onClick={handleCancelEdit} className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 hover:bg-gray-300">
                            انصراف از ویرایش
                        </button>
                    )}
                </div>
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text"
                        placeholder="جستجو در الگوها..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-medical-500 focus:ring-1 focus:ring-medical-200 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {prescriptionTemplates.length === 0 && (
                    <div className="text-center text-gray-400 mt-10">
                        <FileText size={48} className="mx-auto mb-2 opacity-20"/>
                        <p>هنوز الگویی تعریف نشده است.</p>
                    </div>
                )}
                {prescriptionTemplates.length > 0 && filteredTemplates.length === 0 && (
                     <div className="text-center text-gray-400 mt-10">
                        <p>الگویی با این نام یافت نشد.</p>
                     </div>
                )}
                {filteredTemplates.map(template => (
                    <div key={template.id} className={`border rounded-xl p-4 transition-all bg-white group ${editingId === template.id ? 'border-medical-500 ring-2 ring-medical-100' : 'border-gray-200 hover:border-medical-300 hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-800">{template.name}</h4>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleEditTemplate(template)}
                                    className="text-amber-400 hover:text-amber-600 p-1 bg-amber-50 rounded-md transition-colors"
                                    title="ویرایش"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button 
                                    onClick={() => {
                                        if(confirm('آیا از حذف این الگو اطمینان دارید؟')) deletePrescriptionTemplate(template.id);
                                    }}
                                    className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded-md transition-colors"
                                    title="حذف"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{template.medications.length} قلم دارو</p>
                        <div className="flex flex-wrap gap-1">
                            {template.medications.slice(0, 3).map((m, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">{m.name}</span>
                            ))}
                            {template.medications.length > 3 && <span className="text-[10px] text-gray-400 px-1">...</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Right Side: Template Editor */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col overflow-hidden">
            <div className={`p-6 border-b border-gray-200 flex justify-between items-center ${editingId ? 'bg-amber-50' : 'bg-medical-50'}`}>
                <div className="flex-1 ml-4">
                    <label className={`block text-xs font-bold mb-1 ${editingId ? 'text-amber-700' : 'text-medical-700'}`}>
                        {editingId ? 'در حال ویرایش الگو:' : 'نام الگوی جدید (مثلاً: پروتکل دیابت)'}
                    </label>
                    <input 
                        type="text" 
                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-medical-500 outline-none font-bold text-gray-800"
                        placeholder="نام الگو را وارد کنید..."
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        onFocus={() => setActiveField({ type: 'templateName' })}
                    />
                </div>
                {/* Voice Controls */}
                <div className="flex items-center gap-2 mr-4">
                    <button 
                    onClick={() => setDictationLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR')}
                    className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors border border-slate-200"
                    >
                    {dictationLang === 'fa-IR' ? 'FA' : 'EN'}
                    </button>
                    <button 
                    onClick={toggleRecording}
                    className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-200 shadow-lg' : 'bg-white text-gray-500 hover:bg-medical-100 hover:text-medical-600 border border-gray-300'}`}
                    title={isRecording ? 'توقف ضبط' : 'شروع تایپ صوتی'}
                    >
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* Medications List */}
                <div className="space-y-6 mb-8">
                    {medications.map((med, idx) => (
                        <div key={idx} className="flex gap-4 items-start">
                            <div className="pt-3 text-gray-400 font-bold text-lg w-8 text-center bg-gray-50 rounded">{idx + 1}</div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="relative group">
                                    <label className="text-xs font-bold text-gray-400 mb-1 block group-focus-within:text-medical-600 transition-colors">نام دارو</label>
                                    <input 
                                        type="text" 
                                        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-medical-200 focus:border-medical-500 outline-none font-bold ltr text-left transition-all duration-200 ${activeField?.type === 'med' && activeField.index === idx && activeField.field === 'name' ? 'ring-2 ring-medical-100 border-medical-400 bg-white' : ''}`}
                                        placeholder="Medication Name"
                                        value={med.name}
                                        onFocus={() => setActiveField({ type: 'med', index: idx, field: 'name' })}
                                        onChange={(e) => {
                                            const newMeds = [...medications];
                                            newMeds[idx].name = e.target.value;
                                            setMedications(newMeds);
                                        }}
                                    />
                                </div>
                                <div className="group">
                                    <label className="text-xs font-bold text-gray-400 mb-1 block group-focus-within:text-medical-600 transition-colors">دوز</label>
                                    <input 
                                        type="text" 
                                        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-medical-200 focus:border-medical-500 outline-none ltr text-left transition-all duration-200 ${activeField?.type === 'med' && activeField.index === idx && activeField.field === 'dosage' ? 'ring-2 ring-medical-100 border-medical-400 bg-white' : ''}`}
                                        placeholder="Dosage"
                                        value={med.dosage}
                                        onFocus={() => setActiveField({ type: 'med', index: idx, field: 'dosage' })}
                                        onChange={(e) => {
                                            const newMeds = [...medications];
                                            newMeds[idx].dosage = e.target.value;
                                            setMedications(newMeds);
                                        }}
                                    />
                                </div>
                                <div className="group">
                                    <label className="text-xs font-bold text-gray-400 mb-1 block group-focus-within:text-medical-600 transition-colors">دستور</label>
                                    <input 
                                        type="text" 
                                        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-medical-200 focus:border-medical-500 outline-none transition-all duration-200 ${activeField?.type === 'med' && activeField.index === idx && activeField.field === 'instructions' ? 'ring-2 ring-medical-100 border-medical-400 bg-white' : ''}`}
                                        placeholder="دستور مصرف"
                                        value={med.instructions}
                                        onFocus={() => setActiveField({ type: 'med', index: idx, field: 'instructions' })}
                                        onChange={(e) => {
                                            const newMeds = [...medications];
                                            newMeds[idx].instructions = e.target.value;
                                            setMedications(newMeds);
                                        }}
                                    />
                                </div>
                            </div>
                            <button onClick={() => {
                                const newMeds = medications.filter((_, i) => i !== idx);
                                setMedications(newMeds);
                            }} className="text-red-300 hover:text-red-600 pt-6"><Trash size={18} /></button>
                        </div>
                    ))}
                </div>

                <button onClick={handleAddMed} className="text-medical-600 font-bold hover:bg-medical-50 px-4 py-2 rounded-lg mb-8 transition-colors border border-dashed border-medical-300 w-full flex items-center justify-center gap-2">
                    <Plus size={18} />
                    افزودن قلم دارو
                </button>

                {/* Tabbed Notes */}
                <div>
                    <div className="flex gap-1 border-b border-gray-200">
                        <button 
                            onClick={() => setActiveTab('notes')}
                            className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${activeTab === 'notes' ? 'bg-white border-t border-x border-gray-200 text-medical-700 -mb-[1px] shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            <span className="flex items-center gap-2"><FileText size={16}/> توضیحات (پیش‌فرض)</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('diagnosis')}
                            className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${activeTab === 'diagnosis' ? 'bg-white border-t border-x border-gray-200 text-amber-600 -mb-[1px] shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            <span className="flex items-center gap-2"><ShieldCheck size={16}/> تشخیص (پیش‌فرض)</span>
                        </button>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-4 shadow-sm">
                        {activeTab === 'notes' ? (
                            <textarea 
                                className={`w-full h-24 p-4 bg-white rounded-xl border border-gray-100 focus:ring-2 focus:ring-medical-100 outline-none transition-colors resize-none ${activeField?.type === 'notes' ? 'bg-blue-50/30' : ''}`}
                                value={notes}
                                onFocus={() => setActiveField({ type: 'notes' })}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="توضیحات پیش‌فرض برای این الگو (اختیاری)..."
                            ></textarea>
                        ) : (
                            <textarea 
                                className={`w-full h-24 p-4 bg-amber-50/30 rounded-xl border border-amber-100 focus:ring-2 focus:ring-amber-100 outline-none transition-colors resize-none ${activeField?.type === 'notes' ? 'bg-amber-50' : ''}`}
                                value={diagnosis}
                                onFocus={() => setActiveField({ type: 'notes' })}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                placeholder="تشخیص پیش‌فرض برای این الگو (اختیاری)..."
                            ></textarea>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button onClick={handleSaveTemplate} className={`flex items-center gap-2 text-white px-8 py-3 rounded-xl shadow-lg transition-all font-bold ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-medical-600 hover:bg-medical-700'}`}>
                    {editingId ? <RefreshCw size={20} /> : <Save size={20} />}
                    {editingId ? 'بروزرسانی الگو' : 'ذخیره الگو'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
