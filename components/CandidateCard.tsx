'use client';

import Image from 'next/image';
import { CheckCircle2, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BookCandidate } from '@/lib/types';

/**
 * 候选书籍卡片（单张）
 * 封面 + 书名 + 作者 + 出版社 + 版次 + ISBN-13 + 「选择这本书」按钮
 * 支持 active 状态（键盘上下键导航高亮）
 */

interface CandidateCardProps {
  candidate: BookCandidate;
  active: boolean;
  onSelect: (c: BookCandidate) => void;
}

export function CandidateCard({ candidate, active, onSelect }: CandidateCardProps) {
  const author = candidate.authors.length > 0 ? candidate.authors.join(' / ') : '未知作者';
  const publisher = candidate.publisher || '未知出版社';

  return (
    <Card
      className={cn(
        'group flex h-full cursor-pointer flex-col gap-3 p-4 hover:shadow-md',
        active && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect(candidate)}
      data-active={active}
    >
      {/* 封面 + 信息 */}
      <div className="flex gap-3">
        <div className="relative h-[120px] w-[84px] shrink-0 overflow-hidden rounded-lg bg-muted">
          {candidate.cover ? (
            <Image
              src={candidate.cover}
              alt={candidate.title}
              fill
              sizes="84px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <BookOpen className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{candidate.title}</h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">{author}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {publisher}
            {candidate.publishDate ? ` · ${candidate.publishDate}` : ''}
          </p>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {candidate.edition ? <Badge variant="secondary">{candidate.edition}</Badge> : null}
            {candidate.isbn13 ? (
              <Badge variant="muted" className="font-mono text-[10px]">
                ISBN {candidate.isbn13}
              </Badge>
            ) : (
              <Badge variant="muted" className="text-[10px]">
                无 ISBN
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 选择按钮 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(candidate);
        }}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <CheckCircle2 className="h-4 w-4" />
        选择这本书
      </button>
    </Card>
  );
}
