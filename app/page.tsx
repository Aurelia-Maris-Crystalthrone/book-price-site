'use client';

import * as React from 'react';
import { SearchX, RotateCcw, Info } from 'lucide-react';
import { HeroSearch } from '@/components/HeroSearch';
import { CandidateList } from '@/components/CandidateList';
import { BookInfoCard } from '@/components/BookInfoCard';
import { CheapestBanner } from '@/components/CheapestBanner';
import { PriceResultList } from '@/components/PriceResultList';
import { PriceTrendChart } from '@/components/PriceTrendChart';
import { Button } from '@/components/ui/button';
import { normalizeToIsbn13, isValidIsbn } from '@/lib/isbn';
import type {
  AdvancedQuery,
  BookCandidate,
  BookMeta,
  HistoryResponse,
  ResolveResponse,
  SearchMode,
  SearchResponse,
} from '@/lib/types';

/**
 * 首页：状态机
 * idle → resolving（解析输入）→
 *   ├─ ISBN 输入 → book 确认 → searching（并发比价）→ results
 *   └─ 关键词输入 → candidates 候选列表 → 用户选择 → searching → results
 * 结果区：BookInfoCard + CheapestBanner + PriceResultList + PriceTrendChart
 */

type Phase = 'idle' | 'resolving' | 'candidates' | 'searching' | 'results';

export default function HomePage() {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [mode, setMode] = React.useState<SearchMode>('smart');
  const [error, setError] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<BookCandidate[]>([]);
  const [activeCandidate, setActiveCandidate] = React.useState(-1);
  const [book, setBook] = React.useState<BookMeta | null>(null);
  const [searchResult, setSearchResult] = React.useState<SearchResponse | null>(null);
  const [history, setHistory] = React.useState<HistoryResponse | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  /** 平滑滚动到结果区 */
  const scrollToResults = React.useCallback(() => {
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, []);

  /** 并发比价 + 拉取历史（用户确认书籍后调用） */
  async function runSearch(b: BookMeta) {
    if (!b.isbn13) {
      setError('该候选书籍缺少 ISBN，无法比价，请选择其他版本');
      return;
    }
    setPhase('searching');
    setBook(b);
    setError(null);
    setSearchResult(null);
    setHistory(null);
    scrollToResults();
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: b.isbn13, title: b.title }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `查询失败（HTTP ${res.status}）`);
      }
      const data = (await res.json()) as SearchResponse;
      setSearchResult(data);
      setPhase('results');
      // 比价完成后拉取历史趋势（含本次记录）
      const hres = await fetch(`/api/history?isbn=${encodeURIComponent(data.isbn)}`);
      if (hres.ok) setHistory((await hres.json()) as HistoryResponse);
    } catch (err) {
      setError((err as Error).message);
      setPhase('results'); // 保持书籍卡片可见，错误提示显示在结果区
    }
  }

  /** 第一步：解析输入（智能/ISBN/高级组合共用） */
  async function resolve(params: { q?: string; title?: string; author?: string; edition?: string }) {
    setPhase('resolving');
    setError(null);
    setCandidates([]);
    setBook(null);
    setSearchResult(null);
    setHistory(null);
    setActiveCandidate(-1);
    try {
      const sp = new URLSearchParams();
      if (params.q) sp.set('q', params.q);
      if (params.title) sp.set('title', params.title);
      if (params.author) sp.set('author', params.author);
      if (params.edition) sp.set('edition', params.edition);
      const res = await fetch(`/api/resolve?${sp.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `解析失败（HTTP ${res.status}）`);
      }
      const data = (await res.json()) as ResolveResponse;

      if (data.inputType === 'isbn') {
        // ISBN 精确命中 → 直接进入比价
        if (data.book) {
          await runSearch(data.book);
        } else {
          setError('ISBN 合法但未找到对应书籍，请确认后重试，或改用书名搜索');
          setPhase('idle');
        }
      } else {
        // 关键词 → 候选列表（禁止自动取第一条，必须让用户选择）
        if (data.candidates.length === 0) {
          setError('未找到匹配书籍，请尝试其他关键词');
          setPhase('idle');
        } else {
          setCandidates(data.candidates);
          setActiveCandidate(0);
          setPhase('candidates');
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    }
  }

  /** 全局键盘：候选列表 ↑↓ + Enter */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'candidates' || candidates.length === 0) return;
      // 输入框聚焦时不干扰（SearchBar 自己处理）
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveCandidate((i) => (i + 1) % candidates.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveCandidate((i) => (i <= 0 ? candidates.length - 1 : i - 1));
      } else if (e.key === 'Enter' && activeCandidate >= 0) {
        e.preventDefault();
        void runSearch(candidates[activeCandidate]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, candidates, activeCandidate]);

  const busy = phase === 'resolving' || phase === 'searching';

  return (
    <div className="flex flex-col">
      {/* Hero 搜索区 */}
      <HeroSearch
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setError(null);
        }}
        onSmartSearch={(q) => {
          // 智能模式下的前端预检：形似 ISBN 但校验失败 → 直接提示，省一次请求
          const cleaned = q.replace(/[-\s]/g, '');
          if (/^\d{10}$|^\d{13}$/.test(cleaned) && !isValidIsbn(cleaned)) {
            setError('ISBN 格式不正确，请检查');
            setPhase('idle');
            return;
          }
          void resolve({ q });
        }}
        onAdvancedSearch={(p: AdvancedQuery) => void resolve(p)}
        loading={busy}
      />

      {/* 错误提示（边界情况统一展示位） */}
      {error ? (
        <div className="container animate-fade-in-up pt-6">
          <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <SearchX className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">{error}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              aria-label="关闭提示"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* 候选书籍确认区 */}
      <CandidateList
        candidates={candidates}
        loading={phase === 'resolving'}
        activeIndex={activeCandidate}
        onSelect={(c) => void runSearch(c)}
      />

      {/* 比价结果面板 */}
      {(phase === 'searching' || phase === 'results') && book ? (
        <section ref={resultsRef} className="container space-y-5 py-8">
          {/* 目标书籍信息卡 */}
          <BookInfoCard book={book} />

          {/* 最低价横幅 */}
          {searchResult?.cheapest ? <CheapestBanner cheapest={searchResult.cheapest} /> : null}

          {/* 无任何 API 报价时的提示 */}
          {phase === 'results' && searchResult && !searchResult.cheapest ? (
            <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 text-primary" />
              各平台暂无实时报价（可能未配置密钥或无在售），可通过下方「前往搜索」卡片跳转平台查询
            </div>
          ) : null}

          {/* 平台结果列表（含排序筛选） */}
          <PriceResultList
            outcomes={searchResult?.outcomes ?? []}
            cheapest={searchResult?.cheapest ?? null}
            loading={phase === 'searching'}
          />

          {/* 价格趋势图 */}
          <PriceTrendChart history={history} />

          {/* 采集元信息 */}
          {searchResult ? (
            <p className="text-center text-xs text-muted-foreground">
              共查询 7 个平台 · 耗时 {(searchResult.elapsedMs / 1000).toFixed(1)} 秒 · 采集于{' '}
              {new Date(searchResult.crawledAt).toLocaleString('zh-CN', { hour12: false })}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
