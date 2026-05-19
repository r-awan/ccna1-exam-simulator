// ─── STATE ───
let mode = 'all';
let queue = [];
let current = 0;
let selected = [];
let answered = false;
let showedAnswer = false;
let results = {};
let wrongList = []; // stores question indices (into ALL_Q)
let wrongDetails = []; // stores {n, q, correctAnswer} for notes panel
let totalCorrect = 0;
let totalWrong = 0;
let currentOptMap = []; // maps shuffled display index → original option index
const LETTERS = ['A','B','C','D','E','F','G'];

// Track progress for each mode separately
let modeStates = { all: null, exam: null, wrong: null };

let examTimer = null;
let examTimeElapsed = 0; // Stopwatch counting up in seconds

function saveCurrentModeState() {
  if ((mode === 'all' || mode === 'exam' || mode === 'wrong') && queue.length > 0) {
    modeStates[mode] = {
      queue: [...queue],
      current: current,
      selected: [...selected],
      answered: answered,
      showedAnswer: showedAnswer,
      results: { ...results },
      totalCorrect: totalCorrect,
      totalWrong: totalWrong,
      currentOptMap: [...currentOptMap],
      timeElapsed: (mode === 'exam') ? examTimeElapsed : null
    };
  }
}

function randomizeQuestions() {
  // Shuffle the current queue while keeping the same questions
  queue = shuffle(queue);
  // Reset current state
  current = 0;
  selected = [];
  answered = false;
  showedAnswer = false;
  results = {};
  // Rebuild dots and render first question
  buildDots();
  renderQuestion();
  // Show a brief notification
  const qCard = document.getElementById('q-card');
  const notify = document.createElement('div');
  notify.textContent = 'Answers shuffled ✓';
  notify.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--green);color:white;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;z-index:200;animation:fadeInOut 2s ease forwards;';
  document.body.appendChild(notify);
  setTimeout(() => notify.remove(), 2000);
  
  // Save current mode state after shuffle
  saveCurrentModeState();
}

function setMode(m) {
  // Save current progress before switching
  if (mode) {
    saveCurrentModeState();
    if (mode === 'exam') stopTimer();
  }

  const prevMode = mode;
  mode = m;

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${m}'`));
  });

  // Auto-hide wrong notes panel and restore dot-tracker display
  const panel = document.getElementById('wrong-notes');
  if (panel) panel.classList.remove('visible');
  const impPanel = document.getElementById('important-notes');
  if (impPanel) impPanel.classList.remove('visible');
  const tracker = document.getElementById('dot-tracker');
  if (tracker) tracker.style.display = 'flex';

  if (modeStates[m]) {
    // Restore saved progress
    const state = modeStates[m];
    queue = state.queue;
    current = state.current;
    selected = state.selected;
    answered = state.answered;
    showedAnswer = state.showedAnswer;
    results = state.results;
    totalCorrect = state.totalCorrect;
    totalWrong = state.totalWrong;
    currentOptMap = state.currentOptMap;
    if (m === 'exam' && state.timeElapsed !== undefined) {
      examTimeElapsed = state.timeElapsed;
    }
  } else {
    // Initialize new progress for this mode
    if (m === 'all') {
      queue = ALL_Q.map((_,i)=>i);
    } else if (m === 'exam') {
      queue = shuffle([...ALL_Q.map((_,i)=>i)]).slice(0,70);
    } else if (m === 'wrong') {
      queue = wrongList.slice();
      if (!queue.length) {
        alert('No wrong answers yet! Answer some questions first.');
        // Revert UI to the previous mode
        mode = prevMode;
        document.querySelectorAll('.mode-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${prevMode}'`));
        });
        return;
      }
    }
    results = {};
    current = 0;
    selected = [];
    answered = false;
    showedAnswer = false;
    totalCorrect = 0;
    totalWrong = 0;
    
    if (m === 'exam') {
      examTimeElapsed = 0;
    }
  }

  updateHeader();
  buildDots();

  // If the user previously completed the mode, show the score screen
  if (current >= queue.length && queue.length > 0) {
    showScore();
  } else {
    renderQuestion();
    document.getElementById('score-screen').style.display = 'none';
    document.getElementById('q-card').style.display = 'block';
  }
  
  const timerEl = document.getElementById('exam-timer');
  if (m === 'exam') {
    timerEl.style.display = 'flex';
    if (!(current >= queue.length && queue.length > 0)) startTimer();
  } else {
    timerEl.style.display = 'none';
    stopTimer();
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resetQuiz() {
  wrongList = [];
  wrongDetails = [];
  results = {};
  totalCorrect = 0;
  totalWrong = 0;
  // Clear all saved progress states
  modeStates = { all: null, exam: null, wrong: null };
  if (typeof stopTimer === 'function') stopTimer();
  updateWrongNotes();
  setMode('all');
}

// Timer Logic
function startTimer() {
  stopTimer();
  updateTimerDisplay();
  examTimer = setInterval(() => {
    examTimeElapsed++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }
}

function updateTimerDisplay() {
  const h = Math.floor(examTimeElapsed / 3600);
  const m = Math.floor((examTimeElapsed % 3600) / 60);
  const s = examTimeElapsed % 60;
  const text = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  
  const textEl = document.getElementById('timer-text');
  if (textEl) textEl.textContent = text;
  
  const timerEl = document.getElementById('exam-timer');
  if (timerEl) {
    timerEl.style.color = 'var(--yellow)';
  }
}

function buildDots() {
  const tracker = document.getElementById('dot-tracker');
  tracker.innerHTML = '';
  queue.forEach((qIdx, i) => {
    const dot = document.createElement('div');
    // Color dot if previously answered ('correct' or 'wrong')
    const state = results[i] ? results[i] : '';
    dot.className = 'dot ' + state;
    dot.id = `dot-${i}`;
    dot.title = `Q${i+1}: ${ALL_Q[qIdx].q.substring(0,40)}...`;
    dot.onclick = () => goTo(i);
    tracker.appendChild(dot);
  });
}

function updateDot(i, state) {
  const dot = document.getElementById(`dot-${i}`);
  if (!dot) return;
  dot.className = 'dot ' + (state || '');
}

function goTo(i) {
  if (i >= 0 && i < queue.length) {
    current = i;
    selected = [];
    answered = false;
    showedAnswer = false;
    renderQuestion();
  }
}

function renderQuestion() {
  const qIdx = queue[current];
  const q = ALL_Q[qIdx];
  const total = queue.length;

  document.getElementById('q-counter').textContent = `Question ${current+1} of ${total} (Q${q.n})`;
  document.getElementById('q-type-label').textContent = q.multi ? '◆ Choose multiple' : '';
  document.getElementById('q-text').textContent = q.q;

  // Show image/diagram if available for this question
  const imgEl = document.getElementById('q-image');
  imgEl.classList.remove('revealed');
  if (QUESTION_IMAGES[q.n]) {
    imgEl.innerHTML = QUESTION_IMAGES[q.n];
    imgEl.style.display = 'block';
  } else {
    imgEl.innerHTML = '';
    imgEl.style.display = 'none';
  }

  const hint = document.getElementById('q-hint');
  if (q.multi) {
    hint.style.display = 'block';
    hint.textContent = `◆ Select ${q.correct.length} answer(s) — multiple choice`;
  } else {
    hint.style.display = 'none';
  }

  // Shuffle option order — build a map: shuffledIndex → originalIndex
  const origIndices = q.opts.map((_, i) => i);
  shuffle(origIndices);
  currentOptMap = origIndices;

  const optDiv = document.getElementById('options');
  optDiv.innerHTML = '';
  origIndices.forEach((origIdx, newIdx) => {
    const div = document.createElement('div');
    div.className = 'option';
    div.id = `opt-${newIdx}`;
    div.onclick = () => toggleOption(newIdx);
    div.innerHTML = `
      <div class="option-letter" id="opt-letter-${newIdx}">${LETTERS[newIdx]}</div>
      <div class="option-text">${q.opts[origIdx]}</div>
    `;
    optDiv.appendChild(div);
  });

  document.getElementById('feedback').style.display = 'none';
  document.getElementById('explanation').classList.remove('visible');
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('btn-submit').style.display = 'inline-block';
  document.getElementById('btn-next').style.display = 'none';
  document.getElementById('btn-show').style.display = 'inline-block';
  document.getElementById('progress-bar').style.width = `${((current+1)/queue.length)*100}%`;
  document.getElementById('hdr-total').textContent = queue.length;
  updateHeader();
}

function toggleOption(j) {
  if (answered) return;
  const q = ALL_Q[queue[current]];
  if (!q.multi) {
    selected = [j];
    document.querySelectorAll('.option').forEach((d,i) => {
      d.classList.toggle('selected', i === j);
    });
  } else {
    const idx = selected.indexOf(j);
    if (idx === -1) selected.push(j);
    else selected.splice(idx, 1);
    document.querySelectorAll('.option').forEach((d,i) => {
      d.classList.toggle('selected', selected.includes(i));
    });
  }
  document.getElementById('btn-submit').disabled = selected.length === 0;
}

function submitAnswer() {
  if (answered) return;
  answered = true;
  const q = ALL_Q[queue[current]];
  // Map selected shuffled indices back to original indices before comparing
  const selectedOrig = selected.map(i => currentOptMap[i]).sort((a,b)=>a-b);
  const isCorrect = arrEq(selectedOrig, [...q.correct].sort((a,b)=>a-b));
  showFeedback(isCorrect, q);
  showExplanation(q);
  if (isCorrect) {
    totalCorrect++;
    results[current] = 'correct';
    updateDot(current, 'correct');
  } else {
    totalWrong++;
    results[current] = 'wrong';
    updateDot(current, 'wrong');
    addToWrong(queue[current], q);
  }
  highlightAnswers(q);
  document.getElementById('q-image').classList.add('revealed');
  document.getElementById('btn-submit').style.display = 'none';
  document.getElementById('btn-show').style.display = 'none';
  document.getElementById('btn-next').style.display = 'inline-block';
  updateHeader();
}

function showAnswer() {
  if (answered) return;
  answered = true;
  showedAnswer = true;
  const q = ALL_Q[queue[current]];
  results[current] = 'wrong';
  totalWrong++;
  updateDot(current, 'wrong');
  addToWrong(queue[current], q);
  highlightAnswers(q);
  showExplanation(q);
  document.getElementById('q-image').classList.add('revealed');
  const fb = document.getElementById('feedback');
  fb.className = 'feedback wrong';
  fb.textContent = `Answer revealed. Study this one!`;
  fb.style.display = 'block';
  document.getElementById('btn-submit').style.display = 'none';
  document.getElementById('btn-show').style.display = 'none';
  document.getElementById('btn-next').style.display = 'inline-block';
  updateHeader();
}

function highlightAnswers(q) {
  // Iterate over shuffled positions
  currentOptMap.forEach((origIdx, newIdx) => {
    const div = document.getElementById(`opt-${newIdx}`);
    if (!div) return;
    div.classList.add('disabled');
    div.classList.remove('selected');
    if (q.correct.includes(origIdx)) {
      div.classList.add('correct-ans');
    } else if (selected.includes(newIdx)) {
      div.classList.add('wrong-ans');
    }
  });
}

function showExplanation(q) {
  if (q.exp) {
    document.getElementById('exp-text').textContent = q.exp;
    document.getElementById('explanation').classList.add('visible');
  }
}

function showFeedback(isCorrect, q) {
  const fb = document.getElementById('feedback');
  if (isCorrect) {
    fb.className = 'feedback correct';
    fb.textContent = '✓ Correct!';
  } else {
    // Show letters based on shuffled display positions
    const correctLabels = currentOptMap
      .map((origIdx, newIdx) => q.correct.includes(origIdx) ? LETTERS[newIdx] : null)
      .filter(l => l !== null)
      .join(', ');
    fb.className = 'feedback wrong';
    fb.textContent = `✗ Wrong. Correct answer: ${correctLabels}`;
  }
  fb.style.display = 'block';
}

function addToWrong(qIdx, q) {
  if (!wrongList.includes(qIdx)) {
    wrongList.push(qIdx);
    wrongDetails.push({
      n: q.n,
      q: q.q,
      exp: q.exp || "No explanation available."
    });
    updateWrongNotes();
  }
}

function updateWrongNotes() {
  const list = document.getElementById('wn-list');
  if (wrongDetails.length === 0) {
    list.innerHTML = '<em style="color:var(--muted);font-size:13px">No wrong answers yet.</em>';
    return;
  }
  list.innerHTML = wrongDetails.map(d => {
    let diagramHtml = '';
    if (typeof QUESTION_IMAGES !== 'undefined' && QUESTION_IMAGES[d.n]) {
      diagramHtml = `<div class="q-image revealed" style="display:block; margin: 12px 0;">${QUESTION_IMAGES[d.n]}</div>`;
    }
    return `<div class="wn-item">
      <div style="font-weight: 700; color: var(--text); margin-bottom: 12px; font-size: 15px; line-height: 1.5;">Q${d.n}: ${d.q}</div>
      ${diagramHtml}
      <div style="margin-top: 12px; display: flex; align-items: flex-start; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px;">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent); width:16px; height:16px; margin-top:2px; flex-shrink:0;"><path d="M9 18h6m-5 4h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>
        <div style="flex: 1;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 6px;">💡 Study Explanation</div>
          <div style="color: #b0c4de; font-size: 13.5px; line-height: 1.6;">${d.exp}</div>
        </div>
      </div>
     </div>`;
  }).join('');
}

function toggleNotes() {
  const panel = document.getElementById('wrong-notes');
  const isVisible = panel.classList.toggle('visible');
  
  const qCard = document.getElementById('q-card');
  const dotTracker = document.getElementById('dot-tracker');
  const scoreScreen = document.getElementById('score-screen');
  const impNotes = document.getElementById('important-notes');
  const modeBtns = document.querySelectorAll('.mode-btn');
  
  let notesBtn;
  modeBtns.forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes('toggleNotes') && !btn.getAttribute('onclick').includes('toggleImportantNotes')) {
      notesBtn = btn;
    }
  });

  if (isVisible) {
    // Hide important notes too
    if (impNotes) impNotes.classList.remove('visible');
    
    // Hide everything else so we only see Wrong Notes
    panel.dataset.prevQCardDisplay = qCard.style.display || 'block';
    panel.dataset.prevTrackerDisplay = dotTracker.style.display || 'flex';
    panel.dataset.prevScoreDisplay = scoreScreen.style.display || 'none';
    
    qCard.style.display = 'none';
    dotTracker.style.display = 'none';
    scoreScreen.style.display = 'none';
    
    if (notesBtn) notesBtn.classList.add('active');
    
    // De-activate important notes button if it was active
    modeBtns.forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').includes('toggleImportantNotes')) {
        b.classList.remove('active');
      }
    });
  } else {
    // Restore the quiz/score view
    qCard.style.display = panel.dataset.prevQCardDisplay || 'block';
    dotTracker.style.display = panel.dataset.prevTrackerDisplay || 'flex';
    scoreScreen.style.display = panel.dataset.prevScoreDisplay || 'none';
    
    if (notesBtn) notesBtn.classList.remove('active');
    
    // Restore active states of normal mode buttons
    document.querySelectorAll('.mode-btn').forEach(b => {
      if (b.getAttribute('onclick') && (b.getAttribute('onclick').includes('toggleNotes') || b.getAttribute('onclick').includes('toggleImportantNotes'))) {
        b.classList.remove('active');
      } else {
        const isCurrentMode = b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${mode}'`);
        b.classList.toggle('active', !!isCurrentMode);
      }
    });
  }
}

function toggleImportantNotes() {
  const panel = document.getElementById('important-notes');
  const isVisible = panel.classList.toggle('visible');
  
  const qCard = document.getElementById('q-card');
  const dotTracker = document.getElementById('dot-tracker');
  const scoreScreen = document.getElementById('score-screen');
  const wrongNotes = document.getElementById('wrong-notes');
  const modeBtns = document.querySelectorAll('.mode-btn');
  
  let notesBtn;
  modeBtns.forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes('toggleImportantNotes')) {
      notesBtn = btn;
    }
  });

  if (isVisible) {
    // Hide wrong notes too
    if (wrongNotes) wrongNotes.classList.remove('visible');
    
    // Hide everything else so we only see Important Notes
    panel.dataset.prevQCardDisplay = qCard.style.display || 'block';
    panel.dataset.prevTrackerDisplay = dotTracker.style.display || 'flex';
    panel.dataset.prevScoreDisplay = scoreScreen.style.display || 'none';
    
    qCard.style.display = 'none';
    dotTracker.style.display = 'none';
    scoreScreen.style.display = 'none';
    
    if (notesBtn) notesBtn.classList.add('active');
    
    // De-activate wrong notes button if it was active
    modeBtns.forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').includes('toggleNotes') && !b.getAttribute('onclick').includes('toggleImportantNotes')) {
        b.classList.remove('active');
      }
    });
  } else {
    // Restore the quiz/score view
    qCard.style.display = panel.dataset.prevQCardDisplay || 'block';
    dotTracker.style.display = panel.dataset.prevTrackerDisplay || 'flex';
    scoreScreen.style.display = panel.dataset.prevScoreDisplay || 'none';
    
    if (notesBtn) notesBtn.classList.remove('active');
    
    // Restore active states of normal mode buttons
    document.querySelectorAll('.mode-btn').forEach(b => {
      if (b.getAttribute('onclick') && (b.getAttribute('onclick').includes('toggleImportantNotes') || b.getAttribute('onclick').includes('toggleNotes'))) {
        b.classList.remove('active');
      } else {
        const isCurrentMode = b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${mode}'`);
        b.classList.toggle('active', !!isCurrentMode);
      }
    });
  }
}

function nextQuestion() {
  if (current + 1 >= queue.length) {
    showScore();
    return;
  }
  current++;
  selected = [];
  answered = false;
  showedAnswer = false;
  renderQuestion();
}

function showScore() {
  document.getElementById('q-card').style.display = 'none';
  const ss = document.getElementById('score-screen');
  ss.style.display = 'block';
  const total = queue.length;
  const pct = Math.round((totalCorrect / total) * 100);
  const pass = pct >= 70;
  const circle = document.getElementById('score-circle');
  circle.className = `score-circle ${pass ? 'pass' : 'fail'}`;
  document.getElementById('score-pct').textContent = `${pct}%`;
  document.getElementById('score-verdict').textContent = pass ? '✓ PASSED!' : '✕ Not quite — keep studying!';
  document.getElementById('sc-correct').textContent = totalCorrect;
  document.getElementById('sc-wrong').textContent = totalWrong;
  document.getElementById('sc-total').textContent = total;
  
  if (typeof stopTimer === 'function') stopTimer();
  
  const scoreTimeEl = document.getElementById('score-time');
  if (scoreTimeEl) {
    if (mode === 'exam') {
      const h = Math.floor(examTimeElapsed / 3600);
      const m = Math.floor((examTimeElapsed % 3600) / 60);
      const s = examTimeElapsed % 60;
      const text = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      scoreTimeEl.innerHTML = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:-3px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Time Taken: <strong style="font-variant-numeric: tabular-nums;">${text}</strong>`;
      scoreTimeEl.style.display = 'block';
    } else {
      scoreTimeEl.style.display = 'none';
    }
  }
}

function arrEq(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v,i) => v === b[i]);
}

function updateHeader() {
  document.getElementById('hdr-q').textContent = `${current+1}`;
  document.getElementById('hdr-correct').textContent = totalCorrect;
  document.getElementById('hdr-wrong').textContent = totalWrong;
}

// ─── INIT ───
setMode('all');
