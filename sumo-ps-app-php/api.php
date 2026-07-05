<?php
/**
 * REST API Server for Sumo PlayStation (PHP/MySQL)
 * Cocok dijalankan pada XAMPP Apache Server.
 * Menyediakan interaksi database riil untuk seluruh fitur di React Frontend.
 */

// 1. CORS Headers & Base Configuration
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Database Connection (PDO)
$db_host = 'localhost';
$db_user = 'root';
$db_pass = '';
$db_name = 'sumo_playstation';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Koneksi database gagal: " . $e->getMessage()]);
    exit();
}

// 3. Dynamic Tables Creation (Session Helper)
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_sessions (
        token VARCHAR(255) PRIMARY KEY,
        id_user INT NOT NULL,
        waktu_expire TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (PDOException $e) {
    // Fail silently or handle if needed
}

// 4. Helper functions
function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function sendJson($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit();
}

function sendError($message, $status = 400) {
    sendJson(["error" => $message], $status);
}

// Auth Check & Session Helper
$currentUser = null;
$currentToken = null;

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    $token = $matches[1];
    // Ambil user dari session table
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.id_user WHERE s.token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if ($user) {
        $currentUser = $user;
        // Cast types to match TS contract
        $currentUser['id'] = (string)$user['id'];
        $currentToken = $token;
    }
}

function requireAuth() {
    global $currentUser;
    if (!$currentUser) {
        sendError("Sesi tidak valid. Silakan login kembali.", 401);
    }
}

// 5. Router Logic
$route = $_GET['route'] ?? '';
if (empty($route) && isset($_SERVER['PATH_INFO'])) {
    $route = $_SERVER['PATH_INFO'];
}

$method = $_SERVER['REQUEST_METHOD'];

// Standardize route path by trimming slashes
$route = trim($route, '/');

// Welcome Route (Untuk testing di localhost)
if (empty($route) || $route === 'api.php' || $route === 'index.php') {
    if ($method === 'GET') {
        sendJson([
            "message" => "API Sumo PlayStation berjalan dengan baik di XAMPP!",
            "status" => "online",
            "timestamp" => date('Y-m-d H:i:s'),
            "hint" => "Gunakan endpoint seperti /api.php/inventori atau /api.php?route=inventori jika .htaccess tidak aktif."
        ]);
    }
}

// --- ROUTE 1: AUTHENTICATION ---
if ($route === 'auth/login' && $method === 'POST') {
    $body = getBody();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (empty($username) || empty($password)) {
        sendError("Username dan password wajib diisi.");
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(username) = ?");
    $stmt->execute([strtolower($username)]);
    $user = $stmt->fetch();

    if (!$user) {
        sendError("Username tidak ditemukan.", 401);
    }

    if (!password_verify($password, $user['password'])) {
        // Fallback checks for simple non-encrypted text for safety
        if ($password !== $user['password']) {
            sendError("Password salah.", 401);
        }
    }

    // Generate token
    $token = 'tok-' . bin2hex(random_bytes(16));
    
    // Save to user_sessions
    $stmt = $pdo->prepare("INSERT INTO user_sessions (token, id_user) VALUES (?, ?)");
    $stmt->execute([$token, $user['id']]);

    // Log Activity
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$user['id'], "User " . $user['nama_lengkap'] . " berhasil login via PHP-XAMPP"]);

    // Format user response
    $userResponse = [
        "id" => (string)$user['id'],
        "username" => $user['username'],
        "nama_lengkap" => $user['nama_lengkap'],
        "role" => $user['role'],
        "created_at" => $user['created_at']
    ];

    sendJson(["token" => $token, "user" => $userResponse]);
}

if ($route === 'auth/me' && $method === 'GET') {
    requireAuth();
    sendJson(["user" => $currentUser]);
}

if ($route === 'auth/logout' && $method === 'POST') {
    requireAuth();
    // Log activity
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "User " . $currentUser['nama_lengkap'] . " keluar dari sistem (logout)"]);

    // Delete session
    $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE token = ?");
    $stmt->execute([$currentToken]);

    sendJson(["success" => true]);
}

// --- ROUTE 2: KONSOL / PLAYSTATION TV SLOTS ---
if ($route === 'konsol' && $method === 'GET') {
    requireAuth();
    
    $stmt = $pdo->query("SELECT * FROM konsol_tv ORDER BY id_tv ASC");
    $tvs = $stmt->fetchAll();

    $enhancedTVs = [];
    foreach ($tvs as $tv) {
        $id_tv = $tv['id_tv'];
        $activeBilling = null;

        if ($tv['status'] === 'digunakan') {
            // Find active billing
            $bStmt = $pdo->prepare("SELECT * FROM billing WHERE id_tv = ? AND status = 'aktif' LIMIT 1");
            $bStmt->execute([$id_tv]);
            $active = $bStmt->fetch();

            if ($active) {
                // Calculate elapsed minutes
                $startTime = strtotime($active['waktu_mulai']);
                $now = time();
                $elapsedMinutes = max(0, floor(($now - $startTime) / 60));
                
                // Calculate dynamic rent cost
                $costSewa = ceil(($elapsedMinutes / 60) * $active['tarif_per_jam']);
                
                $activeBilling = [
                    "id_billing" => (string)$active['id_billing'],
                    "id_tv" => (int)$active['id_tv'],
                    "id_user" => (string)$active['id_user'],
                    "waktu_mulai" => $active['waktu_mulai'],
                    "waktu_selesai" => $active['waktu_selesai'],
                    "durasi_menit" => (int)$elapsedMinutes,
                    "tarif_per_jam" => (int)$active['tarif_per_jam'],
                    "total_sewa" => (int)$costSewa,
                    "total_menu" => (int)$active['total_menu'],
                    "total_bayar" => (int)($costSewa + $active['total_menu']),
                    "status" => $active['status']
                ];
            }
        }

        $enhancedTVs[] = [
            "id_tv" => (int)$tv['id_tv'],
            "nama_tv" => $tv['nama_tv'],
            "jenis_konsol" => $tv['jenis_konsol'],
            "status" => $tv['status'],
            "activeBilling" => $activeBilling
        ];
    }

    sendJson($enhancedTVs);
}

// Start TV Sesi
if (preg_match('/^konsol\/([0-9]+)\/start$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_tv = (int)$matches[1];
    $body = getBody();
    $tarif_per_jam = (int)($body['tarif_per_jam'] ?? 10000);

    // Verify TV exists and is free
    $stmt = $pdo->prepare("SELECT * FROM konsol_tv WHERE id_tv = ?");
    $stmt->execute([$id_tv]);
    $tv = $stmt->fetch();

    if (!$tv) {
        sendError("TV tidak ditemukan.", 404);
    }
    if ($tv['status'] === 'digunakan') {
        sendError("TV sedang digunakan.");
    }

    $pdo->beginTransaction();
    try {
        // Update TV Status
        $stmt = $pdo->prepare("UPDATE konsol_tv SET status = 'digunakan' WHERE id_tv = ?");
        $stmt->execute([$id_tv]);

        // Insert active billing record
        $bStmt = $pdo->prepare("INSERT INTO billing (id_tv, id_user, waktu_mulai, tarif_per_jam, status) VALUES (?, ?, NOW(), ?, 'aktif')");
        $bStmt->execute([$id_tv, $currentUser['id'], $tarif_per_jam]);
        $billingId = $pdo->lastInsertId();

        // Get details of inserted billing
        $getBilling = $pdo->prepare("SELECT * FROM billing WHERE id_billing = ?");
        $getBilling->execute([$billingId]);
        $billing = $getBilling->fetch();

        // Log
        $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
        $logStmt->execute([$currentUser['id'], "Memulai sesi baru di " . $tv['nama_tv'] . " (Tarif: Rp " . number_format($tarif_per_jam, 0, ',', '.') . "/jam)"]);

        $pdo->commit();

        sendJson([
            "success" => true,
            "billing" => [
                "id_billing" => (string)$billing['id_billing'],
                "id_tv" => (int)$billing['id_tv'],
                "id_user" => (string)$billing['id_user'],
                "waktu_mulai" => $billing['waktu_mulai'],
                "waktu_selesai" => $billing['waktu_selesai'],
                "durasi_menit" => 0,
                "tarif_per_jam" => (int)$billing['tarif_per_jam'],
                "total_sewa" => 0,
                "total_menu" => 0,
                "total_bayar" => 0,
                "status" => $billing['status']
            ]
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendError("Gagal memulai billing: " . $e->getMessage());
    }
}

// Stop TV Sesi & Simpan Transaksi
if (preg_match('/^konsol\/([0-9]+)\/stop$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_tv = (int)$matches[1];
    $body = getBody();
    $metode_pembayaran = trim($body['metode_pembayaran'] ?? 'cash');

    // Get TV
    $stmt = $pdo->prepare("SELECT * FROM konsol_tv WHERE id_tv = ?");
    $stmt->execute([$id_tv]);
    $tv = $stmt->fetch();

    if (!$tv || $tv['status'] !== 'digunakan') {
        sendError("TV tidak memiliki sesi aktif.");
    }

    // Get Active Billing
    $bStmt = $pdo->prepare("SELECT * FROM billing WHERE id_tv = ? AND status = 'aktif' LIMIT 1");
    $bStmt->execute([$id_tv]);
    $billing = $bStmt->fetch();

    if (!$billing) {
        sendError("Sesi billing aktif tidak ditemukan.", 404);
    }

    $pdo->beginTransaction();
    try {
        // Hitung durasi dan tarif
        $startTime = strtotime($billing['waktu_mulai']);
        $now = time();
        $elapsedMinutes = max(1, floor(($now - $startTime) / 60)); // minimum 1 min
        $costSewa = ceil(($elapsedMinutes / 60) * $billing['tarif_per_jam']);
        $totalBayar = $costSewa + $billing['total_menu'];

        // 1. Update status billing menjadi Selesai
        $updBill = $pdo->prepare("UPDATE billing SET status = 'selesai', waktu_selesai = NOW(), durasi_menit = ?, total_sewa = ?, total_bayar = ? WHERE id_billing = ?");
        $updBill->execute([$elapsedMinutes, $costSewa, $totalBayar, $billing['id_billing']]);

        // 2. Ubah status TV menjadi kosong
        $updTv = $pdo->prepare("UPDATE konsol_tv SET status = 'kosong' WHERE id_tv = ?");
        $updTv->execute([$id_tv]);

        // 3. Buat Transaksi Pembayaran
        $insTrx = $pdo->prepare("INSERT INTO transaksi (id_billing, total_sewa, total_menu, total_bayar, metode_pembayaran, tanggal_transaksi) VALUES (?, ?, ?, ?, ?, NOW())");
        $insTrx->execute([$billing['id_billing'], $costSewa, $billing['total_menu'], $totalBayar, $metode_pembayaran]);
        $transaksiId = $pdo->lastInsertId();

        // Ambil barang pesanan untuk report
        $mStmt = $pdo->prepare("SELECT d.*, i.nama_barang FROM detail_transaksi_menu d JOIN inventori i ON d.id_barang = i.id_barang WHERE d.id_billing = ?");
        $mStmt->execute([$billing['id_billing']]);
        $menuItems = $mStmt->fetchAll();

        // 4. Log Aktivitas
        $aktivitasStr = "Menyelesaikan sesi di " . $tv['nama_tv'] . " (Durasi: " . $elapsedMinutes . " menit, Total Sewa: Rp " . number_format($costSewa, 0, ',', '.') . ", Menu Tambahan: Rp " . number_format($billing['total_menu'], 0, ',', '.') . "). Pembayaran via " . strtoupper($metode_pembayaran) . " senilai Rp " . number_format($totalBayar, 0, ',', '.') . " LUNAS.";
        $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
        $logStmt->execute([$currentUser['id'], $aktivitasStr]);

        $pdo->commit();

        sendJson([
            "success" => true,
            "transaksi" => [
                "id_transaksi" => "trx-" . $transaksiId,
                "id_billing" => (string)$billing['id_billing'],
                "total_sewa" => (int)$costSewa,
                "total_menu" => (int)$billing['total_menu'],
                "total_bayar" => (int)$totalBayar,
                "metode_pembayaran" => $metode_pembayaran,
                "tanggal_transaksi" => date('Y-m-d H:i:s')
            ],
            "billing" => [
                "id_billing" => (string)$billing['id_billing'],
                "id_tv" => (int)$billing['id_tv'],
                "waktu_mulai" => $billing['waktu_mulai'],
                "waktu_selesai" => date('Y-m-d H:i:s'),
                "durasi_menit" => (int)$elapsedMinutes,
                "total_sewa" => (int)$costSewa,
                "total_menu" => (int)$billing['total_menu'],
                "total_bayar" => (int)$totalBayar
            ],
            "menu_items" => $menuItems,
            "kasir" => $currentUser['nama_lengkap']
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        sendError("Gagal check-out: " . $e->getMessage());
    }
}

// Booking, Maintenance, atau Kosongkan TV manual
if (preg_match('/^konsol\/([0-9]+)\/(booking|maintenance|free)$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_tv = (int)$matches[1];
    $action = $matches[2];
    $statusMap = [
        'booking' => 'booking',
        'maintenance' => 'maintenance',
        'free' => 'kosong'
    ];
    $targetStatus = $statusMap[$action];

    // Ambil TV
    $stmt = $pdo->prepare("SELECT * FROM konsol_tv WHERE id_tv = ?");
    $stmt->execute([$id_tv]);
    $tv = $stmt->fetch();

    if (!$tv) {
        sendError("TV tidak ditemukan.", 404);
    }

    if ($tv['status'] === 'digunakan') {
        sendError("Tidak bisa mengubah status karena TV sedang digunakan aktif.");
    }

    $stmt = $pdo->prepare("UPDATE konsol_tv SET status = ? WHERE id_tv = ?");
    $stmt->execute([$targetStatus, $id_tv]);

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Mengubah status " . $tv['nama_tv'] . " menjadi " . ucfirst($action)]);

    sendJson(["success" => true]);
}

// --- ROUTE 3: MENU & ORDERING ---
if ($route === 'menu/order' && $method === 'POST') {
    requireAuth();
    $body = getBody();
    $id_billing = (int)($body['id_billing'] ?? 0);
    $items = $body['items'] ?? [];

    if (!$id_billing || empty($items)) {
        sendError("ID Billing dan item menu wajib diisi.");
    }

    // Ambil billing
    $stmt = $pdo->prepare("SELECT * FROM billing WHERE id_billing = ? AND status = 'aktif'");
    $stmt->execute([$id_billing]);
    $billing = $stmt->fetch();

    if (!$billing) {
        sendError("Sesi billing aktif tidak ditemukan.");
    }

    $pdo->beginTransaction();
    try {
        $addedTotalMenu = 0;
        foreach ($items as $item) {
            $id_barang = (int)$item['id_barang'];
            $jumlah = (int)$item['jumlah'];

            // Get item inventory
            $iStmt = $pdo->prepare("SELECT * FROM inventori WHERE id_barang = ?");
            $iStmt->execute([$id_barang]);
            $inv = $iStmt->fetch();

            if (!$inv) {
                throw new Exception("Barang ID $id_barang tidak ditemukan.");
            }
            if ($inv['stok_saat_ini'] < $jumlah) {
                throw new Exception("Stok barang " . $inv['nama_barang'] . " tidak mencukupi.");
            }

            $subtotal = $inv['harga_eceran'] * $jumlah;
            $addedTotalMenu += $subtotal;

            // Reduce stock & increase sold
            $updInv = $pdo->prepare("UPDATE inventori SET stok_saat_ini = stok_saat_ini - ?, jumlah_terjual = jumlah_terjual + ? WHERE id_barang = ?");
            $updInv->execute([$jumlah, $jumlah, $id_barang]);

            // Save details
            $insDetail = $pdo->prepare("INSERT INTO detail_transaksi_menu (id_billing, id_barang, jumlah, subtotal) VALUES (?, ?, ?, ?)");
            $insDetail->execute([$id_billing, $id_barang, $jumlah, $subtotal]);
        }

        // Update billing
        $updBill = $pdo->prepare("UPDATE billing SET total_menu = total_menu + ?, total_bayar = total_bayar + ? WHERE id_billing = ?");
        $updBill->execute([$addedTotalMenu, $addedTotalMenu, $id_billing]);

        // Get TV Name for Log
        $tvStmt = $pdo->prepare("SELECT nama_tv FROM konsol_tv WHERE id_tv = ?");
        $tvStmt->execute([$billing['id_tv']]);
        $tvName = $tvStmt->fetchColumn() ?: "TV";

        // Log Activity
        $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
        $logStmt->execute([$currentUser['id'], "Memesan menu makanan/minuman tambahan pada " . $tvName . " senilai Rp " . number_format($addedTotalMenu, 0, ',', '.')]);

        $pdo->commit();
        sendJson(["success" => true]);

    } catch (Exception $e) {
        $pdo->rollBack();
        sendError($e->getMessage());
    }
}

// --- ROUTE 4: INVENTORI ---
if ($route === 'inventori' && $method === 'GET') {
    requireAuth();
    $stmt = $pdo->query("SELECT * FROM inventori ORDER BY id_barang ASC");
    $items = $stmt->fetchAll();

    $typedItems = [];
    foreach ($items as $item) {
        $typedItems[] = [
            "id_barang" => (string)$item['id_barang'],
            "nama_barang" => $item['nama_barang'],
            "stok_saat_ini" => (int)$item['stok_saat_ini'],
            "safety_stock" => (int)$item['safety_stock'],
            "harga_grosir" => (int)$item['harga_grosir'],
            "harga_eceran" => (int)$item['harga_eceran'],
            "jumlah_terjual" => (int)$item['jumlah_terjual'],
            "kategori" => $item['kategori'] ?? 'Makanan',
            "status" => $item['status'] ?? 'baik'
        ];
    }
    sendJson($typedItems);
}

if ($route === 'inventori' && $method === 'POST') {
    requireAuth();
    $body = getBody();
    
    $nama_barang = trim($body['nama_barang'] ?? '');
    $stok_saat_ini = (int)($body['stok_saat_ini'] ?? 0);
    $safety_stock = (int)($body['safety_stock'] ?? 0);
    $harga_grosir = (int)($body['harga_grosir'] ?? 0);
    $harga_eceran = (int)($body['harga_eceran'] ?? 0);
    $kategori = trim($body['kategori'] ?? 'Makanan');
    $status = trim($body['status'] ?? 'baik');

    if (empty($nama_barang)) {
        sendError("Nama barang wajib diisi.");
    }

    $stmt = $pdo->prepare("INSERT INTO inventori (nama_barang, stok_saat_ini, safety_stock, harga_grosir, harga_eceran, kategori, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$nama_barang, $stok_saat_ini, $safety_stock, $harga_grosir, $harga_eceran, $kategori, $status]);
    $newId = $pdo->lastInsertId();

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Menambahkan item baru ke inventori: $nama_barang"]);

    sendJson([
        "success" => true,
        "item" => [
            "id_barang" => (string)$newId,
            "nama_barang" => $nama_barang,
            "stok_saat_ini" => $stok_saat_ini,
            "safety_stock" => $safety_stock,
            "harga_grosir" => $harga_grosir,
            "harga_eceran" => $harga_eceran,
            "jumlah_terjual" => 0,
            "kategori" => $kategori,
            "status" => $status
        ]
    ]);
}

if (preg_match('/^inventori\/([0-9]+)$/', $route, $matches) && $method === 'PUT') {
    requireAuth();
    $id_barang = (int)$matches[1];
    $body = getBody();

    // Ambil barang lama
    $stmt = $pdo->prepare("SELECT * FROM inventori WHERE id_barang = ?");
    $stmt->execute([$id_barang]);
    $inv = $stmt->fetch();

    if (!$inv) {
        sendError("Barang tidak ditemukan.", 404);
    }

    $nama_barang = $body['nama_barang'] ?? $inv['nama_barang'];
    $stok_saat_ini = isset($body['stok_saat_ini']) ? (int)$body['stok_saat_ini'] : (int)$inv['stok_saat_ini'];
    $safety_stock = isset($body['safety_stock']) ? (int)$body['safety_stock'] : (int)$inv['safety_stock'];
    $harga_grosir = isset($body['harga_grosir']) ? (int)$body['harga_grosir'] : (int)$inv['harga_grosir'];
    $harga_eceran = isset($body['harga_eceran']) ? (int)$body['harga_eceran'] : (int)$inv['harga_eceran'];
    $kategori = $body['kategori'] ?? $inv['kategori'] ?? 'Makanan';
    $status = $body['status'] ?? $inv['status'] ?? 'baik';

    $stmt = $pdo->prepare("UPDATE inventori SET nama_barang = ?, stok_saat_ini = ?, safety_stock = ?, harga_grosir = ?, harga_eceran = ?, kategori = ?, status = ? WHERE id_barang = ?");
    $stmt->execute([$nama_barang, $stok_saat_ini, $safety_stock, $harga_grosir, $harga_eceran, $kategori, $status, $id_barang]);

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Memperbarui data inventori: $nama_barang"]);

    sendJson([
        "success" => true,
        "item" => [
            "id_barang" => (string)$id_barang,
            "nama_barang" => $nama_barang,
            "stok_saat_ini" => $stok_saat_ini,
            "safety_stock" => $safety_stock,
            "harga_grosir" => $harga_grosir,
            "harga_eceran" => $harga_eceran,
            "jumlah_terjual" => (int)$inv['jumlah_terjual'],
            "kategori" => $kategori,
            "status" => $status
        ]
    ]);
}

if (preg_match('/^inventori\/([0-9]+)$/', $route, $matches) && $method === 'DELETE') {
    requireAuth();
    $id_barang = (int)$matches[1];

    $stmt = $pdo->prepare("SELECT nama_barang FROM inventori WHERE id_barang = ?");
    $stmt->execute([$id_barang]);
    $name = $stmt->fetchColumn();

    if (!$name) {
        sendError("Barang tidak ditemukan.", 404);
    }

    $stmt = $pdo->prepare("DELETE FROM inventori WHERE id_barang = ?");
    $stmt->execute([$id_barang]);

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Menghapus barang dari inventori: $name"]);

    sendJson(["success" => true]);
}

// --- ROUTE 5: USER MANAGEMENT ---
if ($route === 'users' && $method === 'GET') {
    requireAuth();
    $stmt = $pdo->query("SELECT id, username, nama_lengkap, role, created_at FROM users ORDER BY id ASC");
    $users = $stmt->fetchAll();

    $typedUsers = [];
    foreach ($users as $u) {
        $typedUsers[] = [
            "id" => (string)$u['id'],
            "username" => $u['username'],
            "nama_lengkap" => $u['nama_lengkap'],
            "role" => $u['role'],
            "created_at" => $u['created_at']
        ];
    }
    sendJson($typedUsers);
}

if ($route === 'users' && $method === 'POST') {
    requireAuth();
    $body = getBody();

    $username = strtolower(trim($body['username'] ?? ''));
    $password = $body['password'] ?? '';
    $nama_lengkap = trim($body['nama_lengkap'] ?? '');
    $role = trim($body['role'] ?? 'pegawai');

    if (empty($username) || empty($password) || empty($nama_lengkap)) {
        sendError("Semua form wajib diisi.");
    }

    // Check duplicate
    $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
    $chk->execute([$username]);
    if ($chk->fetchColumn() > 0) {
        sendError("Username sudah terdaftar.");
    }

    $hashed = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("INSERT INTO users (username, password, nama_lengkap, role) VALUES (?, ?, ?, ?)");
    $stmt->execute([$username, $hashed, $nama_lengkap, $role]);
    $newId = $pdo->lastInsertId();

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Menambahkan admin/kasir baru: $nama_lengkap ($role)"]);

    sendJson([
        "success" => true,
        "user" => [
            "id" => (string)$newId,
            "username" => $username,
            "nama_lengkap" => $nama_lengkap,
            "role" => $role,
            "created_at" => date('Y-m-d H:i:s')
        ]
    ]);
}

if (preg_match('/^users\/([0-9]+)$/', $route, $matches) && $method === 'PUT') {
    requireAuth();
    $id = (int)$matches[1];
    $body = getBody();

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch();

    if (!$user) {
        sendError("User tidak ditemukan.", 404);
    }

    $username = strtolower(trim($body['username'] ?? $user['username']));
    $nama_lengkap = trim($body['nama_lengkap'] ?? $user['nama_lengkap']);
    $role = trim($body['role'] ?? $user['role']);
    $password = $body['password'] ?? '';

    if (!empty($password)) {
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE users SET username = ?, nama_lengkap = ?, role = ?, password = ? WHERE id = ?");
        $stmt->execute([$username, $nama_lengkap, $role, $hashed, $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE users SET username = ?, nama_lengkap = ?, role = ? WHERE id = ?");
        $stmt->execute([$username, $nama_lengkap, $role, $id]);
    }

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Memperbarui data akun kasir: $nama_lengkap"]);

    sendJson([
        "success" => true,
        "user" => [
            "id" => (string)$id,
            "username" => $username,
            "nama_lengkap" => $nama_lengkap,
            "role" => $role,
            "created_at" => $user['created_at']
        ]
    ]);
}

if (preg_match('/^users\/([0-9]+)$/', $route, $matches) && $method === 'DELETE') {
    requireAuth();
    $id = (int)$matches[1];

    if ($currentUser['id'] == $id) {
        sendError("Anda tidak dapat menghapus akun Anda sendiri.");
    }

    $stmt = $pdo->prepare("SELECT nama_lengkap FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $name = $stmt->fetchColumn();

    if (!$name) {
        sendError("User tidak ditemukan.", 404);
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Menghapus akun kasir: $name"]);

    sendJson(["success" => true]);
}

// --- ROUTE 6: LOGS & AUDIT TRAIL ---
if ($route === 'logs' && $method === 'GET') {
    requireAuth();
    $stmt = $pdo->query("SELECT l.*, u.nama_lengkap FROM log_aktivitas l JOIN users u ON l.id_user = u.id ORDER BY l.id_log DESC LIMIT 200");
    $logs = $stmt->fetchAll();

    $typedLogs = [];
    foreach ($logs as $log) {
        $typedLogs[] = [
            "id_log" => (string)$log['id_log'],
            "id_user" => (string)$log['id_user'],
            "nama_lengkap" => $log['nama_lengkap'],
            "aktivitas" => $log['aktivitas'],
            "waktu" => $log['waktu']
        ];
    }
    sendJson($typedLogs);
}

// --- ROUTE 7: TRANSACTION ARCHIVE ---
if ($route === 'transaksi' && $method === 'GET') {
    requireAuth();
    $stmt = $pdo->query("SELECT * FROM transaksi ORDER BY id_transaksi DESC");
    $trx = $stmt->fetchAll();

    $typedTrx = [];
    foreach ($trx as $t) {
        $typedTrx[] = [
            "id_transaksi" => "trx-" . $t['id_transaksi'],
            "id_billing" => $t['id_billing'] ? (string)$t['id_billing'] : null,
            "total_sewa" => (int)$t['total_sewa'],
            "total_menu" => (int)$t['total_menu'],
            "total_bayar" => (int)$t['total_bayar'],
            "metode_pembayaran" => $t['metode_pembayaran'],
            "tanggal_transaksi" => $t['tanggal_transaksi']
        ];
    }
    sendJson($typedTrx);
}

if (preg_match('/^billing\/([0-9]+)$/', $route, $matches) && $method === 'GET') {
    requireAuth();
    $id_billing = (int)$matches[1];

    // Ambil billing
    $stmt = $pdo->prepare("SELECT b.*, u.nama_lengkap as nama_kasir, t.nama_tv, trx.metode_pembayaran 
                           FROM billing b 
                           JOIN users u ON b.id_user = u.id 
                           JOIN konsol_tv t ON b.id_tv = t.id_tv 
                           LEFT JOIN transaksi trx ON b.id_billing = trx.id_billing
                           WHERE b.id_billing = ?");
    $stmt->execute([$id_billing]);
    $bill = $stmt->fetch();

    if (!$bill) {
        sendError("Billing tidak ditemukan.", 404);
    }

    // Ambil menu items
    $mStmt = $pdo->prepare("SELECT d.*, i.nama_barang, i.harga_eceran 
                           FROM detail_transaksi_menu d 
                           JOIN inventori i ON d.id_barang = i.id_barang 
                           WHERE d.id_billing = ?");
    $mStmt->execute([$id_billing]);
    $menuItems = $mStmt->fetchAll();

    sendJson([
        "billing" => [
            "id_billing" => (string)$bill['id_billing'],
            "nama_tv" => $bill['nama_tv'],
            "waktu_mulai" => $bill['waktu_mulai'],
            "waktu_selesai" => $bill['waktu_selesai'],
            "durasi_menit" => (int)$bill['durasi_menit'],
            "tarif_per_jam" => (int)$bill['tarif_per_jam'],
            "total_sewa" => (int)$bill['total_sewa'],
            "total_menu" => (int)$bill['total_menu'],
            "total_bayar" => (int)$bill['total_bayar'],
            "status" => $bill['status'],
            "kasir" => $bill['nama_kasir'],
            "metode_pembayaran" => $bill['metode_pembayaran'] ?: 'cash'
        ],
        "menu_items" => $menuItems
    ]);
}

// --- ROUTE 8: ANALYTICAL HIERARCHY PROCESS (AHP) ---
if ($route === 'ahp' && $method === 'POST') {
    requireAuth();
    $body = getBody();
    $matrix = $body['matrix'] ?? null;

    // Load Class AHP
    $ahp_file = __DIR__ . '/models/AHP.php';
    if (!file_exists($ahp_file)) {
        sendError("Model AHP PHP tidak ditemukan.", 500);
    }
    require_once $ahp_file;

    // Load inventory untuk alternatif
    $stmt = $pdo->query("SELECT * FROM inventori ORDER BY id_barang ASC");
    $items = $stmt->fetchAll();

    $ahpItems = [];
    foreach ($items as $item) {
        $ahpItems[] = [
            "id_barang" => (string)$item['id_barang'],
            "nama_barang" => $item['nama_barang'],
            "stok_saat_ini" => (int)$item['stok_saat_ini'],
            "safety_stock" => (int)$item['safety_stock'],
            "harga_grosir" => (int)$item['harga_grosir'],
            "harga_eceran" => (int)$item['harga_eceran'],
            "jumlah_terjual" => (int)$item['jumlah_terjual']
        ];
    }

    $ahpInstance = new AHP($ahpItems, $matrix);
    $result = $ahpInstance->calculate();

    sendJson($result);
}

// --- ROUTE 9: RENTAL BAWA PULANG ---
if ($route === 'rental-bawa-pulang' && $method === 'GET') {
    requireAuth();
    $stmt = $pdo->query("SELECT * FROM rental_bawa_pulang ORDER BY id_rental ASC");
    $rental = $stmt->fetchAll();

    $typedRental = [];
    foreach ($rental as $r) {
        $detail = null;
        if ($r['status'] === 'disewa' && !empty($r['nama_pelanggan'])) {
            $detail = [
                "nama_pelanggan" => $r['nama_pelanggan'],
                "no_whatsapp" => $r['no_whatsapp'],
                "jaminan" => $r['jaminan'],
                "perintilan" => json_decode($r['perintilan'] ?? '[]', true),
                "waktu_mulai" => $r['waktu_mulai'],
                "durasi_hari" => (int)$r['durasi_hari'],
                "tarif_per_hari" => (int)$r['tarif_per_hari'],
                "total_bayar" => (int)$r['total_bayar'],
                "kondisi_keluar" => $r['kondisi_keluar'] ?: 'Bagus / Lengkap',
                "catatan" => $r['catatan'] ?: ''
            ];
        }

        $typedRental[] = [
            "id_rental" => $r['id_rental'],
            "nama_konsol" => $r['nama_konsol'],
            "jenis_konsol" => $r['jenis_konsol'],
            "status" => $r['status'],
            "detail" => $detail
        ];
    }
    sendJson($typedRental);
}

if ($route === 'laporan-kerusakan' && $method === 'GET') {
    requireAuth();
    $stmt = $pdo->query("SELECT * FROM laporan_kerusakan ORDER BY tanggal_laporan DESC");
    $laps = $stmt->fetchAll();

    $typedLaps = [];
    foreach ($laps as $l) {
        $typedLaps[] = [
            "id_laporan" => $l['id_laporan'],
            "id_rental" => $l['id_rental'],
            "nama_konsol" => $l['nama_konsol'],
            "nama_pelanggan" => $l['nama_pelanggan'],
            "tanggal_laporan" => $l['tanggal_laporan'],
            "detail_kerusakan" => $l['detail_kerusakan'],
            "denda" => (int)$l['denda'],
            "id_barang_inventori" => $l['id_barang_inventori'] ? (string)$l['id_barang_inventori'] : null,
            "nama_barang_inventori" => $l['nama_barang_inventori'] ?: null,
            "status" => $l['status']
        ];
    }
    sendJson($typedLaps);
}

if (preg_match('/^laporan-kerusakan\/([A-Za-z0-9\-]+)\/resolve$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_laporan = $matches[1];

    $stmt = $pdo->prepare("SELECT * FROM laporan_kerusakan WHERE id_laporan = ?");
    $stmt->execute([$id_laporan]);
    $lap = $stmt->fetch();

    if (!$lap) {
        sendError("Laporan kerusakan tidak ditemukan.", 404);
    }

    $pdo->beginTransaction();
    try {
        // Update laporan status
        $stmt = $pdo->prepare("UPDATE laporan_kerusakan SET status = 'selesai' WHERE id_laporan = ?");
        $stmt->execute([$id_laporan]);

        // Update matching inventory status to 'baik'
        if ($lap['id_barang_inventori']) {
            $stmtInv = $pdo->prepare("UPDATE inventori SET status = 'baik' WHERE id_barang = ?");
            $stmtInv->execute([$lap['id_barang_inventori']]);
        }

        // Log Activity
        $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
        $logStmt->execute([$currentUser['id'], "Menyelesaikan perbaikan laporan kerusakan: " . $lap['nama_konsol'] . " (Penyewa: " . $lap['nama_pelanggan'] . ")"]);

        $pdo->commit();
        sendJson(["success" => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendError("Gagal meresolve laporan: " . $e->getMessage());
    }
}

// Memulai rental sewa bawa pulang (Check-out)
if (preg_match('/^rental-bawa-pulang\/([A-Za-z0-9\-]+)\/rent$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_rental = $matches[1];
    $body = getBody();

    $nama_pelanggan = trim($body['nama_pelanggan'] ?? '');
    $no_whatsapp = trim($body['no_whatsapp'] ?? '');
    $jaminan = trim($body['jaminan'] ?? '');
    $perintilan = $body['perintilan'] ?? [];
    $durasi_hari = (int)($body['durasi_hari'] ?? 0);
    $tarif_per_hari = (int)($body['tarif_per_hari'] ?? 0);
    $kondisi_keluar = trim($body['kondisi_keluar'] ?? 'Bagus / Lengkap');
    $catatan = trim($body['catatan'] ?? '');

    if (empty($nama_pelanggan) || empty($no_whatsapp) || empty($jaminan) || !$durasi_hari || !$tarif_per_hari) {
        sendError("Nama Pelanggan, No WhatsApp, Jaminan, Durasi, dan Tarif wajib diisi.");
    }

    $stmt = $pdo->prepare("SELECT * FROM rental_bawa_pulang WHERE id_rental = ?");
    $stmt->execute([$id_rental]);
    $k = $stmt->fetch();

    if (!$k) {
        sendError("Konsol rental tidak ditemukan.", 404);
    }
    if ($k['status'] === 'disewa') {
        sendError("Konsol sedang disewa aktif.");
    }
    if ($k['status'] === 'maintenance') {
        sendError("Konsol sedang dalam pemeliharaan.");
    }

    $total_bayar = $durasi_hari * $tarif_per_hari;

    $stmt = $pdo->prepare("UPDATE rental_bawa_pulang SET 
        status = 'disewa',
        nama_pelanggan = ?,
        no_whatsapp = ?,
        jaminan = ?,
        perintilan = ?,
        waktu_mulai = NOW(),
        durasi_hari = ?,
        tarif_per_hari = ?,
        total_bayar = ?,
        kondisi_keluar = ?,
        catatan = ?
        WHERE id_rental = ?");
    $stmt->execute([
        $nama_pelanggan, 
        $no_whatsapp, 
        $jaminan, 
        json_encode($perintilan), 
        $durasi_hari, 
        $tarif_per_hari, 
        $total_bayar, 
        $kondisi_keluar, 
        $catatan, 
        $id_rental
    ]);

    // Log Activity
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Memulai sewa bawa pulang untuk " . $k['nama_konsol'] . " kepada $nama_pelanggan selama $durasi_hari hari (Kondisi keluar: $kondisi_keluar) via PHP"]);

    sendJson(["success" => true]);
}

// Mengembalikan rental sewa bawa pulang (Check-in & hitung denda)
if (preg_match('/^rental-bawa-pulang\/([A-Za-z0-9\-]+)\/return$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_rental = $matches[1];
    $body = getBody();

    $metode_pembayaran = trim($body['metode_pembayaran'] ?? 'cash');
    $kondisi_kembali = trim($body['kondisi_kembali'] ?? 'Sesuai / Lengkap');
    $denda_kerusakan = (int)($body['denda_kerusakan'] ?? 0);
    $id_barang_inventori = $body['id_barang_inventori'] ? (int)$body['id_barang_inventori'] : null;

    $stmt = $pdo->prepare("SELECT * FROM rental_bawa_pulang WHERE id_rental = ?");
    $stmt->execute([$id_rental]);
    $k = $stmt->fetch();

    if (!$k || $k['status'] !== 'disewa') {
        sendError("Konsol tidak sedang disewa aktif.");
    }

    $pdo->beginTransaction();
    try {
        $total_sewa = (int)$k['total_bayar'];
        $total_semua = $total_sewa + $denda_kerusakan;

        // 1. Simpan Transaksi Keuangan
        $insTrx = $pdo->prepare("INSERT INTO transaksi (id_billing, total_sewa, total_menu, total_bayar, metode_pembayaran, tanggal_transaksi) VALUES (NULL, ?, ?, ?, ?, NOW())");
        $insTrx->execute([$total_sewa, $denda_kerusakan, $total_semua, $metode_pembayaran]);
        $trxId = $pdo->lastInsertId();

        // 2. Cek apakah ada kerusakan otomatis
        $lowerKondisi = strtolower($kondisi_kembali);
        $isRusak = (strpos($lowerKondisi, 'rusak') !== false) || !empty($id_barang_inventori);

        if ($isRusak) {
            $matchedId = $id_barang_inventori;
            $matchedNama = '';

            if (!$matchedId) {
                // Auto detect
                if (strpos($lowerKondisi, 'stik') !== false || strpos($lowerKondisi, 'stick') !== false || strpos($lowerKondisi, 'controller') !== false) {
                    $matchedId = $pdo->query("SELECT id_barang FROM inventori WHERE LOWER(nama_barang) LIKE '%stik%' LIMIT 1")->fetchColumn();
                } else if (strpos($lowerKondisi, 'hdmi') !== false) {
                    $matchedId = $pdo->query("SELECT id_barang FROM inventori WHERE LOWER(nama_barang) LIKE '%hdmi%' LIMIT 1")->fetchColumn();
                } else if (strpos($lowerKondisi, 'power') !== false) {
                    $matchedId = $pdo->query("SELECT id_barang FROM inventori WHERE LOWER(nama_barang) LIKE '%power%' LIMIT 1")->fetchColumn();
                }
            }

            if ($matchedId) {
                // Update inventori status
                $updInv = $pdo->prepare("UPDATE inventori SET status = 'perlu perbaikan' WHERE id_barang = ?");
                $updInv->execute([$matchedId]);
                $matchedNama = $pdo->query("SELECT nama_barang FROM inventori WHERE id_barang = " . (int)$matchedId)->fetchColumn() ?: '';
            }

            // Create Laporan Kerusakan
            $lapId = 'lap-' . bin2hex(random_bytes(4));
            $insLap = $pdo->prepare("INSERT INTO laporan_kerusakan (id_laporan, id_rental, nama_konsol, nama_pelanggan, tanggal_laporan, detail_kerusakan, denda, id_barang_inventori, nama_barang_inventori, status) 
                                     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, 'perlu perbaikan')");
            $insLap->execute([$lapId, $id_rental, $k['nama_konsol'], $k['nama_pelanggan'], $kondisi_kembali, $denda_kerusakan, $matchedId, $matchedNama]);

            // Save log fine
            if ($denda_kerusakan > 0) {
                $fineLogStr = "DENDA KERUSAKAN DICATAT: Rp " . number_format($denda_kerusakan, 0, ',', '.') . " dikenakan kepada " . $k['nama_pelanggan'] . " untuk " . $k['nama_konsol'] . " karena kondisi: \"$kondisi_kembali\".";
                $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
                $logStmt->execute([$currentUser['id'], $fineLogStr]);
            }
        }

        // 3. Reset status rental bawa pulang
        $stmtReset = $pdo->prepare("UPDATE rental_bawa_pulang SET 
            status = 'tersedia',
            nama_pelanggan = NULL,
            no_whatsapp = NULL,
            jaminan = NULL,
            perintilan = NULL,
            waktu_mulai = NULL,
            durasi_hari = NULL,
            tarif_per_hari = NULL,
            total_bayar = NULL,
            kondisi_keluar = NULL,
            catatan = NULL
            WHERE id_rental = ?");
        $stmtReset->execute([$id_rental]);

        // Log Activity
        $logStr = "Menerima pengembalian konsol " . $k['nama_konsol'] . " dari " . $k['nama_pelanggan'] . ". Kondisi keluar: \"" . $k['kondisi_keluar'] . "\". Kondisi kembali: \"" . $kondisi_kembali . "\". Denda: Rp " . number_format($denda_kerusakan, 0, ',', '.') . ". Total tagihan Rp " . number_format($total_semua, 0, ',', '.') . " LUNAS.";
        $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
        $logStmt->execute([$currentUser['id'], $logStr]);

        $pdo->commit();
        sendJson([
            "success" => true,
            "transaksi" => [
                "id_transaksi" => "trx-" . $trxId,
                "id_billing" => null,
                "total_sewa" => $total_sewa,
                "total_menu" => $denda_kerusakan,
                "total_bayar" => $total_semua,
                "metode_pembayaran" => $metode_pembayaran,
                "tanggal_transaksi" => date('Y-m-d H:i:s')
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        sendError("Gagal memproses pengembalian: " . $e->getMessage());
    }
}

// Mengubah status maintenance/free rental secara manual
if (preg_match('/^rental-bawa-pulang\/([A-Za-z0-9\-]+)\/(maintenance|free)$/', $route, $matches) && $method === 'POST') {
    requireAuth();
    $id_rental = $matches[1];
    $action = $matches[2];
    $targetStatus = $action === 'maintenance' ? 'maintenance' : 'tersedia';

    $stmt = $pdo->prepare("SELECT * FROM rental_bawa_pulang WHERE id_rental = ?");
    $stmt->execute([$id_rental]);
    $k = $stmt->fetch();

    if (!$k) {
        sendError("Konsol tidak ditemukan.", 404);
    }
    if ($k['status'] === 'disewa') {
        sendError("Konsol sedang disewa aktif, tidak bisa di-maintenance.");
    }

    $stmt = $pdo->prepare("UPDATE rental_bawa_pulang SET status = ? WHERE id_rental = ?");
    $stmt->execute([$targetStatus, $id_rental]);

    // Log
    $logStmt = $pdo->prepare("INSERT INTO log_aktivitas (id_user, aktivitas) VALUES (?, ?)");
    $logStmt->execute([$currentUser['id'], "Mengubah status rental " . $k['nama_konsol'] . " menjadi " . ($action === 'maintenance' ? 'Maintenance' : 'Tersedia')]);

    sendJson(["success" => true]);
}

// Catch-all route error
sendError("Endpoint " . $_SERVER['REQUEST_METHOD'] . " /api/" . $route . " tidak valid atau tidak diimplementasikan.", 404);
