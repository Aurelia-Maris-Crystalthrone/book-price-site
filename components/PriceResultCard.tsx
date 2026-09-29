'use client';

import { ExternalLink, SearchX, Store, Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatPrice, platformOrder } from '@/lib/utils';
import type { PlatformResult } from '@/lib/types';

/** 平台名映射（unavailable 状态时只知道 platform id） */
export const PLATFORM_NAMES: Record<string, string> = {
  kongfz: '孔夫子旧书网',
  xianyu: '闲鱼',
  jd: '京东',
  youlu: '有路网',
  taobao: '淘宝',
  duozhuayu: '多抓鱼',
  xiaoguya: '小谷吖',
};

/** 平台名首字（无 Logo 时的文字徽标，取前 1-2 字） */
function platformInitial(name: string): string {
  return name.length > 3 ? name.slice(0, 2) : name.slice(0, 1);
}

/**
 * 单条平台报价卡片
 * - api 真实报价：价格大号加粗 + 品相标签 + 店铺 + 「去购买」
 * - jump 跳转占位：灰色调，按钮「前往搜索」
 * - 最低价卡片：绿色边框 + 「最低价」徽章
 */
export function PriceResultCard({
  result,
  isCheapest,
}: {
  result: PlatformResult;
  isCheapest: boolean;
}) {
  const isJump = result.source === 'jump';

  return (
    <Card
      className={cn(
        'animate-fade-in-up flex items-center gap-4 p-4 hover:shadow-md',
        isCheapest && 'border-2 border-success',
        isJump && 'opacity-75 grayscale-[30%]'
      )}
    >
      {/* 平台文字 Logo */}
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
          isJump ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        )}
        aria-hidden
      >
        {platformInitial(result.platformName)}
      </span>

      {/* 主体信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{result.platformName}</span>
          {isCheapest ? <Badge variant="success">最低价</Badge> : null}
          {isJump ? <Badge variant="muted">无 API · 跳转搜索</Badge> : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" title={result.title}>
          {result.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Store className="h-3.5 w-3.5" /> {result.shop}
          </span>
          {result.condition ? (
            <Badge variant="outline" className="text-[10px]">
              {result.condition}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* 价格 + 按钮 */}
      {isJump ? (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <SearchX className="h-3.5 w-3.5" /> 无实时报价
          </span>
          <Button asChild variant="outline" size="sm">
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              前往搜索
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={cn(
              'text-2xl font-extrabold tracking-tight',
              isCheapest ? 'text-success' : 'text-foreground'
            )}
          >
            {formatPrice(result.price)}
          </span>
          <Button asChild size="sm" variant={isCheapest ? 'default' : 'outline'}>
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              去购买
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}
    </Card>
  );
}

/** 平台「暂时不可用」占位卡（灰色调 + 原因说明） */
export function PlatformUnavailableCard({
  platformName,
  reason,
}: {
  platformName: string;
  reason?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-4 opacity-70">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        aria-hidden
      >
        <Ban className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-muted-foreground">{platformName}</span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {reason ?? '暂时不可用'} · 该平台查询失败或未配置密钥，不影响其他平台结果
        </p>
      </div>
      <Badge variant="muted">不可用</Badge>
    </Card>
  );
}

export { platformOrder };
