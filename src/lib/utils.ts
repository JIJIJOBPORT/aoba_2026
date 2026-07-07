import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount) + '円';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '/');
}

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// 支給月を正準形 "YYYY-MM" に正規化する。
// Excel由来の "Apr-26" や日付形式 "2026/05/25" など揺れた入力を吸収する。
// 解釈できない場合は元の文字列をそのまま返す。
export function normalizeMonth(raw: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  // 2026-05 / 2026/05 / 2026-05-25 / 2026/5
  let m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  // Apr-26 / Apr 2026 / April 2026 / May-26
  m = s.match(/^([A-Za-z]{3,})[-\s/]?(\d{2,4})$/);
  if (m) {
    const mm = MONTH_ABBR[m[1].slice(0, 3).toLowerCase()];
    if (mm) {
      const yr = m[2].length === 2 ? `20${m[2]}` : m[2];
      return `${yr}-${mm}`;
    }
  }
  return s;
}

// 支給月を表示用の "2026年5月" 形式に整形する。
// 解釈できない場合は元の文字列をそのまま返す。
export function formatMonth(raw: string): string {
  const ym = normalizeMonth(raw);
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return raw;
  return `${m[1]}年${parseInt(m[2], 10)}月`;
}
