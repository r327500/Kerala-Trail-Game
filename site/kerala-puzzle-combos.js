(() => {
  const size = 7;
  const animalCount = 6;
  const specialTiles = new Map();
  const specialInfo = {
    row: { icon: '🚐', name: 'Road Rocket' },
    column: { icon: '🛺', name: 'River Rocket' },
    burst: { icon: '🌧️', name: 'Monsoon Burst' },
    wild: { icon: '🌈', name: 'Rainbow Parrot' }
  };

  let puzzleStage = 8;
  let goalTarget = 18;
  let freeHelpUsed = false;
  let puzzleEnded = false;
  let lastSwap = null;

  const style = document.createElement('style');
  style.textContent = `
    .tile.special { outline: 2px solid #f7c956; outline-offset: -2px; z-index: 1; }
    .tile.special-burst { background: linear-gradient(145deg,#fff0c4,#f6c76c); }
    .tile.special-wild { background: linear-gradient(135deg,#f8cbe6,#c9c8ff 48%,#a8e7d2); }
    .special-mark { position:absolute; right:0; top:0; min-width:19px; height:19px; padding:1px 2px;
      display:grid; place-items:center; border:1px solid #fff; border-radius:7px 10px 7px 7px;
      background:#fff7df; box-shadow:0 2px 4px #263e332e; font:12px/1 system-ui,sans-serif; z-index:3; }
    .puzzle-tip { width:min(100%,610px); margin:5px 0 1px; padding:6px 9px; border-radius:10px;
      background:#fffaf0; color:#65766a; text-align:center; font:800 9px/1.35 Nunito,system-ui,sans-serif; }
    .puzzle-retry { display:block; margin:8px auto 0; padding:9px 14px; border:0; border-radius:12px;
      background:linear-gradient(#f7c957,#eca747); color:#5e4826; font:900 11px Nunito,system-ui,sans-serif; cursor:pointer; }
    .puzzle-retry[hidden] { display:none; }
    @media(max-width:680px) { .puzzle-tip { font-size:8px; } }
  `;
  document.head.appendChild(style);

  const tip = document.createElement('div');
  tip.className = 'puzzle-tip';
  tip.textContent = '4 in a row → 🚐 line clear · T or L → 🌧️ 3×3 burst · 5 in a row → 🌈 clear that animal';
  const movesRow = document.querySelector('.moves');
  if (movesRow) movesRow.insertAdjacentElement('afterend', tip);

  const retry = document.createElement('button');
  retry.id = 'puzzleRetry';
  retry.className = 'puzzle-retry';
  retry.type = 'button';
  retry.textContent = '↻ Retry this puzzle';
  retry.hidden = true;
  retry.onclick = restartPuzzle;
  const boosts = document.querySelector('.boosts');
  if (boosts) boosts.insertAdjacentElement('afterend', retry);

  function makeCleanBoard() {
    const next = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let choices = Array.from({ length: animalCount }, (_, n) => n);
        if (col >= 2 && next[row * size + col - 1] === next[row * size + col - 2]) {
          choices = choices.filter(value => value !== next[row * size + col - 1]);
        }
        if (row >= 2 && next[(row - 1) * size + col] === next[(row - 2) * size + col]) {
          choices = choices.filter(value => value !== next[(row - 1) * size + col]);
        }
        next.push(choices[Math.floor(Math.random() * choices.length)]);
      }
    }
    return next;
  }

  function findMatches() {
    const groups = [];
    const hits = new Set();
    const horizontal = new Set();
    const vertical = new Set();

    for (let row = 0; row < size; row++) {
      let col = 0;
      while (col < size) {
        const value = board[row * size + col];
        let end = col + 1;
        while (value >= 0 && end < size && board[row * size + end] === value) end++;
        if (value >= 0 && end - col >= 3) {
          const cells = [];
          for (let c = col; c < end; c++) {
            const index = row * size + c;
            cells.push(index); hits.add(index); horizontal.add(index);
          }
          groups.push({ direction: 'row', cells });
        }
        col = end;
      }
    }

    for (let col = 0; col < size; col++) {
      let row = 0;
      while (row < size) {
        const value = board[row * size + col];
        let end = row + 1;
        while (value >= 0 && end < size && board[end * size + col] === value) end++;
        if (value >= 0 && end - row >= 3) {
          const cells = [];
          for (let r = row; r < end; r++) {
            const index = r * size + col;
            cells.push(index); hits.add(index); vertical.add(index);
          }
          groups.push({ direction: 'column', cells });
        }
        row = end;
      }
    }

    const crossings = new Set([...horizontal].filter(index => vertical.has(index)));
    return { groups, hits, crossings };
  }

  function chooseSpecial(info, preferred) {
    let type;
    let candidates;
    if (info.crossings.size) {
      type = 'burst'; candidates = [...info.crossings];
    } else {
      const longRun = info.groups.filter(group => group.cells.length >= 5)
        .sort((a, b) => b.cells.length - a.cells.length)[0];
      if (longRun) {
        type = 'wild'; candidates = longRun.cells;
      } else {
        const fourRun = info.groups.filter(group => group.cells.length === 4)[0];
        if (!fourRun) return null;
        type = fourRun.direction === 'row' ? 'row' : 'column';
        candidates = fourRun.cells;
      }
    }

    const preferredIndex = preferred?.[1];
    if (candidates.includes(preferredIndex) && !specialTiles.has(preferredIndex)) {
      return { index: preferredIndex, type };
    }
    const firstIndex = preferred?.[0];
    if (candidates.includes(firstIndex) && !specialTiles.has(firstIndex)) {
      return { index: firstIndex, type };
    }
    const available = candidates.filter(index => !specialTiles.has(index));
    if (!available.length) return null;
    return { index: available[Math.floor(available.length / 2)], type };
  }

  function expandSpecials(initialHits) {
    const hits = new Set(initialHits);
    const queue = [...hits];
    const activated = new Set();

    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      const type = specialTiles.get(index);
      if (!type || activated.has(index)) continue;
      activated.add(index);
      specialTiles.delete(index);
      const row = Math.floor(index / size);
      const col = index % size;
      let affected = [];

      if (type === 'row') {
        affected = Array.from({ length: size }, (_, c) => row * size + c);
      } else if (type === 'column') {
        affected = Array.from({ length: size }, (_, r) => r * size + col);
      } else if (type === 'burst') {
        for (let r = Math.max(0, row - 1); r <= Math.min(size - 1, row + 1); r++) {
          for (let c = Math.max(0, col - 1); c <= Math.min(size - 1, col + 1); c++) affected.push(r * size + c);
        }
      } else if (type === 'wild') {
        const animal = board[index];
        affected = board.flatMap((value, i) => value === animal ? [i] : []);
      }

      for (const target of affected) {
        if (!hits.has(target)) { hits.add(target); queue.push(target); }
      }
    }
    return { hits, activated: activated.size };
  }

  function collapseBoard(hits) {
    const nextBoard = Array(size * size).fill(-1);
    const nextSpecials = new Map();
    for (let col = 0; col < size; col++) {
      let writeRow = size - 1;
      for (let row = size - 1; row >= 0; row--) {
        const from = row * size + col;
        if (hits.has(from) || board[from] < 0) continue;
        const to = writeRow * size + col;
        nextBoard[to] = board[from];
        if (specialTiles.has(from)) nextSpecials.set(to, specialTiles.get(from));
        writeRow--;
      }
      while (writeRow >= 0) {
        nextBoard[writeRow * size + col] = Math.floor(Math.random() * animalCount);
        writeRow--;
      }
    }
    board = nextBoard;
    specialTiles.clear();
    for (const [index, type] of nextSpecials) specialTiles.set(index, type);
  }

  function hasLegalMove() {
    for (let index = 0; index < size * size; index++) {
      const neighbors = [];
      if (index % size < size - 1) neighbors.push(index + 1);
      if (index < size * (size - 1)) neighbors.push(index + size);
      for (const other of neighbors) {
        if (specialTiles.has(index) || specialTiles.has(other)) return true;
        [board[index], board[other]] = [board[other], board[index]];
        const found = findMatches().hits.size > 0;
        [board[index], board[other]] = [board[other], board[index]];
        if (found) return true;
      }
    }
    return false;
  }

  function reshuffleIfStuck() {
    if (hasLegalMove()) return false;
    const source = board.slice();
    for (let attempt = 0; attempt < 80; attempt++) {
      const shuffled = source.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      board = shuffled;
      if (!findMatches().hits.size && hasLegalMove()) return true;
    }
    board = makeCleanBoard();
    specialTiles.clear();
    return true;
  }

  function swapSpecialPositions(a, b) {
    const specialA = specialTiles.get(a);
    const specialB = specialTiles.get(b);
    specialTiles.delete(a); specialTiles.delete(b);
    if (specialA) specialTiles.set(b, specialA);
    if (specialB) specialTiles.set(a, specialB);
  }

  const previousRender = render;
  render = function renderPuzzleState() {
    previousRender();
    const scoreNode = $('score');
    const count = scoreNode?.parentElement;
    if (count) count.innerHTML = `<b id="score">${score}</b> / ${goalTarget}`;
    const progress = $('progress');
    if (progress) progress.style.width = `${Math.min(score / goalTarget * 100, 100)}%`;
    const badge = document.querySelector('.level');
    if (badge) badge.textContent = `PUZZLE ${String(puzzleStage).padStart(2, '0')}`;
    const goalText = document.querySelector('.goaltext');
    if (goalText) goalText.innerHTML = `<small>ANIMAL GOAL · PUZZLE ${String(puzzleStage).padStart(2, '0')}</small>Clear ${goalTarget} animals for a road bonus`;
    const helpButton = document.querySelector('.boost[onclick*="hands"]');
    if (helpButton) {
      helpButton.disabled = freeHelpUsed;
      helpButton.style.opacity = freeHelpUsed ? '.55' : '';
      helpButton.title = freeHelpUsed ? 'Helping Hands already used this puzzle' : 'Add five moves once this puzzle';
    }
    retry.hidden = !puzzleEnded;

    for (const [index, type] of specialTiles) {
      const tile = $('board')?.children[index];
      if (!tile) continue;
      tile.classList.add('special', `special-${type}`);
      tile.setAttribute('aria-label', `${animalNames[board[index]]} · ${specialInfo[type].name}`);
      const marker = document.createElement('span');
      marker.className = 'special-mark';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = specialInfo[type].icon;
      tile.appendChild(marker);
    }
  };

  matches = function puzzleMatches() { return findMatches().hits; };

  async function resolveBoard(forcedHits = null) {
    if (busy) return;
    busy = true;
    selected = -1;
    let total = 0;
    let chains = 0;
    let activated = 0;
    let created = 0;
    let createSpecial = forcedHits === null;
    let hit = forcedHits ? new Set(forcedHits) : findMatches().hits;
    const preferredSwap = lastSwap;
    lastSwap = null;

    while (hit.size && chains < 40) {
      chains++;
      if (createSpecial) {
        const chosen = chooseSpecial(findMatches(), preferredSwap);
        if (chosen && !specialTiles.has(chosen.index)) {
          specialTiles.set(chosen.index, chosen.type);
          hit.delete(chosen.index);
          created++;
        }
        createSpecial = false;
      }

      const expanded = expandSpecials(hit);
      hit = expanded.hits;
      activated += expanded.activated;
      if (!hit.size) break;
      hit.forEach(index => $('board').children[index]?.classList.add('burst'));
      await new Promise(resolve => setTimeout(resolve, 210));
      total += hit.size;
      collapseBoard(hit);
      render();
      [...$('board').children].forEach(tile => tile.classList.add('fall'));
      await new Promise(resolve => setTimeout(resolve, 190));
      hit = findMatches().hits;
    }

    score += total;
    const earned = total * 2 + Math.max(0, chains - 1) * 3 + created * 4 + activated * 2;
    tripCoins += earned;
    let clearedStage = false;
    while (score >= goalTarget) {
      score -= goalTarget;
      puzzleStage++;
      goalTarget = Math.min(18 + Math.floor((puzzleStage - 8) / 2) * 3, 30);
      moves = 22;
      freeHelpUsed = false;
      tripCoins += 15;
      clearedStage = true;
    }

    const reshuffled = !puzzleEnded && reshuffleIfStuck();
    render();
    busy = false;
    if (clearedStage) {
      say(`Puzzle cleared! +15 road coins · Puzzle ${String(puzzleStage).padStart(2, '0')} begins.`);
    } else if (created || activated || chains > 1) {
      say(`Combo chain ×${chains}! ${created ? `${created} special made · ` : ''}+${earned} trip coins.`);
    } else if (total) {
      say(`Animal match! +${earned} trip coins.`);
    }
    if (reshuffled) say('No moves left on the board — your animal crew reshuffled it!');

    if (moves <= 0 && score < goalTarget) {
      puzzleEnded = true;
      render();
      say(`Out of moves · ${score}/${goalTarget} animals. Retry this puzzle when ready.`);
    }
  }

  clearMatches = function clearPuzzleMatches() { return resolveBoard(); };

  tap = function tapPuzzle(index) {
    if (busy || puzzleEnded) return;
    if (selected < 0) { selected = index; render(); return; }
    const first = selected;
    selected = -1;
    if (first === index || !swapok(first, index)) { selected = index; render(); return; }
    if (moves <= 0) { say('No moves left. Retry the puzzle to play again.'); return; }

    [board[first], board[index]] = [board[index], board[first]];
    swapSpecialPositions(first, index);
    const touchedSpecial = specialTiles.has(first) || specialTiles.has(index);
    if (touchedSpecial) {
      moves--;
      render();
      resolveBoard(new Set([first, index]));
      return;
    }

    const found = findMatches();
    if (found.hits.size) {
      moves--;
      lastSwap = [first, index];
      render();
      clearMatches();
    } else {
      [board[first], board[index]] = [board[index], board[first]];
      swapSpecialPositions(first, index);
      render();
      say('That swap makes no match. Try a different animal pair.');
    }
  };

  power = function usePuzzlePower(kind) {
    if (busy || puzzleEnded) return;
    if (kind === 'hands') {
      if (freeHelpUsed) { say('Helping Hands can be used once each puzzle.'); return; }
      freeHelpUsed = true;
      moves += 5;
      render();
      say('Your travel crew helped! +5 moves.');
      return;
    }

    const price = kind === 'snack' ? 8 : 12;
    if (tripCoins < price) { say(`Need ${price - tripCoins} more trip coins for that boost.`); return; }
    tripCoins -= price;
    const selectedIndex = selected >= 0 ? selected : Math.floor(Math.random() * board.length);
    const animal = board[selectedIndex];
    const targets = kind === 'snack'
      ? [selectedIndex]
      : board.flatMap((value, index) => value === animal ? [index] : []);
    selected = -1;
    resolveBoard(new Set(targets));
  };

  function restartPuzzle() {
    puzzleEnded = false;
    freeHelpUsed = false;
    score = 0;
    moves = 22;
    selected = -1;
    lastSwap = null;
    specialTiles.clear();
    board = makeCleanBoard();
    reshuffleIfStuck();
    render();
    say('Fresh board — find a combo and keep the Kerala trip moving!');
  }

  board = makeCleanBoard();
  reshuffleIfStuck();
  render();
})();
