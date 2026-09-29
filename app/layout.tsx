import type { Metadata, Viewport } from 'next';
import { Noto_Sans_SC, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import './globals.css';

/** 中文字体：Noto Sans SC（Google Fonts，next/font 本地化注入） */
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto',
  display: 'swap',
});

/** 英文字体：Plus Jakarta Sans */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: '比价书 BookPrice — 多平台图书比价',
    template: '%s | 比价书',
  },
  description:
    '输入书名、作者或 ISBN，一次查询孔夫子旧书网、闲鱼、京东、有路网、淘宝、多抓鱼、小谷吖等平台的在售价格，支持历史价格趋势。',
  keywords: ['图书比价', '二手书', 'ISBN 查询', '孔夫子', '多抓鱼', '最低价'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1d1a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${notoSansSC.variable} ${plusJakarta.variable} font-sans`}>
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
