
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { recommendBooks, analyzeBookContent, askBookQuestion } from '../services/geminiService';
import { Book } from '../types';
import { Search, Download, BookOpen, Loader, CheckCircle, Upload, FileText, MessageSquare, X, Send, Trash, Sparkles, Link2, ArrowLeft, Mic, MicOff, ShoppingCart, Globe, Plus } from 'lucide-react';

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

export const Library: React.FC = () => {
  const { library, addToLibrary, downloadBook, deleteBook } = useStore();
  
  const [activeTab, setActiveTab] = useState<'SHELF' | 'CONSULTANT'>('SHELF');
  const [shelfSearch, setShelfSearch] = useState('');

  // Consultant State
  const [consultantQuery, setConsultantQuery] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [recommendations, setRecommendations] = useState<Partial<Book>[]>([]);
  const consultantInputRef = useRef<HTMLTextAreaElement>(null);

  // Download State
  const [isDownloading, setIsDownloading] = useState<string | null>(null); // ID of book being analyzed

  // Manual Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'FILE' | 'TEXT'>('FILE');
  const [manualBook, setManualBook] = useState({ title: '', author: '', content: '', category: '' });
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [chatBook, setChatBook] = useState<Book | null>(null);
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);

  // Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
  const activeFieldRef = useRef<'consultant' | 'chat' | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize logic for consultant textarea
  useEffect(() => {
    if (consultantInputRef.current) {
      consultantInputRef.current.style.height = 'auto';
      consultantInputRef.current.style.height = consultantInputRef.current.scrollHeight + 'px';
    }
  }, [consultantQuery, activeTab]);

  // --- Voice Logic ---
  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("مرورگر شما از تایپ صوتی پشتیبانی نمی‌کند."); return; }
    
    const recognition = new SpeechRecognition();
    recognition.lang = dictationLang;
    recognition.continuous = true;
    recognition.interimResults = false;
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      const transcript = finalTranscript.trim();
      if (!transcript) return;

      if (activeFieldRef.current === 'consultant') {
          setConsultantQuery(prev => prev + (prev ? ' ' : '') + transcript);
      } else if (activeFieldRef.current === 'chat') {
          setChatQuery(prev => prev + (prev ? ' ' : '') + transcript);
      }
    };

    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  };

  // --- Consultant Functions ---
  const handleConsult = async () => {
    if (!consultantQuery) return;
    setIsConsulting(true);
    const results = await recommendBooks(consultantQuery);
    setRecommendations(results);
    setIsConsulting(false);
  };

  const handleAddRecommendation = (book: Partial<Book>) => {
    // Add as a placeholder
    addToLibrary({
      title: book.title!,
      author: book.author!,
      summary: book.summary!,
      category: book.category!,
      contentSnippets: [],
      fileType: 'WEB',
      content: undefined,
      sourceUrl: book.sourceUrl,
      isPlaceholder: true,
      accessType: book.accessType
    });
    alert("کتاب به قفسه شما اضافه شد. اکنون می‌توانید فایل آن را (پس از دانلود) آپلود کنید.");
    setActiveTab('SHELF');
  };

  // --- Download/Analyze Function ---
  const handleFetchContent = async (book: Book) => {
    setIsDownloading(book.id);
    try {
      const content = await analyzeBookContent(book.title);
      downloadBook(book.id, content);
      alert("تحلیل و خلاصه‌سازی کتاب با موفقیت انجام شد. اکنون قابل استفاده در تشخیص است.");
    } catch (e) {
      alert("خطا در دریافت محتوا.");
    } finally {
      setIsDownloading(null);
    }
  };

  // --- Manual Upload Functions ---
  const extractTextFromPDF = async (file: File): Promise<string> => {
    if (!window.pdfjsLib) {
        throw new Error("PDF Library not loaded");
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
        } catch (err) {
            console.warn(`Error reading page ${i}`, err);
        }
    }
    
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
        setIsProcessingPdf(true);
        try {
            const text = await extractTextFromPDF(file);
            if (!text || text.length < 50) {
                alert("متن قابل استخراجی در این PDF یافت نشد (شاید فایل اسکن شده باشد).");
                return;
            }
            setManualBook({ 
                ...manualBook, 
                title: file.name.replace(/\.pdf$/i, ""), 
                content: text,
                author: 'PDF Upload'
            });
        } catch (error) {
            console.error(error);
            alert("خطا در خواندن فایل PDF. لطفاً از فایل استاندارد استفاده کنید.");
        } finally {
            setIsProcessingPdf(false);
        }
    } else {
        // Text/Markdown
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setManualBook({ ...manualBook, title: file.name.replace(/\.[^/.]+$/, ""), content: text });
        };
        reader.readAsText(file);
    }
  };

  const saveManualBook = () => {
    if (!manualBook.title || !manualBook.content) {
        alert("لطفا عنوان و محتوای کتاب را وارد کنید.");
        return;
    }
    // Check local storage limits roughly
    if (manualBook.content.length > 5000000) {
        if(!confirm("حجم این کتاب بسیار زیاد است و ممکن است باعث کندی برنامه شود. آیا ادامه می‌دهید؟")) return;
    }

    addToLibrary({
        title: manualBook.title,
        author: manualBook.author || "کاربر",
        summary: "آپلود شده توسط پزشک",
        category: manualBook.category || "عمومی",
        contentSnippets: [],
        content: manualBook.content,
        fileType: uploadType === 'FILE' ? (manualBook.title.includes('PDF') ? 'PDF' : 'TXT') : 'MANUAL',
        isPlaceholder: false,
        accessType: 'FREE' // Assumed since user uploaded it
    });
    setShowUploadModal(false);
    setManualBook({ title: '', author: '', content: '', category: '' });
    alert("سند با موفقیت به پایگاه دانش اضافه شد.");
  };

  // --- Chat Functions ---
  const openChat = (book: Book) => {
    setChatBook(book);
    setChatHistory([]);
    setChatQuery('');
  };

  const handleSendChat = async () => {
    if (!chatQuery || !chatBook) return;
    const userMsg = chatQuery;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatQuery('');
    setIsChatting(true);

    const aiMsg = await askBookQuestion(chatBook, userMsg);
    
    setChatHistory(prev => [...prev, { role: 'ai', text: aiMsg }]);
    setIsChatting(false);
  };

  // Filter Library
  const filteredLibrary = library.filter(book => 
    book.title.toLowerCase().includes(shelfSearch.toLowerCase()) || 
    book.author.toLowerCase().includes(shelfSearch.toLowerCase()) ||
    (book.content && book.content.toLowerCase().includes(shelfSearch.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
             <h2 className="text-2xl font-bold text-gray-800">کتابخانه هوشمند پزشکی</h2>
             <p className="text-gray-600 text-lg leading-relaxed">
                مدیریت منابع، مشاوره برای یافتن بهترین رفرنس‌ها و پایگاه دانش شخصی.
             </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('SHELF')}
            className={`pb-4 px-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'SHELF' ? 'border-medical-600 text-medical-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              قفسه من (پایگاه دانش)
          </button>
          <button 
            onClick={() => setActiveTab('CONSULTANT')}
            className={`pb-4 px-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'CONSULTANT' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2">
                  <Sparkles size={18} />
                  مشاور هوشمند (پیشنهاد کتاب)
              </span>
          </button>
      </div>

      {/* === TAB: SHELF === */}
      {activeTab === 'SHELF' && (
        <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                {/* Search Bar */}
                <div className="relative w-full md:w-1/2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text"
                        placeholder="جستجو در عنوان، نویسنده یا متن کتاب..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-medical-500 focus:ring-2 focus:ring-medical-200 outline-none transition-all"
                        value={shelfSearch}
                        onChange={(e) => setShelfSearch(e.target.value)}
                    />
                </div>
                
                <button 
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-md font-bold w-full md:w-auto justify-center"
                >
                    <Upload size={20} />
                    آپلود کتاب (PDF/TXT)
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredLibrary.map((book) => (
                <div key={book.id} className="bg-white p-5 rounded-xl border border-slate-200 relative hover:shadow-lg transition-all group flex flex-col justify-between h-full">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-lg border shadow-sm ${book.content ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                <FileText size={24} className={book.content ? 'text-green-600' : 'text-gray-400'} />
                            </div>
                            <button onClick={() => {if(confirm('حذف شود؟')) deleteBook(book.id)}} className="text-gray-300 hover:text-red-500 transition-colors"><Trash size={16} /></button>
                        </div>
                        <h4 className="font-bold text-gray-900 text-lg mb-1 ltr text-right line-clamp-2 h-14">{book.title}</h4>
                        <p className="text-xs text-gray-500 mb-3">{book.author}</p>
                        
                        {/* Status Badge */}
                        <div className="mb-3">
                            {book.content ? (
                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                                    <CheckCircle size={12} />
                                    آماده استفاده (RAG)
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                                    <Loader size={12} />
                                    منتظر محتوا
                                </span>
                            )}
                        </div>

                        {book.sourceUrl && (
                             <a href={book.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mb-4">
                                 <Link2 size={12} />
                                 {book.accessType === 'PAID' ? 'لینک خرید/ناشر' : 'لینک دانلود'}
                             </a>
                        )}
                    </div>
                    
                    <div className="mt-4 flex flex-col gap-2">
                        {book.content ? (
                            <button 
                                onClick={() => openChat(book)}
                                className="w-full bg-medical-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-medical-700 transition-colors flex items-center justify-center gap-2 shadow-medical-500/20 shadow-lg"
                            >
                                <MessageSquare size={16} />
                                گفتگو / مطالعه
                            </button>
                        ) : (
                            // If placeholder, allow adding content (from user file)
                            <button 
                                onClick={() => setShowUploadModal(true)}
                                className="w-full bg-amber-50 text-amber-700 border border-amber-200 py-2 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Upload size={16} />
                                آپلود فایل PDF
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {library.length === 0 && (
                <div className="col-span-full text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">کتابخانه‌ای یافت نشد.</p>
                    <button onClick={() => setActiveTab('CONSULTANT')} className="text-medical-600 font-bold mt-2 hover:underline">از مشاور هوشمند کمک بگیرید</button>
                </div>
            )}
            {library.length > 0 && filteredLibrary.length === 0 && (
                <div className="col-span-full text-center py-10">
                    <p className="text-gray-500">کتابی با این مشخصات یافت نشد.</p>
                </div>
            )}
            </div>
        </div>
      )}

      {/* === TAB: CONSULTANT === */}
      {activeTab === 'CONSULTANT' && (
          <div className="animate-fadeIn max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-purple-50 to-white p-8 rounded-2xl border border-purple-100 shadow-sm mb-8">
                  <div className="flex items-center gap-4 mb-6">
                      <div className="bg-purple-100 p-3 rounded-full">
                          <Sparkles size={32} className="text-purple-600" />
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-gray-800">مشاور هوشمند (شکارچی منابع)</h3>
                          <p className="text-gray-600">من وب را جستجو می‌کنم و لینک‌های دانلود رایگان (PDF) یا لینک‌های معتبر خرید را پیدا می‌کنم.</p>
                      </div>
                  </div>
                  
                  <div className="flex gap-2 items-start">
                      <div className="relative flex-1">
                        <textarea 
                            ref={consultantInputRef}
                            value={consultantQuery}
                            onChange={(e) => setConsultantQuery(e.target.value)}
                            onFocus={() => activeFieldRef.current = 'consultant'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleConsult();
                                }
                            }}
                            placeholder="مثال: دانلود کتاب نلسون ۲۰۲۴، راهنمای درمان دیابت..."
                            className="w-full p-4 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 outline-none text-lg resize-none overflow-hidden min-h-[60px]"
                            rows={1}
                        />
                      </div>

                      {/* Voice Controls */}
                      <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-purple-100 shadow-sm h-[60px]">
                         <button 
                            onClick={() => setDictationLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR')}
                            className="px-2 py-2 rounded-lg hover:bg-purple-50 text-xs font-bold text-purple-700 transition-colors"
                         >
                            {dictationLang === 'fa-IR' ? 'FA' : 'EN'}
                         </button>
                         <button 
                            onClick={toggleRecording}
                            className={`p-2 rounded-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-purple-400 hover:bg-purple-50 hover:text-purple-600'}`}
                         >
                            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                         </button>
                      </div>

                      <button 
                        onClick={handleConsult}
                        disabled={isConsulting || !consultantQuery}
                        className="bg-purple-600 text-white px-6 h-[60px] rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2"
                      >
                          {isConsulting ? <Loader className="animate-spin" /> : <Search />}
                      </button>
                  </div>
              </div>

              <div className="space-y-6">
                  {recommendations.map((book, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6 animate-slideUp">
                          <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                  {book.accessType === 'FREE' ? (
                                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">رایگان (PDF)</span>
                                  ) : (
                                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full">پولی / تجاری</span>
                                  )}
                              </div>
                              <h4 className="text-xl font-bold text-gray-800 ltr text-right font-serif mb-1">{book.title}</h4>
                              <p className="text-purple-600 font-medium mb-3">{book.author} • {book.category}</p>
                              <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">{book.summary}</p>
                          </div>
                          <div className="flex flex-col justify-center min-w-[200px] gap-3">
                              {book.sourceUrl && (
                                  <a 
                                    href={book.sourceUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className={`w-full py-3 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-white ${book.accessType === 'FREE' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                  >
                                      {book.accessType === 'FREE' ? <Download size={18} /> : <ShoppingCart size={18} />}
                                      {book.accessType === 'FREE' ? 'دانلود مستقیم فایل' : 'خرید / مشاهده در ناشر'}
                                  </a>
                              )}
                              
                              <button 
                                onClick={() => handleAddRecommendation(book)}
                                className="w-full py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                              >
                                  <Plus size={18} />
                                  افزودن به قفسه (جهت آپلود)
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl relative animate-fadeIn">
                  <button onClick={() => setShowUploadModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
                  <h3 className="text-xl font-bold mb-6 text-gray-800">افزودن سند به پایگاه دانش</h3>
                  
                  <div className="flex gap-4 mb-6">
                      <button onClick={() => setUploadType('FILE')} className={`flex-1 py-3 rounded-xl border font-bold transition-colors ${uploadType === 'FILE' ? 'bg-medical-50 border-medical-500 text-medical-700' : 'border-gray-200 text-gray-500'}`}>آپلود فایل (PDF, TXT)</button>
                      <button onClick={() => setUploadType('TEXT')} className={`flex-1 py-3 rounded-xl border font-bold transition-colors ${uploadType === 'TEXT' ? 'bg-medical-50 border-medical-500 text-medical-700' : 'border-gray-200 text-gray-500'}`}>وارد کردن متن دستی</button>
                  </div>

                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">عنوان سند</label>
                            <input type="text" className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-medical-500" value={manualBook.title} onChange={e => setManualBook({...manualBook, title: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">نویسنده / منبع</label>
                            <input type="text" className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-medical-500" value={manualBook.author} onChange={e => setManualBook({...manualBook, author: e.target.value})} />
                        </div>
                      </div>

                      {uploadType === 'FILE' ? (
                          <div onClick={() => !isProcessingPdf && fileInputRef.current?.click()} className={`border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 hover:border-medical-400 transition-all ${isProcessingPdf ? 'opacity-50 cursor-wait' : ''}`}>
                              <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.pdf" className="hidden" onChange={handleFileUpload} />
                              {isProcessingPdf ? (
                                  <div className="flex flex-col items-center">
                                      <Loader size={32} className="text-medical-600 animate-spin mb-2"/>
                                      <p className="font-bold text-medical-600">در حال استخراج متن از PDF...</p>
                                  </div>
                              ) : (
                                  <>
                                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                                    <p className="font-bold text-gray-600">برای انتخاب فایل کلیک کنید</p>
                                    <p className="text-xs text-gray-400 mt-1">{manualBook.content ? 'فایل انتخاب شد ✅' : 'فرمت‌های پشتیبانی شده: PDF, TXT, Markdown'}</p>
                                  </>
                              )}
                          </div>
                      ) : (
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">متن سند</label>
                              <textarea 
                                className="w-full h-40 p-3 border border-gray-300 rounded-xl outline-none focus:border-medical-500 resize-none custom-scrollbar" 
                                placeholder="متن مقاله یا محتوای کپی شده را اینجا وارد کنید..."
                                value={manualBook.content}
                                onChange={e => setManualBook({...manualBook, content: e.target.value})}
                              ></textarea>
                          </div>
                      )}

                      <button onClick={saveManualBook} disabled={!manualBook.content || isProcessingPdf} className="w-full py-3 bg-medical-600 text-white rounded-xl font-bold hover:bg-medical-700 transition-colors shadow-lg disabled:opacity-50">
                          ذخیره در پایگاه دانش
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Chat Modal */}
      {chatBook && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-3xl h-[80vh] shadow-2xl relative flex flex-col overflow-hidden animate-fadeIn">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                              <MessageSquare size={20} className="text-medical-600"/>
                              گفتگو با سند: {chatBook.title}
                          </h3>
                      </div>
                      <button onClick={() => setChatBook(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 custom-scrollbar">
                      {chatHistory.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-white border border-gray-200 text-gray-800 rounded-tr-none' : 'bg-medical-600 text-white rounded-tl-none'}`}>
                                  <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                              </div>
                          </div>
                      ))}
                      {isChatting && (
                          <div className="flex justify-end">
                              <div className="bg-medical-600 text-white p-3 rounded-xl rounded-tl-none opacity-70">
                                  <Loader size={16} className="animate-spin" />
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t bg-white">
                      <div className="flex gap-2 items-center">
                          {/* Voice Controls */}
                          <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                                <button 
                                    onClick={() => setDictationLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR')}
                                    className="px-2 py-2 rounded-lg hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors"
                                >
                                    {dictationLang === 'fa-IR' ? 'FA' : 'EN'}
                                </button>
                                <button 
                                    onClick={toggleRecording}
                                    className={`p-2 rounded-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                                >
                                    {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                                </button>
                          </div>

                          <input 
                            type="text" 
                            className="flex-1 p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-medical-500"
                            placeholder="سوال خود را بپرسید..."
                            value={chatQuery}
                            onFocus={() => activeFieldRef.current = 'chat'}
                            onChange={e => setChatQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                          />
                          <button onClick={handleSendChat} disabled={!chatQuery || isChatting} className="bg-medical-600 text-white p-3 rounded-xl hover:bg-medical-700 disabled:opacity-50 transition-colors">
                              <Send size={20} />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
