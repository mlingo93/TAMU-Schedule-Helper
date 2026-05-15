let allTerms = [], allSubjects = [], allCourses = [], allRegBlocks = [];
let selectedTerm = null;
let selectedSubject = null;
let selectedCourse = null;
let selectedSection = null;

let currentFilters = {
  search: '',
  onlyOpen: true,
  excludeHonors: true,
  days: new Set(),
  campus: ''
};

const termsContent = document.getElementById('terms-content');
const subjectsContent = document.getElementById('subjects-content');
const coursesContent = document.getElementById('courses-content');
const regblocksContent = document.getElementById('regblocks-content');

const subjectsSection = document.getElementById('subjects-section');
const coursesSection = document.getElementById('courses-section');
const regblocksSection = document.getElementById('regblocks-section');
const selectedInfo = document.getElementById('selected-info');

const subjectSearch = document.getElementById('subject-search');
const courseSearch = document.getElementById('course-search');

// ==================== HELPERS ====================
function formatTime(militaryTime) {
  if (!militaryTime) return 'TBA';
  let timeStr = String(militaryTime).trim();
  if (timeStr.length === 3) timeStr = '0' + timeStr; // Pad single-digit hours
  if (timeStr.length < 4) return 'TBA';
  try {
    let hours = parseInt(timeStr.substring(0, 2));
    const minutes = timeStr.substring(2, 4);
    if (isNaN(hours)) return 'TBA';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return 'TBA';
  }
}

function getInstructors(instructorData) {
  if (!instructorData) return 'TBA';
  if (Array.isArray(instructorData)) {
    return instructorData.map(i => i.name || i).filter(Boolean).join(', ');
  }
  if (typeof instructorData === 'object' && instructorData.name) {
    return instructorData.name;
  }
  return String(instructorData);
}

function getLocation(meeting) {
  if (!meeting) return 'TBA';
  const building = meeting.building || meeting.buildingCode || '';
  const room = meeting.room || meeting.roomNumber || '';
  const location = meeting.location || '';
  
  if (location) return location;
  if (building && room) return `${building} ${room}`;
  if (building) return building;
  if (room) return room;
  return 'TBA';
}

function getCampus(sectionAttributes) {
    const attributes = [];
    sectionAttributes.forEach(a => {
        if(a.id != 'ZLSA')
        {attributes.push(a.valueTitle);}
    });
    return attributes.join(', ') || 'TBA';
}

function getMeetingDaysTimes(meetings) {
    let meetingString = '';

    meetings.forEach(m => {
        const typeDesc = m.meetingTypeDescription ? `${m.meetingTypeDescription} - ` : '';
        const location = getLocation(m);
        if(meetingString !== '') meetingString += ' &amp; ';
        if(m.meetingTypeDescription !== 'Examination')
            {
                meetingString += `${m.days || 'TBA'} @ ${formatTime(m.startTime)}–${formatTime(m.endTime)}`;
        }
    });

    return meetingString || '<em>No meeting times listed</em>';
}

function updateSectionHeaders() {
  document.getElementById('term-header').innerHTML = `1. Select Term ${selectedTerm ? `<span style="color:#006633; margin-left:8px;">→ ${selectedTerm.title}</span>` : ''}`;
  if(selectedTerm !== null) {currentFilters.campus = selectedTerm.title.split(' - ')[1].trim();}
  document.getElementById('subject-header').innerHTML = `2. Select Subject ${selectedSubject ? `<span style="color:#006633; margin-left:8px;">→ ${selectedSubject.title}</span>` : ''}`;
  document.getElementById('course-header').innerHTML = `3. Select Course ${selectedCourse ? `<span style="color:#006633; margin-left:8px;">→ ${selectedCourse.displayTitle || selectedCourse.title}</span>` : ''}`;
}

function collapseSection(id) {
  const content = document.getElementById(id + '-content');
  if (content) content.style.display = 'none';
}

function expandSection(id) {
  const content = document.getElementById(id + '-content');
  if (content) content.style.display = 'block';
}

function hideSubjectFilter() { if (subjectSearch) subjectSearch.style.display = 'none'; }
function hideCourseFilter() { if (courseSearch) courseSearch.style.display = 'none'; }
function showSubjectFilter() { if (subjectSearch) subjectSearch.style.display = 'block'; }
function showCourseFilter() { if (courseSearch) courseSearch.style.display = 'block'; }

// ==================== FILTERS ====================
function matchesFilters(section) {
  if (currentFilters.search) {
    const term = currentFilters.search.toLowerCase();
    const crnMatch = (section.registrationNumber || '').toLowerCase().includes(term);
    const instructorMatch = getInstructors(section.instructor).toLowerCase().includes(term);
    if (!crnMatch && !instructorMatch) return false;
  }

  if (currentFilters.onlyOpen && (!section.openSeats || section.openSeats <= 0)) return false;

  if (currentFilters.excludeHonors) {
    const isHonors = (section.isHonors || 'false').toUpperCase();
    if (isHonors == 'false') return false;
  }

  if (currentFilters.campus) {
    const attr = section.sectionAttributes?.find(a => a.valueTitle.trim().toLowerCase() === currentFilters.campus.trim().toLowerCase());
    if (!attr) return false;
  }

  return true;
}

// ==================== TERMS ====================
async function fetchTerms() {
  termsContent.innerHTML = '<div class="loading">Loading terms...</div>';
  try {
    const res = await fetch('https://tamu.collegescheduler.com/api/terms/', {
      method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' }
    });
    allTerms = await res.json();
    renderTerms();
  } catch (err) {
    termsContent.innerHTML = `<p style="color:red">Failed loading terms. Error: ${err}</p>`;
  }
}

function renderTerms() {
  let html = '';
  allTerms.forEach(term => {
    const selected = selectedTerm && selectedTerm.id === term.id;
    html += `<div class="item term ${selected ? 'selected' : ''}" data-id="${term.id}"><strong>${term.title}</strong><br><span class="code">Code: ${term.code}</span></div>`;
  });
  termsContent.innerHTML = html;

  document.querySelectorAll('.term').forEach(el => el.addEventListener('click', () => selectTerm(el.dataset.id)));
}

async function selectTerm(termId) {
  selectedTerm = allTerms.find(t => t.id === termId);
  resetLowerSelections();

  chrome.storage.local.set({ selectedTerm });
  renderTerms();
  updateSectionHeaders();
  updateSelectedUI();
  collapseSection('terms');
  subjectsSection.style.display = 'block';
  expandSection('subjects');
  showSubjectFilter();
  await fetchSubjects(termId);
}

// ==================== SUBJECTS ====================
async function fetchSubjects(termId) {
  subjectsContent.innerHTML = '<div class="loading">Loading subjects...</div>';
  try {
    const res = await fetch(`https://tamu.collegescheduler.com/api/terms/${termId}/subjects/`, {
      method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' }
    });
    allSubjects = await res.json();
    renderSubjects(subjectSearch.value);
  } catch (err) {
    subjectsContent.innerHTML = `<p style="color:red">Failed to load subjects. Error: ${err}</p>`;
  }
}

function renderSubjects(filter = '') {
  const filtered = allSubjects.filter(sub => sub.title.toLowerCase().includes(filter.toLowerCase()));
  let html = '';
  filtered.forEach(sub => {
    const selected = selectedSubject && selectedSubject.id === sub.id;
    html += `<div class="item subject ${selected ? 'selected' : ''}" data-id="${sub.id}"><strong>${sub.title}</strong></div>`;
  });
  subjectsContent.innerHTML = html || '<p>No subjects found.</p>';

  document.querySelectorAll('.subject').forEach(el => el.addEventListener('click', () => selectSubject(el.dataset.id)));
}

// ==================== COURSES ====================
async function fetchCourses(termId, subjectId) {
  coursesContent.innerHTML = '<div class="loading">Loading courses...</div>';
  try {
    const res = await fetch(`https://tamu.collegescheduler.com/api/terms/${termId}/subjects/${subjectId}/courses/`, {
      method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' }
    });
    allCourses = await res.json();
    renderCourses(courseSearch.value);
  } catch (err) {
    coursesContent.innerHTML = `<p style="color:red">Failed to load courses. Error: ${err}</p>`;
  }
}

function renderCourses(filter = '') {
  const filtered = allCourses.filter(course => 
    (course.displayTitle || course.title || '').toLowerCase().includes(filter.toLowerCase())
  );
  let html = '';
  filtered.forEach(course => {
    const selected = selectedCourse && selectedCourse.id === course.id;
    html += `<div class="item course ${selected ? 'selected' : ''}" data-id="${course.id}" data-subjectid="${course.subjectId}" data-number="${course.number}">
               <strong>${course.displayTitle}</strong><br><small>${course.titleLong || course.title}</small>
             </div>`;
  });
  coursesContent.innerHTML = html || '<p>No courses found.</p>';

  document.querySelectorAll('.course').forEach(el => {
    el.addEventListener('click', () => selectCourse(el.dataset.id, el.dataset.subjectid, el.dataset.number));
  });
}

async function selectSubject(subjectId) {
  selectedSubject = allSubjects.find(s => s.id === subjectId);
  selectedCourse = null;
  selectedSection = null;

  chrome.storage.local.set({ selectedTerm, selectedSubject });
  renderSubjects(subjectSearch.value);
  updateSectionHeaders();
  updateSelectedUI();

  hideSubjectFilter();
  collapseSection('subjects');
  coursesSection.style.display = 'block';
  expandSection('courses');
  showCourseFilter();
  await fetchCourses(selectedTerm.id, subjectId);
}

async function selectCourse(courseId, subjectId, number) {
  selectedCourse = allCourses.find(c => c.id === courseId);
  selectedSection = null;

  chrome.storage.local.set({ selectedTerm, selectedSubject, selectedCourse });
  renderCourses(courseSearch.value);
  updateSectionHeaders();
  updateSelectedUI();

  hideCourseFilter();
  collapseSection('courses');
  regblocksSection.style.display = 'block';
  expandSection('regblocks');
  await fetchRegBlocks(selectedTerm.id, subjectId, number);
}

// ==================== REG BLOCKS ====================
async function fetchRegBlocks(termId, subjectId, courseNumber) {
  regblocksContent.innerHTML = '<div class="loading">Loading sections...</div>';

  try {
    const res = await fetch(`https://tamu.collegescheduler.com/api/terms/${termId}/subjects/${subjectId}/courses/${courseNumber}/regblocks`, {
      method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();

    if (data && Array.isArray(data)) {
      allRegBlocks = data.flatMap(rb => rb.sections || []);
    } else if (data?.regblocks) {
      allRegBlocks = data.regblocks.flatMap(rb => rb.sections || []);
    } else if (data?.sections) {
      allRegBlocks = data.sections;
    } else {
      allRegBlocks = [];
    }

    renderRegBlocks();
  } catch (err) {
    console.error(err);
    regblocksContent.innerHTML = `<p style="color:red">Failed to load sections. Error: ${err}</p>`;
  }
}

function renderRegBlocks() {
  const filtered = allRegBlocks.filter(section => matchesFilters(section));

  // Check if filters container already exists
  let filterContainer = document.getElementById('filter-container');
  let isFirstRender = !filterContainer;

  if (isFirstRender) {
    let html = `
      <div id="filter-container" style="margin-bottom:8px; padding:10px; background:#f8f8f8; border-radius:6px; font-size:14px;">
        <input type="text" id="section-search" placeholder="Search CRN or Instructor..." 
               style="width:100%; padding:8px; margin-bottom:8px; border:1px solid #ccc; border-radius:4px;">
        <input type="text" id="campus-search" placeholder="Campus..." 
               style="width:100%; padding:8px; margin-bottom:8px; border:1px solid #ccc; border-radius:4px;">
        <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
          <label><input type="checkbox" id="only-open" ${currentFilters.onlyOpen ? 'checked' : ''}> Only open sections</label>
          <label><input type="checkbox" id="exclude-honors" ${currentFilters.excludeHonors ? 'checked' : ''}> Exclude Honors sections</label>
        </div>
      </div>
      <div id="sections-container" style="max-height:380px; overflow-y:auto;"></div>`;
    regblocksContent.innerHTML = html;
    setupFilterListeners();
  }

  // Update only the sections list, not the filters
  const sectionsContainer = document.getElementById('sections-container');
  let html = '';

  if (filtered.length === 0) {
    html += `<p style="color:#666; padding:20px; text-align:center;">No sections match your filters.</p>`;
  } else {
    filtered.forEach((section) => {
      const originalIndex = allRegBlocks.indexOf(section);
      const isSelected = selectedSection && selectedSection.registrationNumber === section.registrationNumber;

      const meetings = section.meetings || [];
      let meetingsHtml = '';

      meetings.forEach(m => {
        const typeDesc = m.meetingTypeDescription ? `${m.meetingTypeDescription} - ` : '';
        const location = getLocation(m);
        meetingsHtml += `
          <div style="margin:6px 0; padding:4px 0; border-top:1px dashed #ddd;">
            <strong>${typeDesc}${m.days || 'TBA'}</strong> | 
            ${formatTime(m.startTime)} – ${formatTime(m.endTime)}<br>
            <strong>Location:</strong> ${location}
          </div>`;
      });

      html += `
        <div class="item regblock ${isSelected ? 'selected' : ''}" data-index="${originalIndex}" style="margin-bottom:6px;">
          <div class="section-header" style="cursor:pointer; padding:8px 0;">
            <strong>${section.registrationNumber} | ${getInstructors(section.instructor) || 'TBA'}</strong>: <i>(${getMeetingDaysTimes(section.meetings) || 'TBA'})</i>
            <span style="float:right; font-size:13px; color:#006633;">
              ${section.credits || '?'} Credits • ${section.openSeats || 0} seats
            </span>
          </div>
          
          <div class="section-content" style="padding:10px; border-top:1px solid #eee; display:none;">
            <strong>Instructor:</strong> ${getInstructors(section.instructor)}<br>
            ${meetingsHtml || '<em>No meeting times listed</em>'}
          </div>
        </div>`;
    });
  }

  sectionsContainer.innerHTML = html;
  setupSectionListeners();
}

function setupFilterListeners() {
  const searchInput = document.getElementById('section-search');
  const onlyOpenCheckbox = document.getElementById('only-open');
  const excludeHonorsCheckbox = document.getElementById('exclude-honors');
  const campusInput = document.getElementById('campus-search');

  // Only attach listeners once - check if already attached
  if (!searchInput.dataset.listenersAttached) {
    searchInput.addEventListener('input', (e) => { currentFilters.search = e.target.value.trim(); renderRegBlocks(); });
    campusInput.addEventListener('input', (e) => { currentFilters.campus = e.target.value.trim(); renderRegBlocks(); });
    onlyOpenCheckbox.addEventListener('change', (e) => { currentFilters.onlyOpen = e.target.checked; renderRegBlocks(); });
    excludeHonorsCheckbox.addEventListener('change', (e) => { currentFilters.excludeHonors = e.target.checked; renderRegBlocks(); });
    searchInput.dataset.listenersAttached = 'true';
  }

  // Restore filter values
  searchInput.value = currentFilters.search;
  campusInput.value = currentFilters.campus;
  onlyOpenCheckbox.checked = currentFilters.onlyOpen;
  excludeHonorsCheckbox.checked = currentFilters.excludeHonors;
}

function setupSectionListeners() {
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      if (content) content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
  });

  document.querySelectorAll('.regblock').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.section-header')) {
        const index = parseInt(el.dataset.index);
        selectSection(index);
      }
    });
  });
}

function selectSection(index) {
  selectedSection = allRegBlocks[index];
  chrome.storage.local.set({ selectedTerm, selectedSubject, selectedCourse, selectedSection });
  renderRegBlocks();
  updateSelectedUI();
}

function updateSelectedUI() {  
  if (selectedTerm & selectedSubject & selectedCourse) {
    selectedInfo.style.display = 'block';
  }
}

// Clear All
function clearAll() {
  selectedTerm = selectedSubject = selectedCourse = selectedSection = null;
  currentFilters = { search: '', onlyOpen: true, excludeHonors: true, campus: '', days: new Set() };

  chrome.storage.local.remove(['selectedTerm','selectedSubject','selectedCourse','selectedSection']);
  updateSectionHeaders();
  updateSelectedUI();

  subjectSearch.style.display = 'block';
  courseSearch.style.display = 'block';

  subjectsSection.style.display = 'none';
  coursesSection.style.display = 'none';
  regblocksSection.style.display = 'none';

  expandSection('terms');
  fetchTerms();
}

document.getElementById('clearAllTop').addEventListener('click', clearAll);

document.getElementById('subject-search').addEventListener('input', (e) => renderSubjects(e.target.value));
document.getElementById('course-search').addEventListener('input', (e) => renderCourses(e.target.value));

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['selectedTerm','selectedSubject','selectedCourse','selectedSection']);
  if (data.selectedTerm) selectedTerm = data.selectedTerm;
  if (data.selectedSubject) selectedSubject = data.selectedSubject;
  if (data.selectedCourse) selectedCourse = data.selectedCourse;
  if (data.selectedSection) selectedSection = data.selectedSection;

  updateSectionHeaders();
  updateSelectedUI();
  fetchTerms();
});

function resetLowerSelections() {
  selectedSubject = selectedCourse = selectedSection = null;
}