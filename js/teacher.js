/* FlashLearn Teacher Module (Dashboard with Analytics, My Classes Column, Search & Card CRUD) */

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

  // 4) Deck Performance (Dynamically compute average marks for each deck based on classroom students)
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
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px; color: var(--text-main);">
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
    hardPct = 100 - easyPct - mediumPct;
  }

  const conicGradientStyle = `background: conic-gradient(#10b981 0% ${easyPct}%, #f59e0b ${easyPct}% ${easyPct + mediumPct}%, #ef4444 ${easyPct + mediumPct}% 100%);`;

  // Render Analytics Visualizations on Dashboard (Using Theme Variables)
  const analyticsContainer = document.getElementById('dashboard-analytics-container');
  if (analyticsContainer) {
    analyticsContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 2rem;">
        <!-- 1) Student Performance Trend Line Chart -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-main);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.25rem;">📈 Student Performance</h3>
          <div style="height: 180px; position: relative;">
            <svg width="100%" height="100%" viewBox="0 0 300 150">
              <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${polylinePoints}"></polyline>
              ${circlesHtml}
            </svg>
            <div style="display: flex; justify-content: space-between; margin-top: 1rem; font-size: 0.75rem; color: var(--text-subtle); gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${classLabelsHtml}
            </div>
          </div>
        </div>

        <!-- 2) Deck Performance Bar Graph -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-main);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.25rem;">📊 Deck Performance</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${deckBarsHtml}
          </div>
        </div>

        <!-- 3) Difficulty Performance Donut Chart -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-main);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.25rem;">🎯 Difficulty Performance</h3>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="css-donut-chart" style="margin-bottom: 1rem; ${conicGradientStyle}"></div>
            <div style="width: 100%; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: var(--text-main);">
              <div style="display: flex; justify-content: space-between;"><span>🟢 Easy (Marks &ge; 90%)</span><strong>${easyPct}%</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>🟡 Medium (Marks 75-89%)</span><strong>${mediumPct}%</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>🔴 Hard (Marks &lt; 75%)</span><strong>${hardPct}%</strong></div>
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
  let classrooms = state.data.classrooms;

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
        <h3>No courses found matching "${searchQuery}"</h3>
      </div>
    `;
    document.getElementById('myclasses-course-detail').style.display = 'none';
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
              <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin-top: 6px;">${cls.name}</h3>
            </div>
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${isSelected ? 'var(--color-blue-bright)' : 'rgba(37, 99, 235, 0.1)'}; color: ${isSelected ? '#ffffff' : 'var(--color-blue-bright)'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
              📖
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">Code: <strong>${cls.code}</strong></p>

          <div style="display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--text-subtle);">
            <span>👥 <strong>${cls.enrolledCount} Students</strong></span>
            <span>🃏 <strong>${deckCount} Decks</strong></span>
          </div>
        </div>

        <div style="margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px; color: var(--text-main);">
            <span>Avg Performance</span>
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

  const enrolledStudents = cls.enrolledStudents || [
    { id: 'st-1', name: 'Eleanor Vance', email: 'student@gmail.com', mark: 96 },
    { id: 'st-3', name: 'Sophia Lin', email: 'sophia@university.edu', mark: 92 }
  ];

  const classDecks = state.data.decks.filter(d => cls.decks && cls.decks.includes(d.id));

  detailContainer.style.display = 'block';
  detailContainer.innerHTML = `
    <div style="background: var(--bg-card); border: 2px solid var(--color-blue-bright); border-radius: var(--radius-xl); padding: 2rem; box-shadow: var(--shadow-main); animation: fadeIn 0.3s ease;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle);">
        <div>
          <span class="card-badge">${cls.subject}</span>
          <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--text-main); margin-top: 6px;">Course Overview: ${cls.name}</h2>
        </div>
        <div style="font-size: 0.9rem; color: var(--text-muted);">
          Access Code: <strong style="color: var(--color-blue-bright); font-family: monospace;">${cls.code}</strong>
        </div>
      </div>

      <!-- 1) Enrolled Students in this course -->
      <div style="margin-bottom: 2.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
          <span>🎓</span> Enrolled Students in ${cls.name} (${enrolledStudents.length})
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${enrolledStudents.map(st => `
            <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-md); cursor: pointer; transition: transform 0.2s ease, border-color 0.2s ease;" onclick="openStudentReportModal('${st.id || 'st-1'}')" title="Click to view detailed student progress report">
              <div style="font-weight: 700; color: var(--color-blue-bright); font-size: 1.05rem;">${st.name}</div>
              <div style="font-size: 0.82rem; color: var(--text-subtle);">${st.email}</div>
              <div style="margin-top: 8px; display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-main);">
                <span>Course Accuracy:</span>
                <strong style="color: var(--color-emerald);">${st.mark || 90}%</strong>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 2) Flashcards created for this course -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>🃏</span> Flashcards Created for ${cls.name} (${classDecks.length})
          </h3>
          <button class="btn btn-primary" onclick="openCreateCourseDeckModal('${cls.id}')">+ Create Course Deck</button>
        </div>

        ${classDecks.length === 0 ? `
          <div style="background: var(--bg-card-subtle); padding: 2rem; text-align: center; border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
            <p style="color: var(--text-muted); font-size: 0.95rem;">No flashcards created for this course yet.</p>
            <button class="btn btn-primary" style="margin-top: 1rem;" onclick="openCreateCourseDeckModal('${cls.id}')">+ Create First Deck</button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
            ${classDecks.map(deck => `
              <div style="background: var(--bg-card); border: 1px solid var(--border-blue); padding: 1.25rem; border-radius: var(--radius-lg); display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                <div>
                  <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-main); margin-bottom: 4px;">${deck.title}</div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">${deck.cards ? deck.cards.length : 0} Cards • ${deck.subject}</div>
                </div>

                <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px;" onclick="openEditDeckModal('${deck.id}')">
                      ✏️ Edit
                    </button>
                    <button class="btn btn-danger" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 6px;" onclick="deleteDeckCourseDirect('${deck.id}', '${cls.id}')">
                      🗑️ Delete
                    </button>
                  </div>
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
  showToast('Use Flashcards Generator or custom creator to build course decks.', 'info');
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
    showToast('Flashcard Deck deleted.', 'info');
    renderCourseDetailsView(classId);
    renderMyClassesPanel();
  } catch (e) {
    console.error(e);
    showToast('An error occurred deleting deck.', 'error');
  }
}

function renderTeacherClassrooms() {
  const container = document.getElementById('teacher-classrooms-grid');
  if (!container) return;

  const classrooms = state.data.classrooms;

  if (classrooms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-blue);">
        <h3>No Classrooms Created Yet</h3>
        <button class="btn btn-primary" onclick="openModal('modal-create-classroom')" style="margin-top: 1rem;">Create Classroom</button>
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
          <span style="font-size: 0.85rem; color: var(--text-subtle);">Access Code:</span>
          <div style="margin-top: 4px;">
            <span class="code-pill" onclick="copyClassCode('${cls.code}')" title="Click to copy code">
              ${cls.code}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div class="card-meta">
          <div class="card-meta-item">
            <span>👥 ${cls.enrolledCount} Enrolled</span>
          </div>
          <div class="card-meta-item">
            <span>🃏 ${cls.decks ? cls.decks.length : 0} Decks</span>
          </div>
        </div>

        <div style="margin-top: 1rem;">
          <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="selectMyClassCourse('${cls.id}'); switchTab('teacher-myclasses')">
            Manage Course & Cards
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
      name: 'Unknown Student',
      email: '',
      course: 'N/A',
      completedDecks: 0,
      mark: 0
    };

    const reportContainer = document.getElementById('student-report-content');
    if (reportContainer) {
      reportContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle);">
          <div class="user-avatar-large">${st.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h3 style="font-size: 1.4rem; color: var(--text-main); font-weight: 700;">${st.name}</h3>
            <p style="color: var(--text-subtle); font-size: 0.9rem;">${st.email} • Course: <strong>${st.course}</strong></p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-subtle); font-weight: 700;">ACCURACY SCORE</div>
            <div style="font-size: 1.7rem; font-weight: 800; color: var(--color-blue-bright); margin-top: 4px;">${st.mark}%</div>
          </div>

          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-subtle); font-weight: 700;">COMPLETED DECKS</div>
            <div style="font-size: 1.7rem; font-weight: 800; color: var(--color-emerald); margin-top: 4px;">${st.completedDecks} Decks</div>
          </div>

          <div style="background: var(--bg-card-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-subtle); font-weight: 700;">MASTERY STATUS</div>
            <div style="margin-top: 8px;">
              <span class="status-badge ${st.mark >= 90 ? 'status-excellent' : 'status-good'}">${st.mark >= 90 ? 'Excellent' : 'Good'}</span>
            </div>
          </div>
        </div>

        <div style="background: var(--bg-card); border: 1px solid var(--border-blue); padding: 1.25rem; border-radius: var(--radius-md);">
          <h4 style="color: var(--color-blue-bright); margin-bottom: 0.5rem; font-size: 1.05rem;">📊 Progress Report & Study Analytics</h4>
          <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">
            ${st.name} has demonstrated mastery with ${st.mark}% retention accuracy across course flashcard modules. Recommended to continue active recall practice.
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
    showToast(`Classroom Code ${code} copied to clipboard!`, 'info');
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
  generateBtn.textContent = 'Generating Flashcards...';

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
      <div style="background: var(--bg-card); border: 1px solid var(--border-blue); padding: 1.5rem; border-radius: var(--radius-lg); margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="color: var(--color-blue-bright); font-size: 1.3rem;">✨ Generated Deck Preview: ${topic} (${levelSelect.value})</h3>
          <span class="card-badge">${generatedCards.length} Cards</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1.25rem; max-height: 350px; overflow-y: auto; margin-bottom: 1.5rem; padding: 12px; background: var(--bg-card-subtle);">
          ${generatedCards.map((card, idx) => `
            <div class="ai-generated-card-edit-box" style="background: #ffffff; padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid var(--color-blue-bright);">
              <div style="font-weight: bold; color: var(--color-blue-dark); margin-bottom: 8px;">Card #${idx + 1}</div>
              <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 2px;">Question Front:</label>
              <input type="text" class="input-field ai-card-q-input" value="${card.question.replace(/"/g, '&quot;')}" required />
              <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; display: block; margin: 8px 0 2px;">Answer Back:</label>
              <textarea class="input-field ai-card-a-input" required>${card.answer}</textarea>
            </div>
          `).join('')}
        </div>
        <label for="ai-upload-class-select">Select Course to Upload:</label>
        <select id="ai-upload-class-select" class="input-field">
          ${state.data.classrooms.map(c => `<option value="${c.id}" ${c.id === activeMyClassId ? 'selected' : ''}>${c.name} (${c.code})</option>`).join('')}
          <option value="">Personal Deck (No Classroom)</option>
        </select>
        <button type="button" class="btn btn-primary" id="btn-ai-upload" style="margin-top: 1rem;" onclick="handleAIDeckUpload()">📤 Upload & Send to Students</button>
      </div>
    `;
  } catch (e) {
    console.error(e);
    showToast('Could not connect to the AI service.', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Flashcards';
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
    uploadBtn.innerHTML = "Uploading to Course...";
  }

  try {
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${window.lastGeneratedTopic} (${window.lastGeneratedLevel})`,
        subject: window.lastGeneratedTopic,
        cards: updatedCards,
        classroom_id: classroomId
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to upload deck.', 'error');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = "📤 Upload & Send to Students";
      }
      return;
    }

    const backendState = await res.json();
    state.data = backendState;

    showToast('Flashcard deck successfully uploaded and sent to students! 🚀', 'success');

    // Clear inputs
    const topicInput = document.getElementById('ai-topic-input');
    if (topicInput) topicInput.value = '';
    
    const resultContainer = document.getElementById('ai-generated-result');
    if (resultContainer) {
      resultContainer.style.display = 'none';
      resultContainer.innerHTML = '';
    }

    // Refresh dashboard stats and classes panel
    renderTeacherDashboard();
    renderMyClassesPanel();
    if (classroomId) {
      selectMyClassCourse(classroomId);
      switchTab('teacher-myclasses');
    }
  } catch (e) {
    console.error(e);
    showToast('An error occurred during upload.', 'error');
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = "📤 Upload & Send to Students";
    }
  }
}

function createSimulatedCards(topic, level, count = 5) {
  const t = topic.toLowerCase();
  const pool = [];

  if (t.includes('java') || t.includes('code') || t.includes('comp')) {
    pool.push(
      { question: `What are the core principles governing ${topic}?`, answer: 'Encapsulation, Inheritance, Polymorphism, and Abstraction.' },
      { question: `How is memory allocated in ${topic}?`, answer: 'Objects are allocated on Heap memory; local variables reside on Stack memory.' },
      { question: `What is the significance of data immutability in ${topic}?`, answer: 'Prevents unwanted side effects and improves thread safety across concurrent operations.' }
    );
  } else {
    pool.push(
      { question: `What is the core definition of ${topic}?`, answer: `The fundamental academic domain covering essential theories and applications of ${topic}.` },
      { question: `What key discovery transformed modern understanding of ${topic}?`, answer: `Empirical research and theoretical models developed by domain pioneers.` },
      { question: `How do scholars analyze complex problems in ${topic}?`, answer: `By applying structured analytical methodology and experimental verification.` }
    );
  }

  const result = [];
  for (let i = 0; i < count; i++) {
    const template = pool[i % pool.length];
    result.push({
      question: template.question,
      answer: template.answer
    });
  }
  return result;
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

    deck.cards.forEach((card, idx) => {
      const row = document.createElement('div');
      row.className = 'edit-card-row';
      row.style = 'background: #ffffff; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);';
      row.innerHTML = `
        <div style="font-weight: 700; color: var(--color-blue-dark); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Card #${idx + 1}</span>
          <button type="button" class="btn-delete-card-row" style="background: none; border: none; color: var(--color-red); cursor: pointer; font-size: 0.85rem; font-weight: bold;" onclick="this.closest('.edit-card-row').remove()">🗑️ Remove</button>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Question Front:</label>
          <input type="text" class="input-field edit-card-q-input" value="${card.question.replace(/"/g, '&quot;')}" style="width: 100%; padding: 5px; font-size: 0.85rem;" required />
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Answer Back:</label>
          <textarea class="input-field edit-card-a-input" style="width: 100%; padding: 5px; height: 40px; font-family: inherit; font-size: 0.85rem; resize: vertical;" required>${card.answer}</textarea>
        </div>
      `;
      cardRowsContainer.appendChild(row);
    });

    const addCardBtn = document.createElement('button');
    addCardBtn.type = 'button';
    addCardBtn.className = 'btn btn-secondary';
    addCardBtn.style = 'justify-content: center; padding: 6px; font-size: 0.85rem; margin-top: 6px; width: 100%;';
    addCardBtn.innerHTML = '➕ Add Card to Deck';
    addCardBtn.onclick = () => {
      const idx = cardRowsContainer.querySelectorAll('.edit-card-row').length;
      const row = document.createElement('div');
      row.className = 'edit-card-row';
      row.style = 'background: #ffffff; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);';
      row.innerHTML = `
        <div style="font-weight: 700; color: var(--color-blue-dark); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Card #${idx + 1}</span>
          <button type="button" class="btn-delete-card-row" style="background: none; border: none; color: var(--color-red); cursor: pointer; font-size: 0.85rem; font-weight: bold;" onclick="this.closest('.edit-card-row').remove()">🗑️ Remove</button>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Question Front:</label>
          <input type="text" class="input-field edit-card-q-input" value="" style="width: 100%; padding: 5px; font-size: 0.85rem;" required />
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Answer Back:</label>
          <textarea class="input-field edit-card-a-input" style="width: 100%; padding: 5px; height: 40px; font-family: inherit; font-size: 0.85rem; resize: vertical;" required></textarea>
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
