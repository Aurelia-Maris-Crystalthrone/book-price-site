/**
 * 京东联盟适配器（jd.union.open.goods.query）
 * 文档：https://union.jd.com/openplatform —— 商品查询接口
 * 签名规则（京东联盟标准）：
 *   1. 业务参数 JSON 序列化后 URL encode → param_json
 *   2. 系统参数按 key 升序拼接（不含 sign）：k1v1k2v2…
 *   3. 拼接 appKey 与 secret，MD5 小写
 * 说明：京东联盟网关统一入口 https://router.jd.com/api
 */

import crypto from 'node:crypto';
import { fetchJson } from '@/lib/http';
import type { PlatformResult } from '@/lib/types';

const GATEWAY = 'https://router.jd.com/api';

interface JdGoodsInfo {
  skuName?: string;
  skuId?: number | string;
  priceInfo?: { price?: number | string; lowestPrice?: number | string };
  price?: number | string;
  imageInfo?: { imageList?: Array<{ url?: string }> };
  shopInfo?: { shopName?: string };
  goodCommentsShare?: number;
  materialUrl?: string;
}

interface JdUnionResponse {
  jd_union_open_goods_query_responce?: {
    result?: string; // 内层又是 JSON 字符串
  };
  error_response?: { code?: number; zh_desc?: string };
}

interface JdQueryResult {
  code?: number;
  message?: string;
  data?: Array<{
    goodsResp?: { goodsList?: JdGoodsInfo[] };
  }>;
}

/** 京东联盟系统参数签名 */
function signSystemParams(sys: Record<string, string>, secret: string): string {
  // 按 key 升序拼接 k+v
  const raw = Object.keys(sys)
    .sort()
    .map((k) => `${k}${sys[k]}`)
    .join('');
  return crypto
    .createHash('md5')
    .update(secret + raw + secret, 'utf8') // 京东联盟：secret + 参数 + secret
    .digest('hex')
    .toLowerCase();
}

/** 京东品相（自营/新品）→ 统一标签 */
function mapCondition(goods: JdGoodsInfo): string {
  // 京东联盟查询默认返回新品自营/POP 商品，视为全新
  const name = goods.skuName ?? '';
  if (name.includes('二手') || name.includes('二手书')) return '二手良好';
  return '全新';
}

export async function searchJd(params: {
  isbn: string;
  title: string;
}): Promise<PlatformResult[]> {
  const appKey = process.env.JD_APP_KEY;
  const appSecret = process.env.JD_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error('京东联盟未配置 API 密钥');
  }

  // 业务参数：关键词搜索（优先 ISBN 精确，其次书名）
  const biz: Record<string, unknown> = {
    goodsReqDTO: {
      keyword: params.title || params.isbn,
      pageIndex: 1,
      pageSize: 20,
    },
  };
  const paramJson = JSON.stringify(biz);

  const t = Date.now().toString();
  const sys: Record<string, string> = {
    app_key: appKey,
    method: 'jd.union.open.goods.query',
    format: 'json',
    v: '1.0',
    sign_method: 'md5',
    timestamp: t,
    param_json: paramJson,
  };
  const sign = signSystemParams(sys, appSecret);
  const url =
    `${GATEWAY}?sign=${sign}` +
    `&app_key=${encodeURIComponent(appKey)}` +
    `&method=${encodeURIComponent(sys.method)}` +
    `&format=json&v=1.0&sign_method=md5` +
    `&timestamp=${encodeURIComponent(t)}` +
    `&param_json=${encodeURIComponent(paramJson)}`;

  const resp = await fetchJson<JdUnionResponse>(url);
  if (resp.error_response) {
    throw new Error(`京东联盟接口错误: ${resp.error_response.zh_desc ?? resp.error_response.code}`);
  }
  const innerRaw = resp.jd_union_open_goods_query_responce?.result;
  if (!innerRaw) throw new Error('京东联盟返回空结果');
  const inner = JSON.parse(innerRaw) as JdQueryResult;
  if (inner.code !== 0) {
    throw new Error(`京东联盟业务错误: ${inner.message ?? inner.code}`);
  }

  const list: JdGoodsInfo[] = inner.data?.[0]?.goodsResp?.goodsList ?? [];
  const results: PlatformResult[] = [];
  for (const g of list) {
    const price = Number(g.priceInfo?.price ?? g.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const skuId = g.skuId ?? '';
    results.push({
      platform: 'jd',
      platformName: '京东',
      title: g.skuName ?? params.title,
      price,
      condition: mapCondition(g),
      shop: g.shopInfo?.shopName ?? '京东',
      url:
        g.materialUrl ??
        (skuId
          ? `https://item.jd.com/${skuId}.html`
          : `https://search.jd.com/Search?keyword=${encodeURIComponent(params.title || params.isbn)}`),
      source: 'api',
      crawlTime: new Date().toISOString(),
    });
  }
  // 京东返回新品为主，按价格升序
  results.sort((a, b) => a.price - b.price);
  return results.slice(0, 6);
}
