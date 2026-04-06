import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

import { createClient } from '@supabase/supabase-js';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: config } = await supabaseAdmin
      .from('restaurant_config')
      .select('restaurant_name, logo_url')
      .maybeSingle();

    const title = config?.restaurant_name 
      ? `${config.restaurant_name.toUpperCase()} | NEXUS CRM` 
      : "NEXUS CRM | Kitchen Ledger";
      
    return {
      title,
      description: "Restaurant Stock Opname Web App",
      icons: {
        icon: config?.logo_url || '/favicon.ico'
      }
    };
  } catch (error) {
    return {
      title: "NEXUS CRM | Kitchen Ledger",
      description: "Restaurant Stock Opname Web App",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
