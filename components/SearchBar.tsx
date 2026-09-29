'use client';

import * as React from 'react';
import { Search, Loader2, X, BookOpen, User, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { looksLikeIsbn } from '@/lib/isbn';
import type { SuggestItem } from '@/lib/types';

/**
 * 智能搜索框
 * - 单输入框自动识别 ISBN / 书名 / 作者
 * - 输入 ≥2 字符后触发自动补全（防抖 350ms，AbortController 取消旧请求）
 * - 补全下拉支持键盘 ↑↓ 选择、Enter 确认、Esc 关闭
 * - 搜索按钮带 loading 动画
 */

interface SearchBarProps {
  onSearch: (q: string) => void;
  loading: boolean;
  placeholder?: string;
}

export function SearchBar({ onSearch, loading, placeholder }: SearchBarProps) {
  const [value, setValue] = React.useState('');
  const [suggests, setSuggests] = React.useState<SuggestItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // 防抖请求补全（≥2 字符触发）
  React.useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || looksLikeIsbn(q)) {
      setSuggests([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: SuggestItem[] };
        setSuggests(data.items ?? []);
        setOpen((data.items ?? []).length > 0);
        setActiveIndex(-1);
      } catch {
        /* 取消或网络错误：静默 */
      } finally {
        setSuggestLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // 键盘交互：↑↓ 选建议，Enter 搜索或确认，Esc 关闭
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggests.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % suggests.length);
    } else if (e.key === 'ArrowUp' && suggests.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggests.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && suggests[activeIndex]) {
        e.preventDefault();
        pickSuggest(suggests[activeIndex]);
      } else {
        submit();
      }
    }
  }

  function pickSuggest(item: SuggestItem) {
    setValue(item.value);
    setOpen(false);
    onSearch(item.value);
  }

  function submit() {
    const q = value.trim();
    if (!q || loading) return;
    setOpen(false);
    onSearch(q);
  }

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? '输入书名 / 作者 / ISBN，如：算法导论 或 9787111407010'}
            className="h-14 rounded-xl pl-11 pr-10 text-base shadow-sm"
            aria-label="搜索书籍"
            autoComplete="off"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue('');
                setSuggests([]);
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="清空输入"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Button
          size="lg"
          className="h-14 rounded-xl px-7 text-base"
          onClick={submit}
          disabled={loading || !value.trim()}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          {loading ? '查询中…' : '搜价格'}
        </Button>
      </div>

      {/* 自动补全下拉 */}
      {open && (suggests.length > 0 || suggestLoading) ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
          {suggestLoading && suggests.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在获取建议…
            </div>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-auto py-1">
              {suggests.map((s, i) => (
                <li key={`${s.kind}-${s.value}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pickSuggest(s)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      i === activeIndex ? 'bg-accent text-accent-foreground' : ''
                    )}
                  >
                    {s.kind === 'book' ? (
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                    ) : s.kind === 'author' ? (
                      <User className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.label}</span>
                      {s.detail ? (
                        <span className="block truncate text-xs text-muted-foreground">{s.detail}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
