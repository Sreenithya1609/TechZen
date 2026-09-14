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

// Quick Fill Demo Credentials (Admin vs Faculty vs Student)
function quickFillDemoUser(role) {
  toggleAuthTab('login');
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');

  if (role === 'admin' || role === 'teacher') {
    if (emailInput) emailInput.value = 'revathi@gmail.com';
    if (pwdInput) pwdInput.value = 'Techzen_123';
    showToast('Loaded Faculty Admin credentials (revathi@gmail.com)', 'info');
  } else if (role === 'student') {
    if (emailInput) emailInput.value = 'student@gmail.com';
    if (pwdInput) pwdInput.value = 'Password123!';
    showToast('Loaded Scholar credentials (student@gmail.com)', 'info');
  }
}

// Switch Role in Login / Sign In Form (Legacy stub for backward compatibility)
function selectLoginRole(role) {
  // Login role is resolved server-side from authenticated user credentials
}

// Switch Role in Registration / Sign Up Form
function selectRegRole(role) {
  const studentBtn = document.getElementById('reg-role-student');
  const teacherBtn = document.getElementById('reg-role-teacher');
  const roleInput = document.getElementById('reg-selected-role');
  const emailLabel = document.getElementById('reg-email-label');
  const roleHint = document.getElementById('reg-role-hint');

  if (role === 'teacher') {
    if (studentBtn) studentBtn.classList.remove('active');
    if (teacherBtn) teacherBtn.classList.add('active');
    if (roleInput) roleInput.value = 'teacher';
    if (emailLabel) emailLabel.textContent = 'Teacher / Faculty Email';
    if (roleHint) {
      roleHint.textContent = 'Note: Teacher account applications are submitted for administrator approval.';
    }
  } else {
    if (studentBtn) studentBtn.classList.add('active');
    if (teacherBtn) teacherBtn.classList.remove('active');
    if (roleInput) roleInput.value = 'student';
    if (emailLabel) emailLabel.textContent = 'Student Email';
    if (roleHint) {
      roleHint.textContent = 'Standard scholar access to classrooms, study decks, and streaks.';
    }
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
    showToast(`Hello, ${state.data.currentUser.name}!`, 'success');
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
  const confirmPassword = document.getElementById('reg-confirm-password').value;

  if (!name || !email || !password) {
    showToast('Please fill out all registration fields.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showToast('Password and confirmation password must match.', 'error');
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

  const selectedRole = document.getElementById('reg-selected-role') ? document.getElementById('reg-selected-role').value : 'student';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        confirm_password: confirmPassword,
        role: selectedRole
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to register account.', 'error');
      return;
    }

    const backendState = await res.json();

    if (selectedRole === 'teacher' || (backendState.currentUser && backendState.currentUser.teacherStatus === 'pending')) {
      showToast('Account created with Teacher application submitted for Admin review!', 'success');
    } else {
      showToast(backendState.message || 'Account created successfully as Student. Welcome!', 'success');
    }
    toggleAuthTab('login');
  } catch (e) {
    console.error(e);
    showToast('An error occurred during registration.', 'error');
  }
}

// Google Auth Configuration & Client State
let googleAuthConfig = {
  clientId: '',
  configured: false
};
let googleTokenClient = null;

// Initialize Google OAuth config from server
async function initGoogleAuth() {
  try {
    const res = await fetch('/api/auth/google/config');
    if (res.ok) {
      googleAuthConfig = await res.json();
      setupGoogleGISClient();
    }
  } catch (e) {
    console.warn('Unable to load Google Auth configuration:', e);
  }
}

// Setup Google Identity Services client
function setupGoogleGISClient() {
  if (!googleAuthConfig.clientId || typeof google === 'undefined' || !google.accounts) {
    return;
  }

  try {
    // Initialize ID Token flow
    google.accounts.id.initialize({
      client_id: googleAuthConfig.clientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    // Initialize OAuth2 Token client for custom button popup
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleAuthConfig.clientId,
      scope: 'email profile openid',
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          await verifyGoogleToken({ access_token: tokenResponse.access_token });
        }
      },
      error_callback: (err) => {
        console.warn('Google Token Client error:', err);
        showToast('Google Sign-In was cancelled or failed.', 'info');
      }
    });
  } catch (err) {
    console.warn('Error setting up Google GIS:', err);
  }
}

// Handler when user clicks "Continue with Google"
function initiateGoogleSignIn() {
  if (!googleAuthConfig.configured || !googleAuthConfig.clientId) {
    // Display guidance modal explaining how to configure Google Client ID
    openModal('modal-google-setup');
    return;
  }

  if (typeof google === 'undefined' || !google.accounts) {
    showToast('Google Identity Service is loading. Please try again in a moment.', 'info');
    return;
  }

  // If tokenClient is ready, request popup
  if (googleTokenClient) {
    googleTokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    // Fallback to prompt
    google.accounts.id.prompt();
  }
}

// Callback for ID token response
async function handleGoogleCredentialResponse(response) {
  if (response && response.credential) {
    await verifyGoogleToken({ credential: response.credential });
  }
}

// Verify Google Token with FlashLearn backend
async function verifyGoogleToken(payload) {
  try {
    showToast('Connecting with Google...', 'info');
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Google authentication failed.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    showToast(`Welcome, ${state.data.currentUser.name}! Signed in with Google.`, 'success');
    closeModal('modal-google-setup');
    updateAppAuthUI();
  } catch (e) {
    console.error('Google auth error:', e);
    showToast('Unable to complete Google Sign-In.', 'error');
  }
}

// Demo Google Account testing
async function loginWithGoogleDemoAccount() {
  await verifyGoogleToken({
    credential: 'demo-google-token',
    demo_email: 'scholar.google@domain.edu',
    demo_name: 'Scholar Vance'
  });
}

// Run Google Auth config fetch immediately
initGoogleAuth();
window.addEventListener('load', setupGoogleGISClient);


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

  let roleLabel = 'Scholar';
  if (user.role === 'admin') {
    roleLabel = 'System Admin';
  } else if (user.role === 'teacher') {
    roleLabel = 'Faculty Admin';
  }

  if (headerName) headerName.textContent = user.name;
  if (dropdownName) dropdownName.textContent = user.name;
  if (dropdownRole) dropdownRole.textContent = roleLabel;
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarRole) sidebarRole.textContent = roleLabel;
  if (sidebarAvatar) sidebarAvatar.textContent = initials;

  // Toggle Role Navigation
  const adminNav = document.getElementById('admin-nav-group');
  const teacherNav = document.getElementById('teacher-nav-group');
  const studentNav = document.getElementById('student-nav-group');
  const streakBadge = document.getElementById('header-streak-badge');

  if (user.role === 'admin') {
    if (adminNav) adminNav.style.display = 'block';
    if (teacherNav) teacherNav.style.display = 'block';
    if (studentNav) studentNav.style.display = 'none';
    if (streakBadge) streakBadge.style.display = 'none';
    if (!skipSwitchTab) {
      switchTab('admin-requests');
    }
  } else if (user.role === 'teacher') {
    if (adminNav) adminNav.style.display = 'none';
    if (teacherNav) teacherNav.style.display = 'block';
    if (studentNav) studentNav.style.display = 'none';
    if (streakBadge) streakBadge.style.display = 'none';
    if (!skipSwitchTab) {
      switchTab('teacher-dashboard');
    }
  } else {
    if (adminNav) adminNav.style.display = 'none';
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
    if (currentView === 'tab:admin-requests' && typeof loadAdminTeacherRequests === 'function') {
      loadAdminTeacherRequests();
    } else if (currentView === 'tab:teacher-dashboard' && typeof renderTeacherDashboard === 'function') {
      renderTeacherDashboard();
    } else if (currentView === 'tab:teacher-myclasses' && typeof renderMyClassesPanel === 'function') {
      renderMyClassesPanel();
    } else if (currentView === 'tab:student-dashboard' && typeof renderStudentDashboard === 'function') {
      renderStudentDashboard();
    }
  }
}, 20000);

// Admin Teacher Access Requests Management
async function loadAdminTeacherRequests(filter) {
  if (!filter) {
    const select = document.getElementById('admin-request-filter');
    filter = select ? select.value : 'pending';
  }
  const container = document.getElementById('admin-requests-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--color-blue-bright);"></i>
      <p>Loading teacher access applications...</p>
    </div>
  `;

  try {
    const url = filter === 'all' ? '/api/admin/teacher-requests?status=all' : `/api/admin/teacher-requests?status=${encodeURIComponent(filter)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      container.innerHTML = `<div class="card" style="color: var(--color-rose); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${err.error || 'Failed to load requests.'}</div>`;
      return;
    }

    const data = await res.json();
    const requests = data.requests || [];

    if (requests.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem; color: var(--text-muted); border: 1px dashed var(--border-blue);">
          <i class="fa-solid fa-user-check" style="font-size: 2.5rem; color: var(--color-emerald); margin-bottom: 1rem; display: block;"></i>
          <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No ${filter === 'pending' ? 'Pending ' : ''}Applications</h3>
          <p style="font-size: 0.9rem;">There are currently no instructor access requests matching this filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${requests.map(req => {
          const initials = req.name ? req.name.slice(0, 2).toUpperCase() : 'ST';
          const requestedDate = req.teacher_requested_at ? new Date(req.teacher_requested_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
          
          let statusLabel = 'Pending Review';
          let badgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);';

          if (req.teacher_status === 'approved') {
            statusLabel = 'Approved Faculty';
            badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';
          } else if (req.teacher_status === 'rejected') {
            statusLabel = 'Application Rejected';
            badgeStyle = 'background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3);';
          }

          const isPending = req.teacher_status === 'pending';

          return `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-radius: var(--radius-lg); flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, var(--color-blue-bright), var(--color-purple)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; flex-shrink: 0;">
                  ${initials}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <strong style="font-size: 1.05rem; color: var(--text-main);">${req.name}</strong>
                    <span style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; ${badgeStyle}">${statusLabel}</span>
                  </div>
                  <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 3px;">
                    <i class="fa-solid fa-envelope" style="font-size: 0.75rem; margin-right: 4px;"></i>${req.email} &bull; <span style="font-size: 0.8rem;">Applied: ${requestedDate}</span>
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${isPending ? `
                  <button class="btn btn-primary btn-sm" onclick="adminApproveTeacher('${req.id}', '${req.name.replace(/'/g, "\\'")}')" style="background: var(--color-emerald); border-color: var(--color-emerald); padding: 7px 14px;">
                    <i class="fa-solid fa-check"></i> Approve
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="adminRejectTeacher('${req.id}', '${req.name.replace(/'/g, "\\'")}')" style="color: var(--color-rose); border-color: rgba(244, 63, 94, 0.3); padding: 7px 14px;">
                    <i class="fa-solid fa-xmark"></i> Reject
                  </button>
                ` : `
                  <button class="btn btn-secondary btn-sm" onclick="adminApproveTeacher('${req.id}', '${req.name.replace(/'/g, "\\'")}')" title="Grant Teacher Role" style="padding: 6px 12px; font-size: 0.8rem;">
                    <i class="fa-solid fa-user-check"></i> Grant Role
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="adminRejectTeacher('${req.id}', '${req.name.replace(/'/g, "\\'")}')" title="Revoke Teacher Role" style="padding: 6px 12px; font-size: 0.8rem; color: var(--color-rose); border-color: rgba(244, 63, 94, 0.3);">
                    <i class="fa-solid fa-user-xmark"></i> Revoke
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Error fetching teacher requests:', err);
    container.innerHTML = `<div class="card" style="color: var(--color-rose); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Network error loading teacher requests.</div>`;
  }
}

async function adminApproveTeacher(userId, userName) {
  if (!confirm(`Approve teacher access for ${userName || 'this user'}? This will grant full instructor privileges.`)) return;

  try {
    const res = await fetch(`/api/admin/teacher-requests/${userId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to approve teacher.', 'error');
      return;
    }

    showToast(data.message || 'Teacher approved successfully.', 'success');
    const filterSelect = document.getElementById('admin-request-filter');
    loadAdminTeacherRequests(filterSelect ? filterSelect.value : 'pending');
  } catch (err) {
    console.error(err);
    showToast('Failed to approve teacher request.', 'error');
  }
}

async function adminRejectTeacher(userId, userName) {
  if (!confirm(`Reject teacher access for ${userName || 'this user'}?`)) return;

  try {
    const res = await fetch(`/api/admin/teacher-requests/${userId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to reject teacher request.', 'error');
      return;
    }

    showToast(data.message || 'Teacher request rejected.', 'info');
    const filterSelect = document.getElementById('admin-request-filter');
    loadAdminTeacherRequests(filterSelect ? filterSelect.value : 'pending');
  } catch (err) {
    console.error(err);
    showToast('Failed to reject teacher request.', 'error');
  }
}

// ================= ADMIN LOGIN HISTORY MONITORING =================
let adminLoginSearchTimeout = null;

function handleAdminLoginSearch() {
  clearTimeout(adminLoginSearchTimeout);
  adminLoginSearchTimeout = setTimeout(() => {
    const roleFilter = document.getElementById('admin-login-role-filter') ? document.getElementById('admin-login-role-filter').value : 'all';
    const searchQuery = document.getElementById('admin-login-search') ? document.getElementById('admin-login-search').value : '';
    loadAdminLoginHistory(roleFilter, searchQuery);
  }, 250);
}

function formatLoginRelativeTime(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const date = new Date(cleanStr);
    const now = new Date();
    const diffSecs = Math.floor((now - date) / 1000);

    if (isNaN(diffSecs) || diffSecs < 60) return 'Just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

function formatLoginFullDateTime(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const date = new Date(cleanStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

async function loadAdminLoginHistory(roleFilter = 'all', searchQuery = '') {
  const container = document.getElementById('admin-logins-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--color-blue-bright);"></i>
      <p>Loading teacher and student login timestamps...</p>
    </div>
  `;

  try {
    let url = `/api/admin/login-history?role=${encodeURIComponent(roleFilter)}`;
    if (searchQuery && searchQuery.trim()) {
      url += `&search=${encodeURIComponent(searchQuery.trim())}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      container.innerHTML = `<div class="card" style="color: var(--color-rose); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${err.error || 'Failed to load login history.'}</div>`;
      return;
    }

    const data = await res.json();
    const logins = data.logins || [];
    const stats = data.stats || {};

    // Update Quick Metric Cards
    const totalEl = document.getElementById('admin-login-stat-total');
    const teachersEl = document.getElementById('admin-login-stat-teachers');
    const studentsEl = document.getElementById('admin-login-stat-students');
    if (totalEl) totalEl.textContent = stats.totalLogins !== undefined ? stats.totalLogins : logins.length;
    if (teachersEl) teachersEl.textContent = stats.activeTeachers !== undefined ? stats.activeTeachers : 0;
    if (studentsEl) studentsEl.textContent = stats.activeStudents !== undefined ? stats.activeStudents : 0;

    if (logins.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem; color: var(--text-muted); border: 1px dashed var(--border-blue);">
          <i class="fa-solid fa-user-clock" style="font-size: 2.5rem; color: var(--color-blue-bright); margin-bottom: 1rem; display: block;"></i>
          <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No Login Records Found</h3>
          <p style="font-size: 0.9rem;">No teacher or student sign-in activity matches the selected criteria.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        ${logins.map(item => {
          const initials = item.userName ? item.userName.slice(0, 2).toUpperCase() : 'US';
          const relativeTime = formatLoginRelativeTime(item.loginTime);
          const fullTime = formatLoginFullDateTime(item.loginTime);

          let roleBadge = '';
          let avatarGradient = 'linear-gradient(135deg, var(--color-cyan), var(--color-blue-bright))';

          if (item.role === 'teacher') {
            roleBadge = `<span style="background: rgba(124, 58, 237, 0.15); color: #8b5cf6; border: 1px solid rgba(124, 58, 237, 0.3); font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-chalkboard-user"></i> Teacher</span>`;
            avatarGradient = 'linear-gradient(135deg, #7c3aed, #4f46e5)';
          } else if (item.role === 'admin') {
            roleBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-shield-halved"></i> Admin</span>`;
            avatarGradient = 'linear-gradient(135deg, #f59e0b, #ea580c)';
          } else {
            roleBadge = `<span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; border: 1px solid rgba(2, 132, 199, 0.3); font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-graduation-cap"></i> Student</span>`;
          }

          let deviceName = 'Browser Session';
          const ua = item.userAgent || '';
          if (ua.includes('Windows')) deviceName = 'Windows PC';
          else if (ua.includes('Macintosh') || ua.includes('Mac OS')) deviceName = 'macOS Device';
          else if (ua.includes('iPhone') || ua.includes('iPad')) deviceName = 'Apple iOS';
          else if (ua.includes('Android')) deviceName = 'Android Device';
          else if (ua.includes('Linux')) deviceName = 'Linux PC';

          return `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.15rem 1.4rem; border-radius: var(--radius-lg); flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: ${avatarGradient}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.05rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  ${initials}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <strong style="font-size: 1.02rem; color: var(--text-main);">${item.userName}</strong>
                    ${roleBadge}
                    <span style="display: inline-flex; align-items: center; gap: 5px; color: var(--color-emerald); font-size: 0.76rem; font-weight: 700; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.25);">
                      <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-emerald); box-shadow: 0 0 6px var(--color-emerald);"></span>
                      Logged In
                    </span>
                  </div>
                  <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 3px;">
                    <i class="fa-solid fa-envelope" style="font-size: 0.75rem; margin-right: 4px;"></i>${item.userEmail}
                    &bull; <span style="font-size: 0.8rem;"><i class="fa-solid fa-network-wired" style="font-size: 0.75rem; margin-right: 3px;"></i>${item.ipAddress} (${deviceName})</span>
                  </div>
                </div>
              </div>

              <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-clock" style="color: var(--color-blue-bright); font-size: 0.85rem;"></i>
                  <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${fullTime}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                  <span style="background: rgba(37, 99, 235, 0.08); padding: 2px 7px; border-radius: 4px; font-weight: 600; color: var(--color-blue-bright);">${relativeTime}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Error loading login history:', err);
    container.innerHTML = `<div class="card" style="color: var(--color-rose); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Network error loading login history.</div>`;
  }
}


