-- Database Schema for Sumo PlayStation (MySQL)
-- Cocok dijalankan pada phpMyAdmin / MySQL Server di XAMPP

CREATE DATABASE IF NOT EXISTS sumo_playstation;
USE sumo_playstation;

-- 1. Tabel users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- password hash terenkripsi (password_hash() PHP)
    nama_lengkap VARCHAR(100) NOT NULL,
    role ENUM('pegawai', 'pemilik') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel konsol_tv
CREATE TABLE IF NOT EXISTS konsol_tv (
    id_tv INT AUTO_INCREMENT PRIMARY KEY,
    nama_tv VARCHAR(20) NOT NULL,
    jenis_konsol VARCHAR(50) NOT NULL,
    status ENUM('kosong', 'digunakan', 'booking', 'maintenance') DEFAULT 'kosong'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel billing
CREATE TABLE IF NOT EXISTS billing (
    id_billing INT AUTO_INCREMENT PRIMARY KEY,
    id_tv INT NOT NULL,
    id_user INT NOT NULL,
    waktu_mulai DATETIME NOT NULL,
    waktu_selesai DATETIME DEFAULT NULL,
    durasi_menit INT DEFAULT 0,
    tarif_per_jam INT DEFAULT 10000,
    total_sewa INT DEFAULT 0,
    total_menu INT DEFAULT 0,
    total_bayar INT DEFAULT 0,
    status ENUM('aktif', 'selesai') DEFAULT 'aktif',
    FOREIGN KEY (id_tv) REFERENCES konsol_tv(id_tv),
    FOREIGN KEY (id_user) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel inventori
CREATE TABLE IF NOT EXISTS inventori (
    id_barang INT AUTO_INCREMENT PRIMARY KEY,
    nama_barang VARCHAR(100) NOT NULL,
    stok_saat_ini INT NOT NULL DEFAULT 0,
    safety_stock INT NOT NULL DEFAULT 0,
    harga_grosir INT NOT NULL DEFAULT 0,
    harga_eceran INT NOT NULL DEFAULT 0,
    jumlah_terjual INT NOT NULL DEFAULT 0,
    kategori VARCHAR(50) DEFAULT 'Makanan',
    status ENUM('baik', 'perlu perbaikan', 'rusak') DEFAULT 'baik'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabel detail_transaksi_menu
CREATE TABLE IF NOT EXISTS detail_transaksi_menu (
    id_detail INT AUTO_INCREMENT PRIMARY KEY,
    id_billing INT NOT NULL,
    id_barang INT NOT NULL,
    jumlah INT NOT NULL,
    subtotal INT NOT NULL,
    FOREIGN KEY (id_billing) REFERENCES billing(id_billing),
    FOREIGN KEY (id_barang) REFERENCES inventori(id_barang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabel transaksi
CREATE TABLE IF NOT EXISTS transaksi (
    id_transaksi INT AUTO_INCREMENT PRIMARY KEY,
    id_billing INT UNIQUE,
    total_sewa INT NOT NULL DEFAULT 0,
    total_menu INT NOT NULL DEFAULT 0,
    total_bayar INT NOT NULL DEFAULT 0,
    metode_pembayaran ENUM('cash', 'qris', 'transfer') NOT NULL,
    tanggal_transaksi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_billing) REFERENCES billing(id_billing)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Tabel log_aktivitas
CREATE TABLE IF NOT EXISTS log_aktivitas (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT NOT NULL,
    aktivitas TEXT NOT NULL,
    waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Tabel rental_bawa_pulang
CREATE TABLE IF NOT EXISTS rental_bawa_pulang (
    id_rental VARCHAR(50) PRIMARY KEY,
    nama_konsol VARCHAR(100) NOT NULL,
    jenis_konsol VARCHAR(50) NOT NULL,
    status ENUM('tersedia', 'disewa', 'maintenance') DEFAULT 'tersedia',
    -- Detail Sewa (Null jika tersedia)
    nama_pelanggan VARCHAR(100) DEFAULT NULL,
    no_whatsapp VARCHAR(20) DEFAULT NULL,
    jaminan VARCHAR(100) DEFAULT NULL,
    perintilan TEXT DEFAULT NULL, -- format JSON
    waktu_mulai DATETIME DEFAULT NULL,
    durasi_hari INT DEFAULT NULL,
    tarif_per_hari INT DEFAULT NULL,
    total_bayar INT DEFAULT NULL,
    kondisi_keluar VARCHAR(100) DEFAULT NULL,
    catatan TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Tabel laporan_kerusakan
CREATE TABLE IF NOT EXISTS laporan_kerusakan (
    id_laporan VARCHAR(50) PRIMARY KEY,
    id_rental VARCHAR(50) NOT NULL,
    nama_konsol VARCHAR(100) NOT NULL,
    nama_pelanggan VARCHAR(100) NOT NULL,
    tanggal_laporan DATETIME NOT NULL,
    detail_kerusakan TEXT NOT NULL,
    denda INT DEFAULT 0,
    id_barang_inventori INT DEFAULT NULL,
    nama_barang_inventori VARCHAR(100) DEFAULT NULL,
    status ENUM('perlu perbaikan', 'selesai') DEFAULT 'perlu perbaikan'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Default Data (Password default: 'pemilik123' dan 'pegawai123' terenkripsi password_hash)
INSERT INTO users (username, password, nama_lengkap, role) VALUES
('pemilik', '$2y$10$U5RscIeJ/7mfeP/QvXU0tOP7iMv6.QG1X6w/Yn0n9Pq1Gk0uM7U.2', 'Tambak Kusumo', 'pemilik'),
('pegawai', '$2y$10$7Rms9F5I6eXm8P.L/9vXUuL2iDv8.QG1X6w/Yn0n9Pq1Gk0uM7U.2', 'Alvi Dwi Rizky Syahputra', 'pegawai'),
('farelie', 'farel0857', 'Farelie Lanang Jati', 'pegawai');

-- Seed 8 PlayStation TV Slots
INSERT INTO konsol_tv (nama_tv, jenis_konsol, status) VALUES
('TV-01', 'PlayStation 5', 'kosong'),
('TV-02', 'PlayStation 5', 'kosong'),
('TV-03', 'PlayStation 5', 'kosong'),
('TV-04', 'PlayStation 5', 'kosong'),
('TV-05', 'PlayStation 4 Pro', 'kosong'),
('TV-06', 'PlayStation 4 Pro', 'kosong'),
('TV-07', 'PlayStation 4 Pro', 'kosong'),
('TV-08', 'PlayStation 4 Pro', 'kosong');

-- Seed Starting Inventory
INSERT INTO inventori (nama_barang, stok_saat_ini, safety_stock, harga_grosir, harga_eceran, jumlah_terjual, kategori, status) VALUES
('Teh Manis Hangat', 50, 10, 1500, 3000, 85, 'Minuman', 'baik'),
('Es Teh Manis', 80, 15, 2000, 4000, 120, 'Minuman', 'baik'),
('Kopi Panas', 40, 10, 2000, 4000, 45, 'Minuman', 'baik'),
('Es Kopi', 45, 10, 2500, 5000, 60, 'Minuman', 'baik'),
('Capucino Panas', 30, 10, 2500, 5000, 35, 'Minuman', 'baik'),
('Es Capucino', 40, 10, 3000, 6000, 50, 'Minuman', 'baik'),
('Susu Panas', 25, 5, 2000, 4000, 28, 'Minuman', 'baik'),
('Kuku Bima', 30, 10, 2000, 4000, 40, 'Minuman', 'baik'),
('Kuku Bima + Susu', 25, 5, 3000, 6000, 35, 'Minuman', 'baik'),
('Extra Joss', 35, 10, 2000, 4000, 55, 'Minuman', 'baik'),
('Extra Joss + Susu', 25, 5, 3000, 6000, 45, 'Minuman', 'baik'),
('Nutrisari', 40, 10, 2000, 4000, 70, 'Minuman', 'baik'),
('Indomie', 50, 15, 3000, 6000, 110, 'Makanan', 'baik'),
('Indomie + Telor', 35, 10, 5000, 10000, 95, 'Makanan', 'baik'),
('Indomie + Nasi', 30, 10, 5000, 10000, 65, 'Makanan', 'baik'),
('Indomie + Nasi + Telor', 25, 10, 7000, 14000, 80, 'Makanan', 'baik'),
('Stik PS3 DualShock', 20, 5, 80000, 150000, 0, 'Alat', 'baik'),
('Stik PS4 DualShock', 15, 4, 150000, 350000, 0, 'Alat', 'baik'),
('Kabel HDMI Premium', 10, 3, 15000, 30000, 0, 'Alat', 'baik'),
('Kabel Power Console', 10, 3, 10000, 25000, 0, 'Alat', 'baik');

-- Seed 10 Rental Bawa Pulang Slots
INSERT INTO rental_bawa_pulang (id_rental, nama_konsol, jenis_konsol, status) VALUES
('PS3-HP-01', 'PS3 Bawa Pulang #01', 'PS3', 'tersedia'),
('PS3-HP-02', 'PS3 Bawa Pulang #02', 'PS3', 'tersedia'),
('PS3-HP-03', 'PS3 Bawa Pulang #03', 'PS3', 'tersedia'),
('PS3-HP-04', 'PS3 Bawa Pulang #04', 'PS3', 'tersedia'),
('PS3-HP-05', 'PS3 Bawa Pulang #05', 'PS3', 'tersedia'),
('PS3-HP-06', 'PS3 Bawa Pulang #06', 'PS3', 'tersedia'),
('PS3-HP-07', 'PS3 Bawa Pulang #07', 'PS3', 'tersedia'),
('PS3-HP-08', 'PS3 Bawa Pulang #08', 'PS3', 'tersedia'),
('PS3-HP-09', 'PS3 Bawa Pulang #09', 'PS3', 'tersedia'),
('PS3-HP-10', 'PS3 Bawa Pulang #10', 'PS3', 'tersedia');
