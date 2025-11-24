
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Entry, StatGroup } from '../types.ts';
import { CURRENCY_SYMBOL } from '../constants.ts';

interface StatsPageProps {
  entries: Entry[];
}

const StatsPage: React.FC<StatsPageProps> = ({ entries }) => {

  const expenseEntries = entries.filter(e => e.type === 'expense');
  
  // Calculate category breakdown
  const dataByCategory: StatGroup[] = useMemo(() => {
    const map = new Map<string, number>();
    const colorMap = new Map<string, string>();

    // We generate colors dynamically based on index if not stored in category, 
    // but here we just assign standard colors for simplicity in stats view
    const STANDARD_COLORS = [
      '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', 
      '#8b5cf6', '#ef4444', '#64748b', '#14b8a6', '#f97316'
    ];

    expenseEntries.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    
    return Array.from(map.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: STANDARD_COLORS[index % STANDARD_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenseEntries]);

  return (
    <div className="min-h-full bg-slate-50 p-6 pb-24 space-y-6">
      <div className="sticky top-0 bg-slate-50 z-10 py-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <h1 className="text-2xl font-bold text-slate-800">统计分析</h1>
      </div>

      {/* Charts Section */}
      {dataByCategory.length > 0 ? (
        <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">分类支出</h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={dataByCategory}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {dataByCategory.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number) => [`${CURRENCY_SYMBOL}${value}`, '金额']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                    {dataByCategory.map(item => (
                        <div key={item.name} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-slate-600">{item.name}</span>
                            </div>
                            <span className="font-medium text-slate-900">{CURRENCY_SYMBOL}{item.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
            <p>记一笔支出后查看统计。</p>
        </div>
      )}
    </div>
  );
};

export default StatsPage;