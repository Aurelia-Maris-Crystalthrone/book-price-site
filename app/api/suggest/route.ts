/**
 * GET /api/suggest?q=...
 * 搜索框自动补全（输入 ≥2 字符触发，前端已防抖 350ms）
 * 返回：书籍（含 ISBN/定价摘要）、作者、出版社三类建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { findCandidates } from '@/lib/resolvers';
import type { SuggestItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ items: [] satisfies SuggestItem[] });
  }

  try {
    const candidates = await findCandidates({ keyword: q });
    const items: SuggestItem[] = [];
    const seenAuthors = new Set<string>();
    const seenPublishers = new Set<string>();

    // 1) 书籍建议（最多 6 条）
    for (const c of candidates.slice(0, 6)) {
      const parts: string[] = [];
      if (c.authors.length > 0) parts.push(c.authors.slice(0, 2).join(' / '));
      if (c.publisher) parts.push(c.publisher);
      if (c.edition) parts.push(c.edition);
      items.push({
        kind: 'book',
        label: c.title,
        value: c.title, // 补全提交书名（ISBN 查询由用户在结果中确认）
        detail: parts.join(' · ') || (c.isbn13 ? `ISBN ${c.isbn13}` : ''),
      });
    }

    // 2) 作者建议（去重，最多 3 条）
    for (const c of candidates) {
      for (const a of c.authors.slice(0, 1)) {
        if (a && !seenAuthors.has(a) && seenAuthors.size < 3) {
          seenAuthors.add(a);
          items.push({
            kind: 'author',
            label: a,
            value: a,
            detail: '按作者搜索',
          });
        }
      }
    }

    // 3) 出版社建议（去重，最多 2 条）
    for (const c of candidates) {
      if (c.publisher && !seenPublishers.has(c.publisher) && seenPublishers.size < 2) {
        seenPublishers.add(c.publisher);
        items.push({
          kind: 'publisher',
          label: c.publisher,
          value: c.publisher,
          detail: '按出版社搜索',
        });
      }
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.warn('[suggest] 失败:', (err as Error).message);
    return NextResponse.json({ items: [] satisfies SuggestItem[] });
  }
}
