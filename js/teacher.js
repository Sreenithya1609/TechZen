/* FlashLearn Enterprise Faculty Admin Portal Logic */

let activeCourseId = null;
let activeCourseSubTab = 'roster'; // 'roster' or 'curriculum'
let activeAnalyticsTimeframe = '30d'; // '7d', '30d', 'all'

// Render Faculty Executive Dashboard
function renderTeacherDashboard(timeframe = activeAnalyticsTimeframe) {
  activeAnalyticsTimeframe = timeframe;
  const classrooms = state.data.classrooms || [];
  const decks = state.data.decks || [];

  // Calculate Aggregates
  const totalClasses = classrooms.length;
  let totalStudents = 0;
  let totalMarks = 0;
  let totalSubmissions = 0;

  classrooms.forEach(cls => {
    if (cls.enrolledStudents) {
      totalStudents += cls.enrolledStudents.length;
      cls.enrolledStudents.forEach(st => {
        totalMarks += st.mark;
        totalSubmissions++;
      });
    }
  });

  const avgPerformance = totalSubmissions > 0 ? Math.round(totalMarks / totalSubmissions) : 84;

  // Update KPI counters
  const totalClassesEl = document.getElementById('stat-total-classes');
  const totalStudentsEl = document.getElementById('stat-total-students');
  const totalDecksEl = document.getElementById('stat-total-decks');
  const avgPerfEl = document.getElementById('stat-avg-performance');

  if (totalClassesEl) totalClassesEl.textContent = totalClasses;
  if (totalStudentsEl) totalStudentsEl.textContent = totalStudents;
  if (totalDecksEl) totalDecksEl.textContent = decks.length;
  if (avgPerfEl) avgPerfEl.textContent = `${avgPerformance}%`;

  // Render Visual Analytics Studio
  const analyticsContainer = document.getElementById('dashboard-analytics-container');
  if (analyticsContainer) {
    const accuracy = avgPerformance;
    const progressDegree = Math.round((accuracy / 100) * 360);

    // Dynamic curve points based on selected timeframe
    let pathD = "M 0,130 C 80,120 120,95 200,90 C 280,85 320,50 400,42 C 450,38 480,25 500,20";
    let fillD = "M 0,130 C 80,120 120,95 200,90 C 280,85 320,50 400,42 C 450,38 480,25 500,20 L 500,150 L 0,150 Z";
    let growthBadge = "+14.2% Growth";
    let labels = ["Week 1 (Baseline)", "Week 2 (Recall)", "Week 3 (Interval)", "Week 4 (Mastery 94%)"];

    if (timeframe === '7d') {
      pathD = "M 0,110 C 80,105 150,80 250,75 C 350,70 420,35 500,25";
      fillD = "M 0,110 C 80,105 150,80 250,75 C 350,70 420,35 500,25 L 500,150 L 0,150 Z";
      growthBadge = "+8.6% This Week";
      labels = ["Mon", "Wed", "Fri", "Sun (96%)"];
    } else if (timeframe === 'all') {
      pathD = "M 0,140 C 100,130 180,100 280,70 C 380,50 450,30 500,15";
      fillD = "M 0,140 C 100,130 180,100 280,70 C 380,50 450,30 500,15 L 500,150 L 0,150 Z";
      growthBadge = "+26.8% All-Time";
      labels = ["Semester Start", "Midterm", "Interval Cycles", "Final Benchmark (98%)"];
    }

    analyticsContainer.innerHTML = `
      <!-- Executive Welcome Hero Banner -->
      <div class="portal-hero-banner portal-hero-faculty">
        <div>
          <div class="portal-hero-kicker">
            <i class="fa-solid fa-graduation-cap"></i>
            <span>Academic Faculty Command Center</span>
          </div>
          <h2 class="portal-hero-title">Welcome back, Professor ${state.data.currentUser ? state.data.currentUser.name : 'Faculty'}</h2>
          <p class="portal-hero-desc">Monitor real-time cohort retention curves, distribute AI-synthesized modules, and review student mastery benchmarks.</p>
        </div>
        <div class="portal-hero-actions">
          <button class="btn btn-secondary" onclick="openModal('modal-create-classroom')" style="background: rgba(255,255,255,0.15); color: #ffffff; border-color: rgba(255,255,255,0.25);">
            <i class="fa-solid fa-plus"></i> New Course
          </button>
          <button class="btn btn-primary" onclick="switchTab('teacher-ai')" style="background: #ffffff; color: var(--color-blue-dark); box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI Generator
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-top: 1.5rem;" class="teacher-analytics-grid">
        
        <!-- Cohort Retention & Performance Trend Line -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 1.75rem; box-shadow: var(--shadow-main);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chart-line" style="color: var(--color-blue-bright);"></i>
                <span>Cohort Retention Curve (Active Recall Index)</span>
              </h3>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">Weekly spaced repetition accuracy trend across active courses</p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="timeframe-pill-group">
                <button class="timeframe-pill ${timeframe === '7d' ? 'active' : ''}" onclick="renderTeacherDashboard('7d')">7D</button>
                <button class="timeframe-pill ${timeframe === '30d' ? 'active' : ''}" onclick="renderTeacherDashboard('30d')">30D</button>
                <button class="timeframe-pill ${timeframe === 'all' ? 'active' : ''}" onclick="renderTeacherDashboard('all')">All</button>
              </div>
              <span class="card-badge" style="background: rgba(5, 150, 105, 0.1); color: var(--color-emerald);">
                <i class="fa-solid fa-arrow-trend-up"></i> ${growthBadge}
              </span>
            </div>
          </div>

          <div style="width: 100%; height: 180px; position: relative; margin-top: 1rem;">
            <svg viewBox="0 0 500 160" style="width: 100%; height: 100%; overflow: visible;">
              <defs>
                <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--color-blue-bright)" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="var(--color-blue-bright)" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="30" x2="500" y2="30" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
              
              <path d="${fillD}" fill="url(#curveGrad)" />
              <path d="${pathD}" fill="none" stroke="var(--color-blue-bright)" stroke-width="3.5" stroke-linecap="round" />
              
              <circle cx="0" cy="130" r="4.5" fill="var(--color-blue-bright)" stroke="var(--bg-card)" stroke-width="2"/>
              <circle cx="200" cy="90" r="4.5" fill="var(--color-blue-bright)" stroke="var(--bg-card)" stroke-width="2"/>
              <circle cx="400" cy="42" r="4.5" fill="var(--color-blue-bright)" stroke="var(--bg-card)" stroke-width="2"/>
              <circle cx="500" cy="20" r="5.5" fill="var(--color-emerald)" stroke="var(--bg-card)" stroke-width="2.5"/>
            </svg>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-subtle); margin-top: 6px;">
              <span>${labels[0]}</span>
              <span>${labels[1]}</span>
              <span>${labels[2]}</span>
              <span style="font-weight: 700; color: var(--color-emerald);">${labels[3]}</span>
            </div>
          </div>
        </div>

        <!-- Cohort Mastery Distribution Donut -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 1.75rem; box-shadow: var(--shadow-main); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">
              <i class="fa-solid fa-chart-pie" style="color: var(--color-purple); margin-right: 6px;"></i> Mastery Status
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Cohort retention breakdown</p>
          </div>

          <div style="display: flex; justify-content: center; align-items: center; margin: 1rem 0;">
            <div class="css-donut-chart" style="background: conic-gradient(var(--color-blue-bright) 0deg ${progressDegree}deg, var(--border-subtle) ${progressDegree}deg 360deg);">
              <div style="position: relative; z-index: 1; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); line-height: 1;">${accuracy}%</div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Average</div>
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);">
              <span><i class="fa-solid fa-circle" style="color: var(--color-blue-bright); font-size: 0.6rem; margin-right: 6px;"></i>Mastered Concepts</span>
              <strong style="color: var(--text-main);">${Math.max(1, Math.round(totalStudents * 0.75))} Students</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);">
              <span><i class="fa-solid fa-circle" style="color: var(--color-amber); font-size: 0.6rem; margin-right: 6px;"></i>Active Review Queue</span>
              <strong style="color: var(--text-main);">${Math.max(1, totalStudents - Math.round(totalStudents * 0.75))} Students</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Real-Time Activity Feed -->
      <div class="activity-feed-card" style="margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-clock-rotate-left" style="color: var(--color-blue-bright);"></i>
            <span>Live Student Practice Stream</span>
          </h3>
          <span style="font-size: 0.78rem; font-weight: 700; color: var(--color-emerald); display: flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> Live Stream
          </span>
        </div>

        <div class="activity-feed-list">
          <div class="activity-item">
            <div class="activity-item-left">
              <div class="activity-icon green">
                <i class="fa-solid fa-circle-check"></i>
              </div>
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-main);">Scholar Alex Chen</strong>
                <span style="font-size: 0.82rem; color: var(--text-muted);"> completed <em>Distributed Systems 201</em> deck with <strong>96% accuracy</strong></span>
              </div>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-subtle); font-family: var(--font-mono);">2 mins ago</span>
          </div>

          <div class="activity-item">
            <div class="activity-item-left">
              <div class="activity-icon blue">
                <i class="fa-solid fa-bolt"></i>
              </div>
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-main);">Scholar Eleanor Vance</strong>
                <span style="font-size: 0.82rem; color: var(--text-muted);"> achieved a <strong>5-day study streak</strong></span>
              </div>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-subtle); font-family: var(--font-mono);">14 mins ago</span>
          </div>

          <div class="activity-item">
            <div class="activity-item-left">
              <div class="activity-icon purple">
                <i class="fa-solid fa-user-plus"></i>
              </div>
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-main);">Scholar Marcus Aurelius</strong>
                <span style="font-size: 0.82rem; color: var(--text-muted);"> enrolled in <em>Cognitive Neuroscience</em> via code</span>
              </div>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-subtle); font-family: var(--font-mono);">1 hour ago</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Render Teacher Course Curriculum & Rosters Panel
function renderMyClassesPanel(searchFilter = '') {
  const container = document.getElementById('myclasses-grid');
  if (!container) return;

  const classrooms = state.data.classrooms || [];
  const query = searchFilter.toLowerCase().trim();

  const filtered = classrooms.filter(c => {
    return c.name.toLowerCase().includes(query) ||
           c.subject.toLowerCase().includes(query) ||
           c.code.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Matching Courses Found</h3>
        <p style="margin-bottom: 1.5rem;">Try adjusting your search query or create a new classroom.</p>
        <button class="btn btn-primary" onclick="openModal('modal-create-classroom')">
          <i class="fa-solid fa-plus"></i> Create Course
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(cls => {
    const studentCount = cls.enrolledStudents ? cls.enrolledStudents.length : 0;
    const isSelected = activeCourseId === cls.id;

    const avg = studentCount > 0 
      ? Math.round(cls.enrolledStudents.reduce((acc, s) => acc + s.mark, 0) / studentCount)
      : 84;

    return `
      <div class="course-modern-card ${isSelected ? 'selected' : ''}" style="${isSelected ? 'border-color: var(--color-blue-bright); box-shadow: var(--shadow-hover);' : ''}">
        <div class="course-card-top">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <span class="card-badge">${cls.subject}</span>
            <span class="code-pill" onclick="copyClassCode('${cls.code}')" title="Click to copy access code">
              <i class="fa-solid fa-key"></i>
              <span>${cls.code}</span>
              <i class="fa-regular fa-copy" style="font-size: 0.75rem;"></i>
            </span>
          </div>
          <h3 class="card-title">${cls.name}</h3>
          <p class="card-desc">Instructor: ${cls.teacher}</p>
        </div>

        <div class="course-card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: var(--bg-card-subtle); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Scholars</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">
                <i class="fa-solid fa-users" style="color: var(--color-blue-bright); font-size: 0.9rem; margin-right: 4px;"></i>${studentCount}
              </div>
            </div>
            <div style="background: var(--bg-card-subtle); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Class Mastery</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--color-emerald); margin-top: 2px;">
                ${avg}%
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; font-size: 0.85rem; padding: 8px 12px;" onclick="selectCourseForDetail('${cls.id}')">
              <i class="fa-solid fa-users-viewfinder"></i>
              <span>${isSelected ? 'Viewing Course' : 'Manage Course'}</span>
            </button>
            <button class="btn btn-danger" style="padding: 8px 12px; font-size: 0.85rem;" onclick="deleteClassroomDirect('${cls.id}')" title="Delete Course">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (activeCourseId) {
    renderSelectedCourseDetails(activeCourseId);
  } else if (filtered.length > 0) {
    selectCourseForDetail(filtered[0].id);
  }
}

function selectCourseForDetail(classId) {
  activeCourseId = classId;
  renderMyClassesPanel();
  renderSelectedCourseDetails(classId);
}

function setCourseSubTab(tabName) {
  activeCourseSubTab = tabName;
  if (activeCourseId) {
    renderSelectedCourseDetails(activeCourseId);
  }
}

function renderSelectedCourseDetails(classId) {
  const detailContainer = document.getElementById('myclasses-course-detail');
  if (!detailContainer) return;

  const cls = (state.data.classrooms || []).find(c => c.id === classId);
  if (!cls) {
    detailContainer.innerHTML = '';
    return;
  }

  const enrolled = cls.enrolledStudents || [];
  const decks = cls.decks || [];

  detailContainer.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-main);">
      
      <!-- Detail Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); margin-bottom: 1.5rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="card-badge">${cls.subject}</span>
            <span class="code-pill" onclick="copyClassCode('${cls.code}')">
              <i class="fa-solid fa-key"></i> Code: ${cls.code}
            </span>
          </div>
          <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">${cls.name}</h2>
          <p style="font-size: 0.88rem; color: var(--text-muted);">Instructor: <strong>${cls.teacher}</strong> | Cohort Enrollment: <strong>${enrolled.length} Scholars</strong></p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="openCreateDeckForClassModal('${cls.id}')">
            <i class="fa-solid fa-plus"></i> Add Course Deck
          </button>
        </div>
      </div>

      <!-- Course Sub-Tabs Switcher -->
      <div class="course-detail-tabs">
        <button class="course-tab-btn ${activeCourseSubTab === 'roster' ? 'active' : ''}" onclick="setCourseSubTab('roster')">
          <i class="fa-solid fa-user-graduate"></i>
          <span>Scholar Rosters (${enrolled.length})</span>
        </button>
        <button class="course-tab-btn ${activeCourseSubTab === 'curriculum' ? 'active' : ''}" onclick="setCourseSubTab('curriculum')">
          <i class="fa-solid fa-layer-group"></i>
          <span>Curriculum Modules (${decks.length})</span>
        </button>
      </div>

      <!-- Tab Content 1: Roster -->
      ${activeCourseSubTab === 'roster' ? `
        <div>
          ${enrolled.length === 0 ? `
            <div style="text-align: center; padding: 2.5rem; background: var(--bg-card-subtle); border-radius: var(--radius-lg); color: var(--text-muted); border: 1px dashed var(--border-subtle);">
              <i class="fa-solid fa-users-slash" style="font-size: 2.2rem; color: var(--text-subtle); margin-bottom: 8px;"></i>
              <h4 style="color: var(--text-main); margin-bottom: 4px;">No Scholars Enrolled Yet</h4>
              <p>Share course access code <strong>${cls.code}</strong> with your cohort to begin tracking mastery.</p>
            </div>
          ` : `
            <div class="roster-table-wrapper">
              <table class="roster-table">
                <thead>
                  <tr>
                    <th class="roster-th">Scholar Name</th>
                    <th class="roster-th">Email Address</th>
                    <th class="roster-th">Mastery Accuracy</th>
                    <th class="roster-th">Completed Decks</th>
                    <th class="roster-th" style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${enrolled.map(st => `
                    <tr>
                      <td class="roster-td">
                        <div class="roster-avatar-cell">
                          <div class="roster-avatar-circle">
                            ${st.name ? st.name.slice(0, 2).toUpperCase() : 'ST'}
                          </div>
                          <strong>${st.name}</strong>
                        </div>
                      </td>
                      <td class="roster-td" style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.85rem;">
                        ${st.email}
                      </td>
                      <td class="roster-td">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <strong style="color: var(--color-blue-bright); width: 35px;">${st.mark}%</strong>
                          <div class="progress-bar-bg" style="width: 120px;">
                            <div class="progress-bar-fill" style="width: ${st.mark}%;"></div>
                          </div>
                        </div>
                      </td>
                      <td class="roster-td">
                        <span class="card-badge" style="background: rgba(5, 150, 105, 0.1); color: var(--color-emerald);">
                          <i class="fa-solid fa-circle-check"></i> ${st.completedDecks} Decks Done
                        </span>
                      </td>
                      <td class="roster-td" style="text-align: right;">
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="openStudentReportModal('${st.id}')">
                          <i class="fa-solid fa-chart-user"></i> Report
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      ` : `
        <!-- Tab Content 2: Curriculum Modules -->
        <div>
          ${decks.length === 0 ? `
            <div style="text-align: center; padding: 2.5rem; background: var(--bg-card-subtle); border-radius: var(--radius-lg); color: var(--text-muted); border: 1px dashed var(--border-subtle);">
              <i class="fa-solid fa-book-open" style="font-size: 2.2rem; color: var(--text-subtle); margin-bottom: 8px;"></i>
              <h4 style="color: var(--text-main); margin-bottom: 4px;">No Flashcard Modules Published</h4>
              <p>Add flashcard decks to this course to give students active recall practice material.</p>
              <button class="btn btn-primary" style="margin-top: 1rem;" onclick="openCreateDeckForClassModal('${cls.id}')">
                <i class="fa-solid fa-plus"></i> Add First Module
              </button>
            </div>
          ` : `
            <div class="grid-cards">
              ${decks.map(deck => `
                <div class="card">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                      <span class="card-badge">${deck.subject || cls.subject}</span>
                      <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-subtle);">
                        <i class="fa-solid fa-layer-group"></i> ${deck.cards ? deck.cards.length : 0} Cards
                      </span>
                    </div>
                    <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">${deck.title}</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Creator: ${deck.creator || 'Faculty'}</p>
                  </div>

                  <div style="display: flex; gap: 8px; margin-top: 1.25rem;">
                    <button class="btn btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 7px;" onclick="openEditDeckModal('${deck.id}')">
                      <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-primary" style="flex: 1; font-size: 0.85rem; padding: 7px;" onclick="launchStudySession('${deck.id}')">
                      <i class="fa-solid fa-play"></i> Practice
                    </button>
                    <button class="btn btn-danger" style="padding: 7px 10px; font-size: 0.85rem;" onclick="deleteDeckDirect('${deck.id}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

function copyClassCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Access code ${code} copied to clipboard!`, 'info');
  }).catch(() => {
    showToast(`Access code: ${code}`, 'info');
  });
}

function openCreateDeckForClassModal(classId) {
  switchTab('teacher-ai');
  showToast('Use AI Generator or Manual Builder to create flashcards for this course.', 'info');
}

// Render Teacher Classrooms Grid
function renderTeacherClassrooms() {
  const container = document.getElementById('teacher-classrooms-grid');
  if (!container) return;

  const classrooms = state.data.classrooms || [];

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-school" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 8px;">No Classrooms Active</h3>
        <p style="margin-bottom: 1.5rem;">Create a classroom to publish curricula and manage cohorts.</p>
        <button class="btn btn-primary" onclick="openModal('modal-create-classroom')">
          <i class="fa-solid fa-plus"></i> Create Classroom
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = classrooms.map(cls => {
    const studentCount = cls.enrolledStudents ? cls.enrolledStudents.length : 0;
    const deckCount = cls.decks ? cls.decks.length : 0;

    return `
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
            <span class="code-pill" onclick="copyClassCode('${cls.code}')">
              <i class="fa-solid fa-key"></i> Code: ${cls.code}
            </span>
          </div>
        </div>

        <div>
          <div class="card-meta">
            <div class="card-meta-item">
              <i class="fa-solid fa-users"></i>
              <span>${studentCount} Scholars</span>
            </div>
            <div class="card-meta-item">
              <i class="fa-solid fa-layer-group"></i>
              <span>${deckCount} Modules</span>
            </div>
          </div>

          <div style="margin-top: 1.25rem; display: flex; gap: 8px;">
            <button class="btn btn-primary" style="flex: 1; justify-content: center;" onclick="selectCourseForDetail('${cls.id}'); switchTab('teacher-myclasses');">
              <i class="fa-solid fa-book-open"></i> Manage Course
            </button>
            <button class="btn btn-danger" style="padding: 8px 12px;" onclick="deleteClassroomDirect('${cls.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCreateClassroom(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-class-name');
  const subjectInput = document.getElementById('new-class-subject');

  const name = nameInput.value.trim();
  const subject = subjectInput.value.trim();

  if (!name || !subject) {
    showToast('Please fill in both course name and subject.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to create classroom.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    renderTeacherDashboard();
    renderMyClassesPanel();
    renderTeacherClassrooms();
    closeModal('modal-create-classroom');
    showToast(`Created "${name}" with generated access code!`, 'success');

    nameInput.value = '';
    subjectInput.value = '';
  } catch (e) {
    console.error(e);
    showToast('An error occurred creating classroom.', 'error');
  }
}

async function deleteClassroomDirect(classroomId) {
  if (!confirm('Are you sure you want to delete this classroom course?')) return;

  try {
    const res = await fetch(`/api/classrooms/${classroomId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to delete classroom.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    if (activeCourseId === classroomId) activeCourseId = null;

    renderTeacherDashboard();
    renderMyClassesPanel();
    renderTeacherClassrooms();
    showToast('Classroom deleted successfully.', 'info');
  } catch (e) {
    console.error(e);
    showToast('An error occurred deleting classroom.', 'error');
  }
}

/* AI Generator Logic */
function setAIPresetTopic(topicText) {
  const input = document.getElementById('ai-topic-input');
  if (input) input.value = topicText;
}

async function handleAIFlashcardGenerate(event) {
  event.preventDefault();
  const topicInput = document.getElementById('ai-topic-input');
  const countInput = document.getElementById('ai-count-input');
  const levelSelect = document.getElementById('ai-level-select');
  const resultContainer = document.getElementById('ai-generated-result');
  const generateBtn = document.getElementById('ai-generate-btn');

  const topic = topicInput.value.trim();
  const count = parseInt(countInput.value) || 5;
  const level = levelSelect.value;

  if (!topic) {
    showToast('Please enter an academic subject topic.', 'error');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Concept Flashcards...';

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count, level })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'AI generation failed.', 'error');
      return;
    }

    const generatedCards = data.cards;

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-blue); padding: 1.75rem; border-radius: var(--radius-xl); margin-top: 1.75rem; box-shadow: var(--shadow-main);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 style="color: var(--color-blue-bright); font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-sparkles"></i>
              <span>Generated ${generatedCards.length} Academic Flashcards</span>
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Topic: <strong>${topic}</strong> (${level})</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; max-height: 340px; overflow-y: auto;">
          ${generatedCards.map((c, idx) => `
            <div style="background: var(--bg-card-subtle); padding: 1.15rem; border-radius: var(--radius-md); border-left: 3.5px solid var(--color-blue-bright);">
              <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px; font-size: 0.95rem;">Q${idx + 1}: ${c.question}</div>
              <div style="color: var(--text-muted); font-size: 0.9rem;">A: ${c.answer}</div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <select id="ai-target-classroom-select" class="select-field" style="width: auto; flex: 1; min-width: 200px;">
            <option value="">-- Save to Standalone Decks --</option>
            ${(state.data.classrooms || []).map(cls => `
              <option value="${cls.id}">Publish to: ${cls.name}</option>
            `).join('')}
          </select>
          <button class="btn btn-primary" onclick="saveAIGeneratedDeck('${topic.replace(/'/g, "\\'")}', ${JSON.stringify(generatedCards).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Save & Publish Deck</span>
          </button>
        </div>
      </div>
    `;

    showToast(`Synthesized ${generatedCards.length} flashcards successfully!`, 'success');
  } catch (e) {
    console.error(e);
    showToast('An error occurred during AI generation.', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fa-solid fa-bolt"></i><span>Generate Flashcards</span>';
  }
}

async function saveAIGeneratedDeck(title, cards) {
  const select = document.getElementById('ai-target-classroom-select');
  const classroomId = select ? select.value : '';

  try {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subject: 'AI Generated',
        cards,
        classroom_id: classroomId || null
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to save generated deck.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    renderTeacherDashboard();
    renderMyClassesPanel();
    showToast(`Deck "${title}" saved and published!`, 'success');

    if (classroomId) {
      switchTab('teacher-myclasses');
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred saving deck.', 'error');
  }
}

/* Edit Deck Logic */
let activeEditingDeckId = null;

function openEditDeckModal(deckId) {
  activeEditingDeckId = deckId;
  const deck = (state.data.decks || []).find(d => d.id === deckId);
  if (!deck) return;

  const titleInput = document.getElementById('edit-deck-title');
  const subjectInput = document.getElementById('edit-deck-subject');
  const container = document.getElementById('edit-deck-cards-container');

  if (titleInput) titleInput.value = deck.title;
  if (subjectInput) subjectInput.value = deck.subject;

  if (container) {
    container.innerHTML = (deck.cards || []).map((c, idx) => `
      <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--color-blue-bright);">Card #${idx + 1}</span>
        <input type="text" class="input-field edit-q" value="${c.question.replace(/"/g, '&quot;')}" placeholder="Question Front..." />
        <input type="text" class="input-field edit-a" value="${c.answer.replace(/"/g, '&quot;')}" placeholder="Answer Back..." />
      </div>
    `).join('');
  }

  openModal('modal-edit-deck');
}

async function handleSaveEditedDeck(event) {
  event.preventDefault();
  if (!activeEditingDeckId) return;

  const title = document.getElementById('edit-deck-title').value.trim();
  const subject = document.getElementById('edit-deck-subject').value.trim();

  const qInputs = document.querySelectorAll('.edit-q');
  const aInputs = document.querySelectorAll('.edit-a');

  const cards = [];
  qInputs.forEach((q, idx) => {
    const qVal = q.value.trim();
    const aVal = aInputs[idx] ? aInputs[idx].value.trim() : '';
    if (qVal && aVal) cards.push({ question: qVal, answer: aVal });
  });

  if (!title || cards.length === 0) {
    showToast('Please provide a title and at least one card.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/decks/${activeEditingDeckId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, cards })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to update deck.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    renderTeacherDashboard();
    renderMyClassesPanel();
    if (typeof renderStudentDecks === 'function') renderStudentDecks();

    closeModal('modal-edit-deck');
    showToast('Deck updated successfully!', 'success');
  } catch (e) {
    console.error(e);
    showToast('An error occurred updating deck.', 'error');
  }
}

/* Student Report Modal */
async function openStudentReportModal(studentId) {
  const content = document.getElementById('student-report-content');
  if (!content) return;

  content.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
  openModal('modal-student-report');

  try {
    const res = await fetch(`/api/students/${studentId}/progress`);
    if (!res.ok) {
      const err = await res.json();
      content.innerHTML = `<div style="color: var(--color-rose); padding: 1rem;">${err.error || 'Failed to load student progress report.'}</div>`;
      return;
    }

    const report = await res.json();

    content.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle);">
          <div class="user-avatar-large">
            ${report.student_name ? report.student_name.slice(0, 2).toUpperCase() : 'ST'}
          </div>
          <div>
            <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main);">${report.student_name}</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted);">${report.student_email}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Average Mastery</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-blue-bright); margin-top: 2px;">${report.average_mark}%</div>
          </div>
          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Completed Decks</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-emerald); margin-top: 2px;">${report.completed_decks}</div>
          </div>
          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Enrolled Courses</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-purple); margin-top: 2px;">${report.enrolled_classes.length}</div>
          </div>
        </div>

        <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">Enrolled Course Breakdown</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${report.enrolled_classes.map(c => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card-subtle); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div>
                <strong>${c.name}</strong>
                <span class="card-badge" style="margin-left: 8px; font-size: 0.7rem;">${c.subject}</span>
              </div>
              <strong style="color: var(--color-blue-bright);">${c.mark}%</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    content.innerHTML = '<div style="color: var(--color-rose); padding: 1rem;">An error occurred loading report.</div>';
  }
}
