'use client';

import * as React from 'react';
import { ArrowUpDown, Filter } from 'lucide-react';
import {
  PriceResultCard,
  PlatformUnavailableCard,
  PLATFORM_NAMES,
} from '@/components/PriceResultCard';
import { Skeleton } from '@/components/Skeleton';
import { Button } from '@/components/ui/button';
import { platformOrder } from '@/lib/utils';
import type { PlatformOutcome, PlatformResult } from '@/lib/types';

/**
 * 比价结果列表
 * - 排序/筛选栏：价格升序（默认）/ 按平台 / 品相筛选 / 平台筛选
 * - 所有 API 报价 + 跳转占位 + 不可用占位统一渲染
 */

interface PriceResultListProps {
  outcomes: PlatformOutcome[];
  cheapest: PlatformResult | null;
  loading: boolean;
}

type SortKey = 'price-asc' | 'platform';
type ConditionKey = 'all' | '全新' | '二手';

export function PriceResultList({ outcomes, cheapest, loading }: PriceResultListProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('price-asc');
  const [platformFilter, setPlatformFilter] = React.useState<string>('all');
  const [conditionFilter, setConditionFilter] = React.useState<ConditionKey>('all');

  // 展开每条结果（打平），附带 outcome 状态
  const flat: Array<{ result: PlatformResult; outcome: PlatformOutcome }> = React.useMemo(() => {
    const list: Array<{ result: PlatformResult; outcome: PlatformOutcome }> = [];
    for (const o of outcomes) {
      for (const r of o.results) {
        list.push({ result: r, outcome: o });
      }
    }
    return list;
  }, [outcomes]);

  // 筛选
  const filtered = React.useMemo(() => {
    let list = flat;
    if (platformFilter !== 'all') {
      list = list.filter((x) => x.result.platform === platformFilter);
    }
    if (conditionFilter !== 'all') {
      list = list.filter((x) => {
        if (x.result.source === 'jump') return false; // 占位不参与品相筛选
        const c = x.result.condition;
        if (conditionFilter === '全新') return c.includes('全新');
        return !c.includes('全新'); // 二手（九五新/九品/八品等）
      });
    }
    return list;
  }, [flat, platformFilter, conditionFilter]);

  // 排序：真实报价在前、占位在后；价格升序或按平台固定顺序
  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      // 不可用占位永远最后
      const rank = (x: { result: PlatformResult; outcome: PlatformOutcome }): number =>
        x.outcome.status === 'unavailable' ? 2 : x.result.source === 'jump' ? 1 : 0;
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      if (sortKey === 'price-asc') return a.result.price - b.result.price;
      return platformOrder(a.result.platform) - platformOrder(b.result.platform);
    });
    return arr;
  }, [filtered, sortKey]);

  // 可用平台筛选选项（有报价的平台）
  const platformOptions = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const x of flat) set.set(x.result.platform, x.result.platformName);
    return Array.from(set.entries());
  }, [flat]);

  if (loading) {
    return (
      <div className="space-y-3" aria-label="正在查询各平台价格">
        <p className="text-sm font-medium text-muted-foreground">正在并发查询 7 个平台…</p>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (outcomes.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* 排序 / 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" /> 排序
        </span>
        <Button
          variant={sortKey === 'price-asc' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSortKey('price-asc')}
        >
          价格升序
        </Button>
        <Button
          variant={sortKey === 'platform' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSortKey('platform')}
        >
          按平台
        </Button>

        <span className="mx-2 hidden h-4 w-px bg-border sm:block" />

        <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> 筛选
        </span>
        {/* 平台筛选 */}
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-card px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="按平台筛选"
        >
          <option value="all">全部平台</option>
          {platformOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {/* 品相筛选 */}
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value as ConditionKey)}
          className="h-8 rounded-lg border border-input bg-card px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="按品相筛选"
        >
          <option value="all">全部品相</option>
          <option value="全新">全新</option>
          <option value="二手">二手</option>
        </select>
      </div>

      {/* 结果卡片 */}
      {sorted.map(({ result }) => (
        <PriceResultCard
          key={`${result.platform}-${result.url}-${result.price}`}
          result={result}
          isCheapest={
            cheapest !== null &&
            result.source === 'api' &&
            cheapest.url === result.url &&
            cheapest.price === result.price
          }
        />
      ))}

      {/* 不可用平台占位（单独渲染，放最底部） */}
      {outcomes
        .filter((o) => o.status === 'unavailable')
        .map((o) => (
          <PlatformUnavailableCard
            key={o.platform}
            platformName={PLATFORM_NAMES[o.platform] ?? o.platform}
            reason={o.reason}
          />
        ))}
    </div>
  );
}
