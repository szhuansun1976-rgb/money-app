
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Home, Plus, PieChart, Settings, Trash2, 
  Mic, Image as ImageIcon, PenTool, Check, Loader2, X,
  ArrowLeft, Tag, Info, Share, Download, Upload, ShieldCheck, FileJson, Search,
  ChevronLeft, ChevronRight, Save
} from 'lucide-react';
import { format, parseISO, isSameMonth, subMonths, addMonths } from 'date-fns';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

// --- 1. CONSTANTS ---

const APP_NAME = "ZenLedger";
const STORAGE_KEY = "zenledger_data";
const CATEGORY_STORAGE_KEY = "zenledger_categories";
const DRAFT_KEY = "zenledger_draft_entry"; // New key for draft
const CURRENCY_SYMBOL = "¥";

const COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
  '#8b5cf6', '#ef4444', '#64748b', '#14b8a6', '#f97316',
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: '1', name: '餐饮', type: 'expense', color: COLORS[0] },
  { id: '2', name: '交通', type: 'expense', color: COLORS[1] },
  { id: '3', name: '居住', type: 'expense', color: COLORS[2] },
  { id: '4', name: '水电', type: 'expense', color: COLORS[3] },
  { id: '5', name: '娱乐', type: 'expense', color: COLORS[4] },
  { id: '6', name: '医疗', type: 'expense', color: COLORS[5] },
  { id: '7', name: '购物', type: 'expense', color: COLORS[6] },
  { id: '8', name: '其他', type: 'expense', color: COLORS[7] },
];

const INCOME_CATEGORIES = ['工资', '兼职', '礼金', '理财', '其他'];

// --- 2. TYPES ---

type EntryType = 'expense' | 'income' | 'note';

interface MediaAttachment {
  id: string;
  type: 'image' | 'audio' | 'drawing';
  data: string;
}

interface Entry {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  tags: string[];
  content: string;
  date: string;
  media: MediaAttachment[];
}

interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
}

// --- 3. SERVICES (Storage Logic) ---

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

const getEntries = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load entries", e);
    return [];
  }
};

const getEntry = (id: string) => {
  const entries = getEntries();
  return entries.find((e: Entry) => e.id === id);
};

const saveEntry = (entry: Entry) => {
  try {
    const entries = getEntries();
    const existingIndex = entries.findIndex((e: Entry) => e.id === entry.id);
    let newEntries;
    if (existingIndex > -1) {
        entries[existingIndex] = entry;
        newEntries = entries;
    } else {
        newEntries = [entry, ...entries];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    window.dispatchEvent(new Event('zenledger-update'));
  } catch (e) {
    alert("Failed to save entry. Storage might be full.");
  }
};

const updateEntry = (updatedEntry: Entry) => {
  try {
    const entries = getEntries();
    const index = entries.findIndex((e: Entry) => e.id === updatedEntry.id);
    if (index !== -1) {
      entries[index] = updatedEntry;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      window.dispatchEvent(new Event('zenledger-update'));
    }
  } catch (e) {
    alert("保存失败");
  }
};

const deleteEntry = (id: string) => {
  if (!id) return;
  const entries = getEntries();
  const index = entries.findIndex((e: Entry) => e.id === id);
  if (index !== -1) {
    entries.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event('zenledger-update'));
  }
};

const getCategories = () => {
  try {
    const data = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
    return DEFAULT_EXPENSE_CATEGORIES;
  } catch (e) {
    return DEFAULT_EXPENSE_CATEGORIES;
  }
};

const saveCategory = (category: Category) => {
  const categories = getCategories();
  const newCategories = [...categories, category];
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(newCategories));
  window.dispatchEvent(new Event('zenledger-categories-update'));
};

const deleteCategory = (id: string) => {
  const categories = getCategories();
  if (categories.length <= 1) return;
  const newCategories = categories.filter((c: Category) => c.id !== id);
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(newCategories));
  window.dispatchEvent(new Event('zenledger-categories-update'));
};

const exportData = () => {
  const data = {
    entries: getEntries(),
    categories: getCategories(),
    exportedAt: new Date().toISOString(),
    appName: "ZenLedger",
    version: 1
  };
  return JSON.stringify(data, null, 2);
};

const importData = (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.entries) || !Array.isArray(data.categories)) {
      console.error("Invalid backup file format");
      return false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.entries));
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(data.categories));
    window.dispatchEvent(new Event('zenledger-update'));
    window.dispatchEvent(new Event('zenledger-categories-update'));
    return true;
  } catch (e) {
    return false;
  }
};

// --- 4. COMPONENTS ---

const DrawingCanvas = ({ onSave }: { onSave: (data: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  }, []);

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasContent) setHasContent(true);
  };

  const stopDrawing = () => {
    if (isDrawing && hasContent && canvasRef.current) {
        onSave(canvasRef.current.toDataURL('image/png'));
    }
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasContent(false);
      onSave('');
    }
  };

  return (
    <div className="relative w-full border border-slate-200 rounded-xl bg-white overflow-hidden touch-none">
      <canvas
        ref={canvasRef}
        className="w-full h-[200px] bg-slate-50 cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {hasContent && (
        <button 
          onClick={clear}
          className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-red-500 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className="absolute bottom-2 left-2 text-xs text-slate-400 pointer-events-none">
        Draw your note here
      </div>
    </div>
  );
};

// --- 5. PAGES ---

const AddEntryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString());
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [showDrawing, setShowDrawing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEntry, setIsLoadingEntry] = useState(!!id);
  const [draftSaved, setDraftSaved] = useState(false);

  const mediaRecorderRef = useRef<any>(null);
  const chunksRef = useRef<any[]>([]);
  const activeStreamRef = useRef<any>(null);

  // --- Initialization ---
  useEffect(() => {
    const loadData = () => {
      try {
        const cats = getCategories() || [];
        setExpenseCategories(cats);
        
        if (id) {
          // EDIT MODE: Load entry
          const existingEntry = getEntry(id);
          if (existingEntry) {
            setType(existingEntry.type);
            setAmount(existingEntry.amount > 0 ? existingEntry.amount.toString() : '');
            setContent(existingEntry.content);
            setCategory(existingEntry.category);
            setMedia(existingEntry.media || []);
            setEntryDate(existingEntry.date);
          } else {
            navigate('/');
          }
        } else {
          // NEW ENTRY MODE: Check for draft
          const draft = localStorage.getItem(DRAFT_KEY);
          if (draft) {
            try {
              const d = JSON.parse(draft);
              if (d.type) setType(d.type);
              if (d.amount) setAmount(d.amount);
              if (d.content) setContent(d.content);
              if (d.category) setCategory(d.category);
              if (d.media) setMedia(d.media);
            } catch(e) {
              console.error("Failed to load draft");
            }
          }
        }
      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setIsLoadingEntry(false);
      }
    };
    loadData();
  }, [id, navigate]);

  // --- Default Category Logic ---
  useEffect(() => {
    if (isLoadingEntry) return;
    // Only set default if category is empty
    if (category) return;

    if (type === 'expense') {
      if (expenseCategories.length > 0) {
        setCategory(expenseCategories[0].name);
      } else {
        setCategory('其他');
      }
    } else if (type === 'income') {
        setCategory(INCOME_CATEGORIES[0]);
    } else {
      setCategory('笔记');
    }
  }, [type, expenseCategories, isLoadingEntry, category]);

  // --- Auto Save Draft Logic ---
  useEffect(() => {
    if (id) return; // Don't draft existing entries
    if (isLoadingEntry) return;

    const timer = setTimeout(() => {
      // Only save if there is some data
      if (amount || content || media.length > 0) {
        const draft = { type, amount, content, category, media };
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            setDraftSaved(true);
            setTimeout(() => setDraftSaved(false), 2000);
        } catch (e) {
            // Ignore quota errors
        }
      }
    }, 1500); // Save after 1.5s of inactivity

    return () => clearTimeout(timer);
  }, [type, amount, content, category, media, id, isLoadingEntry]);

  // --- Actions ---

  const handleSave = () => {
    if (isSaving) return;
    if (type !== 'note' && !amount) return;
    let numericAmount = 0;
    if (type !== 'note') {
      numericAmount = Number(amount);
      if (Number.isNaN(numericAmount)) {
        alert('请输入有效金额');
        return;
      }
    }

    setIsSaving(true);
    try {
      const entryData: Entry = {
        id: id || generateId(),
        type,
        amount: type === 'note' ? 0 : numericAmount,
        category: type === 'note' ? '笔记' : category || (type === 'income' ? INCOME_CATEGORIES[0] : (expenseCategories[0]?.name ?? '其他')),
        tags: [],
        content,
        date: entryDate,
        media
      };

      if (id) updateEntry(entryData);
      else {
          saveEntry(entryData);
          localStorage.removeItem(DRAFT_KEY); // Clear draft on success
      }
      navigate('/');
    } catch (err) {
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    if (confirm('确定要删除这条记录吗？此操作无法撤销。')) {
      deleteEntry(id);
      navigate('/');
    }
  };

  const handleImageUpload = (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: any) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedia(prev => [...prev, { id: generateId(), type: 'image', data: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setMedia(prev => [...prev, { id: generateId(), type: 'audio', data: reader.result as string }]);
        };
        reader.readAsDataURL(blob);
        
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach((t: any) => t.stop());
          activeStreamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('无法访问麦克风，请检查权限。');
      setIsRecording(false);
    }
  };

  const removeMedia = (id: string) => {
    setMedia(prev => prev.filter(m => m.id !== id));
  };

  const typeLabels: any = { expense: '支出', income: '收入', note: '笔记' };

  if (isLoadingEntry) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <div 
        className="px-6 pb-6 flex justify-between items-center bg-white sticky top-0 z-20 transition-all"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top) + 10px)' }}
      >
        <div className="flex items-center gap-2">
             <h1 className="text-2xl font-bold text-slate-800">{id ? '编辑' : '记一笔'}</h1>
             {!id && draftSaved && <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1"><Check size={10}/> 已自动保存</span>}
        </div>
        <div className="flex items-center gap-2">
            {id && (
                <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 p-2 bg-slate-50 rounded-full transition-colors"><Trash2 size={20} /></button>
            )}
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 p-2"><X size={24} /></button>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['expense', 'income', 'note'].map((t) => (
            <button
              key={t}
              onClick={() => setType(t as EntryType)}
              className={`flex-1 py-3 text-sm font-medium rounded-lg capitalize transition-all ${type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {typeLabels[t]}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {type !== 'note' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">金额</label>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">¥</span>
                 <input
                   type="number"
                   inputMode="decimal"
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-3xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                   placeholder="0.00"
                 />
               </div>
            </div>
          )}

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {type === 'note' ? '笔记内容' : '备注'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl p-4 text-lg text-slate-700 min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
              placeholder={type === 'note' ? "写下你的想法或粘贴文本..." : "这是什么消费？(例如：团队午餐)"}
            />
          </div>

          {type !== 'note' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">分类</label>
                {type === 'expense' && (
                    <button onClick={() => navigate('/settings')} className="text-xs text-indigo-600 font-medium flex items-center hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                        <Plus size={12} className="mr-1"/> 编辑
                    </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {type === 'expense' ? (
                   expenseCategories.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setCategory(c.name)}
                        className={`px-4 py-2 rounded-full text-xs font-medium border transition-all active:scale-95 ${category === c.name ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                    >
                        {c.name}
                    </button>
                   ))
                ) : (
                    INCOME_CATEGORIES.map(c => (
                        <button
                          key={c}
                          onClick={() => setCategory(c)}
                          className={`px-4 py-2 rounded-full text-xs font-medium border transition-all active:scale-95 ${category === c ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                        >
                          {c}
                        </button>
                      ))
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 py-2 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-150">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
              <ImageIcon size={20} />
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} multiple />
            </button>
            <button onClick={toggleRecording} className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
              <Mic size={20} />
            </button>
            <button onClick={() => setShowDrawing(!showDrawing)} className={`p-3 rounded-full transition-colors ${showDrawing ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
              <PenTool size={20} />
            </button>
          </div>

          {showDrawing && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <DrawingCanvas onSave={(data) => {
                    if (data) setMedia(prev => [...prev, { id: generateId(), type: 'drawing', data }]);
                    setShowDrawing(false);
                }} />
            </div>
          )}

          {media.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
                {media.map(m => (
                    <div key={m.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        {m.type === 'image' || m.type === 'drawing' ? (
                            <img src={m.data} alt="attachment" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <Mic size={24} />
                                <span className="text-[10px] mt-1">语音</span>
                            </div>
                        )}
                        <button onClick={() => removeMedia(m.id)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-100 transition-opacity"><X size={12} /></button>
                    </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed left-0 right-0 px-6 pointer-events-none z-[60] flex justify-center" style={{ bottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)' }}>
        <div className="w-full max-w-md pointer-events-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || (type !== 'note' && !amount)}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex justify-center items-center transition-all transform active:scale-95 ${
                (isSaving || (type !== 'note' && !amount)) 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-300/50'
            }`}
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Check className="mr-2" strokeWidth={3} size={20} />}
            <span>{id ? '更新' : '保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const EntryCard = ({ entry }: { entry: Entry }) => {
  const navigate = useNavigate();
  const isExpense = entry.type === 'expense';
  const isIncome = entry.type === 'income';
  
  return (
    <button 
      onClick={() => navigate(`/edit/${entry.id}`)}
      className="w-full text-left bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2 hover:bg-slate-50 transition-colors active:scale-[0.99]"
    >
      <div className="flex justify-between items-start w-full">
        <div className="flex gap-3 items-center">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
               isExpense ? 'bg-orange-100 text-orange-600' : 
               isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
           }`}>
              {isExpense ? '💸' : isIncome ? '💰' : '📝'}
           </div>
           <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 line-clamp-1">{entry.category}</h3>
              <p className="text-xs text-slate-400">{format(parseISO(entry.date), 'MM月dd日 HH:mm')}</p>
           </div>
        </div>
        {entry.type !== 'note' && (
             <span className={`font-bold whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>
                {isExpense && '-'}{CURRENCY_SYMBOL}{entry.amount.toLocaleString()}
             </span>
        )}
      </div>
      
      {entry.content && (
        <p className="text-sm text-slate-500 line-clamp-2 pl-12 text-left">{entry.content}</p>
      )}
    </button>
  );
};

const HomePage = ({ entries }: { entries: Entry[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<EntryType | 'all'>('all');

  const filteredEntries = useMemo(() => {
    return entries
      .filter(entry => {
        const matchesSearch = entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              entry.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || entry.type === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, searchTerm, filterType]);

  const summary = useMemo(() => {
      if (filterType === 'income') {
          const total = entries.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
          return { label: '总收入', amount: total, color: 'text-emerald-600' };
      }
      // Default to showing expenses for 'all', 'expense', 'note'
      const total = entries.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
      return { label: '总支出', amount: total, color: 'text-slate-900' };
  }, [entries, filterType]);

  const filterLabels: any = { all: '全部', expense: '支出', income: '收入', note: '笔记' };

  return (
    <div className="min-h-full bg-slate-50">
      <div 
        className="bg-white px-6 pb-4 rounded-b-3xl shadow-sm sticky top-0 z-20 transition-all"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{summary.label}</h2>
            <h1 className={`text-3xl font-bold ${summary.color}`}>{CURRENCY_SYMBOL}{summary.amount.toLocaleString()}</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">ZS</div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="搜索交易和笔记..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 border-none rounded-xl py-3 pl-10 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        
        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
            {['all', 'expense', 'income', 'note'].map(f => (
                <button
                    key={f}
                    onClick={() => setFilterType(f as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                        filterType === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                    {filterLabels[f]}
                </button>
            ))}
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-20 text-slate-400"><p className="text-sm">暂无记录。</p></div>
        ) : (
          filteredEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
};

const StatsPage = ({ entries }: { entries: Entry[] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  // Filter entries by Month and Type
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
        const entryDate = parseISO(e.date);
        const matchesMonth = isSameMonth(entryDate, currentMonth);
        const matchesType = e.type === activeTab;
        return matchesMonth && matchesType;
    });
  }, [entries, currentMonth, activeTab]);

  // Calculate Total for the View
  const totalAmount = useMemo(() => {
      return filteredEntries.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredEntries]);

  // Group by Category
  const dataByCategory = useMemo(() => {
    const map = new Map();
    filteredEntries.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a: any, b: any) => b.value - a.value);
  }, [filteredEntries]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      {/* Month Navigation Header */}
      <div 
        className="bg-white sticky top-0 z-10 border-b border-slate-100"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
            <button onClick={prevMonth} className="p-2 text-slate-500 hover:text-indigo-600 rounded-full hover:bg-slate-100">
                <ChevronLeft size={24} />
            </button>
            <div className="text-center">
                <h2 className="text-lg font-bold text-slate-800">{format(currentMonth, 'yyyy年 MM月')}</h2>
            </div>
            <button onClick={nextMonth} className="p-2 text-slate-500 hover:text-indigo-600 rounded-full hover:bg-slate-100">
                <ChevronRight size={24} />
            </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pb-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('expense')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'expense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                    支出统计
                </button>
                <button 
                    onClick={() => setActiveTab('income')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                >
                    收入统计
                </button>
            </div>
        </div>

        {/* Total Display */}
        <div className="px-6 py-4 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {activeTab === 'expense' ? '本月总支出' : '本月总收入'}
            </p>
            <h1 className={`text-3xl font-bold mt-1 ${activeTab === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>
                {CURRENCY_SYMBOL}{totalAmount.toLocaleString()}
            </h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {dataByCategory.length > 0 ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">分类占比</h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                            <Pie 
                                data={dataByCategory} 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                            >
                                {dataByCategory.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <ReTooltip 
                                formatter={(value: any) => [`${CURRENCY_SYMBOL}${value}`, '金额']} 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                            />
                        </RePieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                    {dataByCategory.map((item: any) => (
                        <div key={item.name} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-slate-700 font-medium">{item.name}</span>
                                <span className="text-xs text-slate-400">
                                    {((item.value / totalAmount) * 100).toFixed(1)}%
                                </span>
                            </div>
                            <span className="font-semibold text-slate-900">{CURRENCY_SYMBOL}{item.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        ) : (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>本月暂无{activeTab === 'expense' ? '支出' : '收入'}记录</p>
            </div>
        )}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = () => { setCategories(getCategories()); };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const newCat = {
      id: generateId(),
      name: newCategoryName.trim(),
      type: 'expense' as const,
      color: randomColor
    };
    saveCategory(newCat);
    setNewCategoryName('');
    setIsAdding(false);
    loadCategories();
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个分类吗？')) {
        deleteCategory(id);
        loadCategories();
    }
  };

  const handleExportBackup = () => {
    try {
        const jsonString = exportData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ZenLedger_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('导出失败，请重试');
    }
  };

  const handleImportBackup = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target?.result as string;
        if (confirm('⚠️ 警告：导入备份将【完全覆盖】当前的记账记录和分类设置。\n\n建议在覆盖前先导出当前数据。\n\n确定要继续恢复吗？')) {
             const success = importData(content);
             if (success) {
                 alert('✅ 数据恢复成功！');
                 loadCategories();
             } else {
                 alert('❌ 恢复失败：文件格式不正确或文件已损坏。');
             }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div 
        className="bg-white px-6 pb-6 flex items-center shadow-sm sticky top-0 z-10 transition-all"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top) + 10px)' }}
      >
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800 mr-4"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold text-slate-800">设置</h1>
      </div>

      <div className="p-6 space-y-8">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Download size={18} className="text-blue-600"/> 安装到桌面 (iOS)</h3>
            <div className="space-y-3 text-sm text-slate-600">
                <ol className="list-decimal list-inside space-y-2 font-medium">
                    <li className="flex items-center gap-2">Safari 中点击底部 <span className="bg-slate-200 p-1 rounded"><Share size={12} className="inline text-blue-600"/> 分享</span></li>
                    <li className="flex items-center gap-2">选择 <span className="font-bold text-slate-800">"添加到主屏幕"</span></li>
                </ol>
            </div>
        </div>

        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2"><Tag size={16} /> 消费分类</h2>
                <button onClick={() => setIsAdding(!isAdding)} className="text-indigo-600 text-sm font-medium hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition-colors">{isAdding ? '取消' : '+ 新增'}</button>
            </div>
            {isAdding && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 mb-4">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">分类名称</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="例如：奶茶" className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="bg-indigo-600 text-white rounded-xl px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"><Plus size={20} /></button>
                    </div>
                </div>
            )}
            <div className="space-y-3">
                {categories.map(cat => (
                    <div key={cat.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="font-medium text-slate-700">{cat.name}</span>
                        </div>
                        <button onClick={() => handleDelete(cat.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>

        <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2"><ShieldCheck size={16} /> 数据安全</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button onClick={handleExportBackup} className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mr-4"><Download size={20} /></div>
                    <div className="flex-1"><h3 className="font-bold text-slate-800">导出备份</h3><p className="text-xs text-slate-500">下载 .json 数据文件到本地</p></div>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left relative">
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600 mr-4"><Upload size={20} /></div>
                    <div className="flex-1"><h3 className="font-bold text-slate-800">恢复备份</h3><p className="text-xs text-slate-500">从 .json 文件导入数据</p></div>
                    <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                </button>
            </div>
            <div className="mt-4 flex gap-2 text-xs text-slate-400 bg-slate-100 p-3 rounded-lg"><Info size={16} className="shrink-0" /><p>建议定期导出备份。数据仅存储在您的设备浏览器中，若清除缓存数据将会丢失。</p></div>
        </div>

        <div className="text-center pt-8 pb-4">
             <div className="flex justify-center mb-2"><FileJson className="text-slate-300" size={32} /></div>
             <p className="text-xs text-slate-400">ZenLedger Local v1.1.0</p>
             <p className="text-[10px] text-slate-300 mt-1">Privacy Focused • Offline First</p>
        </div>
      </div>
    </div>
  );
};

// --- 6. APP & NAVIGATION ---

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  
  const navItemClass = (path: string) => 
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
      isActive(path) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
    }`;

  return (
    <nav 
      className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 px-2 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-full items-center relative">
        <Link to="/" className={navItemClass('/')}>
          <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
          <span className="text-[10px] font-medium">首页</span>
        </Link>
        <Link to="/stats" className={navItemClass('/stats')}>
          <PieChart size={24} strokeWidth={isActive('/stats') ? 2.5 : 2} />
          <span className="text-[10px] font-medium">统计</span>
        </Link>
        <div className="relative h-full flex items-center justify-center">
           <button 
             onClick={() => navigate('/add')} 
             className="absolute -top-8 bg-indigo-600 rounded-full p-4 shadow-xl shadow-indigo-200 transform transition-transform hover:scale-105 active:scale-95 ring-4 ring-white flex items-center justify-center z-50 cursor-pointer pointer-events-auto"
           >
             <Plus size={32} color="white" strokeWidth={3} className="pointer-events-none" />
           </button>
        </div>
        <div className="flex items-center justify-center text-slate-300 pointer-events-none opacity-0"></div>
        <Link to="/settings" className={navItemClass('/settings')}>
          <Settings size={24} strokeWidth={isActive('/settings') ? 2.5 : 2} />
          <span className="text-[10px] font-medium">设置</span>
        </Link>
      </div>
    </nav>
  );
};

const App = () => {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const loadData = () => {
      setEntries(getEntries());
    };
    loadData();
    window.addEventListener('zenledger-update', loadData);
    return () => window.removeEventListener('zenledger-update', loadData);
  }, []);

  return (
    <MemoryRouter>
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative">
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          <Routes>
            <Route path="/" element={<HomePage entries={entries} />} />
            <Route path="/add" element={<AddEntryPage />} />
            <Route path="/edit/:id" element={<AddEntryPage />} />
            <Route path="/stats" element={<StatsPage entries={entries} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
        <Navigation />
      </div>
    </MemoryRouter>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
