'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { HistoryResponse } from '@/lib/types';

/**
 * 价格趋势折线图（Recharts）
 * - X 轴时间，Y 轴价格（元）
 * - 每个平台一条线（各平台固定颜色）
 * - 图例点击切换显示/隐藏
 */

/** 平台固定配色（Olive 主题调色板 + 区分色） */
const PLATFORM_COLORS: Record<string, string> = {
  kongfz: '#6a8571', // 主色 Olive
  youlu: '#8a9a5b', // 苔绿
  xianyu: '#e8a87c', // 陶土橙
  jd: '#c94f4f', // 砖红（京东）
  taobao: '#f2a900', // 橙黄
  duozhuayu: '#5b8c85', // 灰青
  xiaoguya: '#9c6f9e', // 紫灰
};

const PLATFORM_NAMES: Record<string, string> = {
  kongfz: '孔夫子旧书网',
  xianyu: '闲鱼',
  jd: '京东',
  youlu: '有路网',
  taobao: '淘宝',
  duozhuayu: '多抓鱼',
  xiaoguya: '小谷吖',
};

interface TrendPoint {
  /** 时间刻度（按采集批次聚合，分钟粒度） */
  time: string;
  /** 各平台价格，如 kongfz: 25.5 */
  [platform: string]: string | number | null;
}

/** Tooltip 自定义渲染 */
function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <p key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold">¥{Number(p.value).toFixed(2)}</span>
          </p>
        ))}
    </div>
  );
}

export function PriceTrendChart({ history }: { history: HistoryResponse | null }) {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  const { points, platforms } = React.useMemo(() => {
    if (!history || history.rows.length === 0) {
      return { points: [] as TrendPoint[], platforms: [] as string[] };
    }
    // 按采集批次时间聚合（同一 crawl_time 为一个 X 轴刻度）
    const batches = new Map<string, Map<string, number>>();
    for (const row of history.rows) {
      const t = row.crawl_time.slice(0, 16).replace('T', ' '); // 分钟粒度
      if (!batches.has(t)) batches.set(t, new Map());
      const m = batches.get(t)!;
      // 同批次同平台取最低价
      const prev = m.get(row.platform);
      if (prev === undefined || row.price < prev) m.set(row.platform, row.price);
    }
    const times = Array.from(batches.keys()).sort();
    const platSet = new Set<string>();
    for (const m of batches.values()) for (const p of m.keys()) platSet.add(p);
    const pts: TrendPoint[] = times.map((t) => {
      const point: TrendPoint = { time: t };
      for (const [p, v] of batches.get(t)!) point[p] = v;
      return point;
    });
    return { points: pts, platforms: Array.from(platSet) };
  }, [history]);

  // 图例点击切换显隐
  function togglePlatform(p: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="h-4 w-4 text-primary" />
          价格趋势
        </CardTitle>
        <CardDescription>
          每次搜索自动记录各平台最低报价；点击图例可显示/隐藏平台
        </CardDescription>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          /* 历史为空的友好提示 */
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg bg-muted/40 text-sm text-muted-foreground">
            <LineChartIcon className="h-8 w-8 opacity-40" />
            暂无历史数据，多搜索几次后即可查看
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `¥${v}`}
                />
                <Tooltip content={<TrendTooltip />} />
                {platforms.map((p) => (
                  <Line
                    key={p}
                    type="monotone"
                    dataKey={p}
                    name={PLATFORM_NAMES[p] ?? p}
                    stroke={PLATFORM_COLORS[p] ?? '#8884d8'}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    hide={hidden.has(p)}
                  />
                ))}
                {/* 自定义图例（可点击切换显隐） */}
                <Legend
                  content={() => (
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2">
                      {platforms.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePlatform(p)}
                          className={`inline-flex items-center gap-1.5 text-xs transition-opacity ${
                            hidden.has(p) ? 'opacity-35' : ''
                          }`}
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: PLATFORM_COLORS[p] ?? '#8884d8' }}
                          />
                          {PLATFORM_NAMES[p] ?? p}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
