import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { loadDb, saveDb, writeLog, hashPassword } from './server-db';
import { calculateAHP } from './src/server/ahp';
import { User, KonsolTV, Billing, Inventori, DetailTransaksiMenu, Transaksi, LaporanKerusakan, LogAktivitas } from './src/types';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// In-memory session store (token -> User)
const SESSIONS: Record<string, User> = {};

// WebSocket Clients set
const wsClients = new Set<WebSocket>();

// Initialize WebSocket Server on same port
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`WebSocket client connected. Total clients: ${wsClients.size}`);
  
  // Send welcome event
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Sumo PS WS Server' }));

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`WebSocket client disconnected. Total clients: ${wsClients.size}`);
  });
});

// Broadcast helper
function broadcast(event: { type: string; data: any }) {
  const payload = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Write log and broadcast in real-time over WebSocket
function logAndBroadcast(userId: string, activity: string) {
  writeLog(userId, activity);
  try {
    const db = loadDb();
    const latestLog = db.log_aktivitas[0];
    if (latestLog) {
      broadcast({ type: 'log:new', data: latestLog });
    }
  } catch (err) {
    console.error('Failed to broadcast new log:', err);
  }
}

// Auth Middleware
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.' });
  }
  const token = authHeader.split(' ')[1];
  const user = SESSIONS[token];
  if (!user) {
    return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
  }
  req.user = user;
  req.token = token;
  next();
}

// ------------------- API ROUTES -------------------

// 1. Auth API
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const db = loadDb();
  const user = db.users.find(u => u.username === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Username tidak ditemukan.' });
  }

  const hashedPassword = hashPassword(password);
  const storedPassword = db.user_passwords[user.id];

  if (hashedPassword !== storedPassword) {
    return res.status(401).json({ error: 'Password salah.' });
  }

  // Generate session token
  const token = 'tok-' + crypto.randomUUID();
  SESSIONS[token] = user;

  // Log activity
  logAndBroadcast(user.id, `User ${user.nama_lengkap} berhasil login`);

  res.json({ token, user });
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authMiddleware, (req: any, res) => {
  logAndBroadcast(req.user.id, `User ${req.user.nama_lengkap} keluar dari sistem (logout)`);
  delete SESSIONS[req.token];
  res.json({ success: true });
});

// 2. PlayStation / TV slots API
app.get('/api/konsol', authMiddleware, (req, res) => {
  const db = loadDb();
  
  // Enhance active billing details with current elapsed time if active
  const enhancedTVs = db.konsol_tv.map(tv => {
    let activeBilling: Billing | null = null;
    if (tv.status === 'digunakan') {
      const active = db.billing.find(b => b.id_tv === tv.id_tv && b.status === 'aktif');
      if (active) {
        // Calculate current usage
        const startTime = new Date(active.waktu_mulai).getTime();
        const now = Date.now();
        const elapsedMinutes = Math.floor((now - startTime) / 60000);
        const costSewa = Math.ceil((elapsedMinutes / 60) * active.tarif_per_jam);
        activeBilling = {
          ...active,
          durasi_menit: elapsedMinutes,
          total_sewa: costSewa,
          total_bayar: costSewa + active.total_menu
        };
      }
    }
    return {
      ...tv,
      activeBilling
    };
  });

  res.json(enhancedTVs);
});

// Start billing
app.post('/api/konsol/:id/start', authMiddleware, (req: any, res) => {
  const id_tv = parseInt(req.params.id);
  const { jenis_billing, durasi_menit, tarif_per_jam } = req.body; // jenis_billing can be "open" or "package"

  const db = loadDb();
  const tv = db.konsol_tv.find(t => t.id_tv === id_tv);
  if (!tv) {
    return res.status(404).json({ error: 'PlayStation TV tidak ditemukan.' });
  }
  if (tv.status !== 'kosong' && tv.status !== 'booking') {
    return res.status(400).json({ error: 'TV sedang digunakan atau dalam pemeliharaan.' });
  }

  const id_billing = 'bil-' + Math.random().toString(36).substring(2, 11);
  const waktu_mulai = new Date().toISOString();

  const newBilling: Billing = {
    id_billing,
    id_tv,
    id_user: req.user.id,
    waktu_mulai,
    waktu_selesai: null,
    durasi_menit: jenis_billing === 'package' ? parseInt(durasi_menit) : 0,
    tarif_per_jam: parseInt(tarif_per_jam) || 10000,
    total_sewa: 0,
    total_menu: 0,
    total_bayar: 0,
    status: 'aktif'
  };

  tv.status = 'digunakan';
  db.billing.push(newBilling);
  
  saveDb(db);
  logAndBroadcast(req.user.id, `Memulai sewa untuk ${tv.nama_tv} (${tv.jenis_konsol})`);

  // Broadcast WebSocket notification
  broadcast({ type: 'tv:status_changed', data: { id_tv, status: 'digunakan', nama_tv: tv.nama_tv } });

  res.json({ success: true, billing: newBilling });
});

// Set state: Booking
app.post('/api/konsol/:id/booking', authMiddleware, (req: any, res) => {
  const id_tv = parseInt(req.params.id);
  const db = loadDb();
  const tv = db.konsol_tv.find(t => t.id_tv === id_tv);
  if (!tv) return res.status(404).json({ error: 'TV tidak ditemukan.' });

  tv.status = 'booking';
  saveDb(db);
  logAndBroadcast(req.user.id, `Mengubah status ${tv.nama_tv} menjadi Booking`);
  broadcast({ type: 'tv:status_changed', data: { id_tv, status: 'booking', nama_tv: tv.nama_tv } });
  res.json({ success: true });
});

// Set state: Maintenance
app.post('/api/konsol/:id/maintenance', authMiddleware, (req: any, res) => {
  const id_tv = parseInt(req.params.id);
  const db = loadDb();
  const tv = db.konsol_tv.find(t => t.id_tv === id_tv);
  if (!tv) return res.status(404).json({ error: 'TV tidak ditemukan.' });

  tv.status = 'maintenance';
  saveDb(db);
  logAndBroadcast(req.user.id, `Mengubah status ${tv.nama_tv} menjadi Maintenance`);
  broadcast({ type: 'tv:status_changed', data: { id_tv, status: 'maintenance', nama_tv: tv.nama_tv } });
  res.json({ success: true });
});

// Set state: Free (kosong)
app.post('/api/konsol/:id/free', authMiddleware, (req: any, res) => {
  const id_tv = parseInt(req.params.id);
  const db = loadDb();
  const tv = db.konsol_tv.find(t => t.id_tv === id_tv);
  if (!tv) return res.status(404).json({ error: 'TV tidak ditemukan.' });

  tv.status = 'kosong';
  saveDb(db);
  logAndBroadcast(req.user.id, `Mengubah status ${tv.nama_tv} menjadi Kosong/Tersedia`);
  broadcast({ type: 'tv:status_changed', data: { id_tv, status: 'kosong', nama_tv: tv.nama_tv } });
  res.json({ success: true });
});

// Stop / checkout billing
app.post('/api/konsol/:id/stop', authMiddleware, (req: any, res) => {
  const id_tv = parseInt(req.params.id);
  const { metode_pembayaran } = req.body;

  if (!metode_pembayaran) {
    return res.status(400).json({ error: 'Metode pembayaran wajib dipilih.' });
  }

  const db = loadDb();
  const tv = db.konsol_tv.find(t => t.id_tv === id_tv);
  if (!tv) return res.status(404).json({ error: 'TV tidak ditemukan.' });

  const activeBillingIndex = db.billing.findIndex(b => b.id_tv === id_tv && b.status === 'aktif');
  if (activeBillingIndex === -1) {
    return res.status(400).json({ error: 'Tidak ada billing aktif pada TV ini.' });
  }

  const active = db.billing[activeBillingIndex];
  const startTime = new Date(active.waktu_mulai).getTime();
  const endTime = new Date().toISOString();
  const now = Date.now();

  // If it was a package, we charge standard package time. If open play, calculate dynamic time
  let finalMinutes = Math.floor((now - startTime) / 60000);
  if (finalMinutes < 1) finalMinutes = 1; // Minimum 1 minute

  let costSewa = 0;
  if (active.durasi_menit > 0) {
    // Package play: predefined duration
    costSewa = Math.ceil((active.durasi_menit / 60) * active.tarif_per_jam);
    finalMinutes = active.durasi_menit; // set to package minutes
  } else {
    // Open play: calculated dynamically
    costSewa = Math.ceil((finalMinutes / 60) * active.tarif_per_jam);
  }

  // Update billing record
  active.waktu_selesai = endTime;
  active.durasi_menit = finalMinutes;
  active.total_sewa = costSewa;
  active.total_bayar = costSewa + active.total_menu;
  active.status = 'selesai';

  // Release TV
  tv.status = 'kosong';

  // Create official Transaction
  const id_transaksi = 'trx-' + Math.random().toString(36).substring(2, 11);
  const newTransaksi: Transaksi = {
    id_transaksi,
    id_billing: active.id_billing,
    id_tv: id_tv,
    total_sewa: active.total_sewa,
    total_menu: active.total_menu,
    total_bayar: active.total_bayar,
    metode_pembayaran,
    tanggal_transaksi: endTime,
    durasi_menit: finalMinutes
  };

  db.transaksi.push(newTransaksi);
  saveDb(db);

  logAndBroadcast(req.user.id, `Selesai sewa ${tv.nama_tv}. Total Bayar: Rp ${active.total_bayar.toLocaleString('id-ID')}`);

  // Broadcast WebSocket event: TV is now free (Owner gets real-time notice!)
  broadcast({
    type: 'tv:checkout',
    data: {
      id_tv,
      nama_tv: tv.nama_tv,
      total_bayar: active.total_bayar,
      total_sewa: active.total_sewa,
      total_menu: active.total_menu
    }
  });

  const menuItems = db.detail_transaksi_menu.filter(d => d.id_billing === active.id_billing);

  res.json({
    success: true,
    transaksi: newTransaksi,
    billing: active,
    tv: {
      id_tv: tv.id_tv,
      nama_tv: tv.nama_tv,
      jenis_konsol: tv.jenis_konsol
    },
    menu_items: menuItems,
    kasir: req.user.nama_lengkap
  });
});

// 3. Menu / Orders API (with full Database Transaction simulation!)
app.post('/api/menu/order', authMiddleware, (req: any, res) => {
  const { id_billing, items } = req.body; // items: [{ id_barang, jumlah }]

  if (!id_billing || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Parameter pesanan tidak lengkap.' });
  }

  // DATABASE TRANSACTION SIMULATION (BeginTransaction)
  const db = loadDb();
  
  // Clone current db state to allow rollback in case of issues
  const dbBackup = JSON.parse(JSON.stringify(db));

  try {
    const billing = db.billing.find(b => b.id_billing === id_billing && b.status === 'aktif');
    if (!billing) {
      throw new Error('Billing tidak ditemukan atau sudah tidak aktif.');
    }

    let orderedMenuTotal = 0;
    const detailsAdded: DetailTransaksiMenu[] = [];

    // Process each ordered item
    for (const orderItem of items) {
      const item = db.inventori.find(i => i.id_barang === orderItem.id_barang);
      if (!item) {
        throw new Error(`Barang dengan ID ${orderItem.id_barang} tidak ditemukan.`);
      }

      const orderQty = parseInt(orderItem.jumlah);
      if (isNaN(orderQty) || orderQty <= 0) {
        throw new Error(`Jumlah pembelian untuk ${item.nama_barang} tidak valid.`);
      }

      if (item.stok_saat_ini < orderQty) {
        throw new Error(`Stok tidak mencukupi untuk ${item.nama_barang}. Stok saat ini: ${item.stok_saat_ini}, diminta: ${orderQty}`);
      }

      // Subtract inventory stock
      item.stok_saat_ini -= orderQty;
      item.jumlah_terjual += orderQty;

      // Compute subtotal
      const subtotal = orderQty * item.harga_eceran;
      orderedMenuTotal += subtotal;

      // Create detail record
      const id_detail = 'det-' + Math.random().toString(36).substring(2, 11);
      const detail: DetailTransaksiMenu = {
        id_detail,
        id_billing,
        id_barang: item.id_barang,
        nama_barang: item.nama_barang,
        jumlah: orderQty,
        subtotal
      };

      db.detail_transaksi_menu.push(detail);
      detailsAdded.push(detail);
    }

    // Update billing details
    billing.total_menu += orderedMenuTotal;
    billing.total_bayar += orderedMenuTotal;

    // COMMIT changes to disk
    saveDb(db);

    const tv = db.konsol_tv.find(t => t.id_tv === billing.id_tv);
    const tvName = tv ? tv.nama_tv : `TV ${billing.id_tv}`;

    logAndBroadcast(req.user.id, `Menambahkan pesanan menu ke ${tvName}. Total: Rp ${orderedMenuTotal.toLocaleString('id-ID')}`);

    // WebSocket notification of menu order! Broadcast to owner immediately!
    broadcast({
      type: 'menu:order',
      data: {
        id_billing,
        tv_name: tvName,
        total_order: orderedMenuTotal,
        items: detailsAdded.map(d => ({ nama_barang: d.nama_barang, jumlah: d.jumlah }))
      }
    });

    res.json({ success: true, total_order: orderedMenuTotal, items: detailsAdded });

  } catch (error: any) {
    // ROLLBACK changes
    console.error('Database transaction failed. Rolling back...', error.message);
    saveDb(dbBackup); // Restore backup state
    res.status(400).json({ error: error.message });
  }
});

// Get ordered items for a billing
app.get('/api/menu/order/:id_billing', authMiddleware, (req, res) => {
  const db = loadDb();
  const details = db.detail_transaksi_menu.filter(d => d.id_billing === req.params.id_billing);
  res.json(details);
});

// 4. Inventory CRUD API
app.get('/api/inventori', authMiddleware, (req, res) => {
  const db = loadDb();
  res.json(db.inventori);
});

app.post('/api/inventori', authMiddleware, (req: any, res) => {
  const { nama_barang, stok_saat_ini, safety_stock, harga_grosir, harga_eceran } = req.body;

  if (!nama_barang || stok_saat_ini === undefined || safety_stock === undefined || harga_grosir === undefined || harga_eceran === undefined) {
    return res.status(400).json({ error: 'Seluruh data inventori wajib diisi.' });
  }

  const db = loadDb();
  const id_barang = 'brg-' + Math.random().toString(36).substring(2, 11);

  const newItem: Inventori = {
    id_barang,
    kategori: req.body.kategori || 'Makanan',
    status: req.body.status || 'baik',
    nama_barang,
    stok_saat_ini: parseInt(stok_saat_ini),
    safety_stock: parseInt(safety_stock),
    harga_grosir: parseInt(harga_grosir),
    harga_eceran: parseInt(harga_eceran),
    jumlah_terjual: 0
  };

  db.inventori.push(newItem);
  saveDb(db);

  logAndBroadcast(req.user.id, `Menambahkan barang baru ke inventori: ${nama_barang}`);

  res.json({ success: true, item: newItem });
});

app.put('/api/inventori/:id', authMiddleware, (req: any, res) => {
  const id_barang = req.params.id;
  const { nama_barang, stok_saat_ini, safety_stock, harga_grosir, harga_eceran, jumlah_terjual } = req.body;

  const db = loadDb();
  const index = db.inventori.findIndex(i => i.id_barang === id_barang);
  if (index === -1) {
    return res.status(404).json({ error: 'Barang tidak ditemukan.' });
  }

  const updatedItem: Inventori = {
    id_barang,
    kategori: req.body.kategori || db.inventori[index].kategori || 'Makanan',
    status: req.body.status || db.inventori[index].status || 'baik',
    nama_barang: nama_barang || db.inventori[index].nama_barang,
    stok_saat_ini: stok_saat_ini !== undefined ? parseInt(stok_saat_ini) : db.inventori[index].stok_saat_ini,
    safety_stock: safety_stock !== undefined ? parseInt(safety_stock) : db.inventori[index].safety_stock,
    harga_grosir: harga_grosir !== undefined ? parseInt(harga_grosir) : db.inventori[index].harga_grosir,
    harga_eceran: harga_eceran !== undefined ? parseInt(harga_eceran) : db.inventori[index].harga_eceran,
    jumlah_terjual: jumlah_terjual !== undefined ? parseInt(jumlah_terjual) : db.inventori[index].jumlah_terjual
  };

  db.inventori[index] = updatedItem;
  saveDb(db);

  logAndBroadcast(req.user.id, `Memperbarui data barang: ${updatedItem.nama_barang}`);

  res.json({ success: true, item: updatedItem });
});

app.delete('/api/inventori/:id', authMiddleware, (req: any, res) => {
  const id_barang = req.params.id;
  const db = loadDb();
  const index = db.inventori.findIndex(i => i.id_barang === id_barang);
  if (index === -1) {
    return res.status(404).json({ error: 'Barang tidak ditemukan.' });
  }

  const itemName = db.inventori[index].nama_barang;
  db.inventori.splice(index, 1);
  saveDb(db);

  logAndBroadcast(req.user.id, `Menghapus barang dari inventori: ${itemName}`);

  res.json({ success: true });
});

// 4b. Laporan Kerusakan API
app.get('/api/laporan-kerusakan', authMiddleware, (req, res) => {
  const db = loadDb();
  res.json(db.laporan_kerusakan || []);
});

app.put('/api/laporan-kerusakan/:id/resolve', authMiddleware, (req: any, res) => {
  const { id } = req.params;
  const db = loadDb();
  if (!db.laporan_kerusakan) db.laporan_kerusakan = [];
  
  const index = db.laporan_kerusakan.findIndex(l => l.id_laporan === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Laporan kerusakan tidak ditemukan.' });
  }

  const report = db.laporan_kerusakan[index];
  report.status = 'selesai diperbaiki';

  // Also update corresponding inventory item back to 'baik'
  if (report.id_barang_inventori) {
    const invItem = db.inventori.find(i => i.id_barang === report.id_barang_inventori);
    if (invItem) {
      invItem.status = 'baik';
    }
  }

  saveDb(db);
  logAndBroadcast(req.user.id, `Menyelesaikan perbaikan untuk laporan kerusakan #${id} (${report.nama_konsol} - ${report.detail_kerusakan}).`);

  broadcast({ type: 'rental:status_changed', data: { id_rental: report.id_rental, status: 'resolved' } });

  res.json({ success: true, report });
});

// 5. Statistics / Report API
app.get('/api/transaksi', authMiddleware, (req, res) => {
  const db = loadDb();

  // Calculate high level summaries
  const todayStr = new Date().toISOString().split('T')[0];
  
  let totalIncome = 0;
  let todayIncome = 0;
  let rentIncome = 0;
  let menuIncome = 0;

  db.transaksi.forEach(t => {
    totalIncome += t.total_bayar;
    rentIncome += t.total_sewa;
    menuIncome += t.total_menu;

    if (t.tanggal_transaksi.startsWith(todayStr)) {
      todayIncome += t.total_bayar;
    }
  });

  // Calculate 7 Days Income trend for Chart.js / visual charts
  const incomeTrend7Days: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    incomeTrend7Days[dateStr] = 0;
  }

  db.transaksi.forEach(t => {
    const dateStr = t.tanggal_transaksi.split('T')[0];
    if (incomeTrend7Days[dateStr] !== undefined) {
      incomeTrend7Days[dateStr] += t.total_bayar;
    }
  });

  const chartData = Object.keys(incomeTrend7Days).map(date => ({
    tanggal: date,
    total: incomeTrend7Days[date]
  }));

  // Popular menu sales
  const menuSales: Record<string, { nama: string; qty: number; revenue: number }> = {};
  db.detail_transaksi_menu.forEach(d => {
    if (!menuSales[d.id_barang]) {
      menuSales[d.id_barang] = { nama: d.nama_barang, qty: 0, revenue: 0 };
    }
    menuSales[d.id_barang].qty += d.jumlah;
    menuSales[d.id_barang].revenue += d.subtotal;
  });

  const popularMenus = Object.values(menuSales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  res.json({
    summary: {
      totalIncome,
      todayIncome,
      rentIncome,
      menuIncome,
      totalTrxCount: db.transaksi.length,
      activeTvCount: db.konsol_tv.filter(t => t.status === 'digunakan').length
    },
    chartData,
    popularMenus,
    list: db.transaksi.sort((a, b) => b.tanggal_transaksi.localeCompare(a.tanggal_transaksi))
  });
});

// 6. Activity Log API
app.get('/api/logs', authMiddleware, (req, res) => {
  const db = loadDb();
  res.json(db.log_aktivitas.slice(0, 100)); // Limit to last 100 logs
});

// 7. AHP API
app.post('/api/ahp', authMiddleware, (req, res) => {
  const { matrix, activeCriteria } = req.body; // Allows client to post custom matrices
  const db = loadDb();
  const ahpResult = calculateAHP(db.inventori, matrix, activeCriteria);
  res.json(ahpResult);
});

// 8. User Management API (Pemilik Only)
app.get('/api/users', authMiddleware, (req: any, res) => {
  if (req.user.role !== 'pemilik') {
    return res.status(403).json({ error: 'Akses ditolak. Menu ini hanya untuk Pemilik.' });
  }
  const db = loadDb();
  res.json(db.users);
});

app.post('/api/users', authMiddleware, (req: any, res) => {
  if (req.user.role !== 'pemilik') {
    return res.status(403).json({ error: 'Akses ditolak. Menu ini hanya untuk Pemilik.' });
  }
  const { username, nama_lengkap, role, password } = req.body;
  if (!username || !nama_lengkap || !role || !password) {
    return res.status(400).json({ error: 'Username, Nama Lengkap, Role, dan Password wajib diisi.' });
  }

  const db = loadDb();
  const lowerUsername = username.toLowerCase().trim();
  if (db.users.some(u => u.username === lowerUsername)) {
    return res.status(400).json({ error: 'Username sudah digunakan oleh akun lain.' });
  }

  const id = 'user-' + Math.random().toString(36).substring(2, 11);
  const newUser: User = {
    id,
    username: lowerUsername,
    nama_lengkap,
    role,
    created_at: new Date().toISOString()
  };

  db.users.push(newUser);
  db.user_passwords[id] = hashPassword(password);
  saveDb(db);

  writeLog(req.user.id, `Menambahkan pegawai/user baru: ${nama_lengkap} (${role})`);
  res.json({ success: true, user: newUser });
});

app.put('/api/users/:id', authMiddleware, (req: any, res) => {
  if (req.user.role !== 'pemilik') {
    return res.status(403).json({ error: 'Akses ditolak. Menu ini hanya untuk Pemilik.' });
  }
  const { id } = req.params;
  const { username, nama_lengkap, role, password } = req.body;

  const db = loadDb();
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }

  const lowerUsername = username ? username.toLowerCase().trim() : db.users[index].username;
  if (username && db.users.some(u => u.id !== id && u.username === lowerUsername)) {
    return res.status(400).json({ error: 'Username sudah digunakan oleh akun lain.' });
  }

  const existingUser = db.users[index];
  existingUser.username = lowerUsername;
  existingUser.nama_lengkap = nama_lengkap || existingUser.nama_lengkap;
  existingUser.role = role || existingUser.role;

  if (password) {
    db.user_passwords[id] = hashPassword(password);
  }

  saveDb(db);
  logAndBroadcast(req.user.id, `Memperbarui data pegawai/user: ${existingUser.nama_lengkap}`);
  res.json({ success: true, user: existingUser });
});

app.delete('/api/users/:id', authMiddleware, (req: any, res) => {
  if (req.user.role !== 'pemilik') {
    return res.status(403).json({ error: 'Akses ditolak. Menu ini hanya untuk Pemilik.' });
  }
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
  }

  const db = loadDb();
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }

  const user = db.users[index];
  db.users.splice(index, 1);
  delete db.user_passwords[id];
  saveDb(db);

  logAndBroadcast(req.user.id, `Menghapus akun pegawai/user: ${user.nama_lengkap}`);
  res.json({ success: true });
});

// 9. Rental Bawa Pulang API
app.get('/api/rental-bawa-pulang', authMiddleware, (req, res) => {
  const db = loadDb();
  res.json(db.rental_bawa_pulang || []);
});

app.post('/api/rental-bawa-pulang/:id/rent', authMiddleware, (req: any, res) => {
  const { id } = req.params;
  const { nama_pelanggan, no_whatsapp, jaminan, perintilan, durasi_hari, tarif_per_hari, kondisi_keluar, catatan } = req.body;

  if (!nama_pelanggan || !no_whatsapp || !jaminan || !durasi_hari || !tarif_per_hari) {
    return res.status(400).json({ error: 'Nama Pelanggan, No WhatsApp, Jaminan, Durasi, dan Tarif wajib diisi.' });
  }

  const db = loadDb();
  const index = db.rental_bawa_pulang.findIndex(r => r.id_rental === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Konsol rental tidak ditemukan.' });
  }

  const k = db.rental_bawa_pulang[index];
  if (k.status === 'disewa') {
    return res.status(400).json({ error: 'Konsol sedang disewa.' });
  }
  if (k.status === 'maintenance') {
    return res.status(400).json({ error: 'Konsol sedang dalam pemeliharaan.' });
  }

  const total_bayar = parseInt(durasi_hari) * parseInt(tarif_per_hari);

  k.status = 'disewa';
  k.detail = {
    nama_pelanggan,
    no_whatsapp,
    jaminan,
    perintilan: perintilan || [],
    waktu_mulai: new Date().toISOString(),
    durasi_hari: parseInt(durasi_hari),
    tarif_per_hari: parseInt(tarif_per_hari),
    total_bayar,
    kondisi_keluar: kondisi_keluar || 'Bagus / Lengkap',
    catatan: catatan || ''
  };

  saveDb(db);
  logAndBroadcast(req.user.id, `Memulai sewa bawa pulang untuk ${k.nama_konsol} kepada ${nama_pelanggan} selama ${durasi_hari} hari (Kondisi keluar: ${k.detail.kondisi_keluar}).`);
  
  broadcast({ type: 'rental:status_changed', data: { id_rental: id, status: 'disewa' } });

  res.json({ success: true, rental: k });
});

app.post('/api/rental-bawa-pulang/:id/return', authMiddleware, (req: any, res) => {
  const { id } = req.params;
  const { metode_pembayaran, kondisi_kembali, denda_kerusakan, id_barang_inventori } = req.body;

  if (!metode_pembayaran) {
    return res.status(400).json({ error: 'Metode pembayaran wajib dipilih.' });
  }

  const db = loadDb();
  const index = db.rental_bawa_pulang.findIndex(r => r.id_rental === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Konsol rental tidak ditemukan.' });
  }

  const k = db.rental_bawa_pulang[index];
  if (k.status !== 'disewa' || !k.detail) {
    return res.status(400).json({ error: 'Konsol ini tidak sedang disewa.' });
  }

  const detail = k.detail;
  const denda = parseInt(denda_kerusakan) || 0;
  const total_semua = detail.total_bayar + denda;
  
  // Create a Transaction in db.transaksi
  const newTransaksi: Transaksi = {
    id_transaksi: 'trx-' + Math.random().toString(36).substring(2, 11),
    id_billing: null,
    id_tv: null, // null for rental bawa pulang
    total_sewa: detail.total_bayar,
    total_menu: denda, // Store the fine inside total_menu (or keep total_sewa/total_menu representing fine as additional item)
    total_bayar: total_semua,
    metode_pembayaran: metode_pembayaran as any,
    tanggal_transaksi: new Date().toISOString(),
    durasi_menit: detail.durasi_hari * 24 * 60
  };

  db.transaksi.push(newTransaksi);

  // Automatic Damage Report logic
  const lowerKondisi = (kondisi_kembali || '').toLowerCase();
  const isRusak = lowerKondisi.includes('rusak') || !!id_barang_inventori;
  
  if (isRusak) {
    let matchedId = id_barang_inventori;
    let matchedNama = '';

    // If no direct ID was selected, try to auto-detect from description
    if (!matchedId) {
      let detectedItem = null;
      if (lowerKondisi.includes('stik') || lowerKondisi.includes('stick') || lowerKondisi.includes('controller')) {
        detectedItem = db.inventori.find(i => i.nama_barang.toLowerCase().includes('stik'));
      } else if (lowerKondisi.includes('hdmi')) {
        detectedItem = db.inventori.find(i => i.nama_barang.toLowerCase().includes('hdmi'));
      } else if (lowerKondisi.includes('kabel power') || lowerKondisi.includes('power')) {
        detectedItem = db.inventori.find(i => i.nama_barang.toLowerCase().includes('power'));
      }
      
      if (detectedItem) {
        matchedId = detectedItem.id_barang;
        matchedNama = detectedItem.nama_barang;
      }
    } else {
      const item = db.inventori.find(i => i.id_barang === matchedId);
      if (item) {
        matchedNama = item.nama_barang;
      }
    }

    // Update matching inventory item status to 'perlu perbaikan'
    if (matchedId) {
      const invItem = db.inventori.find(i => i.id_barang === matchedId);
      if (invItem) {
        invItem.status = 'perlu perbaikan';
      }
    }

    // Save damage report
    const newLaporan: LaporanKerusakan = {
      id_laporan: 'lap-' + Math.random().toString(36).substring(2, 11),
      id_rental: id,
      nama_konsol: k.nama_konsol,
      nama_pelanggan: detail.nama_pelanggan,
      tanggal_laporan: new Date().toISOString(),
      detail_kerusakan: kondisi_kembali || 'Rusak',
      denda,
      id_barang_inventori: matchedId || undefined,
      nama_barang_inventori: matchedNama || undefined,
      status: 'perlu perbaikan'
    };

    if (!db.laporan_kerusakan) {
      db.laporan_kerusakan = [];
    }
    db.laporan_kerusakan.push(newLaporan);

    // Save a separate fine log
    if (denda > 0) {
      const fineLog: LogAktivitas = {
        id_log: 'log-' + Math.random().toString(36).substring(2, 11),
        id_user: req.user.id,
        nama_lengkap: req.user.nama_lengkap,
        aktivitas: `DENDA KERUSAKAN DICATAT: Rp ${denda.toLocaleString('id-ID')} dikenakan kepada ${detail.nama_pelanggan} untuk ${k.nama_konsol} karena kondisi: "${kondisi_kembali}". Barang inventori terdampak: "${matchedNama || 'Umum'}".`,
        waktu: new Date().toISOString()
      };
      db.log_aktivitas.unshift(fineLog);
    }
  }

  // Clear rental details and release console
  k.status = 'tersedia';
  k.detail = undefined;

  saveDb(db);
  logAndBroadcast(req.user.id, `Menerima pengembalian konsol ${k.nama_konsol} dari ${detail.nama_pelanggan}. Kondisi keluar: "${detail.kondisi_keluar}". Kondisi kembali: "${kondisi_kembali || 'Sesuai / Lengkap'}". Denda kerusakan: Rp ${denda.toLocaleString('id-ID')}. Total tagihan Rp ${total_semua.toLocaleString('id-ID')} lunas.`);

  broadcast({ type: 'rental:status_changed', data: { id_rental: id, status: 'tersedia' } });
  broadcast({ type: 'tv:checkout', data: { nama_tv: k.nama_konsol, total_bayar: total_semua } });

  res.json({ success: true, transaksi: newTransaksi });
});

app.post('/api/rental-bawa-pulang/:id/maintenance', authMiddleware, (req: any, res) => {
  const { id } = req.params;
  const db = loadDb();
  const index = db.rental_bawa_pulang.findIndex(r => r.id_rental === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Konsol rental tidak ditemukan.' });
  }

  const k = db.rental_bawa_pulang[index];
  if (k.status === 'disewa') {
    return res.status(400).json({ error: 'Konsol sedang disewa, tidak bisa di-maintenance.' });
  }

  k.status = 'maintenance';
  saveDb(db);
  logAndBroadcast(req.user.id, `Mengubah status ${k.nama_konsol} menjadi Maintenance.`);
  broadcast({ type: 'rental:status_changed', data: { id_rental: id, status: 'maintenance' } });
  res.json({ success: true, rental: k });
});

app.post('/api/rental-bawa-pulang/:id/free', authMiddleware, (req: any, res) => {
  const { id } = req.params;
  const db = loadDb();
  const index = db.rental_bawa_pulang.findIndex(r => r.id_rental === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Konsol rental tidak ditemukan.' });
  }

  const k = db.rental_bawa_pulang[index];
  k.status = 'tersedia';
  saveDb(db);
  logAndBroadcast(req.user.id, `Mengubah status ${k.nama_konsol} menjadi Tersedia.`);
  broadcast({ type: 'rental:status_changed', data: { id_rental: id, status: 'tersedia' } });
  res.json({ success: true, rental: k });
});

// ------------------- VITE MIDDLEWARE SETUP -------------------


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sumo PlayStation backend running on http://localhost:${PORT}`);
  });
}

startServer();
