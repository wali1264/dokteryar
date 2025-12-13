
import React, { useState } from 'react';
import { analyzeGynecology } from '../services/geminiService';
import { GynecologyAnalysis } from '../types';
import { Flower, Image, Activity, AlertCircle, CheckCircle, Upload, Search, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'ultrasound' | 'mammography' | 'fertility';

const Gynecology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('ultrasound');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GynecologyAnalysis | null>(null);

  // Image State (US/Mammo)
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Fertility Data
  const [fertilityData, setFertilityData] = useState({
    age: '',
    regularity: 'regular',
    symptoms: '',
    hormones: ''
  });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (activeTab === 'fertility') {
        if (!fertilityData.age) return;
        setLoading(true);
        try {
            const res = await analyzeGynecology(fertilityData, 'fertility');
            setResult(res);
        } catch (e) {
            console.error(e);
            alert('خطا در تحلیل باروری');
        } finally {
            setLoading(false);
        }
    } else {
        if (!image) return;
        setLoading(true);
        try {
            const res = await analyzeGynecology(image, activeTab);
            setResult(res);
        } catch (e) {
            console.error(e);
            alert('خطا در آنالیز تصویر');
        } finally {
            setLoading(false);
        }
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
             <h3 className="font-bold text-lg">نتیجه آنالیز</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.measurements && result.measurements.length > 0 && (
             <div className="bg-pink-50 p-3 rounded-xl border border-pink-100">
                <h4 className="font-bold text-pink-800 mb-2 text-xs flex items-center gap-1"><Activity size={12}/> اندازه‌گیری‌ها</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.measurements.map((m, i) => (
                     <div key={i} className="bg-white p-2 rounded-lg text-xs text-gray-700 shadow-sm text-center font-mono">{m}</div>
                  ))}
                </div>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-pink-400">{f}</div>)}
           </div>
           <div className="bg-purple-50 p-3 rounded-xl">
              <h4 className="font-bold text-purple-800 text-sm mb-1">توصیه‌ها</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => <li key={i} className="text-xs text-purple-900">• {r}</li>)}
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
                  <div className="bg-pink-100 p-2 rounded-xl text-pink-600"><Flower size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">زنان و زایمان</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('ultrasound'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ultrasound' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>سونوگرافی</button>
               <button onClick={() => { setActiveTab('mammography'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'mammography' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>ماموگرافی</button>
               <button onClick={() => { setActiveTab('fertility'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'fertility' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>باروری</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {(activeTab === 'ultrasound' || activeTab === 'mammography') && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-pink-200 bg-pink-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                           {preview ? <img src={preview} className="w-full h-full object-cover" alt="Scan" /> : <div className="text-center"><div className="bg-white p-3 rounded-full mb-3 shadow-sm inline-block">{activeTab === 'ultrasound' ? <Activity size={24} className="text-pink-400" /> : <Search size={24} className="text-pink-400" />}</div><p className="text-gray-500 text-xs font-bold">{activeTab === 'ultrasound' ? 'عکس سونوگرافی' : 'عکس ماموگرافی'}</p></div>}
                        </div>
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                           {activeTab === 'ultrasound' ? 'تشخیص سلامت جنین و ناهنجاری‌ها' : 'غربالگری توده و کلسیفیکاسیون'}
                        </p>
                     </div>
                  )}

                  {activeTab === 'fertility' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500">سن</label>
                           <input type="number" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold text-center" value={fertilityData.age} onChange={e => setFertilityData({...fertilityData, age: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500">وضعیت قاعدگی</label>
                           <select className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold" value={fertilityData.regularity} onChange={e => setFertilityData({...fertilityData, regularity: e.target.value})}>
                              <option value="regular">منظم</option>
                              <option value="irregular">نامنظم</option>
                              <option value="absent">قطع شده (آمنوره)</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500">هورمون‌ها (FSH/LH/AMH)</label>
                           <input type="text" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 text-sm font-bold" placeholder="مثال: LH: 12..." value={fertilityData.hormones} onChange={e => setFertilityData({...fertilityData, hormones: e.target.value})} />
                        </div>
                        <textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 h-20 resize-none text-sm" placeholder="علائم ظاهری (ریزش مو، آکنه...)" value={fertilityData.symptoms} onChange={e => setFertilityData({...fertilityData, symptoms: e.target.value})} />
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
               disabled={loading || (activeTab !== 'fertility' && !image) || (activeTab === 'fertility' && !fertilityData.age)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-pink-600 text-white shadow-pink-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Flower />}
               {loading ? 'در حال پردازش...' : result ? 'بازگشت' : 'شروع آنالیز'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Flower className="text-pink-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان زنان، زایمان و مامایی</h2>
            <p className="text-gray-500">Obstetrics & Gynecology Intelligence</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-3xl col-span-2">
          <button onClick={() => { setActiveTab('ultrasound'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'ultrasound' ? 'bg-pink-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> سونوگرافی جنین</button>
          <button onClick={() => { setActiveTab('mammography'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'mammography' ? 'bg-pink-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Search /> ماموگرافی (Breast)</button>
          <button onClick={() => { setActiveTab('fertility'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'fertility' ? 'bg-pink-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Flower /> هوش باروری (PCOS)</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
           {(activeTab === 'ultrasound' || activeTab === 'mammography') && (
               <div className="space-y-6">
                  <h3 className="font-bold text-gray-800 mb-2">{activeTab === 'ultrasound' ? 'آپلود سونوگرافی جنین (OB Ultrasound)' : 'آپلود ماموگرافی (Mammogram)'}</h3>
                  <p className="text-sm text-gray-500 mb-6">{activeTab === 'ultrasound' ? 'تشخیص اندام‌های جنین، تخمین سن حاملگی (GA)، وضعیت قرارگیری (Breach/Cephalic) و ناهنجاری‌ها.' : 'غربالگری توده، کلسیفیکاسیون و تراکم بافت سینه (BI-RADS).'}</p>
                  <div className="border-2 border-dashed border-pink-200 bg-pink-50/30 rounded-2xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                      {preview ? <img src={preview} className="w-full h-full object-contain" alt="Scan" /> : <div className="text-center p-4"><div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Upload size={32} /></div><p className="text-gray-600 font-medium">تصویر اسکن را اینجا رها کنید</p></div>}
                  </div>
               </div>
           )}
           {activeTab === 'fertility' && (
               <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 mb-4">ارزیابی هوشمند باروری و هورمونی</h3>
                  <div className="space-y-2"><label className="text-sm font-medium text-gray-700">سن بیمار</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" value={fertilityData.age} onChange={e => setFertilityData({...fertilityData, age: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-sm font-medium text-gray-700">وضعیت قاعدگی</label><select className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" value={fertilityData.regularity} onChange={e => setFertilityData({...fertilityData, regularity: e.target.value})}><option value="regular">منظم (Regular)</option><option value="irregular">نامنظم (Irregular)</option><option value="absent">آمنوره (Absent)</option></select></div>
                  <div className="space-y-2"><label className="text-sm font-medium text-gray-700">علائم ظاهری (هیرسوتیسم، آکنه، ریزش مو)</label><textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 h-24 resize-none" placeholder="توضیح علائم..." value={fertilityData.symptoms} onChange={e => setFertilityData({...fertilityData, symptoms: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-sm font-medium text-gray-700">سطح هورمون‌ها (FSH, LH, Prolactin, AMH)</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" placeholder="مثال: LH: 12, FSH: 4..." value={fertilityData.hormones} onChange={e => setFertilityData({...fertilityData, hormones: e.target.value})} /></div>
               </div>
           )}
           <button onClick={handleAnalyze} disabled={loading || (activeTab !== 'fertility' && !image)} className="w-full mt-6 bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-pink-200 hover:bg-pink-700 disabled:opacity-50">{loading ? 'در حال پردازش تخصصی...' : 'شروع آنالیز'}</button>
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.measurements && result.measurements.length > 0 && <div className="bg-pink-50 p-4 rounded-xl border border-pink-100"><h4 className="font-bold text-pink-800 mb-3 flex items-center gap-2"><Activity size={18} />اندازه‌گیری‌ها (Biometry)</h4><div className="grid grid-cols-2 gap-2">{result.measurements.map((m, i) => (<div key={i} className="bg-white p-2 rounded-lg text-sm text-gray-700 shadow-sm border border-pink-100 text-center font-mono">{m}</div>))}</div></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های بالینی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-pink-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-purple-50 p-4 rounded-xl"><h4 className="font-bold text-purple-800 mb-2">توصیه‌های درمانی و مراقبتی</h4><ul className="space-y-2">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-purple-900 bg-white p-2 rounded-lg border border-purple-100">{r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Flower size={48} className="mb-4" /><p>منتظر داده‌ها برای آنالیز زنان و زایمان...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Gynecology;
