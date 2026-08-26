/* FlashLearn Landing Page Module (Single-Row Arrow Horizontal Carousel - No Scrollbar) */

const sampleLandingDecks = [
  {
    title: 'Anatomy & Physiology',
    cards: 250,
    rating: '4.8 ★',
    tag: '✏️ Learning',
    bgStyle: 'background:#fef3c7; color:#b45309;',
    image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'Global Geography',
    cards: 180,
    rating: '4.9 ★',
    tag: '✓ Know It',
    bgStyle: 'background:#dbeafe; color:#1e40af;',
    image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'Language & Linguistics',
    cards: 320,
    rating: '4.7 ★',
    tag: '⚡ Reviewing',
    bgStyle: 'background:#ffe4e6; color:#be123c;',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'Organic Chemistry',
    cards: 210,
    rating: '4.8 ★',
    tag: '🧪 Science',
    bgStyle: 'background:#e0f2fe; color:#0369a1;',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'Data Structures & Algorithms',
    cards: 275,
    rating: '4.9 ★',
    tag: '💻 Coding',
    bgStyle: 'background:#ede9fe; color:#6d28d9;',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'Art & Architecture',
    cards: 150,
    rating: '4.7 ★',
    tag: '🏛️ Art',
    bgStyle: 'background:#f3e8ff; color:#7e22ce;',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'Study Essentials & Formulas',
    cards: 400,
    rating: '4.9 ★',
    tag: '📝 Study',
    bgStyle: 'background:#dcfce7; color:#15803d;',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=400&q=80'
  }
];

function renderLandingDecks() {
  const track = document.getElementById('carousel-track');
  if (!track) return;

  track.innerHTML = sampleLandingDecks.map(deck => `
    <div class="landing-deck-card">
      <div class="landing-deck-img-box" style="background-image: url('${deck.image}');">
        <span class="landing-tag" style="${deck.bgStyle}">${deck.tag}</span>
      </div>
      <div class="landing-deck-body">
        <h3 class="landing-deck-title">${deck.title}</h3>
        <p class="landing-deck-meta">${deck.cards} Cards • ${deck.rating}</p>
      </div>
    </div>
  `).join('');
}

function prevCarouselSlide() {
  const track = document.getElementById('carousel-track');
  if (track) {
    track.scrollBy({ left: -345, behavior: 'smooth' });
  }
}

function nextCarouselSlide() {
  const track = document.getElementById('carousel-track');
  if (track) {
    track.scrollBy({ left: 345, behavior: 'smooth' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderLandingDecks();
});
