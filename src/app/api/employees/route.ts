import { NextResponse } from 'next/server';
import { getAllEmployees } from '@/lib/employees';

export async function GET() {
  try {
    const employees = await getAllEmployees();
    return NextResponse.json({ success: true, data: employees });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
