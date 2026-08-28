const STORAGE_KEY = 'smart_attendance_subjects';

let subjects = loadSubjects();

const subjectNameInput = document.getElementById('subjectName');
const addSubjectBtn = document.getElementById('addSubjectBtn');
const subjectListEl = document.getElementById('subjectList');
const emptyState = document.getElementById('emptyState');

// ---- Storage helpers ----
function loadSubjects() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveSubjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
}

// ---- Add subject ----
addSubjectBtn.addEventListener('click', addSubject);
subjectNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSubject();
});

function addSubject() {
  const name = subjectNameInput.value.trim();
  if (!name) return;

  subjects.push({
    id: Date.now().toString(),
    name,
    present: 0,
    absent: 0
  });

  subjectNameInput.value = '';
  saveSubjects();
  render();
}

// ---- Mark attendance ----
function markPresent(id) {
  const subject = subjects.find(s => s.id === id);
  subject.present++;
  saveSubjects();
  render();
}

function markAbsent(id) {
  const subject = subjects.find(s => s.id === id);
  subject.absent++;
  saveSubjects();
  render();
}

function deleteSubject(id) {
  subjects = subjects.filter(s => s.id !== id);
  saveSubjects();
  render();
}

// ---- Percentage + risk logic ----
function getPercentage(subject) {
  const total = subject.present + subject.absent;
  if (total === 0) return 0;
  return (subject.present / total) * 100;
}

// How many more classes can be missed while staying >= 75%,
// or how many consecutive presents are needed to climb back to 75%.
function getRiskMessage(subject) {
  const total = subject.present + subject.absent;
  const percent = getPercentage(subject);

  if (total === 0) {
    return { type: 'safe', text: 'Mark your first class to start tracking.' };
  }

  if (percent >= 75) {
    // classes that can still be skipped and remain >= 75%
    let skippable = 0;
    while (true) {
      const futurePresent = subject.present;
      const futureTotal = total + skippable + 1;
      const futurePercent = (futurePresent / futureTotal) * 100;
      if (futurePercent < 75) break;
      skippable++;
      if (skippable > 500) break; // safety cap
    }
    return {
      type: 'safe',
      text: `You can safely miss ${skippable} more class${skippable === 1 ? '' : 'es'} and stay at/above 75%.`
    };
  } else {
    // consecutive presents needed to reach 75%
    let needed = 0;
    let present = subject.present;
    let tot = total;
    while ((present / tot) * 100 < 75) {
      present++;
      tot++;
      needed++;
      if (needed > 500) break; // safety cap
    }
    return {
      type: 'danger',
      text: `Below 75%! Attend the next ${needed} class${needed === 1 ? '' : 'es'} in a row to recover.`
    };
  }
}

// ---- Render ----
function render() {
  subjectListEl.innerHTML = '';
  emptyState.classList.toggle('hidden', subjects.length > 0);

  subjects.forEach(subject => {
    const total = subject.present + subject.absent;
    const percent = getPercentage(subject);
    const risk = getRiskMessage(subject);

    const percentClass = percent >= 75 ? 'ok' : percent >= 60 ? 'warn' : 'danger';
    const barColor = percent >= 75 ? 'var(--ok)' : percent >= 60 ? 'var(--warn)' : 'var(--danger)';

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-top">
        <span class="subject-name">${escapeHtml(subject.name)}</span>
        <button class="delete-btn" data-id="${subject.id}" data-action="delete">Remove</button>
      </div>
      <div class="subject-stats">
        <span>${subject.present} present / ${total} total</span>
        <span class="percent-value ${percentClass}">${percent.toFixed(1)}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${Math.min(percent,100)}%; background:${barColor};"></div>
      </div>
      <div class="subject-actions">
        <button class="mark-present" data-id="${subject.id}" data-action="present">✔ Present</button>
        <button class="mark-absent" data-id="${subject.id}" data-action="absent">✘ Absent</button>
      </div>
      <div class="risk-note ${risk.type}">${risk.text}</div>
    `;
    subjectListEl.appendChild(card);
  });
}

// ---- Event delegation for dynamic buttons ----
subjectListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'present') markPresent(id);
  if (action === 'absent') markAbsent(id);
  if (action === 'delete') deleteSubject(id);
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

render();
