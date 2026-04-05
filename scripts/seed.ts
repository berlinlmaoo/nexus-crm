import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Seed Users
    console.log('👤 Seeding users...');
    const users = [
      { id: uuidv4(), name: 'Budi Santoso', email: 'owner@nexus.com', role: 'OWNER' },
      { id: uuidv4(), name: 'Siti Rahma', email: 'manager@nexus.com', role: 'MANAGER' },
      { id: uuidv4(), name: 'Agus Gudang', email: 'gudang@nexus.com', role: 'STAFF_GUDANG' },
      { id: uuidv4(), name: 'Rina Dapur', email: 'dapur@nexus.com', role: 'STAFF_DAPUR' },
    ];
    
    // Clear existing explicit relationships if needed (Supabase cascade should handle details)
    await supabaseAdmin.from('users').delete().neq('email', 'placeholder');
    await supabaseAdmin.from('products').delete().neq('name', 'placeholder');
    
    const { error: userErr } = await supabaseAdmin.from('users').insert(users);
    if (userErr) throw userErr;
    console.log(`✅ Inserted ${users.length} users`);

    // 2. Parse Excel File
    console.log('📦 Parsing STOK OPNAME.xlsx...');
    const filePath = path.join(process.cwd(), 'STOK OPNAME.xlsx');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at ${filePath}`);
    }

    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

    const products = [];

    // Skip the title rows. Iterate and find rows that look like product entries
    for (const row of rawData) {
      // Row structure based on inspection:
      // index 1: Code (e.g. 'BB-001')
      // index 2: Name (e.g. 'BERAS 10kg') -- wait, some spacing could shift this
      
      // Let's find the string that looks like a code (e.g. BB-...)
      let codeIndex = -1;
      for(let i=0; i<row.length; i++) {
        if (typeof row[i] === 'string' && (row[i].startsWith('BB-') || row[i].startsWith('BS-') || row[i].match(/^[A-Z]{2}-\d{3}/))) {
          codeIndex = i;
          break;
        }
      }

      if (codeIndex !== -1 && row.length >= codeIndex + 4) {
        const code = row[codeIndex];
        const name = row[codeIndex + 1];
        const unit = row[codeIndex + 2] || 'pcs';
        const price = parseFloat(row[codeIndex + 3]) || 0;
        const initialStock = parseFloat(row[codeIndex + 4]) || 0;

        let category = 'Bahan Baku';
        if (code.startsWith('BS')) category = 'Sayur & Bumbu';
        if (code.startsWith('MD')) category = 'Minuman';

        products.push({
          code,
          name: String(name).trim(),
          category,
          unit,
          price,
          current_stock: initialStock, // initial stock as baseline
          min_stock: Math.max(5, Math.floor(initialStock * 0.2)),
          is_active: true
        });
      }
    }

    if (products.length === 0) {
      console.log('⚠️ No products found matching the expected layout. Please check column format.');
    } else {
      console.log(`Found ${products.length} products to insert.`);
      const { error: prodErr } = await supabaseAdmin.from('products').insert(products);
      if (prodErr) throw prodErr;
      console.log(`✅ Inserted ${products.length} products successfully!`);
    }

    // 3. Insert Dummy Config
    console.log('⚙️ Setting up config...');
    await supabaseAdmin.from('restaurant_config').delete().neq('restaurant_name', 'placeholder');
    await supabaseAdmin.from('restaurant_config').insert([{
      restaurant_name: 'NEXUS CRM Culinary',
      office_lat: -6.200000,
      office_lng: 106.816666,
      radius_meter: 150
    }]);

    console.log('🎉 Seeding complete!');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
  }
}

seed();
