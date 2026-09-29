/**
 * 闲鱼适配器（通过 onebound 聚合 API 的 goodfish 渠道）
 * 文档：https://open.onebound.cn —— 接口 goodfish.item_search
 * 需要环境变量 ONEBOUND_KEY / ONEBOUND_SECRET
 * 通用签名：key+secret 拼接后 MD5 小写（onebound 标准 practice）
 */

import crypto from 'node:crypto';
import { fetchJson } from '@/lib/http';
import type { PlatformResult } from '@/lib/types';

const DEFAULT_ENDPOINT = 'https://api.onebound.cn/onebound/goodfish/item_search';

interface OneboundItem {
  num_iid?: string | number;
  title?: string;
  price?: string | number;
  orginal_price?: string | number;
  nick?: string;
  seller_nick?: string;
  pic_url?: string;
  detail_url?: string;
  item_url?: string;
  quality?: string;
  fish_qi?: string; // 闲鱼「鱼期」/成色字段
}

interface OneboundResponse {
  error?: string;
  reason?: string;
  items?: {
    item?: OneboundItem[];
    pagecount?: number;
    total_results?: number;
  };
}

/** 闲鱼成色 → 统一品相标签 */
function mapCondition(raw: string): string {
  if (!raw) return '二手良好';
  if (raw.includes('全新') || raw.includes('未拆封') || raw.includes('99新')) return '全新';
  if (raw.includes('95') || raw.includes('九五')) return '品相九五新';
  if (raw.includes('9成') || raw.includes('九成')) return '品相九品';
  if (raw.includes('8成') || raw.includes('八成')) return '品相八品';
  return raw;
}

export async function searchXianyu(params: {
  isbn: string;
  title: string;
}): Promise<PlatformResult[]> {
  const key = process.env.ONEBOUND_KEY;
  const secret = process.env.ONEBOUND_SECRET;
  if (!key || !secret) {
    throw new Error('闲鱼渠道（onebound）未配置 API 密钥');
  }

  const endpoint = process.env.ONEBOUND_ENDPOINT || DEFAULT_ENDPOINT;
  const signStr = `${key}${secret}`.toLowerCase();
  const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
  // 搜索词优先书名（闲鱼商品标题很少带 ISBN）
  const q = params.title || params.isbn;
  const url =
    `${endpoint}?key=${encodeURIComponent(key)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&sign=${sign}` +
    `&q=${encodeURIComponent(q)}` +
    `&page_size=20`;

  const data = await fetchJson<OneboundResponse>(url);
  if (data.error && data.error !== '') {
    throw new Error(`闲鱼(onebound)接口错误: ${data.reason ?? data.error}`);
  }
  const items = data.items?.item ?? [];
  const results: PlatformResult[] = [];
  for (const it of items) {
    const price = Number(it.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    results.push({
      platform: 'xianyu',
      platformName: '闲鱼',
      title: it.title ?? params.title,
      price,
      condition: mapCondition(it.quality ?? it.fish_qi ?? ''),
      shop: it.nick ?? it.seller_nick ?? '闲鱼卖家',
      url:
        it.detail_url ??
        it.item_url ??
        `https://www.goofish.com/search?q=${encodeURIComponent(q)}`,
      source: 'api',
      crawlTime: new Date().toISOString(),
    });
  }
  results.sort((a, b) => a.price - b.price);
  return results.slice(0, 6);
}
