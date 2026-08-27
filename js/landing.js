/* FlashLearn Enterprise Landing Page Module (Hero 3D Flip, Bento Showcase, Category Filters) */

const landingDecksData = [
  {
    id: 'deck-land-1',
    title: 'Anatomy & Cellular Mechanics',
    subject: 'Biology',
    category: 'biology',
    description: 'Explore mitochondrial energy pathways, cellular respiration, mitosis stages, and ATP synthesis mechanisms.',
    cards: 250,
    rating: '4.9',
    ratingCount: '1.2k',
    author: 'Dr. Elizabeth Vance',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    tagIcon: 'fa-dna',
    mastery: 94
  },
  {
    id: 'deck-land-2',
    title: 'Java Data Structures & OOP',
    subject: 'Computer Science',
    category: 'cs',
    description: 'Master polymorphic hierarchies, generics, ArrayList vs LinkedList memory topologies, and concurrency.',
    cards: 320,
    rating: '4.9',
    ratingCount: '2.4k',
    author: 'Faculty Team',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    tagIcon: 'fa-code',
    mastery: 88
  },
  {
    id: 'deck-land-3',
    title: 'Cloud Architecture & AWS Services',
    subject: 'Technology',
    category: 'tech',
    description: 'Deep dive into microservices, Amazon S3 storage classes, distributed event queues, and IAM policies.',
    cards: 210,
    rating: '4.8',
    ratingCount: '890',
    author: 'Cloud Specialist',
    gradient: 'linear-gradient(135deg, #059669 0%, #065f46 100%)',
    tagIcon: 'fa-cloud',
    mastery: 92
  },
  {
    id: 'deck-land-4',
    title: 'Organic Chemistry & Reaction Pathways',
    subject: 'Chemistry',
    category: 'biology',
    description: 'Electrophilic addition, stereochemistry, chiral centers, and SN1 vs SN2 reaction mechanisms.',
    cards: 190,
    rating: '4.7',
    ratingCount: '650',
    author: 'Dr. Marcus Webb',
    gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    tagIcon: 'fa-flask',
    mastery: 85
  },
  {
    id: 'deck-land-5',
    title: 'Distributed Systems & Algorithms',
    subject: 'Computer Science',
    category: 'cs',
    description: 'Raft consensus, CAP theorem, Paxos protocol, vector clocks, and Byzantine fault tolerance.',
    cards: 280,
    rating: '4.9',
    ratingCount: '1.8k',
    author: 'Systems Lab',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    tagIcon: 'fa-network-wired',
    mastery: 96
  },
  {
    id: 'deck-land-6',
    title: 'Architectural History & Urban Form',
    subject: 'Humanities',
    category: 'humanities',
    description: 'Classical orders, modernist structural innovations, urban zoning typologies, and heritage preservation.',
    cards: 160,
    rating: '4.8',
    ratingCount: '420',
    author: 'Arts Faculty',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)',
    tagIcon: 'fa-landmark',
    mastery: 90
  }
];

let activeLandingFilter = 'all';

function renderLandingDecks(category = 'all') {
  activeLandingFilter = category;
  const container = document.getElementById('landing-decks-showcase');
  if (!container) return;

  const filteredDecks = category === 'all' 
    ? landingDecksData 
    : landingDecksData.filter(d => d.category === category);

  container.innerHTML = filteredDecks.map(deck => `
    <div class="deck-modern-card" onclick="showAuthView('login')">
      <div class="deck-modern-header" style="background: ${deck.gradient};">
        <div class="deck-modern-badge">
          <i class="fa-solid ${deck.tagIcon}"></i>
          <span>${deck.subject}</span>
        </div>
      </div>

      <div class="deck-modern-body">
        <h3 class="deck-modern-title">${deck.title}</h3>
        <p class="deck-modern-desc">${deck.description}</p>

        <div class="deck-modern-footer">
          <div class="deck-author-box">
            <div class="deck-author-avatar">
              <i class="fa-solid fa-chalkboard-user"></i>
            </div>
            <span>${deck.author}</span>
          </div>
        </div>

        <button type="button" class="btn btn-secondary deck-study-btn" onclick="event.stopPropagation(); showAuthView('login');">
          <span>Start Spaced Practice</span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Update active filter pill style
  document.querySelectorAll('.landing-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function setLandingFilter(category) {
  renderLandingDecks(category);
}

/* Hero Live 3D Interactive Card Flip Logic */
let heroDemoFlipped = false;
const heroDemoCards = [
  {
    q: 'How does Spaced Repetition optimize the human memory retention curve?',
    a: 'By systematically calculating expanding intervals between study sessions to interrupt the Ebbinghaus forgetting curve and solidify synaptic pathways.',
    tag: 'Cognitive Science'
  },
  {
    q: 'What is the fundamental difference between Active Recall and Passive Review?',
    a: 'Active Recall forces the brain to retrieve information without cues, generating stronger neural pathways than passive recognition or re-reading.',
    tag: 'Learning Psychology'
  },
  {
    q: 'Why do Spaced Repetition Systems (SRS) reduce total study hours by up to 70%?',
    a: 'SRS dynamically prioritizes difficult flashcards for frequent review while deferring mastered concepts, eliminating redundant over-studying.',
    tag: 'Efficiency Metric'
  }
];

let heroDemoIndex = 0;

function flipHeroDemoCard() {
  const cardInner = document.getElementById('hero-demo-card-inner');
  if (!cardInner) return;

  heroDemoFlipped = !heroDemoFlipped;
  cardInner.classList.toggle('flipped', heroDemoFlipped);
}

function nextHeroDemoCard(event) {
  if (event) event.stopPropagation();
  heroDemoIndex = (heroDemoIndex + 1) % heroDemoCards.length;
  const current = heroDemoCards[heroDemoIndex];

  const qEl = document.getElementById('hero-demo-question');
  const aEl = document.getElementById('hero-demo-answer');
  const tagEl = document.getElementById('hero-demo-tag');
  const cardInner = document.getElementById('hero-demo-card-inner');

  if (cardInner) {
    cardInner.classList.remove('flipped');
    heroDemoFlipped = false;
  }

  if (qEl) qEl.textContent = current.q;
  if (aEl) aEl.textContent = current.a;
  if (tagEl) tagEl.textContent = current.tag;
}

document.addEventListener('DOMContentLoaded', () => {
  renderLandingDecks('all');
});
