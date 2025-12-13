
import React, { useState } from 'react';
import { analyzeOrthopedics } from '../services/geminiService';
import { OrthopedicsAnalysis } from '../types';
import { Bone, User, Upload, Activity, AlertCircle, CheckCircle, Scale, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'posture' | 'joints';

const Orthopedics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('posture');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrthopedicsAnalysis | null>(null);

  // Image State
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const res = await analyzeOrthopedics(image, activeTab);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز ارتوپدی');
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
             <h3 className="font-bold text-lg">نتیجه ارتوپدی</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.angles && result.angles.length > 0 && (
             <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <h4 className="font-bold text-orange-800 mb-2 text-xs flex items-center gap-1"><Scale size={12}/> زوایا (Angles)</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.angles.map((a, i) => (
                     <div key={i} className="bg-white p-2 rounded-lg text-xs text-gray-700 shadow-sm text-center font-mono">{a}</div>
                  ))}
                </div>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های ساختاری</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-orange-400">{f}</div>)}
           </div>
           <div className="bg-blue-50 p-3 rounded-xl">
              <h4 className="font-bold text-blue-800 text-sm mb-1 flex items-center gap-1"><Activity size={12}/> تمرینات اصلاحی</h4>
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
                  <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><Bone size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">ارتوپدی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('posture'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'posture' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>پاسچر (ستون فقرات)</button>
               <button onClick={() => { setActiveTab('joints'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'joints' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>مفاصل (زانو/دست)</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="space-y-4">
                     <div className="border-2 border-dashed border-orange-200 bg-orange-50/50 rounded-3xl h-72 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-cover" alt="Scan" /> : <div className="text-center"><div className="bg-white p-3 rounded-full mb-3 shadow-sm inline-block">{activeTab === 'posture' ? <User size={32} className="text-orange-400" /> : <Bone size={32} className="text-orange-400" />}</div><p className="text-gray-500 text-xs font-bold">{activeTab === 'posture' ? 'عکس تمام قد ایستاده' : 'عکس از مفصل دردناک'}</p></div>}
                        
                        {/* Overlay Guide for Posture */}
                        {activeTab === 'posture' && !preview && (
                           <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                              <div className="w-1 bg-black h-full"></div>
                              <div className="h-1 bg-black w-full absolute"></div>
                           </div>
                        )}
                     </div>
                     <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                        {activeTab === 'posture' ? 'برای تشخیص قوز، گودی کمر و انحراف ستون فقرات' : 'برای بررسی تورم، تغییر شکل و قرمزی مفاصل'}
                     </p>
                  </div>
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : handleAnalyze}
               disabled={loading || (!result && !image)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-orange-600 text-white shadow-orange-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'ترسیم خطوط تراز...' : result ? 'بازگشت' : 'شروع آنالیز اسکلتی'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Bone className="text-orange-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان ارتوپدی و هوش اسکلتی</h2>
            <p className="text-gray-500">Orthopedics & Posture Analysis</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-2xl col-span-2">
          <button onClick={() => { setActiveTab('posture'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'posture' ? 'bg-orange-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><User /> اسکنر پاسچر (ستون فقرات)</button>
          <button onClick={() => { setActiveTab('joints'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'joints' ? 'bg-orange-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Bone /> آنالیز مفاصل (آرتروز)</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
           <h3 className="font-bold text-gray-800 mb-2">{activeTab === 'posture' ? 'آپلود تصویر تمام‌قد ایستاده' : 'آپلود تصویر مفصل دردناک'}</h3>
           <p className="text-sm text-gray-500 mb-6">{activeTab === 'posture' ? 'برای تشخیص قوز، گودی کمر و انحراف ستون فقرات، یک عکس تمام قد از پهلو یا پشت بگیرید.' : 'برای بررسی تورم، قرمزی و تغییر شکل، از نزدیک از مفصل (زانو، دست، پا) عکس بگیرید.'}</p>
           <div className="border-2 border-dashed border-orange-200 bg-orange-50/30 rounded-2xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
              {preview ? <img src={preview} className="w-full h-full object-contain" alt="Orthopedic" /> : <div className="text-center p-4"><div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">{activeTab === 'posture' ? <User size={32} /> : <Bone size={32} />}</div><p className="text-gray-600 font-medium">تصویر را اینجا رها کنید</p></div>}
           </div>
           <button onClick={handleAnalyze} disabled={!image || loading} className="w-full mt-6 bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50">{loading ? 'در حال ترسیم خطوط تراز...' : 'آنالیز ساختار اسکلتی'}</button>
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه ارزیابی</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.angles && result.angles.length > 0 && <div className="bg-orange-50 p-4 rounded-xl border border-orange-100"><h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Scale size={18} />زوایای اندازه‌گیری شده</h4><div className="grid grid-cols-2 gap-2">{result.angles.map((a, i) => (<div key={i} className="bg-white p-2 rounded-lg text-sm text-gray-700 shadow-sm border border-orange-100 text-center font-mono">{a}</div>))}</div></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های ساختاری</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-blue-50 p-4 rounded-xl"><h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Activity size={18} />حرکات اصلاحی و ورزش‌ها (Rehab)</h4><ul className="space-y-2">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-blue-900 bg-white p-2 rounded-lg border border-blue-100">{r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Bone size={48} className="mb-4" /><p>منتظر تصویر برای آنالیز بیومکانیک...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Orthopedics;
