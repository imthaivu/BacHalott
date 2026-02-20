// Bắc Hà Lott - Xổ số Vietlott style
const STORAGE_KEYS = {
  BO_SO_PER_TUMBLER: 'bacHalott_boSoPerTumbler',
  NUM_TUMBLERS: 'bacHalott_numTumblers',
  BALL_COLORS: 'bacHalott_ballColors',
  PRIZES: 'bacHalott_prizes',
  NO_REPEAT: 'bacHalott_noRepeat',
  DRAWN_NUMBERS: 'bacHalott_drawnNumbers',
  FILLED_PRIZES: 'bacHalott_filledPrizes',
  CURRENT_PRIZE_INDEX: 'bacHalott_currentPrizeIndex',
  CURRENT_SLOT_IN_PRIZE: 'bacHalott_currentSlotInPrize',
  DRAW_HISTORY: 'bacHalott_drawHistory',
};

const DEFAULT_BALL_COLORS = ['#ffffff', '#ffeb3b', '#4caf50', '#2196f3', '#e91e63', '#9c27b0', '#ff9800', '#00bcd4'];

// State
let state = {
  boSoPerTumbler: [10, 10, 10, 10, 10, 10],
  numTumblers: 4,
  ballColors: [...DEFAULT_BALL_COLORS],
  prizes: Array(10).fill(null).map((_, i) => ({ enabled: i === 0 ? false : i <= 3, qty: i === 0 ? 0 : 1 })),
  noRepeat: true,
  drawnNumbers: [],
  filledPrizes: {}, // { "0": ["1234"], "1": ["5678"], ... }
  currentPrizeIndex: 0,
  currentSlotInPrize: 0,
  isSpinning: false,
  spinInterval: null,
  ballShakeInterval: null,
  currentSpinDigits: null,
};

// DOM refs
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettings');
const resetSettingsBtn = document.getElementById('resetSettings');
const closeSettingsBtn = document.getElementById('closeSettings');
const allPrizesFilledModal = document.getElementById('allPrizesFilledModal');
const allPrizesFilledCloseBtn = document.getElementById('allPrizesFilledCloseBtn');
const resetModal = document.getElementById('resetModal');
const resetConfirmBtn = document.getElementById('resetConfirmBtn');
const resetCancelBtn = document.getElementById('resetCancelBtn');
const boSoPerTumblerContainer = document.getElementById('boSoPerTumbler');
const numTumblersInput = document.getElementById('numTumblers');
const ballColorsContainer = document.getElementById('ballColors');
const noRepeatInput = document.getElementById('noRepeat');
const boSoDisplay = document.getElementById('boSoDisplay');
const spinBtn = document.getElementById('spinBtn');
const stopBtn = document.getElementById('stopBtn');
const resultDisplay = document.querySelector('.result-display');
const tabQuay = document.getElementById('tabQuay');
const tabXemGiai = document.getElementById('tabXemGiai');
const resultNumbersContainer = document.getElementById('resultNumbers');
const tumblersContainer = document.getElementById('tumblers');
const currentPrizeEl = document.getElementById('currentPrize');
const totalPrizesEl = document.getElementById('totalPrizes');
const currentPrizeNameEl = document.getElementById('currentPrizeName');
const screenQuay = document.getElementById('screenQuay');
const screenXemGiai = document.getElementById('screenXemGiai');
const screensTrack = document.getElementById('screensTrack');

// Sounds
const spinAudio = new Audio('sound/quay-bi.MP3');
spinAudio.loop = true;

const PRIZE_NAMES = ['Giải đặc biệt', 'Giải nhất', 'Giải nhì', 'Giải ba', 'Giải tư', 'Giải năm', 'Giải sáu', 'Giải bảy', 'Giải tám', 'Giải khuyến khích'];

// Suy ra currentPrizeIndex + currentSlotInPrize từ filledPrizes (nguồn thật) để "đã quay" khớp data
function deriveCurrentPositionFromFilledPrizes() {
  const enabled = getEnabledPrizes();
  if (enabled.length === 0) {
    state.currentPrizeIndex = 0;
    state.currentSlotInPrize = 0;
    return;
  }
  let remaining = 0;
  for (const p of enabled) {
    const filled = state.filledPrizes[p.index] || [];
    const count = filled.filter((v) => v && v !== '?').length;
    remaining += count;
  }
  for (let i = 0; i < enabled.length; i++) {
    const p = enabled[i];
    const filled = state.filledPrizes[p.index] || [];
    const count = filled.filter((v) => v && v !== '?').length;
    if (remaining < p.qty) {
      state.currentPrizeIndex = i;
      state.currentSlotInPrize = remaining;
      return;
    }
    remaining -= p.qty;
  }
  state.currentPrizeIndex = 0;
  state.currentSlotInPrize = 0;
}

// Load from localStorage
function loadState() {
  try {
    const numT = localStorage.getItem(STORAGE_KEYS.NUM_TUMBLERS);
    if (numT) state.numTumblers = Math.min(6, Math.max(2, parseInt(numT, 10)));

    const bsp = localStorage.getItem(STORAGE_KEYS.BO_SO_PER_TUMBLER);
    if (bsp) {
      const parsed = JSON.parse(bsp);
      state.boSoPerTumbler = [10, 10, 10, 10, 10, 10];
      parsed.forEach((n, i) => { if (i < 6) state.boSoPerTumbler[i] = Math.max(2, Math.min(10, parseInt(n, 10) || 10)); });
    }

    const colors = localStorage.getItem(STORAGE_KEYS.BALL_COLORS);
    if (colors) {
      const parsed = JSON.parse(colors);
      state.ballColors = [...DEFAULT_BALL_COLORS];
      parsed.forEach((c, i) => { state.ballColors[i] = c; });
    }

    const prizes = localStorage.getItem(STORAGE_KEYS.PRIZES);
    if (prizes) {
      const p = JSON.parse(prizes);
      const oldLen = Array.isArray(p) ? p.length : 0;
      state.prizes = Array(10).fill(null).map((_, i) => {
        if (i === 0) {
          const src = oldLen === 9 ? null : p[0];
          return src || { enabled: false, qty: 0 };
        }
        const src = oldLen === 9 ? p[i - 1] : p[i];
        return src || { enabled: false, qty: i <= 3 ? 1 : 0 };
      });
    }

    state.noRepeat = localStorage.getItem(STORAGE_KEYS.NO_REPEAT) !== 'false';

    const drawn = localStorage.getItem(STORAGE_KEYS.DRAWN_NUMBERS);
    if (drawn) state.drawnNumbers = JSON.parse(drawn);

    const fp = localStorage.getItem(STORAGE_KEYS.FILLED_PRIZES);
    if (fp) state.filledPrizes = JSON.parse(fp);

    deriveCurrentPositionFromFilledPrizes();

    // Migration: nếu có filledPrizes nhưng chưa có draw history → tạo history từ data cũ
    if (!localStorage.getItem(STORAGE_KEYS.DRAW_HISTORY) && Object.keys(state.filledPrizes).length > 0) {
      const history = [];
      const enabled = state.prizes
        .map((p, i) => (p.enabled ? { index: i, qty: Math.max(1, p.qty || 1) } : null))
        .filter(Boolean)
        .reverse();
      for (const p of enabled) {
        const filled = state.filledPrizes[p.index] || [];
        filled.forEach((val, s) => {
          if (val && val !== '?') {
            history.push({ prizeIndex: p.index, prizeName: PRIZE_NAMES[p.index], value: val, slotInPrize: s + 1, qty: p.qty });
          }
        });
      }
      if (history.length > 0) {
        localStorage.setItem(STORAGE_KEYS.DRAW_HISTORY, JSON.stringify(history.slice(-10)));
      }
    }
  } catch (e) {
    console.warn('Load state failed:', e);
  }
}

// Save to localStorage - luôn lưu để F5 và xemgiai có data
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEYS.BO_SO_PER_TUMBLER, JSON.stringify(state.boSoPerTumbler.slice(0, 6)));
    localStorage.setItem(STORAGE_KEYS.NUM_TUMBLERS, state.numTumblers.toString());
    localStorage.setItem(STORAGE_KEYS.BALL_COLORS, JSON.stringify(state.ballColors));
    localStorage.setItem(STORAGE_KEYS.PRIZES, JSON.stringify(state.prizes));
    localStorage.setItem(STORAGE_KEYS.NO_REPEAT, state.noRepeat.toString());
    localStorage.setItem(STORAGE_KEYS.DRAWN_NUMBERS, JSON.stringify(state.drawnNumbers));
    localStorage.setItem(STORAGE_KEYS.FILLED_PRIZES, JSON.stringify(state.filledPrizes));
    localStorage.setItem(STORAGE_KEYS.CURRENT_PRIZE_INDEX, state.currentPrizeIndex.toString());
    localStorage.setItem(STORAGE_KEYS.CURRENT_SLOT_IN_PRIZE, state.currentSlotInPrize.toString());
  } catch (e) {
    console.warn('Save state failed:', e);
  }
}

// Init UI from state
function initUI() {
  numTumblersInput.value = state.numTumblers;
  renderBoSoPerTumbler();
  noRepeatInput.checked = state.noRepeat;

  renderBallColorPickers();
  buildTumblers();
  // Màu dấu ? theo màu bi mỗi bình
  for (let i = 0; i < state.numTumblers; i++) {
    const tube = document.getElementById(`tube${i}`);
    if (tube) tube.style.setProperty('--tumbler-color', state.ballColors[i] || DEFAULT_BALL_COLORS[i]);
  }
  buildResultSlots();

  state.prizes.forEach((p, i) => {
    const row = document.querySelector(`tr[data-prize="${i}"]`);
    if (row) {
      row.querySelector('.prize-check').checked = p.enabled;
      row.querySelector('.prize-qty').value = p.enabled ? p.qty : 0;
    }
  });

  renderBalls();
  updateBoSoDisplay();
  updatePrizeSlots();
  updatePrizeCounter();
  updateResultDisplay(null);
  renderRecentDrawsList();
}

// Render bộ số inputs cho mỗi bình (optCount: dùng khi đổi số bình trong modal)
function renderBoSoPerTumbler(optCount) {
  if (!boSoPerTumblerContainer) return;
  boSoPerTumblerContainer.innerHTML = '';
  const n = optCount ?? state.numTumblers;
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'boSo-tumbler-input';
    wrap.innerHTML = `<span>Bình ${i + 1}</span>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 2;
    input.max = 10;
    input.dataset.index = i;
    input.value = state.boSoPerTumbler[i] ?? 10;
    input.title = `Bộ số bình ${i + 1} (0 đến N-1)`;
    wrap.appendChild(input);
    boSoPerTumblerContainer.appendChild(wrap);
  }
}

// Render ball color pickers cho mỗi bình (optCount: khi đổi số bình trong modal)
function renderBallColorPickers(optCount) {
  if (!ballColorsContainer) return;
  ballColorsContainer.innerHTML = '';
  const n = optCount ?? state.numTumblers;
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'ball-color-picker';
    wrap.innerHTML = `<span>Bình ${i + 1}</span>`;
    const input = document.createElement('input');
    input.type = 'color';
    input.dataset.index = i;
    input.value = state.ballColors[i] || DEFAULT_BALL_COLORS[i];
    input.title = `Màu bi bình ${i + 1}`;
    wrap.appendChild(input);
    ballColorsContainer.appendChild(wrap);
  }
}

// Build tumbler DOM - hình bình thủy tinh, bi nằm sau (behind) bình
function buildTumblers() {
  tumblersContainer.innerHTML = '';
  for (let i = 0; i < state.numTumblers; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'tumbler-wrapper';
    wrap.dataset.index = i;
    wrap.innerHTML = `
      <div class="tumbler tumbler-with-jar">
        <div class="tumbler-ball-outline outline-hidden" id="ballOutline${i}">
          <div class="ball-placement-debug">
            <div class="debug-ellipse" title="Vùng random bi hiện tại (ellipse)"></div>
          </div>
          <div class="l-flow-path" title="Đường L: cong xuống dưới ở phần đuôi">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow: visible;">
              <path d="M 12 10 L 12 92 Q 14 97 22 92 L 82 92 Q 95 92 95 110" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="balls-container" id="balls${i}"></div>
        </div>
        <div class="tumbler-jar-overlay">
          <img src="img/binh thuy tinh.png" alt="Bình thủy tinh" class="jar-image" />
        </div>
        <div class="tumbler-tube-display">
          <span class="tube-display" id="tube${i}">?</span>
        </div>
      </div>
      <div class="bo-so-per-jar" id="boSoJar${i}">0-9</div>
    `;
    tumblersContainer.appendChild(wrap);
  }
}

// Build result number slots
function buildResultSlots() {
  resultNumbersContainer.innerHTML = '';
  for (let i = 0; i < state.numTumblers; i++) {
    const span = document.createElement('span');
    span.className = 'result-num';
    span.id = `r${i}`;
    span.textContent = '?';
    resultNumbersContainer.appendChild(span);
  }
}

// Random trong khoảng [min, max] (tránh bi bị outline lẹm/cắt)
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

// Giới hạn để bi KHÔNG lọt ra outline (bi r=10, an toàn mobile + desktop)
const BLOW_X_MAX = 20;
const BLOW_Y_MAX = 90;
// Gán quỹ đạo random cho bi (mỗi bi hướng + vị trí khác nhau, không cố định)
function randomizeBallBlowValues(ballEl) {
  if (!ballEl || !ballEl.style) return;
  ballEl.style.setProperty('--blow-x1', `${randomInRange(-BLOW_X_MAX, BLOW_X_MAX)}px`);
  ballEl.style.setProperty('--blow-y1', `-${randomInRange(15, BLOW_Y_MAX)}px`);
  ballEl.style.setProperty('--blow-x2', `${randomInRange(-BLOW_X_MAX, BLOW_X_MAX)}px`);
  ballEl.style.setProperty('--blow-y2', `-${randomInRange(12, BLOW_Y_MAX - 8)}px`);
  ballEl.style.setProperty('--blow-x3', `${randomInRange(-BLOW_X_MAX, BLOW_X_MAX)}px`);
  ballEl.style.setProperty('--blow-y3', `-${randomInRange(18, BLOW_Y_MAX)}px`);
  ballEl.style.setProperty('--blow-x4', `${randomInRange(-BLOW_X_MAX, BLOW_X_MAX)}px`);
  ballEl.style.setProperty('--blow-y4', `-${randomInRange(10, BLOW_Y_MAX - 12)}px`);
  ballEl.style.setProperty('--blow-dur', `${randomInRange(0.7, 1.8).toFixed(2)}s`);
  ballEl.style.setProperty('--blow-delay', `${randomInRange(0, 0.5).toFixed(2)}s`);
}

// Vùng vàng: bi idle random trong ellipse (chưa quay), rx mở rộng tận dụng outline
const BALL_ELLIPSE = { cx: 0.50, cy: 0.12, rx: 0.36, ry: 0.10 };
function isInsideOvalBottom(leftPct, bottomPct) {
  const x = leftPct / 100, y = bottomPct / 100;
  const { cx, cy, rx, ry } = BALL_ELLIPSE;
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

// Khi ít bi: ưu tiên phủ viền dưới outline vàng trước
function getBottomRangeForCount(count) {
  if (count <= 8) return [2, 10];
  if (count <= 12) return [2, 14];
  return [2, 22];
}

// Vị trí random trong ellipse đáy (dùng cho animate vào bình)
function getEllipsePosition(count) {
  const [bottomMin, bottomMax] = getBottomRangeForCount(count);
  let left, bottom;
  let attempts = 0;
  do {
    left = randomInRange(25, 75);
    bottom = randomInRange(bottomMin, bottomMax);
    attempts++;
    if (attempts > 100) break;
  } while (!isInsideOvalBottom(left, bottom));
  return { left, bottom };
}

// Chưa có giải nào hoặc vừa reset → bi xếp hàng dọc bên trái (chữ L chảy vào bình)
function isInitialState() {
  const enabled = getEnabledPrizes();
  if (enabled.length === 0) return true;
  for (const p of enabled) {
    const filled = state.filledPrizes[p.index] || [];
    if (filled.some(v => v && v !== '?')) return false;
  }
  return true;
}

// Vị trí bi trên đường L: M 12 10 L 12 92 Q 14 97 22 92 L 82 92 Q 95 92 95 110
// viewBox 0 0 100 100; CSS left=x, bottom=100-y
function getLLinePosition(i, count) {
  const t = count <= 1 ? 0 : i / (count - 1);
  const L = 96; // 82 (dọc) + 11 (cong) + 3 (ngang nhỏ)
  const t1 = 82 / L;
  const t2 = 93 / L;
  let left, bottom;
  if (t <= t1) {
    left = 12;
    bottom = 100 - (10 + 82 * (t / t1));
  } else if (t <= t2) {
    const u = (t - t1) / (t2 - t1);
    // Quadratic Q(14,97) from (12,92) to (22,92)
    const x = (1 - u) ** 2 * 12 + 2 * (1 - u) * u * 14 + u * u * 22;
    const y = (1 - u) ** 2 * 92 + 2 * (1 - u) * u * 97 + u * u * 92;
    left = x;
    bottom = 100 - y;
  } else {
    const u = (t - t2) / (1 - t2);
    // Đoạn thẳng 3px từ x=22 đến x=25
    left = 22 + 3 * u;
    bottom = 100 - 92;
  }
  return { left, bottom };
}

// Render balls - initial: hàng dọc bên trái (L); đã có giải: random trong ellipse đáy; khi quay: bay random
// winningDigits: optional [d0,d1,...] - đánh dấu bi trúng mỗi bình (opacity 0, winning)
function renderBalls(winningDigits) {
  const initial = isInitialState();
  for (let t = 0; t < state.numTumblers; t++) {
    const count = Math.max(2, Math.min(10, state.boSoPerTumbler[t] ?? 10));
    const [bottomMin, bottomMax] = getBottomRangeForCount(count);
    const container = document.getElementById(`balls${t}`);
    const outline = document.getElementById(`ballOutline${t}`);
    if (!container) continue;
    const baseColor = state.ballColors[t] || DEFAULT_BALL_COLORS[t];
    container.innerHTML = '';
    // Toggle L-path và balls-container transform khi initial (bi theo line)
    if (outline) {
      outline.classList.toggle('show-l-flow', initial);
    }
    container.classList.toggle('l-flow-mode', initial);
    for (let i = 0; i < count; i++) {
      let left, bottom;
      if (initial) {
        const pos = getLLinePosition(i, count);
        left = pos.left;
        bottom = pos.bottom;
      } else {
        let attempts = 0;
        do {
          left = randomInRange(25, 75);
          bottom = randomInRange(bottomMin, bottomMax);
          attempts++;
          if (attempts > 100) break;
        } while (!isInsideOvalBottom(left, bottom));
      }

      const ball = document.createElement('div');
      ball.className = 'ball ball-float';
      ball.textContent = i;
      ball.dataset.num = i;
      ball.style.setProperty('--ball-color', baseColor);
      ball.style.left = `${left}%`;
      ball.style.bottom = `${bottom}%`;
      randomizeBallBlowValues(ball);
      if (winningDigits && winningDigits[t] === i) {
        ball.classList.add('winning');
        ball.style.opacity = '0';
      }
      container.appendChild(ball);

      if (initial) {
        const kfs = [];
        const finalT = count <= 1 ? 0 : i / (count - 1);
        for (let s = 0; s <= 20; s++) {
          const currentT = finalT * (s / 20);
          const p = getLLinePosition(currentT, 2);
          // Do ta đã bỏ transform translate(-22px, -45px), cần điều chỉnh tọa độ ban đầu trực tiếp trong JS 
          // để bi rơi đúng vào hình vẽ. Hệ tọa độ viewBox 0 0 100 100
          // Dịch left: -22px trên vùng width giả định 100px = -22%
          // Dịch top: -45px => bottom sinh ra tăng lên 45%
          kfs.push({ 
            left: `calc(${p.left}% - 22px)`, 
            bottom: `calc(${p.bottom}% + 45px)` 
          });
        }
        
        ball.style.left = `calc(${left}% - 22px)`;
        ball.style.bottom = `calc(${bottom}% + 45px)`;

        const anim = ball.animate(kfs, {
          duration: 400 + i * 50,
          delay: i * 80,
          easing: 'ease-out',
          fill: 'backwards'
        });
        anim.onfinish = function() { this.cancel(); };
      }
    }
  }
}

// Hàm tính tọa độ trên TOÀN BỘ đường L (bao gồm cả phần đuôi dài 20px và bẻ gập)
function getFullPathPosition(t) {
  const L = 169; // 82 (dọc) + 11 (cong 1) + 60 (ngang) + 16 (cong 2)
  const t1 = 82 / L;
  const t2 = 93 / L;
  const t3 = 153 / L;
  let left, bottom;
  if (t <= t1) {
    left = 12;
    bottom = 100 - (10 + 82 * (t / t1));
  } else if (t <= t2) {
    const u = (t - t1) / (t2 - t1);
    const x = (1 - u) ** 2 * 12 + 2 * (1 - u) * u * 14 + u * u * 22;
    const y = (1 - u) ** 2 * 92 + 2 * (1 - u) * u * 97 + u * u * 92;
    left = x;
    bottom = 100 - y;
  } else if (t <= t3) {
    const u = (t - t2) / (t3 - t2);
    left = 22 + 60 * u;
    bottom = 100 - 92;
  } else {
    const u = (t - t3) / (1 - t3);
    const x = (1 - u) ** 2 * 82 + 2 * (1 - u) * u * 95 + u * u * 95;
    const y = (1 - u) ** 2 * 92 + 2 * (1 - u) * u * 92 + u * u * 110;
    left = x;
    bottom = 100 - y;
  }
  return { left, bottom };
}

// Lượt quay đầu: bi chảy từng bi xuống đáy, rồi mới tung (Promise)
const BALL_FLOW_DURATION = 500;
const BALL_FLOW_STAGGER = 85; // ms giữa mỗi bi
function animateBallsIntoBottle() {
  return new Promise((resolve) => {
    const targets = [];
    for (let t = 0; t < state.numTumblers; t++) {
      const count = Math.max(2, Math.min(10, state.boSoPerTumbler[t] ?? 10));
      const container = document.getElementById(`balls${t}`);
      const outline = document.getElementById(`ballOutline${t}`);
      if (!container || !outline) continue;
      const balls = container.querySelectorAll('.ball');
      balls.forEach((ball, i) => {
        const pos = getEllipsePosition(count);
        targets.push({ ball, left: pos.left, bottom: pos.bottom, index: i, count: count });
      });
    }
    const maxIndex = Math.max(...targets.map(x => x.index), 0);
    const PATH_DURATION = 650;
    const totalDuration = BALL_FLOW_STAGGER * (maxIndex + 1) + PATH_DURATION;
    targets.forEach(({ ball, left, bottom, index, count }) => {
      const delay = index * BALL_FLOW_STAGGER;
      const startT_resting = count <= 1 ? 0 : index / (count - 1);
      // Ánh xạ T_resting hiện tại (0 -> 1) sang trục tọa độ T của toàn bộ path (0 -> 96/169)
      const T_start = startT_resting * (96 / 169);
      
      const kfs = [];

      // Tất cả các bi đều di chuyển theo toàn bộ đường line (T chạy tới 1)
      for (let s = 0; s <= 20; s++) {
        const currentT = T_start + (1 - T_start) * (s / 20);
        const p = getFullPathPosition(currentT);
        kfs.push({ 
          left: `calc(${p.left}% - 22px)`, 
          bottom: `calc(${p.bottom}% + 45px)`, 
          offset: 0.8 * (s / 20) 
        });
      }

      // Từ điểm cuối của path (offset 0.8), trôi mượt mà tới vị trí đích ngẫu nhiên (offset 1.0)
      kfs.push({ left: `${left}%`, bottom: `${bottom}%`, offset: 1.0 });
      
      ball.style.left = `${left}%`;
      ball.style.bottom = `${bottom}%`;

      const anim = ball.animate(kfs, {
        duration: PATH_DURATION,
        delay: delay,
        easing: 'ease-in-out',
        fill: 'backwards'
      });
      anim.onfinish = function() { this.cancel(); };
    });
    setTimeout(() => {
      document.querySelectorAll('.tumbler-ball-outline').forEach(o => o.classList.remove('show-l-flow'));
      document.querySelectorAll('.balls-container').forEach(c => c.classList.remove('l-flow-mode'));
      resolve();
    }, totalDuration + 50);
  });
}

// Update bộ số display (bên dưới mỗi ảnh bình có ghi count bi)
function updateBoSoDisplay() {
  const parts = state.boSoPerTumbler.slice(0, state.numTumblers).map(n => `0-${(n ?? 10) - 1}`);
  boSoDisplay.textContent = 'Bộ số: ' + (parts.length ? parts.join(', ') : '-');
  for (let i = 0; i < state.numTumblers; i++) {
    const el = document.getElementById(`boSoJar${i}`);
    if (el) {
      const n = state.boSoPerTumbler[i] ?? 10;
      el.textContent = `0-${n - 1}`;
    }
  }
}

// Get total prizes count
function getTotalPrizes() {
  return state.prizes.reduce((sum, p) => sum + (p.enabled ? p.qty : 0), 0);
}

// Kiểm tra đã quay hết tất cả giải chưa
function isAllPrizesFilled() {
  const enabled = getEnabledPrizes();
  for (const p of enabled) {
    const filled = state.filledPrizes[p.index] || [];
    const count = filled.filter(v => v && v !== '?').length;
    if (count < p.qty) return false;
  }
  return true;
}

// Get enabled prize indices (thứ tự ngược: bé nhất → lớn nhất: Giải khuyến khích → ... → Giải đặc biệt)
function getEnabledPrizes() {
  return state.prizes
    .map((p, i) => (p.enabled ? { index: i, qty: p.qty } : null))
    .filter(Boolean)
    .reverse();
}

// Update prize slots UI
function updatePrizeSlots() {
  const enabled = getEnabledPrizes();
  for (let i = 0; i < 10; i++) {
    const slotsEl = document.getElementById(`slots${i}`);
    const row = document.querySelector(`.prize-row[data-prize="${i}"]`);
    if (!slotsEl || !row) continue;

    const p = state.prizes[i];
    if (!p.enabled) {
      row.style.display = 'none';
      continue;
    }
    row.style.display = 'flex';

    slotsEl.innerHTML = '';
    const filled = state.filledPrizes[i] || [];
    for (let s = 0; s < p.qty; s++) {
      const slot = document.createElement('span');
      slot.className = 'prize-slot';
      slot.dataset.slot = s;
      const val = filled[s];
      slot.textContent = val && val !== '?' ? val : '?';
      if (val && val !== '?') slot.classList.add('filled');
      slotsEl.appendChild(slot);
    }
  }
}

// Track drawn numbers per prize (for no-repeat)
let drawnPerSession = {}; // { "0,1,2,3": true }

function getAvailableNumbersForTumbler(tumblerIndex) {
  const n = Math.max(2, Math.min(10, state.boSoPerTumbler[tumblerIndex] ?? 10));
  const nums = [];
  for (let i = 0; i < n; i++) nums.push(i);
  return nums;
}

function pickRandomNumberForTumbler(tumblerIndex, exclude = []) {
  const available = getAvailableNumbersForTumbler(tumblerIndex).filter(n => !exclude.includes(n));
  const n = state.boSoPerTumbler[tumblerIndex] ?? 10;
  if (available.length === 0) return Math.floor(Math.random() * n);
  return available[Math.floor(Math.random() * available.length)];
}

function pickNDigits() {
  const result = [];
  const n = state.numTumblers;
  let key;
  let attempts = 0;
  do {
    result.length = 0;
    for (let i = 0; i < n; i++) {
      result.push(pickRandomNumberForTumbler(i));
    }
    key = result.join(',');
    attempts++;
    if (!state.noRepeat || attempts > 1000) break;
  } while (state.drawnNumbers.includes(key));
  if (state.noRepeat) state.drawnNumbers.push(key);
  return result;
}

// Update prize counter (số lượng/tổng số)
function updatePrizeCounter() {
  const enabled = getEnabledPrizes();
  const total = getTotalPrizes();
  const current = enabled[state.currentPrizeIndex];
  totalPrizesEl.textContent = total;
  if (current) {
    currentPrizeEl.textContent = state.currentSlotInPrize + '/' + current.qty;
    currentPrizeNameEl.textContent = PRIZE_NAMES[current.index];
  } else {
    currentPrizeEl.textContent = '-';
    currentPrizeNameEl.textContent = '-';
  }
}

// Result display
function updateResultDisplay(digits) {
  const slots = resultNumbersContainer.querySelectorAll('.result-num');
  if (digits) {
    resultDisplay.classList.remove('hidden');
    digits.forEach((d, i) => {
      if (slots[i]) {
        slots[i].textContent = d;
        slots[i].classList.add('winning');
        slots[i].style.setProperty('--tumbler-color', state.ballColors[i] || DEFAULT_BALL_COLORS[i]);
      }
    });
  } else {
    resultDisplay.classList.add('hidden');
    slots.forEach(el => {
      el.textContent = '?';
      el.classList.remove('winning');
    });
  }
}

// Spin animation - balls float/blow, tube shows ? (blinking, màu theo bi mỗi bình)
function startTumblerSpin() {
  document.querySelectorAll('.tumbler-with-jar').forEach(t => t.classList.add('spinning'));
  for (let i = 0; i < state.numTumblers; i++) {
    const tube = document.getElementById(`tube${i}`);
    if (tube) {
      tube.textContent = '?';
      tube.style.setProperty('--tumbler-color', state.ballColors[i] || DEFAULT_BALL_COLORS[i]);
    }
    // Random quỹ đạo ngay khi bắt đầu quay
    const container = document.getElementById(`balls${i}`);
    if (container) container.querySelectorAll('.ball').forEach(randomizeBallBlowValues);
  }
  // Mỗi ~400ms đổi hướng random mới → bi không đi theo quỹ đạo cố định
  if (state.ballShakeInterval) clearInterval(state.ballShakeInterval);
  state.ballShakeInterval = setInterval(() => {
    for (let i = 0; i < state.numTumblers; i++) {
      const container = document.getElementById(`balls${i}`);
      if (container) container.querySelectorAll('.ball').forEach(randomizeBallBlowValues);
    }
  }, 380);
}

function stopTumblerSpin() {
  if (state.ballShakeInterval) {
    clearInterval(state.ballShakeInterval);
    state.ballShakeInterval = null;
  }
  document.querySelectorAll('.tumbler-with-jar').forEach(t => t.classList.remove('spinning'));
}

// Reveal number in tube - dùng chính bi trong bình, bay về giữa outline rồi lên chỗ ?
function revealNumberInTumbler(index, num) {
  const container = document.getElementById(`balls${index}`);
  if (!container) return;
  const outline = document.getElementById(`ballOutline${index}`);
  const tube = document.getElementById(`tube${index}`);
  const tumbler = container.closest('.tumbler-with-jar');
  const balls = container.querySelectorAll('.ball');
  const winningBall = Array.from(balls).find(b => parseInt(b.dataset.num, 10) === num);

  if (tube) {
    tube.textContent = '?';
    tube.classList.remove('revealed');
    tube.style.setProperty('--tumbler-color', state.ballColors[index] || DEFAULT_BALL_COLORS[index]);
  }

  if (winningBall && tube && outline && tumbler) {
    const origLeft = winningBall.style.left;
    const origBottom = winningBall.style.bottom;
    const ballRect = winningBall.getBoundingClientRect();
    winningBall.style.animation = 'none';
    const outlineRect = outline.getBoundingClientRect();
    const tubeRect = tube.getBoundingClientRect();

    winningBall.style.position = 'fixed';
    winningBall.style.left = ballRect.left + 'px';
    winningBall.style.top = ballRect.top + 'px';
    winningBall.style.marginLeft = '0';
    winningBall.style.zIndex = '100';
    winningBall.style.transition = 'all 0.35s cubic-bezier(0.25,0.46,0.45,0.94)';
    document.body.appendChild(winningBall);
    winningBall.offsetHeight;

    const centerX = outlineRect.left + outlineRect.width / 2 - ballRect.width / 2;
    const centerY = outlineRect.top + outlineRect.height / 2 - ballRect.height / 2;
    winningBall.style.left = centerX + 'px';
    winningBall.style.top = centerY + 'px';

    setTimeout(() => {
      winningBall.style.transition = 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
      const targetX = tubeRect.left + (tubeRect.width - ballRect.width) / 2;
      const targetY = tubeRect.top + (tubeRect.height - ballRect.height) / 2;
      winningBall.style.left = targetX + 'px';
      winningBall.style.top = targetY + 'px';
      winningBall.style.transform = 'scale(1.1)';
      setTimeout(() => {
        container.appendChild(winningBall);
        winningBall.style.position = '';
        winningBall.style.left = origLeft;
        winningBall.style.top = '';
        winningBall.style.bottom = origBottom;
        winningBall.style.marginLeft = '';
        winningBall.style.zIndex = '';
        winningBall.style.transition = '';
        winningBall.style.transform = '';
        winningBall.style.opacity = '0';
        winningBall.classList.add('winning');
        winningBall.dataset.inTube = '1';
        if (tube) {
          tube.textContent = num;
          tube.classList.add('revealed');
        }
        container.querySelectorAll('.ball').forEach(b => {
          b.classList.toggle('winning', parseInt(b.dataset.num, 10) === num);
        });
      }, 400);
    }, 350);
  } else {
    if (tube) {
      tube.textContent = num;
      tube.classList.add('revealed');
    }
    if (container) {
      container.querySelectorAll('.ball').forEach(b => {
        b.classList.toggle('winning', parseInt(b.dataset.num, 10) === num);
      });
    }
  }
}

// Reset tubes and balls for new spin
function resetTumblerDisplays() {
  for (let i = 0; i < state.numTumblers; i++) {
    const tube = document.getElementById(`tube${i}`);
    if (tube) {
      tube.textContent = '?';
      tube.classList.remove('revealed');
    }
    const container = document.getElementById(`balls${i}`);
    if (container) {
      container.querySelectorAll('.ball').forEach(b => {
        b.classList.remove('winning');
        b.style.opacity = '';
        delete b.dataset.inTube;
      });
    }
  }
}

// Bi trên ống rớt xuống bình rồi quay (khi Dừng → Quay)
function animateBallFallToJar(index) {
  return new Promise((resolve) => {
    const tube = document.getElementById(`tube${index}`);
    const container = document.getElementById(`balls${index}`);
    const outline = document.getElementById(`ballOutline${index}`);
    if (!tube || !container || !outline || tube.textContent === '?' || !tube.classList.contains('revealed')) {
      resolve();
      return;
    }
    const num = parseInt(tube.textContent, 10);
    const balls = container.querySelectorAll('.ball');
    const winningBall = Array.from(balls).find(b => parseInt(b.dataset.num, 10) === num);
    if (!winningBall) {
      resolve();
      return;
    }
    winningBall.style.opacity = '1';
    delete winningBall.dataset.inTube;
    const origLeft = winningBall.style.left;
    const origBottom = winningBall.style.bottom;
    const tubeRect = tube.getBoundingClientRect();
    const outlineRect = outline.getBoundingClientRect();
    const ballRect = winningBall.getBoundingClientRect();
    const centerX = outlineRect.left + outlineRect.width / 2 - ballRect.width / 2;
    const centerY = outlineRect.top + outlineRect.height / 2 - ballRect.height / 2;

    winningBall.style.animation = 'none';
    winningBall.style.position = 'fixed';
    winningBall.style.left = (tubeRect.left + (tubeRect.width - ballRect.width) / 2) + 'px';
    winningBall.style.top = (tubeRect.top + (tubeRect.height - ballRect.height) / 2) + 'px';
    winningBall.style.marginLeft = '0';
    winningBall.style.zIndex = '100';
    winningBall.style.transition = 'all 0.45s cubic-bezier(0.55,0.09,0.68,0.53)';
    document.body.appendChild(winningBall);
    winningBall.offsetHeight;

    winningBall.style.left = centerX + 'px';
    winningBall.style.top = centerY + 'px';

    setTimeout(() => {
      container.appendChild(winningBall);
      winningBall.style.position = '';
      winningBall.style.left = origLeft;
      winningBall.style.top = '';
      winningBall.style.bottom = origBottom;
      winningBall.style.marginLeft = '';
      winningBall.style.zIndex = '';
      winningBall.style.transition = '';
      winningBall.style.transform = '';
      winningBall.style.animation = '';
      tube.textContent = '?';
      tube.classList.remove('revealed');
      winningBall.classList.remove('winning');
      resolve();
    }, 450);
  });
}

// Main spin logic
function startSpin() {
  const enabled = getEnabledPrizes();
  if (enabled.length === 0) {
    alert('Vui lòng bật ít nhất một giải trong Cài đặt.');
    return;
  }
  if (isAllPrizesFilled()) {
    allPrizesFilledModal.classList.add('active');
    return;
  }

  state.isSpinning = true;
  spinBtn.disabled = true;
  stopBtn.disabled = false;
  updateResultDisplay(null);
  
  spinAudio.currentTime = 0;
  spinAudio.play().catch(e => console.log('Audio play failed:', e));

  const fallPromises = [];
  for (let i = 0; i < state.numTumblers; i++) {
    fallPromises.push(animateBallFallToJar(i));
  }
  Promise.all(fallPromises).then(() => {
    resetTumblerDisplays();
    renderBalls();
    const digits = pickNDigits();
    const initial = isInitialState();
    const startSpinning = () => {
      startTumblerSpin();
      let elapsed = 0;
      const duration = 3000 + Math.random() * 2000;
      state.spinInterval = setInterval(() => {
        elapsed += 100;
        if (elapsed >= duration) {
          clearInterval(state.spinInterval);
          finishSpin(digits);
          return;
        }
      }, 100);
    };
    if (initial) {
      animateBallsIntoBottle().then(startSpinning);
    } else {
      startSpinning();
    }
  });
}

function finishSpin(digits) {
  stopTumblerSpin();
  spinAudio.pause();
  
  state.isSpinning = false;
  spinBtn.disabled = false;
  stopBtn.disabled = true;

  digits.forEach((d, i) => revealNumberInTumbler(i, d));
  
  // result-numbers hiện sau khi bi lên 2s
  setTimeout(() => {
    updateResultDisplay(digits);
  }, 2000);

  // Fill prize slot (lưu vào state + localStorage cho xemgiai.html)
  const current = getEnabledPrizes()[state.currentPrizeIndex];
  if (current) {
    const val = digits.join('');
    if (!state.filledPrizes[current.index]) state.filledPrizes[current.index] = Array(current.qty).fill('?');
    state.filledPrizes[current.index][state.currentSlotInPrize] = val;

    // Lưu vào lịch sử xem giải nhanh (10 giải gần nhất)
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAW_HISTORY) || '[]');
    history.push({
      prizeIndex: current.index,
      prizeName: PRIZE_NAMES[current.index],
      value: val,
      slotInPrize: state.currentSlotInPrize + 1,
      qty: current.qty,
    });
    localStorage.setItem(STORAGE_KEYS.DRAW_HISTORY, JSON.stringify(history.slice(-10)));

    const slots = document.querySelectorAll(`#slots${current.index} .prize-slot`);
    const nextSlot = slots[state.currentSlotInPrize];
    if (nextSlot) {
      setTimeout(() => {
        nextSlot.textContent = val;
        nextSlot.classList.add('filled');
      }, 2000); // Wait for result display together
    }

    state.currentSlotInPrize++;
    if (state.currentSlotInPrize >= current.qty) {
      state.currentSlotInPrize = 0;
      state.currentPrizeIndex++;
      if (state.currentPrizeIndex >= getEnabledPrizes().length) {
        state.currentPrizeIndex = 0;
      }
    }
    setTimeout(() => {
      updatePrizeCounter();
    }, 2000); // Also delay counter update
  }

  saveState();

  // Cập nhật list xem giải nhanh: hiện sau result-numbers 1s (tức là sau reveal 3s)
  setTimeout(() => {
    renderRecentDrawsList();
  }, 3000);

  // Sau lần quay đầu: bi chảy vào bình đáy (ellipse), overflow hidden, logic cũ
  setTimeout(() => {
    renderBalls(digits);
  }, 850);
}

function stopSpin() {
  if (!state.isSpinning || !state.currentSpinDigits) return;
  clearInterval(state.spinInterval);
  finishSpin(state.currentSpinDigits);
  state.currentSpinDigits = null;
}

// Settings
function openSettings() {
  settingsModal.classList.add('active');
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

function applySettingsFromModal() {
  state.numTumblers = Math.max(2, Math.min(6, parseInt(numTumblersInput.value, 10) || 4));
  document.querySelectorAll('#boSoPerTumbler input').forEach((input, i) => {
    state.boSoPerTumbler[i] = Math.max(2, Math.min(10, parseInt(input.value, 10) || 10));
  });
  state.noRepeat = noRepeatInput.checked;

  // Read ball colors (ensure 8 slots)
  state.ballColors = [...DEFAULT_BALL_COLORS];
  document.querySelectorAll('#ballColors input[type="color"]').forEach((input, i) => {
    state.ballColors[i] = input.value;
  });

  for (let i = 0; i < 10; i++) {
    const check = document.querySelector(`.prize-check[data-prize="${i}"]`);
    const qty = document.querySelector(`.prize-qty[data-prize="${i}"]`);
    if (check && qty) {
      state.prizes[i].enabled = check.checked;
      state.prizes[i].qty = check.checked ? Math.max(1, parseInt(qty.value, 10) || 1) : 0;
    }
  }

  initUI();
  saveState();
  closeSettings();
}

// Khi đổi số lượng bình trong modal → cập nhật ngay bộ số và màu bi
numTumblersInput.addEventListener('input', () => {
  const n = Math.max(2, Math.min(6, parseInt(numTumblersInput.value, 10) || 4));
  renderBoSoPerTumbler(n);
  renderBallColorPickers(n);
});

// Khi tick/bỏ tick giải → set số lượng mặc định
document.querySelectorAll('.prize-check').forEach(check => {
  check.addEventListener('change', () => {
    const qty = document.querySelector(`.prize-qty[data-prize="${check.dataset.prize}"]`);
    if (qty) qty.value = check.checked ? 1 : 0;
  });
});

// Render list xem giải nhanh (10 giải gần nhất) - bên trái
function renderRecentDrawsList() {
  const container = document.getElementById('recentDrawsList');
  if (!container) return;
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAW_HISTORY) || '[]');
    container.innerHTML = '';
    if (history.length === 0) {
      container.innerHTML = '<div class="recent-draws-empty">Chưa có kết quả</div>';
      return;
    }
    history.slice().reverse().forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'recent-draw-item';
      el.dataset.prizeIndex = item.prizeIndex;
      const slotLabel = item.qty > 1 ? ` (${item.slotInPrize}/${item.qty})` : '';
      el.innerHTML = `<span class="recent-draw-prize">${item.prizeName}${slotLabel}</span><span class="recent-draw-value">${item.value}</span>`;
      container.appendChild(el);
    });
  } catch (e) {
    container.innerHTML = '<div class="recent-draws-empty">—</div>';
  }
}

// Reset: mở modal xác nhận, chỉ xóa giải thưởng (giữ cài đặt)
function openResetModal() {
  resetModal.classList.add('active');
}

function closeResetModal() {
  resetModal.classList.remove('active');
}

function confirmResetPrizes() {
  state.filledPrizes = {};
  state.drawnNumbers = [];
  state.currentPrizeIndex = 0;
  state.currentSlotInPrize = 0;
  localStorage.removeItem(STORAGE_KEYS.FILLED_PRIZES);
  localStorage.removeItem(STORAGE_KEYS.DRAWN_NUMBERS);
  localStorage.removeItem(STORAGE_KEYS.DRAW_HISTORY);
  saveState();
  initUI();
  closeResetModal();
  closeSettings();
}

// Event listeners
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', applySettingsFromModal);
if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', openResetModal);
if (resetConfirmBtn) resetConfirmBtn.addEventListener('click', confirmResetPrizes);
if (resetCancelBtn) resetCancelBtn.addEventListener('click', closeResetModal);
spinBtn.addEventListener('click', startSpin);
stopBtn.addEventListener('click', stopSpin);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

if (resetModal) resetModal.addEventListener('click', (e) => {
  if (e.target === resetModal) closeResetModal();
});

if (allPrizesFilledCloseBtn) allPrizesFilledCloseBtn.addEventListener('click', () => {
  allPrizesFilledModal.classList.remove('active');
});
if (allPrizesFilledModal) allPrizesFilledModal.addEventListener('click', (e) => {
  if (e.target === allPrizesFilledModal) allPrizesFilledModal.classList.remove('active');
});

// Init
loadState();
initUI();
