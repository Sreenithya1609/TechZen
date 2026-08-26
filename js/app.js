/* FlashLearn Enterprise State, Auth Router, and Theme Controller */

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
    // Backend handles state persistence via SQLite
  }

  setCurrentUser(user) {
    this.data.currentUser = user;
  }
}

const state = new FlashLearnState();

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  const iconClass = iconMap[type] || 'fa-circle-info';

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}" style="font-size: 1.15rem;"></i>
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

// Global escape key listener to close active modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

/* Toggle Dark/Light Theme inside User Dropdown */
async function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  const theme = isDark ? 'dark' : 'light';
  state.data.theme = theme;

  const iconEl = document.getElementById('theme-dropdown-icon');
  const labelEl = document.getElementById('theme-dropdown-label');

  if (iconEl) iconEl.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  if (labelEl) labelEl.textContent = isDark ? 'Dark Mode' : 'Light Mode';

  try {
    await fetch('/api/auth/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    });
  } catch (e) {
    console.error('Failed to sync theme with server:', e);
  }
  showToast(`Theme switched to ${isDark ? 'Dark' : 'Light'} Mode`, 'info');
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
    showToast('An error occurred during sign in.', 'error');
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

  if (password.length < 6) {
    showToast('Password must be at least 6 characters long.', 'error');
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
    showToast(`Welcome to FlashLearn, ${state.data.currentUser.name}!`, 'success');
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
    showToast('An error occurred during sign out.', 'error');
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
    const dropdownNameEl = document.getElementById('dropdown-user-name');
    const dropdownRoleEl = document.getElementById('dropdown-user-role');
    const headerAvatarMini = document.getElementById('header-avatar-mini');

    if (headerNameEl) headerNameEl.textContent = currentUser.name;
    if (dropdownNameEl) dropdownNameEl.textContent = currentUser.name;
    if (dropdownRoleEl) dropdownRoleEl.textContent = currentUser.role === 'teacher' ? 'Faculty Admin' : 'Student Scholar';

    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'US';
    if (headerAvatarMini) headerAvatarMini.textContent = initials;

    // Update Sidebar User Profile Card
    const nameEl = document.getElementById('sidebar-user-name');
    const badgeEl = document.getElementById('sidebar-user-badge');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl) nameEl.textContent = currentUser.name;
    if (badgeEl) badgeEl.textContent = currentUser.role === 'teacher' ? 'Faculty Admin' : 'Student Scholar';
    if (avatarEl) avatarEl.textContent = initials;

    const teacherWelcome = document.getElementById('teacher-welcome-msg');
    const studentWelcome = document.getElementById('student-welcome-msg');
    if (teacherWelcome) {
      teacherWelcome.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> Welcome, ${currentUser.name}`;
    }
    if (studentWelcome) {
      studentWelcome.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> Welcome, ${currentUser.name}`;
    }

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
      body: JSON.stringify({ name: nameInput, email: emailInput, password: passInput || undefined })
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
    if (headerStreakEl) headerStreakEl.style.display = 'inline-flex';
    if (headerStreakCountEl) headerStreakCountEl.textContent = state.data.dailyStreak.count;
  } else {
    if (headerStreakEl) headerStreakEl.style.display = 'none';
  }
}
