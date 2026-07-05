# Panduan Migrasi & Menjalankan Sumo PlayStation di XAMPP (PHP & MySQL)

Halo! Sesuai permintaan Anda, kami telah memetakan seluruh arsitektur sistem backend Express lama ke **Backend PHP & MySQL murni** tanpa mengubah struktur frontend React Anda yang sudah siap pakai.

Dengan konfigurasi ini, Anda bisa langsung menjalankan aplikasi ini di **XAMPP** komputer lokal Anda.

---

## 📋 Langkah-langkah Persiapan (Setup di XAMPP)

### Langkah 1: Siapkan Database MySQL di phpMyAdmin
1. Buka **XAMPP Control Panel** Anda, lalu jalankan module **Apache** dan **MySQL**.
2. Buka browser Anda dan akses: `http://localhost/phpmyadmin/`.
3. Buat database baru dengan nama: `sumo_playstation`.
4. Pilih database `sumo_playstation` tersebut, masuk ke tab **Import**.
5. Pilih file `database.sql` yang ada di dalam folder proyek ini (`/sumo-ps-app-php/database.sql`) dan klik **Import** / **Go**.
6. Seluruh tabel default (User, Slot TV, Inventori, Transaksi, Log, Rental Bawa Pulang, Laporan Kerusakan) beserta data awal (*seeds*) akan otomatis terbuat.

---

### Langkah 2: Lakukan Build Frontend React Anda
Sebelum memindahkan file ke XAMPP, kita perlu mengompilasi file React menjadi aset statis HTML, CSS, dan JS yang siap disajikan oleh Apache (XAMPP).

#### 💻 Jika Anda menggunakan VS Code (Sangat Direkomendasikan):
1. **Buka Folder Proyek di VS Code:**
   * Pastikan Anda membuka folder root proyek (`tugas-pwl-sumo-ps` atau nama folder repositori Anda) melalui menu **File -> Open Folder**. Jangan hanya membuka satu atau dua file saja.
2. **Buka Terminal Bawaan VS Code:**
   * Tekan tombol pintas keyboard `Ctrl + \`` (tombol backtick di sebelah angka 1) ATAU buka menu atas: **Terminal -> New Terminal**.
3. **Pastikan Lokasi Folder Sudah Benar:**
   * Lihat jalur/path folder yang tertera di baris perintah terminal Anda. Pastikan posisinya berada di root proyek Anda (tempat file `package.json` berada).
4. **Instal Paket Dependensi:**
   * Ketik perintah berikut lalu tekan **Enter** (tunggu hingga proses selesai dan muncul pesan sukses):
     ```bash
     npm install
     ```
5. **Jalankan Perintah Build:**
   * Setelah instalasi paket selesai, ketik perintah berikut lalu tekan **Enter**:
     ```bash
     npm run build
     ```
6. **Refresh File Explorer VS Code (Jika folder `dist/` belum muncul):**
   * Terkadang VS Code butuh waktu untuk memperbarui daftar folder di panel kiri. Arahkan kursor ke area kosong di panel Explorer kiri, lalu klik tombol **Refresh** (ikon melingkar di samping tulisan judul folder proyek) atau tekan `F5` untuk menyegarkan tampilan. Folder `dist/` akan otomatis muncul!

---

### Langkah 3: Pindahkan File ke Folder `htdocs` XAMPP
1. Buat folder baru di dalam `C:\xampp\htdocs\` dengan nama `sumo-playstation` (sehingga jalurnya menjadi `C:\xampp\htdocs\sumo-playstation\`).
2. Buka folder `dist/` yang baru saja terbuat, lalu salin file berikut ke dalam `C:\xampp\htdocs\sumo-playstation\`:
   * Folder `assets/`
   * File `index.html`
   * *(Catatan: Abaikan file `server.cjs` dan `server.cjs.map` karena itu adalah file backend Node.js lama yang tidak kita gunakan di XAMPP).*
3. Buka folder `/sumo-ps-app-php/` di proyek Anda, lalu salin file-file PHP berikut ke dalam `C:\xampp\htdocs\sumo-playstation\`:
   * `api.php` (Server API kita)
   * `.htaccess` (Konfigurasi URL Rewrite otomatis agar `/api/*` terbaca oleh PHP)
   * Folder `models/` (Berisi logika perhitungan AHP - `models/AHP.php`)

Struktur folder akhir di dalam `C:\xampp\htdocs\sumo-playstation\` akan terlihat seperti ini:
```text
C:\xampp\htdocs\sumo-playstation\
├── assets/                  (Aset JS & CSS dari folder dist)
├── models/
│   └── AHP.php              (Logika algoritma AHP PHP)
├── .htaccess                (URL Router config)
├── api.php                  (File API Utama)
├── index.html               (File Entry Point Frontend)
└── ... (file statis lainnya)
```

---

## 🚀 Jalankan Aplikasi Anda!

Buka browser favorit Anda dan akses:
👉 **`http://localhost/sumo-playstation/`**

Aplikasi akan otomatis berjalan! 
* Apache akan menyajikan tampilan visual React Anda yang menawan.
* Ketika frontend memanggil `/api/*` (seperti saat Login, Check-out TV, Manajemen Inventori, atau Kalkulasi AHP), file `.htaccess` akan secara otomatis mengarahkannya ke `api.php` di latar belakang.
* Seluruh data Anda sekarang tersimpan secara permanen di database **MySQL XAMPP** Anda!

---

## 🔑 Akun Preset Default untuk Login
Anda bisa login menggunakan akun bawaan berikut:
1. **Role Pemilik:**
   * **Username:** `pemilik`
   * **Password:** `pemilik123`
2. **Role Pegawai:**
   * **Username:** `pegawai`
   * **Password:** `pegawai123`

---

## 🛠️ Konfigurasi Tambahan (Jika Diperlukan)
Jika Anda menggunakan username/password database MySQL yang berbeda di XAMPP Anda (bukan default `root` dan tanpa password), Anda hanya perlu menyesuaikan baris koneksi database di bagian atas file `api.php`:
```php
// baris 21-24 di api.php
$db_host = 'localhost';
$db_user = 'root';        // Ubah jika bukan root
$db_pass = '';            // Ubah dengan password database Anda
$db_name = 'sumo_playstation';
```

Selamat mencoba! Aplikasi Anda kini 100% siap dijalankan menggunakan XAMPP! 🎉
