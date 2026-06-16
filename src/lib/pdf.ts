'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePayrollPdf(elementId: string): Promise<Blob> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('印刷対象の要素が見つかりません');

  // Tailwind v4がlab()/oklch()を使うためhtml2canvasが解析できない
  // oncloneでブラウザのcomputed style（rgb形式）をインライン化して回避
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    onclone: (_doc, clonedEl) => {
      clonedEl.querySelectorAll('*').forEach((child) => {
        const computed = window.getComputedStyle(child as Element);
        const el = child as HTMLElement;
        el.style.color = computed.color;
        el.style.backgroundColor = computed.backgroundColor;
        el.style.borderColor = computed.borderColor;
        el.style.borderTopColor = computed.borderTopColor;
        el.style.borderBottomColor = computed.borderBottomColor;
        el.style.borderLeftColor = computed.borderLeftColor;
        el.style.borderRightColor = computed.borderRightColor;
      });
    },
  });

  const imgData = canvas.toDataURL('image/png');
  // A5横（210mm × 148mm）
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();   // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 148mm
  const margin = 8;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pageHeight - margin * 2));

  return pdf.output('blob');
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
