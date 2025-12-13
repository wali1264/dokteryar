
import React, { useState, useRef } from 'react';
import { analyzeNeurologyVideo, analyzeCognitiveSpeech } from '../services/geminiService';
import { NeurologyAnalysis } from '../types';
import { BrainCircuit, Video, Mic, Activity, MicOff, AlertCircle, CheckCircle, Footprints, Waves, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'tremor' | 'gait' | 'speech';

const Neurology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('tremor');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NeurologyAnalysis | null>(null);

  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Handlers
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

  const handleVideoAnalyze = async (type: 'tremor' | 'gait') => {
    if (!videoFile) return;
    setLoading(true);
    try {
      const res = await analyzeNeurologyVideo(videoFile, type);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز ویدیو');
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

  const handleSpeechAnalyze = async () => {
    if (!audioBlob) return;
    setLoading(true);
    try {
      const res = await analyzeCognitiveSpeech(audioBlob);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز گفتار');
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
          result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه عصب‌شناسی</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidenceScore && (
             <div className="bg-purple-50 p-3 rounded-lg text-center border border-purple-100">
               <span className="text-xs text-purple-600 uppercase font-bold">دقت تشخیص</span>
               <p className="text-xl font-bold text-purple-900">{result.confidenceScore}</p>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">مشاهدات کلیدی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-purple-400">{f}</div>)}
           </div>
           <div className="bg-purple-50 p-3 rounded-xl">
              <h4 className="font-bold text-purple-800 text-sm mb-1">اقدامات بعدی</h4>
              <p className="text-xs text-purple-900 leading-relaxed">{result.recommendations.join(' - ')}</p>
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
                  <div className="bg-purple-100 p-2 rounded-xl text-purple-600"><BrainCircuit size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">مغز و اعصاب</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('tremor'); setResult(null); setVideoFile(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'tremor' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>لرزش (Tremor)</button>
               <button onClick={() => { setActiveTab('gait'); setResult(null); setVideoFile(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'gait' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>گام (Gait)</button>
               <button onClick={() => { setActiveTab('speech'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'speech' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>شناختی (Speech)</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {(activeTab === 'tremor' || activeTab === 'gait') && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-purple-200 bg-purple-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleVideoFile} />
                           {videoPreview ? <video src={videoPreview} className="w-full h-full object-cover" controls /> : <div className="text-center"><Video className="mx-auto text-purple-400 mb-2" /><p className="text-gray-500 text-xs font-bold">{activeTab === 'tremor' ? 'فیلم لرزش دست' : 'فیلم راه رفتن'}</p></div>}
                        </div>
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                           {activeTab === 'tremor' ? 'دست بیمار را در حالت استراحت و کشیده فیلمبرداری کنید' : 'چند قدم راه رفتن عادی بیمار را ضبط کنید'}
                        </p>
                     </div>
                  )}

                  {activeTab === 'speech' && (
                     <div className="text-center space-y-6 pt-10">
                        <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-purple-100 animate-pulse' : 'bg-gray-100'}`}>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-8 rounded-full shadow-xl ${isRecording ? 'bg-purple-600 text-white' : 'bg-white text-purple-600'}`}>
                              {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                           </button>
                        </div>
                        <p className="text-gray-500 font-bold">{isRecording ? 'تحلیل الگوی کلامی...' : audioBlob ? 'ضبط شد' : 'ضبط تست شناختی'}</p>
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : (activeTab === 'speech' ? handleSpeechAnalyze : () => handleVideoAnalyze(activeTab))}
               disabled={loading || (!result && activeTab !== 'speech' && !videoFile) || (!result && activeTab === 'speech' && !audioBlob)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-purple-600 text-white shadow-purple-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'پردازش عصبی...' : result ? 'بازگشت' : 'شروع تست'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <BrainCircuit className="text-purple-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان مغز و اعصاب</h2>
            <p className="text-gray-500">Neurology & Motion Intelligence</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-2xl col-span-2">
          <button onClick={() => { setActiveTab('tremor'); setResult(null); setVideoFile(null); setVideoPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'tremor' ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Waves /> آنالیز لرزش (Tremor)</button>
          <button onClick={() => { setActiveTab('gait'); setResult(null); setVideoFile(null); setVideoPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'gait' ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Footprints /> آنالیز راه رفتن (Gait)</button>
          <button onClick={() => { setActiveTab('speech'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'speech' ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> تست شناختی (Cognitive)</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {(activeTab === 'tremor' || activeTab === 'gait') && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">{activeTab === 'tremor' ? 'آپلود ویدیوی لرزش دست' : 'آپلود ویدیوی راه رفتن'}</h3>
              <div className="border-2 border-dashed border-purple-200 bg-purple-50/30 rounded-2xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleVideoFile} />
                 {videoPreview ? <video src={videoPreview} className="w-full h-full object-contain" controls /> : <div className="text-center p-4"><Video className="mx-auto text-purple-400 w-12 h-12 mb-3" /><p className="text-gray-600 font-medium">ویدیو را اینجا رها کنید (کوتاه، حداکثر ۱۰ ثانیه)</p></div>}
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800"><p className="font-bold mb-1">راهنمای ضبط:</p>{activeTab === 'tremor' ? 'دست بیمار را در حالت استراحت و سپس در حالت کشیده (Action) فیلمبرداری کنید.' : 'از بیمار بخواهید چند قدم به سمت دوربین و برعکس راه برود.'}</div>
              <button onClick={() => handleVideoAnalyze(activeTab)} disabled={!videoFile || loading} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 disabled:opacity-50">{loading ? 'در حال آنالیز فریم‌به‌فریم...' : `آنالیز هوشمند ${activeTab === 'tremor' ? 'لرزش' : 'گام‌برداری'}`}</button>
            </div>
          )}
          {activeTab === 'speech' && (
             <div className="space-y-8 text-center py-10">
              <h3 className="font-bold text-gray-800">تست گفتار (تشخیص آلزایمر/آفازی)</h3>
              <p className="text-sm text-gray-500 px-4">از بیمار بخواهید در مورد روز خود صحبت کند یا یک تصویر را توصیف کند (حداقل ۳۰ ثانیه).</p>
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-purple-100 animate-pulse' : 'bg-gray-100'}`}><Activity size={64} className={isRecording ? 'text-purple-600' : 'text-gray-400'} /></div>
              <p className="text-gray-600">{isRecording ? 'در حال ضبط و تحلیل الگوهای کلامی...' : audioBlob ? 'ضبط شد' : 'دکمه را نگه دارید یا کلیک کنید'}</p>
              <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-6 rounded-full shadow-xl transition-all ${isRecording ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-100'}`}>{isRecording ? <MicOff size={32} /> : <Mic size={32} />}</button></div>
              {audioBlob && !isRecording && <button onClick={handleSpeechAnalyze} disabled={loading} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 disabled:opacity-50">{loading ? 'در حال آنالیز روانی کلام...' : 'شروع تست شناختی'}</button>}
            </div>
          )}
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز عصبی</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.confidenceScore && <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100"><span className="text-xs text-gray-500 uppercase font-bold">ضریب اطمینان مدل</span><p className="text-lg font-bold text-gray-800">{result.confidenceScore}</p></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">مشاهدات تخصصی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-purple-50 p-4 rounded-xl"><h4 className="font-bold text-purple-800 mb-2">اقدامات پیشنهادی</h4><ul className="space-y-1">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-purple-900">• {r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><BrainCircuit size={48} className="mb-4" /><p>منتظر داده‌های ویدیویی یا صوتی...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Neurology;
