import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET() {
  const supabase = createClient();

  try {
    const notifications = [];

    // 1. Fitur Barcode Aktif (Sistem Info - Static)
    notifications.push({
      id: 'sys-info-1',
      title: 'Fitur Barcode Aktif',
      description: 'Sistem PO dan Scanner sudah 100% online.',
      time: 'Baru saja',
      href: '/stock/scan',
      isSystem: true
    });

    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();

    // 2. Attendance Late Check-ins today
    const { count: lateCount, error: errAtt } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'LATE')
      .gte('timestamp', todayStart)
      .lte('timestamp', todayEnd);

    if (!errAtt && lateCount && lateCount > 0) {
      notifications.push({
        id: 'att-late',
        title: 'Keterlambatan Staf',
        description: `Ada ${lateCount} staf yang datang terlambat hari ini.`,
        time: 'Hari ini',
        href: '/attendance?filter=LATE'
      });
    }

    // 3. Purchase Orders Pending
    const { count: poCount, error: errPo } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['PENDING_MANAGER', 'PENDING_OWNER']);

    if (!errPo && poCount && poCount > 0) {
      notifications.push({
        id: 'po-pending',
        title: 'Persetujuan PO',
        description: `Ada ${poCount} permintaan resi PO yang butuh persetujuan Anda.`,
        time: 'Penting',
        href: '/waiting-approval'
      });
    }

    // 4. Critical Stock (Client-Side Comparison since no RPC natively available)
    const { data: products, error: errProd } = await supabase
      .from('products')
      .select('id, name, current_stock, min_stock, is_active')
      .eq('is_active', true);

    if (!errProd && products) {
      const criticalProducts = products.filter(p => p.current_stock <= p.min_stock);
      if (criticalProducts.length > 0) {
        notifications.push({
          id: 'stock-crit',
          title: 'Stok Kritis Gudang',
          description: `Terdapat ${criticalProducts.length} produk di bawah batas aman. Mohon restock.`,
          time: 'Peringatan',
          href: '/stock?filter=KRITIS'
        });
      }
    }

    return NextResponse.json({ data: notifications });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
