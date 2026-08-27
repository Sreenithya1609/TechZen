/* FlashLearn Enterprise App State & Global UI Module */

class FlashLearnState {
  constructor() {
    this.data = {
      currentUser: null,
      classrooms: [],
      decks: [],
      studentJoinedClassrooms: [],
      dailyStreak: { count: 0, currentClueIndex: 0, secretWord: '', solved: false, clues: [] },
      theme: 'light'
    };
  }

  async loadState() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        this.data = await res.json();
      }
    } catch (e) {
      console.error('Failed to load initial state from server:', e);
    }
  }
}

const state = new FlashLearnState();

// Toast Notifications System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-exclamation';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}" style="font-size: 1.15rem; flex-shrink: 0;"></i>
    <div style="flex: 1; line-height: 1.4;">${message}</div>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--text-subtle); cursor: pointer; padding: 2px; font-size: 0.9rem;">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Sync Theme Icons & Labels
function syncThemeUI(isDark) {
  const iconEl = document.getElementById('theme-dropdown-icon');
  const labelEl = document.getElementById('theme-dropdown-label');
  const landingIcon = document.getElementById('theme-landing-icon');

  if (iconEl) iconEl.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  if (labelEl) labelEl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  if (landingIcon) landingIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// Theme Switcher (Light / Dark)
async function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  const theme = isDark ? 'dark' : 'light';
  state.data.theme = theme;
  localStorage.setItem('theme', theme);

  syncThemeUI(isDark);

  showToast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`, 'info');

  try {
    await fetch('/api/auth/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    });
  } catch (e) {
    console.error('Failed to sync theme preference:', e);
  }
}

// User Header Dropdown Menu
function toggleUserHeaderMenu() {
  const menu = document.getElementById('user-header-menu');
  if (menu) menu.classList.toggle('active');
}

// Close Dropdown when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('user-header-dropdown-container');
  const menu = document.getElementById('user-header-menu');
  if (container && menu && !container.contains(e.target)) {
    menu.classList.remove('active');
  }
});

// Switch Between Auth Tabs (Login / Register)
function toggleAuthTab(tab) {
  const loginForm = document.getElementById('auth-login-form');
  const regForm = document.getElementById('auth-reg-form');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-reg');

  localStorage.setItem('currentView', 'auth:' + tab);

  if (tab === 'login') {
    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
    if (tabLogin) tabLogin.classList.add('active');
    if (tabReg) tabReg.classList.remove('active');
  } else {
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'block';
    if (tabLogin) tabLogin.classList.remove('active');
    if (tabReg) tabReg.classList.add('active');
  }
}

// Quick Fill Demo Credentials (Faculty vs Student)
function quickFillDemoUser(role) {
  toggleAuthTab('login');
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');

  if (role === 'teacher') {
    if (emailInput) emailInput.value = 'revathi@gmail.com';
    if (pwdInput) pwdInput.value = 'Password123!';
    showToast('Loaded Faculty Admin credentials (revathi@gmail.com)', 'info');
  } else if (role === 'student') {
    if (emailInput) emailInput.value = 'student@gmail.com';
    if (pwdInput) pwdInput.value = 'Password123!';
    showToast('Loaded Scholar credentials (student@gmail.com)', 'info');
  }
}

// Password Visibility Toggle
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash input-eye-neon';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye input-eye-neon';
  }
}

// Handle User Login
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Please enter both email and password.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
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
    showToast('An error occurred during sign in.', 'error');
  }
}

// Handle User Registration
async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!name || !email || !password) {
    showToast('Please fill out all registration fields.', 'error');
    return;
  }

  // Password Validation Checks
  if (password.length < 6) {
    showToast('Password must be at least 6 characters long.', 'error');
    return;
  }
  if (!/[a-zA-Z]/.test(password)) {
    showToast('Password must contain at least one letter.', 'error');
    return;
  }
  if (!/[0-9]/.test(password)) {
    showToast('Password must contain at least one number.', 'error');
    return;
  }
  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    showToast('Password must contain at least one symbol.', 'error');
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
      showToast(err.error || 'Failed to register account.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    showToast(`Account created successfully! Welcome, ${state.data.currentUser.name}!`, 'success');
    updateAppAuthUI();
  } catch (e) {
    console.error(e);
    showToast('An error occurred during registration.', 'error');
  }
}

// Handle User Logout
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.error(e);
  }

  state.data.currentUser = null;
  localStorage.removeItem('currentView'); // Clear persisted view on logout
  showLandingView();
  showToast('You have been signed out.', 'info');
}

// Update UI According to Current Auth State
function updateAppAuthUI(skipSwitchTab = false) {
  const user = state.data.currentUser;
  if (!user) {
    showLandingView();
    return;
  }

  document.getElementById('landing-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'flex';

  // Update Header & Sidebar Identity
  const headerName = document.getElementById('header-user-fullname');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownRole = document.getElementById('dropdown-user-role');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarRole = document.getElementById('sidebar-user-badge');
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : 'US';

  if (headerName) headerName.textContent = user.name;
  if (dropdownName) dropdownName.textContent = user.name;
  if (dropdownRole) dropdownRole.textContent = user.role === 'teacher' ? 'Faculty Admin' : 'Scholar';
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarRole) sidebarRole.textContent = user.role === 'teacher' ? 'Faculty Admin' : 'Scholar';
  if (sidebarAvatar) sidebarAvatar.textContent = initials;

  // Toggle Role Navigation
  const teacherNav = document.getElementById('teacher-nav-group');
  const studentNav = document.getElementById('student-nav-group');
  const streakBadge = document.getElementById('header-streak-badge');

  if (user.role === 'teacher') {
    if (teacherNav) teacherNav.style.display = 'block';
    if (studentNav) studentNav.style.display = 'none';
    if (streakBadge) streakBadge.style.display = 'none';
    if (!skipSwitchTab) {
      switchTab('teacher-dashboard');
    }
  } else {
    if (teacherNav) teacherNav.style.display = 'none';
    if (studentNav) studentNav.style.display = 'block';
    if (streakBadge) streakBadge.style.display = 'inline-flex';
    updateHeaderStreak();
    if (!skipSwitchTab) {
      switchTab('student-dashboard');
    }
  }
}

function updateHeaderStreak() {
  const countEl = document.getElementById('header-streak-count');
  if (countEl && state.data.dailyStreak) {
    countEl.textContent = state.data.dailyStreak.count;
  }
}

// Profile Management
function renderProfileView() {
  const user = state.data.currentUser;
  if (!user) return;

  const nameInput = document.getElementById('profile-name-input');
  const emailInput = document.getElementById('profile-email-input');
  const passwordInput = document.getElementById('profile-password-input');
  const identityName = document.getElementById('profile-identity-name');
  const identityEmail = document.getElementById('profile-identity-email');

  if (nameInput) nameInput.value = user.name;
  if (emailInput) emailInput.value = user.email;
  if (passwordInput) passwordInput.value = '';
  if (identityName) identityName.textContent = user.name;
  if (identityEmail) identityEmail.textContent = user.email;
}

async function handleUpdateProfile(event) {
  event.preventDefault();
  const name = document.getElementById('profile-name-input').value.trim();
  const email = document.getElementById('profile-email-input').value.trim();
  const password = document.getElementById('profile-password-input').value;

  if (!name || !email) {
    showToast('Name and email are required.', 'error');
    return;
  }

  if (password) {
    if (password.length < 6) {
      showToast('New password must be at least 6 characters long.', 'error');
      return;
    }
    if (!/[a-zA-Z]/.test(password)) {
      showToast('New password must contain at least one letter.', 'error');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast('New password must contain at least one number.', 'error');
      return;
    }
    if (!/[^a-zA-Z0-9\s]/.test(password)) {
      showToast('New password must contain at least one symbol.', 'error');
      return;
    }
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: password || undefined })
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

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Global modal backdrop close
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
  }
});

// Periodic dashboard background polling for real-time Class Mastery & progress updates
setInterval(async () => {
  if (state.data && state.data.currentUser) {
    const currentView = localStorage.getItem('currentView') || '';
    await state.loadState();
    
    // Only refresh active UI if on a dashboard panel
    if (currentView === 'tab:teacher-dashboard' && typeof renderTeacherDashboard === 'function') {
      renderTeacherDashboard();
    } else if (currentView === 'tab:teacher-myclasses' && typeof renderMyClassesPanel === 'function') {
      renderMyClassesPanel();
    } else if (currentView === 'tab:student-dashboard' && typeof renderStudentDashboard === 'function') {
      renderStudentDashboard();
    }
  }
}, 20000);
