/**
 * GET  /api/search?isbn=xxx[&title=xxx]
 * POST /api/search  body: { isbn, title? }
 * 并发查询所有平台 → 汇总排序 → 返回最低价与各平台结果
 * 成功查询（POST 或 GET with write=1）自动写入 price_history
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidIsbn, normalizeToIsbn13 } from '@/lib/isbn';
import { searchAllPlatforms, pickCheapest } from '@/lib/platforms';
import { getDb } from '@/lib/db';
import type { SearchResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 执行搜索并组装响应（GET/POST 共用） */
async function doSearch(isbnRaw: string, title: string, writeHistory: boolean): Promise<NextResponse> {
  // ISBN 校验（支持 ISBN-10 自动转 13）
  const isbn = normalizeToIsbn13(isbnRaw);
  if (!isbn) {
    return NextResponse.json({ error: 'ISBN 格式不正确，请检查' }, { status: 400 });
  }

  const startedAt = Date.now();
  const outcomes = await searchAllPlatforms({ isbn, title });
  const elapsedMs = Date.now() - startedAt;
  const cheapest = pickCheapest(outcomes);
  const crawledAt = new Date().toISOString();

  // 写入历史价格（仅真实 API 报价；失败不影响响应）
  if (writeHistory) {
    try {
      const db = getDb();
      if (db) {
        const rows = outcomes.flatMap((o) =>
          o.status === 'ok'
            ? o.results
                .filter((r) => r.source === 'api' && r.price > 0)
                .map((r) => ({
                  book_key: isbn,
                  platform: r.platform,
                  title: r.title,
                  price: r.price,
                  condition: r.condition,
                  shop: r.shop,
                  url: r.url,
                  crawl_time: crawledAt,
                }))
            : []
        );
        db.insertMany(rows);
      }
    } catch (err) {
      console.warn('[search] 历史价格写入失败:', (err as Error).message);
    }
  }

  const payload: SearchResponse = {
    isbn,
    title,
    cheapest,
    outcomes,
    elapsedMs,
    crawledAt,
  };
  return NextResponse.json(payload);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const isbn = (sp.get('isbn') ?? '').trim();
  const title = (sp.get('title') ?? '').trim();
  const write = sp.get('write') === '1'; // 显式要求写入历史（默认 GET 只读）
  if (!isbn) {
    return NextResponse.json({ error: '缺少 isbn 参数' }, { status: 400 });
  }
  return doSearch(isbn, title, write);
}

export async function POST(req: NextRequest) {
  let body: { isbn?: string; title?: string };
  try {
    body = (await req.json()) as { isbn?: string; title?: string };
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }
  const isbn = (body.isbn ?? '').trim();
  const title = (body.title ?? '').trim();
  if (!isbn) {
    return NextResponse.json({ error: '缺少 isbn 参数' }, { status: 400 });
  }
  // POST 默认写入历史价格
  return doSearch(isbn, title, true);
}
