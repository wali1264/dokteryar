
import React, { useState } from 'react';
import { analyzeOphthalmology } from '../services/geminiService';
import { OphthalmologyAnalysis } from '../types';
import { Glasses, Disc, Eye, Upload, AlertTriangle, CheckCircle, Activity, Palette, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'retina' | 'external' | 'vision';

const Ophthalmology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('retina');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OphthalmologyAnalysis | null>(null);

  // Image State
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Vision Test State
  const [visionStep, setVisionStep] = useState(0);
  const [visionScore, setVisionScore] = useState(0);
  const [testComplete, setTestComplete] = useState(false);

  // Simple Color Blindness Test Data (Simulated Ishihara)
  const ishiharaTests = [
    { id: 1, plateColor: 'bg-green-200', dotColor: 'text-orange-500', number: 12, fake: 8, label: 'سبز/نارنجی' },
    { id: 2, plateColor: 'bg-red-200', dotColor: 'text-green-600', number: 74, fake: 21, label: 'قرمز/سبز' },
    { id: 3, plateColor: 'bg-orange-200', dotColor: 'text-teal-600', number: 6, fake: 5, label: 'نارنجی/آبی' },
  ];

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async (type: 'fundus' | 'external') => {
    if (!image) return;
    setLoading(true);
    try {
      const res = await analyzeOphthalmology(image, type);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز چشم');
    } finally {
      setLoading(false);
    }
  };

  const handleVisionAnswer = (isCorrect: boolean) => {
    if (isCorrect) setVisionScore(s => s + 1);
    if (visionStep < ishiharaTests.length - 1) {
      setVisionStep(s => s + 1);
    } else {
      setTestComplete(true);
    }
  };

  const resetTest = () => {
    setVisionStep(0);
    setVisionScore(0);
    setTestComplete(false);
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
             <h3 className="font-bold text-lg">نتیجه آنالیز چشم</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.systemicIndicators && result.systemicIndicators.length > 0 && (
             <div className="bg-red-50 p-3 rounded-xl border border-red-100">
               <h4 className="font-bold text-red-800 text-xs mb-1 flex items-center gap-1"><Activity size={12}/> علائم سیستمیک</h4>
               <ul className="space-y-1">
                  {result.systemicIndicators.map((s, i) => <li key={i} className="text-xs text-red-700">• {s}</li>)}
               </ul>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-teal-400">{f}</div>)}
           </div>
           <div className="bg-teal-50 p-3 rounded-xl">
              <h4 className="font-bold text-teal-800 text-sm mb-1">توصیه‌ها</h4>
              <p className="text-xs text-teal-900 leading-relaxed">{result.recommendations.join(' - ')}</p>
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
                  <div className="bg-teal-100 p-2 rounded-xl text-teal-600"><Glasses size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">چشم‌پزشکی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('retina'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'retina' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>شبکیه</button>
               <button onClick={() => { setActiveTab('external'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'external' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>ظاهر چشم</button>
               <button onClick={() => { setActiveTab('vision'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'vision' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>تست بینایی</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {(activeTab === 'retina' || activeTab === 'external') && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-teal-200 bg-teal-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                           {preview ? <img src={preview} className="w-full h-full object-cover" alt="Eye" /> : <div className="text-center"><Eye className="mx-auto text-teal-400 mb-2" /><p className="text-gray-500 text-xs font-bold">{activeTab === 'retina' ? 'عکس شبکیه (Fundus)' : 'عکس قرنیه/پلک'}</p></div>}
                        </div>
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                           {activeTab === 'retina' ? 'برای تشخیص رتینوپاتی و فشار خون چشمی' : 'برای تشخیص آب مروارید، عفونت و ناخنک'}
                        </p>
                     </div>
                  )}

                  {activeTab === 'vision' && (
                     <div className="space-y-6 text-center">
                        {!testComplete ? (
                           <>
                              <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center text-5xl font-black tracking-tighter transition-all duration-500 mb-2 border-8 border-gray-100 shadow-inner ${ishiharaTests[visionStep].plateColor} ${ishiharaTests[visionStep].dotColor}`}>
                                 <span className="opacity-40 blur-[2px]">{ishiharaTests[visionStep].number}</span>
                              </div>
                              <p className="text-gray-500 text-sm font-bold">چه عددی می‌بینید؟</p>
                              <div className="grid grid-cols-2 gap-3">
                                 <button onClick={() => handleVisionAnswer(true)} className="bg-white border border-gray-200 p-4 rounded-2xl font-bold text-lg shadow-sm active:bg-teal-50 active:border-teal-500">{ishiharaTests[visionStep].number}</button>
                                 <button onClick={() => handleVisionAnswer(false)} className="bg-white border border-gray-200 p-4 rounded-2xl font-bold text-lg shadow-sm active:bg-red-50 active:border-red-500">{ishiharaTests[visionStep].fake}</button>
                                 <button onClick={() => handleVisionAnswer(false)} className="bg-white border border-gray-200 p-4 rounded-2xl font-bold text-lg shadow-sm active:bg-red-50 active:border-red-500">هیچکدام</button>
                                 <button onClick={() => handleVisionAnswer(false)} className="bg-white border border-gray-200 p-4 rounded-2xl font-bold text-lg shadow-sm active:bg-red-50 active:border-red-500">{ishiharaTests[visionStep].number + 3}</button>
                              </div>
                              <div className="flex justify-center gap-1 mt-2">
                                 {ishiharaTests.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i === visionStep ? 'w-6 bg-teal-600' : 'w-2 bg-gray-200'}`}></div>)}
                              </div>
                           </>
                        ) : (
                           <div className="bg-teal-50 p-6 rounded-3xl border border-teal-100 animate-fade-in">
                              <Activity className="mx-auto text-teal-600 w-12 h-12 mb-4" />
                              <h4 className="text-xl font-bold text-teal-900">نتیجه تست</h4>
                              <p className="text-gray-600 my-4">امتیاز: <span className="font-black text-2xl">{visionScore}</span> / {ishiharaTests.length}</p>
                              <p className="text-xs text-gray-500 mb-6">{visionScore === ishiharaTests.length ? 'دید رنگی طبیعی است.' : 'مشکوک به کوررنگی. لطفا به پزشک مراجعه کنید.'}</p>
                              <button onClick={resetTest} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg">تست مجدد</button>
                           </div>
                        )}
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         {/* Mobile Bottom Action */}
         {activeTab !== 'vision' && (
            <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
               <button 
                  onClick={result ? () => setResult(null) : () => handleAnalyze(activeTab as any)}
                  disabled={loading || (!result && !image)}
                  className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-teal-600 text-white shadow-teal-200'}`}
               >
                  {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Glasses />}
                  {loading ? 'در حال اسکن...' : result ? 'بازگشت' : 'شروع آنالیز'}
               </button>
            </div>
         )}
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Glasses className="text-teal-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان چشم‌پزشکی و شبکیه</h2>
            <p className="text-gray-500">Intelligent Ophthalmology & Retina</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-2xl col-span-2">
          <button onClick={() => { setActiveTab('retina'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'retina' ? 'bg-teal-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Disc /> شبکیه (Retina)</button>
          <button onClick={() => { setActiveTab('external'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'external' ? 'bg-teal-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Eye /> چشم خارجی</button>
          <button onClick={() => { setActiveTab('vision'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'vision' ? 'bg-teal-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Palette /> تست بینایی</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {(activeTab === 'retina' || activeTab === 'external') && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">{activeTab === 'retina' ? 'آپلود تصویر فوندوس (ته چشم)' : 'آپلود تصویر ظاهر چشم'}</h3>
              <p className="text-sm text-gray-500">{activeTab === 'retina' ? 'تشخیص رتینوپاتی دیابتی، فشار خون، گلوکوم و دژنراسیون ماکولا.' : 'تشخیص آب مروارید، ناخنک، عفونت و مشکلات پلک.'}</p>
              <div className="border-2 border-dashed border-teal-200 bg-teal-50/30 rounded-2xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                 {preview ? <img src={preview} className="w-full h-full object-contain" alt="Eye" /> : <div className="text-center p-4"><Eye className="mx-auto text-teal-400 w-12 h-12 mb-3" /><p className="text-gray-600 font-medium">تصویر چشم را اینجا رها کنید</p></div>}
              </div>
              <button onClick={() => handleAnalyze(activeTab === 'retina' ? 'fundus' : 'external')} disabled={!image || loading} className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 disabled:opacity-50">{loading ? 'در حال اسکن لایه‌های چشم...' : `آنالیز هوشمند ${activeTab === 'retina' ? 'شبکیه' : 'قرنیه و عدسی'}`}</button>
            </div>
          )}

          {activeTab === 'vision' && (
             <div className="space-y-8 text-center py-6">
               <h3 className="font-bold text-gray-800">تست کوررنگی (Ishihara Simulation)</h3>
               {!testComplete ? (
                 <div className="animate-fade-in">
                    <div className={`w-48 h-48 mx-auto rounded-full flex items-center justify-center text-6xl font-black tracking-tighter transition-all duration-500 mb-6 border-8 border-gray-100 shadow-inner ${ishiharaTests[visionStep].plateColor} ${ishiharaTests[visionStep].dotColor}`}><span className="opacity-40 blur-[2px]">{ishiharaTests[visionStep].number}</span></div>
                    <p className="text-gray-500 mb-6 text-sm">چه عددی را در تصویر بالا مشاهده می‌کنید؟</p>
                    <div className="grid grid-cols-2 gap-4"><button onClick={() => handleVisionAnswer(true)} className="bg-gray-100 hover:bg-teal-100 hover:text-teal-700 p-4 rounded-xl font-bold text-xl transition-all border border-gray-200">{ishiharaTests[visionStep].number}</button><button onClick={() => handleVisionAnswer(false)} className="bg-gray-100 hover:bg-red-100 hover:text-red-700 p-4 rounded-xl font-bold text-xl transition-all border border-gray-200">{ishiharaTests[visionStep].fake}</button><button onClick={() => handleVisionAnswer(false)} className="bg-gray-100 hover:bg-orange-100 hover:text-orange-700 p-4 rounded-xl font-bold text-xl transition-all border border-gray-200">هیچکدام</button><button onClick={() => handleVisionAnswer(false)} className="bg-gray-100 hover:bg-blue-100 hover:text-blue-700 p-4 rounded-xl font-bold text-xl transition-all border border-gray-200">{ishiharaTests[visionStep].number + 3}</button></div>
                    <div className="mt-6 flex justify-center gap-2">{ishiharaTests.map((_, i) => (<div key={i} className={`h-2 rounded-full transition-all ${i === visionStep ? 'w-8 bg-teal-600' : 'w-2 bg-gray-200'}`}></div>))}</div>
                 </div>
               ) : (
                 <div className="animate-fade-in bg-teal-50 p-6 rounded-2xl border border-teal-100"><Activity className="mx-auto text-teal-600 w-16 h-16 mb-4" /><h4 className="text-xl font-bold text-teal-900 mb-2">نتیجه تست</h4><p className="text-gray-600 mb-6">امتیاز شما: <span className="font-bold text-2xl text-teal-700">{visionScore}</span> از {ishiharaTests.length}</p><div className="text-sm text-gray-700 bg-white p-4 rounded-xl border border-teal-100 mb-6">{visionScore === ishiharaTests.length ? 'تبریک! دید رنگی شما طبیعی به نظر می‌رسد.' : 'احتمال اختلال در دید رنگ (کوررنگی) وجود دارد. لطفا برای معاینه دقیق‌تر به چشم‌پزشک مراجعه کنید.'}</div><button onClick={resetTest} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-teal-700 flex items-center justify-center gap-2 mx-auto"><ArrowLeft size={18} />تست مجدد</button></div>
               )}
            </div>
          )}
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز چشم</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.systemicIndicators && result.systemicIndicators.length > 0 && <div className="bg-red-50 p-4 rounded-xl border border-red-100"><h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><Activity size={18} />علائم بیماری‌های داخلی (Systemic)</h4><ul className="space-y-1">{result.systemicIndicators.map((s, i) => (<li key={i} className="text-sm text-red-700">• {s}</li>))}</ul></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های چشمی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-teal-50 p-4 rounded-xl"><h4 className="font-bold text-teal-800 mb-2">توصیه‌های درمانی</h4><ul className="space-y-1">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-teal-900">• {r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             activeTab !== 'vision' && <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Glasses size={48} className="mb-4" /><p>منتظر تصویر برای آنالیز تخصصی...</p></div>
           )}
           {activeTab === 'vision' && !result && <div className="h-full bg-gray-50 rounded-3xl border border-gray-200 p-8 flex flex-col items-center justify-center text-center"><h3 className="text-xl font-bold text-gray-600 mb-4">اهمیت تست بینایی</h3><p className="text-gray-500 leading-relaxed mb-6">بسیاری از بیماری‌های چشم مانند گلوکوم (آب سیاه) تا مراحل پیشرفته بدون علامت هستند. تست‌های منظم می‌تواند از نابینایی جلوگیری کند.<br/><br/>این ابزار یک تست غربالگری اولیه است و جایگزین معاینه کامل چشم‌پزشکی نمی‌شود.</p><div className="flex gap-4 opacity-50"><div className="w-12 h-12 rounded-full bg-red-200"></div><div className="w-12 h-12 rounded-full bg-green-200"></div><div className="w-12 h-12 rounded-full bg-blue-200"></div></div></div>}
        </div>
      </div>
    </div>
  );
};

export default Ophthalmology;
