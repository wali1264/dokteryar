
import React, { useState, useEffect, useRef } from 'react';
import { DoctorProfile, PrescriptionSettings, LayoutElement } from '../types';
import { saveDoctorProfile, getDoctorProfile, saveSettings, getSettings, exportDatabase, importDatabase } from '../services/db';
import { User, Save, Upload, Download, CheckCircle, AlertCircle, Loader2, RotateCw, Type, Grid, Settings as SettingsIcon, Layers, Image as ImageIcon, Trash2, Database } from 'lucide-react';

type Tab = 'profile' | 'paper' | 'backup';

// ISO Standard Dimensions (at 96 DPI approx)
const A4_DIMS = { w: 794, h: 1123 };
const A5_DIMS = { w: 559, h: 794 };

// Default Elements if none exist
const DEFAULT_ELEMENTS: LayoutElement[] = [
  { id: 'patientName', type: 'text', label: 'نام بیمار', x: 500, y: 100, width: 200, fontSize: 16, rotation: 0, visible: true, align: 'right' },
  { id: 'date', type: 'text', label: 'تاریخ', x: 100, y: 100, width: 150, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'age', type: 'text', label: 'سن', x: 300, y: 100, width: 80, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'items', type: 'list', label: 'اقلام دارویی (لیست داروها)', x: 50, y: 250, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
  { id: 'diagnosis', type: 'text', label: 'تشخیص', x: 50, y: 180, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
  { id: 'vital_bp', type: 'text', label: 'فشار (BP)', x: 700, y: 300, width: 80, fontSize: 12, rotation: 0, visible: true, align: 'center' },
  { id: 'vital_hr', type: 'text', label: 'ضربان (PR)', x: 700, y: 340, width: 80, fontSize: 12, rotation: 0, visible: true, align: 'center' },
  { id: 'vital_rr', type: 'text', label: 'تنفس (RR)', x: 700, y: 380, width: 80, fontSize: 12, rotation: 0, visible: true, align: 'center' },
  { id: 'vital_temp', type: 'text', label: 'دما (T)', x: 700, y: 420, width: 80, fontSize: 12, rotation: 0, visible: true, align: 'center' },
  { id: 'vital_weight', type: 'text', label: 'وزن', x: 400, y: 100, width: 80, fontSize: 14, rotation: 0, visible: true, align: 'center' },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [profile, setProfile] = useState<DoctorProfile>({
    name: '', specialty: '', medicalCouncilNumber: '', phone: '', address: '', logo: ''
  });

  const [paperSettings, setPaperSettings] = useState<PrescriptionSettings>({
    topPadding: 50, fontSize: 14, fontFamily: 'Vazirmatn', backgroundImage: '', paperSize: 'A4', printBackground: true, elements: DEFAULT_ELEMENTS
  });

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await getDoctorProfile();
        if (p) setProfile(p);
        const s = await getSettings();
        if (s) {
           setPaperSettings(prev => ({
             ...prev, 
             ...s, 
             elements: s.elements && s.elements.length > 0 ? s.elements : DEFAULT_ELEMENTS 
           }));
        }
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await saveDoctorProfile(profile);
      showMessage('success', 'اطلاعات پزشک با موفقیت ذخیره شد.');
    } catch (e) {
      console.error(e);
      showMessage('error', 'خطا در ذخیره اطلاعات.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaper = async () => {
    setLoading(true);
    try {
      await saveSettings(paperSettings);
      showMessage('success', 'طراحی نسخه ذخیره شد.');
    } catch (e) {
      console.error(e);
      showMessage('error', 'خطا در ذخیره تنظیمات.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const getCanvasDimensions = () => {
    return paperSettings.paperSize === 'A4' ? A4_DIMS : A5_DIMS;
  };

  // --- MOUSE & TOUCH HANDLERS ---
  const handleStart = (clientX: number, clientY: number, elId: string) => {
    setSelectedElementId(elId);
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !selectedElementId || !dragStartRef.current) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPaperSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id === selectedElementId) {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return el;
      })
    }));
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleEnd = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Mouse Wrappers
  const handleMouseDown = (e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    handleStart(e.clientX, e.clientY, elId);
  };
  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const handleMouseUp = () => handleEnd();

  // Touch Wrappers
  const handleTouchStart = (e: React.TouchEvent, elId: string) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY, elId);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) e.preventDefault(); // Prevent scrolling while dragging
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const handleTouchEnd = () => handleEnd();

  const updateSelectedElement = (key: keyof LayoutElement, value: any) => {
    if (!selectedElementId) return;
    setPaperSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === selectedElementId ? { ...el, [key]: value } : el)
    }));
  };

  const selectedEl = paperSettings.elements.find(e => e.id === selectedElementId);
  const dims = getCanvasDimensions();

  const handleExport = async () => {
    setLoading(true);
    try {
      const json = await exportDatabase();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tabib_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showMessage('success', 'نسخه پشتیبان دانلود شد.');
    } catch (e) {
      console.error(e);
      showMessage('error', 'خطا در تهیه نسخه پشتیبان.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!confirm('آیا مطمئن هستید؟ این کار اطلاعات فعلی را بازنویسی می‌کند.')) return;
      setLoading(true);
      try {
        const file = e.target.files[0];
        const text = await file.text();
        await importDatabase(text);
        showMessage('success', 'اطلاعات با موفقیت بازیابی شد.');
        setTimeout(() => window.location.reload(), 1500); 
      } catch (e) {
        console.error(e);
        showMessage('error', 'فایل نامعتبر است.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div 
      className="animate-fade-in pb-20 h-full" 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="block">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gray-800 p-3 rounded-2xl text-white">
             <SettingsIcon size={32} />
          </div>
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">تنظیمات و مدیریت</h2>
            <p className="text-gray-500">Settings & Control Room</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-3xl overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('profile')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <User size={20} /> اطلاعات مطب
          </button>
          <button onClick={() => setActiveTab('paper')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'paper' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Grid size={20} /> طراحی نسخه
          </button>
          <button onClick={() => setActiveTab('backup')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'backup' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Database size={20} /> مدیریت داده
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-2 mt-4 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
             {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
             {message.text}
          </div>
        )}

        <div className="bg-white p-4 lg:p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px] mt-6">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto space-y-6">
               <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">اطلاعات مطب و پزشک</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-600">نام و نام خانوادگی پزشک</label>
                   <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="دکتر ..." />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-600">تخصص</label>
                   <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})} placeholder="متخصص داخلی..." />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-600">شماره نظام پزشکی</label>
                   <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" value={profile.medicalCouncilNumber} onChange={e => setProfile({...profile, medicalCouncilNumber: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-gray-600">شماره تماس مطب</label>
                   <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                 </div>
               </div>
               
               <div className="space-y-2">
                 <label className="text-sm font-bold text-gray-600">آدرس مطب</label>
                 <textarea className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 h-24 resize-none" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} />
               </div>

               <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600">لوگوی مطب</label>
                  <div className="flex items-center gap-4">
                     {profile.logo && <img src={profile.logo} className="w-16 h-16 rounded-lg object-contain border" alt="Logo" />}
                     <input type="file" accept="image/*" onChange={e => handleFileChange(e, val => setProfile({...profile, logo: val}))} className="text-sm text-gray-500" />
                  </div>
               </div>

               <button onClick={handleSaveProfile} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : <Save />}
                  ذخیره اطلاعات
               </button>
            </div>
          )}

          {/* PAPER SETTINGS TAB */}
          {activeTab === 'paper' && (
            <div className="space-y-6">
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-4 gap-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                     <Grid className="text-blue-600" />
                     طراحی سربرگ
                  </h3>
                  <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                     <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A4' }))} className={`px-3 py-1 rounded text-sm font-bold transition-all ${paperSettings.paperSize === 'A4' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>A4</button>
                        <button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A5' }))} className={`px-3 py-1 rounded text-sm font-bold transition-all ${paperSettings.paperSize === 'A5' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>A5</button>
                     </div>
                     <div className="relative">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, val => setPaperSettings(p => ({ ...p, backgroundImage: val })))} />
                        <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50">
                           <Upload size={16} /> سربرگ
                        </button>
                     </div>
                     <button onClick={() => setPaperSettings(p => ({ ...p, backgroundImage: '' }))} className="text-red-500 text-xs px-2 hover:bg-red-50 rounded">حذف</button>
                     <button onClick={handleSavePaper} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow hover:bg-emerald-700 ml-auto lg:ml-0">
                        <Save size={16} /> ذخیره
                     </button>
                  </div>
               </div>

               <div className="flex flex-col lg:flex-row gap-6 lg:h-[700px]">
                  <div className="flex-1 bg-gray-200 rounded-2xl overflow-auto p-4 lg:p-8 flex justify-center relative shadow-inner min-h-[400px]">
                     <div 
                       ref={canvasRef}
                       style={{ 
                          width: dims.w + 'px', 
                          height: dims.h + 'px', 
                          backgroundImage: paperSettings.backgroundImage ? `url(${paperSettings.backgroundImage})` : 'none',
                          backgroundSize: '100% 100%' 
                       }}
                       className="bg-white shadow-2xl relative transition-all duration-300 transform scale-[0.6] origin-top lg:scale-100 lg:origin-center" // Simple scaling for mobile preview
                     >
                        {!paperSettings.backgroundImage && (
                           <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">
                              <span className="text-4xl font-bold opacity-20 transform -rotate-45">محل آپلود عکس سربرگ</span>
                           </div>
                        )}

                        {paperSettings.elements.filter(el => el.visible).map(el => (
                           <div
                             key={el.id}
                             onMouseDown={(e) => handleMouseDown(e, el.id)}
                             onTouchStart={(e) => handleTouchStart(e, el.id)}
                             style={{
                                position: 'absolute',
                                left: el.x + 'px',
                                top: el.y + 'px',
                                width: el.width + 'px',
                                fontSize: el.fontSize + 'pt',
                                transform: `rotate(${el.rotation}deg)`,
                                cursor: isDragging ? 'grabbing' : 'grab',
                                border: selectedElementId === el.id ? '2px dashed #3b82f6' : '1px dotted #ccc',
                                backgroundColor: selectedElementId === el.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                                zIndex: selectedElementId === el.id ? 10 : 1,
                                textAlign: el.align || 'right'
                             }}
                             className="group hover:border-blue-400 select-none touch-none"
                           >
                              {el.label}
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="w-full lg:w-80 bg-white border border-gray-200 rounded-2xl p-6 lg:overflow-y-auto">
                     <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                       <Layers size={18} className="text-gray-500" />
                       المان‌ها
                     </h4>
                     <div className="space-y-2 mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                        {paperSettings.elements.map(el => (
                           <div key={el.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer" onClick={() => setSelectedElementId(el.id)}>
                              <div className="flex items-center gap-2">
                                 <input 
                                   type="checkbox" 
                                   checked={el.visible} 
                                   onChange={(e) => {
                                      e.stopPropagation();
                                      setPaperSettings(prev => ({
                                         ...prev,
                                         elements: prev.elements.map(item => item.id === el.id ? { ...item, visible: e.target.checked } : item)
                                      }));
                                   }}
                                 />
                                 <span className={`text-sm ${selectedElementId === el.id ? 'font-bold text-blue-600' : 'text-gray-700'}`}>{el.label}</span>
                              </div>
                           </div>
                        ))}
                     </div>

                     {selectedEl ? (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4 animate-fade-in">
                           <h5 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                              <Type size={14} />
                              ویرایش: {selectedEl.label}
                           </h5>
                           <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                 <label className="text-xs text-gray-500">سایز</label>
                                 <input type="number" className="w-full p-2 rounded border border-gray-200 text-sm" value={selectedEl.fontSize} onChange={e => updateSelectedElement('fontSize', parseInt(e.target.value))} />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-xs text-gray-500">عرض</label>
                                 <input type="number" className="w-full p-2 rounded border border-gray-200 text-sm" value={selectedEl.width} onChange={e => updateSelectedElement('width', parseInt(e.target.value))} />
                              </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-xs text-gray-500 flex items-center gap-1"><RotateCw size={10} /> چرخش</label>
                              <input type="range" min="-90" max="90" className="w-full" value={selectedEl.rotation} onChange={e => updateSelectedElement('rotation', parseInt(e.target.value))} />
                           </div>
                           <div className="flex justify-between bg-white p-2 rounded border border-gray-200">
                              <button onClick={() => updateSelectedElement('align', 'right')} className={`p-1 rounded ${selectedEl.align === 'right' ? 'bg-gray-200' : ''}`}>R</button>
                              <button onClick={() => updateSelectedElement('align', 'center')} className={`p-1 rounded ${selectedEl.align === 'center' ? 'bg-gray-200' : ''}`}>C</button>
                              <button onClick={() => updateSelectedElement('align', 'left')} className={`p-1 rounded ${selectedEl.align === 'left' ? 'bg-gray-200' : ''}`}>L</button>
                           </div>
                        </div>
                     ) : (
                        <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">یک المان را انتخاب کنید</p>
                     )}

                     <div className="mt-6 pt-6 border-t border-gray-200">
                        <label className="flex items-start gap-3 cursor-pointer">
                           <div className="relative flex items-center">
                              <input type="checkbox" className="sr-only peer" checked={paperSettings.printBackground} onChange={e => setPaperSettings(p => ({ ...p, printBackground: e.target.checked }))} />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:bg-blue-600"></div>
                           </div>
                           <div>
                              <span className="text-sm font-bold text-gray-700 block">چاپ عکس سربرگ</span>
                              <span className="text-xs text-gray-500 block">اگر تیک داشته باشد، عکس پس‌زمینه هم چاپ می‌شود.</span>
                           </div>
                        </label>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* BACKUP TAB */}
          {activeTab === 'backup' && (
            <div className="max-w-2xl mx-auto space-y-8 text-center">
               <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">پشتیبان‌گیری</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-green-50 p-8 rounded-3xl border border-green-100 flex flex-col items-center">
                     <div className="w-16 h-16 bg-green-200 text-green-700 rounded-full flex items-center justify-center mb-4"><Download size={32} /></div>
                     <h4 className="font-bold text-green-900 text-lg mb-2">خروجی گرفتن</h4>
                     <button onClick={handleExport} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Download size={20} />} دانلود فایل پشتیبان</button>
                  </div>
                  <div className="bg-orange-50 p-8 rounded-3xl border border-orange-100 flex flex-col items-center">
                     <div className="w-16 h-16 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center mb-4"><Upload size={32} /></div>
                     <h4 className="font-bold text-orange-900 text-lg mb-2">بازگردانی</h4>
                     <div className="relative w-full"><button className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />} آپلود فایل پشتیبان</button><input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} disabled={loading} /></div>
                  </div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
