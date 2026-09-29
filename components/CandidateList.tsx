'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CandidateCard } from '@/components/CandidateCard';
import { Skeleton } from '@/components/Skeleton';
import type { BookCandidate } from '@/lib/types';

/**
 * 候选书籍确认列表
 * - 卡片网格：桌面 3 列 / 平板 2 列 / 手机 1 列
 * - 键盘 ↑↓ 移动高亮，Enter 选中（page.tsx 传入 activeIndex）
 * - 超过 6 条折叠为「手风琴」（默认展开前 6 条，其余收起）
 */

interface CandidateListProps {
  candidates: BookCandidate[];
  loading: boolean;
  activeIndex: number;
  onSelect: (c: BookCandidate) => void;
}

const FOLD_THRESHOLD = 6; // 超过此数量折叠

export function CandidateList({ candidates, loading, activeIndex, onSelect }: CandidateListProps) {
  const [expanded, setExpanded] = React.useState(false);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // 键盘高亮变化时滚动到可见区域
  React.useEffect(() => {
    if (activeIndex < 0 || !gridRef.current) return;
    const el = gridRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (loading) {
    // 骨架屏
    return (
      <section className="container py-8" aria-label="正在搜索候选书籍">
        <p className="mb-4 text-sm font-medium text-muted-foreground">正在解析书籍信息…</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </section>
    );
  }

  if (candidates.length === 0) return null;

  const shouldFold = candidates.length > FOLD_THRESHOLD && !expanded;
  const visible = shouldFold ? candidates.slice(0, FOLD_THRESHOLD) : candidates;
  const hiddenCount = candidates.length - FOLD_THRESHOLD;

  return (
    <section className="container animate-fade-in-up py-8" aria-label="候选书籍列表">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          找到 <span className="text-primary">{candidates.length}</span> 本候选书籍
        </h2>
        <p className="text-xs text-muted-foreground">↑↓ 键选择 · Enter 确认 · 点击卡片直接比价</p>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c, i) => (
          <CandidateCard
            key={c.rowId}
            candidate={c}
            active={i === activeIndex}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* 手风琴折叠按钮 */}
      {candidates.length > FOLD_THRESHOLD ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {expanded ? (
              <>
                收起 <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                展开其余 {hiddenCount} 本 <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
