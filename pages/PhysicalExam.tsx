
import React, { useState } from 'react';
import { analyzePhysicalExam } from '../services/geminiService';
import { PhysicalExamAnalysis } from '../types';
import { Upload, Eye, Smile, AlertCircle, CheckCircle, Fingerprint, Search, Activity, ArrowLeft, Loader2 } from 'lucide-react';

type ExamType = 'skin' | 'tongue' | 'face';

const PhysicalExam: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [examType, setExamType] = useState<ExamType>('skin');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhysicalExamAnalysis | null>(null);

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
      const res = await analyzePhysicalExam(image, examType);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در تحلیل تصویر');
    } finally {
      setLoading(false);
    }
  };

  const ExamModeCard = ({ type, icon: Icon, title, desc }: { type: ExamType, icon: any, title: string, desc: string }) => (
    <button
      onClick={() => {
        setExamType(type);
        setResult(null);
        setImage(null);
        setPreview(null);
      }}
      className={`p-6 rounded-2xl border transition-all duration-200 text-right flex items-start gap-4 ${
        examType === type 
          ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' 
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-blue-300'
      }`}
    >
      <div className={`p-3 rounded-xl ${examType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
        <Icon size={24} />
      </div>
      <div>
        <h3 className={`font-bold text-lg ${examType === type ? 'text-blue-900' : 'text-gray-800'}`}>{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{desc}</p>
      </div>
    </button>
  );

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'high' ? 'bg-red-500' : result.severity === 'medium' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه معاینه</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'high' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.traditionalAnalysis && (
             <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
               <h4 className="font-bold text-amber-800 text-xs mb-1 flex items-center gap-1"><Smile size={12}/> تحلیل سنتی (مزاج)</h4>
               <p className="text-xs text-amber-900 leading-relaxed">{result.traditionalAnalysis}</p>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-blue-400">{f}</div>)}
           </div>
           <div className="bg-blue-50 p-3 rounded-xl">
              <h4 className="font-bold text-blue-800 text-sm mb-1">توصیه‌ها</h4>
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
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Eye size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">معاینه فیزیکی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setExamType('skin'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${examType === 'skin' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>پوست</button>
               <button onClick={() => { setExamType('tongue'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${examType === 'tongue' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>زبان</button>
               <button onClick={() => { setExamType('face'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${examType === 'face' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>چهره</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="space-y-4">
                     <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-3xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-cover" alt="Exam" /> : <div className="text-center"><div className="bg-white p-3 rounded-full mb-3 shadow-sm inline-block">{examType === 'skin' ? <Fingerprint size={24} className="text-blue-400" /> : examType === 'tongue' ? <Smile size={24} className="text-blue-400" /> : <Search size={24} className="text-blue-400" />}</div><p className="text-gray-500 text-xs font-bold">{examType === 'skin' ? 'عکس ضایعه پوستی' : examType === 'tongue' ? 'عکس زبان' : 'عکس صورت'}</p></div>}
                     </div>
                     <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                        {examType === 'skin' ? 'تشخیص اگزما، آکنه و ضایعات' : examType === 'tongue' ? 'تشخیص مزاج از روی رنگ زبان' : 'تشخیص کم‌خونی و یرقان'}
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
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white shadow-blue-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'پردازش تصویر...' : result ? 'بازگشت' : 'شروع معاینه'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        {/* Header */}
        <div className="flex flex-col gap-2 col-span-2">
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Eye className="text-blue-600" />
              معاینه فیزیکی هوشمند (Digital Exam)
           </h2>
           <p className="text-gray-500">انتخاب نوع معاینه جهت آنالیز بینایی ماشین</p>
        </div>

        {/* Mode Selection */}
        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ExamModeCard 
            type="skin" 
            icon={Fingerprint} 
            title="متخصص پوست (Dermatology)" 
            desc="تشخیص ضایعات پوستی، اگزما، آکنه و خطرات ملانوما" 
          />
          <ExamModeCard 
            type="tongue" 
            icon={Smile} 
            title="زبان‌شناسی (Tongue)" 
            desc="تشخیص بیماری‌های داخلی و مزاج از روی رنگ و بار زبان" 
          />
          <ExamModeCard 
            type="face" 
            icon={Search} 
            title="چهره‌شناسی (Face)" 
            desc="تشخیص کم‌خونی، یرقان و مزاج‌شناسی از روی چهره" 
          />
        </div>

        
        
        {/* Upload Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
           <h3 className="font-bold text-gray-800 mb-4">آپلود تصویر {examType === 'skin' ? 'پوست' : examType === 'tongue' ? 'زبان' : 'صورت'}</h3>
           
           <div className="border-2 border-dashed border-gray-300 rounded-2xl h-80 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-gray-50 transition-colors">
              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
              {preview ? (
                <img src={preview} alt="Exam" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={28} />
                  </div>
                  <p className="font-medium text-gray-600">تصویر را اینجا رها کنید یا کلیک کنید</p>
                  <p className="text-xs text-gray-400 mt-2">عکس باید با نور کافی و واضح باشد</p>
                </div>
              )}
           </div>

           <button
             onClick={handleAnalyze}
             disabled={!image || loading}
             className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 hover:shadow-xl transition-all flex items-center justify-center gap-2"
           >
             {loading ? 'در حال پردازش تصویر...' : 'شروع آنالیز هوشمند'}
           </button>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${
                  result.severity === 'high' ? 'bg-red-500' : result.severity === 'medium' ? 'bg-orange-500' : 'bg-green-600'
                }`}>
                   <div>
                     <h3 className="text-xl font-bold">نتیجه معاینه</h3>
                     <p className="text-white/80 text-sm">{result.diagnosis}</p>
                   </div>
                   {result.severity === 'high' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}
                </div>
                
                <div className="p-6 space-y-6">
                   {/* Traditional Analysis (Special for Tongue/Face) */}
                   {result.traditionalAnalysis && (
                     <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                          <Smile size={18} />
                          تحلیل طب سنتی (مزاج و ارگان‌ها)
                        </h4>
                        <p className="text-gray-800 leading-relaxed text-sm">{result.traditionalAnalysis}</p>
                     </div>
                   )}

                   <div>
                      <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های بالینی</h4>
                      <ul className="space-y-2">
                        {result.findings.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                            {f}
                          </li>
                        ))}
                      </ul>
                   </div>

                   <div>
                      <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">توصیه‌های پزشکی</h4>
                      <div className="grid gap-2">
                        {result.recommendations.map((r, i) => (
                          <div key={i} className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                            {r}
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70">
                <Eye size={48} className="mb-4" />
                <p>منتظر تصویر برای آنالیز...</p>
                <p className="text-xs mt-2">لطفا از یک عکس واضح استفاده کنید</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default PhysicalExam;
