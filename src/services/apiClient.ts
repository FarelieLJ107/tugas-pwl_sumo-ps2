// src/services/apiClient.ts
// -----------------------------------------------------------------------------
// PILAR 2: ENDPOINT & API CONTRACT (Slide 03 - Endpoint sebagai Kontrak)
// -----------------------------------------------------------------------------
// File ini mengisolasi seluruh interaksi HTTP/REST ke server. 
// Komponen UI (UI Templates) tidak boleh memanggil `fetch` secara langsung.
// Dengan cara ini, kontrak data bersifat konsisten, tersentralisasi, dan mudah direvisi.

import { 
  User, 
  KonsolTV, 
  Inventori, 
  Transaksi, 
  RentalKonsol, 
  LaporanKerusakan, 
  LogAktivitas,
  AHPResult
} from '../types';

// Helper to construct authorization header
const authHeader = (token: string) => ({
  'Authorization': `Bearer ${token}`
});

// Helper to check response and handle errors consistently
const handleResponse = async (res: Response) => {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Terjadi kesalahan sistem.');
  }
  return data;
};

export const apiClient = {
  // ==========================================
  // MODULE 1: AUTHENTICATION CONTRACT
  // ==========================================
  auth: {
    /**
     * Endpoint: POST /api/auth/login
     * Deskripsi: Masuk ke sistem menggunakan username dan password.
     */
    async login(username: string, password: string): Promise<{ token: string; user: User }> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/auth/logout
     * Deskripsi: Keluar dari sistem dan mencabut sesi token aktif.
     */
    async logout(token: string): Promise<{ success: boolean }> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/auth/logout', {
        method: 'POST',
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: GET /api/auth/me
     * Deskripsi: Mengambil informasi detail dari user yang sedang login.
     */
    async getMe(token: string): Promise<{ user: User }> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/auth/me', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 2: TV SESSION & BILLING CONTRACT
  // ==========================================
  tvs: {
    /**
     * Endpoint: GET /api/konsol
     * Deskripsi: Mengambil seluruh status TV PlayStation beserta billing yang aktif (jika ada).
     */
    async getAll(token: string): Promise<(KonsolTV & { activeBilling?: any })[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/konsol', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/konsol/:id/start
     * Deskripsi: Memulai sesi billing baru pada PlayStation TV tertentu.
     */
    async start(
      token: string, 
      id_tv: number, 
      options: { jenis_billing: 'open' | 'package'; durasi_menit: number; tarif_per_jam: number }
    ): Promise<{ success: boolean; billing: any }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/konsol/${id_tv}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(options)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/konsol/:id/stop
     * Deskripsi: Menyelesaikan sesi billing aktif pada PlayStation TV dan mencatat transaksi pembayaran.
     */
    async stop(
      token: string, 
      id_tv: number, 
      paymentMethod: 'cash' | 'qris' | 'transfer'
    ): Promise<{ success: boolean; transaksi: Transaksi; billing: any; menu_items: any[]; kasir: string }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/konsol/${id_tv}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify({ metode_pembayaran: paymentMethod })
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/konsol/:id/booking / /maintenance / /free
     * Deskripsi: Mengubah status TV secara manual (booking, maintenance, atau kosong).
     */
    async setStatus(token: string, id_tv: number, status: 'booking' | 'maintenance' | 'free'): Promise<{ success: boolean }> {
      let url = `/api/konsol/${id_tv}/free`;
      if (status === 'booking') url = `/api/konsol/${id_tv}/booking`;
      else if (status === 'maintenance') url = `/api/konsol/${id_tv}/maintenance`;

      const res = await fetch(url, {
        method: 'POST',
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 3: MENU & ORDERING CONTRACT
  // ==========================================
  menu: {
    /**
     * Endpoint: POST /api/menu/order
     * Deskripsi: Melakukan pemesanan menu tambahan (makanan/minuman) pada sesi billing aktif tertentu.
     */
    async order(token: string, id_billing: string, items: { id_barang: string; jumlah: number }[]): Promise<{ success: boolean }> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/menu/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify({ id_billing, items })
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 4: INVENTORY CONTRACT
  // ==========================================
  inventori: {
    /**
     * Endpoint: GET /api/inventori
     * Deskripsi: Mengambil seluruh data barang/menu dalam inventori.
     */
    async getAll(token: string): Promise<Inventori[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/inventori', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/inventori
     * Deskripsi: Menambahkan item barang/menu baru ke inventori.
     */
    async add(token: string, payload: Omit<Inventori, 'id_barang' | 'jumlah_terjual'>): Promise<{ success: boolean; item: Inventori }> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/inventori', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: PUT /api/inventori/:id
     * Deskripsi: Memperbarui data item inventori tertentu berdasarkan id.
     */
    async update(token: string, id_barang: string, payload: Partial<Inventori>): Promise<{ success: boolean; item: Inventori }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/inventori/${id_barang}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: DELETE /api/inventori/:id
     * Deskripsi: Menghapus item inventori berdasarkan id.
     */
    async remove(token: string, id_barang: string): Promise<{ success: boolean }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/inventori/${id_barang}`, {
        method: 'DELETE',
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 5: USER MANAGEMENT CONTRACT
  // ==========================================
  users: {
    /**
     * Endpoint: GET /api/users
     * Deskripsi: Mengambil daftar seluruh user (pemilik & pegawai) di sistem.
     */
    async getAll(token: string): Promise<User[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/users', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/users
     * Deskripsi: Menambahkan pengguna/pegawai baru ke dalam sistem.
     */
    async add(token: string, payload: any): Promise<{ success: boolean; user: User }> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: PUT /api/users/:id
     * Deskripsi: Memperbarui data pengguna tertentu berdasarkan id.
     */
    async update(token: string, id: string, payload: any): Promise<{ success: boolean; user: User }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: DELETE /api/users/:id
     * Deskripsi: Menghapus pengguna tertentu berdasarkan id.
     */
    async remove(token: string, id: string): Promise<{ success: boolean }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/users/${id}`, {
        method: 'DELETE',
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 6: LOGS & AUDIT TRAIL CONTRACT
  // ==========================================
  logs: {
    /**
     * Endpoint: GET /api/logs
     * Deskripsi: Mengambil seluruh rekaman log aktivitas admin/kasir secara real-time.
     */
    async getAll(token: string): Promise<LogAktivitas[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/logs', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 7: TRANSACTION ARCHIVE CONTRACT
  // ==========================================
  transaksi: {
    /**
     * Endpoint: GET /api/transaksi
     * Deskripsi: Mengambil seluruh riwayat transaksi sewa PS, order menu, dan denda rental.
     */
    async getAll(token: string): Promise<Transaksi[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/transaksi', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: GET /api/billing/:id
     * Deskripsi: Mengambil log detail billing spesifik (untuk keperluan struk / nota historis).
     */
    async getBilling(token: string, id_billing: string): Promise<any> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/billing/${id_billing}`, {
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 8: AHP SYSTEM CONTRACT
  // ==========================================
  ahp: {
    /**
     * Endpoint: POST /api/ahp
     * Deskripsi: Mengirim kriteria matriks perbandingan berpasangan dan mendapatkan kalkulasi prioritas rekomendasi barang (AHP).
     */
    async calculate(token: string, matrix: number[][]): Promise<AHPResult> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/ahp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify({ matrix })
      });
      return handleResponse(res);
    }
  },

  // ==========================================
  // MODULE 9: RENTAL BAWA PULANG CONTRACT
  // ==========================================
  rental: {
    /**
     * Endpoint: GET /api/rental-bawa-pulang
     * Deskripsi: Mengambil status unit konsol yang disewa bawa pulang beserta detail penyewanya.
     */
    async getAll(token: string): Promise<RentalKonsol[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/rental-bawa-pulang', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: GET /api/laporan-kerusakan
     * Deskripsi: Mengambil laporan kerusakan otomatis akibat denda rental bawa pulang.
     */
    async getLaporanKerusakan(token: string): Promise<LaporanKerusakan[]> {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/laporan-kerusakan', {
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/laporan-kerusakan/:id/resolve
     * Deskripsi: Menyelesaikan status laporan kerusakan (merubah status menjadi selesai diperbaiki).
     */
    async resolveLaporanKerusakan(token: string, id: string): Promise<{ success: boolean }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/laporan-kerusakan/${id}/resolve`, {
        method: 'POST',
        headers: authHeader(token)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/rental-bawa-pulang/:id/rent
     * Deskripsi: Memulai penyewaan bawa pulang (booking out) untuk unit konsol tertentu.
     */
    async rent(token: string, id_rental: string, payload: any): Promise<{ success: boolean }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/rental-bawa-pulang/${id_rental}/rent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/rental-bawa-pulang/:id/return
     * Deskripsi: Mengembalikan konsol sewa bawa pulang (check-in) beserta kalkulasi denda kerusakan & denda keterlambatan.
     */
    async returnKonsol(token: string, id_rental: string, payload: any): Promise<{ success: boolean }> {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/rental-bawa-pulang/${id_rental}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token)
        },
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },

    /**
     * Endpoint: POST /api/rental-bawa-pulang/:id/:status (maintenance / free)
     * Deskripsi: Mengubah status operasional konsol rental bawa pulang secara manual.
     */
    async setStatus(token: string, id_rental: string, status: 'maintenance' | 'free'): Promise<{ success: boolean }> {
      const endpoint = status === 'maintenance' ? 'maintenance' : 'free';
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/rental-bawa-pulang/${id_rental}/${endpoint}`, {
        method: 'POST',
        headers: authHeader(token)
      });
      return handleResponse(res);
    }
  }
};
