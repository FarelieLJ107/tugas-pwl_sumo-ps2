import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, KonsolTV, Billing, Inventori, DetailTransaksiMenu, Transaksi, LogAktivitas, RentalKonsol, LaporanKerusakan } from './src/types';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Ensure database directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_sumops_salt').digest('hex');
}

export interface DbSchema {
  users: User[];
  user_passwords: Record<string, string>; // user id -> hashed password
  konsol_tv: KonsolTV[];
  billing: Billing[];
  inventori: Inventori[];
  detail_transaksi_menu: DetailTransaksiMenu[];
  transaksi: Transaksi[];
  log_aktivitas: LogAktivitas[];
  rental_bawa_pulang: RentalKonsol[];
  laporan_kerusakan?: LaporanKerusakan[];
}

const DEFAULT_USERS: User[] = [
  {
    id: 'user-pemilik',
    username: 'pemilik',
    nama_lengkap: 'Budi Santoso (Pemilik)',
    role: 'pemilik',
    created_at: new Date().toISOString()
  },
  {
    id: 'user-pegawai',
    username: 'pegawai',
    nama_lengkap: 'Agus Pratama (Pegawai)',
    role: 'pegawai',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_PASSWORDS: Record<string, string> = {
  'user-pemilik': hashPassword('pemilik123'),
  'user-pegawai': hashPassword('pegawai123')
};

const DEFAULT_KONSOL: KonsolTV[] = Array.from({ length: 8 }, (_, i) => ({
  id_tv: i + 1,
  nama_tv: `TV-0${i + 1}`,
  jenis_konsol: i < 4 ? 'TV Besar (PS3/PS4)' : 'TV Kecil (PS3/PS4)',
  status: 'kosong'
}));

const DEFAULT_RENTAL_KONSOL: RentalKonsol[] = Array.from({ length: 10 }, (_, i) => ({
  id_rental: `PS3-HP-${String(i + 1).padStart(2, '0')}`,
  nama_konsol: `PS3 Bawa Pulang #${String(i + 1).padStart(2, '0')}`,
  jenis_konsol: 'PS3',
  status: 'tersedia'
}));

const DEFAULT_INVENTORY: Inventori[] = [
  {
    id_barang: 'brg-001',
    nama_barang: 'Teh Manis Hangat',
    stok_saat_ini: 50,
    safety_stock: 10,
    harga_grosir: 1500,
    harga_eceran: 3000,
    jumlah_terjual: 85,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-002',
    nama_barang: 'Es Teh Manis',
    stok_saat_ini: 80,
    safety_stock: 15,
    harga_grosir: 2000,
    harga_eceran: 4000,
    jumlah_terjual: 120,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-003',
    nama_barang: 'Kopi Panas',
    stok_saat_ini: 40,
    safety_stock: 10,
    harga_grosir: 2000,
    harga_eceran: 4000,
    jumlah_terjual: 45,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-004',
    nama_barang: 'Es Kopi',
    stok_saat_ini: 45,
    safety_stock: 10,
    harga_grosir: 2500,
    harga_eceran: 5000,
    jumlah_terjual: 60,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-005',
    nama_barang: 'Capucino Panas',
    stok_saat_ini: 30,
    safety_stock: 10,
    harga_grosir: 2500,
    harga_eceran: 5000,
    jumlah_terjual: 35,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-006',
    nama_barang: 'Es Capucino',
    stok_saat_ini: 40,
    safety_stock: 10,
    harga_grosir: 3000,
    harga_eceran: 6000,
    jumlah_terjual: 50,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-007',
    nama_barang: 'Susu Panas',
    stok_saat_ini: 25,
    safety_stock: 5,
    harga_grosir: 2000,
    harga_eceran: 4000,
    jumlah_terjual: 28,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-008',
    nama_barang: 'Kuku Bima',
    stok_saat_ini: 30,
    safety_stock: 10,
    harga_grosir: 2000,
    harga_eceran: 4000,
    jumlah_terjual: 40,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-009',
    nama_barang: 'Kuku Bima + Susu',
    stok_saat_ini: 25,
    safety_stock: 5,
    harga_grosir: 3000,
    harga_eceran: 6000,
    jumlah_terjual: 35,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-010',
    nama_barang: 'Extra Joss',
    stok_saat_ini: 35,
    safety_stock: 10,
    harga_grosir: 2000,
    harga_eceran: 4000,
    jumlah_terjual: 55,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-011',
    nama_barang: 'Extra Joss + Susu',
    stok_saat_ini: 25,
    safety_stock: 5,
    harga_grosir: 3000,
    harga_eceran: 6000,
    jumlah_terjual: 45,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-012',
    nama_barang: 'Nutrisari',
    stok_saat_ini: 40,
    safety_stock: 10,
    harga_grosir: 2000,
    harga_eceran: 4000,
    jumlah_terjual: 70,
    kategori: 'Minuman',
    status: 'baik'
  },
  {
    id_barang: 'brg-013',
    nama_barang: 'Indomie',
    stok_saat_ini: 50,
    safety_stock: 15,
    harga_grosir: 3000,
    harga_eceran: 6000,
    jumlah_terjual: 110,
    kategori: 'Makanan',
    status: 'baik'
  },
  {
    id_barang: 'brg-014',
    nama_barang: 'Indomie + Telor',
    stok_saat_ini: 35,
    safety_stock: 10,
    harga_grosir: 5000,
    harga_eceran: 10000,
    jumlah_terjual: 95,
    kategori: 'Makanan',
    status: 'baik'
  },
  {
    id_barang: 'brg-015',
    nama_barang: 'Indomie + Nasi',
    stok_saat_ini: 30,
    safety_stock: 10,
    harga_grosir: 5000,
    harga_eceran: 10000,
    jumlah_terjual: 65,
    kategori: 'Makanan',
    status: 'baik'
  },
  {
    id_barang: 'brg-016',
    nama_barang: 'Indomie + Nasi + Telor',
    stok_saat_ini: 25,
    safety_stock: 10,
    harga_grosir: 7000,
    harga_eceran: 14000,
    jumlah_terjual: 80,
    kategori: 'Makanan',
    status: 'baik'
  },
  {
    id_barang: 'eq-001',
    nama_barang: 'Stik PS3 DualShock',
    stok_saat_ini: 20,
    safety_stock: 5,
    harga_grosir: 80000,
    harga_eceran: 150000,
    jumlah_terjual: 0,
    kategori: 'Alat',
    status: 'baik'
  },
  {
    id_barang: 'eq-002',
    nama_barang: 'Stik PS4 DualShock',
    stok_saat_ini: 15,
    safety_stock: 4,
    harga_grosir: 150000,
    harga_eceran: 350000,
    jumlah_terjual: 0,
    kategori: 'Alat',
    status: 'baik'
  },
  {
    id_barang: 'eq-003',
    nama_barang: 'Kabel HDMI Premium',
    stok_saat_ini: 10,
    safety_stock: 3,
    harga_grosir: 15000,
    harga_eceran: 30000,
    jumlah_terjual: 0,
    kategori: 'Alat',
    status: 'baik'
  },
  {
    id_barang: 'eq-004',
    nama_barang: 'Kabel Power Console',
    stok_saat_ini: 10,
    safety_stock: 3,
    harga_grosir: 10000,
    harga_eceran: 25000,
    jumlah_terjual: 0,
    kategori: 'Alat',
    status: 'baik'
  }
];

// Helper to load DB
export function loadDb(): DbSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DbSchema = {
      users: DEFAULT_USERS,
      user_passwords: DEFAULT_PASSWORDS,
      konsol_tv: DEFAULT_KONSOL,
      billing: [],
      inventori: DEFAULT_INVENTORY,
      detail_transaksi_menu: [],
      transaksi: [],
      rental_bawa_pulang: DEFAULT_RENTAL_KONSOL,
      laporan_kerusakan: [],
      log_aktivitas: [
        {
          id_log: 'log-initial',
          id_user: 'system',
          nama_lengkap: 'Sistem Sumo PS',
          aktivitas: 'Database diinisialisasi pertama kali',
          waktu: new Date().toISOString()
        }
      ]
    };
    saveDb(initialDb);
    return initialDb;
  }

  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Upgrade existing inventory items with categories if missing
    let loadedInventory = (parsed.inventori || DEFAULT_INVENTORY).map((item: any) => ({
      ...item,
      status: item.status || 'baik',
      kategori: item.kategori || (
        item.nama_barang.toLowerCase().includes('indomie') || item.nama_barang.toLowerCase().includes('nasi') || item.nama_barang.toLowerCase().includes('goreng') ? 'Makanan' :
        item.nama_barang.toLowerCase().includes('es') || item.nama_barang.toLowerCase().includes('kopi') || item.nama_barang.toLowerCase().includes('teh') || item.nama_barang.toLowerCase().includes('cola') || item.nama_barang.toLowerCase().includes('susu') ? 'Minuman' :
        item.nama_barang.toLowerCase().includes('stik') || item.nama_barang.toLowerCase().includes('kabel') ? 'Alat' :
        'Camilan'
      )
    }));

    // Auto-migrate to new food & drink menu items if old items are detected or new items are missing
    const hasOldMenu = loadedInventory.some((item: any) => 
      item.nama_barang === 'Teh Botol Sosro' || 
      item.nama_barang === 'Kopi Susu Es' || 
      item.nama_barang === 'Indomie Goreng + Telur' ||
      item.nama_barang === 'Kentang Goreng Sumo'
    );
    const hasNewMenu = loadedInventory.some((item: any) => 
      item.nama_barang === 'Teh Manis Hangat' || 
      item.nama_barang === 'Kuku Bima'
    );
    
    if (hasOldMenu || !hasNewMenu) {
      const equipmentItems = loadedInventory.filter((item: any) => item.id_barang.startsWith('eq-'));
      const newFoodDrinkItems = DEFAULT_INVENTORY.filter((item: any) => !item.id_barang.startsWith('eq-'));
      loadedInventory = [...newFoodDrinkItems, ...equipmentItems];
      
      parsed.inventori = loadedInventory;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch (writeErr) {
        console.error('Failed to write database file during migration:', writeErr);
      }
    }

    return {
      users: parsed.users || DEFAULT_USERS,
      user_passwords: parsed.user_passwords || DEFAULT_PASSWORDS,
      konsol_tv: parsed.konsol_tv || DEFAULT_KONSOL,
      billing: parsed.billing || [],
      inventori: loadedInventory,
      detail_transaksi_menu: parsed.detail_transaksi_menu || [],
      transaksi: parsed.transaksi || [],
      log_aktivitas: parsed.log_aktivitas || [],
      rental_bawa_pulang: parsed.rental_bawa_pulang || DEFAULT_RENTAL_KONSOL,
      laporan_kerusakan: parsed.laporan_kerusakan || []
    };
  } catch (e) {
    console.error('Failed to parse database file, restoring defaults:', e);
    return {
      users: DEFAULT_USERS,
      user_passwords: DEFAULT_PASSWORDS,
      konsol_tv: DEFAULT_KONSOL,
      billing: [],
      inventori: DEFAULT_INVENTORY,
      detail_transaksi_menu: [],
      transaksi: [],
      log_aktivitas: [],
      rental_bawa_pulang: DEFAULT_RENTAL_KONSOL,
      laporan_kerusakan: []
    };
  }
}

// Helper to save DB
export function saveDb(db: DbSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write database file:', e);
  }
}

// Add log helper
export function writeLog(userId: string, activity: string): void {
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  const newLog: LogAktivitas = {
    id_log: 'log-' + Math.random().toString(36).substring(2, 11),
    id_user: userId,
    nama_lengkap: user ? user.nama_lengkap : 'System',
    aktivitas: activity,
    waktu: new Date().toISOString()
  };
  db.log_aktivitas.unshift(newLog); // Add to beginning of array
  saveDb(db);
}
