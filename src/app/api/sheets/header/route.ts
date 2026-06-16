import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheet = searchParams.get('sheet') ?? '';
  try {
    const data = await getSheetData(sheet);
    return NextResponse.json({ header: data[0] ?? [], row2: data[1] ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
