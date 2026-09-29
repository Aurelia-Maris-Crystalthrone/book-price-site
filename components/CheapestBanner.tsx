'use client';

import { Crown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import type { PlatformResult } from '@/lib/types';

/**
 * 全网最低价横幅（绿色高亮）
 * 「全网最低 ¥XX.XX @ 孔夫子旧书网」+ 跳转按钮
 */
export function CheapestBanner({ cheapest }: { cheapest: PlatformResult }) {
  return (
    <div className="animate-fade-in-up flex flex-col gap-3 rounded-xl border-2 border-success bg-success/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {/* 皇冠图标 */}
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground shadow-sm">
          <Crown className="h-6 w-6" />
        </span>
        <div>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-success">全网最低</span>
            <span className="text-3xl font-extrabold tracking-tight text-success">
              {formatPrice(cheapest.price)}
            </span>
            <span className="text-sm text-muted-foreground">
              @ {cheapest.platformName} · {cheapest.shop}
            </span>
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {cheapest.title} · {cheapest.condition}
          </p>
        </div>
      </div>

      <Button
        asChild
        variant="default"
        className="h-11 shrink-0 bg-success px-6 text-base hover:bg-success/90"
      >
        <a href={cheapest.url} target="_blank" rel="noopener noreferrer">
          去购买
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
