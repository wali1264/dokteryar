
import React, { useState, useRef } from 'react';
import { analyzeBabyCry, analyzeChildDevelopment, calculateGrowthProjection } from '../services/geminiService';
import { PediatricsAnalysis } from '../types';
import { Baby, Mic, Video, TrendingUp, MicOff, AlertCircle, CheckCircle, Upload, ArrowLeft, Loader2, Sparkles, ChevronRight, Activity } from 'lucide-react';

type Tab = 'cry' | 'development' | 'growth';

const Pediatrics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cry');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PediatricsAnalysis | null>(null);

  // Cry State (Audio)
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Development State (Video)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  // Growth State (Data)
  const [growthData, setGrowthData] = useState({
    age: '', gender: 'male',
    currentHeight: '', currentWeight: '',
    fatherHeight: '', motherHeight: ''
  });

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

  const handleCryAnalyze = async () => {
    if (!audioBlob) return;
    setLoading(true);
    try {
      const res = await analyzeBabyCry(audioBlob);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز گریه نوزاد');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 20 * 1024 * 1024) {
        alert("لطفا ویدیوی کوتاه‌تر (زیر ۲۰ مگابایت) انتخاب کنید.");
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleDevAnalyze = async () => {
    if (!videoFile) return;
    setLoading(true);
    try {
      const res = await analyzeChildDevelopment(videoFile);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز ویدیو');
    } finally {
      setLoading(false);
    }
  };

  const handleGrowthCalc = async () => {
    setLoading(true);
    try {
      const res = await calculateGrowthProjection(growthData);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در محاسبه رشد');
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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-pink-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش کلینیک کودکان</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Baby size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidenceScore && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>اطمینان بالینی</span><span>{result.confidenceScore}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: result.confidenceScore }}></div></div>
              </div>
           )}
           
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های تخصصی</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-pink-400">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-pink-400">
                    <Sparkles size={14} />
                    گام‌های پیشنهادی بالینی
                 </h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90">
                          <ChevronRight size={14} className="text-pink-400 shrink-0" />
                          <span>{step}</span>
                       </div>
                    ))}
                 </div>
              </div>
           )}
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
                  <div className="bg-pink-100 p-2 rounded-xl text-pink-600"><Baby size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">کودکان و نوزادان</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('cry'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cry' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>گریه</button>
               <button onClick={() => { setActiveTab('development'); setResult(null); setVideoFile(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'development' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>تکامل</button>
               <button onClick={() => { setActiveTab('growth'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'growth' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>رشد</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {activeTab === 'cry' && (
                     <div className="text-center space-y-6 pt-10">
                        <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-pink-100 animate-pulse' : 'bg-gray-100'}`}>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-8 rounded-full shadow-xl ${isRecording ? 'bg-pink-600 text-white' : 'bg-white text-pink-600'}`}>
                              {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                           </button>
                        </div>
                        <p className="text-gray-500 font-bold">{isRecording ? 'در حال شنیدن گریه...' : audioBlob ? 'ضبط شد' : 'ضبط صدای گریه نوزاد'}</p>
                     </div>
                  )}
                  {activeTab === 'development' && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-pink-200 bg-pink-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleVideoFile} />
                           {videoPreview ? <video src={videoPreview} className="w-full h-full object-cover" controls /> : <div className="text-center"><Video className="mx-auto text-pink-400 mb-2" /><p className="text-gray-500 text-xs font-bold">ویدیو حرکت کودک</p></div>}
                        </div>
                     </div>
                  )}
                  {activeTab === 'growth' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                           <input type="text" placeholder="سن" className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.age} onChange={e => setGrowthData({...growthData, age: e.target.value})} />
                           <select className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.gender} onChange={e => setGrowthData({...growthData, gender: e.target.value})}><option value="male">پسر</option><option value="female">دختر</option></select>
                        </div>
                        <input type="number" placeholder="قد فعلی (cm)" className="w-full p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.currentHeight} onChange={e => setGrowthData({...growthData, currentHeight: e.target.value})} />
                        <input type="number" placeholder="قد پدر (cm)" className="w-full p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.fatherHeight} onChange={e => setGrowthData({...growthData, fatherHeight: e.target.value})} />
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : (activeTab === 'cry' ? handleCryAnalyze : activeTab === 'development' ? handleDevAnalyze : handleGrowthCalc)}
               disabled={loading}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-pink-600 text-white shadow-pink-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <TrendingUp />}
               {loading ? 'در حال واکاوی الگوها...' : result ? 'بازگشت' : 'شروع آنالیز تخصصی'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Baby className="text-pink-600" size={32} />
              <span>کنسول فوق‌تخصصی بیماری‌های کودکان (Expert-Link)</span>
            </h2>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('cry'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'cry' ? 'bg-pink-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Mic /> مترجم گریه</button>
              <button onClick={() => { setActiveTab('development'); setResult(null); setVideoFile(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'development' ? 'bg-pink-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Video /> پایش تکامل</button>
              <button onClick={() => { setActiveTab('growth'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'growth' ? 'bg-pink-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp /> آنالیز رشد</button>
            </div>

            <div className="min-h-[400px]">
               {activeTab === 'cry' && (
                 <div className="py-12 text-center space-y-8">
                   <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-pink-100 animate-pulse' : 'bg-gray-50'}`}><Mic size={64} className={isRecording ? 'text-pink-600' : 'text-gray-300'} /></div>
                   <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-10 rounded-full shadow-2xl transition-all ${isRecording ? 'bg-pink-600 text-white' : 'bg-white text-pink-600 border border-pink-100'}`}>{isRecording ? <MicOff size={48} /> : <Mic size={48} />}</button></div>
                   <p className="font-black text-gray-400 text-xl">{isRecording ? 'در حال دریافت فرکانس‌های گریه...' : 'برای ضبط صدای گریه نوزاد کلیک کنید'}</p>
                 </div>
               )}

               {activeTab === 'development' && (
                  <div className="relative group h-[400px]">
                    <div className={`border-2 border-dashed rounded-[3rem] h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-pink-500 bg-pink-50/10' : 'border-gray-200 bg-gray-900'}`}>
                        <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleVideoFile} disabled={loading} />
                        {videoPreview ? <video src={videoPreview} className="w-full h-full object-contain z-10" controls /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-pink-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود ویدیوی حرکتی کودک</p></div>}
                    </div>
                  </div>
               )}

               {activeTab === 'growth' && (
                 <div className="bg-gray-50 p-8 rounded-[3rem] space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">سن کودک</label><input type="text" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={growthData.age} onChange={e => setGrowthData({...growthData, age: e.target.value})} /></div>
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">جنسیت</label><select className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={growthData.gender} onChange={e => setGrowthData({...growthData, gender: e.target.value})}><option value="male">پسر</option><option value="female">دختر</option></select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">قد فعلی (cm)</label><input type="number" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={growthData.currentHeight} onChange={e => setGrowthData({...growthData, currentHeight: e.target.value})} /></div>
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">وزن فعلی (kg)</label><input type="number" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={growthData.currentWeight} onChange={e => setGrowthData({...growthData, currentWeight: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">قد پدر (cm)</label><input type="number" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={growthData.fatherHeight} onChange={e => setGrowthData({...growthData, fatherHeight: e.target.value})} /></div>
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">قد مادر (cm)</label><input type="number" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={growthData.motherHeight} onChange={e => setGrowthData({...growthData, motherHeight: e.target.value})} /></div>
                    </div>
                 </div>
               )}
            </div>
            
            <div className="mt-8">
              <button onClick={result ? () => setResult(null) : (activeTab === 'cry' ? handleCryAnalyze : activeTab === 'development' ? handleDevAnalyze : handleGrowthCalc)} disabled={loading} className="w-full bg-pink-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-pink-200 hover:bg-pink-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال پردازش گام‌های رشدی...</span></> : <><Baby /><span>تولید ریپورت فوق‌تخصصی کودکان</span></>}</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-pink-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش آنکال کودکان</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">PEDIATRIC REPORT / {activeTab}</p>
                      </div>
                      <CheckCircle size={40} />
                   </div>
                   {result.confidenceScore && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Diagnostic Confidence</span><span>{result.confidenceScore}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidenceScore }}></div></div>
                     </div>
                   )}
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Clinical Impression</h4>
                      <p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p>
                   </div>
                   
                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Findings</h4>
                      <ul className="space-y-4">
                        {result.findings.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold">
                              <div className="mt-1.5 w-2 h-2 bg-pink-500 rounded-full shrink-0"></div>
                              <span>{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} className="text-pink-500" />
                            پیشنهاد مشاور (Next Clinical Steps)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-slate-900 p-4 rounded-2xl text-pink-200 text-sm font-bold flex items-center gap-3 border border-slate-800">
                                  <ChevronRight size={18} className="text-indigo-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Pediatrics / Growth AI</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Baby size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت داده‌های نوزاد...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل تکامل حرکتی، درصد رشد قد و تشخیص علت گریه خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pediatrics;
