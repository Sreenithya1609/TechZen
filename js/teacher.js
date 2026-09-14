/* FlashLearn Enterprise Faculty Admin Portal Logic */

let activeCourseId = null;
let activeCourseSubTab = 'roster'; // 'roster' or 'curriculum'
let activeAnalyticsTimeframe = '30d'; // '7d', '30d', 'all'

// Render Faculty Executive Dashboard
function renderTeacherDashboard(timeframe = activeAnalyticsTimeframe) {
  activeAnalyticsTimeframe = timeframe;
  const classrooms = state.data.classrooms || [];
  const decks = state.data.decks || [];

  const welcomeEl = document.getElementById('teacher-welcome-name');
  if (welcomeEl && state.data.currentUser) {
    welcomeEl.textContent = `Hello, ${state.data.currentUser.name}!`;
  }

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

    // Get daily activity log from backend (past 30 days)
    const rawActivity = state.data.dailyActivity || [];
    let activityData = [];
    if (timeframe === '7d') {
      activityData = rawActivity.slice(-7);
    } else {
      activityData = rawActivity.slice(-30);
    }

    // Default placeholder data if no database activity exists
    if (activityData.length === 0) {
      activityData = Array.from({ length: timeframe === '7d' ? 7 : 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (timeframe === '7d' ? 6 - i : 29 - i));
        return {
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          count: 0
        };
      });
    }

    const counts = activityData.map(d => d.count);
    const maxCount = Math.max(1, ...counts);

    // Calculate dynamic coordinates (Y range [130, 20])
    const points = activityData.map((d, idx) => {
      const x = Math.round((idx / (activityData.length - 1)) * 500);
      const y = Math.round(130 - (d.count / maxCount) * 110);
      return { x, y, label: d.label, count: d.count };
    });

    let pathD = '';
    let fillD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x},${points[i].y}`;
      }
      fillD = `${pathD} L 500,150 L 0,150 Z`;
    }

    // Calculate growth percentage
    let growthBadge = '';
    if (points.length >= 2) {
      const firstHalf = counts.slice(0, Math.floor(counts.length / 2)).reduce((a, b) => a + b, 0);
      const secondHalf = counts.slice(Math.floor(counts.length / 2)).reduce((a, b) => a + b, 0);
      if (firstHalf === 0) {
        growthBadge = secondHalf > 0 ? `+${secondHalf} Daily Activity` : 'Stable Trend';
      } else {
        const growth = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
        growthBadge = growth >= 0 ? `+${growth}% Growth` : `${growth}% Decline`;
      }
    } else {
      growthBadge = 'Active Recalls Logged';
    }

    const circlesHTML = points.map((p, idx) => {
      const isLast = idx === points.length - 1;
      const radius = isLast ? 5.5 : 3.5;
      const fill = isLast ? 'var(--color-emerald)' : 'var(--color-blue-bright)';
      const sw = isLast ? 2.5 : 1.5;
      return `<circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${fill}" stroke="var(--bg-card)" stroke-width="${sw}"/>`;
    }).join('');

    const labelsHTML = `
      <span>${points[0].label}</span>
      <span>${points[Math.floor(points.length / 2)].label}</span>
      <span>${points[points.length - 1].label} (${points[points.length - 1].count} Active)</span>
    `;

    analyticsContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;" class="teacher-analytics-grid">
        
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
              <path d="${pathD}" fill="none" stroke="var(--color-blue-bright)" stroke-width="3" stroke-linecap="round" />
              
              ${circlesHTML}
            </svg>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-subtle); margin-top: 6px;">
              ${labelsHTML}
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
          ${(state.data.studentProgress || []).length === 0 ? `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.88rem;">
              No cohort practice activity recorded yet.
            </div>
          ` : (state.data.studentProgress || []).slice(0, 3).map((sp, idx) => {
            const timeLabels = ['Recently', 'Today', 'Yesterday'];
            const icons = ['fa-circle-check', 'fa-bolt', 'fa-user-graduate'];
            const iconColors = ['green', 'blue', 'purple'];
            
            const timeLabel = timeLabels[idx % timeLabels.length];
            const icon = icons[idx % icons.length];
            const colorClass = iconColors[idx % iconColors.length];

            const isWeak = sp.mark < 50 || (sp.overallAccuracy !== undefined && sp.overallAccuracy > 0 && sp.overallAccuracy < 50) || (sp.laggingSubjects && sp.laggingSubjects.length > 0);
            const nameColor = isWeak ? '#ef4444' : 'var(--text-main)';
            const weakBadge = isWeak ? `<span class="card-badge" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; font-size: 0.72rem; margin-left: 6px; padding: 2px 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Weak Topic (<50%)</span>` : '';

            return `
              <div class="activity-item" style="${isWeak ? 'border-left: 3px solid #ef4444;' : ''}">
                <div class="activity-item-left">
                  <div class="activity-icon ${isWeak ? 'red' : colorClass}">
                    <i class="fa-solid ${isWeak ? 'fa-triangle-exclamation' : icon}"></i>
                  </div>
                  <div>
                    <strong style="font-size: 0.9rem; color: ${nameColor};">${sp.name}</strong>${weakBadge}
                    <span style="font-size: 0.82rem; color: var(--text-muted);"> completed <strong>${sp.completedDecks}</strong> decks in <em>${sp.course}</em> with <strong style="${isWeak ? 'color: #ef4444;' : ''}">${sp.mark}%</strong> accuracy</span>
                  </div>
                </div>
                <span style="font-size: 0.78rem; color: var(--text-subtle); font-family: var(--font-mono);">${timeLabel}</span>
              </div>
            `;
          }).join('')}
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

    const avg = cls.avgPerformance !== undefined ? cls.avgPerformance : 0;
    const avgDisplay = avg > 0 ? `${avg}%` : 'No activity';

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
                ${avgDisplay}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto; flex-wrap: wrap;">
            <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; min-width: 110px; font-size: 0.85rem; padding: 8px 12px;" onclick="selectCourseForDetail('${cls.id}')">
              <i class="fa-solid fa-users-viewfinder"></i>
              <span>${isSelected ? 'Viewing' : 'Manage'}</span>
            </button>
            <button class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; background: rgba(124, 58, 237, 0.08); color: #7c3aed; border-color: rgba(124, 58, 237, 0.3);" onclick="openClassroomDiagnosis('${cls.id}', event)" title="AI Classroom Performance Diagnosis">
              <i class="fa-solid fa-stethoscope"></i>
              <span>Diagnosis</span>
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

async function openClassroomDiagnosis(classId, event) {
  if (event) event.stopPropagation();

  const cls = (state.data.classrooms || []).find(c => c.id === classId);
  const titleEl = document.getElementById('diagnosis-modal-title');
  if (titleEl) {
    titleEl.textContent = cls ? `Diagnosis: ${cls.name}` : 'Classroom Diagnosis';
  }

  const loadingEl = document.getElementById('diagnosis-loading');
  const contentEl = document.getElementById('diagnosis-content');

  if (loadingEl) loadingEl.style.display = 'block';
  if (contentEl) contentEl.style.display = 'none';

  openModal('modal-classroom-diagnosis');

  try {
    const res = await fetch(`/api/classrooms/${classId}/diagnosis`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to retrieve classroom diagnosis.', 'error');
      closeModal('modal-classroom-diagnosis');
      return;
    }

    const payload = data.data;
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    // Metrics
    const accEl = document.getElementById('diag-stat-accuracy');
    const stuEl = document.getElementById('diag-stat-students');
    const weakEl = document.getElementById('diag-stat-weak-students');
    if (accEl) accEl.textContent = `${payload.average_performance}%`;
    if (stuEl) stuEl.textContent = payload.total_students;
    if (weakEl) weakEl.textContent = payload.weak_students_count;

    // Strong Topics
    const strongListEl = document.getElementById('diag-strong-topics-list');
    if (strongListEl) {
      if (!payload.strong_topics || payload.strong_topics.length === 0) {
        strongListEl.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted);">No topics exceeding 75% yet.</div>';
      } else {
        strongListEl.innerHTML = payload.strong_topics.map(t => `
          <div style="font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; background: rgba(16, 185, 129, 0.08); padding: 4px 8px; border-radius: 4px;">
            <span>✓ ${escapeHtml(t.topic)}</span>
            <strong style="color: #059669;">${t.accuracy}%</strong>
          </div>
        `).join('');
      }
    }

    // Needs Improvement Topics
    const weakListEl = document.getElementById('diag-weak-topics-list');
    if (weakListEl) {
      if (!payload.needs_improvement || payload.needs_improvement.length === 0) {
        weakListEl.innerHTML = '<div style="font-size: 0.8rem; color: #059669; padding: 4px 0;"><i class="fa-solid fa-check"></i> All active topics meet mastery standards!</div>';
      } else {
        weakListEl.innerHTML = payload.needs_improvement.map(t => `
          <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 2px; background: rgba(239, 68, 68, 0.08); padding: 6px 8px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>⚠ ${escapeHtml(t.topic)}</span>
              <strong style="color: #dc2626;">${t.accuracy}%</strong>
            </div>
            ${t.challenging_concepts && t.challenging_concepts.length > 0 ? `
              <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">
                Stumbling points: ${escapeHtml(t.challenging_concepts.join(', '))}
              </span>
            ` : ''}
          </div>
        `).join('');
      }
    }

    // AI Diagnosis and Recommendations
    const aiDiag = payload.ai_diagnosis || {};
    const diagTextEl = document.getElementById('diag-ai-text');
    const recTextEl = document.getElementById('diag-rec-text');
    const stepsEl = document.getElementById('diag-action-steps');

    if (diagTextEl) diagTextEl.textContent = aiDiag.diagnosis || 'Classroom performance analysis in progress.';
    if (recTextEl) recTextEl.textContent = aiDiag.recommendation || 'Continue regular study sessions.';
    if (stepsEl) {
      const steps = aiDiag.action_steps || [];
      stepsEl.innerHTML = steps.map(s => `<li>${escapeHtml(s)}</li>`).join('');
    }

  } catch (err) {
    console.error('Failed to load diagnosis', err);
    showToast('Failed to load classroom diagnosis.', 'error');
    closeModal('modal-classroom-diagnosis');
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
  const decks = (cls.decks || []).map(deckId => {
    return (state.data.decks || []).find(d => d.id === deckId);
  }).filter(Boolean);

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

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary" style="background: rgba(124, 58, 237, 0.08); color: #7c3aed; border-color: rgba(124, 58, 237, 0.3);" onclick="openClassroomDiagnosis('${cls.id}')">
            <i class="fa-solid fa-stethoscope"></i>
            <span>AI Diagnosis</span>
          </button>
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
                  ${enrolled.map(st => {
                    const isWeak = st.mark < 50;
                    const nameColor = isWeak ? '#ef4444' : 'var(--text-main)';
                    const weakTag = isWeak ? `<span class="card-badge" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; font-size: 0.72rem; margin-left: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Weak (<50%)</span>` : '';
                    return `
                    <tr>
                      <td class="roster-td">
                        <div class="roster-avatar-cell">
                          <div class="roster-avatar-circle" style="${isWeak ? 'background: rgba(239, 68, 68, 0.15); color: #ef4444;' : ''}">
                            ${st.name ? st.name.slice(0, 2).toUpperCase() : 'ST'}
                          </div>
                          <strong style="color: ${nameColor};">${st.name}</strong>${weakTag}
                        </div>
                      </td>
                      <td class="roster-td" style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.85rem;">
                        ${st.email}
                      </td>
                      <td class="roster-td">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <strong style="color: ${isWeak ? '#ef4444' : 'var(--color-blue-bright)'}; width: 35px;">${st.mark}%</strong>
                          <div class="progress-bar-bg" style="width: 120px;">
                            <div class="progress-bar-fill" style="width: ${st.mark}%; ${isWeak ? 'background: #ef4444;' : ''}"></div>
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
                    `;
                  }).join('')}
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

                  <div style="display: flex; gap: 8px; margin-top: 1.25rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary" style="flex: 1; font-size: 0.82rem; padding: 7px;" onclick="openEditDeckModal('${deck.id}')">
                      <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-primary" style="flex: 1.2; font-size: 0.82rem; padding: 7px;" onclick="generatePracticeQuiz('${deck.id}')" title="Generate AI multiple-choice practice quiz">
                      <i class="fa-solid fa-list-check"></i> Practice Quiz
                    </button>
                    <button class="btn btn-danger" style="padding: 7px 10px; font-size: 0.82rem;" onclick="deleteDeckDirect('${deck.id}')" title="Delete deck">
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
  state.aiTargetClassroomId = classId;
  switchTab('teacher-ai');
  showToast('Use AI Generator to create flashcards for this course.', 'info');
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
            <button class="btn btn-secondary" style="padding: 8px 12px; background: rgba(124, 58, 237, 0.08); color: #7c3aed; border-color: rgba(124, 58, 237, 0.3);" onclick="openClassroomDiagnosis('${cls.id}', event)" title="Classroom AI Performance Diagnosis">
              <i class="fa-solid fa-stethoscope"></i>
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

    const targetClassroomId = state.aiTargetClassroomId || '';
    state.aiTargetClassroomId = null; // reset

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
            <div class="ai-generated-card-row" style="background: var(--bg-card-subtle); padding: 1.15rem; border-radius: var(--radius-md); border-left: 3.5px solid var(--color-blue-bright); display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-blue-bright);">Card #${idx + 1}</span>
              <input type="text" class="input-field ai-card-q" value="${c.question.replace(/"/g, '&quot;')}" placeholder="Question Front..." style="width: 100%; font-weight: 700;" />
              <textarea class="input-field ai-card-a" placeholder="Answer Back..." style="width: 100%; font-family: inherit; font-size: 0.9rem; resize: vertical; min-height: 60px;">${c.answer}</textarea>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <select id="ai-target-classroom-select" class="select-field" style="width: auto; flex: 1; min-width: 200px;" onchange="updateAISubjectTagFromClassroom(this)">
            <option value="">-- Save to Standalone Decks --</option>
            ${(state.data.classrooms || []).map(cls => `
              <option value="${cls.id}" ${cls.id === targetClassroomId ? 'selected' : ''}>Publish to: ${cls.name}</option>
            `).join('')}
            <option value="other">Other (Create New Course)</option>
          </select>
          <input type="text" id="ai-custom-classroom-input" class="input-field" placeholder="Enter Custom Course Name..." style="display: none; width: auto; flex: 1; min-width: 200px;" />
          <button class="btn btn-primary" onclick="saveAIGeneratedDeck()">
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

function updateAISubjectTagFromClassroom(selectEl) {
  const customClassInput = document.getElementById('ai-custom-classroom-input');
  if (customClassInput) {
    if (selectEl.value === 'other') {
      customClassInput.style.display = 'block';
      customClassInput.required = true;
    } else {
      customClassInput.style.display = 'none';
      customClassInput.required = false;
      customClassInput.value = '';
    }
  }
}

async function saveAIGeneratedDeck() {
  const select = document.getElementById('ai-target-classroom-select');
  const classroomId = select ? select.value : '';

  const topicInput = document.getElementById('ai-topic-input');
  const topicVal = topicInput ? topicInput.value.trim() : 'AI Deck';
  const title = topicVal.charAt(0).toUpperCase() + topicVal.slice(1);

  let subject = title;
  if (classroomId && classroomId !== 'other') {
    const cls = (state.data.classrooms || []).find(c => c.id === classroomId);
    if (cls) {
      subject = cls.subject;
    }
  }

  const qInputs = document.querySelectorAll('.ai-card-q');
  const aInputs = document.querySelectorAll('.ai-card-a');

  const cards = [];
  qInputs.forEach((qInput, idx) => {
    const qVal = qInput.value.trim();
    const aVal = aInputs[idx] ? aInputs[idx].value.trim() : '';
    if (qVal && aVal) {
      cards.push({ question: qVal, answer: aVal });
    }
  });

  if (!title || !subject || cards.length === 0) {
    showToast('Please provide a valid topic and at least one card.', 'error');
    return;
  }

  let finalClassroomId = classroomId;

  // If selecting a custom course name, create the classroom first
  if (classroomId === 'other') {
    const customClassInput = document.getElementById('ai-custom-classroom-input');
    const customClassName = customClassInput ? customClassInput.value.trim() : '';
    if (!customClassName) {
      showToast('Please enter a custom course name.', 'error');
      return;
    }

    try {
      const classRes = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customClassName, subject: subject })
      });

      if (!classRes.ok) {
        const classErr = await classRes.json();
        showToast(classErr.error || 'Failed to create custom classroom.', 'error');
        return;
      }

      const updatedState = await classRes.json();
      state.data = updatedState;

      // Find the newly created classroom ID
      const newClass = (state.data.classrooms || []).find(c => c.name === customClassName && c.subject === subject);
      if (newClass) {
        finalClassroomId = newClass.id;
      } else {
        showToast('Created custom classroom but failed to retrieve its ID.', 'error');
        return;
      }
    } catch (e) {
      console.error(e);
      showToast('An error occurred creating custom classroom.', 'error');
      return;
    }
  }

  try {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subject,
        cards,
        classroom_id: finalClassroomId || null
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

    // Clear result container after save
    const resultContainer = document.getElementById('ai-generated-result');
    if (resultContainer) {
      resultContainer.innerHTML = '';
      resultContainer.style.display = 'none';
    }

    // Reset inputs
    const topicInputEl = document.getElementById('ai-topic-input');
    if (topicInputEl) topicInputEl.value = '';

    if (finalClassroomId) {
      activeCourseId = finalClassroomId;
      activeCourseSubTab = 'curriculum';
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

async function deleteDeckDirect(deckId) {
  if (!confirm('Are you sure you want to delete this flashcard deck?')) return;

  try {
    const res = await fetch(`/api/decks/${deckId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to delete deck.', 'error');
      return;
    }
    const backendState = await res.json();
    state.data = backendState;
    showToast('Deck deleted.', 'info');
    
    renderTeacherDashboard();
    renderMyClassesPanel();
  } catch (e) {
    console.error(e);
    showToast('An error occurred deleting deck.', 'error');
  }
}

/* =========================================================================
   PHASE 2: FACULTY DOCUMENT UPLOAD & PRACTICE QUIZ
   ========================================================================= */

function switchTeacherAIMode(mode) {
  const topicTab = document.getElementById('tab-btn-ai-topic');
  const docTab = document.getElementById('tab-btn-ai-doc');
  const topicForm = document.getElementById('teacher-ai-topic-form-container');
  const docForm = document.getElementById('teacher-ai-doc-form-container');

  if (mode === 'document') {
    if (topicTab) topicTab.classList.remove('active');
    if (docTab) docTab.classList.add('active');
    if (topicForm) topicForm.style.display = 'none';
    if (docForm) docForm.style.display = 'block';
  } else {
    if (docTab) docTab.classList.remove('active');
    if (topicTab) topicTab.classList.add('active');
    if (docForm) docForm.style.display = 'none';
    if (topicForm) topicForm.style.display = 'block';
  }
}

function handleTeacherDocFileChange(input) {
  const badge = document.getElementById('teacher-doc-selected-badge');
  const title = document.getElementById('teacher-doc-upload-title');
  if (!input.files || input.files.length === 0) {
    if (badge) badge.style.display = 'none';
    if (title) title.textContent = 'Click to browse or drop syllabus / lecture notes';
    return;
  }
  const file = input.files[0];
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  if (title) title.textContent = 'Selected Document:';
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.innerHTML = `<i class="fa-solid fa-file-lines"></i> <span>${escapeHtml(file.name)} (${sizeMB} MB)</span>`;
  }
}

let currentActiveRagDocId = null;

async function handleTeacherDocumentUpload(event) {
  event.preventDefault();
  const fileInput = document.getElementById('teacher-doc-file-input');
  const countInput = document.getElementById('teacher-doc-count-input');
  const levelSelect = document.getElementById('teacher-doc-level-select');
  const ragToggle = document.getElementById('teacher-doc-rag-toggle');
  const submitBtn = document.getElementById('teacher-doc-submit-btn');
  const resultContainer = document.getElementById('ai-generated-result');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a PDF or TXT file to upload.', 'error');
    return;
  }

  const file = fileInput.files[0];
  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  const useRag = isPdf && (!ragToggle || ragToggle.checked);
  const count = countInput ? countInput.value : 6;
  const level = levelSelect ? levelSelect.value : 'Intermediate Mastery';

  if (file.size > 10 * 1024 * 1024) {
    showToast('File exceeds maximum size of 10 MB.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('count', count);
  formData.append('level', level);

  const targetClassroomId = state.aiTargetClassroomId || '';
  if (targetClassroomId) {
    formData.append('classroom_id', targetClassroomId);
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = useRag
      ? '<i class="fa-solid fa-spinner fa-spin"></i> <span>Indexing PDF & Extracting Grounded Cards...</span>'
      : '<i class="fa-solid fa-spinner fa-spin"></i> <span>Extracting & Generating Flashcards...</span>';
  }

  try {
    const uploadUrl = useRag ? '/api/documents/upload-rag' : '/api/decks/upload';
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to extract and generate flashcards.', 'error');
      return;
    }

    const payload = data.data;
    const generatedCards = payload.cards || [];
    const docMeta = payload.document || null;
    const docTitle = payload.title || (docMeta ? docMeta.title : file.name.replace(/\.[^/.]+$/, ""));
    currentActiveRagDocId = docMeta ? docMeta.document_id : null;

    // Set topic input to extracted title
    const topicInput = document.getElementById('ai-topic-input');
    if (topicInput) topicInput.value = docTitle;

    state.aiTargetClassroomId = null;

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-blue); padding: 1.75rem; border-radius: var(--radius-xl); margin-top: 1.75rem; box-shadow: var(--shadow-main);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
              <h3 style="color: var(--color-blue-bright); font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-sparkles"></i>
                <span>Generated ${generatedCards.length} Flashcards from Document</span>
              </h3>
              ${docMeta ? `<span class="badge-rag-pill"><i class="fa-solid fa-brain"></i> RAG Grounded</span>` : ''}
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Source: <strong>${escapeHtml(file.name)}</strong> 
              ${docMeta ? `(${docMeta.total_pages} Pages, ${docMeta.total_chunks} Semantic Chunks indexed)` : `(${payload.extracted_chars} characters)`}
            </p>
          </div>
        </div>

        ${docMeta ? `
          <!-- Interactive Ask Document (RAG Q&A) Drawer -->
          <div class="rag-qa-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 0.95rem; font-weight: 800; color: #7c3aed; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-comments"></i>
                <span>Ask Document (Grounded RAG Search)</span>
              </h4>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Queries vector index across all ${docMeta.total_pages} pages</span>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <input type="text" id="rag-doc-query-input" class="input-field" placeholder="e.g. What are the key stages or definitions in this document?" style="flex: 1; font-size: 0.88rem;" onkeydown="if(event.key==='Enter'){event.preventDefault();submitRagDocQuery('${docMeta.document_id}');}" />
              <button type="button" class="btn btn-secondary" onclick="submitRagDocQuery('${docMeta.document_id}')" id="rag-doc-query-btn" style="white-space: nowrap; background: #7c3aed; color: #fff; border-color: #7c3aed;">
                <i class="fa-solid fa-magnifying-glass"></i>
                <span>Query Document</span>
              </button>
            </div>
            <div id="rag-query-response-box" style="display: none;"></div>
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; max-height: 420px; overflow-y: auto;">
          ${generatedCards.map((c, idx) => `
            <div class="ai-generated-card-row" style="background: var(--bg-card-subtle); padding: 1.15rem; border-radius: var(--radius-md); border-left: 3.5px solid var(--color-blue-bright); display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-blue-bright);">Card #${idx + 1}</span>
                  ${c.page_number ? `<span class="badge-citation"><i class="fa-solid fa-bookmark"></i> Page ${c.page_number}</span>` : ''}
                </div>
                <span class="card-badge badge-diff-${c.difficulty || 'medium'}" style="text-transform: capitalize; font-size: 0.72rem;">${c.difficulty || 'medium'}</span>
              </div>
              <input type="text" class="input-field ai-card-q" value="${escapeHtml(c.question)}" placeholder="Question Front..." style="width: 100%; font-weight: 700;" />
              <textarea class="input-field ai-card-a" placeholder="Answer Back..." style="width: 100%; font-family: inherit; font-size: 0.9rem; resize: vertical; min-height: 60px;">${escapeHtml(c.answer)}</textarea>
              ${c.source_citation ? `
                <div class="rag-citation-snippet">
                  <i class="fa-solid fa-quote-left" style="color: #7c3aed; margin-right: 4px;"></i>
                  <span>${escapeHtml(c.source_citation)}</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <select id="ai-target-classroom-select" class="select-field" style="width: auto; flex: 1; min-width: 200px;" onchange="updateAISubjectTagFromClassroom(this)">
            <option value="">-- Save to Standalone Decks --</option>
            ${(state.data.classrooms || []).map(cls => `
              <option value="${cls.id}" ${cls.id === targetClassroomId ? 'selected' : ''}>Publish to: ${cls.name}</option>
            `).join('')}
            <option value="other">Other (Create New Course)</option>
          </select>
          <input type="text" id="ai-custom-classroom-input" class="input-field" placeholder="Enter Custom Course Name..." style="display: none; width: auto; flex: 1; min-width: 200px;" />
          <button class="btn btn-primary" onclick="saveAIGeneratedDeck()">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Save & Publish Deck</span>
          </button>
        </div>
      </div>
    `;

    showToast(
      useRag
        ? `RAG Ingested ${docMeta.total_pages} pages and extracted ${generatedCards.length} grounded flashcards!`
        : `Synthesized ${generatedCards.length} flashcards from document!`,
      'success'
    );
  } catch (err) {
    console.error('Document upload failed', err);
    showToast('An error occurred during document upload and processing.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> <span>Extract & Generate Flashcards</span>';
    }
  }
}

async function submitRagDocQuery(docId) {
  const input = document.getElementById('rag-doc-query-input');
  const btn = document.getElementById('rag-doc-query-btn');
  const box = document.getElementById('rag-query-response-box');

  if (!input || !input.value.trim()) {
    showToast('Please enter a question to ask the document.', 'warning');
    return;
  }

  const query = input.value.trim();
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Searching...</span>';
  }

  try {
    const res = await fetch(`/api/documents/${docId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStringifySafe({ query })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to query document.', 'error');
      return;
    }

    const payload = data.data;
    if (box) {
      box.style.display = 'block';
      box.innerHTML = `
        <div style="background: var(--bg-card-subtle); border-radius: var(--radius-md); padding: 1rem; border-left: 4px solid #7c3aed; margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <strong style="font-size: 0.88rem; color: #7c3aed;"><i class="fa-solid fa-robot"></i> Grounded Answer:</strong>
          </div>
          <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.5; margin-bottom: 10px;">
            ${escapeHtml(payload.answer)}
          </p>
          ${payload.citations && payload.citations.length > 0 ? `
            <div style="margin-top: 8px; border-top: 1px dashed rgba(124, 58, 237, 0.2); padding-top: 8px;">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Retrieved Sources & Citations:</span>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                ${payload.citations.map(c => `
                  <div style="font-size: 0.78rem; background: rgba(124, 58, 237, 0.05); padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div>
                      <span class="badge-citation"><i class="fa-solid fa-bookmark"></i> Page ${c.page_number}</span>
                      <span style="color: var(--text-muted); margin-left: 6px;">${escapeHtml(c.snippet)}</span>
                    </div>
                    <span class="rag-score-badge">${Math.round((c.score || 0) * 100)}% match</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
  } catch (err) {
    console.error('Document query error', err);
    showToast('Failed to perform document query.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span>Query Document</span>';
    }
  }
}

/* Practice Quiz Runner */
class PracticeQuizRunner {
  constructor() {
    this.quizData = null;
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;
  }

  start(quizData) {
    this.quizData = quizData;
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;

    const modalTitle = document.getElementById('quiz-modal-title');
    if (modalTitle) {
      modalTitle.textContent = `Practice Quiz: ${quizData.deck_title || 'Flashcards'}`;
    }

    const summaryContainer = document.getElementById('quiz-summary-container');
    if (summaryContainer) summaryContainer.style.display = 'none';

    const questionWrapper = document.getElementById('quiz-active-question-wrapper');
    if (questionWrapper) questionWrapper.style.display = 'flex';

    this.renderQuestion();
    openModal('modal-practice-quiz');
  }

  renderQuestion() {
    if (!this.quizData || !this.quizData.quiz || this.currentIndex >= this.quizData.quiz.length) {
      this.renderSummary();
      return;
    }

    this.answered = false;
    const q = this.quizData.quiz[this.currentIndex];
    const total = this.quizData.quiz.length;
    const currentNum = this.currentIndex + 1;
    const progressPct = Math.round(((currentNum - 1) / total) * 100);

    const counterText = document.getElementById('quiz-counter-text');
    if (counterText) counterText.textContent = `Question ${currentNum} of ${total}`;

    const scoreTracker = document.getElementById('quiz-score-tracker');
    if (scoreTracker) scoreTracker.textContent = `Score: ${this.score} / ${this.currentIndex}`;

    const progressFill = document.getElementById('quiz-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPct}%`;

    const qDisplay = document.getElementById('quiz-question-display');
    if (qDisplay) qDisplay.textContent = q.question;

    const feedbackBox = document.getElementById('quiz-feedback-box');
    if (feedbackBox) {
      feedbackBox.style.display = 'none';
      feedbackBox.className = 'quiz-feedback-banner';
      feedbackBox.innerHTML = '';
    }

    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) nextBtn.style.display = 'none';

    // Render 4 options
    const optionsContainer = document.getElementById('quiz-options-container');
    if (optionsContainer) {
      const letters = ['A', 'B', 'C', 'D'];
      optionsContainer.innerHTML = q.options.map((opt, optIdx) => `
        <button type="button" class="quiz-option-btn" id="quiz-opt-btn-${optIdx}" onclick="quizRunner.selectOption(${optIdx})">
          <span class="quiz-option-letter">${letters[optIdx]}</span>
          <span style="flex: 1;">${escapeHtml(opt)}</span>
        </button>
      `).join('');
    }
  }

  selectOption(selectedIndex) {
    if (this.answered) return;
    this.answered = true;

    const q = this.quizData.quiz[this.currentIndex];
    const isCorrect = selectedIndex === q.correct_index;
    if (isCorrect) {
      this.score++;
    }

    // Disable all option buttons
    q.options.forEach((_, idx) => {
      const btn = document.getElementById(`quiz-opt-btn-${idx}`);
      if (btn) {
        btn.disabled = true;
        if (idx === q.correct_index) {
          btn.classList.add('selected-correct');
        } else if (idx === selectedIndex && !isCorrect) {
          btn.classList.add('selected-incorrect');
        }
      }
    });

    // Show feedback banner
    const feedbackBox = document.getElementById('quiz-feedback-box');
    if (feedbackBox) {
      feedbackBox.style.display = 'block';
      if (isCorrect) {
        feedbackBox.className = 'quiz-feedback-banner correct';
        feedbackBox.innerHTML = `
          <div style="font-weight: 700; color: #059669; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-check"></i> Correct Answer!
          </div>
          <div>${escapeHtml(q.explanation || '')}</div>
        `;
      } else {
        feedbackBox.className = 'quiz-feedback-banner incorrect';
        feedbackBox.innerHTML = `
          <div style="font-weight: 700; color: #dc2626; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-xmark"></i> Incorrect
          </div>
          <div><strong>Correct choice:</strong> ${escapeHtml(q.correct_answer)}. ${escapeHtml(q.explanation || '')}</div>
        `;
      }
    }

    // Show next button
    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      const isLast = this.currentIndex + 1 >= this.quizData.quiz.length;
      nextBtn.innerHTML = isLast
        ? '<span>View Final Score</span> <i class="fa-solid fa-trophy"></i>'
        : '<span>Next Question</span> <i class="fa-solid fa-arrow-right"></i>';
    }

    // Update live score
    const scoreTracker = document.getElementById('quiz-score-tracker');
    if (scoreTracker) scoreTracker.textContent = `Score: ${this.score} / ${this.currentIndex + 1}`;
  }

  nextQuestion() {
    this.currentIndex++;
    this.renderQuestion();
  }

  renderSummary() {
    const questionWrapper = document.getElementById('quiz-active-question-wrapper');
    if (questionWrapper) questionWrapper.style.display = 'none';

    const progressFill = document.getElementById('quiz-progress-fill');
    if (progressFill) progressFill.style.width = '100%';

    const total = this.quizData.quiz.length;
    const pct = total > 0 ? Math.round((this.score / total) * 100) : 100;

    const summaryContainer = document.getElementById('quiz-summary-container');
    if (summaryContainer) {
      summaryContainer.style.display = 'block';
      summaryContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(37, 99, 235, 0.1); color: var(--color-blue-bright); font-size: 2.2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <i class="fa-solid fa-trophy"></i>
          </div>
          <h2 style="color: var(--text-main); font-size: 1.6rem; font-weight: 800; margin-bottom: 0.5rem;">Practice Quiz Finished!</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.75rem;">You completed all multiple choice questions for "${escapeHtml(this.quizData.deck_title || 'Deck')}"</p>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; max-width: 400px; margin-left: auto; margin-right: auto;">
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Correct Answers</div>
              <div style="font-size: 1.75rem; font-weight: 800; color: var(--color-emerald); margin-top: 4px;">${this.score} / ${total}</div>
            </div>
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-subtle); text-transform: uppercase;">Quiz Accuracy</div>
              <div style="font-size: 1.75rem; font-weight: 800; color: var(--color-blue-bright); margin-top: 4px;">${pct}%</div>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 12px;">
            <button type="button" class="btn btn-secondary" onclick="quizRunner.start(quizRunner.quizData)">
              <i class="fa-solid fa-rotate-left"></i>
              <span>Retake Quiz</span>
            </button>
            <button type="button" class="btn btn-primary" onclick="closeModal('modal-practice-quiz')">
              <i class="fa-solid fa-check"></i>
              <span>Done</span>
            </button>
          </div>
        </div>
      `;
    }
  }
}

const quizRunner = new PracticeQuizRunner();

async function generatePracticeQuiz(deckId) {
  showToast('Synthesizing AI practice quiz with plausible distractors...', 'info');
  try {
    const res = await fetch(`/api/decks/${deckId}/generate-quiz`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to generate practice quiz.', 'error');
      return;
    }
    quizRunner.start(data.data);
  } catch (err) {
    console.error('Quiz generation failed', err);
    showToast('Network error while generating practice quiz.', 'error');
  }
}
