import { Inventori, AHPResult, AHPPriorityItem } from '../types';

// Random Index (RI) table for AHP
const RI_TABLE: Record<number, number> = {
  1: 0.00,
  2: 0.00,
  3: 0.58,
  4: 0.90,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49
};

// Default comparison matrix for 4 criteria: [Stok Saat Ini, Safety Stock, Profit, Jumlah Terjual]
// Safety Stock is given high priority, then Jumlah Terjual, then Profit, and Stok is lowest (since actual deficit is evaluated in safety stock)
export const DEFAULT_CRITERIA_MATRIX = [
  [1.0,       0.3333,    0.5,       0.5],       // Stok Saat Ini (C1)
  [3.0,       1.0,       2.0,       1.5],       // Safety Stock (C2)
  [2.0,       0.5,       1.0,       0.8],       // Profit (C3)
  [2.0,       0.6667,    1.25,      1.0]        // Jumlah Terjual (C4)
];

export function calculateAHP(
  items: Inventori[],
  criteriaMatrix: number[][] = DEFAULT_CRITERIA_MATRIX,
  activeCriteria: string[] = ['stok', 'safety', 'profit', 'terjual']
): AHPResult {
  const n = criteriaMatrix.length; 
  
  // 1. Calculate column sums
  const colSums = Array(n).fill(0);
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) {
      colSums[c] += criteriaMatrix[r][c];
    }
  }

  // 2. Normalize the matrix and calculate row averages (Eigen Vector / Weights)
  const normMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const eigenVector = Array(n).fill(0);
  for (let r = 0; r < n; r++) {
    let rowSum = 0;
    for (let c = 0; c < n; c++) {
      normMatrix[r][c] = criteriaMatrix[r][c] / (colSums[c] || 1);
      rowSum += normMatrix[r][c];
    }
    eigenVector[r] = rowSum / n;
  }

  // 3. Consistency Calculations
  const weightedSum = Array(n).fill(0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      weightedSum[r] += criteriaMatrix[r][c] * eigenVector[c];
    }
  }

  const consistencyVector = Array(n).fill(0);
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    consistencyVector[i] = eigenVector[i] ? weightedSum[i] / eigenVector[i] : 0;
    lambdaMax += consistencyVector[i];
  }
  lambdaMax /= (n || 1);

  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = RI_TABLE[n] || 0.90;
  const cr = ri > 0 ? ci / ri : 0;
  const isConsistent = n <= 2 || cr <= 0.1;

  // 4. Rank Alternatives
  const alternativesData = items.map(item => {
    const profit = Math.max(0, item.harga_eceran - item.harga_grosir);
    const deficit = Math.max(0, item.safety_stock - item.stok_saat_ini);
    // mock seasonal trend based on id length and current month just for variance
    const tren_musiman = (item.id_barang.length % 5) + (item.jumlah_terjual % 3);
    
    return {
      item,
      stok: item.stok_saat_ini,
      safety: item.safety_stock,
      deficit,
      profit,
      terjual: item.jumlah_terjual,
      harga_grosir: item.harga_grosir,
      tren_musiman
    };
  });

  const getScoresForCriteria = (key: string) => {
    const vals = alternativesData.map((d: any) => d[key]);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 1);
    return alternativesData.map((d: any) => {
      const v = d[key];
      // For stock and harga_grosir, LOWER is better (higher priority)
      if (key === 'stok' || key === 'harga_grosir') {
        return max === min ? 1.0 : (max - v) / (max - min);
      }
      // For others, HIGHER is better
      return max === 0 ? 0.0 : v / max;
    });
  };

  const scoresByCriteria: Record<string, number[]> = {};
  activeCriteria.forEach(c => {
    // map key appropriately
    const mapKey = c === 'safety' ? 'deficit' : c;
    scoresByCriteria[c] = getScoresForCriteria(mapKey);
  });

  const rankedItems: AHPPriorityItem[] = alternativesData.map((data, i) => {
    let score = 0;
    activeCriteria.forEach((c, cIdx) => {
      score += scoresByCriteria[c][i] * (eigenVector[cIdx] || 0);
    });

    let rekomendasi = 'Stok Aman';
    if (data.stok <= data.safety * 0.2) {
      rekomendasi = 'SANGAT SEGERA: Stok kritis di bawah 20% safety stock!';
    } else if (data.stok <= data.safety) {
      rekomendasi = 'Beli Baru: Stok di bawah batas safety stock!';
    } else if (data.deficit === 0 && score > 0.5) {
      rekomendasi = 'Optimasi: Stok aman, tawarkan promo untuk mempercepat penjualan.';
    } else {
      rekomendasi = 'Prioritas Rendah: Stok memadai.';
    }

    return {
      id_barang: data.item.id_barang,
      nama_barang: data.item.nama_barang,
      stok_saat_ini: data.stok,
      safety_stock: data.safety,
      profit: data.profit,
      jumlah_terjual: data.terjual,
      score: parseFloat(score.toFixed(4)),
      rank: 0,
      rekomendasi
    };
  });

  rankedItems.sort((a, b) => b.score - a.score);
  rankedItems.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    matrix: criteriaMatrix,
    eigenVector: eigenVector.map(w => parseFloat(w.toFixed(4))),
    ci: parseFloat(ci.toFixed(4)),
    cr: parseFloat(cr.toFixed(4)),
    isConsistent,
    alternatives: rankedItems,
    activeCriteria
  };
}
