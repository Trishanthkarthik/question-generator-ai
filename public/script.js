// ===== STATE =====
let selectedFile = null;
let isProcessing = false;
let messageCount = 0;

// ===== ELEMENTS =====
const chatArea = document.getElementById('chatArea');
const messages = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileIcon = document.getElementById('fileIcon');
const fileRemove = document.getElementById('fileRemove');
const generateBtn = document.getElementById('generateBtn');
const attachBtn = document.getElementById('attachBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menuBtn');
const sidebarClose = document.getElementById('sidebarClose');
const newChatBtn = document.getElementById('newChatBtn');
const themeToggle = document.getElementById('themeToggle');
const themeLabel = document.getElementById('themeLabel');
const topbarTheme = document.getElementById('topbarTheme');
const topbarThemeIcon = document.getElementById('topbarThemeIcon');

// ===== THEME =====
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('examai-theme', t);
  topbarThemeIcon.textContent = t === 'dark' ? '☀️' : '🌙';
  themeLabel.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

themeToggle.addEventListener('click', toggleTheme);
topbarTheme.addEventListener('click', toggleTheme);

// Load saved theme
const saved = localStorage.getItem('examai-theme');
if (saved) setTheme(saved);
else setTheme('dark');

// ===== SIDEBAR =====
function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

menuBtn.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

newChatBtn.addEventListener('click', () => {
  resetChat();
  closeSidebar();
});

// ===== FILE HANDLING =====
attachBtn.addEventListener('click', () => {
  if (!dropZone.classList.contains('visible')) {
    dropZone.classList.add('visible');
    dropZone.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

dropZone.addEventListener('click', () => fileInput.click());

// Drag and drop
document.addEventListener('dragover', (e) => e.preventDefault());

dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', (e) => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (!allowed.includes(file.type)) {
    showToast('Only PDF, JPG, and PNG files are supported.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File size must be under 10MB.', 'error');
    return;
  }

  selectedFile = file;
  dropZone.classList.remove('visible');
  filePreview.style.display = 'block';
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileIcon.textContent = file.type === 'application/pdf' ? '📄' : '🖼️';
}

fileRemove.addEventListener('click', () => {
  selectedFile = null;
  filePreview.style.display = 'none';
  fileInput.value = '';
  dropZone.classList.add('visible');
});

generateBtn.addEventListener('click', processFile);

// ===== PROCESSING =====
async function processFile() {
  if (!selectedFile || isProcessing) return;
  isProcessing = true;

  // Hide welcome, show file preview starts
  welcome.style.display = 'none';

  // Remove drop zone
  dropZone.classList.remove('visible');
  filePreview.style.display = 'none';
  fileInput.value = '';

  // Add user message
  addUserMessage(selectedFile);

  // Add typing indicator
  const typingEl = addTypingIndicator();
  scrollToBottom();

  try {
    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await fetch('/api/process', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    removeTypingIndicator(typingEl);

    if (!response.ok || data.error) {
      addErrorMessage(data.error || 'Something went wrong. Please try again.');
    } else {
      addAIMessage(data.questions);
    }
  } catch (err) {
    removeTypingIndicator(typingEl);
    addErrorMessage('Network error. Please check your connection and try again.');
  }

  isProcessing = false;
  selectedFile = null;
  scrollToBottom();
}

// ===== MESSAGE BUILDERS =====
function addUserMessage(file) {
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `
    <div class="msg-avatar">U</div>
    <div class="msg-body">
      <span class="msg-name">You</span>
      <div class="msg-bubble">
        <div class="msg-file">
          <span class="msg-file-icon">${file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
          <div class="msg-file-info">
            <span class="msg-file-name">${escapeHtml(file.name)}</span>
            <span class="msg-file-meta">${formatBytes(file.size)} · Generate exam questions</span>
          </div>
        </div>
      </div>
    </div>
  `;
  messages.appendChild(div);
}

function addAIMessage(markdown) {
  const div = document.createElement('div');
  div.className = 'message ai';

  // Render markdown safely
  const rendered = marked.parse(markdown);

  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <span class="msg-name">ExamAI</span>
      <div class="msg-bubble">${rendered}</div>
    </div>
  `;
  messages.appendChild(div);
  messageCount++;
}

function addErrorMessage(text) {
  const div = document.createElement('div');
  div.className = 'message ai';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <span class="msg-name">ExamAI</span>
      <div class="error-bubble">⚠️ ${escapeHtml(text)}</div>
    </div>
  `;
  messages.appendChild(div);
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar" style="width:32px;height:32px;border-radius:50%;background:var(--bg-elevated);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">🤖</div>
    <div>
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <div class="typing-label" style="margin-top:4px;font-size:0.72rem;color:var(--text-muted);">Analyzing content & generating questions…</div>
    </div>
  `;
  messages.appendChild(div);
  return div;
}

function removeTypingIndicator(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ===== RESET =====
function resetChat() {
  messages.innerHTML = '';
  welcome.style.display = 'flex';
  dropZone.classList.remove('visible');
  filePreview.style.display = 'none';
  fileInput.value = '';
  selectedFile = null;
  isProcessing = false;
  messageCount = 0;
}

// ===== UTILS =====
function scrollToBottom() {
  setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// ===== MARKED CONFIG =====
marked.setOptions({
  breaks: true,
  gfm: true
});

// ===== INIT: show drop zone =====
dropZone.classList.add('visible');
