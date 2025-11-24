
import React, { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Plus, PieChart, Settings } from 'lucide-react';
import HomePage from './pages/HomePage.tsx';
import AddEntryPage from './pages/AddEntryPage.tsx';
import StatsPage from './pages/StatsPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { Entry } from './types.ts';
import * as storageService from './services/storageService.ts';

const App: React.FC = () => {
  // Global state lifted up for simplicity in this demo
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const loadData = () => {
      const data = storageService.getEntries();
      setEntries(data);
    };
    loadData();
    
    // Listen for custom event to refresh data
    window.addEventListener('zenledger-update', loadData);
    return () => window.removeEventListener('zenledger-update', loadData);
  }, []);

  return (
    <MemoryRouter>
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          <Routes>
            <Route path="/" element={<HomePage entries={entries} />} />
            <Route path="/add" element={<AddEntryPage />} />
            <Route path="/edit/:id" element={<AddEntryPage />} />
            <Route path="/stats" element={<StatsPage entries={entries} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>

        {/* Bottom Navigation */}
        <Navigation />
      </div>
    </MemoryRouter>
  );
};

const Navigation: React.FC = () => {
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
        
        {/* Left Side */}
        <Link to="/" className={navItemClass('/')}>
          <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
          <span className="text-[10px] font-medium">首页</span>
        </Link>
        
        <Link to="/stats" className={navItemClass('/stats')}>
          <PieChart size={24} strokeWidth={isActive('/stats') ? 2.5 : 2} />
          <span className="text-[10px] font-medium">统计</span>
        </Link>

        {/* Center Floating Button */}
        <div className="relative h-full flex items-center justify-center">
           <button 
             onClick={() => navigate('/add')} 
             className="absolute -top-8 bg-indigo-600 rounded-full p-4 shadow-xl shadow-indigo-200 transform transition-transform hover:scale-105 active:scale-95 ring-4 ring-white flex items-center justify-center z-50 cursor-pointer pointer-events-auto"
             aria-label="记一笔"
             type="button"
           >
             <Plus size={32} color="white" strokeWidth={3} className="pointer-events-none" />
           </button>
        </div>

        {/* Right Side - Empty slot for balance if needed, using 5 cols now */}
        <div className="flex items-center justify-center text-slate-300 pointer-events-none opacity-0">
             {/* Spacer */}
        </div>

        <Link to="/settings" className={navItemClass('/settings')}>
          <Settings size={24} strokeWidth={isActive('/settings') ? 2.5 : 2} />
          <span className="text-[10px] font-medium">设置</span>
        </Link>
      </div>
    </nav>
  );
}

export default App;