import { NextResponse } from 'next/server';
import { calculateDeductions } from '@/lib/insurance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { grossPay, paymentMonth, dependents, birthDate, residentTax } = body;

    if (!grossPay || !paymentMonth || !birthDate) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const result = await calculateDeductions({
      grossPay: Number(grossPay),
      paymentMonth,
      dependents: Number(dependents) || 0,
      birthDate,
      residentTax: Number(residentTax) || 0,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
