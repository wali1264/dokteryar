
import React, { useState, useEffect, useRef } from 'react';
import { DoctorProfile, PrescriptionSettings, LayoutElement, Drug, DrugUsage } from '../types';
import { saveDoctorProfile, getDoctorProfile, saveSettings, getSettings, exportDatabase, importDatabase, getAllDrugs, saveDrug, deleteDrug, getUsageStats } from '../services/db';
import { User, Save, Upload, Download, CheckCircle, AlertCircle, Loader2, RotateCw, Type, Grid, Settings as SettingsIcon, Layers, Image as ImageIcon, Trash2, Database, Pill, Plus, Search, TrendingUp, Edit2, X, Beaker, Droplet, Zap, Syringe, SprayCan } from 'lucide-react';

type Tab = 'profile' | 'paper' | 'drugs' | 'backup';

// ISO Standard Dimensions (at 96 DPI approx)
const A4_DIMS = { w: 794, h: 1123 };
const A5_DIMS = { w: 559, h: 794 };

// Default Elements if none exist
const DEFAULT_ELEMENTS: LayoutElement[] = [
  { id: 'patientName', type: 'text', label: 'نام بیمار', x: 500, y: 100, width: 200, fontSize: 16, rotation: 0, visible: true, align: 'right' },
  { id: 'patientId', type: 'text', label: 'شماره پرونده (ID)', x: 500, y: 130, width: 100, fontSize: 12, rotation: 0, visible: true, align: 'right' },
  { id: 'date', type: 'text', label: 'تاریخ', x: 100, y: 100, width: 150, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'age', type: 'text', label: 'سن', x: 300, y: 100, width: 80, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'chiefComplaint', type: 'text', label: 'شکایت اصلی (CC)', x: 50, y: 160, width: 700, fontSize: 12, rotation: 0, visible: true, align: 'right' },
  { id: 'items', type: 'list', label: 'اقلام دارویی (لیست داروها)', x: 50, y: 250, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
  { id: 'diagnosis', type: 'text', label: 'تشخیص نهایی', x: 50, y: 190, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
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

  // Drug Bank Local State
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [usageStats, setUsageStats] = useState<DrugUsage[]>([]);
  const [drugSearch, setDrugSearch] = useState('');
  const [newDrugName, setNewDrugName] = useState('');
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const drugInputRef = useRef<HTMLInputElement>(null);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      const d = await getAllDrugs();
      setDrugs(d);
      const stats = await getUsageStats();
      setUsageStats(stats);
    } catch (e) { console.error(e); }
  };

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

  const handleAddDrug = async () => {
    if (!newDrugName) return;
    setLoading(true);
    try {
        const d: Drug = {
            id: crypto.randomUUID(),
            name: newDrugName,
            isCustom: true,
            createdAt: Date.now()
        };
        await saveDrug(d);
        setNewDrugName('');
        await loadData();
        showMessage('success', 'دارو به بانک اضافه شد.');
    } catch (e) {
        showMessage('error', 'خطا در افزودن دارو.');
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateDrug = async () => {
    if (!editingDrug || !editingDrug.name) return;
    setLoading(true);
    try {
        await saveDrug(editingDrug);
        setEditingDrug(null);
        await loadData();
        showMessage('success', 'تغییرات دارو ذخیره شد.');
    } catch (e) {
        showMessage('error', 'خطا در ویرایش دارو.');
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteDrug = async (id: string) => {
    if (confirm('آیا از حذف این دارو از بانک محلی مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
        await deleteDrug(id);
        await loadData();
        showMessage('success', 'دارو حذف گردید.');
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

  const applyDrugFormPrefix = (prefix: string) => {
    setNewDrugName(prefix + " ");
    if (drugInputRef.current) {
        drugInputRef.current.focus();
    }
  };

  const getCanvasDimensions = () => {
    return paperSettings.paperSize === 'A4' ? A4_DIMS : A5_DIMS;
  };

  // --- Drag Handlers ---
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

  const handleMouseDown = (e: React.MouseEvent, elId: string) => { e.stopPropagation(); handleStart(e.clientX, e.clientY, elId); };
  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const handleMouseUp = () => handleEnd();
  const handleTouchStart = (e: React.TouchEvent, elId: string) => { e.stopPropagation(); if (e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY, elId); };
  const handleTouchMove = (e: React.TouchEvent) => { if (isDragging) e.preventDefault(); if (e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY); };
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
      const a = document.body.appendChild(document.createElement('a'));
      a.href = url; a.download = `tabib_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
      document.body.removeChild(a);
      showMessage('success', 'نسخه پشتیبان دانلود شد.');
    } catch (e) {
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
        const text = await e.target.files[0].text();
        await importDatabase(text);
        showMessage('success', 'اطلاعات با موفقیت بازیابی شد.');
        setTimeout(() => window.location.reload(), 1500); 
      } catch (e) {
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
      <div>
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
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-4xl overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('profile')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <User size={20} /> اطلاعات مطب
          </button>
          <button onClick={() => setActiveTab('paper')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'paper' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Grid size={20} /> طراحی نسخه
          </button>
          <button onClick={() => setActiveTab('drugs')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'drugs' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Pill size={20} /> بانک دارو
          </button>
          <button onClick={() => setActiveTab('backup')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'backup' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Database size={20} /> مدیریت داده
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-2 mt-4 animate-slide-up ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
                 <div className="space-y-2"><label className="text-sm font-bold text-gray-600">نام پزشک</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="دکتر ..." /></div>
                 <div className="space-y-2"><label className="text-sm font-bold text-gray-600">تخصص</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})} placeholder="متخصص..." /></div>
                 <div className="space-y-2"><label className="text-sm font-bold text-gray-600">شماره نظام</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={profile.medicalCouncilNumber} onChange={e => setProfile({...profile, medicalCouncilNumber: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-sm font-bold text-gray-600">تلفن</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} /></div>
               </div>
               <div className="space-y-2"><label className="text-sm font-bold text-gray-600">آدرس</label><textarea className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-24 resize-none" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} /></div>
               <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600">لوگوی مطب</label>
                  <div className="flex items-center gap-4">
                     {profile.logo && <img src={profile.logo} className="w-16 h-16 rounded-lg object-contain border" alt="Logo" />}
                     <input type="file" accept="image/*" onChange={e => handleFileChange(e, val => setProfile({...profile, logo: val}))} className="text-sm text-gray-500" />
                  </div>
               </div>
               <button onClick={handleSaveProfile} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Save />} ذخیره اطلاعات</button>
            </div>
          )}

          {/* DRUG BANK TAB */}
          {activeTab === 'drugs' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
               <div className="flex flex-col space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Pill className="text-indigo-600" /> بانک داروی هوشمند</h3>
                      <p className="text-xs text-gray-400 mt-1">مدیریت لیست داروها (۱۵۰۰+ مورد) و ویرایش آزادانه</p>
                    </div>
                  </div>

                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-inner">
                    <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 block mr-1">افزودن داروی جدید</label>
                    
                    {/* Quick Form chips */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {[
                            { label: 'Tab', icon: Pill },
                            { label: 'Cap', icon: Pill },
                            { label: 'Syr', icon: Beaker },
                            { label: 'Inj', icon: Syringe },
                            { label: 'Drop', icon: Droplet },
                            { label: 'Oint', icon: SprayCan },
                            { label: 'Cream', icon: SprayCan },
                            { label: 'Susp', icon: Beaker },
                        ].map((form) => (
                            <button 
                                key={form.label}
                                onClick={() => applyDrugFormPrefix(form.label)}
                                className="bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                                <form.icon size={12} />
                                {form.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 w-full">
                      <input 
                        ref={drugInputRef}
                        type="text" 
                        className="flex-1 p-4 bg-white border border-indigo-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 text-lg font-bold text-gray-800 shadow-sm transition-all" 
                        placeholder="ابتدا نوع را انتخاب و سپس نام را بنویسید..." 
                        value={newDrugName} 
                        onChange={e => setNewDrugName(e.target.value)} 
                      />
                      <button onClick={handleAddDrug} disabled={!newDrugName || loading} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                        {loading ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
                        ثبت دارو
                      </button>
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-gray-50">
                  {/* Usage Stats */}
                  <div className="md:col-span-1 space-y-4">
                     <h4 className="font-black text-gray-400 flex items-center gap-2 text-[10px] uppercase tracking-widest"><TrendingUp size={14} className="text-teal-500" /> پرمصرف‌ترین داروها</h4>
                     <div className="bg-gray-50 rounded-[2rem] p-5 border border-gray-100 space-y-3">
                        {usageStats.length === 0 ? <p className="text-center text-xs text-gray-400 py-10">هنوز آماری ثبت نشده</p> : 
                         usageStats.slice(0, 10).map((u, i) => (
                           <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                              <span className="text-xs font-black text-gray-700">{u.drugName}</span>
                              <span className="bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full text-[10px] font-black">{u.count} بار</span>
                           </div>
                         ))
                        }
                     </div>
                  </div>

                  {/* Complete List with Search and CRUD */}
                  <div className="md:col-span-2 space-y-4">
                     <div className="relative">
                        <input type="text" className="w-full p-4 pr-12 bg-white rounded-[1.5rem] border border-gray-200 shadow-sm outline-none focus:ring-4 focus:ring-indigo-50 font-bold" placeholder="جستجو در تمام اشکال دارویی..." value={drugSearch} onChange={e => setDrugSearch(e.target.value)} />
                        <Search className="absolute right-4 top-4.5 text-gray-400" />
                     </div>
                     <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden max-h-[500px] overflow-y-auto custom-scrollbar shadow-sm">
                        <table className="w-full text-right text-sm">
                           <thead className="bg-gray-50 text-gray-400 font-black border-b border-gray-100 text-[10px] uppercase tracking-widest">
                              <tr><th className="p-4">نام کامل دارو</th><th className="p-4">منبع</th><th className="p-4 text-center">عملیات</th></tr>
                           </thead>
                           <tbody className="divide-y divide-gray-50">
                              {drugs.filter(d => d.name.toLowerCase().includes(drugSearch.toLowerCase())).map(d => (
                                 <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="p-4 font-black text-gray-700 text-base">{d.name}</td>
                                    <td className="p-4"><span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${d.isCustom ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>{d.isCustom ? 'شخصی' : 'سیستمی'}</span></td>
                                    <td className="p-4 text-center">
                                       <div className="flex justify-center gap-1 transition-opacity">
                                          <button onClick={() => setEditingDrug(d)} title="ویرایش" className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100"><Edit2 size={16} /></button>
                                          <button onClick={() => handleDeleteDrug(d.id)} title="حذف" className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all border border-red-100"><Trash2 size={16}/></button>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>

               {/* Editing Modal */}
               {editingDrug && (
                  <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                     <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-fade-in">
                        <div className="flex justify-between items-center mb-8">
                           <h4 className="font-black text-xl text-gray-800 flex items-center gap-2"><Edit2 size={24} className="text-indigo-600" /> ویرایش دارو</h4>
                           <button onClick={() => setEditingDrug(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="space-y-6">
                           <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block mr-1">نام و مشخصات کامل</label>
                              <input 
                                 autoFocus
                                 className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-bold text-gray-800" 
                                 value={editingDrug.name} 
                                 onChange={e => setEditingDrug({...editingDrug, name: e.target.value})} 
                              />
                           </div>
                           <button onClick={handleUpdateDrug} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 text-lg hover:bg-indigo-700 transition-all active:scale-95">
                              {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                              ذخیره تغییرات
                           </button>
                        </div>
                     </div>
                  </div>
               )}
            </div>
          )}

          {/* PAPER SETTINGS TAB */}
          {activeTab === 'paper' && (
            <div className="space-y-6">
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-4 gap-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Grid className="text-blue-600" /> طراحی سربرگ</h3>
                  <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                     <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A4' }))} className={`px-3 py-1 rounded text-sm font-bold transition-all ${paperSettings.paperSize === 'A4' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>A4</button>
                        <button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A5' }))} className={`px-3 py-1 rounded text-sm font-bold transition-all ${paperSettings.paperSize === 'A5' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>A5</button>
                     </div>
                     <div className="relative"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, val => setPaperSettings(p => ({ ...p, backgroundImage: val })))} /><button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50"><Upload size={16} /> سربرگ</button></div>
                     <button onClick={() => setPaperSettings(p => ({ ...p, backgroundImage: '' }))} className="text-red-500 text-xs px-2 hover:bg-red-50 rounded">حذف</button>
                     <button onClick={handleSavePaper} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow hover:bg-emerald-700 ml-auto lg:ml-0"><Save size={16} /> ذخیره</button>
                  </div>
               </div>
               <div className="flex flex-col lg:flex-row gap-6 lg:h-[700px]">
                  <div className="flex-1 bg-gray-200 rounded-2xl overflow-auto p-4 lg:p-8 flex justify-center relative shadow-inner min-h-[400px]">
                     <div ref={canvasRef} style={{ width: dims.w + 'px', height: dims.h + 'px', backgroundImage: paperSettings.backgroundImage ? `url(${paperSettings.backgroundImage})` : 'none', backgroundSize: '100% 100%' }} className="bg-white shadow-2xl relative transition-all duration-300 transform scale-[0.6] origin-top lg:scale-100 lg:origin-center">
                        {!paperSettings.backgroundImage && <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none"><span className="text-4xl font-bold opacity-20 transform -rotate-45">محل آپلود عکس سربرگ</span></div>}
                        {paperSettings.elements.filter(el => el.visible).map(el => (
                           <div key={el.id} onMouseDown={(e) => handleMouseDown(e, el.id)} onTouchStart={(e) => handleTouchStart(e, el.id)} style={{ position: 'absolute', left: el.x + 'px', top: el.y + 'px', width: el.width + 'px', fontSize: el.fontSize + 'pt', transform: `rotate(${el.rotation}deg)`, cursor: isDragging ? 'grabbing' : 'grab', border: selectedElementId === el.id ? '2px dashed #3b82f6' : '1px dotted #ccc', backgroundColor: selectedElementId === el.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.6)', zIndex: selectedElementId === el.id ? 10 : 1, textAlign: el.align || 'right' }} className="group hover:border-blue-400 select-none touch-none">{el.label}</div>
                        ))}
                     </div>
                  </div>
                  <div className="w-full lg:w-80 bg-white border border-gray-200 rounded-2xl p-6 lg:overflow-y-auto">
                     <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2"><Layers size={18} className="text-gray-500" /> المان‌ها</h4>
                     <div className="space-y-2 mb-6 max-h-48 overflow-y-auto custom-scrollbar">{paperSettings.elements.map(el => (<div key={el.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer" onClick={() => setSelectedElementId(el.id)}><div className="flex items-center gap-2"><input type="checkbox" checked={el.visible} onChange={(e) => { e.stopPropagation(); setPaperSettings(prev => ({ ...prev, elements: prev.elements.map(item => item.id === el.id ? { ...item, visible: e.target.checked } : item) })); }} /><span className={`text-sm ${selectedElementId === el.id ? 'font-bold text-blue-600' : 'text-gray-700'}`}>{el.label}</span></div></div>))}</div>
                     {selectedEl ? (<div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4 animate-fade-in"><h5 className="font-bold text-blue-900 text-sm flex items-center gap-2"><Type size={14} /> ویرایش: {selectedEl.label}</h5><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-gray-500">سایز</label><input type="number" className="w-full p-2 rounded border border-gray-200 text-sm" value={selectedEl.fontSize} onChange={e => updateSelectedElement('fontSize', parseInt(e.target.value))} /></div><div className="space-y-1"><label className="text-xs text-gray-500">عرض</label><input type="number" className="w-full p-2 rounded border border-gray-200 text-sm" value={selectedEl.width} onChange={e => updateSelectedElement('width', parseInt(e.target.value))} /></div></div><div className="space-y-1"><label className="text-xs text-gray-500 flex items-center gap-1"><RotateCw size={10} /> چرخش</label><input type="range" min="-90" max="90" className="w-full" value={selectedEl.rotation} onChange={e => updateSelectedElement('rotation', parseInt(e.target.value))} /></div><div className="flex justify-between bg-white p-2 rounded border border-gray-200"><button onClick={() => updateSelectedElement('align', 'right')} className={`p-1 rounded ${selectedEl.align === 'right' ? 'bg-gray-200' : ''}`}>R</button><button onClick={() => updateSelectedElement('align', 'center')} className={`p-1 rounded ${selectedEl.align === 'center' ? 'bg-gray-200' : ''}`}>C</button><button onClick={() => updateSelectedElement('align', 'left')} className={`p-1 rounded ${selectedEl.align === 'left' ? 'bg-gray-200' : ''}`}>L</button></div></div>) : (<p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">یک المان را انتخاب کنید</p>)}
                     <div className="mt-6 pt-6 border-t border-gray-200"><label className="flex items-start gap-3 cursor-pointer"><div className="relative flex items-center"><input type="checkbox" className="sr-only peer" checked={paperSettings.printBackground} onChange={e => setPaperSettings(p => ({ ...p, printBackground: e.target.checked }))} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:bg-blue-600"></div></div><div><span className="text-sm font-bold text-gray-700 block">چاپ عکس سربرگ</span><span className="text-xs text-gray-500 block">اگر تیک داشته باشد، عکس پس‌زمینه هم چاپ می‌شود.</span></div></label></div>
                  </div>
               </div>
            </div>
          )}

          {/* BACKUP TAB */}
          {activeTab === 'backup' && (
            <div className="max-w-2xl mx-auto space-y-8 text-center">
               <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">پشتیبان‌گیری</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-green-50 p-8 rounded-3xl border border-green-100 flex flex-col items-center"><div className="w-16 h-16 bg-green-200 text-green-700 rounded-full flex items-center justify-center mb-4"><Download size={32} /></div><h4 className="font-bold text-green-900 text-lg mb-2">خروجی گرفتن</h4><button onClick={handleExport} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Download size={20} />} دانلود فایل پشتیبان</button></div>
                  <div className="bg-orange-50 p-8 rounded-3xl border border-orange-100 flex flex-col items-center"><div className="w-16 h-16 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center mb-4"><Upload size={32} /></div><h4 className="font-bold text-orange-900 text-lg mb-2">بازگردانی</h4><div className="relative w-full"><button className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />} آپلود فایل پشتیبان</button><input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} disabled={loading} /></div></div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
