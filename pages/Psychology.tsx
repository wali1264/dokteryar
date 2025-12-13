
import React, { useState, useRef } from 'react';
import { analyzePsychologyImage, analyzeDream, analyzeSentiment } from '../services/geminiService';
import { PsychologyAnalysis } from '../types';
import { Sparkles, Moon, Mic, Palette, MicOff, AlertOctagon, CheckCircle, BrainCircuit, Upload, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'art' | 'dream' | 'sentiment';

const Psychology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('art');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PsychologyAnalysis | null>(null);

  // Art State
  const [artImage, setArtImage] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);

  // Dream State
  const [dreamText, setDreamText] = useState('');

  // Sentiment State (Audio)
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Handlers
  const handleArtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArtImage(file);
      setArtPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleArtAnalyze = async () => {
    if (!artImage) return;
    setLoading(true);
    try {
      const res = await analyzePsychologyImage(artImage);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز نقاشی');
    } finally {
      setLoading(false);
    }
  };

  const handleDreamAnalyze = async () => {
    if (!dreamText.trim()) return;
    setLoading(true);
    try {
      const res = await analyzeDream(dreamText);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در تعبیر خواب');
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

  const handleSentimentAnalyze = async () => {
    if (!audioBlob) return;
    setLoading(true);
    try {
      const res = await analyzeSentiment(audioBlob);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در تحلیل احساسات');
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
             <h3 className="font-bold text-lg">نتیجه روانشناسی</h3>
             <p className="text-white/90 text-xs mt-1">{activeTab === 'dream' ? 'تفسیر خواب' : result.interpretation}</p>
           </div>
           {result.severity === 'critical' ? <AlertOctagon size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.type === 'dream' && (
             <div className="grid grid-cols-1 gap-3">
               <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                 <h4 className="font-bold text-blue-900 text-xs mb-1">تفسیر روانکاوی</h4>
                 <p className="text-xs text-gray-700">{result.modernAnalysis}</p>
               </div>
               <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                 <h4 className="font-bold text-amber-900 text-xs mb-1">تعبیر سنتی</h4>
                 <p className="text-xs text-gray-700">{result.traditionalAnalysis}</p>
               </div>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های کلیدی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-indigo-400">{f}</div>)}
           </div>
           <div className="bg-indigo-50 p-3 rounded-xl">
              <h4 className="font-bold text-indigo-800 text-sm mb-1">توصیه‌ها</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => <li key={i} className="text-xs text-indigo-900">• {r}</li>)}
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
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Sparkles size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">روانشناسی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('art'); setResult(null); setArtImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'art' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>هنر درمانی</button>
               <button onClick={() => { setActiveTab('dream'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dream' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>تعبیر خواب</button>
               <button onClick={() => { setActiveTab('sentiment'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'sentiment' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>خلق و خو</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {activeTab === 'art' && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleArtFile} />
                           {artPreview ? <img src={artPreview} className="w-full h-full object-cover" alt="Art" /> : <div className="text-center"><Palette className="mx-auto text-indigo-400 mb-2" /><p className="text-gray-500 text-xs font-bold">عکس نقاشی</p></div>}
                        </div>
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">تست ترسیم ساعت (CDT) یا نقاشی آزاد</p>
                     </div>
                  )}

                  {activeTab === 'dream' && (
                     <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                           <textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-48 resize-none text-sm leading-relaxed" placeholder="خواب خود را با جزئیات تعریف کنید..." value={dreamText} onChange={e => setDreamText(e.target.value)} />
                        </div>
                     </div>
                  )}

                  {activeTab === 'sentiment' && (
                     <div className="text-center space-y-6 pt-10">
                        <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-indigo-100 animate-pulse' : 'bg-gray-100'}`}>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-8 rounded-full shadow-xl ${isRecording ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600'}`}>
                              {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                           </button>
                        </div>
                        <p className="text-gray-500 font-bold">{isRecording ? 'در حال شنیدن...' : audioBlob ? 'صحبت ضبط شد' : 'درباره احساسات خود صحبت کنید'}</p>
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : (activeTab === 'art' ? handleArtAnalyze : activeTab === 'dream' ? handleDreamAnalyze : handleSentimentAnalyze)}
               disabled={loading || (activeTab === 'art' && !artImage) || (activeTab === 'dream' && !dreamText) || (activeTab === 'sentiment' && !audioBlob)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <BrainCircuit />}
               {loading ? 'تحلیل روانشناختی...' : result ? 'بازگشت' : 'شروع تحلیل'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Sparkles className="text-indigo-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان روانشناسی و سلامت روان</h2>
            <p className="text-gray-500">Sanctuary of Mind & Soul</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-3xl col-span-2">
          <button onClick={() => { setActiveTab('art'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'art' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Palette /> هنر درمانی (Art Therapy)</button>
          <button onClick={() => { setActiveTab('dream'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'dream' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Moon /> تعبیر خواب هوشمند</button>
          <button onClick={() => { setActiveTab('sentiment'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'sentiment' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><BrainCircuit /> سنجش خلق و خو</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {activeTab === 'art' && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">آپلود نقاشی بیمار</h3>
              <p className="text-sm text-gray-500">تست‌های پیشنهادی: تست ترسیم ساعت (CDT) برای دمانس، یا تست خانه-درخت-آدم (HTP) برای شخصیت.</p>
              <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleArtFile} />
                 {artPreview ? <img src={artPreview} className="w-full h-full object-contain" alt="Art" /> : <div className="text-center p-4"><Palette className="mx-auto text-indigo-400 w-12 h-12 mb-3" /><p className="text-gray-600 font-medium">تصویر نقاشی را اینجا رها کنید</p></div>}
              </div>
              <button onClick={handleArtAnalyze} disabled={!artImage || loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50">{loading ? 'در حال آنالیز روانشناختی...' : 'تفسیر نقاشی'}</button>
            </div>
          )}
          {activeTab === 'dream' && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">تعبیر خواب دوگانه (مدرن و سنتی)</h3>
              <p className="text-sm text-gray-500">خواب بیمار را با جزئیات وارد کنید. هوش مصنوعی هم از دیدگاه روانکاوی (فروید/یونگ) و هم از دیدگاه معنوی (ابن‌سیرین) آن را تفسیر می‌کند.</p>
              <textarea className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-48 resize-none" placeholder="خواب را تعریف کنید..." value={dreamText} onChange={e => setDreamText(e.target.value)} />
              <button onClick={handleDreamAnalyze} disabled={!dreamText.trim() || loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50">{loading ? 'در حال کنکاش ناخودآگاه...' : 'تعبیر خواب'}</button>
            </div>
          )}
          {activeTab === 'sentiment' && (
            <div className="space-y-8 text-center py-10">
              <h3 className="font-bold text-gray-800">سنجش خلق و خو و افسردگی</h3>
              <p className="text-sm text-gray-500 px-4">از بیمار بخواهید درباره احساسات اخیر خود صحبت کند.</p>
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-indigo-100 animate-pulse' : 'bg-gray-100'}`}><Mic size={64} className={isRecording ? 'text-indigo-600' : 'text-gray-400'} /></div>
              <p className="text-gray-600">{isRecording ? 'در حال ضبط و تحلیل احساسات...' : audioBlob ? 'ضبط شد' : 'شروع مصاحبه'}</p>
              <div className="flex justify-center gap-4"><button onClick={isRecording ? stopRecording : startRecording} className={`p-6 rounded-full shadow-xl transition-all ${isRecording ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100'}`}>{isRecording ? <MicOff size={32} /> : <Mic size={32} />}</button></div>
              {audioBlob && !isRecording && <button onClick={handleSentimentAnalyze} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50">{loading ? 'در حال آنالیز احساسات...' : 'شروع سنجش'}</button>}
            </div>
          )}
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز</h3><p className="text-white/80 text-sm mt-1">{activeTab === 'dream' ? 'تفسیر جامع خواب' : result.interpretation}</p></div>{result.severity === 'critical' ? <AlertOctagon size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.type === 'dream' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><h4 className="font-bold text-blue-900 mb-2">تفسیر روانکاوی (مدرن)</h4><p className="text-sm text-gray-700">{result.modernAnalysis}</p></div><div className="bg-amber-50 p-4 rounded-xl border border-amber-100"><h4 className="font-bold text-amber-900 mb-2">تعبیر سنتی/معنوی</h4><p className="text-sm text-gray-700">{result.traditionalAnalysis}</p></div></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های کلیدی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-gray-50 p-4 rounded-xl"><h4 className="font-bold text-gray-800 mb-2">توصیه‌ها</h4><ul className="space-y-1">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-gray-600">• {r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><BrainCircuit size={48} className="mb-4" /><p>منتظر ورودی برای آنالیز...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Psychology;
