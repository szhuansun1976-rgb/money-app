

export type EntryType = 'expense' | 'income' | 'note';

export interface MediaAttachment {
  id: string;
  type: 'image' | 'audio' | 'drawing';
  data: string; // Base64 string
}

export interface Entry {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  tags: string[];
  content: string; // Description or Note text
  date: string; // ISO Date string
  media: MediaAttachment[];
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
}

export interface StatGroup {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

// Default Income categories
export const INCOME_CATEGORIES = [
  '工资', '兼职', '礼金', '理财', '其他'
];
