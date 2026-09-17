/* ==========================================================================
   TIMED EXAM PREPARATION MODE CONTROLLER (FlashLearn Enterprise)
   Handles real-time countdown testing, dynamic MCQ distractors,
   navigator palette, Mistake Book sync, badge unlocking, and diagnostics.
   ========================================================================== */

let selectedExamTopics = ['all'];
let availableExamTopicsList = [];

// Initialize or Render Exam Prep Portal
async function renderStudentExamPrep() {
  await loadExamTopics();
  await loadExamHistory();
}

// 1. Load Available Exam Topics
async function loadExamTopics() {
  const container = document.getElementById('exam-topics-container');
  if (!container) return;

  try {
    const res = await fetch('/api/exam/topics');
    const json = await res.json();

    if (json.success && json.data) {
      availableExamTopicsList = json.data.topics || [];
      renderExamTopicPills();
    }
  } catch (err) {
    console.error('Failed to load exam topics:', err);
  }
}

function renderExamTopicPills() {
  const container = document.getElementById('exam-topics-container');
  if (!container) return;

  container.innerHTML = availableExamTopicsList.map(t => {
    const isAll = t.isAll || t.id === 'all';
    const isSelected = selectedExamTopics.includes(t.id);
    const activeClass = isSelected ? 'active' : '';
    const checkIcon = isSelected ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-regular fa-circle"></i>';
    const countBadge = t.cardCount ? `<span class="topic-count-pill">${t.cardCount} cards</span>` : '';

    return `
      <button type="button" class="exam-topic-pill ${activeClass}" id="topic-pill-${t.id}" onclick="toggleExamTopic('${t.id}')">
        ${checkIcon}
        <span>${t.name}</span>
        ${countBadge}
      </button>
    `;
  }).join('');
}

function toggleExamTopic(topicId) {
  if (topicId === 'all') {
    selectedExamTopics = ['all'];
  } else {
    // If 'all' was selected, remove it
    selectedExamTopics = selectedExamTopics.filter(id => id !== 'all');
    if (selectedExamTopics.includes(topicId)) {
      selectedExamTopics = selectedExamTopics.filter(id => id !== topicId);
    } else {
      selectedExamTopics.push(topicId);
    }

    // If no topics left, default back to 'all'
    if (selectedExamTopics.length === 0) {
      selectedExamTopics = ['all'];
    }
  }

  renderExamTopicPills();
}

function toggleSelectAllExamTopics() {
  selectedExamTopics = ['all'];
  renderExamTopicPills();
  showToast('Selected all curriculum topics for comprehensive exam preparation.', 'info');
}

// 2. Load Past Exam History
async function loadExamHistory() {
  const tbody = document.getElementById('exam-history-tbody');
  const emptyView = document.getElementById('exam-history-empty');
  if (!tbody) return;

  try {
    const res = await fetch('/api/exam/history');
    const json = await res.json();

    if (json.success && json.history && json.history.length > 0) {
      if (emptyView) emptyView.style.display = 'none';
      tbody.style.display = '';

      tbody.innerHTML = json.history.map(exam => {
        const accuracy = exam.accuracy || 0;
        let badgeColor = '#ef4444';
        let badgeBg = 'rgba(239, 68, 68, 0.12)';
        let badgeBorder = 'rgba(239, 68, 68, 0.3)';

        if (accuracy >= 80) {
          badgeColor = 'var(--color-emerald)';
          badgeBg = 'rgba(16, 185, 129, 0.12)';
          badgeBorder = 'rgba(16, 185, 129, 0.3)';
        } else if (accuracy >= 60) {
          badgeColor = 'var(--color-blue-bright)';
          badgeBg = 'rgba(37, 99, 235, 0.12)';
          badgeBorder = 'rgba(37, 99, 235, 0.3)';
        }

        const awardPill = exam.badgeUnlocked 
          ? `<span class="exam-award-pill" title="Exam Ready Achievement Badge Unlocked!"><i class="fa-solid fa-graduation-cap"></i> Exam Ready</span>` 
          : '';

        return `
          <tr>
            <td>
              <strong style="color: var(--text-main); font-weight: 700; font-size: 0.95rem;">${exam.examTitle}</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${exam.difficulty}</div>
            </td>
            <td>
              <span class="card-badge" style="background: rgba(37, 99, 235, 0.08); color: var(--color-blue-bright);">${exam.subject}</span>
            </td>
            <td>
              <strong style="font-size: 0.95rem; color: var(--text-main);">${exam.score}</strong>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="card-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-weight: 800;">
                  ${accuracy}%
                </span>
                ${awardPill}
              </div>
            </td>
            <td>
              <span style="font-family: var(--font-mono); font-size: 0.88rem; color: var(--text-muted);">${exam.timeUsed}</span>
            </td>
            <td>
              <span style="font-size: 0.85rem; color: var(--text-muted);">${exam.dateCompleted}</span>
            </td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="viewExamDiagnostic('${exam.id}')" title="View Diagnostic Breakdown">
                <i class="fa-solid fa-chart-simple"></i> Diagnostic
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = '';
      tbody.style.display = 'none';
      if (emptyView) emptyView.style.display = 'flex';
    }
  } catch (err) {
    console.error('Failed to load exam history:', err);
  }
}

// 3. Start Timed Exam Session
async function startTimedExamSession() {
  const btn = document.getElementById('btn-start-timed-exam');
  const countSelect = document.getElementById('exam-question-count');
  const durationSelect = document.getElementById('exam-timer-duration');
  const diffSelect = document.getElementById('exam-difficulty');

  const questionCount = countSelect ? parseInt(countSelect.value, 10) : 10;
  const timerMinutes = durationSelect ? parseInt(durationSelect.value, 10) : 5;
  const difficulty = diffSelect ? diffSelect.value : 'Standard Academic Curriculum';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparing Exam Session...`;
  }

  try {
    const res = await fetch('/api/exam/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: selectedExamTopics,
        question_count: questionCount,
        timer_minutes: timerMinutes,
        difficulty: difficulty
      })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to start exam session.', 'error');
      return;
    }

    // Launch Exam Arena
    examRunner.start(json.data);
  } catch (err) {
    console.error('Exam initialization error:', err);
    showToast('Failed to connect to exam server.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-play"></i> Start Timed Exam`;
    }
  }
}

// 4. Interactive Exam Arena Controller
const examRunner = {
  session: null,
  currentIndex: 0,
  answers: {},     // card_id -> selected_option
  flagged: new Set(),
  secondsRemaining: 0,
  timerInterval: null,
  isSubmitting: false,

  start(sessionData) {
    this.session = sessionData;
    this.currentIndex = 0;
    this.answers = {};
    this.flagged = new Set();
    this.secondsRemaining = sessionData.timer_duration_seconds || 300;
    this.isSubmitting = false;

    // Set Header Info
    const titleEl = document.getElementById('exam-arena-title');
    const badgeEl = document.getElementById('exam-arena-badge');
    if (titleEl) titleEl.textContent = sessionData.exam_title || 'Timed Examination';
    if (badgeEl) badgeEl.textContent = sessionData.difficulty || 'Academic Curriculum';

    // Open Modal
    openModal('modal-timed-exam');

    // Start Timer
    this.renderTimerDisplay();
    this.startTimer();

    // Render First Question
    this.renderQuestion(0);
  },

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.secondsRemaining--;
      this.renderTimerDisplay();

      if (this.secondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.autoSubmitTimeout();
      }
    }, 1000);
  },

  renderTimerDisplay() {
    const displayEl = document.getElementById('exam-timer-display');
    const containerEl = document.getElementById('exam-countdown-container');
    if (!displayEl) return;

    const mins = Math.floor(Math.max(0, this.secondsRemaining) / 60);
    const secs = Math.max(0, this.secondsRemaining) % 60;
    displayEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (containerEl) {
      containerEl.classList.remove('timer-warning', 'timer-danger');
      if (this.secondsRemaining <= 60) {
        containerEl.classList.add('timer-danger');
      } else if (this.secondsRemaining <= 120) {
        containerEl.classList.add('timer-warning');
      }
    }
  },

  renderQuestion(index) {
    if (!this.session || !this.session.questions || this.session.questions.length === 0) return;
    this.currentIndex = Math.max(0, Math.min(index, this.session.questions.length - 1));

    const q = this.session.questions[this.currentIndex];
    const totalQ = this.session.questions.length;

    // Update Counters & Progress Bar
    const indicator = document.getElementById('exam-question-indicator');
    const answeredCount = Object.keys(this.answers).length;
    const answeredIndicator = document.getElementById('exam-answered-indicator');
    const progressFill = document.getElementById('exam-progress-bar-fill');

    if (indicator) indicator.textContent = `Question ${this.currentIndex + 1} of ${totalQ}`;
    if (answeredIndicator) answeredIndicator.textContent = `${answeredCount} Answered • ${totalQ - answeredCount} Remaining`;
    if (progressFill) {
      const pct = Math.round(((this.currentIndex + 1) / totalQ) * 100);
      progressFill.style.width = `${pct}%`;
    }

    // Update Question Card
    const numTag = document.getElementById('exam-q-num-tag');
    const topicTag = document.getElementById('exam-q-topic-tag');
    const qText = document.getElementById('exam-q-text');

    if (numTag) numTag.textContent = `Question ${this.currentIndex + 1}`;
    if (topicTag) topicTag.textContent = q.subject || 'Curriculum';
    if (qText) qText.textContent = q.question;

    // Render Options List
    const optionsContainer = document.getElementById('exam-options-container');
    const currentSelected = this.answers[q.card_id];
    const letters = ['A', 'B', 'C', 'D'];

    if (optionsContainer) {
      optionsContainer.innerHTML = (q.options || []).map((opt, idx) => {
        const letter = letters[idx] || `${idx + 1}`;
        const isChosen = currentSelected === opt;
        const chosenClass = isChosen ? 'selected' : '';

        return `
          <div class="exam-option-card ${chosenClass}" onclick="examRunner.selectOption('${q.card_id}', '${escapeAttr(opt)}')">
            <span class="exam-option-letter">${letter}</span>
            <div class="exam-option-text">${escapeHTML(opt)}</div>
            <div class="exam-option-radio">
              ${isChosen ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-regular fa-circle"></i>'}
            </div>
          </div>
        `;
      }).join('');
    }

    // Update Flag Button
    const isFlagged = this.flagged.has(q.card_id);
    const flagIcon = document.getElementById('flag-btn-icon');
    const flagLabel = document.getElementById('flag-btn-label');
    if (flagIcon && flagLabel) {
      if (isFlagged) {
        flagIcon.className = 'fa-solid fa-flag';
        flagIcon.style.color = '#f59e0b';
        flagLabel.textContent = 'Flagged';
      } else {
        flagIcon.className = 'fa-regular fa-flag';
        flagIcon.style.color = '';
        flagLabel.textContent = 'Flag for Review';
      }
    }

    // Update Navigation Buttons
    const prevBtn = document.getElementById('btn-exam-prev');
    const nextBtn = document.getElementById('btn-exam-next');
    if (prevBtn) prevBtn.disabled = (this.currentIndex === 0);
    if (nextBtn) {
      if (this.currentIndex === totalQ - 1) {
        nextBtn.innerHTML = `<span>Review All</span> <i class="fa-solid fa-list-check"></i>`;
      } else {
        nextBtn.innerHTML = `<span>Next</span> <i class="fa-solid fa-arrow-right"></i>`;
      }
    }

    // Render Navigator Palette Grid
    this.renderPalette();
  },

  renderPalette() {
    const grid = document.getElementById('exam-palette-grid');
    if (!grid || !this.session) return;

    grid.innerHTML = this.session.questions.map((q, idx) => {
      const isCurrent = idx === this.currentIndex;
      const isAnswered = Boolean(this.answers[q.card_id]);
      const isFlagged = this.flagged.has(q.card_id);

      let classes = ['palette-bubble'];
      if (isCurrent) classes.push('current');
      if (isAnswered) classes.push('answered');
      if (isFlagged) classes.push('flagged');

      return `
        <button type="button" class="${classes.join(' ')}" onclick="examRunner.jumpToQuestion(${idx})" title="Question ${idx + 1}">
          ${idx + 1}
          ${isFlagged ? '<span class="palette-flag-dot"></span>' : ''}
        </button>
      `;
    }).join('');
  },

  selectOption(cardId, optionText) {
    this.answers[cardId] = optionText;
    this.renderQuestion(this.currentIndex);
  },

  toggleFlagCurrent() {
    const q = this.session.questions[this.currentIndex];
    if (this.flagged.has(q.card_id)) {
      this.flagged.delete(q.card_id);
    } else {
      this.flagged.add(q.card_id);
    }
    this.renderQuestion(this.currentIndex);
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.renderQuestion(this.currentIndex - 1);
    }
  },

  nextQuestion() {
    if (this.currentIndex < this.session.questions.length - 1) {
      this.renderQuestion(this.currentIndex + 1);
    } else {
      // At the end, confirm submission
      confirmEarlySubmitExam();
    }
  },

  jumpToQuestion(index) {
    this.renderQuestion(index);
  },

  autoSubmitTimeout() {
    showToast('Examination time limit reached! Auto-submitting responses...', 'warning');
    this.submit(true);
  },

  async submit(isTimeout = false) {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    if (this.timerInterval) clearInterval(this.timerInterval);

    const totalAllocated = this.session.timer_duration_seconds || 300;
    const timeUsed = isTimeout ? totalAllocated : Math.max(1, totalAllocated - this.secondsRemaining);

    // Build Submission Payload
    const answersPayload = this.session.questions.map(q => ({
      card_id: q.card_id,
      question: q.question,
      selected_option: this.answers[q.card_id] || ''
    }));

    try {
      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_title: this.session.exam_title,
          subject: this.session.subject,
          difficulty: this.session.difficulty,
          timer_duration_seconds: totalAllocated,
          time_used_seconds: timeUsed,
          answers: answersPayload
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Failed to submit exam.', 'error');
        this.isSubmitting = false;
        return;
      }

      closeModal('modal-timed-exam');
      showExamDiagnosticResults(json.data);

      // Refresh Mistake Book nav badge and Past History Table
      if (json.data.unresolved_mistakes_count !== undefined) {
        const mistakeNavBadge = document.getElementById('nav-mistakes-badge');
        if (mistakeNavBadge) {
          mistakeNavBadge.textContent = json.data.unresolved_mistakes_count;
          mistakeNavBadge.style.display = json.data.unresolved_mistakes_count > 0 ? 'inline-block' : 'none';
        }
      }

      await loadExamHistory();
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Error submitting exam answers.', 'error');
      this.isSubmitting = false;
    }
  }
};

// 5. Early Submit Confirmation
function confirmEarlySubmitExam() {
  if (!examRunner.session) return;
  const total = examRunner.session.questions.length;
  const answered = Object.keys(examRunner.answers).length;
  const unanswered = total - answered;

  let msg = 'Are you sure you want to finish and submit your examination?';
  if (unanswered > 0) {
    msg = `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''} out of ${total}.\n\nAre you sure you want to submit now?`;
  }

  if (confirm(msg)) {
    examRunner.submit(false);
  }
}

// 6. Display Instant Diagnostic Analytics Modal
function showExamDiagnosticResults(data) {
  const container = document.getElementById('exam-results-body');
  if (!container) return;

  const score = data.score || 0;
  const total = data.total_questions || 1;
  const accuracy = data.accuracy || 0;
  const timeUsedSec = data.time_used_seconds || 0;
  const mins = Math.floor(timeUsedSec / 60);
  const secs = timeUsedSec % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const totalSec = data.time_allocated_seconds || 300;
  const totalMins = Math.floor(totalSec / 60);
  const totalSecs = totalSec % 60;
  const allocatedStr = `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;

  const isPassed = accuracy >= 80;
  const badgeCardHTML = isPassed ? `
    <div class="exam-badge-unlocked-banner">
      <div class="badge-icon-huge">🎓</div>
      <div class="badge-info">
        <div class="badge-kicker">Achievement Unlocked</div>
        <h3 class="badge-title">Exam Ready Badge Awarded!</h3>
        <p class="badge-desc">You scored <strong>${accuracy}%</strong> under timed exam conditions, demonstrating mastery of curriculum concepts.</p>
      </div>
    </div>
  ` : '';

  const mistakesBannerHTML = data.mistakes_logged_count > 0 ? `
    <div class="exam-mistake-sync-banner">
      <i class="fa-solid fa-book-bookmark" style="color: #ef4444; font-size: 1.25rem;"></i>
      <div>
        <strong>Mistake Book Synced:</strong>
        <span>${data.mistakes_logged_count} missed question${data.mistakes_logged_count > 1 ? 's were' : ' was'} automatically added to your Mistake Book for targeted spaced practice.</span>
      </div>
    </div>
  ` : `
    <div class="exam-mistake-sync-banner success">
      <i class="fa-solid fa-circle-check" style="color: var(--color-emerald); font-size: 1.25rem;"></i>
      <div>
        <strong>Flawless Recall:</strong> Zero mistakes recorded! All answers match academic curriculum standards.
      </div>
    </div>
  `;

  // Question Breakdown Cards
  const breakdownHTML = (data.breakdown || []).map((item, idx) => {
    const isCorrect = item.is_correct;
    const statusIcon = isCorrect 
      ? '<span class="q-result-badge correct"><i class="fa-solid fa-check"></i> Correct</span>' 
      : '<span class="q-result-badge incorrect"><i class="fa-solid fa-xmark"></i> Incorrect</span>';

    return `
      <div class="exam-diag-question-item ${isCorrect ? 'is-correct' : 'is-incorrect'}">
        <div class="exam-diag-q-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="exam-diag-q-num">Q${idx + 1}</span>
            <span class="card-badge" style="background: rgba(37, 99, 235, 0.08); color: var(--color-blue-bright);">${escapeHTML(item.subject || 'Curriculum')}</span>
          </div>
          ${statusIcon}
        </div>

        <div class="exam-diag-q-prompt">${escapeHTML(item.question)}</div>

        <div class="exam-diag-answers-grid">
          <div class="exam-diag-ans-card user-choice ${isCorrect ? 'correct' : 'wrong'}">
            <span class="ans-card-label">Your Answer:</span>
            <div class="ans-card-text">${escapeHTML(item.selected_option || '(Skipped)')}</div>
          </div>
          ${!isCorrect ? `
            <div class="exam-diag-ans-card correct-key">
              <span class="ans-card-label">Correct Academic Key:</span>
              <div class="ans-card-text">${escapeHTML(item.correct_answer)}</div>
            </div>
          ` : ''}
        </div>

        <div class="exam-diag-explanation">
          <i class="fa-solid fa-lightbulb" style="color: #f59e0b;"></i>
          <span>${escapeHTML(item.explanation || '')}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <!-- Top Hero Metric Score Card -->
    <div class="exam-diag-hero-card">
      <div class="exam-diag-score-ring">
        <span class="ring-accuracy-val">${accuracy}%</span>
        <span class="ring-accuracy-label">Accuracy</span>
      </div>

      <div class="exam-diag-meta-stats">
        <div class="diag-stat-block">
          <span class="stat-label">Total Score</span>
          <strong class="stat-value">${score} / ${total} Questions</strong>
        </div>
        <div class="diag-stat-block">
          <span class="stat-label">Time Elapsed</span>
          <strong class="stat-value">${timeStr} <span style="font-size: 0.78rem; font-weight: 500; color: var(--text-muted);">/ ${allocatedStr}</span></strong>
        </div>
        <div class="diag-stat-block">
          <span class="stat-label">Difficulty</span>
          <strong class="stat-value">${escapeHTML(data.difficulty || 'Standard')}</strong>
        </div>
      </div>
    </div>

    ${badgeCardHTML}
    ${mistakesBannerHTML}

    <!-- Diagnostic Breakdown Title -->
    <div style="margin-top: 1.5rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">
        <i class="fa-solid fa-microscope" style="color: var(--color-blue-bright);"></i>
        Diagnostic Item Analysis
      </h3>
      <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${score} of ${total} answered accurately</span>
    </div>

    <div class="exam-diag-questions-list">
      ${breakdownHTML}
    </div>

    <!-- Actions Footer -->
    <div class="exam-diag-actions-row">
      ${data.mistakes_logged_count > 0 ? `
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-exam-results'); switchTab('student-mistakes');">
          <i class="fa-solid fa-book-open"></i>
          <span>Review in Mistake Book (${data.mistakes_logged_count})</span>
        </button>
      ` : ''}

      <button type="button" class="btn btn-secondary" onclick="closeModal('modal-exam-results');">
        Close
      </button>

      <button type="button" class="btn btn-primary" onclick="closeModal('modal-exam-results'); startTimedExamSession();">
        <i class="fa-solid fa-rotate-right"></i>
        <span>Take Another Exam</span>
      </button>
    </div>
  `;

  openModal('modal-exam-results');
}

// 7. View Past Exam Diagnostic Breakdown
async function viewExamDiagnostic(examId) {
  try {
    const res = await fetch(`/api/exam/history/${examId}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Failed to fetch exam record.', 'error');
      return;
    }
    showExamDiagnosticResults(json.data);
  } catch (err) {
    console.error('Error viewing exam details:', err);
    showToast('Failed to load past exam diagnostic.', 'error');
  }
}

// Helper sanitizers
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}
