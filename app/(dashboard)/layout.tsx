import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Fetch real user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.user.id)
    .single();

  // Fetch restaurant config
  const { data: config } = await supabase
    .from("restaurant_config")
    .select("restaurant_name, logo_url")
    .single();

  const restaurantName = config?.restaurant_name || "KITCHEN LEDGER";
  const logoUrl = config?.logo_url || null;

  // Middleware already handles /waiting-approval redirect, but as double safety:
  if (!profile?.role) {
    // If we're not already on the waiting-approval page (handled by layout below)
    // we let it be, but most dashboard pages are inside this layout.
  }

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50/30">
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar user={profile} restaurantName={restaurantName} logoUrl={logoUrl} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={profile} restaurantName={restaurantName} logoUrl={logoUrl} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
