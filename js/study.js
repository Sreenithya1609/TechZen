/* Study Engine & 3D Card Flip Session */

class StudyEngine {
  constructor() {
    this.activeDeck = null;
    this.cardsQueue = [];
    this.currentIndex = 0;
    this.knowCount = 0;
    this.reviewCount = 0;
    this.isFlipped = false;
  }

  startSession(deckId) {
    let deck = state.data.decks.find(d => d.id === deckId);
    
    // Fallback search by title or create simulated deck if needed
    if (!deck) {
      deck = {
        id: deckId || 'deck-demo',
        title: 'Flashcard Study Deck',
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

    // Render first card & UI
    this.renderCurrentCard();
    openModal('modal-study-session');
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
    if (status === 'know') {
      this.knowCount++;
      showToast('Marked as Known! ✓', 'success');
    } else if (status === 'review') {
      this.reviewCount++;
      const currentCard = this.cardsQueue[this.currentIndex];
      this.cardsQueue.push(currentCard);
      showToast('Card added back to review queue 🔄', 'info');
    }

    // Save study activity dynamically in SQLite
    fetch('/api/progress/study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(res => {
      if (res.ok) return res.json();
    }).then(backendState => {
      if (backendState) {
        state.data = backendState;
        if (typeof renderStudentDashboard === 'function') renderStudentDashboard();
      }
    }).catch(err => console.error('Failed to log study action', err));

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
    showToast('Flashcard order shuffled! 🎲', 'info');
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

      summaryView.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎓</div>
          <h2 style="color: var(--color-blue-dark); font-size: 1.8rem; margin-bottom: 0.5rem;">Practice Session Complete!</h2>
          <p style="color: var(--text-muted); margin-bottom: 2rem;">You've reviewed all cards in "${this.activeDeck ? this.activeDeck.title : 'Deck'}"</p>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.85rem; color: var(--text-subtle);">Mastered Cards</div>
              <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-emerald);">${this.knowCount}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.85rem; color: var(--text-subtle);">Needs Review</div>
              <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-rose);">${this.reviewCount}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.85rem; color: var(--text-subtle);">Mastery Score</div>
              <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-blue-dark);">${accuracy}%</div>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 1rem;">
            <button class="btn btn-secondary" onclick="studyEngine.startSession('${this.activeDeck ? this.activeDeck.id : ''}')">Practice Again</button>
            <button class="btn btn-primary" onclick="closeModal('modal-study-session')">Done & Exit</button>
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
