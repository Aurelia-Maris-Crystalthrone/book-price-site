/**
 * 孔夫子旧书网适配器（官方开放 API）
 * 文档：https://open.kongfz.com —— 接口 kfz.item.search
 * 需要环境变量 KONGFZ_KEY / KONGFZ_SECRET（未配置时返回不可用，不影响其他平台）
 * 签名规则（以官方文档为准的通用实现）：
 *   1. 所有业务参数 + key 按 key 升序排序，拼接为 k1=v1&k2=v2（不 encode）
 *   2. 末尾拼接 secret
 *   3. MD5 后转小写
 */

import crypto from 'node:crypto';
import { fetchJson } from '@/lib/http';
import type { PlatformResult } from '@/lib/types';

const DEFAULT_ENDPOINT = 'https://openapi.kongfz.com/kfz_open/api/kfz.item.search';

/** 官方返回结构（仅声明用到的字段） */
interface KongfzResponse {
  error?: number;
  msg?: string;
  status?: number;
  data?: {
    total?: number;
    items?: Array<{
      itemId?: string | number;
      itemTitle?: string;
      title?: string;
      price?: string | number;
      oldPrice?: string | number;
      qualityName?: string;
      quality?: string;
      sellerNick?: string;
      shopName?: string;
      itemUrl?: string;
      url?: string;
      sales?: number;
      zoneName?: string;
    }>;
  };
}

/** 孔夫子签名：参数升序拼接 + secret 后取 MD5 小写 */
function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('md5').update(sorted + secret, 'utf8').digest('hex').toLowerCase();
}

/** 孔夫子的品相描述 → 统一品相标签 */
function mapCondition(quality: string): string {
  if (!quality) return '二手良好';
  if (quality.includes('全新') || quality.includes('未读')) return '全新';
  if (quality.includes('九五') || quality.includes('95')) return '品相九五新';
  if (quality.includes('九') && quality.includes('品')) return '品相九品';
  if (quality.includes('八')) return '品相八品';
  return quality; // 保留原始描述（如「品相八品」「八五品」）
}

export async function searchKongfz(params: {
  isbn: string;
  title: string;
}): Promise<PlatformResult[]> {
  const key = process.env.KONGFZ_KEY;
  const secret = process.env.KONGFZ_SECRET;
  if (!key || !secret) {
    // 未配置密钥：返回空数组 → 前端展示「暂时不可用」占位
    throw new Error('孔夫子旧书网未配置 API 密钥');
  }

  const endpoint = process.env.KONGFZ_ENDPOINT || DEFAULT_ENDPOINT;
  const biz: Record<string, string> = {
    key,
    method: 'kfz.item.search',
    format: 'json',
    v: '1.0',
    keyword: params.isbn, // 优先 ISBN 精确搜（孔夫子商品标题常含 ISBN）
    page_size: '20',
  };
  const url = `${endpoint}?sign=${sign(biz, secret)}&${new URLSearchParams(biz).toString()}`;

  const data = await fetchJson<KongfzResponse>(url);
  if (data.error !== 0 && data.status !== 200) {
    throw new Error(`孔夫子接口错误: ${data.msg ?? data.error ?? '未知'}`);
  }
  const items = data.data?.items ?? [];
  const results: PlatformResult[] = [];
  for (const it of items) {
    const price = Number(it.price ?? it.oldPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    // 品相非全新 → 均为二手回收/旧书，统一在标签中体现
    results.push({
      platform: 'kongfz',
      platformName: '孔夫子旧书网',
      title: it.itemTitle ?? it.title ?? params.title,
      price,
      condition: mapCondition(it.qualityName ?? it.quality ?? ''),
      shop: it.sellerNick ?? it.shopName ?? '孔夫子卖家',
      url: it.itemUrl ?? it.url ?? `https://search.kongfz.com/product/?keyword=${encodeURIComponent(params.isbn)}`,
      source: 'api',
      crawlTime: new Date().toISOString(),
    });
  }
  // 价格升序，取前 6 条足够
  results.sort((a, b) => a.price - b.price);
  return results.slice(0, 6);
}
