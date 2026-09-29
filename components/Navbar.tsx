'use client';

import Link from 'next/link';
import { BookOpenText, Github } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * 顶部导航栏
 * 左：Logo（书本图标 +「比价书」） 右：GitHub 链接 + 暗色切换
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* 左侧 Logo */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="比价书首页">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BookOpenText className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight">比价书</span>
            <span className="text-[11px] text-muted-foreground">BookPrice · 多平台图书比价</span>
          </span>
        </Link>

        {/* 右侧操作 */}
        <div className="flex items-center gap-1">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="GitHub 仓库"
            title="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
