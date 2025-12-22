
import React, { useState, useRef } from 'react';
import { analyzePulmonology } from '../services/geminiService';
import { PulmonologyAnalysis } from '../types';
import { Wind, Mic, Video, Activity, MicOff, AlertCircle, CheckCircle, Upload, FileText, ArrowLeft, Loader2, Sparkles, ChevronRight, Zap } from 'lucide-react';

type Tab = 'cough' | 'breath' | 'spirometry';

const Pulmonology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cough');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PulmonologyAnalysis | null>(null);

  // Cough State (Audio)
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Breath/Spirometry State (Files)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
    } catch (err) {
      alert("دسترسی به میکروفون امکان‌پذیر نیست.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCoughAnalyze = async () => {
    if (!audioBlob) return;
    setLoading(true);
    try {
      const res = await analyzePulmonology(audioBlob, 'cough');
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز سرفه');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (activeTab === 'breath' && selectedFile.size > 20 * 1024 * 1024) {
        alert("لطفا ویدیوی کوتاه‌تر (زیر ۲۰ مگابایت) انتخاب کنید.");
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const handleFileAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await analyzePulmonology(file, activeTab as 'breath' | 'spirometry');
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز');
    } finally {
      setLoading(false);
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600' : 
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-cyan-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش فوق‌تخصصی ریه</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest uppercase font-bold">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Wind size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>ضریب اطمینان (Confidence)</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           {result.metrics && result.metrics.length > 0 && (
             <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100">
                <h4 className="font-bold text-cyan-800 mb-2 text-[10px] flex items-center gap-1 uppercase tracking-widest">Respiratory Metrics</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.metrics.map((m, i) => (
                     <div key={i} className="bg-white p-2 rounded-lg text-[10px] text-gray-700 shadow-sm text-center font-black">{m}</div>
                  ))}
                </div>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-cyan-400 font-bold">{f}</div>)}
           </div>
           {result.nextSteps && (
             <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                <h4 className="font-black text-xs mb-2 flex items-center gap-2 text-cyan-400"><Sparkles size={14} /> پیشنهاد گام بعدی</h4>
                <p className="text-[11px] opacity-90 leading-relaxed">{result.nextSteps.join(' • ')}</p>
             </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in pb-20 h-full">
      
      {/* ======================= MOBILE VIEW ======================= */}
      <div className="lg:hidden flex flex-col h-full">
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-cyan-100 p-2 rounded-xl text-teal-600"><Wind size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">ریه و تنفس تخصصی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('cough'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cough' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>سرفه</button>
               <button onClick={() => { setActiveTab('breath'); setResult(null); setFile(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'breath' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>تنفس</button>
               <button onClick={() => { setActiveTab('spirometry'); setResult(null); setFile(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'spirometry' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>اسپیرومتری</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {activeTab === 'cough' && (
                     <div className="text-center space-y-6 pt-10">
                        <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-cyan-100 animate-pulse' : 'bg-gray-100'}`}>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-8 rounded-full shadow-xl ${isRecording ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-600'}`}>
                              {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                           </button>
                        </div>
                        <p className="text-gray-500 font-bold">{isRecording ? 'در حال شنیدن...' : audioBlob ? 'سرفه ضبط شد' : 'ضبط صدای سرفه'}</p>
                     </div>
                  )}

                  {(activeTab === 'breath' || activeTab === 'spirometry') && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-cyan-200 bg-cyan-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept={activeTab === 'breath' ? "video/*" : "image/*"} className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
                           {preview ? (
                              activeTab === 'breath' ? <video src={preview} className="w-full h-full object-cover" controls /> : <img src={preview} className="w-full h-full object-cover" alt="Scan" />
                           ) : (
                              <div className="text-center">
                                 {activeTab === 'breath' ? <Video className="mx-auto text-cyan-400 mb-2" /> : <FileText className="mx-auto text-cyan-400 mb-2" />}
                                 <p className="text-gray-500 text-xs font-bold">{activeTab === 'breath' ? 'ویدیوی تنفس' : 'عکس اسپیرومتری'}</p>
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : (activeTab === 'cough' ? handleCoughAnalyze : handleFileAnalyze)}
               disabled={loading || (!result && activeTab === 'cough' && !audioBlob) || (!result && activeTab !== 'cough' && !file)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-cyan-600 text-white shadow-cyan-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'تحلیل ریوی...' : result ? 'بازگشت' : 'شروع آنالیز'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Wind className="text-cyan-600" size={32} />
              <span>کنسول فوق‌تخصصی بیماری‌های ریوی (Expert-Link)</span>
            </h2>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('cough'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'cough' ? 'bg-cyan-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Mic /> آنالیز سرفه</button>
              <button onClick={() => { setActiveTab('breath'); setResult(null); setFile(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'breath' ? 'bg-cyan-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Video /> پایش تنفس</button>
              <button onClick={() => { setActiveTab('spirometry'); setResult(null); setFile(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'spirometry' ? 'bg-cyan-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> اسپیرومتری</button>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-2">
              {activeTab === 'cough' ? (
                <div className="py-20 text-center space-y-8">
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-cyan-100 animate-pulse' : 'bg-gray-50'}`}><Mic size={64} className={isRecording ? 'text-cyan-600' : 'text-gray-300'} /></div>
                  <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-10 rounded-full shadow-2xl transition-all ${isRecording ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-600 border border-cyan-100'}`}>{isRecording ? <MicOff size={48} /> : <Mic size={48} />}</button></div>
                  <p className="font-black text-gray-400 text-xl">{isRecording ? 'در حال دریافت فرکانس‌های سرفه...' : 'جهت ضبط صدای سرفه بیمار کلیک کنید'}</p>
                </div>
              ) : (
                <div className="relative group">
                  <div className={`border-2 border-dashed rounded-3xl h-[450px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-cyan-500 bg-cyan-50/10' : 'border-gray-200 bg-gray-900'}`}>
                      <input type="file" accept={activeTab === 'breath' ? "video/*" : "image/*"} className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleFileChange} disabled={loading} />
                      {preview ? (
                        activeTab === 'breath' ? <video src={preview} className="w-full h-full object-contain z-10" controls /> : <img src={preview} className="w-full h-full object-contain z-10" alt="Spirometry" />
                      ) : (
                        <div className="text-center p-4 z-10">
                          {activeTab === 'breath' ? <Video size={48} className="mx-auto text-cyan-400 mb-6 group-hover:scale-110 transition-transform" /> : <FileText size={48} className="mx-auto text-cyan-400 mb-6 group-hover:scale-110 transition-transform" />}
                          <p className="font-black text-gray-300 text-xl tracking-tight">آپلود داده‌های تنفسی</p>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-8">
              <button onClick={activeTab === 'cough' ? handleCoughAnalyze : handleFileAnalyze} disabled={loading || (activeTab === 'cough' && !audioBlob) || (activeTab !== 'cough' && !file)} className="w-full bg-cyan-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-cyan-200 disabled:opacity-50 hover:bg-cyan-700 transition-all text-lg flex items-center justify-center gap-3">
                {loading ? <><Activity className="animate-spin" /><span>در حال پردازش داده‌های فوق‌تخصصی...</span></> : <><Zap /><span>تولید گزارش کلینیک ریه</span></>}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600 animate-pulse' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-cyan-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش فوق‌تخصصی ریه</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">Expert-Link Pulmonary Diagnostic / {activeTab}</p>
                      </div>
                      <Wind size={40} />
                   </div>
                   
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Confidence Index</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                           <div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div>
                        </div>
                     </div>
                   )}
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Diagnostic Impression</h4>
                      <p className="text-gray-900 text-2xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p>
                   </div>
                   
                   {result.metrics && result.metrics.length > 0 && (
                     <div className="grid grid-cols-2 gap-3">
                        {result.metrics.map((m, i) => (
                          <div key={i} className="bg-cyan-50 p-4 rounded-2xl border border-cyan-100 text-center">
                             <p className="text-xs font-black text-cyan-900">{m}</p>
                          </div>
                        ))}
                     </div>
                   )}

                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Findings</h4>
                      <ul className="space-y-4">
                        {result.findings.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold">
                              <div className="mt-1.5 w-2 h-2 bg-cyan-500 rounded-full shrink-0"></div>
                              <span>{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} className="text-cyan-500" />
                            مشاوره بالینی (Suggested Next Steps)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-slate-900 p-4 rounded-2xl text-cyan-200 text-sm font-bold flex items-center gap-3 border border-slate-800">
                                  <ChevronRight size={18} className="text-cyan-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Pulmonary Module / Lung AI</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Wind size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت سیگنال‌های تنفسی...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل آکوستیک سرفه، الگوی حرکتی قفسه سینه و تفسیر پارامترهای اسپیرومتری خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pulmonology;
