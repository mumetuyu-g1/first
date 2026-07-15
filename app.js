// ============================================================
// app.js  –  Glassflow Board Main Logic
// ============================================================

// --- Global State ---
let tasks = [];
let currentUid = null; // set after Google sign-in

// Helper: returns Firestore collection reference for the current user
function tasksCollection() {
  if (currentUid) {
    return db.collection('users').doc(currentUid).collection('tasks');
  }
  // Fallback: shared collection (unauthenticated demo mode)
  return db.collection('tasks');
}

// --- Sample Data (first-time visitors) ---
const SAMPLE_TASKS = [
  {
    id: 'sample-1',
    title: 'ポートフォリオのデザインカンプ作成',
    desc: 'Figmaを使ってGlassmorphismスタイルのダッシュボードデザインを設計する。',
    priority: 'high',
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    status: 'done',
    category: '仕事',
    tags: ['design', 'figma'],
    assignee: '',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-2',
    title: 'ドラッグ＆ドロップ機能のコーディング',
    desc: 'HTML5 Drag and Drop APIを使用してカラム間でのタスク移動を実装する。',
    priority: 'medium',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'progress',
    category: '勉強',
    tags: ['javascript'],
    assignee: 'Taro',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-3',
    title: 'モバイルレスポンシブの微調整',
    desc: 'スマートフォンやタブレットなど、あらゆる画面幅での表示を確認する。',
    priority: 'low',
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    status: 'todo',
    category: 'その他',
    tags: ['css', 'responsive'],
    assignee: '',
    createdAt: new Date().toISOString()
  }
];

// --- DOM Elements ---
const modal             = document.getElementById('task-modal');
const taskForm          = document.getElementById('task-form');
const modalTitle        = document.getElementById('modal-title');
const btnNewTask        = document.getElementById('btn-new-task');
const btnCancel         = document.getElementById('btn-cancel');
const btnClose          = document.getElementById('modal-close');
const searchInput       = document.getElementById('search-input');
const priorityFilter    = document.getElementById('priority-filter');
const categoryFilter    = document.getElementById('category-filter');
const currentDateSpan   = document.getElementById('current-date');

// Form Inputs
const inputId           = document.getElementById('task-id');
const inputTitle        = document.getElementById('task-title-input');
const inputDesc         = document.getElementById('task-desc-input');
const inputPriority     = document.getElementById('task-priority-input');
const inputDate         = document.getElementById('task-date-input');
const inputCategory     = document.getElementById('task-category-input');
const inputAssignee     = document.getElementById('task-assignee-input');
const inputTags         = document.getElementById('task-tags-input');

// Auth Elements
const btnGoogleSignin   = document.getElementById('btn-google-signin');
const btnSignout        = document.getElementById('btn-signout');
const authSignedOut     = document.getElementById('auth-signed-out');
const authSignedIn      = document.getElementById('auth-signed-in');
const userAvatar        = document.getElementById('user-avatar');
const userNameSpan      = document.getElementById('user-name');

// ============================================================
// AUTHENTICATION
// ============================================================
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error('[Auth] Google sign-in error:', err);
    alert('Googleログインに失敗しました: ' + err.message);
  });
}

function signOut() {
  auth.signOut().catch(err => console.error('[Auth] Sign-out error:', err));
}

// 監視用リスナーを整理
auth.onAuthStateChanged(async user => {
  if (user) {
    // 確実にuidをセットしてからロードに入る
    currentUid = user.uid;
    
    // UIをログイン状態へ
    authSignedOut.style.display = 'none';
    authSignedIn.style.display  = 'flex';
    userAvatar.src = user.photoURL || '';
    userAvatar.style.display = user.photoURL ? 'block' : 'none';
    userNameSpan.textContent = user.displayName || user.email || '';

    // Firestoreからデータを引っ張ってくる
    await loadTasksFromFirestore(user.uid);
  } else {
    currentUid = null;
    
    // UIを未ログイン状態へ
    authSignedOut.style.display = 'flex';
    authSignedIn.style.display  = 'none';
    userAvatar.src = '';
    userNameSpan.textContent = '';

    // 未ログイン時はFirestoreを叩かず、純粋にローカル（メモリ）でサンプルを動かす
    // ※これでFirestoreのセキュリティエラーを防ぐ
    tasks = [...SAMPLE_TASKS];
  }
  
  // ロード完了後にレンダーを走らせる
  renderBoard();
  lucide.createIcons();
});

btnGoogleSignin.addEventListener('click', signInWithGoogle);
btnSignout.addEventListener('click', signOut);

// ============================================================
// FIRESTORE
// ============================================================
// 引数として明示的にuidを受け取る設計に変更
async function loadTasksFromFirestore(uid) {
  if (!uid) {
    tasks = [...SAMPLE_TASKS];
    return;
  }

  try {
    const colRef = db.collection('users').doc(uid).collection('tasks');
    const snapshot = await colRef.get();
    
    if (!snapshot.empty) {
      tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // ユーザーの初回ログイン時：サンプルデータを個人用コレクションに保存する
      tasks = [...SAMPLE_TASKS];
      const batch = db.batch();
      SAMPLE_TASKS.forEach(task => {
        const docRef = colRef.doc(task.id);
        batch.set(docRef, task);
      });
      await batch.commit();
      console.log('[Firestore] Initial sample tasks written for user:', uid);
    }
  } catch (err) {
    console.error('[Firestore] Error loading tasks:', err);
    // エラーが起きた場合は安全のためにサンプルデータを表示
    tasks = [...SAMPLE_TASKS];
  }
}
// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Set current date in header
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  currentDateSpan.textContent = new Date().toLocaleDateString('ja-JP', options);

  // Auth state listener above handles initial data load + render
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[PWA] SW registered:', reg.scope))
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
  }
});

// ============================================================
// RENDER BOARD
// ============================================================
function renderBoard() {
  const todoBody     = document.getElementById('body-todo');
  const progressBody = document.getElementById('body-progress');
  const doneBody     = document.getElementById('body-done');

  todoBody.innerHTML     = '';
  progressBody.innerHTML = '';
  doneBody.innerHTML     = '';

  const searchQuery    = searchInput.value.toLowerCase().trim();
  const filterPriority = priorityFilter.value;
  const filterCategory = categoryFilter ? categoryFilter.value : 'all';
  const today          = new Date().toISOString().split('T')[0];
  let counts           = { todo: 0, progress: 0, done: 0 };

  tasks.forEach(task => {
    // Filter checks
    const matchesSearch   = task.title.toLowerCase().includes(searchQuery) ||
                            (task.desc || '').toLowerCase().includes(searchQuery);
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory;

    if (!matchesSearch || !matchesPriority || !matchesCategory) return;

    counts[task.status]++;

    const isOverdue    = task.dueDate && task.dueDate < today && task.status !== 'done';
    const formattedDate = task.dueDate ? formatDate(task.dueDate) : '期限なし';

    // Tags HTML
    const tagsHTML = (task.tags && task.tags.length > 0)
      ? task.tags.map(t => `<span class="tag-chip">${escapeHTML(t)}</span>`).join('')
      : '';

    // Assignee HTML
    const assigneeHTML = task.assignee
      ? `<span class="assignee-label"><i data-lucide="user"></i> ${escapeHTML(task.assignee)}</span>`
      : '';

    // Category badge color map
    const categoryColors = {
      '仕事': 'cat-work',
      'プライベート': 'cat-private',
      '勉強': 'cat-study',
      'その他': 'cat-other'
    };
    const catClass = categoryColors[task.category] || 'cat-other';

    const card = document.createElement('div');
    card.classList.add('task-card');
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', task.id);

    card.innerHTML = `
      <div class="card-header">
        <div class="card-badges">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${task.category ? `<span class="category-badge ${catClass}">${escapeHTML(task.category)}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-icon edit" onclick="editTask('${task.id}')" title="編集">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="btn-icon delete" onclick="deleteTask('${task.id}')" title="削除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
      <h3>${escapeHTML(task.title)}</h3>
      <p>${escapeHTML(task.desc || '説明はありません。')}</p>
      ${tagsHTML ? `<div class="tags-row">${tagsHTML}</div>` : ''}
      <div class="card-footer">
        <span class="due-date ${isOverdue ? 'overdue' : ''}">
          <i data-lucide="${isOverdue ? 'alert-triangle' : 'calendar'}"></i>
          ${isOverdue ? '期限切れ: ' : ''}${formattedDate}
        </span>
        ${assigneeHTML}
      </div>
    `;

    if (task.status === 'todo')           todoBody.appendChild(card);
    else if (task.status === 'progress')  progressBody.appendChild(card);
    else if (task.status === 'done')      doneBody.appendChild(card);
  });

  document.getElementById('count-todo').textContent     = counts.todo;
  document.getElementById('count-progress').textContent = counts.progress;
  document.getElementById('count-done').textContent     = counts.done;

  updateStats();
  lucide.createIcons();
  setupDragAndDrop();
}

// ============================================================
// DRAG & DROP
// ============================================================
function setupDragAndDrop() {
  const cards       = document.querySelectorAll('.task-card');
  const columnBodies = document.querySelectorAll('.column-body');

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      columnBodies.forEach(b => b.classList.remove('drag-over'));
    });
  });

  columnBodies.forEach(body => {
    body.addEventListener('dragover', e => {
      e.preventDefault();
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const targetColumn = body.closest('.board-column').getAttribute('data-status');
      if (taskId) updateTaskStatus(taskId, targetColumn);
    });
  });
}

function updateTaskStatus(id, newStatus) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1 && tasks[idx].status !== newStatus) {
    tasks[idx].status = newStatus;
    tasksCollection().doc(id).update({ status: newStatus })
      .catch(err => console.error('[Firestore] Error updating status:', err));
    renderBoard();
  }
}

// Global fallback handlers for ondragover/ondrop attributes
window.allowDrop = ev => ev.preventDefault();
window.drop      = ev => ev.preventDefault();

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const total    = tasks.length;
  const progress = tasks.filter(t => t.status === 'progress').length;
  const done     = tasks.filter(t => t.status === 'done').length;
  const rate     = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-progress').textContent = progress;
  document.getElementById('stat-done').textContent     = done;
  document.getElementById('stat-rate').textContent     = `${rate}%`;
}

// ============================================================
// MODAL
// ============================================================
function openModal(isEdit = false) {
  modal.classList.add('active');
  if (!isEdit) {
    modalTitle.textContent = '新規タスクの追加';
    taskForm.reset();
    inputId.value   = '';
    inputDate.value = new Date().toISOString().split('T')[0];
  } else {
    modalTitle.textContent = 'タスクの編集';
  }
}

function closeModal() {
  modal.classList.remove('active');
}

btnNewTask.addEventListener('click', () => openModal(false));
btnCancel.addEventListener('click', closeModal);
btnClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

// ============================================================
// FORM SUBMIT (Create / Edit)
// ============================================================
taskForm.addEventListener('submit', async e => {
  e.preventDefault();

  const id       = inputId.value;
  const title    = inputTitle.value.trim();
  const desc     = inputDesc.value.trim();
  const priority = inputPriority.value;
  const dueDate  = inputDate.value;
  const category = inputCategory.value;
  const assignee = inputAssignee.value.trim();
  const tags     = inputTags.value
                    .split(',')
                    .map(t => t.trim())
                    .filter(t => t.length > 0);

  if (id) {
    // Edit existing
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], title, desc, priority, dueDate, category, assignee, tags };
      tasksCollection().doc(id).set(tasks[idx])
        .catch(err => console.error('[Firestore] Error updating task:', err));
    }
  } else {
    // Create new
    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title, desc, priority, dueDate, category, assignee, tags,
      status: 'todo',
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    tasksCollection().doc(newTask.id).set(newTask)
      .catch(err => console.error('[Firestore] Error adding task:', err));
  }

  renderBoard();
  closeModal();
});

// ============================================================
// SEARCH & FILTER
// ============================================================
searchInput.addEventListener('input', renderBoard);
priorityFilter.addEventListener('change', renderBoard);
if (categoryFilter) categoryFilter.addEventListener('change', renderBoard);

// ============================================================
// TASK ACTIONS (Global Scope)
// ============================================================
window.deleteTask = function(id) {
  if (confirm('このタスクを削除してもよろしいですか？')) {
    tasks = tasks.filter(t => t.id !== id);
    tasksCollection().doc(id).delete()
      .catch(err => console.error('[Firestore] Error deleting task:', err));
    renderBoard();
  }
};

window.editTask = function(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  inputId.value       = task.id;
  inputTitle.value    = task.title;
  inputDesc.value     = task.desc || '';
  inputPriority.value = task.priority;
  inputDate.value     = task.dueDate || '';
  inputCategory.value = task.category || '仕事';
  inputAssignee.value = task.assignee || '';
  inputTags.value     = (task.tags || []).join(', ');

  openModal(true);
};

// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
