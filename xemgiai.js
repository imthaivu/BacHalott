// Xem giải - phụ thuộc tên và số lượng giải từ Cài đặt
const STORAGE_KEYS = {
  PRIZES: 'bacHalott_prizes',
  FILLED_PRIZES: 'bacHalott_filledPrizes',
};

const PRIZE_NAMES = ['Giải đặc biệt', 'Giải nhất', 'Giải nhì', 'Giải ba', 'Giải tư', 'Giải năm', 'Giải sáu', 'Giải bảy', 'Giải tám', 'Giải khuyến khích'];

function loadPrizesConfig() {
  try {
    const p = localStorage.getItem(STORAGE_KEYS.PRIZES);
    if (!p) return Array(10).fill(null).map((_, i) => ({ enabled: i > 0 && i <= 3, qty: i > 0 && i <= 3 ? 1 : 0 }));
    const parsed = JSON.parse(p);
    const oldLen = Array.isArray(parsed) ? parsed.length : 0;
    return Array(10).fill(null).map((_, i) => {
      if (i === 0) {
        const src = oldLen === 9 ? null : parsed[i];
        return src || { enabled: false, qty: 0 };
      }
      const src = oldLen === 9 ? parsed[i - 1] : parsed[i];
      return src || { enabled: i <= 3, qty: i <= 3 ? 1 : 0 };
    });
  } catch (e) {
    return Array(10).fill(null).map((_, i) => ({ enabled: i > 0 && i <= 3, qty: i > 0 && i <= 3 ? 1 : 0 }));
  }
}

function loadFilledPrizes() {
  try {
    const fp = localStorage.getItem(STORAGE_KEYS.FILLED_PRIZES);
    if (!fp) return {};
    return JSON.parse(fp);
  } catch (e) {
    return {};
  }
}

function renderMainPrizes() {
  const filledPrizes = loadFilledPrizes();
  const prizesConfig = loadPrizesConfig();
  const container = document.getElementById('mainPrizes');
  if (!container) return;

  container.innerHTML = '';

  // Chỉ hiển thị giải được bật trong Cài đặt, theo thứ tự: đặc biệt → khuyến khích
  const enabledPrizes = prizesConfig
    .map((cfg, index) => cfg.enabled ? { index, qty: Math.max(1, cfg.qty || 1) } : null)
    .filter(Boolean);

  enabledPrizes.forEach((p, idx) => {
    const prizeIndex = p.index;
    const qty = p.qty;
    const filled = filledPrizes[prizeIndex] || [];
    const labelName = (PRIZE_NAMES[prizeIndex] || `Giải ${prizeIndex + 1}`).toUpperCase();
    const isRed = prizeIndex <= 1;

    const row = document.createElement('div');
    row.className = 'xemgiai-main-row reveal-item';
    if (qty > 4) {
      row.classList.add('layout-column');
    }
    row.style.animationDelay = `${idx * 0.12}s`;

    const label = document.createElement('div');
    label.className = 'xemgiai-prize-label';
    label.textContent = labelName;

    const numBoxesWrap = document.createElement('div');
    numBoxesWrap.className = 'xemgiai-num-boxes-wrap';

    for (let s = 0; s < qty; s++) {
      const val = filled[s] && filled[s] !== '?' ? filled[s] : '';
      const numBox = document.createElement('div');
      numBox.className = 'xemgiai-num-box';
      numBox.classList.add(isRed ? 'num-red' : 'num-orange');
      numBox.textContent = val || '—';
      if (val) {
        numBox.classList.add('filled', 'reveal-slot');
        numBox.style.animationDelay = `${idx * 0.12 + 0.05 + s * 0.04}s`;
      }
      numBoxesWrap.appendChild(numBox);
    }

    row.appendChild(label);
    row.appendChild(numBoxesWrap);
    container.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderMainPrizes();
});
