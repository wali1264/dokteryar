
import React, { useState, useRef } from 'react';
import { analyzePsychologyImage, analyzeDream, analyzeSentiment } from '../services/geminiService';
import { PsychologyAnalysis } from '../types';
import { Sparkles, Moon, Mic, Palette, MicOff, AlertOctagon, CheckCircle, BrainCircuit, Upload, ArrowLeft, Loader2, Activity, BarChart3, ChevronRight } from 'lucide-react';

type Tab = 'art' | 'dream' | 'sentiment';

const Psychology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('art');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PsychologyAnalysis | null>(null);

  const [artImage, setArtImage] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [dreamText, setDreamText] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleArtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArtImage(file);
      setArtPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'art') {
         if (!artImage) return;
         res = await analyzePsychologyImage(artImage);
      } else if (activeTab === 'dream') {
         if (!dreamText.trim()) return;
         res = await analyzeDream(dreamText);
      } else {
         if (!audioBlob) return;
         res = await analyzeSentiment(audioBlob);
      }
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در تحلیل روانشناسی');
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err) { alert("دسترسی به میکروفون امکان‌پذیر نیست."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600' : 
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-indigo-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">تحلیل وضعیت روانی</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{activeTab === 'dream' ? 'تفسیر ناخودآگاه' : result.interpretation}</p>
           </div>
           {result.severity === 'critical' ? <AlertOctagon size={24} /> : <BrainCircuit size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.moodMetrics && (
             <div className="grid grid-cols-1 gap-2">
                {result.moodMetrics.map((m, i) => (
                   <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter"><span>{m.factor}</span><span>{m.score}/10</span></div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(parseInt(m.score) || 0) * 10}%` }}></div>
                      </div>
                   </div>
                ))}
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های شناختی</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-indigo-400 font-bold">{f}</div>
              ))}
           </div>
           <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <h4 className="font-black text-indigo-800 text-xs mb-1 flex items-center gap-1 uppercase tracking-tighter"><Sparkles size={12}/> استراتژی درمانی</h4>
              <p className="text-[11px] text-indigo-900 leading-relaxed font-bold">{result.recommendations.join(' • ')}</p>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in pb-20 h-full">
      <div className="lg:hidden flex flex-col h-full">
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Sparkles size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">روانشناسی تخصصی</h2>
               </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('art'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'art' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>هنر</button>
               <button onClick={() => { setActiveTab('dream'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dream' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>خواب</button>
               <button onClick={() => { setActiveTab('sentiment'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'sentiment' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>خلق</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {activeTab === 'art' && (
                     <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleArtFile} />
                        {artPreview ? <img src={artPreview} className="w-full h-full object-contain" alt="Art" /> : <div className="text-center"><Palette className="mx-auto text-indigo-400 mb-2" /><p className="text-gray-500 text-xs font-bold">عکس تست ترسیم ساعت یا نقاشی</p></div>}
                     </div>
                  )}
                  {activeTab === 'dream' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none h-48 resize-none text-sm font-bold leading-relaxed" placeholder="تعریف کامل خواب بیمار..." value={dreamText} onChange={e => setDreamText(e.target.value)} />
                     </div>
                  )}
                  {activeTab === 'sentiment' && (
                     <div className="text-center pt-10">
                        <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-indigo-100 animate-pulse' : 'bg-gray-100'}`}>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-8 rounded-full shadow-xl ${isRecording ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600'}`}>
                              {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                           </button>
                        </div>
                        <p className="mt-6 text-gray-500 font-bold">{isRecording ? 'در حال شنیدن...' : 'ضبط صحبت بیمار'}</p>
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : handleAnalyze}
               disabled={loading}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'کنکاش در ناخودآگاه...' : result ? 'تست جدید' : 'شروع تحلیل تخصصی'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Sparkles className="text-indigo-600" size={32} />
              <span>کنسول مشاور روانکاو و علوم شناختی (Expert-Link)</span>
            </h2>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('art'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'art' ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Palette /> هنر درمانی و CDT</button>
              <button onClick={() => { setActiveTab('dream'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'dream' ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Moon /> تفسیر ناخودآگاه</button>
              <button onClick={() => { setActiveTab('sentiment'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'sentiment' ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> سنجش خلق و عاطفه</button>
            </div>

            <div className="min-h-[400px]">
               {activeTab === 'art' ? (
                 <div className="relative group h-[400px]">
                    <div className={`border-2 border-dashed rounded-[3rem] h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-indigo-500 bg-indigo-50/10' : 'border-gray-200 bg-gray-900'}`}>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleArtFile} disabled={loading} />
                        {artPreview ? <img src={artPreview} alt="Art Test" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-indigo-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود نقاشی یا تست ترسیم ساعت</p></div>}
                    </div>
                 </div>
               ) : activeTab === 'dream' ? (
                 <div className="bg-gray-50 p-8 rounded-[3rem] space-y-6">
                    <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Dream Narrative</label><textarea className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none h-64 resize-none font-bold text-gray-700 leading-relaxed" placeholder="شرح کامل رویای بیمار را با جزئیات وارد کنید..." value={dreamText} onChange={e => setDreamText(e.target.value)} /></div>
                 </div>
               ) : (
                 <div className="py-12 text-center space-y-8">
                   <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-indigo-100 animate-pulse' : 'bg-gray-50'}`}><Activity size={64} className={isRecording ? 'text-indigo-600' : 'text-gray-300'} /></div>
                   <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-10 rounded-full shadow-2xl transition-all ${isRecording ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100'}`}>{isRecording ? <MicOff size={48} /> : <Mic size={48} />}</button></div>
                   <p className="font-black text-gray-400 text-xl">{isRecording ? 'در حال پایش نوسانات صوتی...' : 'جهت ضبط صحبت‌های بیمار کلیک کنید'}</p>
                 </div>
               )}
            </div>
            <div className="mt-8"><button onClick={handleAnalyze} disabled={loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال کنکاش در لایه‌های شناختی...</span></> : <><BrainCircuit /><span>تولید ریپورت رسمی روانشناسی</span></>}</button></div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                   <div className="flex justify-between items-start">
                      <div><h3 className="text-2xl font-black">گزارش مشاور روان‌کاو</h3><p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">PSYCHOLOGY REPORT / {activeTab}</p></div>
                      <CheckCircle size={40} />
                   </div>
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Diagnostic Confidence</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div></div>
                     </div>
                   )}
                </div>
                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Clinical Impression</h4><p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.interpretation}</p></div>
                   
                   {result.moodMetrics && (
                     <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                        <h4 className="font-black text-indigo-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><BarChart3 size={18} /> نیم‌رخ خلقی (Affective Profile)</h4>
                        {result.moodMetrics.map((m, i) => (
                          <div key={i} className="space-y-1.5">
                             <div className="flex justify-between text-[10px] font-black text-indigo-900 uppercase"><span>{m.factor}</span><span>{m.score} / 10</span></div>
                             <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(parseInt(m.score) || 0) * 10}%` }}></div></div>
                          </div>
                        ))}
                     </div>
                   )}

                   {result.type === 'dream' && (
                     <div className="grid grid-cols-1 gap-4">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><h4 className="font-black text-blue-800 text-xs mb-2 uppercase">تحلیل روانکاوی (مدرن)</h4><p className="text-sm text-gray-700 font-bold leading-relaxed">{result.modernAnalysis}</p></div>
                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100"><h4 className="font-black text-amber-800 text-xs mb-2 uppercase">تعبیر نمادین (سنتی)</h4><p className="text-sm text-gray-700 font-bold leading-relaxed">{result.traditionalAnalysis}</p></div>
                     </div>
                   )}

                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Psychometric Findings</h4><ul className="space-y-4">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold"><div className="mt-1.5 w-2 h-2 bg-indigo-500 rounded-full shrink-0"></div><span>{f}</span></li>))}</ul></div>
                   {result.nextSteps && result.nextSteps.length > 0 && (<div className="mt-6 pt-6 border-t border-gray-100"><h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> پروتکل درمانی پیشنهادی</h4><div className="grid gap-3">{result.nextSteps.map((step, i) => (<div key={i} className="bg-slate-900 p-4 rounded-2xl text-indigo-200 text-sm font-bold flex items-center gap-3 border border-slate-800"><ChevronRight size={18} className="text-indigo-400" />{step}</div>))}</div></div>)}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Psychology / Cognitive Suite</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <BrainCircuit size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت داده برای تحلیل...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل واکاوی نمادهای ناخودآگاه، سنجش سطح اضطراب و افسردگی و پایش عملکردهای عالی مغز خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Psychology;
