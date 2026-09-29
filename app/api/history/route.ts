/**
 * GET /api/history?isbn=xxx
 * 查询某本书的历史价格记录（时间升序），供趋势图使用
 * 兼容 Vercel 等只读环境：数据库不可用时返回空列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeToIsbn13 } from '@/lib/isbn';
import { getDb } from '@/lib/db';
import type { HistoryResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = (sp.get('isbn') ?? '').trim();
  if (!raw) {
    return NextResponse.json({ error: '缺少 isbn 参数' }, { status: 400 });
  }
  const isbn = normalizeToIsbn13(raw);
  if (!isbn) {
    return NextResponse.json({ error: 'ISBN 格式不正确，请检查' }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = db ? db.listByBook(isbn) : [];
    const payload: HistoryResponse = {
      isbn,
      rows: rows.map((r) => ({
        id: r.id,
        book_key: r.book_key,
        platform: r.platform,
        title: r.title,
        price: r.price,
        condition: r.condition,
        shop: r.shop,
        url: r.url,
        crawl_time: r.crawl_time,
      })),
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[history] 查询失败:', (err as Error).message);
    // 数据库异常不阻塞前端：返回空历史（趋势图显示「暂无历史数据」）
    return NextResponse.json({ isbn, rows: [] } satisfies HistoryResponse);
  }
}
