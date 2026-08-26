/* FlashLearn Teacher Module (Analytics, Curriculum Explorer, AI Generator & Deck CRUD) */

let activeMyClassId = 'cls-1';

// 1. Render Teacher Dashboard
function renderTeacherDashboard() {
  const statClasses = document.getElementById('stat-total-classes');
  const statStudents = document.getElementById('stat-total-students');
  const statDecks = document.getElementById('stat-total-decks');
  const statPerf = document.getElementById('stat-avg-performance');

  const classrooms = state.data.classrooms || [];
  const decks = state.data.decks || [];
  const totalDecks = decks.length;

  // 1) Compute Total Unique Enrolled Students
  const uniqueStudents = new Set();
  classrooms.forEach(cls => {
    if (cls.enrolledStudents) {
      cls.enrolledStudents.forEach(st => uniqueStudents.add(st.id || st.email));
    }
  });
  const totalStudentsCount = uniqueStudents.size;

  // 2) Compute Overall Average Performance
  let totalMarkSum = 0;
  let totalStudentCountForPerf = 0;
  classrooms.forEach(cls => {
    if (cls.enrolledStudents) {
      cls.enrolledStudents.forEach(st => {
        if (typeof st.mark === 'number') {
          totalMarkSum += st.mark;
          totalStudentCountForPerf++;
        }
      });
    }
  });
  const averagePerformancePct = totalStudentCountForPerf > 0 
    ? Math.round(totalMarkSum / totalStudentCountForPerf) 
    : 80;

  if (statClasses) statClasses.textContent = classrooms.length;
  if (statStudents) statStudents.textContent = totalStudentsCount;
  if (statDecks) statDecks.textContent = totalDecks;
  if (statPerf) statPerf.textContent = `${averagePerformancePct}%`;

  // 3) Student Performance Trend Line Chart
  let polylinePoints = "";
  let circlesHtml = "";
  let classLabelsHtml = "";
  
  if (classrooms.length > 0) {
    classrooms.forEach((cls, idx) => {
      let clsAvg = 80;
      if (cls.enrolledStudents && cls.enrolledStudents.length > 0) {
        clsAvg = Math.round(cls.enrolledStudents.reduce((sum, s) => sum + s.mark, 0) / cls.enrolledStudents.length);
      } else {
        clsAvg = cls.avgPerformance || 80;
      }
      
      const x = classrooms.length > 1 ? 30 + (idx * 240 / (classrooms.length - 1)) : 150;
      const y = 130 - (clsAvg * 1.0);
      
      polylinePoints += `${x},${y} `;
      circlesHtml += `
        <circle cx="${x}" cy="${y}" r="5" fill="#2563eb"></circle>
        <text x="${x - 10}" y="${y - 10}" font-size="9" fill="#2563eb" font-weight="bold">${clsAvg}%</text>
      `;
      classLabelsHtml += `<span>${cls.name.split(':')[0]}</span>`;
    });
  } else {
    polylinePoints = "30,110 260,110";
    circlesHtml = `<text x="100" y="75" font-size="12" fill="var(--text-muted)">No classes yet</text>`;
    classLabelsHtml = `<span>Start</span><span>End</span>`;
  }

  // 4) Deck Performance (Compute average marks for each deck based on classroom students)
  let deckBarsHtml = "";
  const displayDecks = decks.slice(0, 4);
  if (displayDecks.length > 0) {
    deckBarsHtml = displayDecks.map(deck => {
      const cls = classrooms.find(c => c.id === deck.classroom_id);
      let deckAvg = 80;
      if (cls && cls.enrolledStudents && cls.enrolledStudents.length > 0) {
        deckAvg = Math.round(cls.enrolledStudents.reduce((sum, s) => sum + s.mark, 0) / cls.enrolledStudents.length);
      } else if (cls) {
        deckAvg = cls.avgPerformance || 80;
      }
      
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px; color: var(--text-main); font-weight: 600;">
            <span>${deck.title}</span><strong style="color: var(--color-blue-bright);">${deckAvg}%</strong>
          </div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${deckAvg}%;"></div></div>
        </div>
      `;
    }).join('');
  } else {
    deckBarsHtml = `<div style="text-align: center; color: var(--text-muted); padding: 2rem 0;">No decks created yet</div>`;
  }

  // 5) Difficulty Performance Donut Chart
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  let totalMarksCount = 0;
  
  classrooms.forEach(cls => {
    if (cls.enrolledStudents) {
      cls.enrolledStudents.forEach(st => {
        if (typeof st.mark === 'number') {
          totalMarksCount++;
          if (st.mark >= 90) easyCount++;
          else if (st.mark >= 75) mediumCount++;
          else hardCount++;
        }
      });
    }
  });

  let easyPct = 60;
  let mediumPct = 30;
  let hardPct = 10;
  if (totalMarksCount > 0) {
    easyPct = Math.round((easyCount / totalMarksCount) * 100);
    mediumPct = Math.round((mediumCount / totalMarksCount) * 100);
    hardPct = Math.max(0, 100 - easyPct - mediumPct);
  }

  const conicGradientStyle = `background: conic-gradient(#10b981 0% ${easyPct}%, #f59e0b ${easyPct}% ${easyPct + mediumPct}%, #ef4444 ${easyPct + mediumPct}% 100%);`;

  // Render Analytics Visualizations
  const analyticsContainer = document.getElementById('dashboard-analytics-container');
  if (analyticsContainer) {
    analyticsContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
        <!-- 1) Student Performance Trend Line Chart -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-main);">
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-chart-line" style="color: var(--color-blue-bright);"></i>
            <span>Cohort Performance Trend</span>
          </h3>
          <div style="height: 180px; position: relative;">
            <svg width="100%" height="100%" viewBox="0 0 300 150">
              <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${polylinePoints}"></polyline>
              ${circlesHtml}
            </svg>
            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-subtle); gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${classLabelsHtml}
            </div>
          </div>
        </div>

        <!-- 2) Deck Performance Bar Graph -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-main);">
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-layer-group" style="color: var(--color-purple);"></i>
            <span>Module Mastery Averages</span>
          </h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${deckBarsHtml}
          </div>
        </div>

        <!-- 3) Difficulty Performance Donut Chart -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-main);">
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-chart-pie" style="color: var(--color-emerald);"></i>
            <span>Mastery Tier Distribution</span>
          </h3>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="css-donut-chart" style="margin-bottom: 1.25rem; ${conicGradientStyle}"></div>
            <div style="width: 100%; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; color: var(--text-main);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-circle" style="color: #10b981; font-size: 0.6rem; margin-right: 6px;"></i> High Mastery (&ge; 90%)</span>
                <strong>${easyPct}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-circle" style="color: #f59e0b; font-size: 0.6rem; margin-right: 6px;"></i> Competent (75-89%)</span>
                <strong>${mediumPct}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-circle" style="color: #ef4444; font-size: 0.6rem; margin-right: 6px;"></i> Needs Attention (&lt; 75%)</span>
                <strong>${hardPct}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// 2. Render My Classes Panel with Search Bar & Course Detail View
function renderMyClassesPanel(searchQuery = '') {
  const container = document.getElementById('myclasses-grid');
  if (!container) return;

  const query = searchQuery.toLowerCase().trim();
  let classrooms = state.data.classrooms || [];

  if (query) {
    classrooms = classrooms.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.subject.toLowerCase().includes(query) || 
      c.code.toLowerCase().includes(query)
    );
  }

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 1rem;"></i>
        <h3>No courses found matching "${searchQuery}"</h3>
      </div>
    `;
    const detailContainer = document.getElementById('myclasses-course-detail');
    if (detailContainer) detailContainer.style.display = 'none';
    return;
  }

  if (!activeMyClassId || !classrooms.some(c => c.id === activeMyClassId)) {
    activeMyClassId = classrooms[0].id;
  }

  container.innerHTML = classrooms.map(cls => {
    const deckCount = cls.decks ? cls.decks.length : 0;
    const isSelected = activeMyClassId === cls.id;

    return `
      <div class="card" style="cursor: pointer; border: 2px solid ${isSelected ? 'var(--color-blue-bright)' : 'var(--border-subtle)'}; background: ${isSelected ? 'var(--bg-card-subtle)' : 'var(--bg-card)'}; box-shadow: ${isSelected ? 'var(--shadow-hover)' : 'var(--shadow-main)'};" onclick="selectMyClassCourse('${cls.id}')">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div>
              <span class="card-badge">${cls.subject}</span>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-top: 6px;">${cls.name}</h3>
            </div>
            <div style="width: 36px; height: 36px; border-radius: 10px; background: ${isSelected ? 'var(--color-blue-bright)' : 'rgba(37, 99, 235, 0.1)'}; color: ${isSelected ? '#ffffff' : 'var(--color-blue-bright)'}; display: flex; align-items: center; justify-content: center; font-size: 1.05rem;">
              <i class="fa-solid fa-graduation-cap"></i>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            Code: <strong style="font-family: var(--font-mono); color: var(--color-blue-bright);">${cls.code}</strong>
          </p>

          <div style="display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--text-subtle);">
            <span><i class="fa-solid fa-users" style="margin-right: 4px;"></i> <strong>${cls.enrolledCount} Enrolled</strong></span>
            <span><i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> <strong>${deckCount} Decks</strong></span>
          </div>
        </div>

        <div style="margin-top: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px; color: var(--text-main);">
            <span>Cohort Accuracy</span>
            <strong style="color: var(--color-blue-bright);">${cls.avgPerformance || 78}%</strong>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${cls.avgPerformance || 78}%;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (activeMyClassId) {
    renderCourseDetailsView(activeMyClassId);
  }
}

function selectMyClassCourse(classId) {
  activeMyClassId = classId;
  renderMyClassesPanel(document.getElementById('myclasses-search-input')?.value || '');
}

function renderCourseDetailsView(classId) {
  const cls = state.data.classrooms.find(c => c.id === classId);
  const detailContainer = document.getElementById('myclasses-course-detail');
  if (!cls || !detailContainer) return;

  const enrolledStudents = cls.enrolledStudents || [];
  const classDecks = state.data.decks.filter(d => cls.decks && cls.decks.includes(d.id));

  detailContainer.style.display = 'block';
  detailContainer.innerHTML = `
    <div style="background: var(--bg-card); border: 2px solid var(--border-blue); border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-main); animation: fadeIn 0.3s ease;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="card-badge">${cls.subject}</span>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-top: 6px;">Course Overview: ${cls.name}</h2>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 0.9rem; color: var(--text-muted);">
            Access Code: <span class="code-pill" onclick="copyClassCode('${cls.code}')" title="Click to copy code"><i class="fa-solid fa-copy"></i> ${cls.code}</span>
          </div>
        </div>
      </div>

      <!-- 1) Enrolled Students in this course -->
      <div style="margin-bottom: 2.5rem;">
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-users" style="color: var(--color-blue-bright);"></i>
          <span>Enrolled Scholars (${enrolledStudents.length})</span>
        </h3>
        
        ${enrolledStudents.length === 0 ? `
          <div style="background: var(--bg-card-subtle); padding: 1.5rem; border-radius: var(--radius-md); text-align: center; color: var(--text-muted);">
            No students enrolled yet. Share code <strong style="font-family: var(--font-mono);">${cls.code}</strong> with your students to join.
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
            ${enrolledStudents.map(st => `
              <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1.1rem; border-radius: var(--radius-md); cursor: pointer; transition: transform 0.2s ease, border-color 0.2s ease;" onclick="openStudentReportModal('${st.id || 'st-1'}')" title="Click to view detailed student progress report">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="font-weight: 700; color: var(--color-blue-bright); font-size: 1rem;">${st.name}</div>
                  <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem; color: var(--text-subtle);"></i>
                </div>
                <div style="font-size: 0.82rem; color: var(--text-subtle);">${st.email}</div>
                <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-main);">
                  <span>Subject Mastery:</span>
                  <strong style="color: var(--color-emerald);"><i class="fa-solid fa-award" style="margin-right: 3px;"></i>${st.mark || 90}%</strong>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- 2) Flashcards created for this course -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-layer-group" style="color: var(--color-blue-bright);"></i>
            <span>Course Flashcard Modules (${classDecks.length})</span>
          </h3>
          <button class="btn btn-primary" onclick="openCreateCourseDeckModal('${cls.id}')" style="font-size: 0.85rem; padding: 7px 14px;">
            <i class="fa-solid fa-plus"></i>
            <span>Create Course Deck</span>
          </button>
        </div>

        ${classDecks.length === 0 ? `
          <div style="background: var(--bg-card-subtle); padding: 2rem; text-align: center; border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
            <i class="fa-solid fa-folder-plus" style="font-size: 2.2rem; color: var(--text-subtle); margin-bottom: 0.75rem;"></i>
            <p style="color: var(--text-muted); font-size: 0.95rem;">No flashcards created for this course yet.</p>
            <button class="btn btn-primary" style="margin-top: 1rem;" onclick="openCreateCourseDeckModal('${cls.id}')">
              <i class="fa-solid fa-plus"></i> Create First Deck
            </button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
            ${classDecks.map(deck => `
              <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-lg); display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm);">
                <div>
                  <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); margin-bottom: 4px;">${deck.title}</div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">
                    <i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> ${deck.cards ? deck.cards.length : 0} Cards &bull; ${deck.subject}
                  </div>
                </div>

                <div style="margin-top: 1.25rem; display: flex; gap: 8px;">
                  <button class="btn btn-secondary" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px;" onclick="openEditDeckModal('${deck.id}')">
                    <i class="fa-solid fa-pen"></i> Edit
                  </button>
                  <button class="btn btn-danger" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px;" onclick="deleteDeckCourseDirect('${deck.id}', '${cls.id}')">
                    <i class="fa-solid fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function openCreateCourseDeckModal(classId) {
  switchTab('teacher-ai');
  const classSelect = document.getElementById('ai-upload-class-select');
  if (classSelect) classSelect.value = classId;
  showToast('Configure subject and generate flashcards to publish to this course.', 'info');
}

async function deleteDeckCourseDirect(deckId, classId) {
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
    showToast('Flashcard deck deleted.', 'info');
    renderCourseDetailsView(classId);
    renderMyClassesPanel();
    renderTeacherDashboard();
  } catch (e) {
    console.error(e);
    showToast('An error occurred deleting deck.', 'error');
  }
}

function renderTeacherClassrooms() {
  const container = document.getElementById('teacher-classrooms-grid');
  if (!container) return;

  const classrooms = state.data.classrooms || [];

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
        <i class="fa-solid fa-school-circle-xmark" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 1rem;"></i>
        <h3>No Classrooms Created Yet</h3>
        <button class="btn btn-primary" onclick="openModal('modal-create-classroom')" style="margin-top: 1rem;">
          <i class="fa-solid fa-plus"></i> Create Classroom
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = classrooms.map(cls => `
    <div class="card">
      <div>
        <div class="card-header">
          <div>
            <span class="card-badge">${cls.subject}</span>
            <h3 class="card-title" style="margin-top: 6px;">${cls.name}</h3>
          </div>
        </div>
        <p class="card-desc">Instructor: ${cls.teacher}</p>
        <div style="margin: 1rem 0;">
          <span style="font-size: 0.85rem; color: var(--text-subtle); display: block; margin-bottom: 4px;">Student Access Code:</span>
          <span class="code-pill" onclick="copyClassCode('${cls.code}')" title="Click to copy code">
            <i class="fa-solid fa-copy"></i> ${cls.code}
          </span>
        </div>
      </div>

      <div>
        <div class="card-meta">
          <div class="card-meta-item">
            <i class="fa-solid fa-users"></i>
            <span>${cls.enrolledCount} Enrolled</span>
          </div>
          <div class="card-meta-item">
            <i class="fa-solid fa-layer-group"></i>
            <span>${cls.decks ? cls.decks.length : 0} Decks</span>
          </div>
        </div>

        <div style="margin-top: 1.25rem;">
          <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="selectMyClassCourse('${cls.id}'); switchTab('teacher-myclasses')">
            <i class="fa-solid fa-gear"></i>
            <span>Manage Course & Roster</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function openStudentReportModal(studentId) {
  try {
    const res = await fetch(`/api/students/${studentId}/progress`);
    if (!res.ok) {
      showToast('Failed to load student progress.', 'error');
      return;
    }
    const data = await res.json();
    const st = data.progress && data.progress[0] ? data.progress[0] : {
      name: 'Scholar',
      email: '',
      course: 'N/A',
      completedDecks: 0,
      mark: 85
    };

    const reportContainer = document.getElementById('student-report-content');
    if (reportContainer) {
      reportContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle);">
          <div class="user-avatar-large">${st.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h3 style="font-size: 1.35rem; color: var(--text-main); font-weight: 800;">${st.name}</h3>
            <p style="color: var(--text-subtle); font-size: 0.88rem;">${st.email} &bull; Course: <strong>${st.course}</strong></p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
            <div style="font-size: 0.75rem; color: var(--text-subtle); font-weight: 700; text-transform: uppercase;">Accuracy Score</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--color-blue-bright); margin-top: 4px;">${st.mark}%</div>
          </div>

          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
            <div style="font-size: 0.75rem; color: var(--text-subtle); font-weight: 700; text-transform: uppercase;">Completed Decks</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--color-emerald); margin-top: 4px;">${st.completedDecks} Decks</div>
          </div>

          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
            <div style="font-size: 0.75rem; color: var(--text-subtle); font-weight: 700; text-transform: uppercase;">Mastery Status</div>
            <div style="margin-top: 8px;">
              <span class="status-badge ${st.mark >= 90 ? 'status-excellent' : 'status-good'}">
                <i class="fa-solid fa-circle-check"></i>
                <span>${st.mark >= 90 ? 'Advanced' : 'Proficient'}</span>
              </span>
            </div>
          </div>
        </div>

        <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-blue); padding: 1.25rem; border-radius: var(--radius-md);">
          <h4 style="color: var(--color-blue-bright); margin-bottom: 0.5rem; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-chart-line"></i>
            <span>Academic Performance Evaluation</span>
          </h4>
          <p style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.6;">
            ${st.name} maintains a retention rate of <strong>${st.mark}%</strong> across course flashcard sessions. Spaced repetition retention indices confirm steady memory consolidation.
          </p>
        </div>
      `;
    }

    openModal('modal-student-report');
  } catch (e) {
    console.error(e);
    showToast('Failed to load student progress report.', 'error');
  }
}

function copyClassCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Access code ${code} copied to clipboard!`, 'info');
  }).catch(() => {
    showToast(`Code: ${code}`, 'info');
  });
}

async function handleCreateClassroom(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-class-name');
  const subjectInput = document.getElementById('new-class-subject');

  const name = nameInput.value.trim();
  const subject = subjectInput.value.trim();

  if (!name || !subject) {
    showToast('Please enter both course title and subject.', 'error');
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

    renderTeacherClassrooms();
    renderTeacherDashboard();
    renderMyClassesPanel();
    closeModal('modal-create-classroom');
    showToast(`Classroom "${name}" created successfully!`, 'success');

    nameInput.value = '';
    subjectInput.value = '';
  } catch (e) {
    console.error(e);
    showToast('An error occurred creating classroom.', 'error');
  }
}

async function handleAIFlashcardGenerate(event) {
  event.preventDefault();
  const topicInput = document.getElementById('ai-topic-input');
  const countInput = document.getElementById('ai-count-input');
  const levelSelect = document.getElementById('ai-level-select');
  const resultContainer = document.getElementById('ai-generated-result');
  const generateBtn = document.getElementById('ai-generate-btn');
  const topic = topicInput.value.trim();
  const count = parseInt(countInput.value, 10) || 5;

  if (!topic) {
    showToast('Please enter a subject topic for the flashcards.', 'error');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Flashcards...';

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count, level: levelSelect.value })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'AI generation failed.', 'error');
      return;
    }

    const generatedCards = data.cards;
    window.lastGeneratedCards = generatedCards;
    window.lastGeneratedTopic = topic;
    window.lastGeneratedLevel = levelSelect.value;
    showToast(`Generated ${generatedCards.length} flashcards for "${topic}"!`, 'success');

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-blue); padding: 1.5rem; border-radius: var(--radius-lg); margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="color: var(--color-blue-bright); font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sparkles"></i>
            <span>Generated Preview: ${topic}</span>
          </h3>
          <span class="card-badge">${generatedCards.length} Cards</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 350px; overflow-y: auto; margin-bottom: 1.5rem; padding: 6px;">
          ${generatedCards.map((card, idx) => `
            <div class="ai-generated-card-edit-box" style="background: var(--bg-card); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); border-left: 3px solid var(--color-blue-bright);">
              <div style="font-weight: 700; color: var(--color-blue-bright); font-size: 0.85rem; margin-bottom: 6px;">Card #${idx + 1}</div>
              <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 2px;">Question Front:</label>
              <input type="text" class="input-field ai-card-q-input" value="${card.question.replace(/"/g, '&quot;')}" required />
              <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; display: block; margin: 8px 0 2px;">Answer Back:</label>
              <textarea class="input-field ai-card-a-input" rows="2" required>${card.answer}</textarea>
            </div>
          `).join('')}
        </div>
        
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; margin-bottom: 6px; font-weight: 700; font-size: 0.9rem; color: var(--text-main);">Publish to Classroom:</label>
          <select id="ai-upload-class-select" class="select-field">
            ${(state.data.classrooms || []).map(c => `<option value="${c.id}" ${c.id === activeMyClassId ? 'selected' : ''}>${c.name} (${c.code})</option>`).join('')}
            <option value="">Personal Deck (No Classroom)</option>
          </select>
        </div>

        <button type="button" class="btn btn-primary" id="btn-ai-upload" onclick="handleAIDeckUpload()">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span>Upload & Distribute Deck</span>
        </button>
      </div>
    `;
  } catch (e) {
    console.error(e);
    showToast('Could not connect to the flashcard service.', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fa-solid fa-bolt"></i><span>Generate Flashcards</span>';
  }
}

async function handleAIDeckUpload() {
  const classSelect = document.getElementById('ai-upload-class-select');
  const classroomId = classSelect ? classSelect.value : null;

  const qInputs = document.querySelectorAll('.ai-card-q-input');
  const aInputs = document.querySelectorAll('.ai-card-a-input');

  const updatedCards = [];
  qInputs.forEach((qInput, idx) => {
    const qVal = qInput.value.trim();
    const aVal = aInputs[idx] ? aInputs[idx].value.trim() : '';
    if (qVal && aVal) {
      updatedCards.push({ question: qVal, answer: aVal });
    }
  });

  if (updatedCards.length === 0) {
    showToast('Please provide at least one valid question and answer card.', 'error');
    return;
  }

  const uploadBtn = document.getElementById('btn-ai-upload');
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
  }

  try {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${window.lastGeneratedTopic} (${window.lastGeneratedLevel})`,
        subject: window.lastGeneratedTopic,
        cards: updatedCards,
        classroom_id: classroomId || undefined
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to upload deck.', 'error');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>Upload & Distribute Deck</span>';
      }
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    showToast('Flashcard deck published successfully!', 'success');

    const topicInput = document.getElementById('ai-topic-input');
    if (topicInput) topicInput.value = '';
    
    const resultContainer = document.getElementById('ai-generated-result');
    if (resultContainer) {
      resultContainer.style.display = 'none';
      resultContainer.innerHTML = '';
    }

    renderTeacherDashboard();
    renderMyClassesPanel();
    if (classroomId) {
      selectMyClassCourse(classroomId);
      switchTab('teacher-myclasses');
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred during deck upload.', 'error');
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>Upload & Distribute Deck</span>';
    }
  }
}

function renderProfileView() {
  const currentUser = state.data.currentUser;
  if (!currentUser) return;

  const nameInput = document.getElementById('profile-name-input');
  const emailInput = document.getElementById('profile-email-input');
  if (nameInput) nameInput.value = currentUser.name;
  if (emailInput) emailInput.value = currentUser.email;
}

let editingDeckId = null;

function openEditDeckModal(deckId) {
  const deck = state.data.decks.find(d => d.id === deckId);
  if (!deck) return;

  editingDeckId = deckId;
  const titleInput = document.getElementById('edit-deck-title');
  const subjectInput = document.getElementById('edit-deck-subject');

  if (titleInput) titleInput.value = deck.title;
  if (subjectInput) subjectInput.value = deck.subject;

  const cardsContainer = document.getElementById('edit-deck-cards-container');
  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    
    const cardRowsContainer = document.createElement('div');
    cardRowsContainer.id = 'edit-deck-card-rows';
    cardRowsContainer.style = 'display: flex; flex-direction: column; gap: 10px;';
    cardsContainer.appendChild(cardRowsContainer);

    (deck.cards || []).forEach((card, idx) => {
      const row = document.createElement('div');
      row.className = 'edit-card-row';
      row.style = 'background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px;';
      row.innerHTML = `
        <div style="font-weight: 700; color: var(--color-blue-bright); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Card #${idx + 1}</span>
          <button type="button" class="btn-delete-card-row" style="background: none; border: none; color: var(--color-rose); cursor: pointer; font-size: 0.85rem; font-weight: bold;" onclick="this.closest('.edit-card-row').remove()">
            <i class="fa-solid fa-trash"></i> Remove
          </button>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Question Front:</label>
          <input type="text" class="input-field edit-card-q-input" value="${card.question.replace(/"/g, '&quot;')}" style="padding: 6px 10px; font-size: 0.88rem;" required />
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Answer Back:</label>
          <textarea class="input-field edit-card-a-input" style="padding: 6px 10px; height: 50px; font-size: 0.88rem; resize: vertical;" required>${card.answer}</textarea>
        </div>
      `;
      cardRowsContainer.appendChild(row);
    });

    const addCardBtn = document.createElement('button');
    addCardBtn.type = 'button';
    addCardBtn.className = 'btn btn-secondary';
    addCardBtn.style = 'justify-content: center; padding: 8px; font-size: 0.88rem; margin-top: 8px; width: 100%;';
    addCardBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Card to Deck';
    addCardBtn.onclick = () => {
      const idx = cardRowsContainer.querySelectorAll('.edit-card-row').length;
      const row = document.createElement('div');
      row.className = 'edit-card-row';
      row.style = 'background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px;';
      row.innerHTML = `
        <div style="font-weight: 700; color: var(--color-blue-bright); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Card #${idx + 1}</span>
          <button type="button" class="btn-delete-card-row" style="background: none; border: none; color: var(--color-rose); cursor: pointer; font-size: 0.85rem; font-weight: bold;" onclick="this.closest('.edit-card-row').remove()">
            <i class="fa-solid fa-trash"></i> Remove
          </button>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Question Front:</label>
          <input type="text" class="input-field edit-card-q-input" value="" style="padding: 6px 10px; font-size: 0.88rem;" required />
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Answer Back:</label>
          <textarea class="input-field edit-card-a-input" style="padding: 6px 10px; height: 50px; font-size: 0.88rem; resize: vertical;" required></textarea>
        </div>
      `;
      cardRowsContainer.appendChild(row);
    };
    cardsContainer.appendChild(addCardBtn);
  }

  openModal('modal-edit-deck');
}

async function handleSaveEditedDeck(event) {
  event.preventDefault();
  const newTitle = document.getElementById('edit-deck-title').value.trim();
  const newSubject = document.getElementById('edit-deck-subject').value.trim();

  if (!newTitle) {
    showToast('Deck title cannot be empty.', 'error');
    return;
  }

  const qInputs = document.querySelectorAll('.edit-card-q-input');
  const aInputs = document.querySelectorAll('.edit-card-a-input');

  const updatedCards = [];
  qInputs.forEach((qInput, idx) => {
    const qVal = qInput.value.trim();
    const aVal = aInputs[idx] ? aInputs[idx].value.trim() : '';
    if (qVal && aVal) {
      updatedCards.push({ question: qVal, answer: aVal });
    }
  });

  if (updatedCards.length === 0) {
    showToast('Please provide at least one valid question and answer card.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/decks/${editingDeckId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        subject: newSubject || 'General',
        cards: updatedCards
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to update deck.', 'error');
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    closeModal('modal-edit-deck');
    showToast(`Deck "${newTitle}" updated successfully!`, 'success');
    if (typeof renderStudentDecks === 'function') renderStudentDecks();
    if (typeof renderMyClassesPanel === 'function') renderMyClassesPanel();
    if (typeof activeMyClassId !== 'undefined' && activeMyClassId) {
      renderCourseDetailsView(activeMyClassId);
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred updating deck.', 'error');
  }
}
