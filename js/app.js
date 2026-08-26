/* FlashLearn Core State, Auth Router, and Theme Controller */

const STORAGE_KEY = 'flashlearn_state_v8';

const defaultState = {
  currentUser: null,
  theme: 'light',
  users: [
    {
      id: 'usr-teacher-1',
      name: 'Dr. Elizabeth Vance',
      email: 'teacher@gmail.com',
      password: '123',
      role: 'teacher'
    },
    {
      id: 'usr-student-1',
      name: 'Eleanor Vance',
      email: 'student@gmail.com',
      password: '123',
      role: 'student'
    }
  ],
  classrooms: [
    {
      id: 'cls-1',
      name: 'Biology 101: Cellular Mechanics',
      subject: 'Biology',
      code: 'BIO101X',
      teacher: 'Dr. Elizabeth Vance',
      enrolledCount: 32,
      avgPerformance: 82,
      enrolledStudents: [
        { id: 'st-1', name: 'Eleanor Vance', email: 'student@gmail.com', mark: 96, completedDecks: 4 },
        { id: 'st-3', name: 'Sophia Lin', email: 'sophia@university.edu', mark: 92, completedDecks: 5 },
        { id: 'st-2', name: 'Marcus Aurelius', email: 'marcus@university.edu', mark: 85, completedDecks: 3 }
      ],
      decks: ['deck-1']
    },
    {
      id: 'cls-2',
      name: 'Java Programming & Data Structures',
      subject: 'Computer Science',
      code: 'JAVA92A',
      teacher: 'Dr. Elizabeth Vance',
      enrolledCount: 40,
      avgPerformance: 76,
      enrolledStudents: [
        { id: 'st-1', name: 'Eleanor Vance', email: 'student@gmail.com', mark: 88, completedDecks: 3 },
        { id: 'st-5', name: 'Clara Oswald', email: 'clara@university.edu', mark: 92, completedDecks: 4 },
        { id: 'st-4', name: 'Julian Thorne', email: 'julian@university.edu', mark: 82, completedDecks: 2 }
      ],
      decks: ['deck-2']
    },
    {
      id: 'cls-3',
      name: 'Cloud Computing & Distributed Systems',
      subject: 'Technology',
      code: 'CLOUD7B',
      teacher: 'Dr. Elizabeth Vance',
      enrolledCount: 28,
      avgPerformance: 74,
      enrolledStudents: [
        { id: 'st-5', name: 'Clara Oswald', email: 'clara@university.edu', mark: 94, completedDecks: 4 },
        { id: 'st-2', name: 'Marcus Aurelius', email: 'marcus@university.edu', mark: 90, completedDecks: 3 }
      ],
      decks: ['deck-3']
    }
  ],
  decks: [
    {
      id: 'deck-1',
      title: 'Cellular Respiration & Mitosis',
      subject: 'Biology',
      cards: [
        { question: 'What is the primary energy currency produced by mitochondria?', answer: 'ATP (Adenosine Triphosphate)' },
        { question: 'What phase of cell division comes immediately after Metaphase?', answer: 'Anaphase' },
        { question: 'What key molecule accepts final electrons during aerobic respiration?', answer: 'Oxygen (O₂)' },
        { question: 'Define Mitosis in simple biological terms.', answer: 'The process where a single cell divides into two identical daughter cells.' }
      ],
      creator: 'Dr. Elizabeth Vance'
    },
    {
      id: 'deck-2',
      title: 'Java OOP Concepts & Collections',
      subject: 'Computer Science',
      cards: [
        { question: 'What are the four fundamental pillars of Object-Oriented Programming (OOP) in Java?', answer: 'Encapsulation, Inheritance, Polymorphism, and Abstraction.' },
        { question: 'What is the difference between == and .equals() in Java?', answer: '== compares memory address references; .equals() compares logical values.' },
        { question: 'What is the difference between ArrayList and LinkedList in Java?', answer: 'ArrayList is backed by a dynamic array offering O(1) index access; LinkedList is a doubly-linked list.' }
      ],
      creator: 'Dr. Elizabeth Vance'
    },
    {
      id: 'deck-3',
      title: 'Cloud Architecture & AWS Services',
      subject: 'Technology',
      cards: [
        { question: 'What is the primary purpose of Amazon S3?', answer: 'Scalable object storage in the cloud.' },
        { question: 'Define IaaS vs PaaS in cloud computing.', answer: 'IaaS provides raw virtual infrastructure; PaaS provides a platform for app development without managing servers.' }
      ],
      creator: 'Dr. Elizabeth Vance'
    }
  ],
  studentProgress: [
    { id: 'st-1', name: 'Eleanor Vance', email: 'student@gmail.com', course: 'Biology 101: Cellular Mechanics', completedDecks: 4, mark: 96 },
    { id: 'st-2', name: 'Marcus Aurelius', email: 'marcus@university.edu', course: 'Java Programming & Data Structures', completedDecks: 3, mark: 88 },
    { id: 'st-3', name: 'Sophia Lin', email: 'sophia@university.edu', course: 'Biology 101: Cellular Mechanics', completedDecks: 5, mark: 98 },
    { id: 'st-4', name: 'Julian Thorne', email: 'julian@university.edu', course: 'Cloud Computing & Distributed Systems', completedDecks: 2, mark: 82 },
    { id: 'st-5', name: 'Clara Oswald', email: 'clara@university.edu', course: 'Java Programming & Data Structures', completedDecks: 4, mark: 92 }
  ],
  studentJoinedClassrooms: ['cls-1', 'cls-2'],
  dailyStreak: {
    count: 5,
    lastPlayedDate: null,
    secretWord: 'GRAVITY',
    clues: [
      'Discovered mathematically by Sir Isaac Newton in 1687.',
      'An invisible fundamental force that pulls physical objects toward one another.',
      'Governs celestial orbits, planetary paths, and tides across the galaxy.',
      'Exerts a natural acceleration equal to 9.8 m/s² on Earth\'s surface.'
    ],
    currentClueIndex: 0,
    solved: false
  }
};

class FlashLearnState {
  constructor() {
    this.data = {
      currentUser: null,
      theme: 'light',
      users: [],
      classrooms: [],
      decks: [],
      studentProgress: [],
      studentJoinedClassrooms: [],
      dailyStreak: null
    };
  }

  async loadState() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        this.data = await res.json();
      }
    } catch (e) {
      console.error('Error loading state from server:', e);
    }
  }

  saveState(dataToSave = this.data) {
    // Standard signature kept to prevent breakage, backend handles mutations
  }

  setCurrentUser(user) {
    this.data.currentUser = user;
  }
}

const state = new FlashLearnState();

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modalId) {
  const backdrop = document.getElementById(modalId);
  if (backdrop) backdrop.classList.add('active');
}

function closeModal(modalId) {
  const backdrop = document.getElementById(modalId);
  if (backdrop) backdrop.classList.remove('active');
}

/* Toggle Dark/Light Theme inside User Dropdown */
async function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  const theme = isDark ? 'dark' : 'light';
  state.data.theme = theme;

  const iconEl = document.getElementById('theme-dropdown-icon');
  const labelEl = document.getElementById('theme-dropdown-label');

  if (iconEl) iconEl.textContent = isDark ? '🌙' : '☀️';
  if (labelEl) labelEl.textContent = isDark ? 'Dark Theme' : 'Light Theme';

  try {
    await fetch('/api/auth/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    });
  } catch (e) {
    console.error('Failed to sync theme with server:', e);
  }
  showToast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`, 'info');
}

/* User Header Dropdown Menu Toggle */
function toggleUserHeaderMenu() {
  const menu = document.getElementById('user-header-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('user-header-dropdown-container');
  const menu = document.getElementById('user-header-menu');
  if (dropdown && menu && !dropdown.contains(e.target)) {
    menu.classList.remove('active');
  }
});

/* Handle Sign In */
async function handleLogin(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email').value.trim().toLowerCase();
  const passwordInput = document.getElementById('login-password').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password: passwordInput })
    });
    
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Invalid email or password.', 'error');
      return;
    }
    
    const backendState = await res.json();
    state.data = backendState;
    showToast(`Welcome back, ${state.data.currentUser.name}!`, 'success');
    updateAppAuthUI();
  } catch (e) {
    console.error(e);
    showToast('An error occurred during login.', 'error');
  }
}

/* Handle Register */
async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value.trim();

  if (!name || !email || !password) {
    showToast('Please fill out all registration fields.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Registration failed.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;
    showToast(`Welcome, ${state.data.currentUser.name}!`, 'success');
    updateAppAuthUI();
  } catch (e) {
    console.error(e);
    showToast('An error occurred during registration.', 'error');
  }
}

async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      const backendState = await res.json();
      state.data = backendState;
      showToast('Logged out successfully.', 'info');
      updateAppAuthUI();
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred during logout.', 'error');
  }
}

function toggleAuthTab(tab) {
  const loginForm = document.getElementById('auth-login-form');
  const regForm = document.getElementById('auth-reg-form');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-reg');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    regForm.style.display = 'block';
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
  }
}

function updateAppAuthUI() {
  const authView = document.getElementById('auth-view');
  const landingView = document.getElementById('landing-view');
  const dashboardView = document.getElementById('dashboard-view');

  const currentUser = state.data.currentUser;

  if (!currentUser) {
    if (landingView) landingView.style.display = 'flex';
    if (authView) authView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'none';
  } else {
    if (landingView) landingView.style.display = 'none';
    if (authView) authView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'flex';

    // Update Header User Name & Avatar
    const headerNameEl = document.getElementById('header-user-fullname');
    if (headerNameEl) headerNameEl.textContent = currentUser.name;

    // Update Sidebar User Profile Card
    const nameEl = document.getElementById('sidebar-user-name');
    const badgeEl = document.getElementById('sidebar-user-badge');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl) nameEl.textContent = currentUser.name;
    if (badgeEl) badgeEl.textContent = currentUser.role === 'teacher' ? 'Faculty Admin' : 'Student Scholar';

    if (avatarEl) {
      const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || 'US';
    }

    const teacherWelcome = document.getElementById('teacher-welcome-msg');
    const studentWelcome = document.getElementById('student-welcome-msg');
    if (teacherWelcome) teacherWelcome.textContent = `Welcome, ${currentUser.name}`;
    if (studentWelcome) studentWelcome.textContent = `Welcome, ${currentUser.name}`;

    const teacherNav = document.getElementById('teacher-nav-group');
    const studentNav = document.getElementById('student-nav-group');

    if (currentUser.role === 'teacher') {
      if (teacherNav) teacherNav.style.display = 'block';
      if (studentNav) studentNav.style.display = 'none';
      switchTab('teacher-dashboard');
    } else {
      if (studentNav) studentNav.style.display = 'block';
      if (teacherNav) teacherNav.style.display = 'none';
      switchTab('student-dashboard');
    }
    updateHeaderStreak();
  }
}

/* Profile Helper */
async function handleUpdateProfile(event) {
  event.preventDefault();
  const nameInput = document.getElementById('profile-name-input').value.trim();
  const emailInput = document.getElementById('profile-email-input').value.trim();
  const passInput = document.getElementById('profile-password-input').value.trim();

  if (!nameInput || !emailInput) {
    showToast('Name and email cannot be empty.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput, email: emailInput, password: passInput })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to update profile.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;
    updateAppAuthUI();
    showToast('Profile updated successfully!', 'success');
  } catch (e) {
    console.error(e);
    showToast('An error occurred updating profile.', 'error');
  }
}

function updateHeaderStreak() {
  const currentUser = state.data.currentUser;
  const headerStreakEl = document.getElementById('header-streak-badge');
  const headerStreakCountEl = document.getElementById('header-streak-count');
  if (currentUser && currentUser.role === 'student' && state.data.dailyStreak) {
    if (headerStreakEl) headerStreakEl.style.display = 'flex';
    if (headerStreakCountEl) headerStreakCountEl.textContent = state.data.dailyStreak.count;
  } else {
    if (headerStreakEl) headerStreakEl.style.display = 'none';
  }
}
