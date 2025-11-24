import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Entry, EntryType } from '../types.ts';
import { CURRENCY_SYMBOL } from '../constants.ts';
import { format, parseISO } from 'date-fns';

interface HomePageProps {
  entries: Entry[];
}

const HomePage: React.FC<HomePageProps> = ({ entries }) => {
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

  const totalExpense = useMemo(() => 
    entries.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0), 
  [entries]);

  const filterLabels: Record<string, string> = {
      all: '全部',
      expense: '支出',
      income: '收入',
      note: '笔记'
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header & Search */}
      <div 
        className="bg-white px-6 pb-4 rounded-b-3xl shadow-sm sticky top-0 z-20 transition-all"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">总支出</h2>
            <h1 className="text-3xl font-bold text-slate-900">{CURRENCY_SYMBOL}{totalExpense.toLocaleString()}</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
            ZS
          </div>
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
        
        {/* Filter Chips */}
        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
            {(['all', 'expense', 'income', 'note'] as const).map(f => (
                <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                        filterType === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                    {filterLabels[f]}
                </button>
            ))}
        </div>
      </div>

      {/* Timeline List */}
      <div className="px-4 py-6 space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-sm">暂无记录。</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <EntryCard key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
};

const EntryCard: React.FC<{ entry: Entry }> = ({ entry }) => {
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
        <p className="text-sm text-slate-500 line-clamp-2 pl-12 text-left">
            {entry.content}
        </p>
      )}
    </button>
  );
};

export default HomePage;