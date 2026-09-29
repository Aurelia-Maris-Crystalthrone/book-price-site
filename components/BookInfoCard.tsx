'use client';

import Image from 'next/image';
import { BookOpen, Printer, CalendarDays, Layers, Barcode } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';
import type { BookMeta } from '@/lib/types';

/**
 * 目标书籍信息卡（结果面板顶部）
 * 封面 + 书名 + 作者 + 出版社 + 版次 + ISBN + 定价
 */
export function BookInfoCard({ book }: { book: BookMeta }) {
  const rows: Array<{ icon: React.ReactNode; label: string; text: string }> = [
    {
      icon: <BookOpen className="h-4 w-4" />,
      label: '作者',
      text: book.authors.join(' / ') || '未知',
    },
    { icon: <Printer className="h-4 w-4" />, label: '出版社', text: book.publisher || '未知' },
    {
      icon: <CalendarDays className="h-4 w-4" />,
      label: '出版时间',
      text: book.publishDate || '未知',
    },
    { icon: <Layers className="h-4 w-4" />, label: '版次', text: book.edition || '未知' },
  ];

  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        {/* 封面 */}
        <div className="relative mx-auto h-[190px] w-[132px] shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm sm:mx-0">
          {book.cover ? (
            <Image
              src={book.cover}
              alt={book.title}
              fill
              sizes="132px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <BookOpen className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* 元信息 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-xl font-bold leading-snug">{book.title}</h2>
            {book.listPrice ? (
              <Badge variant="outline" className="shrink-0 text-sm">
                定价 {formatPrice(book.listPrice)}
              </Badge>
            ) : null}
          </div>

          <div className="grid flex-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {rows.map((r) => (
              <p key={r.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-primary/70">{r.icon}</span>
                <span className="shrink-0 font-medium text-foreground/80">{r.label}</span>
                <span className="min-w-0 truncate">{r.text}</span>
              </p>
            ))}
          </div>

          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Barcode className="h-4 w-4 text-primary/70" />
            ISBN-13：{book.isbn13 || '未知'}
            {book.isbn10 ? <span className="ml-2">ISBN-10：{book.isbn10}</span> : null}
          </p>

          {book.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {book.description}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
