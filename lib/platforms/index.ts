/**
 * 平台适配器统一调度入口
 * - 并发查询所有平台（Promise.allSettled，任一失败不影响其他）
 * - 跳转占位平台永远成功返回
 * - 每个适配器内部 try-catch 降级
 */

import { searchKongfz } from '@/lib/platforms/kongfz';
import { searchXianyu } from '@/lib/platforms/xianyu';
import { searchJd } from '@/lib/platforms/jdUnion';
import { searchYoulu } from '@/lib/platforms/youlu';
import { buildJumpResults } from '@/lib/platforms/jump';
import type { PlatformOutcome, PlatformResult } from '@/lib/types';

/** 每个平台的最少结果数 */
const MAX_RESULTS_PER_PLATFORM = 6;

/** 单个 API 平台的安全执行：任何异常 → unavailable 状态 */
async function runPlatform(
  platformId: string,
  platformName: string,
  fn: () => Promise<PlatformResult[]>
): Promise<PlatformOutcome> {
  try {
    const results = await fn();
    if (results.length === 0) {
      // 有接口但无在售结果：状态 jump（提示无货/不可用），不占最低价
      return { platform: platformId, status: 'jump', results: [], reason: '暂无在售' };
    }
    return { platform: platformId, status: 'ok', results: results.slice(0, MAX_RESULTS_PER_PLATFORM) };
  } catch (err) {
    const msg = (err as Error).message;
    console.warn(`[platform:${platformId}] 失败降级: ${msg}`);
    return { platform: platformId, status: 'unavailable', results: [], reason: '暂时不可用' };
  }
}

/**
 * 并发查询所有平台
 * @param params.isbn ISBN-13 唯一键
 * @param params.title 书名（跳转搜索与闲鱼关键词）
 */
export async function searchAllPlatforms(params: {
  isbn: string;
  title: string;
}): Promise<PlatformOutcome[]> {
  // 四个 API 平台并发 + 三个跳转平台占位
  const [kongfz, xianyu, jd, youlu] = await Promise.all([
    runPlatform('kongfz', '孔夫子旧书网', () => searchKongfz(params)),
    runPlatform('xianyu', '闲鱼', () => searchXianyu(params)),
    runPlatform('jd', '京东', () => searchJd(params)),
    runPlatform('youlu', '有路网', () => searchYoulu(params)),
  ]);

  const jumpOutcomes: PlatformOutcome[] = buildJumpResults(params).map((r) => ({
    platform: r.platform,
    status: 'jump' as const,
    results: [r],
  }));

  return [kongfz, xianyu, jd, youlu, ...jumpOutcomes];
}

/** 从所有结果中挑出全网最低价（只在 source=api 的真实报价中挑） */
export function pickCheapest(outcomes: PlatformOutcome[]): PlatformResult | null {
  let cheapest: PlatformResult | null = null;
  for (const o of outcomes) {
    if (o.status !== 'ok') continue;
    for (const r of o.results) {
      if (r.source !== 'api' || r.price <= 0) continue;
      if (!cheapest || r.price < cheapest.price) cheapest = r;
    }
  }
  return cheapest;
}
