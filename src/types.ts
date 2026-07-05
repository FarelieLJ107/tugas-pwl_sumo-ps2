// Shared Types for Sumo PlayStation

export type UserRole = 'pegawai' | 'pemilik';

export interface User {
  id: string;
  username: string;
  nama_lengkap: string;
  role: UserRole;
  created_at: string;
}

export type TVStatus = 'kosong' | 'digunakan' | 'booking' | 'maintenance';

export interface KonsolTV {
  id_tv: number; // 1 to 8
  nama_tv: string; // e.g. "TV-01"
  jenis_konsol: string; // e.g. "PS5", "PS4"
  status: TVStatus;
}

export interface Billing {
  id_billing: string;
  id_tv: number;
  id_user: string;
  waktu_mulai: string; // ISO String or PHP-like timestamp
  waktu_selesai: string | null;
  durasi_menit: number; // 0 if active, or actual
  tarif_per_jam: number;
  total_sewa: number;
  total_menu: number;
  total_bayar: number;
  status: 'aktif' | 'selesai';
}

export interface Inventori {
  id_barang: string;
  nama_barang: string;
  stok_saat_ini: number;
  safety_stock: number;
  harga_grosir: number;
  harga_eceran: number;
  jumlah_terjual: number;
  kategori: string; // e.g. "Makanan", "Minuman", "Camilan"
  status?: string; // "baik" | "perlu perbaikan"
}

export interface LaporanKerusakan {
  id_laporan: string;
  id_rental: string;
  nama_konsol: string;
  nama_pelanggan: string;
  tanggal_laporan: string;
  detail_kerusakan: string;
  denda: number;
  id_barang_inventori?: string;
  nama_barang_inventori?: string;
  status: 'perlu perbaikan' | 'selesai diperbaiki';
}

export interface DetailTransaksiMenu {
  id_detail: string;
  id_billing: string;
  id_barang: string;
  nama_barang: string; // denormalized for easy display
  jumlah: number;
  subtotal: number;
}

export interface Transaksi {
  id_transaksi: string;
  id_billing: string | null;
  id_tv: number | null; // denormalized
  total_sewa: number;
  total_menu: number;
  total_bayar: number;
  metode_pembayaran: 'cash' | 'qris' | 'transfer';
  tanggal_transaksi: string;
  durasi_menit?: number;
}

export interface LogAktivitas {
  id_log: string;
  id_user: string;
  nama_lengkap: string; // denormalized for UI
  aktivitas: string;
  waktu: string;
}

// AHP kriteria weights and options
export interface AHPPriorityItem {
  id_barang: string;
  nama_barang: string;
  stok_saat_ini: number;
  safety_stock: number;
  profit: number; // harga_eceran - harga_grosir
  jumlah_terjual: number;
  score: number;
  rank: number;
  rekomendasi: string;
}

export interface AHPResult {
  matrix: number[][]; // kriteria matrix
  eigenVector: number[]; // weights for [Stok, Safety, Profit, Terjual]
  ci: number;
  cr: number;
  isConsistent: boolean;
  alternatives: AHPPriorityItem[];
  activeCriteria?: string[]; // newly added for dynamic criteria
}

export interface DetailRental {
  nama_pelanggan: string;
  no_whatsapp: string;
  jaminan: string;
  perintilan: string[];
  waktu_mulai: string;
  durasi_hari: number;
  tarif_per_hari: number;
  total_bayar: number;
  kondisi_keluar: string;
  kondisi_kembali?: string;
  denda_kerusakan?: number;
  catatan?: string;
}

export interface RentalKonsol {
  id_rental: string;
  nama_konsol: string;
  jenis_konsol: 'PS3' | 'PS4';
  status: 'tersedia' | 'disewa' | 'maintenance';
  detail?: DetailRental;
}

