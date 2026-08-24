import { NextResponse } from 'next/server';
import { buildFinanceReport, parseFinanceParams } from '@/lib/finance-report';
import { requireRole } from '@/lib/api-auth';

export async function GET(request: Request) {
  // Omzet, margin, dan nilai aset — cuma buat yang megang toko. Halaman /report sendiri emang
  // udah dibatasin di middleware, tapi middleware nggak nyentuh /api sama sekali.
  const { error: authError } = await requireRole(['OWNER', 'MANAGER']);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const { range, granularity } = parseFinanceParams(searchParams);

  const result = await buildFinanceReport(range, granularity);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.report);
}
