<?php
/**
 * Analytical Hierarchy Process (AHP) PHP Class for Sumo PlayStation
 * Berfungsi untuk menghitung prioritas pengadaan barang inventori.
 */

class AHP {
    private $ri_table = [
        1 => 0.00,
        2 => 0.00,
        3 => 0.58,
        4 => 0.90,
        5 => 1.12,
        6 => 1.24,
        7 => 1.32,
        8 => 1.41,
        9 => 1.45,
        10 => 1.49
    ];

    private $criteria_matrix;
    private $items;

    public function __construct($items, $matrix = null) {
        $this->items = $items;
        // Default pairwise matrix untuk 4 kriteria: [Stok, Safety Stock, Profit, Terjual]
        $this->criteria_matrix = $matrix ?? [
            [1.0,       0.3333,    0.5,       0.5],       // Stok Saat Ini (C1)
            [3.0,       1.0,       2.0,       1.5],       // Safety Stock (C2)
            [2.0,       0.5,       1.0,       0.8],       // Profit (C3)
            [2.0,       0.6667,    1.25,      1.0]        // Jumlah Terjual (C4)
        ];
    }

    public function calculate() {
        $n = count($this->criteria_matrix);

        // 1. Hitung Jumlah Kolom
        $col_sums = array_fill(0, $n, 0);
        for ($c = 0; $c < $n; $c++) {
            for ($r = 0; $r < $n; $r++) {
                $col_sums[$c] += $this->criteria_matrix[$r][$c];
            }
        }

        // 2. Normalisasi Matriks dan Hitung Eigen Vector (Bobot Prioritas Kriteria)
        $norm_matrix = [];
        $eigen_vector = array_fill(0, $n, 0);
        for ($r = 0; $r < $n; $r++) {
            $row_sum = 0;
            for ($c = 0; $c < $n; $c++) {
                $norm_matrix[$r][$c] = $this->criteria_matrix[$r][$c] / $col_sums[$c];
                $row_sum += $norm_matrix[$r][$c];
            }
            $eigen_vector[$r] = $row_sum / $n;
        }

        // 3. Perhitungan Konsistensi (Principle Eigenvalue / lambdaMax)
        $weighted_sum = array_fill(0, $n, 0);
        for ($r = 0; $r < $n; $r++) {
            for ($c = 0; $c < $n; $c++) {
                $weighted_sum[$r] += $this->criteria_matrix[$r][$c] * $eigen_vector[$c];
            }
        }

        $consistency_vector = [];
        $lambda_max = 0;
        for ($i = 0; $i < $n; $i++) {
            $consistency_vector[$i] = $weighted_sum[$i] / $eigen_vector[$i];
            $lambda_max += $consistency_vector[$i];
        }
        $lambda_max /= $n;

        // Consistency Index (CI)
        $ci = ($lambda_max - $n) / ($n - 1);

        // Consistency Ratio (CR)
        $ri = $this->ri_table[$n] ?? 0.90;
        $cr = $ri > 0 ? $ci / $ri : 0;
        $is_consistent = $cr <= 0.1;

        // 4. Perhitungan Ranking Alternatif
        $alternatives = [];
        if (empty($this->items)) {
            return [
                'matrix' => $this->criteria_matrix,
                'eigenVector' => $eigen_vector,
                'ci' => $ci,
                'cr' => $cr,
                'isConsistent' => $is_consistent,
                'alternatives' => []
            ];
        }

        // Ambil nilai ekstrim untuk normalisasi [0, 1]
        $stoks = [];
        $deficits = [];
        $profits = [];
        $terjuals = [];

        foreach ($this->items as $item) {
            $profit = max(0, $item['harga_eceran'] - $item['harga_grosir']);
            $deficit = max(0, $item['safety_stock'] - $item['stok_saat_ini']);
            
            $stoks[] = $item['stok_saat_ini'];
            $deficits[] = $deficit;
            $profits[] = $profit;
            $terjuals[] = $item['jumlah_terjual'];
        }

        $min_stok = min($stoks);
        $max_stok = max($stoks);
        $max_deficit = max($deficits);
        $max_profit = max($profits);
        $max_terjual = max($terjuals);

        foreach ($this->items as $item) {
            $profit = max(0, $item['harga_eceran'] - $item['harga_grosir']);
            $deficit = max(0, $item['safety_stock'] - $item['stok_saat_ini']);

            // C1: Stok (Semakin kecil semakin prioritas, balik nilainya)
            $s_stok = ($max_stok == $min_stok) ? 1.0 : ($max_stok - $item['stok_saat_ini']) / ($max_stok - $min_stok);

            // C2: Safety Stock Deficit
            $s_safety = ($max_deficit == 0) ? 0.0 : $deficit / $max_deficit;

            // C3: Profit
            $s_profit = ($max_profit == 0) ? 0.0 : $profit / $max_profit;

            // C4: Terjual
            $s_terjual = ($max_terjual == 0) ? 0.0 : $item['jumlah_terjual'] / $max_terjual;

            // Composite Score
            $score = (
                $s_stok * $eigen_vector[0] +
                $s_safety * $eigen_vector[1] +
                $s_profit * $eigen_vector[2] +
                $s_terjual * $eigen_vector[3]
            );

            // Rekomendasi
            if ($item['stok_saat_ini'] <= $item['safety_stock'] * 0.2) {
                $rekomendasi = 'SANGAT SEGERA: Stok kritis di bawah 20%';
            } elseif ($item['stok_saat_ini'] <= $item['safety_stock']) {
                $rekomendasi = 'Beli Baru: Stok di bawah safety stock';
            } else {
                $rekomendasi = 'Prioritas Rendah: Stok memadai';
            }

            $alternatives[] = [
                'id_barang' => $item['id_barang'],
                'nama_barang' => $item['nama_barang'],
                'stok_saat_ini' => $item['stok_saat_ini'],
                'safety_stock' => $item['safety_stock'],
                'profit' => $profit,
                'jumlah_terjual' => $item['jumlah_terjual'],
                'score' => round($score, 4),
                'rekomendasi' => $rekomendasi
            ];
        }

        // Urutkan berdasarkan score desc
        usort($alternatives, function($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        // Tambah rank
        foreach ($alternatives as $idx => &$alt) {
            $alt['rank'] = $idx + 1;
        }

        return [
            'matrix' => $this->criteria_matrix,
            'eigenVector' => array_map(function($w) { return round($w, 4); }, $eigen_vector),
            'ci' => round($ci, 4),
            'cr' => round($cr, 4),
            'isConsistent' => $is_consistent,
            'alternatives' => $alternatives
        ];
    }
}
?>
