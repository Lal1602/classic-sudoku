// ====== STATE ======
let solution = [];      // 9x9 solusi final
let puzzle = [];        // 9x9 board current
let gameActive = false;
let timerInterval = null;
let secondsElapsed = 0;
let selected = null;    // { r, c }
let lives = 0;
let highscore = parseInt(localStorage.getItem("sudokuHighscore") || "0", 10) || null;

// ====== UTIL WAKTU ======
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
function updateTimerUI() {
  document.getElementById("timer").textContent = `Time: ${formatTime(secondsElapsed)}`;
}
function updateHighscoreUI() {
  document.getElementById("highscore").textContent =
    highscore ? `Highscore: ${formatTime(highscore)}` : "Highscore: -";
}
function updateLivesUI(){
  document.getElementById("lives").textContent = `Lives: ${lives}`;
}

// ====== SUDOKU SOLVER ======
function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const sr = Math.floor(row / 3) * 3;
  const sc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (board[sr + r][sc + c] === num) return false;
  }
  return true;
}

function solveBacktrack(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random()-0.5);
        for (const n of nums) {
          if (isValid(board, r, c, n)) {
            board[r][c] = n;
            if (solveBacktrack(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

// count solutions up to 2 (untuk cek keunikan)
function countSolutions(board, limit=2){
  let count = 0;
  function search(b){
    for (let r=0;r<9;r++){
      for (let c=0;c<9;c++){
        if (b[r][c]===0){
          for (let n=1;n<=9;n++){
            if (isValid(b, r, c, n)){
              b[r][c]=n;
              search(b);
              if (count>=limit) return;
              b[r][c]=0;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  const clone = board.map(row=>row.slice());
  search(clone);
  return count;
}

// Generate board solved, lalu buang angka sambil jaga 1 solusi
function generateSolvedBoard(){
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveBacktrack(board);
  return board;
}

function makePuzzleUnique(full, clues){
  const p = full.map(r=>r.slice());
  let cells = Array.from({length:81}, (_,i)=>i);
  // random order
  for(let i=cells.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [cells[i],cells[j]]=[cells[j],cells[i]];
  }
  let removed = 81 - clues;
  for (const idx of cells){
    if (removed<=0) break;
    const r = Math.floor(idx/9), c = idx%9;
    const saved = p[r][c];
    if (saved===0) continue;
    p[r][c]=0;
    // cek unik
    if (countSolutions(p,2) !== 1){
      p[r][c]=saved; // balikin kalau jadi tidak unik
    } else {
      removed--;
    }
  }
  return p;
}

// ====== RENDER & INTERAKSI ======
function getCellEl(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function clearSelected() {
  if (selected) {
    const el = getCellEl(selected.r, selected.c);
    if (el) el.classList.remove("selected");
    selected = null;
  }
  // bersihkan highlight baris/kolom & number highlights
  document.querySelectorAll(".cell.hl").forEach(el=>el.classList.remove("hl"));
  document.querySelectorAll(".cell.num-hl").forEach(el=>el.classList.remove("num-hl"));
}

function setSelected(r, c) {
  clearSelected();
  selected = { r, c };
  const el = getCellEl(r, c);
  if (el) el.classList.add("selected");
  // highlight baris & kolom (for selection)
  for (let i=0;i<9;i++){
    const a = getCellEl(r, i); if (a) a.classList.add("hl");
    const b = getCellEl(i, c); if (b) b.classList.add("hl");
  }
}

/**
 * Highlight only empty cells that are in the same row or column as
 * a fixed (generated) number cell with value `num`.
 * - do NOT change color of filled cells (fixed or user-filled).
 * - this is used when the user clicks an existing number on board.
 */
function highlightEmptyAlignedWithNumber(num, r0, c0) {
  // clear previous highlights first
  document.querySelectorAll(".cell.num-hl").forEach(el=>el.classList.remove("num-hl"));
  // iterate row r0
  for (let c=0;c<9;c++){
    if (c===c0) continue; // skip the number cell itself
    const el = getCellEl(r0, c);
    if (!el) continue;
    // highlight only if currently empty (no textContent)
    if (el.textContent === "") el.classList.add("num-hl");
  }
  // iterate column c0
  for (let r=0;r<9;r++){
    if (r===r0) continue;
    const el = getCellEl(r, c0);
    if (!el) continue;
    if (el.textContent === "") el.classList.add("num-hl");
  }
}

// Render board DOM from `board` 9x9 matrix
function renderBoard(board) {
  const boardDiv = document.getElementById("sudoku-board");
  boardDiv.innerHTML = "";

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      // garis tebal antar box (3x3)
      if ((c + 1) % 3 === 0 && c !== 8) cell.classList.add("box-right");
      if ((r + 1) % 3 === 0 && r !== 8) cell.classList.add("box-bottom");

      if (board[r][c] !== 0) {
        cell.textContent = board[r][c];
        cell.setAttribute("data-fixed", "true");
        // when clicking a generated number: highlight empty aligned cells
        cell.addEventListener("click", (e) => {
          if (!gameActive) return;
          // clicking a fixed number should highlight empty aligned cells for that number
          // clear selection highlight, then show number-aligned highlights
          if (selected) {
            // if a user had a cell selected, we clear selection before showing number highlights
            clearSelected();
          }
          // use current position and value
          const val = board[r][c];
          highlightEmptyAlignedWithNumber(val, r, c);
        });
      } else {
        // empty cell: clicking selects (for choosing number via keypad)
        cell.addEventListener("click", () => {
          if (!gameActive) return;
          setSelected(r, c);
        });
      }

      boardDiv.appendChild(cell);
    }
  }
}

/**
 * When a user clicks a pad key, apply number to selected (if any).
 * Also clear any number-highlights (num-hl) because user is taking action.
 */
function applyNumberToSelected(value) {
  // clear number-highlights when player picks a keypad number
  document.querySelectorAll(".cell.num-hl").forEach(el=>el.classList.remove("num-hl"));

  if (!gameActive || !selected) return;

  const { r, c } = selected;
  const cellEl = getCellEl(r, c);
  const isFixed = cellEl.getAttribute("data-fixed") === "true";
  if (isFixed) return;

  if (value === "erase") {
    puzzle[r][c] = 0;
    cellEl.textContent = "";
    cellEl.classList.remove("invalid");
    return;
  }

  const num = parseInt(value, 10);
  if (!(num >= 1 && num <= 9)) return;

  // cek benar / salah terhadap solusi — salah -> nyawa berkurang
  if (num === solution[r][c]) {
    puzzle[r][c] = num;
    cellEl.textContent = num;
    cellEl.classList.remove("invalid");
    // if we filled this, also remove any num-hl that targeted this cell
    cellEl.classList.remove("num-hl");
    if (isSolved()) endGame(true);
  } else {
    cellEl.classList.add("invalid");
    lives = Math.max(0, lives - 1);
    updateLivesUI();
    if (lives === 0) endGame(false);
  }
}

function isSolved() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] !== solution[r][c]) return false;
  return true;
}

// ====== TIMER ======
function startTimer() {
  secondsElapsed = 0;
  updateTimerUI();
  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimerUI();
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ====== GAME FLOW ======
function startGame() {
  gameActive = true;
  clearSelected();

  // difficulty -> jumlah clue & nyawa
  const diff = document.querySelector('input[name="difficulty"]:checked').value;
  let clues = 0;
  if (diff === "easy") { clues = 44; lives = 5; }
  else if (diff === "medium") { clues = 36; lives = 4; }
  else { clues = 28; lives = 3; }
  updateLivesUI();

  // generate solusi valid + puzzle unik
  solution = generateSolvedBoard();
  puzzle = makePuzzleUnique(solution, clues);

  renderBoard(puzzle);

  // aktifkan keypad & board
  document.getElementById("number-pad").classList.remove("disabled");
  document.getElementById("sudoku-board").classList.remove("disabled");

  startTimer();
  document.getElementById("startBtn").style.display = "none";
  document.getElementById("newGameBtn").style.display = "none";
}

function endGame(win) {
  gameActive = false;
  stopTimer();

  if (win) {
    if (!highscore || secondsElapsed < highscore) {
      highscore = secondsElapsed;
      localStorage.setItem("sudokuHighscore", String(highscore));
    }
    updateHighscoreUI();

    document.getElementById("finalTime").textContent = `Waktu: ${formatTime(secondsElapsed)}`;
    document.getElementById("bestTime").textContent = `Best Time: ${formatTime(highscore)}`;
    document.getElementById("winPopup").style.display = "block";
  } else {
    document.getElementById("goTime").textContent = `Waktu: ${formatTime(secondsElapsed)} — nyawa habis.`;
    document.getElementById("gameOverPopup").style.display = "block";
  }

  // nonaktifkan keypad & board setelah selesai
  document.getElementById("number-pad").classList.add("disabled");
  document.getElementById("sudoku-board").classList.add("disabled");

  document.getElementById("newGameBtn").style.display = "inline-block";
}

function newGame() {
  // tutup popups (jika ada) lalu mulai lagi
  document.getElementById("winPopup").style.display = "none";
  document.getElementById("gameOverPopup").style.display = "none";
  startGame();
}

// ====== EVENTS ======
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("newGameBtn").addEventListener("click", newGame);

document.getElementById("closePopup").addEventListener("click", () => {
  document.getElementById("winPopup").style.display = "none";
});
document.getElementById("popupNewGame").addEventListener("click", newGame);

document.getElementById("goClose").addEventListener("click", () => {
  document.getElementById("gameOverPopup").style.display = "none";
});
document.getElementById("goNew").addEventListener("click", newGame);

// Keypad clicks
document.querySelectorAll(".pad-key").forEach(btn => {
  btn.addEventListener("click", () => {
    // clear any number-highlights when user uses keypad
    document.querySelectorAll(".cell.num-hl").forEach(el=>el.classList.remove("num-hl"));
    applyNumberToSelected(btn.dataset.key);
  });
});

// ====== INIT ======
(function init() {
  // render papan kosong biar layout rapi & center
  puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  solution = puzzle.map(row => row.slice());
  renderBoard(puzzle);
  document.getElementById("number-pad").classList.add("disabled");
  document.getElementById("sudoku-board").classList.add("disabled");
  updateTimerUI();
  updateHighscoreUI();
  updateLivesUI();
})();
