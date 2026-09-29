'use client';

import { BookMarked, Search, ScanBarcode } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SearchMode } from '@/lib/types';

/**
 * 搜索模式 Tabs：智能搜索 / ISBN 精确 / 高级组合
 */
export function SearchTabs({
  value,
  onChange,
}: {
  value: SearchMode;
  onChange: (m: SearchMode) => void;
}) {
  const TABS: Array<{ value: SearchMode; label: string; icon: React.ReactNode }> = [
    { value: 'smart', label: '智能搜索', icon: <Search className="h-4 w-4" /> },
    { value: 'isbn', label: 'ISBN 精确查询', icon: <ScanBarcode className="h-4 w-4" /> },
    { value: 'advanced', label: '高级组合查询', icon: <BookMarked className="h-4 w-4" /> },
  ];

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as SearchMode)}>
      <TabsList className="h-auto w-full max-w-xl flex-wrap justify-center sm:w-auto">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
            {t.icon}
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
