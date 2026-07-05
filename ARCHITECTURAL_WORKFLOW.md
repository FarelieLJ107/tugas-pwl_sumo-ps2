# 🎮 Sumo PlayStation - Panduan Arsitektur & Alur Kerja (Workflow)

Dokumen ini menjelaskan bagaimana struktur kode dan alur kerja (workflow) pengembangan aplikasi **Sumo PlayStation** dirancang secara rapi berdasarkan prinsip pembagian konteks terstruktur (**Separation of Concerns**) sesuai slide panduan yang diberikan.

Dengan membagi sistem menjadi bagian-bagian yang kecil, modular, dan spesifik, aplikasi kita menjadi **jauh lebih rapi, mudah direvisi, scalable, dan terbebas dari kekacauan kode (spaghetti code).**

---

## 📐 4 Pilar Utama Arsitektur Kita (Slide 01 & Slide 06)

Aplikasi Sumo PlayStation dibagi ke dalam **4 Pilar Konteks** yang mandiri:

```
┌────────────────────────────────────────────────────────┐
│                   1. BACKEND (Database & Bisnis)       │
│                      [server-db.ts, server.ts]         │
└───────────────────────────┬────────────────────────────┘
                            │ (Menyediakan Data & Validasi)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   2. ENDPOINT (Kontrak API)            │
│                      [src/services/apiClient.ts]       │
└───────────────────────────┬────────────────────────────┘
                            │ (Menjamin Konsistensi Data)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   3. FRONTEND LOGIC (Interaksi/State)  │
│                      [src/App.tsx, React Hooks]        │
└───────────────────────────┬────────────────────────────┘
                            │ (Mengalirkan State & Aksi)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   4. UI TEMPLATE (Tampilan Murni)      │
│                      [src/components/*]                │
└────────────────────────────────────────────────────────┘
```

---

### 🟢 1. BACKEND: Logika Bisnis & Data (Slide 03)
*   **Fokus:** Mengolah basis data, melakukan perhitungan tarif billing, mengelola status TV/Rental, dan melakukan request validation keamanan di server.
*   **File Utama:**
    *   `server.ts` (Express server, menangani routing HTTP, validasi, autentikasi middleware, & broadcast real-time WebSocket).
    *   `server-db.ts` / local database (Menyimpan status TV, billing aktif, stok barang inventori, akun pengguna, denda, dan log audit).
*   **Keunggulan:** Bebas dari ketergantungan tampilan (UI-agnostic). Backend murni mengembalikan data struktural berformat JSON secara aman.

### 🟡 2. ENDPOINT: Kontrak API (Slide 03 - "Endpoint sebagai Kontrak")
*   **Fokus:** Menghubungkan Frontend dan Backend lewat satu pintu yang terstandarisasi. Tidak ada lagi pemicu `fetch` acak di sembarang file komponen.
*   **File Utama:** 
    *   `src/services/apiClient.ts`
*   **Cara Kerja:**
    *   Menyediakan fungsi asinkron ter-tipe (fully-typed async functions) seperti `apiClient.tvs.start()`, `apiClient.inventori.update()`, dan `apiClient.auth.login()`.
    *   Jika rute endpoint backend berubah, kita **hanya perlu memperbarui 1 file** (`apiClient.ts`) dan seluruh komponen frontend akan langsung menyesuaikan secara otomatis.
    *   *“Kalau kontraknya jelas, frontend nggak perlu nebak-nebak data.”* (Slide 03)

### 🔵 3. FRONTEND LOGIC: Interaksi, State, & Real-Time (Slide 04)
*   **Fokus:** Mengatur daur hidup data, merespon event WebSocket real-time, mengkoordinasikan loading/error state, serta menyalurkan fungsi pembaruan ke komponen visual.
*   **File Utama:**
    *   `src/App.tsx` (Bertindak sebagai Controller utama/Orchestrator).
    *   WebSocket Event Handlers (Mendengarkan event dari server seperti `tv:status_changed` atau `menu:order` dan memperbarui state lokal secara instan).
*   **Keunggulan:** Memisahkan "cara kerja sistem" dengan "bagaimana sistem ditampilkan".

### 🟣 4. UI TEMPLATE: Struktur Tampilan Reusable (Slide 04)
*   **Fokus:** Menampilkan antarmuka yang sangat indah, presisi, responsif, dan interaktif (menggunakan Tailwind CSS & Motion animations).
*   **Koleksi Komponen:**
    *   `BillingCard.tsx` (Template kartu TV, kontrol stopwatch, popup menu pesanan, QRIS generator).
    *   `InventoryPanel.tsx` (Tabel inventori, form tambah/edit barang, safety stock indicator).
    *   `AHPPanel.tsx` (Matriks perbandingan berpasangan, diagram ranking prioritas barang).
    *   `RentalPanel.tsx` & `TransactionsPanel.tsx` (Tampilan log & data denda sewa).
*   **Prinsip:** Komponen-komponen ini menerima data (Props) dan fungsi pemicu (Callbacks) dari Controller. Mereka tidak peduli bagaimana data diambil dari internet, membuat mereka sangat reusable dan mudah di-desain ulang.

---

## 🚀 Alur Kerja yang Jauh Lebih Rapi (Slide 05 - Workflow)

Ketika kita menambahkan fitur baru (contoh: *Fitur Restock Inventori Otomatis*), kita selalu mengikuti **9 Langkah Workflow Emas** ini:

1.  **Definisikan Business Process:** Tentukan bagaimana restock dihitung (misal: jika stok kurang dari safety stock, buat form rekomendasi).
2.  **Tentukan Data yang Dibutuhkan:** Interface data apa saja yang diperlukan (menambah properti `status` atau `kategori` pada tipe `Inventori`).
3.  **Buat Struktur Database:** Perbarui skema/tipe data di `src/types.ts` dan inisialisasi di database backend.
4.  **Buat Daftar Endpoint:** Daftarkan route baru di Express, misal `POST /api/ahp` untuk kalkulasi prioritas restock.
5.  **Buat Sample JSON Response:** Jamin format response aman (berisi matriks kriteria dan array rekomendasi terurut).
6.  **Buat UI Template Reusable:** Desain tampilan input matriks perbandingan dan grafik bento bar chart di `AHPPanel.tsx`.
7.  **Buat Frontend Service:** Daftarkan fungsi pemanggilan baru `apiClient.ahp.calculate()` di `src/services/apiClient.ts`.
8.  **Buat Store / State Hook:** Kelola state hasil perhitungan AHP, loading spinner, dan error catch di controller utama.
9.  **Integrasikan Data Asli ke UI:** Sambungkan controller dengan `AHPPanel.tsx`, salurkan state aslinya, dan nikmati aplikasi yang hidup sempurna!

---

## 🏆 Kenapa Cara Ini Jauh Lebih Enak? (Slide 06)

1.  **Sangat Rapi:** Tidak ada tumpukan kode yang saling tumpang tindih. Logika HTTP aman di `apiClient.ts`, logika database aman di server backend, dan visual tetap bersih di komponen.
2.  **Lebih Mudah Direvisi:** Jika ada bug pada pemesanan menu, kita tahu persis apakah kerusakannya ada di visual (`BillingCard.tsx`), kontrak pengiriman (`apiClient.ts`), atau di basis data backend (`server.ts`).
3.  **Struktur Lebih Scalable:** Menambah 10 atau 100 fitur baru tidak akan membuat aplikasi lambat atau sulit dibaca, karena setiap bagian memiliki rumahnya masing-masing.
4.  **AI Jadi Partner Teknis Terbaik:** Dengan konteks yang terpisah rapi seperti ini, AI coding partner dapat memahami kode kita dengan akurasi 100% tanpa risiko merusak bagian penting lainnya!
