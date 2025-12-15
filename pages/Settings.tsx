
import React, { useState, useEffect, useRef } from 'react';
import { DoctorProfile, PrescriptionSettings, LayoutElement } from '../types';
import { saveDoctorProfile, getDoctorProfile, saveSettings, getSettings, exportDatabase, importDatabase } from '../services/db';
import { User, FileImage, Database, Save, Upload, Download, CheckCircle, AlertCircle, Loader2, Move, RotateCw, Type, Trash, Grid, Monitor, Printer, Settings as SettingsIcon, ToggleLeft, ToggleRight, FileText, Smartphone, ZoomIn, ZoomOut, Maximize, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Layers, Hand } from 'lucide-react';

type Tab = 'profile' | 'paper' | 'backup';

// Default Elements if none exist
const DEFAULT_ELEMENTS: LayoutElement[] = [
  { id: 'patientName', type: 'text', label: 'نام بیمار', x: 500, y: 100, width: 200, fontSize: 16, rotation: 0, visible: true, align: 'right' },
  { id: 'date', type: 'text', label: 'تاریخ', x: 100, y: 100, width: 150, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'age', type: 'text', label: 'سن', x: 300, y: 100, width: 80, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'items', type: 'list', label: 'اقلام دارویی (لیست داروها)', x: 50, y: 250, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
  { id: 'diagnosis', type: 'text', label: 'تشخیص', x: 50, y: 180, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
  // Side Vitals
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

  // Profile State
  const [profile, setProfile] = useState<DoctorProfile>({
    name: '', specialty: '', medicalCouncilNumber: '', phone: '', address: '', logo: ''
  });

  // Paper Settings State
  const [paperSettings, setPaperSettings] = useState<PrescriptionSettings>({
    topPadding: 50, fontSize: 14, fontFamily: 'Vazirmatn', backgroundImage: '', paperSize: 'A4', printBackground: true, elements: DEFAULT_ELEMENTS
  });

  // Design Studio State (Shared)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- MOBILE POCKET STUDIO STATE ---
  const [mobileScale, setMobileScale] = useState(0.4);
  const [mobileOffset, setMobileOffset] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number, y: number, dist: number } | null>(null);
  const lastOffsetRef = useRef({ x: 0, y: 0 });
  const lastScaleRef = useRef(0.4);
  const [showLayerList, setShowLayerList] = useState(false);

  // Load Data
  useEffect(() => {
    const load = async () => {
      try {
        const p = await getDoctorProfile();
        if (p) setProfile(p);
        
        const s = await getSettings();
        if (s) {
           // Merge with defaults to ensure all fields exist if schema updated
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
      reader.onload = () => setter(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // --- DESIGNER LOGIC (SHARED) ---

  const getCanvasDimensions = () => {
    // A4 in px at ~96 DPI: 794x1123. A5: 559x794.
    return paperSettings.paperSize === 'A4' ? { w: 794, h: 1123 } : { w: 559, h: 794 };
  };

  // --- DESKTOP MOUSE HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    setSelectedElementId(elId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId || !dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    setPaperSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id === selectedElementId) {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return el;
      })
    }));

    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const updateSelectedElement = (key: keyof LayoutElement, value: any) => {
    if (!selectedElementId) return;
    setPaperSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === selectedElementId ? { ...el, [key]: value } : el)
    }));
  };

  const selectedEl = paperSettings.elements.find(e => e.id === selectedElementId);
  const dims = getCanvasDimensions();

  // --- MOBILE TOUCH LOGIC (POCKET STUDIO) ---
  
  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // If selecting an element directly (tap)
    // We let the element's onClick handle selection, but here we capture for drag/pan
    
    if (e.touches.length === 2) {
      // Pinch Zoom Mode
      touchStartRef.current = { 
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: getDistance(e.touches) 
      };
      lastScaleRef.current = mobileScale;
      lastOffsetRef.current = { ...mobileOffset };
    } else if (e.touches.length === 1) {
      // Pan or Drag Mode
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0 };
      lastOffsetRef.current = { ...mobileOffset };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length === 2) {
      // --- ZOOM & PAN (VIEW MODE) ---
      const newDist = getDistance(e.touches);
      const scaleFactor = newDist / touchStartRef.current.dist;
      let newScale = lastScaleRef.current * scaleFactor;
      newScale = Math.min(Math.max(newScale, 0.2), 2.0); // Clamp zoom

      const newMid = getMidpoint(e.touches);
      const dx = newMid.x - touchStartRef.current.x;
      const dy = newMid.y - touchStartRef.current.y;

      setMobileScale(newScale);
      setMobileOffset({
        x: lastOffsetRef.current.x + dx,
        y: lastOffsetRef.current.y + dy
      });

    } else if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;

      if (selectedElementId) {
        // --- VIRTUAL JOYSTICK MODE (Edit Element) ---
        // Move the element, NOT the canvas
        // Adjust dx/dy by scale to ensure consistent movement speed regardless of zoom
        const adjustedDx = dx / mobileScale;
        const adjustedDy = dy / mobileScale;

        setPaperSettings(prev => ({
          ...prev,
          elements: prev.elements.map(el => {
            if (el.id === selectedElementId) {
              return { ...el, x: el.x + adjustedDx, y: el.y + adjustedDy };
            }
            return el;
          })
        }));
        
        // Reset reference to avoid accumulation (Relative movement)
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0 };

      } else {
        // --- PAN MODE (Move Canvas) ---
        setMobileOffset({
          x: lastOffsetRef.current.x + dx,
          y: lastOffsetRef.current.y + dy
        });
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  const handleElementTap = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    setSelectedElementId(id);
  };

  // Nudge function for precision dock
  const nudgeElement = (dx: number, dy: number) => {
    if (!selectedElementId) return;
    setPaperSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === selectedElementId ? { ...el, x: el.x + dx, y: el.y + dy } : el)
    }));
  };

  // --- BACKUP LOGIC ---
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
    <div className="animate-fade-in pb-20 h-full" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      
      {/* ======================= MOBILE POCKET STUDIO ======================= */}
      <div className="lg:hidden flex flex-col h-full fixed inset-0 z-50 bg-gray-100 overflow-hidden">
         
         {activeTab === 'paper' ? (
           <>
             {/* Studio Header */}
             <div className="absolute top-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-4 z-20 flex justify-between items-center shadow-sm border-b border-gray-200">
                <div className="flex items-center gap-3">
                   <button onClick={() => setActiveTab('profile')} className="p-2 rounded-full hover:bg-gray-100 text-gray-600"><ArrowRight /></button>
                   <div>
                      <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1">
                         <Grid size={14} className="text-purple-600"/> 
                         استودیوی طراحی نسخه
                      </h3>
                      <p className="text-[10px] text-gray-500">
                         {selectedElementId ? 'ویرایش المان' : 'حرکت و زوم'}
                      </p>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setPaperSettings(p => ({ ...p, printBackground: !p.printBackground }))} className={`p-2 rounded-xl transition-all ${paperSettings.printBackground ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                      <FileImage size={18} />
                   </button>
                   <button onClick={handleSavePaper} className="bg-purple-600 text-white p-2 rounded-xl shadow-lg shadow-purple-200">
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                   </button>
                </div>
             </div>

             {/* Interactive Canvas Viewport */}
             <div 
               className="w-full h-full relative overflow-hidden bg-gray-200 touch-none flex items-center justify-center"
               onTouchStart={handleTouchStart}
               onTouchMove={handleTouchMove}
               onTouchEnd={handleTouchEnd}
               onClick={() => setSelectedElementId(null)} // Click empty space to deselect
             >
                {/* The Paper */}
                <div 
                   style={{
                      width: dims.w + 'px',
                      height: dims.h + 'px',
                      transform: `translate(${mobileOffset.x}px, ${mobileOffset.y}px) scale(${mobileScale})`,
                      backgroundImage: paperSettings.backgroundImage ? `url(${paperSettings.backgroundImage})` : 'none',
                      backgroundColor: 'white',
                      backgroundSize: 'cover',
                      boxShadow: '0 10px 50px -12px rgba(0, 0, 0, 0.5)',
                      transformOrigin: 'center center',
                      transition: isDragging || touchStartRef.current ? 'none' : 'transform 0.1s ease-out'
                   }}
                   className="relative"
                >
                   {!paperSettings.backgroundImage && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                         <span className="text-6xl font-black transform -rotate-45 text-gray-400">PAPER</span>
                      </div>
                   )}

                   {/* Render Elements */}
                   {paperSettings.elements.filter(el => el.visible).map(el => (
                      <div
                         key={el.id}
                         onClick={(e) => handleElementTap(e, el.id)}
                         style={{
                            position: 'absolute',
                            left: el.x + 'px',
                            top: el.y + 'px',
                            width: el.width + 'px',
                            fontSize: el.fontSize + 'pt',
                            transform: `rotate(${el.rotation}deg)`,
                            textAlign: el.align || 'right',
                            zIndex: selectedElementId === el.id ? 20 : 1,
                         }}
                         className={`select-none transition-colors duration-200 ${
                            selectedElementId === el.id 
                               ? 'ring-4 ring-blue-500 bg-blue-500/10' 
                               : 'hover:bg-black/5'
                         }`}
                      >
                         {/* Drag Handle Visual (Only when selected) */}
                         {selectedElementId === el.id && (
                            <div className="absolute -top-3 -right-3 w-6 h-6 bg-blue-500 rounded-full shadow-md flex items-center justify-center z-30">
                               <Move size={12} className="text-white" />
                            </div>
                         )}
                         {el.label}
                      </div>
                   ))}
                </div>

                {/* Floating Hint */}
                {!selectedElementId && (
                   <div className="absolute bottom-24 bg-black/60 text-white px-4 py-2 rounded-full text-xs backdrop-blur-md pointer-events-none">
                      برای انتخاب المان ضربه بزنید • برای جابجایی دو انگشت
                   </div>
                )}
             </div>

             {/* Precision Dock (Bottom Sheet) */}
             {selectedElementId && selectedEl && (
                <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] p-5 z-30 animate-slide-up">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                         <Type size={16} className="text-blue-500" />
                         {selectedEl.label}
                      </h4>
                      <button onClick={() => setSelectedElementId(null)} className="p-1 bg-gray-100 rounded-full"><X size={16} /></button>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Nudge Pad */}
                      <div className="bg-gray-50 p-2 rounded-2xl grid grid-cols-3 gap-1 aspect-square justify-items-center items-center">
                         <div/>
                         <button onTouchStart={() => nudgeElement(0, -1)} className="p-2 bg-white rounded-lg shadow-sm active:bg-blue-100"><ArrowUp size={16}/></button>
                         <div/>
                         <button onTouchStart={() => nudgeElement(-1, 0)} className="p-2 bg-white rounded-lg shadow-sm active:bg-blue-100"><ArrowLeft size={16}/></button>
                         <div className="w-2 h-2 bg-gray-300 rounded-full"/>
                         <button onTouchStart={() => nudgeElement(1, 0)} className="p-2 bg-white rounded-lg shadow-sm active:bg-blue-100"><ArrowRight size={16}/></button>
                         <div/>
                         <button onTouchStart={() => nudgeElement(0, 1)} className="p-2 bg-white rounded-lg shadow-sm active:bg-blue-100"><ArrowDown size={16}/></button>
                         <div/>
                      </div>

                      {/* Sliders */}
                      <div className="space-y-4 flex flex-col justify-center">
                         <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500"><span>چرخش</span><span>{selectedEl.rotation}°</span></div>
                            <input type="range" min="-90" max="90" value={selectedEl.rotation} onChange={e => updateSelectedElement('rotation', parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                         </div>
                         <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500"><span>سایز</span><span>{selectedEl.fontSize}pt</span></div>
                            <input type="range" min="8" max="32" value={selectedEl.fontSize} onChange={e => updateSelectedElement('fontSize', parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                         </div>
                         <div className="flex bg-gray-100 p-1 rounded-lg">
                            {['right', 'center', 'left'].map((align: any) => (
                               <button key={align} onClick={() => updateSelectedElement('align', align)} className={`flex-1 text-[10px] py-1 rounded ${selectedEl.align === align ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>
                                  {align === 'right' ? 'R' : align === 'center' ? 'C' : 'L'}
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>
                   <div className="text-center text-[10px] text-gray-400">
                      برای جابجایی دقیق، انگشت خود را در فضای خالی بکشید (تاچ‌پد)
                   </div>
                </div>
             )}

             {/* Layer List FAB */}
             {!selectedElementId && (
                <button 
                   onClick={() => setShowLayerList(true)}
                   className="absolute bottom-6 right-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 z-20"
                >
                   <Layers size={24} />
                </button>
             )}

             {/* Layer List Modal */}
             {showLayerList && (
                <div className="absolute inset-0 bg-black/50 z-40 flex justify-end" onClick={() => setShowLayerList(false)}>
                   <div className="w-64 bg-white h-full p-4 overflow-y-auto animate-slide-left" onClick={e => e.stopPropagation()}>
                      <h3 className="font-bold text-gray-800 mb-4">لایه‌ها (المان‌ها)</h3>
                      <div className="space-y-2">
                         {paperSettings.elements.map(el => (
                            <div key={el.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                               <button 
                                  onClick={() => { setSelectedElementId(el.id); setShowLayerList(false); }}
                                  className="text-sm font-bold text-gray-700 flex-1 text-right"
                               >
                                  {el.label}
                               </button>
                               <button onClick={() => updateSelectedElement('visible', !el.visible)}>
                                  {el.visible ? <CheckCircle size={16} className="text-green-500" /> : <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />}
                               </button>
                            </div>
                         ))}
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, val => setPaperSettings(p => ({ ...p, backgroundImage: val })))} />
                            <Upload className="mx-auto text-gray-400 mb-1" size={20} />
                            <span className="text-xs text-gray-500">تغییر پس‌زمینه</span>
                         </div>
                      </div>
                   </div>
                </div>
             )}
           </>
         ) : (
           /* Other Mobile Tabs (Profile/Backup) - Standard Layout */
           <div className="flex flex-col h-full">
              <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
                 <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                       <div className="bg-gray-100 p-2 rounded-xl text-gray-600"><SettingsIcon size={20} /></div>
                       <h2 className="text-lg font-bold text-gray-800">تنظیمات سیستم</h2>
                    </div>
                 </div>
                 <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('profile')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'profile' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>پروفایل</button>
                    <button onClick={() => setActiveTab('paper')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'paper' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>نسخه</button>
                    <button onClick={() => setActiveTab('backup')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'backup' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>پشتیبان</button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-32">
                 {message && <div className={`p-4 rounded-xl flex items-center gap-2 mb-4 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
                 
                 {activeTab === 'profile' && (
                    <div className="space-y-4 animate-slide-up">
                       <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><User size={16} className="text-blue-500"/> اطلاعات پزشک</h3>
                          <input className="w-full p-3 bg-gray-50 rounded-xl outline-none text-sm" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="نام پزشک..." />
                          <input className="w-full p-3 bg-gray-50 rounded-xl outline-none text-sm" value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})} placeholder="تخصص..." />
                          <input className="w-full p-3 bg-gray-50 rounded-xl outline-none text-sm" value={profile.medicalCouncilNumber} onChange={e => setProfile({...profile, medicalCouncilNumber: e.target.value})} placeholder="نظام پزشکی..." />
                       </div>
                       <button onClick={handleSaveProfile} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <Save />} ذخیره</button>
                    </div>
                 )}

                 {activeTab === 'backup' && (
                    <div className="space-y-4 animate-slide-up">
                       <div className="bg-green-50 p-6 rounded-3xl border border-green-100 text-center space-y-4">
                          <Download size={32} className="mx-auto text-green-600" />
                          <h3 className="font-bold text-green-900">پشتیبان‌گیری</h3>
                          <button onClick={handleExport} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">دانلود فایل</button>
                       </div>
                       <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 text-center space-y-4">
                          <Upload size={32} className="mx-auto text-orange-600" />
                          <h3 className="font-bold text-orange-900">بازگردانی</h3>
                          <div className="relative w-full">
                             <input type="file" accept=".json" className="absolute inset-0 opacity-0 z-10" onChange={handleImport} />
                             <button className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold">انتخاب فایل</button>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
         )}
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gray-800 p-3 rounded-2xl text-white">
             <User size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">تنظیمات و مدیریت</h2>
            <p className="text-gray-500">Settings & Control Room</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-3xl">
          <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <User size={20} /> اطلاعات مطب
          </button>
          <button onClick={() => setActiveTab('paper')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'paper' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Grid size={20} /> طراحی نسخه (سربرگ)
          </button>
          <button onClick={() => setActiveTab('backup')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'backup' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Database size={20} /> مدیریت داده‌ها
          </button>
          <button className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-50`}>
            <AlertCircle size={20} /> امنیت
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-2 mt-4 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
             {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
             {message.text}
          </div>
        )}

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px] mt-6">
          
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

          {/* PAPER SETTINGS TAB - THE VISUAL DESIGNER */}
          {activeTab === 'paper' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                     <Grid className="text-blue-600" />
                     طراحی سربرگ و چیدمان نسخه
                  </h3>
                  <div className="flex gap-2">
                     <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A4' }))} className={`px-3 py-1 rounded text-sm font-bold transition-all ${paperSettings.paperSize === 'A4' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>کاغذ A4</button>
                        <button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A5' }))} className={`px-3 py-1 rounded text-sm font-bold transition-all ${paperSettings.paperSize === 'A5' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>کاغذ A5</button>
                     </div>
                     <div className="relative">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, val => setPaperSettings(p => ({ ...p, backgroundImage: val })))} />
                        <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50">
                           <Upload size={16} /> آپلود عکس سربرگ (پس‌زمینه)
                        </button>
                     </div>
                     <button onClick={() => setPaperSettings(p => ({ ...p, backgroundImage: '' }))} className="text-red-500 text-xs px-2 hover:bg-red-50 rounded">بازنشانی</button>
                     <button onClick={handleSavePaper} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow hover:bg-emerald-700">
                        <Save size={16} /> ذخیره طرح
                     </button>
                  </div>
               </div>

               <div className="flex gap-6 h-[700px]">
                  {/* Visual Canvas Area */}
                  <div className="flex-1 bg-gray-200 rounded-2xl overflow-auto p-8 flex justify-center relative shadow-inner">
                     <div 
                       ref={canvasRef}
                       style={{ 
                          width: dims.w + 'px', 
                          height: dims.h + 'px', 
                          backgroundImage: paperSettings.backgroundImage ? `url(${paperSettings.backgroundImage})` : 'none',
                          backgroundSize: 'cover'
                       }}
                       className="bg-white shadow-2xl relative transition-all duration-300"
                     >
                        {/* Grid Lines for help */}
                        <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-10 border border-gray-300"></div>
                        
                        {!paperSettings.backgroundImage && (
                           <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">
                              <span className="text-4xl font-bold opacity-20 transform -rotate-45">محل آپلود عکس سربرگ شما</span>
                           </div>
                        )}

                        {/* Render Draggable Elements */}
                        {paperSettings.elements.filter(el => el.visible).map(el => (
                           <div
                             key={el.id}
                             onMouseDown={(e) => handleMouseDown(e, el.id)}
                             style={{
                                position: 'absolute',
                                left: el.x + 'px',
                                top: el.y + 'px',
                                width: el.width + 'px',
                                height: el.height ? el.height + 'px' : 'auto',
                                fontSize: el.fontSize + 'pt',
                                transform: `rotate(${el.rotation}deg)`,
                                cursor: isDragging ? 'grabbing' : 'grab',
                                border: selectedElementId === el.id ? '2px dashed #3b82f6' : '1px dotted #ccc',
                                backgroundColor: selectedElementId === el.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                                padding: '4px',
                                zIndex: selectedElementId === el.id ? 10 : 1,
                                textAlign: el.align || 'right'
                             }}
                             className="group hover:border-blue-400 select-none"
                           >
                              {el.label}
                              {/* Resize Handle (Simplified - just visual for now or simple manual resize via input) */}
                              {selectedElementId === el.id && (
                                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"></div>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Sidebar Controls */}
                  <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                     <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">المان‌های صفحه</h4>
                     
                     {/* Element List / Toggle */}
                     <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
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

                     {/* Editor for Selected Element */}
                     {selectedEl ? (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4 animate-fade-in">
                           <h5 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                              <Type size={14} />
                              ویرایش: {selectedEl.label}
                           </h5>
                           
                           <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                 <label className="text-xs text-gray-500">سایز (pt)</label>
                                 <input type="number" className="w-full p-2 rounded border border-gray-200 text-sm" value={selectedEl.fontSize} onChange={e => updateSelectedElement('fontSize', parseInt(e.target.value))} />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-xs text-gray-500">عرض (mm)</label>
                                 <input type="number" className="w-full p-2 rounded border border-gray-200 text-sm" value={selectedEl.width} onChange={e => updateSelectedElement('width', parseInt(e.target.value))} />
                              </div>
                           </div>

                           <div className="space-y-1">
                              <label className="text-xs text-gray-500 flex items-center gap-1"><RotateCw size={10} /> چرخش (درجه)</label>
                              <input type="range" min="-90" max="90" className="w-full" value={selectedEl.rotation} onChange={e => updateSelectedElement('rotation', parseInt(e.target.value))} />
                              <div className="text-center text-xs font-bold text-blue-600">{selectedEl.rotation}°</div>
                           </div>

                           <div className="flex justify-between bg-white p-2 rounded border border-gray-200">
                              <button onClick={() => updateSelectedElement('align', 'right')} className={`p-1 rounded ${selectedEl.align === 'right' ? 'bg-gray-200' : ''}`}>R</button>
                              <button onClick={() => updateSelectedElement('align', 'center')} className={`p-1 rounded ${selectedEl.align === 'center' ? 'bg-gray-200' : ''}`}>C</button>
                              <button onClick={() => updateSelectedElement('align', 'left')} className={`p-1 rounded ${selectedEl.align === 'left' ? 'bg-gray-200' : ''}`}>L</button>
                           </div>
                        </div>
                     ) : (
                        <p className="text-sm text-gray-400 text-center py-4">یک المان را انتخاب کنید</p>
                     )}

                     {/* Background Print Toggle */}
                     <div className="mt-6 pt-6 border-t border-gray-200">
                        <label className="flex items-start gap-3 cursor-pointer">
                           <div className="relative flex items-center">
                              <input type="checkbox" className="sr-only peer" checked={paperSettings.printBackground} onChange={e => setPaperSettings(p => ({ ...p, printBackground: e.target.checked }))} />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                           </div>
                           <div>
                              <span className="text-sm font-bold text-gray-700 block">چاپ عکس سربرگ</span>
                              <span className="text-xs text-gray-500 block">اگر تیک داشته باشد، عکس پس‌زمینه هم چاپ می‌شود (برای کاغذ سفید).</span>
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
               <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">پشتیبان‌گیری و امنیت داده‌ها</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-green-50 p-8 rounded-3xl border border-green-100 flex flex-col items-center">
                     <div className="w-16 h-16 bg-green-200 text-green-700 rounded-full flex items-center justify-center mb-4">
                        <Download size={32} />
                     </div>
                     <h4 className="font-bold text-green-900 text-lg mb-2">خروجی گرفتن (Export)</h4>
                     <p className="text-gray-600 text-sm mb-6">تمام اطلاعات بیماران، نسخه‌ها و تنظیمات را در یک فایل امن دانلود کنید.</p>
                     <button onClick={handleExport} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                        دانلود فایل پشتیبان
                     </button>
                  </div>
                  <div className="bg-orange-50 p-8 rounded-3xl border border-orange-100 flex flex-col items-center">
                     <div className="w-16 h-16 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center mb-4">
                        <Upload size={32} />
                     </div>
                     <h4 className="font-bold text-orange-900 text-lg mb-2">بازگردانی (Import)</h4>
                     <p className="text-gray-600 text-sm mb-6">فایل پشتیبان را آپلود کنید تا اطلاعات قبلی بازگردانی شود.</p>
                     <div className="relative w-full">
                        <button className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg flex items-center justify-center gap-2">
                           {loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                           آپلود فایل پشتیبان
                        </button>
                        <input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} disabled={loading} />
                     </div>
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
