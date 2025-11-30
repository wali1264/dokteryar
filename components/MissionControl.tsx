
import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Activity, Clock, Search, AlertCircle, CheckCircle, BrainCircuit, User, Thermometer, Droplets, Heart, Wind, Stethoscope, MessageSquare, Loader, Pencil, Save, X, BookOpen, Globe, Check } from 'lucide-react';
import { Visit, DiagnosisResult } from '../types';

export const MissionControl: React.FC = () => {
  const { activeVisits, fetchActiveVisits, respondToConsult, doctorProfile, runAdminDiagnosis, updateAiDiagnosis, isLoading, library } = useStore();
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  
  // AI Config State
  const [useWeb, setUseWeb] = useState(true);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState<DiagnosisResult | null>(null);

  useEffect(() => {
    fetchActiveVisits();
    const interval = setInterval(fetchActiveVisits, 15000); // Poll every 15s as backup to realtime
    return () => clearInterval(interval);
  }, []);

  // When selected visit changes, reset edit mode
  useEffect(() => {
    setIsEditing(false);
    if (selectedVisit && selectedVisit.aiAnalysis) {
        try {
            setEditedAnalysis(JSON.parse(selectedVisit.aiAnalysis));
        } catch {
            setEditedAnalysis(null);
        }
    } else {
        setEditedAnalysis(null);
    }
  }, [selectedVisit]);

  const pendingVisits = activeVisits.filter(v => v.status === 'pending_review');
  const reviewedVisits = activeVisits.filter(v => v.status === 'reviewed');

  const handleResolve = async (visit: Visit) => {
      await respondToConsult(visit.id, "Reviewed by Central Room");
      setSelectedVisit(null);
  };

  const handleRunAI = async () => {
      if (!selectedVisit) return;
      await runAdminDiagnosis(selectedVisit, selectedBookIds, useWeb);
      // Wait a moment for store to update then re-select to refresh view
      setTimeout(() => {
          const updated = useStore.getState().activeVisits.find(v => v.id === selectedVisit.id);
          if(updated) setSelectedVisit(updated);
      }, 1000);
  };

  const handleSaveEdit = async () => {
      if (!selectedVisit || !editedAnalysis) return;
      await updateAiDiagnosis(selectedVisit.id, (selectedVisit as any).diagnosisId, editedAnalysis);
      setIsEditing(false);
      // Refresh view
      setTimeout(() => {
          const updated = useStore.getState().activeVisits.find(v => v.id === selectedVisit.id);
          if(updated) setSelectedVisit(updated);
      }, 500);
  };

  const updateEditedField = (field: keyof DiagnosisResult, value: any) => {
      if (!editedAnalysis) return;
      setEditedAnalysis({ ...editedAnalysis, [field]: value });
  };

  const toggleBookSelection = (id: string) => {
      if (selectedBookIds.includes(id)) {
          setSelectedBookIds(prev => prev.filter(bid => bid !== id));
      } else {
          setSelectedBookIds(prev => [...prev, id]);
      }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* LEFT: LIVE FEED */}
      <div className="w-1/3 border-l border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-xl font-bold text-blue-400 flex items-center gap-3">
                  <Activity className="animate-pulse" />
                  اتاق فرمان (Live Triage)
              </h2>
              <p className="text-xs text-slate-500 mt-2">مانیتورینگ لحظه‌ای کلینیک</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {pendingVisits.length === 0 && (
                  <div className="text-center py-20 opacity-30">
                      <Stethoscope size={48} className="mx-auto mb-4"/>
                      <p>هیچ درخواست مشاوره‌ای فعال نیست.</p>
                  </div>
              )}
              
              {pendingVisits.map(visit => (
                  <div 
                    key={visit.id}
                    onClick={() => setSelectedVisit(visit)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedVisit?.id === visit.id ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                  >
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                              <h4 className="font-bold text-white">{visit.patientName || 'بیمار ناشناس'}</h4>
                          </div>
                          <span className="text-xs font-mono text-slate-500">{new Date(visit.visitDate).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="text-sm text-slate-400 mb-2 line-clamp-2">{visit.symptoms || 'بدون شرح حال'}</p>
                      <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-400 bg-blue-900/30 px-2 py-1 rounded">دکتر {visit.doctorName}</span>
                          <span className="text-amber-500">درخواست مشاوره فوری</span>
                      </div>
                  </div>
              ))}

              {reviewedVisits.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-8 mb-2 px-2 text-xs font-bold text-slate-600 uppercase tracking-widest">
                        <CheckCircle size={12}/> بررسی شده (۲۴ ساعت اخیر)
                    </div>
                    {reviewedVisits.map(visit => (
                        <div key={visit.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="flex justify-between">
                                <span className="font-bold text-sm text-slate-300">{visit.patientName}</span>
                                <span className="text-green-500 text-xs">تکمیل شده</span>
                            </div>
                        </div>
                    ))}
                  </>
              )}
          </div>
      </div>

      {/* RIGHT: DETAIL VIEW */}
      <div className="flex-1 bg-slate-950 relative flex flex-col">
          {selectedVisit ? (
              <>
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">{selectedVisit.patientName}</h1>
                        <div className="flex gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1"><User size={14}/> {selectedVisit.patientAge} ساله</span>
                            <span className="flex items-center gap-1"><Clock size={14}/> زمان ثبت: {new Date(selectedVisit.visitDate).toLocaleString('fa-IR')}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleResolve(selectedVisit)}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all"
                    >
                        <CheckCircle size={20}/>
                        تایید و ارسال پاسخ به پزشک
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {/* Vitals Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <span className="text-slate-500 text-xs font-bold block mb-1">فشار خون</span>
                            <span className="text-xl font-mono font-bold text-white">{selectedVisit.vitals.bloodPressure || '--'}</span>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <span className="text-slate-500 text-xs font-bold block mb-1">ضربان قلب</span>
                            <div className="flex items-center gap-2 text-rose-500">
                                <Heart size={18}/>
                                <span className="text-xl font-mono font-bold">{selectedVisit.vitals.heartRate || '--'}</span>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <span className="text-slate-500 text-xs font-bold block mb-1">اکسیژن خون</span>
                            <div className="flex items-center gap-2 text-cyan-500">
                                <Wind size={18}/>
                                <span className="text-xl font-mono font-bold">{selectedVisit.vitals.oxygenLevel ? selectedVisit.vitals.oxygenLevel + '%' : '--'}</span>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <span className="text-slate-500 text-xs font-bold block mb-1">دما</span>
                            <div className="flex items-center gap-2 text-orange-500">
                                <Thermometer size={18}/>
                                <span className="text-xl font-mono font-bold">{selectedVisit.vitals.temperature || '--'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Symptoms */}
                        <div className="space-y-4">
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2">
                                    <MessageSquare size={20} className="text-blue-500"/>
                                    شرح حال بالینی
                                </h3>
                                <p className="text-slate-300 leading-relaxed text-lg">
                                    {selectedVisit.symptoms}
                                </p>
                            </div>
                        </div>

                        {/* AI Analysis */}
                        <div className="space-y-4">
                            {selectedVisit.aiAnalysis ? (
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg">
                                        Gemini 1.5 Analysis
                                    </div>
                                    <div className="flex justify-between items-start mt-2 mb-4">
                                        <h3 className="font-bold text-slate-300 flex items-center gap-2">
                                            <BrainCircuit size={20} className="text-purple-500"/>
                                            تحلیل هوشمند
                                        </h3>
                                        <button 
                                            onClick={() => setIsEditing(!isEditing)} 
                                            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 text-slate-300 transition-colors"
                                        >
                                            <Pencil size={12} />
                                            {isEditing ? 'لغو ویرایش' : 'ویرایش تشخیص'}
                                        </button>
                                    </div>
                                    
                                    <div className="text-slate-400 text-sm space-y-4">
                                        {/* Parsing JSON if possible, else showing raw text */}
                                        {(() => {
                                            if (isEditing && editedAnalysis) {
                                                // EDIT MODE UI
                                                return (
                                                    <div className="space-y-4 animate-fadeIn">
                                                        <div>
                                                            <label className="text-purple-400 text-xs font-bold uppercase mb-1 block">Diagnosis Title</label>
                                                            <input 
                                                                value={editedAnalysis.diagnosis}
                                                                onChange={e => updateEditedField('diagnosis', e.target.value)}
                                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-purple-400 text-xs font-bold uppercase mb-1 block">Reasoning</label>
                                                            <textarea 
                                                                value={editedAnalysis.reasoning}
                                                                onChange={e => updateEditedField('reasoning', e.target.value)}
                                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white h-32 focus:border-purple-500 outline-none resize-none"
                                                            />
                                                        </div>
                                                        <div className="flex justify-end gap-2 pt-2">
                                                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-400 hover:text-white">انصراف</button>
                                                            <button onClick={handleSaveEdit} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                                                                {isLoading ? <Loader size={16} className="animate-spin"/> : <Save size={16}/>}
                                                                ذخیره تغییرات
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            try {
                                                const analysis = JSON.parse(selectedVisit.aiAnalysis);
                                                return (
                                                    <>
                                                        <div className="mb-3">
                                                            <span className="block text-purple-400 text-xs font-bold uppercase mb-1">Diagnosis</span>
                                                            <span className="text-lg font-bold text-white">{analysis.diagnosis}</span>
                                                        </div>
                                                        <p className="bg-slate-950 p-3 rounded-lg border border-slate-800">{analysis.reasoning}</p>
                                                    </>
                                                );
                                            } catch {
                                                return <p>{selectedVisit.aiAnalysis}</p>;
                                            }
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center text-slate-600">
                                    <BrainCircuit size={40} className="mx-auto mb-4 opacity-20"/>
                                    <p className="mb-6 font-bold text-slate-500">تحلیل هوشمند موجود نیست. پیکربندی و اجرا کنید:</p>
                                    
                                    {/* Knowledge Configuration */}
                                    <div className="bg-slate-800 rounded-xl p-4 text-left mb-6 max-w-sm mx-auto">
                                        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-700">
                                            <div onClick={() => setUseWeb(!useWeb)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${useWeb ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                                                {useWeb && <Check size={14} className="text-white"/>}
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Globe size={16} />
                                                <span className="text-sm font-bold">جستجوی آنلاین (Web Grounding)</span>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 text-slate-400 mb-2 text-xs font-bold uppercase tracking-wider">
                                                <BookOpen size={14} />
                                                منابع کتابخانه‌ای (RAG)
                                            </div>
                                            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                                                {library.length === 0 && <p className="text-xs text-slate-500 italic">کتابخانه‌ خالی است.</p>}
                                                {library.map(book => (
                                                    <div key={book.id} onClick={() => toggleBookSelection(book.id)} className="flex items-center gap-3 cursor-pointer hover:bg-slate-700/50 p-1 rounded">
                                                         <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedBookIds.includes(book.id) ? 'bg-purple-500 border-purple-500' : 'border-slate-600'}`}>
                                                            {selectedBookIds.includes(book.id) && <Check size={10} className="text-white"/>}
                                                         </div>
                                                         <span className={`text-sm truncate ${selectedBookIds.includes(book.id) ? 'text-white' : 'text-slate-400'}`}>{book.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleRunAI}
                                        disabled={isLoading}
                                        className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-900/20 flex items-center gap-2 mx-auto disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader className="animate-spin"/> : <BrainCircuit />}
                                        شروع پردازش هوشمند مرکزی
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                  <Activity size={64} className="mb-6 text-slate-800"/>
                  <h2 className="text-2xl font-bold text-slate-700">اتاق فرمان آماده است</h2>
                  <p className="mt-2 text-slate-500">لطفاً یک درخواست را از لیست سمت راست انتخاب کنید.</p>
              </div>
          )}
      </div>
    </div>
  );
};
