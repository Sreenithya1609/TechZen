/* FlashLearn Enterprise Student Scholar Portal Logic */

let activeStudentDeckFilter = 'all';
let studentDeckSearchQuery = '';
let activeClassroomIdFilter = null;

// Render Student Scholar Dashboard
function renderStudentDashboard() {
  const container = document.getElementById('student-dashboard-subjects');
  const countEl = document.getElementById('student-stat-classes');

  const joinedIds = state.data.studentJoinedClassrooms || [];
  const classrooms = (state.data.classrooms || []).filter(c => joinedIds.includes(c.id));

  if (countEl) countEl.textContent = classrooms.length;

  const currentUserId = state.data.currentUser ? state.data.currentUser.id : null;
  const currentUserName = state.data.currentUser ? state.data.currentUser.name : 'Scholar';

  // Calculate aggregates dynamically
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

  // Dynamic daily goal from backend database card attempts
  const studentDecks = state.data.decks || [];
  const studiedCount = state.data.cardsStudiedToday || 0;
  const totalCardsInBackend = studentDecks.reduce((sum, d) => sum + (d.cards ? d.cards.length : 0), 0);
  const targetTotal = totalCardsInBackend > 0 ? totalCardsInBackend : 20;

  const targetPct = Math.min(100, Math.round((studiedCount / targetTotal) * 100));
  const remainingTarget = Math.max(0, targetTotal - studiedCount);
  const targetMessage = remainingTarget > 0 
    ? `${remainingTarget} more cards to complete today's retention objective.`
    : `Daily target completed! Great work on active recall today.`;

  // Dynamic Spaced Repetition Priority Queue
  let dueQueueHTML = '';
  let dueQueueBadge = '';

  if (studentDecks.length === 0) {
    dueQueueBadge = '0 Decks Due';
    dueQueueHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
        <i class="fa-solid fa-circle-check" style="color: var(--color-emerald); font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>
        <span>All memory recall queues are fully current.</span>
      </div>
    `;
  } else {
    dueQueueBadge = `${Math.min(2, studentDecks.length)} Decks Due`;
    dueQueueHTML = studentDecks.slice(0, 2).map((deck, idx) => {
      const intervals = ['3-day recall check', '7-day memory retention'];
      const icons = ['fa-brain', 'fa-dna'];
      const colors = ['purple', 'blue'];
      
      const interval = intervals[idx % intervals.length];
      const icon = icons[idx % icons.length];
      const color = colors[idx % colors.length];

      return `
        <div class="activity-item" onclick="launchStudySession('${deck.id}')" style="cursor: pointer;">
          <div class="activity-item-left">
            <div class="activity-icon ${color}">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div>
              <strong style="font-size: 0.88rem; color: var(--text-main);">${deck.title}</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Interval: ${interval}</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 0.75rem;">
            <i class="fa-solid fa-play"></i> Practice
          </button>
        </div>
      `;
    }).join('');
  }

  // Scholar Teacher Request Status Card
  const teacherStatus = (state.data.currentUser && state.data.currentUser.teacherStatus) || 'none';
  const isStudent = !state.data.currentUser || state.data.currentUser.role === 'student';
  let teacherStatusHTML = '';

  if (isStudent) {
    if (teacherStatus === 'pending') {
      teacherStatusHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; border-radius: var(--radius-lg); flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
              <i class="fa-solid fa-hourglass-half fa-spin"></i>
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text-main); font-size: 1.02rem;">Teacher Request: Pending Approval</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">Your application for instructor privileges is submitted and awaiting administrator review.</div>
            </div>
          </div>
          <span class="card-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 700; padding: 4px 10px;">Awaiting Review</span>
        </div>
      `;
    }
  }

  // Update Mistake Book nav badge
  const unresolvedMistakesCount = state.data.unresolvedMistakesCount || 0;
  const mistakeNavBadge = document.getElementById('nav-mistakes-badge');
  if (mistakeNavBadge) {
    mistakeNavBadge.textContent = unresolvedMistakesCount;
    mistakeNavBadge.style.display = unresolvedMistakesCount > 0 ? 'inline-block' : 'none';
  }

  // Render Scholar Welcome Hero Banner
  const heroBannerContainer = document.getElementById('student-dashboard-hero-banner');
  if (heroBannerContainer) {
    heroBannerContainer.innerHTML = `
      <div class="portal-hero-banner portal-hero-scholar">
        <div>
          <div class="portal-hero-kicker">
            <i class="fa-solid fa-graduation-cap"></i>
            <span>Active Scholar Workspace</span>
          </div>
          <h2 class="portal-hero-title">Hello, ${currentUserName}!</h2>
          <p class="portal-hero-desc">You're on a <strong>${streakVal}-day consecutive study streak</strong>. Spaced repetition interval is optimized for peak memory retention.</p>
        </div>
        <div class="portal-hero-actions">
          <button class="btn btn-secondary" onclick="openModal('modal-join-classroom')" style="background: rgba(255,255,255,0.12); color: #ffffff; border-color: rgba(255,255,255,0.2);">
            <i class="fa-solid fa-key"></i> Join Course
          </button>
          <button class="btn btn-primary" onclick="switchTab('student-decks')">
            <i class="fa-solid fa-play"></i>
            <span>Practice Decks</span>
          </button>
        </div>
      </div>

      ${teacherStatusHTML}

      ${unresolvedMistakesCount > 0 ? `
        <div class="scholar-mistake-widget">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
              <i class="fa-solid fa-book-bookmark"></i>
            </div>
            <div>
              <div style="font-weight: 800; color: var(--text-main); font-size: 1.02rem;">
                Mistake Book: <strong style="color: var(--color-rose);">${unresolvedMistakesCount} Questions</strong> Require Targeted Review
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
                Targeted remediation for questions you missed during flashcard practice and exams.
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="switchTab('student-mistakes')">
              <i class="fa-solid fa-book-open"></i> Open Mistake Book
            </button>
            <button class="btn btn-primary btn-sm" onclick="startReviewMyMistakes()" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none;">
              <i class="fa-solid fa-arrow-rotate-left"></i> Review Now
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Daily Goal Progress & Spaced Repetition Queue -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;" class="teacher-analytics-grid">
        <!-- Daily Goal -->
        <div class="scholar-goal-card" style="margin-bottom: 0;">
          <div>
            <span class="card-badge" style="background: rgba(37, 99, 235, 0.1); color: var(--color-blue-bright); margin-bottom: 8px;">Daily Study Target</span>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">${studiedCount} / ${targetTotal} Flashcards Mastered</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">${targetMessage}</p>
            <div class="progress-bar-bg" style="height: 10px; width: 100%;">
              <div class="progress-bar-fill" style="width: ${targetPct}%;"></div>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 2rem; font-weight: 800; color: var(--color-blue-bright);">${targetPct}%</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Completed</div>
          </div>
        </div>

        <!-- Spaced Repetition Priority Queue -->
        <div class="activity-feed-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-clock" style="color: var(--color-purple);"></i>
              <span>Due for Spaced Review</span>
            </h3>
            <span class="card-badge">${dueQueueBadge}</span>
          </div>

          <div class="activity-feed-list" style="margin-top: 0.85rem;">
            ${dueQueueHTML}
          </div>
        </div>
      </div>
    `;
  }

  if (!container) return;

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-graduation-cap" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Joined Courses Yet</h3>
        <p style="margin-bottom: 1.5rem;">Enter the class access code provided by your instructor to begin studying.</p>
        <button class="btn btn-primary" onclick="openModal('modal-join-classroom')">
          <i class="fa-solid fa-plus"></i> Join Course
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = classrooms.map(cls => {
    const studentInfo = cls.enrolledStudents ? cls.enrolledStudents.find(s => s.id === currentUserId) : null;
    const masteryVal = studentInfo ? studentInfo.mark : 85;

    return `
      <div class="card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div>
              <span class="card-badge">${cls.subject}</span>
              <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin-top: 6px;">${cls.name}</h3>
            </div>
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(37, 99, 235, 0.1); color: var(--color-blue-bright); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
              <i class="fa-solid fa-book-open"></i>
            </div>
          </div>
          
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1rem;">Instructor: <strong>${cls.teacher}</strong></p>
    
          <div style="margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
              <span style="color: var(--text-muted);">Subject Mastery</span>
              <strong style="color: var(--color-blue-bright);">${masteryVal}%</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${masteryVal}%;"></div>
            </div>
          </div>
        </div>
  
        <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 9px;" onclick="showDecksForClassroom('${cls.id}')">
          <i class="fa-solid fa-play"></i>
          <span>Practice Subject Decks</span>
        </button>
      </div>
    `;
  }).join('');
}

// Render Student Joined Classrooms
function renderStudentClassrooms() {
  const container = document.getElementById('student-classrooms-grid');
  if (!container) return;

  const joinedIds = state.data.studentJoinedClassrooms || [];
  const classrooms = (state.data.classrooms || []).filter(c => joinedIds.includes(c.id));

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-school" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Classrooms Joined Yet</h3>
        <p style="margin-bottom: 1.5rem;">Enter the class access code provided by your instructor to view your courses.</p>
        <button class="btn btn-primary" onclick="openModal('modal-join-classroom')">
          <i class="fa-solid fa-plus"></i> Join Classroom
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = classrooms.map(cls => `
    <div class="card">
      <div>
        <div class="card-header" style="margin-bottom: 0.75rem;">
          <div>
            <span class="card-badge">${cls.subject}</span>
            <h3 class="card-title" style="margin-top: 6px;">${cls.name}</h3>
          </div>
        </div>
        <p class="card-desc">Instructor: ${cls.teacher}</p>
        <div style="margin: 0.75rem 0;">
          <span style="font-size: 0.85rem; color: var(--text-subtle);">Class Code: <strong style="font-family: var(--font-mono); color: var(--color-blue-bright);">${cls.code}</strong></span>
        </div>
      </div>

      <div>
        <div class="card-meta">
          <div class="card-meta-item">
            <i class="fa-solid fa-layer-group"></i>
            <span>${cls.decks ? cls.decks.length : 0} Class Decks</span>
          </div>
        </div>

        <div style="margin-top: 1.25rem;">
          <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="showDecksForClassroom('${cls.id}')">
            <i class="fa-solid fa-book-open"></i>
            <span>View Flashcards</span>
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
    showToast('Successfully enrolled in classroom!', 'success');
    codeInput.value = '';
  } catch (e) {
    console.error(e);
    showToast('An error occurred while joining classroom.', 'error');
  }
}

// Render Student Decks with Category Filter & Search
function renderStudentDecks(categoryFilter = activeStudentDeckFilter) {
  activeStudentDeckFilter = categoryFilter;
  const container = document.getElementById('student-decks-grid');
  if (!container) return;

  const decks = state.data.decks || [];
  const currentUserName = state.data.currentUser ? state.data.currentUser.name : '';

  let filtered = decks;
  if (categoryFilter === 'classroom') {
    filtered = decks.filter(d => d.classroom_id);
  } else if (categoryFilter === 'custom') {
    filtered = decks.filter(d => !d.classroom_id && d.creator === currentUserName);
  }

  // Apply course-specific filter if navigated via View Flashcards
  if (activeClassroomIdFilter) {
    filtered = filtered.filter(d => d.classroom_id === activeClassroomIdFilter);
  }

  if (studentDeckSearchQuery) {
    const q = studentDeckSearchQuery.toLowerCase();
    filtered = filtered.filter(d => d.title.toLowerCase().includes(q) || (d.subject && d.subject.toLowerCase().includes(q)));
  }

  // Update filter buttons active style
  document.querySelectorAll('#panel-student-decks .landing-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const currentFilterBtn = document.getElementById(`filter-student-${categoryFilter}`);
  if (currentFilterBtn) currentFilterBtn.classList.add('active');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-layer-group" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Study Decks Found</h3>
        <p style="margin-bottom: 1.5rem;">Synthesize a new deck with AI or join a classroom course.</p>
        <button class="btn btn-primary" onclick="switchTab('student-create')">
          <i class="fa-solid fa-plus"></i> Create New Deck
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(deck => {
    const isOwner = !deck.classroom_id && deck.creator === currentUserName;
    
    return `
      <div class="card">
        <div>
          <div class="card-header" style="margin-bottom: 0.75rem;">
            <div>
              <span class="card-badge">${deck.subject}</span>
              <h3 class="card-title" style="margin-top: 6px;">${deck.title}</h3>
            </div>
          </div>
          <p class="card-desc">Author: ${deck.creator || 'Instructor'}</p>
        </div>

        <div>
          <div class="card-meta">
            <div class="card-meta-item">
              <i class="fa-solid fa-layer-group"></i>
              <span>${deck.cards ? deck.cards.length : 0} Flashcards</span>
            </div>
            <div class="card-meta-item" style="color: var(--color-emerald);">
              <i class="fa-solid fa-circle-check"></i>
              <span>Active Recall Ready</span>
            </div>
          </div>

          <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="launchStudySession('${deck.id}')">
              <i class="fa-solid fa-play"></i>
              <span>Start Active Recall Practice</span>
            </button>
            
            ${isOwner ? `
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px 12px;" onclick="openEditDeckModal('${deck.id}')">
                <i class="fa-solid fa-pen"></i> Edit Deck
              </button>
              <button class="btn btn-danger" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px 12px;" onclick="deleteDeckDirect('${deck.id}')">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleStudentDeckSearch(query) {
  studentDeckSearchQuery = query.trim();
  renderStudentDecks();
}

async function deleteDeckDirect(deckId) {
  if (!confirm('Are you sure you want to delete this flashcard deck?')) return;

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
    renderStudentDecks(activeStudentDeckFilter);
    if (typeof renderMyClassesPanel === 'function') renderMyClassesPanel();
  } catch (e) {
    console.error(e);
    showToast('An error occurred deleting deck.', 'error');
  }
}

function showDecksForClassroom(classId) {
  activeClassroomIdFilter = classId;
  activeStudentDeckFilter = 'classroom';
  switchTab('student-decks');
  showToast('Displaying course flashcard modules.', 'info');
}

/* Study Material Concept Generator */
const sampleNotesData = {
  cellular: {
    title: 'Cellular Respiration & ATP Synthesis',
    text: 'Glycolysis breaks down glucose into two pyruvate molecules in the cytoplasm, yielding 2 ATP and 2 NADH. Pyruvate enters mitochondria for the Krebs Cycle, generating NADH, FADH2, and ATP. The Electron Transport Chain uses oxidative phosphorylation to create the proton gradient powering ATP Synthase, producing roughly 32-34 ATP per glucose.'
  },
  distributed: {
    title: 'Distributed Consensus & Raft Protocol',
    text: 'Raft divides consensus into leader election, log replication, and safety. Nodes exist in Leader, Follower, or Candidate states. Heartbeat RPCs maintain authority. Raft ensures state machine replication consistency across distributed server clusters even during network partitions.'
  },
  memory: {
    title: 'Cognitive Science & Spaced Repetition',
    text: 'Hermann Ebbinghaus discovered the forgetting curve describing exponential memory decay over time without reinforcement. Active recall forces synaptic retrieval cues. Spaced interval scheduling expands the retention half-life, consolidating working memory into long-term cortical networks.'
  }
};

function loadSampleStudyNotes(key) {
  const sample = sampleNotesData[key];
  if (!sample) return;

  const titleInput = document.getElementById('study-material-title');
  const textInput = document.getElementById('study-material-text');

  if (titleInput) titleInput.value = sample.title;
  if (textInput) textInput.value = sample.text;

  showToast(`Loaded sample notes: "${sample.title}"`, 'info');
}

async function handleGenerateFromStudyMaterial(event) {
  event.preventDefault();
  const materialInput = document.getElementById('study-material-text');
  const titleInput = document.getElementById('study-material-title');
  const resultContainer = document.getElementById('study-material-questions-result');
  const generateBtn = event.submitter || document.querySelector('#panel-student-create button[type="submit"]');

  const text = materialInput.value.trim();
  const title = titleInput.value.trim() || 'Custom Study Notes';

  if (!text) {
    showToast('Please enter your study notes or concept text.', 'error');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing...';

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: text, count: 5, is_notes: true })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'AI generation failed.', 'error');
      return;
    }

    const generatedCards = data.cards || [];

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-blue); padding: 1.5rem; border-radius: var(--radius-xl); margin-top: 1.5rem; box-shadow: var(--shadow-main);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 8px;">
          <h3 style="color: var(--color-blue-bright); font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sparkles"></i>
            <span>Synthesized Concept Flashcards</span>
          </h3>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${data.fallback ? `
              <span class="card-badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 0.78rem;">
                <i class="fa-solid fa-triangle-exclamation"></i> Offline Fallback
              </span>
            ` : `
              <span class="card-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.78rem;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Powered by Gemini AI
              </span>
            `}
            <span class="card-badge" id="student-ai-card-badge">${generatedCards.length} Questions</span>
          </div>
        </div>

        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
          <i class="fa-solid fa-pencil" style="color: var(--color-blue-bright);"></i> You can edit questions, answers, delete unwanted cards, or add manual cards to this deck before saving.
        </p>

        <div id="student-ai-cards-list" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.25rem;">
          ${generatedCards.map((c, idx) => `
            <div class="student-ai-card-row" style="background: var(--bg-card-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); border-left: 3px solid var(--color-blue-bright);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <span style="font-weight: 700; color: var(--color-blue-bright); font-size: 0.9rem;">Flashcard #${idx + 1}</span>
                <button type="button" class="btn btn-danger" style="padding: 4px 10px; font-size: 0.8rem;" onclick="this.closest('.student-ai-card-row').remove(); updateStudentAIPreviewCount();">
                  <i class="fa-solid fa-trash"></i> Delete
                </button>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div>
                  <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 4px;">Question Front</label>
                  <input type="text" class="input-field student-ai-card-q" value="${c.question.replace(/"/g, '&quot;')}" placeholder="Question Front..." required />
                </div>
                <div>
                  <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 4px;">Answer Back</label>
                  <textarea class="input-field student-ai-card-a" rows="2" placeholder="Answer Back..." required>${c.answer}</textarea>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" onclick="addStudentAIPendingCardRow()">
            <i class="fa-solid fa-plus"></i> Add Flashcard to Deck
          </button>
          <button type="button" class="btn btn-primary" onclick="saveStudentAIPendingDeck()">
            <i class="fa-solid fa-floppy-disk"></i> Save to My Decks
          </button>
        </div>
      </div>
    `;

    if (data.fallback) {
      showToast(`Generated ${generatedCards.length} flashcards (offline fallback mode).`, 'info');
    } else {
      showToast(`Synthesized ${generatedCards.length} flashcards with Gemini AI!`, 'success');
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred during AI generation.', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Synthesize Flashcards</span>';
  }
}

function updateStudentAIPreviewCount() {
  const container = document.getElementById('student-ai-cards-list');
  const badge = document.getElementById('student-ai-card-badge');
  if (container && badge) {
    const count = container.querySelectorAll('.student-ai-card-row').length;
    badge.textContent = `${count} Questions`;
  }
}

function addStudentAIPendingCardRow() {
  const container = document.getElementById('student-ai-cards-list');
  if (!container) return;

  const count = container.querySelectorAll('.student-ai-card-row').length + 1;
  const row = document.createElement('div');
  row.className = 'student-ai-card-row';
  row.style.cssText = 'background: var(--bg-card-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); border-left: 3px solid var(--color-purple);';
  row.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
      <span style="font-weight: 700; color: var(--color-purple); font-size: 0.9rem;">Manual Flashcard #${count}</span>
      <button type="button" class="btn btn-danger" style="padding: 4px 10px; font-size: 0.8rem;" onclick="this.closest('.student-ai-card-row').remove(); updateStudentAIPreviewCount();">
        <i class="fa-solid fa-trash"></i> Delete
      </button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div>
        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 4px;">Question Front</label>
        <input type="text" class="input-field student-ai-card-q" placeholder="Enter question..." required />
      </div>
      <div>
        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 4px;">Answer Back</label>
        <textarea class="input-field student-ai-card-a" rows="2" placeholder="Enter answer..." required></textarea>
      </div>
    </div>
  `;
  container.appendChild(row);
  updateStudentAIPreviewCount();
}

async function saveStudentAIPendingDeck() {
  const titleInput = document.getElementById('study-material-title');
  const title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Custom Study Notes';

  const qInputs = document.querySelectorAll('#student-ai-cards-list .student-ai-card-q');
  const aInputs = document.querySelectorAll('#student-ai-cards-list .student-ai-card-a');

  const cards = [];
  qInputs.forEach((qInput, idx) => {
    const qVal = qInput.value.trim();
    const aVal = aInputs[idx] ? aInputs[idx].value.trim() : '';
    if (qVal && aVal) {
      cards.push({ question: qVal, answer: aVal });
    }
  });

  if (cards.length === 0) {
    showToast('Please provide at least one valid question & answer card in the deck.', 'error');
    return;
  }

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
    showToast(`Saved "${title}" with ${cards.length} flashcards to your library!`, 'success');
    switchTab('student-decks');
  } catch (e) {
    console.error(e);
    showToast('An error occurred saving deck.', 'error');
  }
}

let manualCardCount = 1;

function addManualCardRow() {
  manualCardCount++;
  const container = document.getElementById('manual-cards-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'manual-card-row';
  row.style.cssText = 'background: var(--bg-card-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 1rem;';
  row.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span style="font-weight: 700; color: var(--color-blue-bright); font-size: 0.9rem;">Card #${manualCardCount}</span>
      <button type="button" class="btn btn-danger" style="padding: 2px 8px; font-size: 0.8rem;" onclick="this.parentElement.parentElement.remove()">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <input type="text" class="input-field card-q-input" placeholder="Question Front..." required />
      <input type="text" class="input-field card-a-input" placeholder="Answer Back..." required />
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
    showToast('Please provide a deck title and at least one valid question & answer card.', 'error');
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
    
    titleInput.value = '';
    subjectInput.value = '';
    const container = document.getElementById('manual-cards-container');
    if (container) {
      container.innerHTML = `
        <div class="manual-card-row" style="background: var(--bg-card-subtle); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="font-weight: 700; color: var(--color-blue-bright); font-size: 0.9rem;">Card #1</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <input type="text" class="input-field card-q-input" placeholder="Question Front..." required />
            <input type="text" class="input-field card-a-input" placeholder="Answer Back..." required />
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
  if (!streak) return;

  const countEl = document.getElementById('streak-count-val');
  if (countEl) countEl.textContent = streak.count;
  if (typeof updateHeaderStreak === 'function') updateHeaderStreak();

  const cluesGrid = document.getElementById('clues-grid-container');
  if (!cluesGrid) return;

  cluesGrid.innerHTML = streak.clues.map((clue, idx) => {
    const isRevealed = idx <= streak.currentClueIndex;
    return `
      <div class="clue-box ${isRevealed ? 'active' : ''}">
        <div class="clue-number">
          <i class="fa-solid ${isRevealed ? 'fa-circle-check' : 'fa-lock'}"></i>
          <span>Clue #${idx + 1} ${isRevealed ? '(Unlocked)' : '(Locked)'}</span>
        </div>
        <div class="${isRevealed ? 'clue-text' : 'clue-placeholder'}">
          ${isRevealed ? clue : 'Unlock the next clue to reveal this concept hint.'}
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
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Solved Today!';
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
        showToast(`Brilliant! "${state.data.dailyStreak.secretWord}" is correct! Concept solved!`, 'success');
      } else {
        showToast(`"${userGuess}" is not correct. Check the clues and try again!`, 'error');
      }
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred submitting guess.', 'error');
  }
}

function renderDailyStreakChallengeModal() {
  const streak = state.data.dailyStreak;
  if (!streak) return;

  const qBox = document.getElementById('streak-question-box');
  const inputContainer = document.getElementById('streak-answer-input-container');
  const feedbackBox = document.getElementById('streak-feedback-box');
  const submitBtn = document.getElementById('btn-streak-submit');
  const solutionBtn = document.getElementById('btn-streak-view-solution');

  // Build clues rendering layout
  let cluesHTML = `<div style="display: flex; flex-direction: column; gap: 10px; width: 100%; text-align: left;">`;
  streak.clues.forEach((clue, idx) => {
    const isRevealed = idx <= streak.currentClueIndex;
    cluesHTML += `
      <div style="background: ${isRevealed ? 'var(--bg-card-subtle)' : 'rgba(0,0,0,0.02)'}; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid ${isRevealed ? 'var(--border-blue)' : 'var(--border-subtle)'}; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 0.78rem; font-weight: 800; color: ${isRevealed ? 'var(--color-blue-bright)' : 'var(--text-subtle)'}; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid ${isRevealed ? 'fa-circle-check' : 'fa-lock'}"></i>
          <span>Clue #${idx + 1} ${isRevealed ? '(Unlocked)' : '(Locked)'}</span>
        </span>
        <span style="font-size: 0.9rem; font-weight: ${isRevealed ? '700' : 'normal'}; color: ${isRevealed ? 'var(--text-main)' : 'var(--text-muted)'};">
          ${isRevealed ? clue : 'Unlock the next clue to reveal this concept hint.'}
        </span>
      </div>
    `;
  });
  cluesHTML += `</div>`;
  
  if (qBox) qBox.innerHTML = cluesHTML;

  // Render modal next clue button
  let nextClueBtn = document.getElementById('btn-streak-next-clue');
  if (!nextClueBtn) {
    const footerButtons = submitBtn.parentElement;
    nextClueBtn = document.createElement('button');
    nextClueBtn.type = 'button';
    nextClueBtn.className = 'btn btn-secondary';
    nextClueBtn.id = 'btn-streak-next-clue';
    nextClueBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Next Clue';
    nextClueBtn.onclick = handleStreakNextClueInModal;
    footerButtons.insertBefore(nextClueBtn, submitBtn);
  }

  // Update button visibility
  if (streak.currentClueIndex >= 3 || streak.solved) {
    nextClueBtn.style.display = 'none';
  } else {
    nextClueBtn.style.display = 'inline-flex';
  }

  const isAllCluesViewed = streak.currentClueIndex >= 3;
  if (inputContainer) {
    inputContainer.style.display = isAllCluesViewed && !streak.solved ? 'block' : 'none';
  }
  if (submitBtn) {
    submitBtn.style.display = isAllCluesViewed && !streak.solved ? 'inline-flex' : 'none';
  }
  if (solutionBtn) {
    solutionBtn.style.display = isAllCluesViewed && !streak.solved ? 'inline-flex' : 'none';
  }

  if (streak.solved) {
    if (feedbackBox) {
      feedbackBox.style.display = 'block';
      feedbackBox.className = 'toast toast-success';
      feedbackBox.style.background = 'rgba(5, 150, 105, 0.1)';
      feedbackBox.style.color = 'var(--color-emerald)';
      feedbackBox.textContent = `Solved! The correct answer is: "${streak.secretWord}". Streak increased!`;
    }
  }
}

async function handleStreakNextClueInModal() {
  try {
    const res = await fetch('/api/streak/next-clue', { method: 'POST' });
    if (res.ok) {
      const backendState = await res.json();
      state.data = backendState;
      renderDailyStreakChallengeModal();
      showToast(`Unlocked Clue #${state.data.dailyStreak.currentClueIndex + 1}!`, 'info');
    }
  } catch (e) {
    console.error(e);
  }
}

function openDailyStreakModal() {
  const ansInput = document.getElementById('streak-challenge-answer');
  const feedbackBox = document.getElementById('streak-feedback-box');
  
  if (ansInput) {
    ansInput.value = '';
    ansInput.disabled = false;
  }
  if (feedbackBox) {
    feedbackBox.style.display = 'none';
    feedbackBox.className = '';
    feedbackBox.textContent = '';
  }

  openModal('modal-streak-challenge');
  renderDailyStreakChallengeModal();
}

async function handleSubmitStreakAnswer() {
  const ansInput = document.getElementById('streak-challenge-answer');
  const ans = ansInput ? ansInput.value.trim() : '';
  if (!ans) {
    showToast('Please type an answer.', 'warning');
    return;
  }

  const feedbackBox = document.getElementById('streak-feedback-box');
  const submitBtn = document.getElementById('btn-streak-submit');
  const solutionBtn = document.getElementById('btn-streak-view-solution');
  const nextClueBtn = document.getElementById('btn-streak-next-clue');

  try {
    const res = await fetch('/api/streak/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: ans })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to submit guess.', 'error');
      return;
    }

    const result = await res.json();
    state.data = result.state;

    // Update streak badges
    updateHeaderStreak();
    if (typeof renderStudentDashboard === 'function') renderStudentDashboard();
    
    renderDailyStreakChallengeModal();

    if (result.correct) {
      showToast(`Correct! Concept solved!`, 'success');
    } else {
      if (feedbackBox) {
        feedbackBox.style.display = 'block';
        feedbackBox.className = 'toast toast-error';
        feedbackBox.style.background = 'rgba(244, 63, 94, 0.1)';
        feedbackBox.style.color = 'var(--color-rose)';
        feedbackBox.textContent = `Incorrect answer. The correct solution is: "${state.data.dailyStreak.secretWord}"`;
      }
      if (submitBtn) submitBtn.style.display = 'none';
      if (solutionBtn) solutionBtn.style.display = 'none';
      if (nextClueBtn) nextClueBtn.style.display = 'none';
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred submitting answer.', 'error');
  }
}

function handleViewStreakSolution() {
  const feedbackBox = document.getElementById('streak-feedback-box');
  const submitBtn = document.getElementById('btn-streak-submit');
  const solutionBtn = document.getElementById('btn-streak-view-solution');
  const nextClueBtn = document.getElementById('btn-streak-next-clue');

  if (feedbackBox) {
    feedbackBox.style.display = 'block';
    feedbackBox.className = 'toast toast-info';
    feedbackBox.style.background = 'rgba(37, 99, 235, 0.1)';
    feedbackBox.style.color = 'var(--color-blue-bright)';
    feedbackBox.textContent = `Solution: ${state.data.dailyStreak.secretWord}`;
  }
  if (submitBtn) submitBtn.style.display = 'none';
  if (solutionBtn) solutionBtn.style.display = 'none';
  if (nextClueBtn) nextClueBtn.style.display = 'none';
}

// Student Teacher Access Request Action
async function handleTeacherAccessRequest() {
  if (!confirm('Would you like to request teacher/instructor access? An administrator will review your application.')) {
    return;
  }

  try {
    const res = await fetch('/api/teacher/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to submit teacher request.', 'error');
      return;
    }

    showToast(data.message || 'Teacher request submitted successfully!', 'success');
    if (state.data.currentUser) {
      state.data.currentUser.teacherStatus = 'pending';
    }
    renderStudentDashboard();
  } catch (err) {
    console.error(err);
    showToast('Failed to submit teacher request.', 'error');
  }
}

/* ==========================================================================
   FEATURE: STUDENT MISTAKE BOOK & TARGETED REMEDIATION ENGINE
   ========================================================================== */

let activeMistakeFilter = 'needs_review';
let activeMistakeTopic = 'all';
let mistakeSearchQuery = '';
let cachedMistakes = [];
let cachedMistakeCounts = { all: 0, needs_review: 0, resolved: 0 };
let mistakeSearchTimer = null;

function safeMistakeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadMistakes() {
  const container = document.getElementById('mistakes-cards-container');
  if (container && cachedMistakes.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--color-blue-bright); margin-bottom: 12px; display: block;"></i>
        <span>Loading targeted mistake remediation questions...</span>
      </div>
    `;
  }

  try {
    const params = new URLSearchParams();
    if (activeMistakeFilter && activeMistakeFilter !== 'all') {
      params.set('status', activeMistakeFilter);
    } else if (activeMistakeFilter === 'all') {
      params.set('status', 'all');
    }
    if (activeMistakeTopic && activeMistakeTopic !== 'all') {
      params.set('topic', activeMistakeTopic);
    }
    if (mistakeSearchQuery) {
      params.set('search', mistakeSearchQuery);
    }

    const res = await fetch(`/api/mistakes?${params.toString()}`);
    if (!res.ok) {
      console.error('Failed to fetch mistakes');
      return;
    }

    const data = await res.json();
    cachedMistakes = data.mistakes || [];
    cachedMistakeCounts = data.counts || { all: 0, needs_review: 0, resolved: 0 };

    // Update global state count
    if (state.data) {
      state.data.unresolvedMistakesCount = cachedMistakeCounts.needs_review;
    }

    // Update Nav Badge
    const navBadge = document.getElementById('nav-mistakes-badge');
    if (navBadge) {
      navBadge.textContent = cachedMistakeCounts.needs_review;
      navBadge.style.display = cachedMistakeCounts.needs_review > 0 ? 'inline-block' : 'none';
    }

    // Update Review Button Header Count
    const countBadge = document.getElementById('mistakes-count-badge');
    if (countBadge) {
      countBadge.textContent = cachedMistakeCounts.needs_review;
    }

    // Update Topic Filter Dropdown
    updateMistakesTopicDropdown(data.topics || [], data.deckTitles || []);

    // Render Mistake Cards
    renderMistakesCards();
  } catch (err) {
    console.error('Error loading mistakes:', err);
    if (container) {
      container.innerHTML = `
        <div class="mistakes-empty-state">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; color: var(--color-rose); margin-bottom: 10px;"></i>
          <h3 style="margin-bottom: 6px; color: var(--text-main);">Unable to Load Mistakes</h3>
          <p style="margin-bottom: 1.25rem;">There was an error communicating with the academic database.</p>
          <button class="btn btn-secondary btn-sm" onclick="loadMistakes()">
            <i class="fa-solid fa-rotate"></i> Try Again
          </button>
        </div>
      `;
    }
  }
}

function updateMistakesTopicDropdown(topics, deckTitles) {
  const select = document.getElementById('mistakes-topic-filter');
  if (!select) return;

  const currentVal = select.value || activeMistakeTopic;
  const uniqueOptions = new Set(['all']);
  let html = `<option value="all">All Topics</option>`;

  (topics || []).forEach(t => {
    if (t && !uniqueOptions.has(t.toLowerCase())) {
      uniqueOptions.add(t.toLowerCase());
      html += `<option value="${safeMistakeHtml(t)}">${safeMistakeHtml(t)}</option>`;
    }
  });

  (deckTitles || []).forEach(d => {
    if (d && !uniqueOptions.has(d.toLowerCase())) {
      uniqueOptions.add(d.toLowerCase());
      html += `<option value="${safeMistakeHtml(d)}">${safeMistakeHtml(d)}</option>`;
    }
  });

  select.innerHTML = html;
  if (uniqueOptions.has(currentVal.toLowerCase()) || currentVal === 'all') {
    select.value = currentVal;
  } else {
    select.value = 'all';
  }
}

function renderMistakeBook() {
  // Sync tab active styles
  ['all', 'needs_review', 'resolved'].forEach(status => {
    const btn = document.getElementById(`filter-mistakes-${status}`);
    if (btn) {
      if (status === activeMistakeFilter) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  loadMistakes();
}

function filterMistakesByStatus(status) {
  activeMistakeFilter = status;
  ['all', 'needs_review', 'resolved'].forEach(s => {
    const btn = document.getElementById(`filter-mistakes-${s}`);
    if (btn) {
      if (s === status) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  loadMistakes();
}

function handleMistakeTopicFilter(topic) {
  activeMistakeTopic = topic;
  loadMistakes();
}

function handleMistakeSearch(query) {
  if (mistakeSearchTimer) clearTimeout(mistakeSearchTimer);
  mistakeSearchTimer = setTimeout(() => {
    mistakeSearchQuery = query.trim();
    loadMistakes();
  }, 200);
}

function renderMistakesCards() {
  const container = document.getElementById('mistakes-cards-container');
  if (!container) return;

  if (!cachedMistakes || cachedMistakes.length === 0) {
    let emptyTitle = "All Caught Up!";
    let emptyMsg = "No questions found in this view.";
    if (activeMistakeFilter === 'needs_review') {
      emptyTitle = "No Mistakes Need Review";
      emptyMsg = "Targeted remediation is completely clear. All flashcard questions are currently mastered!";
    } else if (activeMistakeFilter === 'resolved') {
      emptyTitle = "No Resolved Mistakes Yet";
      emptyMsg = "As you practice and master questions you previously missed, they will appear here as resolved.";
    }

    container.innerHTML = `
      <div class="mistakes-empty-state">
        <i class="fa-solid fa-circle-check mistakes-empty-icon"></i>
        <h3 style="color: var(--text-main); font-weight: 700; margin-bottom: 6px;">${emptyTitle}</h3>
        <p style="margin-bottom: 1.5rem;">${emptyMsg}</p>
        <button class="btn btn-primary" onclick="switchTab('student-decks')">
          <i class="fa-solid fa-play"></i> Practice Flashcards
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = cachedMistakes.map(m => {
    const isResolved = m.status === 'resolved';
    const missedText = `Missed ${m.missedCount} time${m.missedCount === 1 ? '' : 's'}`;

    return `
      <div class="mistake-card ${isResolved ? 'resolved' : ''}" id="mistake-item-${m.id}">
        <div class="mistake-card-top">
          <div class="mistake-badges-group">
            <span class="badge-mistake-subject">${safeMistakeHtml(m.subject)}</span>
            <span class="mistake-deck-text">DECK: ${safeMistakeHtml(m.deckTitle)}</span>
            <span class="badge-mistake-status ${isResolved ? 'resolved' : 'needs-review'}">
              ${isResolved ? '<i class="fa-solid fa-circle-check"></i> RESOLVED' : '<i class="fa-solid fa-arrow-rotate-left"></i> NEEDS REVIEW ⚠️'}
            </span>
            <span class="mistake-missed-count">${missedText}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            ${isResolved ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleMistakeStatus('${m.id}', 'needs_review')" title="Re-open for review" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 999px;">
                <i class="fa-solid fa-rotate-left"></i> Re-open
              </button>
            ` : `
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleMistakeStatus('${m.id}', 'resolved')" title="Mark as resolved" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 999px; color: var(--color-emerald);">
                <i class="fa-solid fa-check"></i> Resolve
              </button>
            `}
          </div>
        </div>

        <div class="mistake-question-text">
          ${safeMistakeHtml(m.question)}
        </div>

        <div class="mistake-card-body-row">
          <div class="mistake-answer-box">
            <div class="mistake-answer-label">CORRECT ANSWER</div>
            <p class="mistake-answer-text">${safeMistakeHtml(m.answer)}</p>
          </div>

          <button type="button" class="btn-try-again" onclick="openMistakeRemediationModal('${m.id}')" title="Test yourself on this concept">
            <i class="fa-solid fa-arrow-rotate-right"></i>
            <span>Try Again</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleMistakeStatus(mistakeId, newStatus) {
  try {
    const res = await fetch('/api/mistakes/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mistake_id: mistakeId, status: newStatus })
    });

    if (!res.ok) {
      showToast('Failed to update mistake status.', 'error');
      return;
    }

    if (newStatus === 'resolved') {
      showToast('Question resolved! Great recall remediation.', 'success');
    } else {
      showToast('Question reopened for targeted review.', 'info');
    }

    loadMistakes();
  } catch (err) {
    console.error(err);
    showToast('An error occurred updating mistake status.', 'error');
  }
}

function openMistakeRemediationModal(mistakeId) {
  const mistake = cachedMistakes.find(m => m.id === mistakeId);
  if (!mistake) return;

  const bodyEl = document.getElementById('modal-mistake-remediate-body');
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge-mistake-subject">${safeMistakeHtml(mistake.subject)}</span>
          <span class="mistake-deck-text">DECK: ${safeMistakeHtml(mistake.deckTitle)}</span>
        </div>
        <span class="mistake-missed-count">Missed ${mistake.missedCount} time${mistake.missedCount === 1 ? '' : 's'}</span>
      </div>

      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
        <span style="font-size: 0.78rem; font-weight: 800; color: var(--color-blue-bright); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Targeted Question Prompt</span>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1.5;">${safeMistakeHtml(mistake.question)}</h3>
      </div>

      <div>
        <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 6px;">
          Active Retrieval Self-Check (Type your recall answer)
        </label>
        <textarea id="remediate-test-input" class="input-field" rows="3" placeholder="Type your answer from memory..." style="width: 100%;"></textarea>
      </div>

      <div style="display: flex; justify-content: center;">
        <button type="button" class="btn btn-secondary" id="btn-reveal-remediate-answer" onclick="revealRemediationAnswer()" style="padding: 8px 20px;">
          <i class="fa-solid fa-eye"></i>
          <span>Reveal Correct Answer</span>
        </button>
      </div>

      <div id="remediate-revealed-answer-box" style="display: none; background: rgba(16, 185, 129, 0.07); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 1.1rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Verified Correct Answer</div>
        <div style="font-size: 0.95rem; color: #15803d; font-weight: 600; line-height: 1.5;">${safeMistakeHtml(mistake.answer)}</div>
        
        <div style="margin-top: 1.25rem; border-top: 1px solid rgba(16, 185, 129, 0.2); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Self-Assessment Result:</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('modal-mistake-remediate'); showToast('Keep practicing! Saved in Needs Review.', 'info');">
              <i class="fa-solid fa-clock-rotate-left"></i> Still Practicing
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="toggleMistakeStatus('${mistake.id}', 'resolved'); closeModal('modal-mistake-remediate');" style="background: var(--color-emerald); border-color: var(--color-emerald);">
              <i class="fa-solid fa-circle-check"></i> I Got It Right (Resolve)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  openModal('modal-mistake-remediate');
}

function revealRemediationAnswer() {
  const ansBox = document.getElementById('remediate-revealed-answer-box');
  const revealBtn = document.getElementById('btn-reveal-remediate-answer');
  if (ansBox) ansBox.style.display = 'block';
  if (revealBtn) revealBtn.style.display = 'none';
}

async function startReviewMyMistakes() {
  try {
    const res = await fetch('/api/mistakes/review-deck');
    if (!res.ok) {
      showToast('Failed to prepare mistakes review session.', 'error');
      return;
    }

    const data = await res.json();
    const deck = data.deck;

    if (!deck || !deck.cards || deck.cards.length === 0) {
      showToast('You have 0 mistakes needing review! All active recall concepts are currently mastered.', 'success');
      return;
    }

    showToast(`Launching targeted remediation session with ${deck.cards.length} questions.`, 'info');

    // Register synthetic deck into state temporarily if not present
    if (!state.data.decks) state.data.decks = [];
    const existingIdx = state.data.decks.findIndex(d => d.id === deck.id);
    if (existingIdx >= 0) {
      state.data.decks[existingIdx] = deck;
    } else {
      state.data.decks.push(deck);
    }

    // Launch StudyEngine session with this deck
    if (typeof studyEngine !== 'undefined' && studyEngine.startSession) {
      studyEngine.startSession(deck.id);
    } else if (typeof launchStudySession === 'function') {
      launchStudySession(deck.id);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to start remediation study session.', 'error');
  }
}

