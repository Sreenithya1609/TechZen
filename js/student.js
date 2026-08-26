/* FlashLearn Student Module Logic (Dashboard, Joined Subjects, and Decks CRUD) */

// Render Student Dashboard (My Joined Subjects Cards)
function renderStudentDashboard() {
  const container = document.getElementById('student-dashboard-subjects');
  const countEl = document.getElementById('student-stat-classes');

  const joinedIds = state.data.studentJoinedClassrooms || [];
  const classrooms = (state.data.classrooms || []).filter(c => joinedIds.includes(c.id));

  if (countEl) countEl.textContent = classrooms.length;

  const currentUserId = state.data.currentUser ? state.data.currentUser.id : null;

  // Calculate completed decks and overall accuracy dynamically from SQLite state
  const totalCompleted = classrooms.reduce((sum, cls) => {
    const info = cls.enrolledStudents ? cls.enrolledStudents.find(s => s.id === currentUserId) : null;
    return sum + (info ? info.completedDecks : 0);
  }, 0);

  const totalMark = classrooms.reduce((sum, cls) => {
    const info = cls.enrolledStudents ? cls.enrolledStudents.find(s => s.id === currentUserId) : null;
    return sum + (info ? info.mark : 85);
  }, 0);
  const avgAccuracy = classrooms.length > 0 ? Math.round(totalMark / classrooms.length) : 0;

  const streakVal = state.data.dailyStreak ? state.data.dailyStreak.count : 0;

  const completedDecksEl = document.getElementById('student-stat-completed-decks');
  const accuracyEl = document.getElementById('student-stat-accuracy');
  const streakEl = document.getElementById('student-stat-streak');

  if (completedDecksEl) completedDecksEl.textContent = `${totalCompleted} Decks`;
  if (accuracyEl) accuracyEl.textContent = `${avgAccuracy}%`;
  if (streakEl) streakEl.textContent = `${streakVal} Days`;

  if (!container) return;

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted); background: #ffffff; border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Joined Subjects Yet</h3>
        <p style="margin-bottom: 1.25rem;">Join a classroom using an access code from your teacher.</p>
        <button class="btn btn-primary" onclick="openModal('modal-join-classroom')">Join Subject</button>
      </div>
    `;
    return;
  }

  container.innerHTML = classrooms.map(cls => {
    const currentUserId = state.data.currentUser ? state.data.currentUser.id : null;
    const studentInfo = cls.enrolledStudents ? cls.enrolledStudents.find(s => s.id === currentUserId) : null;
    const masteryVal = studentInfo ? studentInfo.mark : 85;

    return `
      <div class="card" style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <span class="card-badge">${cls.subject}</span>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-top: 6px;">${cls.name}</h3>
          </div>
          <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(37, 99, 235, 0.1); color: var(--color-blue-bright); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            📖
          </div>
        </div>
        
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">Instructor: <strong>${cls.teacher}</strong></p>
  
        <div style="margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Subject Mastery</span>
            <strong style="color: var(--color-blue-dark);">${masteryVal}%</strong>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${masteryVal}%;"></div>
          </div>
        </div>
  
        <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 9px;" onclick="showDecksForClassroom('${cls.id}')">
          Practice Subject Decks
        </button>
      </div>
    `;
  }).join('');
}

// Render Student Joined Classrooms
function renderStudentClassrooms() {
  const container = document.getElementById('student-classrooms-grid');
  if (!container) return;

  const joinedIds = state.data.studentJoinedClassrooms;
  const classrooms = state.data.classrooms.filter(c => joinedIds.includes(c.id));

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Classrooms Joined Yet</h3>
        <p style="margin-bottom: 1.5rem;">Enter a 6-character class code provided by your teacher to enroll in your courses.</p>
        <button class="btn btn-primary" onclick="openModal('modal-join-classroom')">Join A Classroom</button>
      </div>
    `;
    return;
  }

  container.innerHTML = classrooms.map(cls => `
    <div class="card">
      <div>
        <div class="card-header">
          <div>
            <span class="card-badge">${cls.subject}</span>
            <h3 class="card-title" style="margin-top: 6px;">${cls.name}</h3>
          </div>
        </div>
        <p class="card-desc">Instructor: ${cls.teacher}</p>
        <div style="margin: 0.5rem 0;">
          <span style="font-size: 0.85rem; color: var(--text-subtle);">Class Code: <strong>${cls.code}</strong></span>
        </div>
      </div>

      <div>
        <div class="card-meta">
          <div class="card-meta-item">
            <span>🃏 ${cls.decks ? cls.decks.length : 0} Class Decks</span>
          </div>
        </div>

        <div style="margin-top: 1rem;">
          <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="showDecksForClassroom('${cls.id}')">
            View Class Flashcards
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Join Classroom by Code
async function handleJoinClassroom(event) {
  event.preventDefault();
  const codeInput = document.getElementById('join-class-code');
  const code = codeInput.value.trim().toUpperCase();

  if (!code) {
    showToast('Please enter a classroom access code.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/classrooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to join classroom.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    renderStudentDashboard();
    renderStudentClassrooms();
    renderStudentDecks();
    closeModal('modal-join-classroom');
    showToast('Successfully joined classroom!', 'success');
    codeInput.value = '';
  } catch (e) {
    console.error(e);
    showToast('An error occurred while joining classroom.', 'error');
  }
}

// Render Student Decks
function renderStudentDecks() {
  const container = document.getElementById('student-decks-grid');
  if (!container) return;

  const decks = state.data.decks;

  if (decks.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Study Decks Available</h3>
        <p style="margin-bottom: 1.5rem;">Create a custom flashcard deck or join a classroom.</p>
        <button class="btn btn-primary" onclick="switchTab('student-create')">+ Create New Deck</button>
      </div>
    `;
    return;
  }

  const currentUserName = state.data.currentUser ? state.data.currentUser.name : '';

  container.innerHTML = decks.map(deck => {
    const isOwner = !deck.classroom_id && deck.creator === currentUserName;
    
    return `
      <div class="card">
        <div>
          <div class="card-header">
            <div>
              <span class="card-badge">${deck.subject}</span>
              <h3 class="card-title" style="margin-top: 6px;">${deck.title}</h3>
            </div>
          </div>
          <p class="card-desc">Created by: ${deck.creator || 'Instructor'}</p>
        </div>

        <div>
          <div class="card-meta">
            <div class="card-meta-item">
              <span>🃏 ${deck.cards ? deck.cards.length : 0} Flashcards</span>
            </div>
          </div>

          <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="launchStudySession('${deck.id}')">
              Start Practice
            </button>
            
            ${isOwner ? `
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px 12px;" onclick="openEditDeckModal('${deck.id}')">
                ✏️ Edit Deck
              </button>
              <button class="btn btn-danger" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px 12px;" onclick="deleteDeckDirect('${deck.id}')">
                🗑️ Delete
              </button>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteDeckDirect(deckId) {
  try {
    const res = await fetch(`/api/decks/${deckId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to delete deck.', 'error');
      return;
    }
    const backendState = await res.json();
    state.data = backendState;
    showToast('Deck deleted.', 'info');
    renderStudentDecks();
    if (typeof renderMyClassesPanel === 'function') renderMyClassesPanel();
  } catch (e) {
    console.error(e);
    showToast('An error occurred deleting deck.', 'error');
  }
}

function showDecksForClassroom(classId) {
  switchTab('student-decks');
  showToast('Showing study decks for selected classroom.', 'info');
}

/* Study Material Concept Generator */
function handleGenerateFromStudyMaterial(event) {
  event.preventDefault();
  const materialInput = document.getElementById('study-material-text');
  const titleInput = document.getElementById('study-material-title');
  const resultContainer = document.getElementById('study-material-questions-result');

  const text = materialInput.value.trim();
  const title = titleInput.value.trim() || 'Custom Study Concept';

  if (!text) {
    showToast('Please enter your study notes or concept text.', 'error');
    return;
  }

  const generatedCards = extractFlashcardsFromNotes(text);

  resultContainer.style.display = 'block';
  resultContainer.innerHTML = `
    <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid var(--border-blue); padding: 1.5rem; border-radius: var(--radius-lg); margin-top: 1.5rem; box-shadow: var(--shadow-main);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="color: var(--color-blue-dark); font-size: 1.25rem;">✨ Generated Flashcards from Study Concept:</h3>
        <span class="card-badge">${generatedCards.length} Possible Questions</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        ${generatedCards.map((c, idx) => `
          <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid var(--color-blue-dark);">
            <div style="font-weight: bold; color: var(--text-main); margin-bottom: 4px;">Q${idx + 1}: ${c.question}</div>
            <div style="color: var(--text-muted); font-size: 0.95rem;">A: ${c.answer}</div>
          </div>
        `).join('')}
      </div>

      <button class="btn btn-primary" onclick="addGeneratedCardsToDeck('${title.replace(/'/g, "\\'")}', ${JSON.stringify(generatedCards).replace(/"/g, '&quot;')})">
        Add Flashcards to My Decks 📚
      </button>
    </div>
  `;

  showToast(`Synthesized ${generatedCards.length} flashcards from study notes!`, 'success');
}

async function addGeneratedCardsToDeck(title, cards) {
  try {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject: 'Study Notes', cards })
    });
    
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to save generated deck.', 'error');
      return;
    }
    
    const backendState = await res.json();
    state.data = backendState;
    
    renderStudentDecks();
    showToast(`Saved "${title}" with ${cards.length} flashcards to your decks!`, 'success');
    switchTab('student-decks');
  } catch (e) {
    console.error(e);
    showToast('An error occurred saving deck.', 'error');
  }
}

function extractFlashcardsFromNotes(text) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const cards = [];

  sentences.forEach((sentence, idx) => {
    if (idx < 5) {
      const words = sentence.split(' ');
      const keyTerm = words.slice(0, 3).join(' ');
      cards.push({
        question: `What concept is described by: "${keyTerm}..."?`,
        answer: sentence
      });
    }
  });

  if (cards.length === 0) {
    cards.push({
      question: `What is the key principle summarized in this study concept?`,
      answer: text.slice(0, 150) + '...'
    });
  }

  return cards;
}

let manualCardCount = 1;

function addManualCardRow() {
  manualCardCount++;
  const container = document.getElementById('manual-cards-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'manual-card-row';
  row.style.cssText = 'background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-blue); margin-bottom: 1rem;';
  row.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span style="font-weight: bold; color: var(--color-blue-dark);">Card #${manualCardCount}</span>
      <button type="button" class="btn btn-danger" style="padding: 2px 8px; font-size: 0.8rem;" onclick="this.parentElement.parentElement.remove()">Remove</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <input type="text" class="input-field card-q-input" placeholder="Front: Enter question or term..." required />
      <input type="text" class="input-field card-a-input" placeholder="Back: Enter answer or definition..." required />
    </div>
  `;
  container.appendChild(row);
}

async function handleCreateManualDeck(event) {
  event.preventDefault();
  const titleInput = document.getElementById('deck-title-input');
  const subjectInput = document.getElementById('deck-subject-input');

  const title = titleInput.value.trim();
  const subject = subjectInput.value.trim();

  const qInputs = document.querySelectorAll('.card-q-input');
  const aInputs = document.querySelectorAll('.card-a-input');

  const cards = [];
  qInputs.forEach((qInput, idx) => {
    const qVal = qInput.value.trim();
    const aVal = aInputs[idx] ? aInputs[idx].value.trim() : '';
    if (qVal && aVal) {
      cards.push({ question: qVal, answer: aVal });
    }
  });

  if (!title || cards.length === 0) {
    showToast('Please provide a deck title and at least one valid Q&A card.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject: subject || 'General', cards })
    });
    
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to create deck.', 'error');
      return;
    }
    
    const backendState = await res.json();
    state.data = backendState;

    renderStudentDecks();
    showToast(`Deck "${title}" created with ${cards.length} cards!`, 'success');
    
    // Clear inputs
    titleInput.value = '';
    subjectInput.value = '';
    const container = document.getElementById('manual-cards-container');
    if (container) {
      container.innerHTML = `
        <div class="manual-card-row" style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-blue); margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="font-weight: bold; color: var(--color-blue-dark);">Card #1</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <input type="text" class="input-field card-q-input" placeholder="Front: Enter question or term..." required />
            <input type="text" class="input-field card-a-input" placeholder="Back: Enter answer or definition..." required />
          </div>
        </div>
      `;
    }
    manualCardCount = 1;
    
    switchTab('student-decks');
  } catch (e) {
    console.error(e);
    showToast('An error occurred creating deck.', 'error');
  }
}

/* Daily Streaks Game Logic */
function renderDailyStreakGame() {
  const streak = state.data.dailyStreak;
  const countEl = document.getElementById('streak-count-val');
  if (countEl) countEl.textContent = streak.count;
  if (typeof updateHeaderStreak === 'function') updateHeaderStreak();

  const cluesGrid = document.getElementById('clues-grid-container');
  if (!cluesGrid) return;

  cluesGrid.innerHTML = streak.clues.map((clue, idx) => {
    const isRevealed = idx <= streak.currentClueIndex;
    return `
      <div class="clue-box ${isRevealed ? 'active' : ''}">
        <div class="clue-number">Clue #${idx + 1} ${isRevealed ? '✓' : '(Locked)'}</div>
        <div class="${isRevealed ? 'clue-text' : 'clue-placeholder'}">
          ${isRevealed ? clue : 'Click "Next Clue" to unlock this word hint.'}
        </div>
      </div>
    `;
  }).join('');

  const nextClueBtn = document.getElementById('btn-next-clue');
  if (nextClueBtn) {
    if (streak.currentClueIndex >= 3 || streak.solved) {
      nextClueBtn.disabled = true;
      nextClueBtn.style.opacity = '0.5';
    } else {
      nextClueBtn.disabled = false;
      nextClueBtn.style.opacity = '1';
    }
  }

  const guessInput = document.getElementById('streak-guess-input');
  const submitBtn = document.getElementById('streak-submit-btn');

  if (streak.solved) {
    if (guessInput) {
      guessInput.value = streak.secretWord;
      guessInput.disabled = true;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Streak Solved Today! 🔥';
    }
  }
}

async function handleNextClue() {
  const streak = state.data.dailyStreak;
  if (streak && streak.currentClueIndex < 3 && !streak.solved) {
    try {
      const res = await fetch('/api/streak/next-clue', { method: 'POST' });
      if (res.ok) {
        const backendState = await res.json();
        state.data = backendState;
        renderDailyStreakGame();
        showToast(`Unlocked Clue #${state.data.dailyStreak.currentClueIndex + 1}!`, 'info');
      }
    } catch (e) {
      console.error(e);
    }
  }
}

async function handleStreakGuess(event) {
  event.preventDefault();
  const streak = state.data.dailyStreak;
  if (!streak || streak.solved) return;

  const guessInput = document.getElementById('streak-guess-input');
  const userGuess = guessInput.value.trim().toUpperCase();

  if (!userGuess) {
    showToast('Please enter your word guess.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/streak/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: userGuess })
    });
    
    if (res.ok) {
      const result = await res.json();
      state.data = result.state;
      renderDailyStreakGame();
      
      if (result.correct) {
        showToast(`🎉 Brilliant! "${state.data.dailyStreak.secretWord}" is correct! Daily mystery word solved!`, 'success');
      } else {
        showToast(`"${userGuess}" is not correct. Check the revealed clues and try again!`, 'error');
      }
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred submitting guess.', 'error');
  }
}
