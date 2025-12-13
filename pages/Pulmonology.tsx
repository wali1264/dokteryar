
import React, { useState, useRef } from 'react';
import { analyzePulmonology } from '../services/geminiService';
import { PulmonologyAnalysis } from '../types';
import { Wind, Mic, Video, Activity, MicOff, AlertCircle, CheckCircle, Upload, FileText, ArrowLeft, Loader2 } from 'lucide-react';

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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه ریه</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.metrics && result.metrics.length > 0 && (
             <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100">
                <h4 className="font-bold text-cyan-800 mb-2 text-xs flex items-center gap-1"><Activity size={12}/> پارامترها</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.metrics.map((m, i) => (
                     <div key={i} className="bg-white p-2 rounded-lg text-xs text-gray-700 shadow-sm text-center font-mono">{m}</div>
                  ))}
                </div>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-cyan-400">{f}</div>)}
           </div>
           <div className="bg-gray-50 p-3 rounded-xl">
              <h4 className="font-bold text-gray-800 text-sm mb-1">توصیه‌ها</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => <li key={i} className="text-xs text-gray-600">• {r}</li>)}
              </ul>
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
                  <div className="bg-cyan-100 p-2 rounded-xl text-cyan-600"><Wind size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">ریه و تنفس</h2>
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
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                           {activeTab === 'breath' ? 'ویدیوی ۱۰ ثانیه‌ای از قفسه سینه' : 'عکس نمودار حجم-جریان'}
                        </p>
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
               {loading ? 'تحلیل تنفسی...' : result ? 'بازگشت' : 'شروع آنالیز'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Wind className="text-cyan-500 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان ریه و تنفس هوشمند</h2>
            <p className="text-gray-500">Department of Pulmonology & Respiratory Intelligence</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-2xl col-span-2">
          <button onClick={() => { setActiveTab('cough'); setResult(null); setFile(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'cough' ? 'bg-cyan-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Mic /> دکتر سرفه</button>
          <button onClick={() => { setActiveTab('breath'); setResult(null); setFile(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'breath' ? 'bg-cyan-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Video /> پایش تنفس</button>
          <button onClick={() => { setActiveTab('spirometry'); setResult(null); setFile(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'spirometry' ? 'bg-cyan-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> اسپیرومتری</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {activeTab === 'cough' && (
             <div className="space-y-8 text-center py-10">
               <h3 className="font-bold text-gray-800">تشخیص هوشمند سرفه (Cough Doctor)</h3>
               <p className="text-sm text-gray-500 px-4">صدای سرفه بیمار را ضبط کنید تا نوع آن (خشک، خلط‌دار، خروسک) و علت احتمالی تشخیص داده شود.</p>
               <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-cyan-100 animate-pulse' : 'bg-gray-100'}`}><Mic size={64} className={isRecording ? 'text-cyan-600' : 'text-gray-400'} /></div>
               <p className="text-gray-600">{isRecording ? 'در حال شنیدن...' : audioBlob ? 'ضبط شد' : 'شروع ضبط'}</p>
               <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-6 rounded-full shadow-xl transition-all ${isRecording ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-600 border border-cyan-100'}`}>{isRecording ? <MicOff size={32} /> : <Mic size={32} />}</button></div>
               {audioBlob && !isRecording && <button onClick={handleCoughAnalyze} disabled={loading} className="w-full bg-cyan-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-cyan-200 hover:bg-cyan-700 disabled:opacity-50">{loading ? 'در حال آنالیز فرکانس سرفه...' : 'تشخیص سرفه'}</button>}
             </div>
          )}

          {(activeTab === 'breath' || activeTab === 'spirometry') && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">{activeTab === 'breath' ? 'پایش تصویری تنفس' : 'تفسیر نمودار اسپیرومتری'}</h3>
              <div className="border-2 border-dashed border-cyan-200 bg-cyan-50/30 rounded-2xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept={activeTab === 'breath' ? "video/*" : "image/*"} className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
                 {preview ? (activeTab === 'breath' ? <video src={preview} className="w-full h-full object-contain" controls /> : <img src={preview} className="w-full h-full object-contain" alt="Spirometry" />) : <div className="text-center p-4">{activeTab === 'breath' ? <Video className="mx-auto text-cyan-400 w-12 h-12 mb-3" /> : <FileText className="mx-auto text-cyan-400 w-12 h-12 mb-3" />}<p className="text-gray-600 font-medium">{activeTab === 'breath' ? 'ویدیو را اینجا رها کنید' : 'تصویر نمودار را اینجا رها کنید'}</p></div>}
              </div>
              <button onClick={handleFileAnalyze} disabled={!file || loading} className="w-full bg-cyan-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-cyan-200 hover:bg-cyan-700 disabled:opacity-50">{loading ? 'در حال پردازش هوشمند...' : activeTab === 'breath' ? 'شمارش تنفس' : 'تفسیر نمودار'}</button>
            </div>
          )}
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.metrics && result.metrics.length > 0 && <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100"><h4 className="font-bold text-cyan-800 mb-3 flex items-center gap-2"><Activity size={18} />پارامترهای اندازه‌گیری شده</h4><div className="grid grid-cols-2 gap-2">{result.metrics.map((m, i) => (<div key={i} className="bg-white p-2 rounded-lg text-sm text-gray-700 shadow-sm border border-cyan-100 text-center font-mono">{m}</div>))}</div></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های بالینی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-gray-50 p-4 rounded-xl"><h4 className="font-bold text-gray-800 mb-2">توصیه‌ها</h4><ul className="space-y-1">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-gray-600">• {r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Wind size={48} className="mb-4" /><p>منتظر داده‌ها برای آنالیز ریوی...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Pulmonology;
