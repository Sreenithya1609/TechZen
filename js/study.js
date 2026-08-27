/* FlashLearn Enterprise Study Engine (3D Flashcard Flip Session with Keyboard Shortcuts & Zero Emojis) */

class StudyEngine {
  constructor() {
    this.activeDeck = null;
    this.cardsQueue = [];
    this.currentIndex = 0;
    this.knowCount = 0;
    this.reviewCount = 0;
    this.isFlipped = false;
    this.keyboardListenerAttached = false;
  }

  startSession(deckId) {
    let deck = state.data.decks.find(d => d.id === deckId);
    
    // Fallback search by title or create simulated deck if needed
    if (!deck) {
      deck = {
        id: deckId || 'deck-demo',
        title: 'Academic Flashcard Deck',
        subject: 'General',
        cards: [
          { question: 'What is Active Recall in learning psychology?', answer: 'The practice of testing memory retention by stimulating mind retrieval during learning.' },
          { question: 'How does Spaced Repetition enhance long-term memory?', answer: 'By reviewing study material at increasing time intervals to interrupt forgetting curves.' },
          { question: 'What are the benefits of flashcard-based self-testing?', answer: 'Immediate feedback, active engagement, and targeted mastery of weak topics.' }
        ]
      };
    }

    if (!deck.cards || deck.cards.length === 0) {
      showToast('This deck has no flashcards to practice.', 'error');
      return;
    }

    this.activeDeck = deck;
    this.cardsQueue = [...deck.cards];
    this.currentIndex = 0;
    this.knowCount = 0;
    this.reviewCount = 0;
    this.isFlipped = false;

    // Set modal title
    const titleEl = document.getElementById('study-modal-deck-title');
    if (titleEl) titleEl.textContent = deck.title;

    // Attach global keyboard listeners once
    this.initKeyboardControls();

    // Render first card & UI
    this.renderCurrentCard();
    openModal('modal-study-session');
  }

  initKeyboardControls() {
    if (this.keyboardListenerAttached) return;
    this.keyboardListenerAttached = true;

    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('modal-study-session');
      if (!modal || !modal.classList.contains('active')) return;

      // Disable shortcuts when typing into inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.flipCard();
      } else if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.markCard('review');
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.markCard('know');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.shuffleCards();
      }
    });
  }

  renderCurrentCard() {
    if (this.currentIndex >= this.cardsQueue.length) {
      this.renderSummary();
      return;
    }

    const card = this.cardsQueue[this.currentIndex];
    const total = this.cardsQueue.length;
    const currentNum = this.currentIndex + 1;
    const progressPct = Math.round(((currentNum - 1) / total) * 100);

    // Update Progress UI
    const progressFill = document.getElementById('study-progress-fill');
    const remainingText = document.getElementById('study-cards-remaining');
    const countBadge = document.getElementById('study-card-counter');

    if (progressFill) progressFill.style.width = `${progressPct}%`;
    if (remainingText) remainingText.textContent = `${total - currentNum + 1} cards remaining`;
    if (countBadge) countBadge.textContent = `Card ${currentNum} of ${total}`;

    // Render Card Texts
    const qText = document.getElementById('card-question-display');
    const aText = document.getElementById('card-answer-display');

    if (qText) qText.textContent = card.question;
    if (aText) aText.textContent = card.answer;

    // Reset Flip State
    this.isFlipped = false;
    const container = document.getElementById('study-flip-card');
    if (container) {
      container.classList.remove('flipped');
      container.style.display = 'block';
    }

    // Show Study Controls, Hide Summary
    const activeControls = document.getElementById('study-active-controls');
    const summaryView = document.getElementById('study-summary-view');

    if (activeControls) activeControls.style.display = 'flex';
    if (summaryView) summaryView.style.display = 'none';
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    const container = document.getElementById('study-flip-card');
    if (container) {
      container.classList.toggle('flipped', this.isFlipped);
    }
  }

  markCard(status) {
    if (this.currentIndex >= this.cardsQueue.length) return;

    const currentCard = this.cardsQueue[this.currentIndex];
    if (status === 'know') {
      this.knowCount++;
      showToast('Marked as Mastered', 'success');
    } else if (status === 'review') {
      this.reviewCount++;
      this.cardsQueue.push(currentCard);
      showToast('Added back to review queue', 'info');
    }

    const cardId = currentCard ? currentCard.id : '';
    const resultType = (status === 'know') ? 'known' : 'review';

    if (cardId) {
      // Save study activity dynamically in SQLite
      fetch('/api/study/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: cardId,
          result: resultType
        })
      }).then(res => {
        if (res.ok) return res.json();
      }).then(backendState => {
        if (backendState) {
          state.data = backendState;
          if (typeof renderStudentDashboard === 'function') renderStudentDashboard();
        }
      }).catch(err => console.error('Failed to log study action', err));
    }

    // Increment local cards studied count
    try {
      const todayStr = new Date().toDateString();
      if (localStorage.getItem('studyDay') !== todayStr) {
        localStorage.setItem('studyDay', todayStr);
        localStorage.setItem('cardsStudiedToday', '0');
      }
      const currentCount = parseInt(localStorage.getItem('cardsStudiedToday') || '0');
      localStorage.setItem('cardsStudiedToday', (currentCount + 1).toString());
    } catch (e) {
      console.error('Failed to update local storage study counts', e);
    }

    this.currentIndex++;
    this.renderCurrentCard();
  }

  shuffleCards() {
    const unstudied = this.cardsQueue.slice(this.currentIndex);
    for (let i = unstudied.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unstudied[i], unstudied[j]] = [unstudied[j], unstudied[i]];
    }

    this.cardsQueue = [...this.cardsQueue.slice(0, this.currentIndex), ...unstudied];
    this.renderCurrentCard();
    showToast('Flashcard queue shuffled', 'info');
  }

  renderSummary() {
    const activeControls = document.getElementById('study-active-controls');
    const cardContainer = document.getElementById('study-flip-card');
    const summaryView = document.getElementById('study-summary-view');

    if (activeControls) activeControls.style.display = 'none';
    if (cardContainer) cardContainer.style.display = 'none';

    if (summaryView) {
      summaryView.style.display = 'block';

      const totalPracticed = this.knowCount + this.reviewCount;
      const accuracy = totalPracticed > 0 ? Math.round((this.knowCount / totalPracticed) * 100) : 100;

      // Submit final deck completion report to the backend
      if (this.activeDeck && this.activeDeck.id) {
        fetch('/api/progress/study', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deck_id: this.activeDeck.id,
            accuracy: accuracy
          })
        }).then(res => {
          if (res.ok) return res.json();
        }).then(backendState => {
          if (backendState) {
            state.data = backendState;
            if (typeof renderStudentDashboard === 'function') renderStudentDashboard();
            if (typeof renderStudentDecks === 'function') renderStudentDecks();
          }
        }).catch(err => console.error('Failed to post session accuracy', err));
      }

      summaryView.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(5, 150, 105, 0.1); color: var(--color-emerald); font-size: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <i class="fa-solid fa-award"></i>
          </div>
          <h2 style="color: var(--text-main); font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem;">Practice Session Complete!</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 2rem;">You've completed reviewing all flashcards in "${this.activeDeck ? this.activeDeck.title : 'Deck'}"</p>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Mastered Cards</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-emerald); margin-top: 4px;">${this.knowCount}</div>
            </div>
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Reviewed Again</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-rose); margin-top: 4px;">${this.reviewCount}</div>
            </div>
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Retention Rate</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-blue-bright); margin-top: 4px;">${accuracy}%</div>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 1rem;">
            <button class="btn btn-secondary" onclick="studyEngine.startSession('${this.activeDeck ? this.activeDeck.id : ''}')">
              <i class="fa-solid fa-rotate-left"></i>
              <span>Practice Again</span>
            </button>
            <button class="btn btn-primary" onclick="closeModal('modal-study-session')">
              <i class="fa-solid fa-check"></i>
              <span>Done & Close</span>
            </button>
          </div>
        </div>
      `;
    }
  }
}

const studyEngine = new StudyEngine();

function launchStudySession(deckId) {
  studyEngine.startSession(deckId);
}
