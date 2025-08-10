import { Chessground, Api as ChessgroundApi } from 'https://cdn.skypack.dev/@lichess-org/chessground';
import { Chess } from 'https://esm.sh/chess.js@1.4.0';

const boardEl = document.getElementById('board') as HTMLElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const overlayCells: HTMLDivElement[] = [];
const fenInput = document.getElementById('fen') as HTMLTextAreaElement;

const chess = new Chess();
fenInput.value = chess.fen();

let myColor: 'w' | 'b' = 'w';
let currentMode: 'opp' | 'mine' | 'none' = 'opp';
let lastMode: 'opp' | 'mine' = 'opp';

const ground: ChessgroundApi = Chessground(boardEl, {
  orientation: 'white',
  movable: { color: 'white', showDests: true, free: false, events: { after: onAfterMove } },
  premovable: { enabled: false },
  drawable: { enabled: false, visible: false },
});

const LOCALE_KEY = 'locale';
const i18n = {
  en: {
    lang: { en: 'EN', zh: '中文' },
    btn: {
      applyFen: 'Apply FEN',
      reset: 'Start position',
      toggle: 'Show/Hide (A)',
      opp: 'Opponent (O)',
      mine: 'Mine (M)',
      clear: 'Hide (H)',
      switchSide: 'Switch side (W/B)'
    },
    badge: {
      shortcuts: 'Hotkeys: A show/hide (keep last side) / O opponent / M mine / H hide',
      drag: 'Drag or click to move; overlay updates in real time'
    },
    legend: 'Red: opponent control; Blue: my control. Opacity scales linearly with count.'
  },
  zh: {
    lang: { en: 'EN', zh: '中文' },
    btn: {
      applyFen: '应用 FEN',
      reset: '起始局面',
      toggle: '显示/隐藏 (A)',
      opp: '只看对方 (O)',
      mine: '只看己方 (M)',
      clear: '隐藏 (H)',
      switchSide: '切换我方(白/黑)'
    },
    badge: {
      shortcuts: '快捷键：A 显示/隐藏（保留最近选择） / O 只对方 / M 只己方 / H 隐藏',
      drag: '拖拽或点击走子也会实时更新覆盖层'
    },
    legend: '红色：对方控制强度；蓝色：己方控制强度。透明度按控制次数线性映射。'
  }
};

function getDictValue(dict: any, path: string): string | undefined {
  const parts = path.split('.');
  let cur: any = dict;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return undefined;
  }
  return cur as string | undefined;
}

let currentLocale = localStorage.getItem(LOCALE_KEY) || 'en';
function applyLocale(locale: 'en' | 'zh') {
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
  const dict = (i18n as any)[locale] || (i18n as any).en;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = (el as HTMLElement).getAttribute('data-i18n')!;
    const val = getDictValue(dict, key);
    if (typeof val === 'string') (el as HTMLElement).textContent = val;
  });
  document.getElementById('lang-en')!.classList.toggle('active', locale === 'en');
  document.getElementById('lang-zh')!.classList.toggle('active', locale === 'zh');
}

function ensureOverlayAttached() {
  const cgBoard = boardEl.querySelector('.cg-board');
  if (cgBoard && overlay.parentElement !== cgBoard) {
    cgBoard.appendChild(overlay);
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    const probe = document.createElement('div');
    probe.className = 'probe-cell';
    overlay.appendChild(probe);
    requestAnimationFrame(() => {
      const rect = probe.getBoundingClientRect();
      (overlay as any).dataset.cellW = String(Math.floor(rect.width));
      (overlay as any).dataset.cellH = String(Math.floor(rect.height));
      overlay.removeChild(probe);
      refreshOverlay();
    });
  }
}

function handleResize() {
  setTimeout(() => {
    ensureOverlayAttached();
    refreshOverlay();
  }, 100);
}
ensureOverlayAttached();

function onAfterMove(orig: string, dest: string) {
  const move = chess.move({ from: orig, to: dest, promotion: 'q' });
  if (!move) {
    ground.cancelMove();
    return;
  }
  ground.set({ fen: chess.fen(), lastMove: [orig, dest] as any });
  updateMovable();
  refreshOverlay();
}

const filesArr = ['a','b','c','d','e','f','g','h'];
const ranksArr = ['1','2','3','4','5','6','7','8'];
const inBounds = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
const toSq = (f: number, r: number) => `${String.fromCharCode('a'.charCodeAt(0) + f)}${r + 1}`;
const fromSq = (sq: string) => ({
  f: sq.charCodeAt(0) - 'a'.charCodeAt(0),
  r: parseInt(sq[1], 10) - 1,
});

function enumerateAttacksFor(square: string, piece: { color: 'w'|'b'; type: 'p'|'n'|'b'|'r'|'q'|'k' }) {
  const { f, r } = fromSq(square);
  const res: string[] = [];
  const color = piece.color;
  const type = piece.type;

  const pushIf = (nf: number, nr: number) => {
    if (!inBounds(nf, nr)) return false;
    const targetSq = toSq(nf, nr);
    res.push(targetSq);
    return !chess.get(targetSq as any);
  };

  if (type === 'p') {
    const dir = color === 'w' ? 1 : -1;
    const cand = [ [f - 1, r + dir], [f + 1, r + dir] ];
    for (const [nf, nr] of cand) if (inBounds(nf, nr)) res.push(toSq(nf, nr));
    return res;
  }

  if (type === 'n') {
    const d = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ];
    for (const [df, dr] of d) {
      const nf = f + df, nr = r + dr;
      if (inBounds(nf, nr)) res.push(toSq(nf, nr));
    }
    return res;
  }

  if (type === 'k') {
    const d = [
      [-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]
    ];
    for (const [df, dr] of d) {
      const nf = f + df, nr = r + dr;
      if (inBounds(nf, nr)) res.push(toSq(nf, nr));
    }
    return res;
  }

  const dirs: Array<[number, number]> = [];
  if (type === 'b' || type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
  if (type === 'r' || type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
  for (const [df, dr] of dirs) {
    let nf = f + df, nr = r + dr;
    while (inBounds(nf, nr)) {
      pushIf(nf, nr);
      const target = toSq(nf, nr);
      if (chess.get(target as any)) break;
      nf += df; nr += dr;
    }
  }
  return res;
}

function computeControl() {
  const size = 8;
  const white = Array.from({ length: size }, () => Array(size).fill(0));
  const black = Array.from({ length: size }, () => Array(size).fill(0));

  for (const f of filesArr) {
    for (const r of ranksArr) {
      const sq = `${f}${r}`;
      const piece = chess.get(sq as any);
      if (!piece) continue;
      const attacks = enumerateAttacksFor(sq, piece as any);
      for (const t of attacks) {
        const tf = t.charCodeAt(0) - 'a'.charCodeAt(0);
        const tr = parseInt(t[1], 10) - 1;
        if ((piece as any).color === 'w') white[tr][tf] += 1;
        else black[tr][tf] += 1;
      }
    }
  }
  return { white, black };
}

function ensureOverlayCells() {
  if (overlay.childElementCount === 64 && overlayCells.length === 64) return;
  overlay.innerHTML = '';
  overlayCells.length = 0;
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'overlay-cell';
    (cell as HTMLDivElement).style.pointerEvents = 'none';
    overlay.appendChild(cell);
    overlayCells.push(cell as HTMLDivElement);
  }
}

function refreshOverlay(mode: 'opp'|'mine'|'none' = currentMode) {
  currentMode = mode;
  ensureOverlayAttached();
  ensureOverlayCells();

  if (mode === 'none') {
    for (let i = 0; i < 64; i++) overlayCells[i].style.display = 'none';
    return;
  }

  const { white, black } = computeControl();
  const mineColor = myColor;
  const oppColor = mineColor === 'w' ? 'b' : 'w';

  const maxVal = 6;
  const isWhitePerspective = myColor === 'w';

  const cgBoard = boardEl.querySelector('.cg-board') as HTMLElement | null;
  const rect = cgBoard ? cgBoard.getBoundingClientRect() : overlay.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  const cellW = W / 8;
  const cellH = H / 8;
  const x = Array.from({ length: 9 }, (_, i) => i * cellW);
  const y = Array.from({ length: 9 }, (_, i) => i * cellH);
  overlay.style.left = '0px';
  overlay.style.top = '0px';
  overlay.style.width = '100%';
  overlay.style.height = '100%';

  const showMineOnly = mode === 'mine';
  const showOppOnly = mode === 'opp';

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const wv = white[r][f];
      const bv = black[r][f];
      const mineV = mineColor === 'w' ? wv : bv;
      const oppV = oppColor === 'w' ? wv : bv;
      const col = isWhitePerspective ? f : 7 - f;
      const row = isWhitePerspective ? 7 - r : r;

      let alpha = 0;
      let className = '';
      if (showMineOnly && mineV > 0) {
        alpha = Math.min(0.7, mineV / maxVal);
        className = 'heat-blue';
      } else if (showOppOnly && oppV > 0) {
        alpha = Math.min(0.7, oppV / maxVal);
        className = 'heat';
      }
      const cell = overlayCells[row * 8 + col];
      cell.style.left = x[col] + 'px';
      cell.style.top = y[row] + 'px';
      cell.style.width = (x[col + 1] - x[col]).toFixed(2) + 'px';
      cell.style.height = (y[row + 1] - y[row]).toFixed(2) + 'px';
      if (alpha > 0) {
        cell.className = 'overlay-cell ' + className;
        cell.style.setProperty('--alpha', alpha.toString());
        cell.style.display = 'block';
      } else {
        cell.style.display = 'none';
      }
    }
  }
}

document.getElementById('btn-apply-fen')!.addEventListener('click', () => {
  const val = fenInput.value.trim();
  try {
    chess.load(val);
    ground.set({ fen: chess.fen() });
    updateMovable();
    refreshOverlay();
  } catch (e) { alert('FEN 无效'); }
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  chess.reset();
  ground.set({ fen: chess.fen(), lastMove: undefined as any });
  updateMovable();
  refreshOverlay();
});

document.getElementById('btn-toggle')!.addEventListener('click', () => {
  const next = currentMode === 'none' ? lastMode : 'none';
  refreshOverlay(next as any);
});
document.getElementById('btn-opponent')!.addEventListener('click', () => { lastMode = 'opp'; refreshOverlay('opp'); });
document.getElementById('btn-mine')!.addEventListener('click', () => { lastMode = 'mine'; refreshOverlay('mine'); });
document.getElementById('btn-clear')!.addEventListener('click', () => refreshOverlay('none'));

window.addEventListener('keydown', (e) => {
  if (e.key === 'a' || e.key === 'A') {
    const next = currentMode === 'none' ? lastMode : 'none';
    refreshOverlay(next as any);
  } else if (e.key === 'o' || e.key === 'O') {
    lastMode = 'opp';
    refreshOverlay('opp');
  } else if (e.key === 'm' || e.key === 'M') {
    lastMode = 'mine';
    refreshOverlay('mine');
  } else if (e.key === 'h' || e.key === 'H') {
    refreshOverlay('none');
  }
});

document.getElementById('btn-switch-side')!.addEventListener('click', () => {
  myColor = myColor === 'w' ? 'b' : 'w';
  ground.set({ orientation: myColor === 'w' ? 'white' : 'black' });
  refreshOverlay();
});

document.getElementById('lang-en')!.addEventListener('click', () => applyLocale('en'));
document.getElementById('lang-zh')!.addEventListener('click', () => applyLocale('zh'));

const ro = new ResizeObserver(() => handleResize());
ro.observe(document.querySelector('.board-wrap')!);
window.addEventListener('resize', () => handleResize());
window.addEventListener('orientationchange', () => setTimeout(() => handleResize(), 500));

function updateMovable() {
  const verbose = chess.moves({ verbose: true }) as any[];
  const dests = new Map<string, string[]>();
  for (const m of verbose) {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from)!.push(m.to);
  }
  ground.set({ movable: { color: 'both', dests, showDests: true, free: false } as any });
}

ground.set({ orientation: myColor === 'w' ? 'white' : 'black' });
updateMovable();
applyLocale(currentLocale as 'en'|'zh');
refreshOverlay();


