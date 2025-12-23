
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, ArrowLeft, Mic, MicOff, Loader2, Search, AlertCircle, Activity, Lock, User, ChevronRight, ChevronLeft, Check, FileText, Stethoscope, Hash } from 'lucide-react';
import { PatientData, PatientVitals, PatientRecord } from '../types';
import { transcribeMedicalAudio } from '../services/geminiService';
import { saveRecord, getUniquePatients, getNextDisplayId } from '../services/db';

interface PatientIntakeProps {
  onSubmit: (record: PatientRecord) => void;
}

const PatientIntake: React.FC<PatientIntakeProps> = ({ onSubmit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState<Partial<PatientData>>({
    gender: 'male',
    vitals: {
      bloodPressure: '',
      heartRate: '',
      temperature: '',
      spO2: '',
      weight: '',
      height: '',
      respiratoryRate: '',
      bloodSugar: ''
    }
  });

  const [saving, setSaving] = useState(false);
  const [isPatientSelected, setIsPatientSelected] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    const patients = await getUniquePatients();
    setAllPatients(patients);
  };

  const handleSelectPatient = (patient: PatientRecord) => {
    setFormData(prev => ({
      ...prev,
      displayId: patient.displayId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      phoneNumber: patient.phoneNumber,
      history: patient.history,
      allergies: patient.allergies
    }));
    setSearchTerm('');
    setShowDropdown(false);
    setIsPatientSelected(true);
    if (window.innerWidth < 1024) {
        setMobileStep(2);
    }
  };

  const filteredPatients = allPatients.filter(p => 
    p.name.includes(searchTerm) || (p.displayId && p.displayId.includes(searchTerm))
  );

  const [recordingField, setRecordingField] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async (field: 'chiefComplaint' | 'history') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                      ? { mimeType: 'audio/webm;codecs=opus' } 
                      : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const type = options?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type });
        setIsProcessingAudio(true);
        try {
          const text = await transcribeMedicalAudio(audioBlob);
          setFormData(prev => ({ ...prev, [field]: (prev[field] || '') + ' ' + text }));
        } catch (error) { alert("خطا در تبدیل صدا به متن"); } finally {
          setIsProcessingAudio(false); setRecordingField(null); stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorder.start();
      setRecordingField(field);
    } catch (err) { alert("لطفا دسترسی به میکروفون را فعال کنید."); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop(); };

  const calculateMetrics = (weight: string, height: string) => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    let bmi = ''; let bsa = '';
    if (w > 0 && h > 0) {
      const heightInMeters = h / 100;
      const bmiVal = w / (heightInMeters * heightInMeters);
      bmi = bmiVal.toFixed(1);
      const bsaVal = Math.sqrt((h * w) / 3600);
      bsa = bsaVal.toFixed(2);
    }
    return { bmi, bsa };
  };

  const handleVitalChange = (key: keyof PatientVitals, value: string) => {
    setFormData(prev => {
        const newVitals = { ...prev.vitals!, [key]: value };
        if (key === 'weight' || key === 'height') {
            const { bmi, bsa } = calculateMetrics(key === 'weight' ? value : newVitals.weight, key === 'height' ? value : newVitals.height);
            newVitals.bmi = bmi; newVitals.bsa = bsa;
        }
        return { ...prev, vitals: newVitals };
    });
  };

  const getVitalStatus = (key: string, value: string): 'normal' | 'warning' | 'danger' => {
      if (!value) return 'normal';
      const num = parseFloat(value);
      if (isNaN(num)) return 'normal';
      switch (key) {
          case 'temperature': if (num >= 38) return 'danger'; if (num > 37.5) return 'warning'; break;
          case 'spO2': if (num < 90) return 'danger'; if (num < 95) return 'warning'; break;
          case 'heartRate': if (num > 100 || num < 50) return 'warning'; break;
          case 'respiratoryRate': if (num > 24 || num < 10) return 'warning'; break;
          case 'bloodSugar': if (num > 140 || num < 70) return 'warning'; if (num > 200) return 'danger'; break;
          case 'bloodPressure': const sys = parseInt(value.split('/')[0]); if (sys > 140) return 'warning'; if (sys > 180) return 'danger'; break;
      }
      return 'normal';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'labReport') => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (formData.name && formData.chiefComplaint) {
      setSaving(true);
      try {
        const record: PatientRecord = {
          ...(formData as PatientData),
          id: crypto.randomUUID(),
          visitDate: Date.now(),
          status: 'waiting',
          imageBlob: formData.image ? formData.image : undefined,
          labReportBlob: formData.labReport ? formData.labReport : undefined
        };
        await saveRecord(record);
        onSubmit(record);
      } catch (err) { alert('خطا در ذخیره پرونده'); } finally { setSaving(false); }
    }
  };

  const DictationButton = ({ field, className = "" }: { field: 'chiefComplaint' | 'history', className?: string }) => (
    <button type="button" onClick={() => recordingField === field ? stopRecording() : startRecording(field)} disabled={isProcessingAudio || (recordingField !== null && recordingField !== field)} className={`${className} transition-all ${recordingField === field ? 'bg-red-500 text-white animate-pulse shadow-lg ring-4 ring-red-200' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600'}`} title={isProcessingAudio ? 'در حال تبدیل...' : 'دیکته صوتی هوشمند'}>{isProcessingAudio && recordingField === field ? <Loader2 className="animate-spin w-5 h-5" /> : recordingField === field ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
  );

  return (
    <div className="animate-fade-in pb-20">
      <div className="lg:hidden flex flex-col min-h-[85vh]">
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><User className="text-blue-600" size={20} />{formData.name ? formData.name : 'مشاوره جدید'}</h2>
            <div className="flex items-center gap-2">{[1, 2, 3].map(step => (<div key={step} className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden relative"><div className={`absolute inset-0 bg-blue-600 transition-all duration-500 ${step <= mobileStep ? 'w-full' : 'w-0'}`}></div></div>))}</div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-bold"><span className={mobileStep >= 1 ? 'text-blue-600' : ''}>شناسایی</span><span className={mobileStep >= 2 ? 'text-blue-600' : ''}>علائم حیاتی</span><span className={mobileStep >= 3 ? 'text-blue-600' : ''}>شرح حال</span></div>
         </div>
         <div className="flex-1 p-4 overflow-y-auto">
            {mobileStep === 1 && (
               <div className="space-y-6 animate-slide-up">
                  <div className="bg-blue-50 p-6 rounded-3xl text-center"><div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-md"><Search size={32} /></div><h3 className="text-xl font-bold text-blue-900 mb-2">پرونده کیست؟</h3><p className="text-blue-600/70 text-sm">نام یا کد بیمار را جستجو کنید</p></div>
                  <div className="relative"><input autoFocus className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 text-lg shadow-sm font-bold" placeholder="نام یا کد (مثلاً 001)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                     {searchTerm && filteredPatients.length > 0 && (<div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 overflow-hidden">{filteredPatients.map(p => (<button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full p-4 text-right border-b border-gray-50 flex justify-between items-center active:bg-blue-50"><div className="flex items-center gap-3"><span className="text-xs bg-gray-800 text-white px-2 py-0.5 rounded">#{p.displayId}</span><span className="font-bold">{p.name}</span></div><ChevronLeft size={16} className="text-gray-300" /></button>))}</div>)}
                  </div>
                  {isPatientSelected && (<div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 animate-fade-in"><div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${formData.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`}><User /></div><div><h4 className="font-bold text-lg text-gray-800">{formData.name}</h4><p className="text-sm text-gray-500">{formData.age} ساله • کد #{formData.displayId}</p></div><Check className="mr-auto text-green-500" /></div>)}
               </div>
            )}
            {mobileStep === 2 && (
               <div className="space-y-4 animate-slide-up"><div className="grid grid-cols-2 gap-3">{[{ l: 'فشار خون', k: 'bloodPressure', ph: '120/80' },{ l: 'ضربان قلب', k: 'heartRate', ph: '75' },{ l: 'دما', k: 'temperature', ph: '37' },{ l: 'اکسیژن', k: 'spO2', ph: '98' },{ l: 'قند خون', k: 'bloodSugar', ph: '100' },{ l: 'تعداد تنفس', k: 'respiratoryRate', ph: '16' },{ l: 'وزن (kg)', k: 'weight', ph: '70' },{ l: 'قد (cm)', k: 'height', ph: '175' }].map((item) => (<div key={item.k} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all"><label className="text-xs font-bold text-gray-400 block mb-1">{item.l}</label><input type="text" className="w-full text-lg font-bold text-gray-800 outline-none text-center placeholder-gray-200" placeholder={item.ph} value={formData.vitals?.[item.k as keyof PatientVitals] || ''} onChange={e => handleVitalChange(item.k as keyof PatientVitals, e.target.value)} /></div>))}</div>{formData.vitals?.bmi && (<div className="bg-blue-50 p-3 rounded-xl text-center text-sm text-blue-800 font-bold">BMI: {formData.vitals.bmi}</div>)}</div>
            )}
            {mobileStep === 3 && (
               <div className="space-y-6 animate-slide-up"><div className="space-y-2"><label className="text-sm font-bold text-gray-700 flex items-center justify-between">شکایت اصلی <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">اجباری</span></label><div className="relative"><textarea className="w-full p-4 bg-white border border-gray-200 rounded-2xl h-32 resize-none focus:ring-2 focus:ring-blue-500 outline-none" placeholder="علت مراجعه..." value={formData.chiefComplaint || ''} onChange={e => setFormData(prev => ({ ...prev, chiefComplaint: e.target.value }))} /><DictationButton field="chiefComplaint" className="absolute bottom-3 left-3 p-2 rounded-xl" /></div></div><div className="space-y-2"><label className="text-sm font-bold text-gray-700">سوابق پزشکی</label><div className="relative"><textarea className="w-full p-4 bg-white border border-gray-200 rounded-2xl h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none" placeholder="بیماری‌های زمینه‌ای..." value={formData.history || ''} onChange={e => setFormData(prev => ({ ...prev, history: e.target.value }))} /><DictationButton field="history" className="absolute bottom-3 left-3 p-2 rounded-xl" /></div></div><div className="grid grid-cols-2 gap-3"><div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden h-24"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, 'image')} /><Camera className="text-gray-400 mb-1" /><span className="text-xs font-bold text-gray-500">{formData.image ? 'عکس انتخاب شد' : 'عکس چهره'}</span></div><div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden h-24"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, 'labReport')} /><Upload className="text-gray-400 mb-1" /><span className="text-xs font-bold text-gray-500">{formData.labReport ? 'فایل انتخاب شد' : 'آپلود آزمایش'}</span></div></div></div>
            )}
         </div>
         <div className="sticky bottom-0 bg-white p-4 border-t border-gray-100 flex gap-3 z-30 pb-safe">{mobileStep > 1 && (<button onClick={() => setMobileStep(s => (s - 1) as any)} className="p-4 bg-gray-100 rounded-2xl text-gray-600"><ArrowLeft size={24} /></button>)}{mobileStep < 3 ? (<button onClick={() => setMobileStep(s => (s + 1) as any)} disabled={mobileStep === 1 && !isPatientSelected} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50">مرحله بعد <ChevronLeft size={20} /></button>) : (<button onClick={() => handleSubmit()} disabled={saving || !formData.chiefComplaint} className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : <Stethoscope />} شروع تشخیص</button>)}</div>
      </div>

      <div className="hidden lg:block bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="mb-8">
           <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2"><span className="w-2 h-8 bg-blue-600 rounded-full"></span>مشاوره هوشمند (Smart Consult)</h2>
           <div className="relative z-20"><label className="text-sm font-bold text-gray-600 mb-2 block">فراخوانی پرونده بیمار</label><div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 transition-all focus-within:ring-2 focus-within:ring-blue-200"><Search className="text-blue-500" /><input className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400 font-bold" placeholder="جستجوی نام یا کد پرونده..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} /></div>
              {showDropdown && searchTerm && filteredPatients.length > 0 && (<div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-48 overflow-y-auto z-50">{filteredPatients.map(p => (<button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full text-right p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between items-center"><div className="flex items-center gap-2"><span className="text-[10px] bg-gray-800 text-white px-2 py-0.5 rounded">#{p.displayId}</span><span className="font-bold">{p.name}</span></div><span className="text-xs text-gray-400 bg-gray-100 px-2 rounded">{p.age} ساله</span></button>))}</div>)}
           </div>
           {!isPatientSelected && (<div className="mt-2 text-sm text-amber-600 flex items-center gap-1"><AlertCircle size={14} /><span>لطفا ابتدا بیمار را از کادر جستجو انتخاب کنید.</span></div>)}
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 opacity-90">
            <div className="space-y-2 relative"><label className="text-sm font-medium text-gray-700 flex items-center gap-1">کد پرونده <Lock size={12} className="text-gray-400" /></label><input readOnly className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 outline-none" value={formData.displayId || ''} placeholder="---" /></div>
            <div className="space-y-2 relative"><label className="text-sm font-medium text-gray-700 flex items-center gap-1">نام و نام خانوادگی <Lock size={12} className="text-gray-400" /></label><input readOnly className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none focus:outline-none" placeholder="از جستجو استفاده کنید..." value={formData.name || ''} /></div>
            <div className="space-y-2 relative"><label className="text-sm font-medium text-gray-700 flex items-center gap-1">سن <Lock size={12} className="text-gray-400" /></label><input readOnly type="number" className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none focus:outline-none" placeholder="---" value={formData.age || ''} /></div>
            <div className="space-y-2 relative"><label className="text-sm font-medium text-gray-700 flex items-center gap-1">جنسیت <Lock size={12} className="text-gray-400" /></label><div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 opacity-70 pointer-events-none"><button type="button" disabled className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formData.gender === 'male' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>آقا</button><button type="button" disabled className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formData.gender === 'female' ? 'bg-white shadow text-pink-600' : 'text-gray-400'}`}>خانم</button></div></div>
          </div>
          <div className={`transition-opacity duration-300 ${!isPatientSelected ? 'opacity-50 pointer-events-none filter blur-[1px]' : 'opacity-100'}`}>
            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden"><div className="absolute top-0 left-0 p-2 opacity-10"><Activity size={100} /></div><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-blue-900 flex items-center gap-2"><Activity size={20} />علائم حیاتی (مشاوره جدید)</h3><div className="flex gap-4 text-xs font-mono text-gray-500">{formData.vitals?.bmi && <span>BMI: <strong>{formData.vitals.bmi}</strong></span>}{formData.vitals?.bsa && <span>BSA: <strong>{formData.vitals.bsa}m²</strong></span>}</div></div><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">{[{ label: 'فشار خون', key: 'bloodPressure', ph: '120/80', unit: 'mmHg' },{ label: 'ضربان قلب', key: 'heartRate', ph: '75', unit: 'bpm' },{ label: 'تعداد تنفس', key: 'respiratoryRate', ph: '16', unit: 'rpm' },{ label: 'دمای بدن', key: 'temperature', ph: '37', unit: '°C' },{ label: 'اکسیژن خون', key: 'spO2', ph: '98', unit: '%' },{ label: 'قند خون (BS)', key: 'bloodSugar', ph: '100', unit: 'mg/dL' },{ label: 'وزن', key: 'weight', ph: '70', unit: 'kg' },{ label: 'قد', key: 'height', ph: '175', unit: 'cm' },].map((field) => {
                    const val = formData.vitals?.[field.key as keyof PatientVitals] || '';
                    const status = getVitalStatus(field.key, val);
                    const borderClass = status === 'danger' ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : status === 'warning' ? 'border-orange-400 ring-2 ring-orange-100 bg-orange-50' : 'border-blue-200 bg-white';
                    return (<div key={field.key} className="space-y-1"><label className="text-xs font-semibold text-gray-500 flex justify-between">{field.label}{status === 'danger' && <AlertCircle size={12} className="text-red-500" />}</label><div className="relative"><input type="text" className={`w-full p-2 rounded-lg text-center font-mono focus:outline-none transition-all ${borderClass}`} placeholder={field.ph} value={val} onChange={e => handleVitalChange(field.key as keyof PatientVitals, e.target.value)} /><span className="absolute right-2 top-2 text-[10px] text-gray-400 pointer-events-none hidden">{field.unit}</span></div></div>);
                })}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6"><div className="space-y-2 relative"><label className="text-sm font-medium text-gray-700">شکایت اصلی (Chief Complaint)</label><div className="relative"><textarea required className="w-full p-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none leading-relaxed" placeholder="بیمار با چه علائمی مراجعه کرده است؟" value={formData.chiefComplaint || ''} onChange={e => setFormData(prev => ({ ...prev, chiefComplaint: e.target.value }))} /><DictationButton field="chiefComplaint" className="absolute top-2 left-2 p-2 rounded-full" /></div></div><div className="space-y-2"><label className="text-sm font-medium text-gray-700">سوابق پزشکی (History)</label><div className="relative"><textarea className="w-full p-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none leading-relaxed" placeholder="بیماری‌های زمینه‌ای، داروهای مصرفی..." value={formData.history || ''} onChange={e => setFormData(prev => ({ ...prev, history: e.target.value }))} /><DictationButton field="history" className="absolute top-2 left-2 p-2 rounded-full" /></div></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6"><div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors relative cursor-pointer group"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, 'image')} /><div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Camera /></div><p className="text-sm font-medium text-gray-700">آپلود عکس بیمار</p><p className="text-xs text-gray-400 mt-1">{formData.image ? formData.image.name : 'برای تشخیص مزاج و علائم ظاهری'}</p></div><div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors relative cursor-pointer group"><input type="file" accept="image/*,.pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, 'labReport')} /><div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Upload /></div><p className="text-sm font-medium text-gray-700">آپلود آزمایشات قبلی</p><p className="text-xs text-gray-400 mt-1">{formData.labReport ? formData.labReport.name : 'عکس یا فایل آزمایشات همراه'}</p></div></div>
          </div>
          <div className="fixed bottom-6 left-6 right-6 lg:left-12 lg:right-auto z-30"><button type="submit" disabled={saving || !isPatientSelected} className="w-full lg:w-96 bg-gradient-to-r from-blue-700 to-blue-500 text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">{saving ? (<><Loader2 className="animate-spin" /><span>در حال ثبت اطلاعات...</span></>) : (<><span>شروع تشخیص هوشمند</span><ArrowLeft /></>)}</button></div>
        </form>
      </div>
    </div>
  );
};

export default PatientIntake;
