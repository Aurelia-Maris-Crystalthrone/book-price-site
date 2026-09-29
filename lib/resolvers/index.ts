/**
 * 解析器统一入口
 * - 候选搜索：Google Books（主）+ Open Library（备），合并去重
 * - ISBN 解析：Google Books（主）+ Open Library（备），按字段完整度择优
 * 注意版本隔离：不同版次/译者/出版社视为不同书籍，绝不合并
 */

import * as google from '@/lib/resolvers/googleBooks';
import * as openlibrary from '@/lib/resolvers/openLibrary';
import type { BookCandidate, BookMeta } from '@/lib/types';

/** BookMeta → 带稳定 rowId 的候选条目 */
function toCandidate(m: BookMeta, index: number): BookCandidate {
  return { ...m, rowId: `${m.isbn13 || 'no-isbn'}-${index}` };
}

/**
 * 书名/作者/版本 → 候选书籍列表（最多 10 条）
 * 策略：Google 主源出结果就直接用；为空或异常时用 OpenLibrary 兜底；两源合并去重
 */
export async function findCandidates(params: {
  title?: string;
  author?: string;
  edition?: string;
  keyword?: string;
}): Promise<BookCandidate[]> {
  const [gList, olList] = await Promise.all([
    google.searchCandidates(params, 10),
    openlibrary.searchCandidates(
      { title: params.title, author: params.author, keyword: params.keyword },
      10
    ),
  ]);

  // 合并去重：ISBN-13 相同视为同一本书（版本隔离要求 publisher/edition 一致才算同一版）
  const seen = new Set<string>();
  const merged: BookMeta[] = [];
  for (const m of [...gList, ...olList]) {
    const key = m.isbn13
      ? `${m.isbn13}|${m.edition}|${m.publisher}`
      : `${m.title}|${m.authors.join(',')}|${m.publisher}|${m.edition}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
  }

  // 无 ISBN 的结果排后面（无法作为唯一键比价）
  merged.sort((a, b) => {
    const aHas = a.isbn13 ? 0 : 1;
    const bHas = b.isbn13 ? 0 : 1;
    return aHas - bHas;
  });

  return merged.slice(0, 10).map(toCandidate);
}

/** 两份元数据按字段完整度择优（ISBN 精确查询时用） */
function pickRicher(a: BookMeta | null, b: BookMeta | null): BookMeta | null {
  if (!a) return b;
  if (!b) return a;
  const score = (m: BookMeta): number =>
    (m.cover ? 2 : 0) +
    (m.publisher ? 1 : 0) +
    (m.authors.length ? 1 : 0) +
    (m.edition ? 1 : 0) +
    (m.publishDate ? 1 : 0) +
    (m.listPrice ? 2 : 0) +
    (m.description ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

/**
 * ISBN → 元数据（双向解析的反向）
 * Google 与 OpenLibrary 并发查询，取字段更全的一份
 */
export async function resolveIsbn(isbn13: string): Promise<BookMeta | null> {
  const [g, ol] = await Promise.all([
    google.resolveByIsbn(isbn13),
    openlibrary.resolveByIsbn(isbn13),
  ]);
  const best = pickRicher(g, ol);
  if (best) {
    // 确保唯一键正确（解析源偶尔不回填 ISBN 字段）
    return { ...best, isbn13 };
  }
  return null;
}

export { extractEdition } from '@/lib/resolvers/googleBooks';
