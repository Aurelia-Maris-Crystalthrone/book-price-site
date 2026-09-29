'use client';

import * as React from 'react';
import { Loader2, ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';
import { SearchTabs } from '@/components/SearchTabs';
import type { SearchMode } from '@/lib/types';

/**
 * Hero 搜索区：大标题 + 副标题 + 三种模式 Tab + 对应输入框
 */

interface HeroSearchProps {
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  onSmartSearch: (q: string) => void;
  onAdvancedSearch: (p: { title: string; author: string; edition: string }) => void;
  loading: boolean;
}

export function HeroSearch({
  mode,
  onModeChange,
  onSmartSearch,
  onAdvancedSearch,
  loading,
}: HeroSearchProps) {
  // 高级组合查询的三个字段
  const [advTitle, setAdvTitle] = React.useState('');
  const [advAuthor, setAdvAuthor] = React.useState('');
  const [advEdition, setAdvEdition] = React.useState('');

  const advValid =
    advTitle.trim().length > 0 || advAuthor.trim().length > 0 || advEdition.trim().length > 0;

  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/60 via-background to-background">
      {/* 装饰性背景圆 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="container relative flex flex-col items-center gap-6 py-14 md:py-20">
        {/* 标题 */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            买书之前，
            <span className="text-primary">先比个价</span>
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground md:text-base">
            输入书名、作者或 ISBN，一次查询孔夫子、闲鱼、京东、有路等 7 个平台的在售价格，
            历史趋势一目了然
          </p>
        </div>

        {/* 模式切换 */}
        <SearchTabs value={mode} onChange={onModeChange} />

        {/* 输入区（按模式切换） */}
        {mode === 'smart' ? (
          <SearchBar onSearch={onSmartSearch} loading={loading} />
        ) : mode === 'isbn' ? (
          <SearchBar
            onSearch={onSmartSearch}
            loading={loading}
            placeholder="输入 10 位或 13 位 ISBN，如 9787111407010"
          />
        ) : (
          <div className="w-full max-w-2xl space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={advTitle}
                onChange={(e) => setAdvTitle(e.target.value)}
                placeholder="书名（如：算法导论）"
                aria-label="书名"
                className="h-12"
              />
              <Input
                value={advAuthor}
                onChange={(e) => setAdvAuthor(e.target.value)}
                placeholder="作者（如：科尔曼）"
                aria-label="作者"
                className="h-12"
              />
              <Input
                value={advEdition}
                onChange={(e) => setAdvEdition(e.target.value)}
                placeholder="版次（如：第3版）"
                aria-label="版次"
                className="h-12"
              />
            </div>
            <Button
              size="lg"
              className="h-12 w-full rounded-xl text-base"
              disabled={loading || !advValid}
              onClick={() =>
                onAdvancedSearch({
                  title: advTitle.trim(),
                  author: advAuthor.trim(),
                  edition: advEdition.trim(),
                })
              }
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ScanBarcode className="h-5 w-5" />
              )}
              {loading ? '查询中…' : '组合搜索'}
            </Button>
          </div>
        )}

        {/* 快捷示例 */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>试试：</span>
          {['算法导论', '9787111407010', '人类简史 赫拉利', '机器学习 周志华'].map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => {
                onModeChange('smart');
                onSmartSearch(kw);
              }}
              className="rounded-full border bg-card px-3 py-1 transition-colors hover:border-primary hover:text-primary"
            >
              {kw}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
