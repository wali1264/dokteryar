
import React, { useState, useEffect, useRef } from 'react';
import { PatientRecord, DualDiagnosis, ChatMessage, AppRoute } from '../types';
import { analyzePatient, generateConsensus, generateAudioSummary, createMedicalChat, generateTimelineAnalysis } from '../services/geminiService';
import { saveRecord, getRecordsByName } from '../services/db';
import { Pill, Leaf, Users, Loader2, RefreshCcw, MessageSquare, Send, Play, Pause, Volume2, ArrowLeft, FileText, WifiOff, Save, TrendingUp, History, Check, User, Activity, Utensils, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Chat } from "@google/genai";

interface DiagnosisProps {
  patientRecord: PatientRecord | null;
  // Fix: Make record optional to align with App.tsx handleNavigate and support 1-argument calls
  onNavigate: (route: AppRoute, record?: PatientRecord) => void;
}

const Diagnosis: React.FC<DiagnosisProps> = ({ patientRecord, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DualDiagnosis | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Mobile Tabs
  const [mobileTab, setMobileTab] = useState<'modern' | 'traditional' | 'consensus' | 'chat'>('modern');

  // Manual Entry Mode (Offline or fallback)
  const [manualMode, setManualMode] = useState(false);
  const [manualModernDx, setManualModernDx] = useState('');
  const [manualModernPlan, setManualModernPlan] = useState('');
  const [manualTradDx, setManualTradDx] = useState('');
  const [manualTradPlan, setManualTradPlan] = useState('');

  // Consensus State
  const [consensusLoading, setConsensusLoading] = useState(false);
  const [consensus, setConsensus] = useState<string | null>(null);
  
  // Timeline State
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineReport, setTimelineReport] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PatientRecord[]>([]);

  // Audio State
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Chat State
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active Tab for Right Sidebar (Desktop)
  const [activeTab, setActiveTab] = useState<'consensus' | 'timeline'>('consensus');

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current && mobileTab === 'chat') {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, mobileTab]);

  useEffect(() => {
    if (!patientRecord) return;
    
    const initialize = async () => {
      setLoading(true);
      try {
        // Check if we already have diagnosis in the record (loaded from DB dashboard)
        if (patientRecord.status === 'diagnosed' && patientRecord.diagnosis) {
           setResults(patientRecord.diagnosis);
           setConsensus(patientRecord.consensus || null);
           setLoading(false);
        } else if (!navigator.onLine) {
           // Offline Mode - Switch to Manual
           setManualMode(true);
           setLoading(false);
        } else {
           // New diagnosis required & Online
           try {
             const data = await analyzePatient(patientRecord);
             
             // Extra safety check in case the service returned an empty object without throwing
             if (!data || !data.modern || !data.traditional) {
                 throw new Error("Invalid diagnosis data structure");
             }
             
             setResults(data);
             
             // Auto-save the initial diagnosis to DB (as provisional)
             const updatedRecord: PatientRecord = {
               ...patientRecord,
               status: 'diagnosed',
               diagnosis: data
             };
             await saveRecord(updatedRecord);
             setLoading(false);
           } catch (err) {
             console.error("AI Failed", err);
             // Fallback to manual if AI fails (429, Network, or Bad JSON)
             setManualMode(true);
             setLoading(false);
           }
        }

        // Fetch History for Timeline (Local DB - Works Offline)
        const history = await getRecordsByName(patientRecord.name);
        // Filter out current record
        const pastRecords = history.filter(h => h.id !== patientRecord.id);
        setHistoryRecords(pastRecords);

      } catch (error) {
        console.error("Diagnosis initialization error:", error);
        setManualMode(true);
        setLoading(false);
      }
    };
    initialize();
  }, [patientRecord]);

  const handleManualSave = async () => {
    if (!patientRecord) return;
    
    const manualDiagnosis: DualDiagnosis = {
       modern: {
         diagnosis: manualModernDx,
         reasoning: 'تشخیص دستی پزشک (حالت آفلاین)',
         treatmentPlan: manualModernPlan.split('\n').filter(l => l.trim()),
         lifestyle: [],
         warnings: []
       },
       traditional: {
         diagnosis: manualTradDx,
         reasoning: 'تشخیص دستی پزشک (حالت آفلاین)',
         treatmentPlan: manualTradPlan.split('\n').filter(l => l.trim()),
         lifestyle: [],
         warnings: []
       }
    };

    const updatedRecord: PatientRecord = {
       ...patientRecord,
       status: 'diagnosed',
       diagnosis: manualDiagnosis,
       consensus: 'تشخیص به صورت دستی در حالت آفلاین ثبت شد.'
    };

    await saveRecord(updatedRecord);
    setResults(manualDiagnosis);
    setConsensus(updatedRecord.consensus!);
    setManualMode(false);
  };

  const handleConsensus = async () => {
    if (!results || !patientRecord) return;
    if (!isOnline) {
      alert("برای ایجاد جمع‌بندی هوشمند به اینترنت نیاز دارید.");
      return;
    }

    setConsensusLoading(true);
    try {
      const text = await generateConsensus(results.modern, results.traditional);
      setConsensus(text);
      
      // Save Consensus to DB
      const updatedRecord: PatientRecord = {
          ...patientRecord,
          diagnosis: results, 
          consensus: text,
          status: 'diagnosed'
      };
      await saveRecord(updatedRecord);

      // Initialize chat
      const chat = createMedicalChat(patientRecord, results, text);
      setChatSession(chat);
      setMessages([{ id: 'init', role: 'model', text: 'من شورای پزشکی طبیب هوشمند هستم. اگر سوالی در مورد تشخیص یا تداخلات دارویی دارید، بپرسید.' }]);
    } catch (error) {
      console.error(error);
      alert("خطا در ارتباط با هوش مصنوعی");
    } finally {
      setConsensusLoading(false);
    }
  };

  const handleTimeline = async () => {
    if (!patientRecord || historyRecords.length === 0) return;
    if (!isOnline) {
       setTimelineReport("تحلیل روند درمان با هوش مصنوعی نیازمند اینترنت است. اما سوابق بیمار در لیست موجود است.");
       return;
    }
    setTimelineLoading(true);
    try {
        const report = await generateTimelineAnalysis(patientRecord, historyRecords);
        setTimelineReport(report);
    } catch (e) {
        console.error(e);
    } finally {
        setTimelineLoading(false);
    }
  }

  const handleGenerateAudio = async () => {
    if (!consensus) return;
    if (!isOnline) {
      alert("تولید صدا نیازمند اینترنت است.");
      return;
    }
    setAudioLoading(true);
    try {
      const base64 = await generateAudioSummary(consensus);
      if (base64) {
        const url = `data:audio/mp3;base64,${base64}`;
        setAudioUrl(url);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
          }
        }, 100);
      }
    } catch (e) {
      console.error(e);
      alert('خطا در تولید صدا');
    } finally {
      setAudioLoading(false);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const sendMessage = async () => {
    if (!inputMsg.trim() || !chatSession) return;
    if (!isOnline) {
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: inputMsg }, { id: (Date.now()+1).toString(), role: 'model', text: 'ارتباط با هوش مصنوعی قطع است.' }]);
       setInputMsg('');
       return;
    }

    const userText = inputMsg;
    setInputMsg('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    setChatLoading(true);

    try {
      const result = await chatSession.sendMessage({ message: userText });
      const modelText = result.text;
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: modelText }]);
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTransferToDesk = async () => {
    if (!patientRecord || !results) return;
    
    // Ensure the record is saved with the latest analysis before transferring
    const recordToTransfer: PatientRecord = {
        ...patientRecord,
        diagnosis: results,
        consensus: consensus || undefined,
        status: 'diagnosed'
    };
    
    await saveRecord(recordToTransfer);
    onNavigate(AppRoute.PRESCRIPTION, recordToTransfer);
  };

  if (!patientRecord) {
    return <div className="text-center p-10 text-gray-500">لطفا ابتدا اطلاعات بیمار را وارد کنید.</div>;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-6">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-blue-600 w-8 h-8" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-700">در حال واکاوی پرونده توسط تیم مشاورین...</h3>
        <p className="text-gray-500 animate-pulse">پروتکل هم‌افزایی بالینی در حال اجراست</p>
      </div>
    );
  }

  // MANUAL ENTRY MODE (Offline)
  if (manualMode) {
     return (
        <div className="space-y-6 pb-20 animate-fade-in">
           <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 text-orange-800">
              <WifiOff />
              <div>
                 <h3 className="font-bold">حالت تشخیص دستی (آفلاین)</h3>
                 <p className="text-sm">اتصال به هوش مصنوعی برقرار نیست یا پاسخ نامعتبر دریافت شد. لطفا تشخیص و طرح درمان را دستی وارد کنید تا در پرونده ذخیره شود.</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-blue-700 flex items-center gap-2 mb-4"><Pill /> تشخیص طب نوین</h3>
                 <div className="space-y-4">
                    <div>
                       <label className="text-sm font-bold text-gray-600">عنوان تشخیص</label>
                       <input className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" placeholder="مثال: دیابت نوع ۲" value={manualModernDx} onChange={e => setManualModernDx(e.target.value)} />
                    </div>
                    <div>
                       <label className="text-sm font-bold text-gray-600">برنامه درمانی (هر خط یک مورد)</label>
                       <textarea className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-32" placeholder="متفورمین 500..." value={manualModernPlan} onChange={e => setManualModernPlan(e.target.value)} />
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-amber-700 flex items-center gap-2 mb-4"><Leaf /> تشخیص طب سنتی</h3>
                 <div className="space-y-4">
                    <div>
                       <label className="text-sm font-bold text-gray-600">مزاج و تشخیص</label>
                       <input className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" placeholder="مثال: غلبه سودا" value={manualTradDx} onChange={e => setManualTradDx(e.target.value)} />
                    </div>
                    <div>
                       <label className="text-sm font-bold text-gray-600">تدابیر و گیاهان (هر خط یک مورد)</label>
                       <textarea className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-32" placeholder="سرکه انگبین..." value={manualTradPlan} onChange={e => setManualTradPlan(e.target.value)} />
                    </div>
                 </div>
              </div>
           </div>
           
           <button onClick={handleManualSave} disabled={!manualModernDx && !manualTradDx} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Save />
              ثبت تشخیص اولیه
           </button>
        </div>
     )
  }

  // Defensive Check
  if (!results || !results.modern || !results.traditional) {
      setManualMode(true);
      return null;
  }

  return (
    <div className="animate-fade-in">
      
      {/* ======================= MOBILE VIEW (360 Console) ======================= */}
      <div className="lg:hidden flex flex-col min-h-[85vh]">
         {/* Mobile Header & Tabs */}
         <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md pt-2 pb-2 shadow-sm border-b border-gray-100">
            <div className="px-4 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600"><User size={16} /></div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-800">{patientRecord.name}</h2>
                        <p className="text-[10px] text-gray-500">پرونده هوشمند تشخیص</p>
                    </div>
                </div>
                <button onClick={() => onNavigate(AppRoute.INTAKE)} className="p-2 bg-gray-50 rounded-full text-gray-500"><ArrowLeft size={18}/></button>
            </div>
            
            {/* Segmented Control */}
            <div className="mx-4 bg-gray-100 p-1 rounded-xl flex justify-between">
                <button onClick={() => setMobileTab('modern')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${mobileTab === 'modern' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>
                    <Pill size={18} />
                    <span className="text-[10px] font-bold">مشاور نوین</span>
                </button>
                <button onClick={() => setMobileTab('traditional')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${mobileTab === 'traditional' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}>
                    <Leaf size={18} />
                    <span className="text-[10px] font-bold">مشاور سبک‌زندگی</span>
                </button>
                <button onClick={() => setMobileTab('consensus')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${mobileTab === 'consensus' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400'}`}>
                    <Users size={18} />
                    <span className="text-[10px] font-bold">شورا</span>
                </button>
                <button onClick={() => setMobileTab('chat')} className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${mobileTab === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>
                    <MessageSquare size={18} />
                    <span className="text-[10px] font-bold">گفتگو</span>
                </button>
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 px-4 pt-4 pb-24 overflow-y-auto">
            {mobileTab === 'modern' && (
                <div className="animate-slide-up space-y-4">
                    <div className="bg-gradient-to-br from-blue-700 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                            <Activity size={16} />
                            <span className="text-xs font-bold uppercase">مشاور ارشد طب نوین</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                           <h2 className="text-2xl font-black">{results.modern.diagnosis}</h2>
                           {results.modern.confidence && (
                             <div className="bg-white/20 px-2 py-1 rounded-lg text-xs font-bold">اطمینان: {results.modern.confidence}</div>
                           )}
                        </div>
                        <p className="text-sm opacity-90 leading-relaxed">{results.modern.reasoning}</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Pill className="text-blue-500" size={18} />
                            استراتژی دارویی (Colleague Suggestion)
                        </h4>
                        <div className="space-y-2">
                            {results.modern.treatmentPlan.map((item, i) => (
                                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                    <span className="text-sm text-gray-700">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {mobileTab === 'traditional' && (
                <div className="animate-slide-up space-y-4">
                    <div className="bg-gradient-to-br from-amber-600 to-amber-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-200">
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                            <Leaf size={16} />
                            <span className="text-xs font-bold uppercase">متخصص طب کل‌نگر و سبک زندگی</span>
                        </div>
                        <h2 className="text-2xl font-black">{results.traditional.diagnosis}</h2>
                        <p className="text-sm mt-2 opacity-90 leading-relaxed">{results.traditional.reasoning}</p>
                    </div>

                    <div className="space-y-4">
                       <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                           <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Utensils className="text-amber-500" size={18} />رژیم غذایی (بخور و نخورها)</h4>
                           <div className="space-y-2">{results.traditional.warnings.map((item, i) => (<div key={i} className="text-sm bg-orange-50 p-3 rounded-xl border-r-4 border-orange-400 text-gray-700">{item}</div>))}</div>
                       </div>
                       <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                           <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Sparkles className="text-amber-500" size={18} />اصلاح سبک زندگی و مکمل‌ها</h4>
                           <div className="space-y-2">
                              {results.traditional.lifestyle.map((item, i) => (<div key={i} className="text-sm bg-blue-50 p-3 rounded-xl text-gray-700">• {item}</div>))}
                              {results.traditional.treatmentPlan.map((item, i) => (<div key={i} className="text-sm bg-emerald-50 p-3 rounded-xl text-emerald-800 font-bold">مکمل: {item}</div>))}
                           </div>
                       </div>
                    </div>
                </div>
            )}

            {mobileTab === 'consensus' && (
                <div className="animate-slide-up space-y-4">
                    {!consensus ? (
                       <div className="text-center py-10 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                          <Users className="mx-auto text-gray-300 w-16 h-16 mb-4" />
                          <p className="text-gray-500 mb-4 font-bold">شورای پزشکی تشکیل نشده است</p>
                          <button 
                             onClick={handleConsensus} 
                             disabled={consensusLoading || !isOnline}
                             className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 disabled:opacity-50"
                          >
                             {consensusLoading ? 'در حال مشورت...' : 'شروع شورای پزشکی'}
                          </button>
                       </div>
                    ) : (
                       <>
                          <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm">
                             <div className="flex items-center gap-2 mb-4 text-purple-700">
                                <AlertCircle size={20} />
                                <h3 className="font-bold">پروتکل هم‌افزایی و تداخلات</h3>
                             </div>
                             <div className="text-sm text-gray-700 leading-relaxed prose-sm">
                                <ReactMarkdown>{consensus}</ReactMarkdown>
                             </div>
                          </div>
                          
                          {/* Mini Audio Player */}
                          <div className="bg-gray-900 rounded-2xl p-4 text-white flex items-center justify-between shadow-xl">
                             <div className="flex items-center gap-3">
                                <div className="bg-purple-50 p-2 rounded-full">
                                   {audioLoading ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} />}
                                </div>
                                <div className="text-xs">
                                   <p className="font-bold">گزارش صوتی شورا</p>
                                   <p className="opacity-60">{audioUrl ? (isPlaying ? 'در حال پخش...' : 'آماده پخش') : 'برای تولید کلیک کنید'}</p>
                                </div>
                             </div>
                             
                             {!audioUrl ? (
                                <button onClick={handleGenerateAudio} disabled={audioLoading} className="text-xs bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20">تولید</button>
                             ) : (
                                <button onClick={toggleAudio} className="bg-white text-black p-2 rounded-full">
                                   {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" />}
                                </button>
                             )}
                          </div>
                          <div className="h-24"></div>
                       </>
                    )}
                </div>
            )}

            {mobileTab === 'chat' && (
                <div className="flex flex-col h-full animate-fade-in relative">
                   {!consensus ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                         <MessageSquare size={48} className="mb-2 opacity-20" />
                         <p>ابتدا باید شورا تشکیل شود</p>
                         <button onClick={() => setMobileTab('consensus')} className="mt-4 text-blue-600 font-bold">رفتن به تب شورا</button>
                      </div>
                   ) : (
                      <>
                         <div className="flex-1 overflow-y-auto space-y-3 pb-20 p-2">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && <div className="flex justify-start"><div className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm"><Loader2 className="animate-spin w-4 h-4 text-gray-500" /></div></div>}
                            <div ref={chatEndRef} />
                         </div>
                         
                         <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-100 flex gap-2 items-center z-40 pb-safe">
                            <input 
                               className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                               placeholder="سوال از شورای پزشکی..."
                               value={inputMsg}
                               onChange={e => setInputMsg(e.target.value)}
                               onKeyPress={e => e.key === 'Enter' && sendMessage()}
                            />
                            <button onClick={sendMessage} disabled={!inputMsg.trim() || chatLoading} className="bg-indigo-600 text-white p-3 rounded-full shadow-lg disabled:opacity-50">
                               <Send size={18} />
                            </button>
                         </div>
                      </>
                   )}
                </div>
            )}
         </div>

         {consensus && mobileTab !== 'chat' && (
            <button 
               onClick={handleTransferToDesk}
               className="fixed bottom-24 left-4 bg-emerald-600 text-white px-4 py-2 rounded-2xl font-bold shadow-2xl shadow-emerald-400/50 flex items-center gap-2 z-50 animate-bounce-subtle text-sm"
            >
               <FileText size={18} />
               <span>تایید و انتقال به میز کار</span>
            </button>
         )}
         
         {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}
      </div>

      {/* ======================= DESKTOP VIEW (Classic Grid) ======================= */}
      <div className="hidden lg:block space-y-8 pb-32 relative">
      
        {/* Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Modern Medicine Card - Senior Clinical Consultant */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-blue-100 flex flex-col transform hover:scale-[1.01] transition-transform duration-300">
            <div className="bg-gradient-to-l from-blue-800 to-indigo-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">مشاور ارشد طب نوین</h3>
                  <p className="text-blue-100 text-sm">تحلیل شواهد و ترندهای بالینی</p>
                </div>
              </div>
              {results.modern.confidence && (
                <div className="text-right">
                    <span className="text-[10px] font-bold uppercase opacity-60">ضریب اطمینان</span>
                    <div className="text-xl font-black">{results.modern.confidence}</div>
                </div>
              )}
            </div>
            <div className="p-6 flex-1 flex flex-col gap-5">
              {/* Confidence Bar */}
              {results.modern.confidence && (
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-1000 ease-out" 
                      style={{ width: results.modern.confidence }}
                    ></div>
                </div>
              )}
              
              <div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">تشخیص و استدلال</span>
                <h4 className="text-xl font-black text-gray-800 mt-2">{results?.modern?.diagnosis || '---'}</h4>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">{results?.modern?.reasoning || ''}</p>
              </div>
              
              <div className="space-y-4">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <h5 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                       <Pill size={16} className="text-blue-600" /> استراتژی دارویی پیشنهادی
                    </h5>
                    <ul className="space-y-2">
                      {results?.modern?.treatmentPlan?.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0"></div>
                          {item}
                        </li>
                      )) || <li className="text-sm text-gray-400">موردی یافت نشد</li>}
                    </ul>
                 </div>
                 
                 {results.modern.warnings.length > 0 && (
                   <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <h5 className="font-bold text-red-700 mb-2 flex items-center gap-2"><AlertCircle size={16}/> هشدارهای بالینی</h5>
                      <ul className="space-y-1">
                        {results.modern.warnings.map((w, i) => (
                           <li key={i} className="text-xs text-red-800 font-bold">• {w}</li>
                        ))}
                      </ul>
                   </div>
                 )}
              </div>
            </div>
          </div>

          {/* Traditional Medicine Card - Integrative Lifestyle Specialist */}
          <div className="bg-amber-50 rounded-3xl overflow-hidden shadow-lg border border-amber-100 flex flex-col transform hover:scale-[1.01] transition-transform duration-300">
            <div className="bg-gradient-to-l from-amber-700 to-amber-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Leaf size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">متخصص طب سبک زندگی</h3>
                  <p className="text-amber-100 text-sm">اصلاح سته ضروریه و مکمل‌های گیاهی</p>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col gap-6">
              <div>
                <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded uppercase">تحلیل مزاجی و ارگانیک</span>
                <h4 className="text-xl font-black text-gray-800 mt-2">{results?.traditional?.diagnosis || '---'}</h4>
                <p className="text-gray-700 text-sm mt-2 leading-relaxed">{results?.traditional?.reasoning || ''}</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                 {/* Diet Section */}
                 <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                    <h5 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
                       <Utensils size={18} className="text-orange-500" /> رژیم غذایی و پرهیزات
                    </h5>
                    <ul className="space-y-2">
                      {results?.traditional?.warnings?.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                           <span className="text-orange-500 font-bold shrink-0">✘</span>
                           {item}
                        </li>
                      ))}
                    </ul>
                 </div>

                 {/* Lifestyle & Supplements Section */}
                 <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                    <h5 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
                       <Sparkles size={18} className="text-amber-500" /> اصلاح سبک زندگی و مکمل‌ها
                    </h5>
                    <div className="space-y-3">
                       <div>
                          <p className="text-[10px] font-black text-gray-400 mb-1">سبک زندگی و ورزش:</p>
                          <ul className="space-y-1">
                             {results?.traditional?.lifestyle?.map((item, i) => (
                               <li key={i} className="text-xs text-gray-600">• {item}</li>
                             ))}
                          </ul>
                       </div>
                       <div className="pt-2 border-t border-gray-50">
                          <p className="text-[10px] font-black text-gray-400 mb-1">فرآورده‌های طبیعی پیشنهادی:</p>
                          <ul className="space-y-1">
                             {results?.traditional?.treatmentPlan?.map((item, i) => (
                               <li key={i} className="text-xs text-emerald-700 font-bold">✚ {item}</li>
                             ))}
                          </ul>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Analysis Section */}
        <div className="mt-12 bg-gray-900 text-gray-100 rounded-[2.5rem] p-1 shadow-2xl overflow-hidden min-h-[500px]">
          <div className="flex border-b border-gray-800">
             <button 
               onClick={() => setActiveTab('consensus')} 
               className={`flex-1 p-5 font-black text-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'consensus' ? 'bg-gray-800 text-white border-b-4 border-purple-500' : 'text-gray-500 hover:text-white'}`}
             >
               <Users size={22} />
               پروتکل شورای پزشکی
             </button>
             <button 
               onClick={() => { setActiveTab('timeline'); if(!timelineReport) handleTimeline(); }} 
               disabled={historyRecords.length === 0}
               className={`flex-1 p-5 font-black text-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'timeline' ? 'bg-gray-800 text-white border-b-4 border-blue-500' : 'text-gray-500 hover:text-white disabled:opacity-30'}`}
             >
               <History size={22} />
               گزارش پیشرفت (Timeline)
               {historyRecords.length > 0 && <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{historyRecords.length}</span>}
             </button>
          </div>

          <div className="p-10">
             {activeTab === 'consensus' ? (
               <>
                 <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                   <div className="flex items-center gap-5">
                      <div className="bg-gradient-to-tr from-purple-500 to-indigo-500 p-4 rounded-2xl shadow-lg shadow-purple-500/20">
                        <Activity className="text-white" size={32} />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-white">جمع‌بندی استراتژیک شورا</h3>
                        <p className="text-gray-400 text-sm">شناسایی تداخلات و تدوین طرح درمانی واحد (Colleague to Colleague)</p>
                      </div>
                   </div>
                   
                   {!consensus ? (
                     <button 
                       onClick={handleConsensus} 
                       disabled={consensusLoading || !isOnline}
                       className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-xl disabled:opacity-50"
                     >
                       {consensusLoading ? <Loader2 className="animate-spin" /> : isOnline ? <RefreshCcw /> : <WifiOff />}
                       {isOnline ? 'تشکیل شورای پزشکی هوشمند' : 'آفلاین (غیرفعال)'}
                     </button>
                   ) : (
                      <div className="flex flex-wrap gap-3">
                         {audioUrl ? (
                            <button onClick={toggleAudio} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-purple-500 transition-all shadow-lg">
                               {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                               <span>{isPlaying ? 'توقف پخش' : 'گزارش صوتی شورا'}</span>
                            </button>
                         ) : (
                            <button onClick={handleGenerateAudio} disabled={audioLoading || !isOnline} className="bg-gray-800 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-gray-700 transition-all disabled:opacity-50 border border-gray-700">
                              {audioLoading ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
                              <span>تولید صوت</span>
                            </button>
                         )}
                         
                         <button onClick={handleTransferToDesk} className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-8 py-3 rounded-2xl flex items-center gap-3 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all shadow-lg font-black group">
                           <FileText size={20} />
                           <span>تایید و انتقال به میز کار</span>
                           <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                         </button>
                      </div>
                   )}
                 </div>
                 
                 {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}

                 {consensus ? (
                   <div className="space-y-10 animate-fade-in">
                      <div className="bg-gray-800/50 rounded-[2rem] p-8 border border-gray-700/50 leading-relaxed text-gray-200 shadow-inner">
                        <ReactMarkdown className="prose prose-invert prose-lg max-w-none prose-headings:text-purple-400 prose-strong:text-white">{consensus}</ReactMarkdown>
                      </div>
                      <div className="border-t border-gray-800 pt-8">
                         <h4 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                           <MessageSquare className="text-purple-400" />
                           پرسش از شورای تخصصی
                         </h4>
                         <div className="bg-gray-950 rounded-3xl p-6 h-80 overflow-y-auto space-y-5 mb-6 border border-gray-800/50 shadow-inner custom-scrollbar">
                            {messages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-[1.5rem] p-4 text-base leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none shadow-lg'}`}>
                                  <p>{msg.text}</p>
                                </div>
                              </div>
                            ))}
                            {chatLoading && <div className="flex justify-start"><div className="bg-gray-800 p-4 rounded-2xl rounded-bl-none shadow-md"><Loader2 className="animate-spin w-4 h-4 text-purple-400" /></div></div>}
                            <div ref={chatEndRef} />
                         </div>
                         <div className="flex gap-3">
                           <input type="text" className="flex-1 bg-gray-800/50 border border-gray-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-purple-500 focus:bg-gray-800 transition-all text-lg font-medium" placeholder={isOnline ? "سوالات تکمیلی خود را از شورا بپرسید..." : "حالت آفلاین (غیرفعال)"} disabled={!isOnline} value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
                           <button onClick={sendMessage} disabled={!inputMsg.trim() || chatLoading || !isOnline} className="bg-purple-600 text-white px-8 rounded-2xl hover:bg-purple-500 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-purple-500/20"><Send size={24} /></button>
                         </div>
                      </div>
                   </div>
                 ) : (
                   <div className="h-64 border-2 border-dashed border-gray-800 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-600 transition-colors hover:border-gray-700">
                      <Users size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-bold">{isOnline ? 'جهت دریافت جمع‌بندی استراتژیک کلیک کنید' : 'در حالت آفلاین شورای پزشکی هوشمند غیرفعال است.'}</p>
                   </div>
                 )}
               </>
             ) : (
               <div className="animate-fade-in">
                 <h3 className="text-3xl font-black text-white flex items-center gap-4 mb-8">
                   <TrendingUp className="text-blue-500" size={32} />
                   واکاوی پیشرفت درمان (Historical Analysis)
                 </h3>
                 {timelineLoading ? (
                   <div className="flex flex-col items-center justify-center h-64 gap-4">
                      <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
                      <p className="text-gray-400 font-bold">در حال تطبیق سوابق با وضعیت فعلی...</p>
                   </div>
                 ) : timelineReport ? (
                   <div className="bg-gray-800/50 rounded-[2.5rem] p-10 leading-relaxed text-gray-200 border border-gray-700/50">
                      <ReactMarkdown className="prose prose-invert prose-lg max-w-none prose-headings:text-blue-400">{timelineReport}</ReactMarkdown>
                   </div>
                 ) : (
                   <div className="text-gray-500 text-center py-20 bg-gray-950/30 rounded-[2rem] border border-dashed border-gray-800">
                      <History size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="text-lg font-bold">{historyRecords.length === 0 ? 'سابقه‌ای برای این بیمار یافت نشد.' : isOnline ? 'تحلیل جدیدی تولید نشده است.' : 'تحلیل هوشمند نیازمند اینترنت است.'}</p>
                   </div>
                 )}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Diagnosis;
