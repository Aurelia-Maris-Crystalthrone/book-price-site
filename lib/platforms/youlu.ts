/**
 * 有路网适配器：轻量页面抓取 + 库存校验（无官方 API）
 * - 搜索页：https://www.youlu.net/search?keyword=xxx（GET，HTML）
 * - 限频：进程内 1 秒限频（rateLimit）
 * - 仅解析公开搜索结果页的静态 HTML 商品块，不绕过任何登录/验证码/反爬机制
 *   若页面结构变化或被风控拦截，直接降级为「暂时不可用」
 */

import { fetchText, rateLimit } from '@/lib/http';
import type { PlatformResult } from '@/lib/types';

const DEFAULT_SEARCH_URL = 'https://www.youlu.net/search';

/** 有路商品块结构（基于公开搜索页 HTML 的常见结构，容错解析） */
interface YouluItem {
  title: string;
  price: number;
  quality: string;
  shop: string;
  url: string;
}

/**
 * 解析搜索结果 HTML 中的商品列表
 * 有路网搜索页为服务端渲染，商品块特征：
 *   <a ... href="/book/xxxxx.html" ...> 书名 </a> 与邻近的 ¥ 价格
 * 这里用宽松正则提取，页面改版时返回空数组（触发降级提示）
 */
function parseItems(html: string, baseUrl: string): YouluItem[] {
  const items: YouluItem[] = [];
  // 商品链接块：<a href="/book/123.html" title="xxx">
  const linkRe = /<a[^>]+href="(\/(?:book|goods)\/\d+\.html)"[^>]*title="([^"]+)"/g;
  let m: RegExpExecArray | null;
  const found = new Map<string, string>();
  while ((m = linkRe.exec(html)) !== null) {
    const [, href, title] = m;
    if (!found.has(href)) found.set(href, title);
  }
  // 价格块：¥12.00 / ￥12（与书名同一商品卡片内，取 href 之后的第一个价格）
  const cardRe =
    /href="(\/(?:book|goods)\/(\d+)\.html)"[\s\S]{0,600}?[¥￥]\s*([0-9]+(?:\.[0-9]{1,2})?)/g;
  let c: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((c = cardRe.exec(html)) !== null) {
    const href = c[1];
    const price = Number(c[3]);
    if (seen.has(href) || !Number.isFinite(price) || price <= 0) continue;
    seen.add(href);
    const title = found.get(href) ?? '';
    items.push({
      title,
      price,
      quality: '品相八品', // 有路默认二手教材品质
      shop: '有路网',
      url: baseUrl + href,
    });
  }
  return items;
}

export async function searchYoulu(params: {
  isbn: string;
  title: string;
}): Promise<PlatformResult[]> {
  // 1 秒限频，避免给站点造成压力
  await rateLimit('youlu', 1000);

  const searchUrl = process.env.YOULU_SEARCH_URL || DEFAULT_SEARCH_URL;
  const keyword = params.isbn || params.title;
  const html = await fetchText(
    `${searchUrl}?keyword=${encodeURIComponent(keyword)}`
  );

  // 库存校验：页面出现「暂无」「无货」「404」等特征视为无结果
  if (/暂无|没有找到|无货|Not Found/i.test(html.slice(0, 4000)) && !/\/book\/\d+\.html/.test(html)) {
    return [];
  }

  const base = new URL(searchUrl).origin;
  const items = parseItems(html, base);
  const results: PlatformResult[] = items.map((it) => ({
    platform: 'youlu',
    platformName: '有路网',
    title: it.title || params.title,
    price: it.price,
    condition: it.quality,
    shop: it.shop,
    url: it.url,
    source: 'api',
    crawlTime: new Date().toISOString(),
  }));
  results.sort((a, b) => a.price - b.price);
  return results.slice(0, 6);
}
