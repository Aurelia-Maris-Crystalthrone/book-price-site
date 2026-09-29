/**
 * GET /api/resolve?q=...
 * 智能识别输入：
 * - 纯 10/13 位数字（含合法 ISBN 校验位）→ ISBN 精确查询，返回 book 元数据
 * - 其他 → 书名/作者模糊搜索，返回 candidates 候选列表（最多 10 条）
 * 支持高级组合：/api/resolve?title=xx&author=xx&edition=xx
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeToIsbn13, cleanIsbn } from '@/lib/isbn';
import { findCandidates, resolveIsbn } from '@/lib/resolvers';
import type { ResolveResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const title = (sp.get('title') ?? '').trim();
  const author = (sp.get('author') ?? '').trim();
  const edition = (sp.get('edition') ?? '').trim();

  // ---------- 高级组合查询 ----------
  if (title || author || edition) {
    if (looksLikeIsbnInput(title)) {
      // 高级模式里 title 位置输入了 ISBN → 直接精确解析
      const isbn = normalizeToIsbn13(title);
      const book = await resolveIsbn(isbn);
      return NextResponse.json({
        inputType: 'isbn',
        book,
        candidates: [],
        source: book ? book.source : 'none',
      } satisfies ResolveResponse);
    }
    const candidates = await findCandidates({ title, author, edition });
    return NextResponse.json({
      inputType: 'text',
      book: null,
      candidates,
      source: 'google+openlibrary',
    } satisfies ResolveResponse);
  }

  // ---------- 智能单输入 ----------
  if (!q) {
    return NextResponse.json(
      { error: '请输入书名、作者或 ISBN' },
      { status: 400 }
    );
  }

  // 智能识别：纯数字 10/13 位 → ISBN
  if (looksLikeIsbnInput(q)) {
    const isbn13 = normalizeToIsbn13(q);
    if (!isbn13) {
      // 形似 ISBN 但校验位错误 → 明确提示
      return NextResponse.json(
        { error: 'ISBN 格式不正确，请检查' },
        { status: 400 }
      );
    }
    const book = await resolveIsbn(isbn13);
    return NextResponse.json({
      inputType: 'isbn',
      book,
      candidates: book ? [] : [],
      source: book ? book.source : 'none',
    } satisfies ResolveResponse);
  }

  // 书名/作者模糊搜索
  const candidates = await findCandidates({ keyword: q });
  return NextResponse.json({
    inputType: 'text',
    book: null,
    candidates,
    source: 'google+openlibrary',
  } satisfies ResolveResponse);
}

/** 输入是否形似 ISBN（含校验位验证在 normalizeToIsbn13 中做） */
function looksLikeIsbnInput(s: string): boolean {
  const c = cleanIsbn(s);
  return /^\d{10}$/.test(c) || /^\d{13}$/.test(c);
}
