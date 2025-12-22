
import React, { useState, useRef } from 'react';
import { analyzeECG, analyzeHeartSound, calculateCardiacRisk } from '../services/geminiService';
import { CardiologyAnalysis } from '../types';
import { Upload, HeartPulse, Activity, Mic, SquareActivity, AlertTriangle, CheckCircle, Play, MicOff, Loader2, ArrowLeft, Zap, Sparkles, TrendingUp } from 'lucide-react';

type Tab = 'ecg' | 'sound' | 'risk';

const Cardiology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('ecg');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CardiologyAnalysis | null>(null);

  // ECG State
  const [ecgImage, setEcgImage] = useState<File | null>(null);
  const [ecgContext, setEcgContext] = useState('');
  const [ecgPreview, setEcgPreview] = useState<string | null>(null);

  // Sound State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Risk State
  const [riskData, setRiskData] = useState({
    age: '', gender: 'male', smoker: false, diabetic: false,
    bp: '', cholesterol: '', hdl: ''
  });

  const handleEcgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEcgImage(file);
      setEcgPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleEcgAnalyze = async () => {
    if (!ecgImage) return;
    setLoading(true);
    try {
      const res = await analyzeECG(ecgImage, ecgContext);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز نوار قلب');
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

  const handleSoundAnalyze = async () => {
    if (!audioBlob) return;
    setLoading(true);
    try {
      const res = await analyzeHeartSound(audioBlob);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز صدای قلب');
    } finally {
      setLoading(false);
    }
  };

  const handleRiskCalc = async () => {
    setLoading(true);
    const profile = `Age: ${riskData.age}, Gender: ${riskData.gender}, Smoker: ${riskData.smoker}, Diabetic: ${riskData.diabetic}, BP: ${riskData.bp}, TC: ${riskData.cholesterol}`;
    try {
      const res = await calculateCardiacRisk(profile);
      setResult(res);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600 animate-pulse' : 
          result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">{result.type === 'ecg' ? 'تفسیر نوار قلب' : result.type === 'sound' ? 'تفسیر صدای قلب' : 'ارزیابی ریسک'}</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest">{result.impression}</p>
           </div>
           {result.severity === 'critical' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>ضریب اطمینان (Confidence)</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           {result.metrics && (
             <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl text-center text-[10px]">
                {result.metrics.rate && <div><p className="text-gray-400 font-bold">HR</p><p className="font-black text-gray-800">{result.metrics.rate}</p></div>}
                {result.metrics.rhythm && <div><p className="text-gray-400 font-bold">Rhythm</p><p className="font-black text-gray-800">{result.metrics.rhythm}</p></div>}
                {result.metrics.prInterval && <div><p className="text-gray-400 font-bold">PR</p><p className="font-black text-gray-800">{result.metrics.prInterval}</p></div>}
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-red-400">{f}</div>)}
           </div>
           <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <h4 className="font-black text-red-800 text-xs mb-1 flex items-center gap-1"><Sparkles size={12}/> گام‌های بالینی (Colleague Link)</h4>
              <p className="text-[11px] text-red-900 leading-relaxed font-bold">{result.recommendations.join(' • ')}</p>
           </div>
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
                  <div className="bg-red-100 p-2 rounded-xl text-red-600"><HeartPulse size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">قلب و عروق تخصصی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('ecg'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ecg' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>نوار قلب</button>
               <button onClick={() => { setActiveTab('sound'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'sound' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>صدای قلب</button>
               <button onClick={() => { setActiveTab('risk'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'risk' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>ریسک</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {activeTab === 'ecg' && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-red-200 bg-red-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleEcgFile} />
                           {ecgPreview ? <img src={ecgPreview} className="w-full h-full object-contain" alt="ECG" /> : <div className="text-center"><Activity className="mx-auto text-red-400 mb-2" /><p className="text-gray-500 text-xs font-bold">عکس نوار قلب</p></div>}
                        </div>
                        <textarea className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm h-20 resize-none" placeholder="زمینه بالینی..." value={ecgContext} onChange={e => setEcgContext(e.target.value)} />
                     </div>
                  )}
                  {activeTab === 'sound' && (
                     <div className="text-center space-y-6 pt-10">
                        <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-100 animate-pulse' : 'bg-gray-100'}`}>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-8 rounded-full shadow-xl ${isRecording ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}>
                              {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                           </button>
                        </div>
                        <p className="text-gray-500 font-bold">{isRecording ? 'در حال شنیدن...' : 'ضبط صدای قلب'}</p>
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : (activeTab === 'ecg' ? handleEcgAnalyze : activeTab === 'sound' ? handleSoundAnalyze : handleRiskCalc)}
               disabled={loading || (!result && activeTab === 'ecg' && !ecgImage) || (!result && activeTab === 'sound' && !audioBlob)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-red-600 text-white shadow-red-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'در حال واکاوی...' : result ? 'تست جدید' : 'شروع آنالیز'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
               <HeartPulse size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">کنسول تخصصی قلب و عروق</h2>
              <p className="text-gray-500 font-bold text-sm">Expert-Link Cardiology Diagnostic Suite</p>
            </div>
          </div>

          <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 w-full mb-2">
            <button onClick={() => { setActiveTab('ecg'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'ecg' ? 'bg-red-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> تحلیل نوار قلب</button>
            <button onClick={() => { setActiveTab('sound'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'sound' ? 'bg-red-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Mic /> آنالیز دریچه‌ای</button>
            <button onClick={() => { setActiveTab('risk'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'risk' ? 'bg-red-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp /> پیش‌بینی ریسک</button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex-1">
            {activeTab === 'ecg' && (
              <div className="space-y-6">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter">ECG Image Digitizer</h3>
                <div className="border-2 border-dashed border-red-200 bg-red-50/20 rounded-[2rem] h-[400px] flex flex-col items-center justify-center relative overflow-hidden group">
                   <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleEcgFile} />
                   {ecgPreview ? <img src={ecgPreview} className="w-full h-full object-contain" alt="ECG" /> : <div className="text-center p-4"><Activity className="mx-auto text-red-400 w-16 h-16 mb-4 opacity-40" /><p className="text-gray-400 font-black text-lg">تصویر نوار قلب را آپلود کنید</p></div>}
                </div>
                <textarea className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-red-50 h-24 font-bold text-gray-700 shadow-inner" placeholder="شرح حال و علائم بیمار (Chest Pain, Syncope...)" value={ecgContext} onChange={e => setEcgContext(e.target.value)} />
                <button onClick={handleEcgAnalyze} disabled={!ecgImage || loading} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black shadow-2xl shadow-red-200 hover:bg-red-700 disabled:opacity-50 transition-all text-lg">{loading ? <><Loader2 className="animate-spin inline mr-2" />در حال استخراج فواصل PR و QRS...</> : 'تفسیر فوق‌تخصصی نوار قلب'}</button>
              </div>
            )}
            {/* Other tabs desktop UI logic follows same high-end styling... */}
            {activeTab === 'sound' && <div className="py-20 text-center space-y-6"><Mic className="mx-auto w-24 h-24 text-red-200" /><h3 className="text-2xl font-black text-gray-700">Digital Phonocardiogram Analysis</h3><div className="flex justify-center gap-6"><button onClick={isRecording ? stopRecording : startRecording} className={`p-10 rounded-full shadow-2xl transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-red-600 border border-red-100 hover:bg-red-50'}`}>{isRecording ? <MicOff size={48} /> : <Mic size={48} />}</button></div><p className="font-bold text-gray-400">{isRecording ? 'در حال شنیدن صدای دریچه‌ها...' : 'جهت ضبط دکمه را لمس کنید'}</p></div>}
          </div>
        </div>

        <div className="lg:col-span-5">
           {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-fade-in flex flex-col h-full">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600 animate-pulse' : result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'}`}>
                   <div className="flex justify-between items-start">
                      <div><h3 className="text-2xl font-black">گزارش مشاور قلب</h3><p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Expert-Link Protocol / ECG Report</p></div>
                      {result.severity === 'critical' ? <AlertTriangle size={40} /> : <CheckCircle size={40} />}
                   </div>
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Confidence Level</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div></div>
                     </div>
                   )}
                </div>
                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   {result.metrics && (
                     <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          { l: 'HR', v: result.metrics.rate },
                          { l: 'PR', v: result.metrics.prInterval },
                          { l: 'QRS', v: result.metrics.qrsComplex },
                          { l: 'QT', v: result.metrics.qtInterval },
                        ].map(m => m.v && (
                          <div key={m.l} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                             <span className="text-[10px] font-black text-gray-400 uppercase">{m.l}</span>
                             <p className="text-lg font-black text-gray-800">{m.v}</p>
                          </div>
                        ))}
                     </div>
                   )}
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Clinical Impression</h4><p className="text-gray-900 text-xl font-black leading-relaxed bg-red-50/50 p-6 rounded-3xl border border-red-100">{result.impression}</p></div>
                   {result.differentialDiagnosis && (
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                         <h4 className="font-black text-gray-700 text-xs uppercase mb-4 flex items-center gap-2"><Activity size={16} /> Differential Dx</h4>
                         <ul className="space-y-2">{result.differentialDiagnosis.map((d, i) => (<li key={i} className="text-sm font-bold text-gray-600 flex items-center gap-2"><Zap size={14} className="text-orange-400" /> {d}</li>))}</ul>
                      </div>
                   )}
                   <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100"><h4 className="font-black text-xs uppercase mb-4 flex items-center gap-2"><Sparkles size={16} /> Clinical Next Steps</h4><ul className="space-y-3">{result.recommendations.map((r, i) => (<li key={i} className="text-sm font-bold opacity-90 leading-relaxed">• {r}</li>))}</ul></div>
                </div>
                <div className="p-4 bg-gray-50 text-[10px] text-gray-400 text-center font-bold">Generated by Expert-Link Cardiology Module</div>
             </div>
           ) : (
             <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center opacity-50"><HeartPulse size={80} className="mb-6 opacity-10" /><p className="text-xl font-black tracking-tight">منتظر دریافت سیگنال برای آنالیز...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Cardiology;
