
import React, { useState, useRef } from 'react';
import { analyzeBabyCry, analyzeChildDevelopment, calculateGrowthProjection } from '../services/geminiService';
import { PediatricsAnalysis } from '../types';
import { Baby, Mic, Video, TrendingUp, MicOff, AlertCircle, CheckCircle, Upload, ArrowLeft, Loader2 } from 'lucide-react';

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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه کودکان</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidenceScore && (
             <div className="bg-pink-50 p-3 rounded-xl border border-pink-100 text-center">
                <span className="text-xs text-pink-500 uppercase font-bold">ضریب اطمینان مدل</span>
                <p className="text-xl font-bold text-pink-900">{result.confidenceScore}</p>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های تحلیلی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-pink-400">{f}</div>)}
           </div>
           <div className="bg-blue-50 p-3 rounded-xl">
              <h4 className="font-bold text-blue-800 text-sm mb-1">توصیه‌های والدین</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => <li key={i} className="text-xs text-blue-900">• {r}</li>)}
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
                  <div className="bg-pink-100 p-2 rounded-xl text-pink-600"><Baby size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">کودکان</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('cry'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cry' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>مترجم گریه</button>
               <button onClick={() => { setActiveTab('development'); setResult(null); setVideoFile(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'development' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>تکامل</button>
               <button onClick={() => { setActiveTab('growth'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'growth' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>رشد قد</button>
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
                        <p className="text-gray-500 font-bold">{isRecording ? 'در حال شنیدن...' : audioBlob ? 'گریه ضبط شد' : 'ضبط صدای گریه'}</p>
                     </div>
                  )}

                  {activeTab === 'development' && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-pink-200 bg-pink-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleVideoFile} />
                           {videoPreview ? <video src={videoPreview} className="w-full h-full object-cover" controls /> : <div className="text-center"><Video className="mx-auto text-pink-400 mb-2" /><p className="text-gray-500 text-xs font-bold">ویدیو بازی/حرکت کودک</p></div>}
                        </div>
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                           یک ویدیو کوتاه (۱۰ ثانیه) از رفتار یا راه رفتن کودک ضبط کنید.
                        </p>
                     </div>
                  )}

                  {activeTab === 'growth' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                           <input type="text" placeholder="سن (مثال: 5)" className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.age} onChange={e => setGrowthData({...growthData, age: e.target.value})} />
                           <select className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.gender} onChange={e => setGrowthData({...growthData, gender: e.target.value})}>
                              <option value="male">پسر</option>
                              <option value="female">دختر</option>
                           </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <input type="number" placeholder="قد فعلی (cm)" className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.currentHeight} onChange={e => setGrowthData({...growthData, currentHeight: e.target.value})} />
                           <input type="number" placeholder="وزن فعلی (kg)" className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.currentWeight} onChange={e => setGrowthData({...growthData, currentWeight: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <input type="number" placeholder="قد پدر (cm)" className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.fatherHeight} onChange={e => setGrowthData({...growthData, fatherHeight: e.target.value})} />
                           <input type="number" placeholder="قد مادر (cm)" className="p-3 bg-gray-50 rounded-xl text-center font-bold text-sm" value={growthData.motherHeight} onChange={e => setGrowthData({...growthData, motherHeight: e.target.value})} />
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
               onClick={result ? () => setResult(null) : (activeTab === 'cry' ? handleCryAnalyze : activeTab === 'development' ? handleDevAnalyze : handleGrowthCalc)}
               disabled={loading || (!result && activeTab === 'cry' && !audioBlob) || (!result && activeTab === 'development' && !videoFile)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-pink-600 text-white shadow-pink-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Baby />}
               {loading ? 'تحلیل کودک...' : result ? 'بازگشت' : 'شروع آنالیز'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Baby className="text-pink-500 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان کودکان و هوش رشد</h2>
            <p className="text-gray-500">Department of Pediatrics</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-2xl col-span-2">
          <button onClick={() => { setActiveTab('cry'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'cry' ? 'bg-pink-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Mic /> مترجم گریه</button>
          <button onClick={() => { setActiveTab('development'); setResult(null); setVideoFile(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'development' ? 'bg-pink-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Video /> تکامل و رفتار</button>
          <button onClick={() => { setActiveTab('growth'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'growth' ? 'bg-pink-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp /> پیش‌بینی رشد</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {activeTab === 'cry' && (
             <div className="space-y-8 text-center py-10">
               <h3 className="font-bold text-gray-800">مترجم گریه نوزاد (Baby Cry Translator)</h3>
               <p className="text-sm text-gray-500 px-4">صدای گریه نوزاد را ضبط کنید تا علت آن (گرسنگی، درد، خواب، پوشک) تشخیص داده شود.</p>
               <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-pink-100 animate-pulse' : 'bg-gray-100'}`}><Mic size={64} className={isRecording ? 'text-pink-600' : 'text-gray-400'} /></div>
               <p className="text-gray-600">{isRecording ? 'در حال گوش دادن به فرکانس گریه...' : audioBlob ? 'ضبط شد' : 'شروع ضبط'}</p>
               <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-6 rounded-full shadow-xl transition-all ${isRecording ? 'bg-pink-600 text-white' : 'bg-white text-pink-600 border border-pink-100'}`}>{isRecording ? <MicOff size={32} /> : <Mic size={32} />}</button></div>
               {audioBlob && !isRecording && <button onClick={handleCryAnalyze} disabled={loading} className="w-full bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-pink-200 hover:bg-pink-700 disabled:opacity-50">{loading ? 'در حال ترجمه گریه...' : 'ترجمه هوشمند'}</button>}
             </div>
          )}

          {activeTab === 'development' && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">آنالیز ویدیویی تکامل (Developmental AI)</h3>
              <p className="text-sm text-gray-500">ویدیویی از بازی کردن یا حرکت کودک آپلود کنید تا مهارت‌های حرکتی و ارتباطی بررسی شود.</p>
              <div className="border-2 border-dashed border-pink-200 bg-pink-50/30 rounded-2xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleVideoFile} />
                 {videoPreview ? <video src={videoPreview} className="w-full h-full object-contain" controls /> : <div className="text-center p-4"><Video className="mx-auto text-pink-400 w-12 h-12 mb-3" /><p className="text-gray-600 font-medium">ویدیو را اینجا رها کنید</p></div>}
              </div>
              <button onClick={handleDevAnalyze} disabled={!videoFile || loading} className="w-full bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-pink-200 hover:bg-pink-700 disabled:opacity-50">{loading ? 'در حال بررسی مهارت‌های کودک...' : 'آنالیز تکامل'}</button>
            </div>
          )}

          {activeTab === 'growth' && (
             <div className="space-y-4">
                <h3 className="font-bold text-gray-800 mb-4">ماشین حساب پیش‌بینی قد (Growth Projector)</h3>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs text-gray-500">سن کودک</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl" value={growthData.age} onChange={e => setGrowthData({...growthData, age: e.target.value})} placeholder="مثال: 5 سال" /></div><div className="space-y-1"><label className="text-xs text-gray-500">جنسیت</label><select className="w-full p-3 bg-gray-50 rounded-xl" value={growthData.gender} onChange={e => setGrowthData({...growthData, gender: e.target.value})}><option value="male">پسر</option><option value="female">دختر</option></select></div></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs text-gray-500">قد فعلی (cm)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl" value={growthData.currentHeight} onChange={e => setGrowthData({...growthData, currentHeight: e.target.value})} /></div><div className="space-y-1"><label className="text-xs text-gray-500">وزن فعلی (kg)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl" value={growthData.currentWeight} onChange={e => setGrowthData({...growthData, currentWeight: e.target.value})} /></div></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs text-gray-500">قد پدر (cm)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl" value={growthData.fatherHeight} onChange={e => setGrowthData({...growthData, fatherHeight: e.target.value})} /></div><div className="space-y-1"><label className="text-xs text-gray-500">قد مادر (cm)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl" value={growthData.motherHeight} onChange={e => setGrowthData({...growthData, motherHeight: e.target.value})} /></div></div>
                <button onClick={handleGrowthCalc} disabled={loading} className="w-full mt-4 bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-pink-200 hover:bg-pink-700 disabled:opacity-50">{loading ? 'در حال محاسبه پتانسیل ژنتیکی...' : 'پیش‌بینی قد نهایی'}</button>
             </div>
          )}
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.confidenceScore && <div className="bg-pink-50 p-3 rounded-lg text-center border border-pink-100"><span className="text-xs text-pink-500 uppercase font-bold">ضریب اطمینان</span><p className="text-lg font-bold text-gray-800">{result.confidenceScore}</p></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌ها</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-pink-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-gray-50 p-4 rounded-xl"><h4 className="font-bold text-gray-800 mb-2">توصیه‌ها</h4><ul className="space-y-1">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-gray-600">• {r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Baby size={48} className="mb-4" /><p>منتظر داده‌ها برای آنالیز کودکان...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Pediatrics;
