// --- State Management ---
let tasks = [];

// Sample data for the first-time visit
const SAMPLE_TASKS = [
  {
    id: "sample-1",
    title: "ポートフォリオのデザインカンプ作成",
    desc: "Figmaを使ってGlassmorphismスタイルのダッシュボードデザインを設計する。グラデーションと透過光エフェクトを多用する。",
    priority: "high",
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
    status: "done",
    createdAt: new Date().toISOString()
  },
  {
    id: "sample-2",
    title: "ドラッグ＆ドロップ機能のコーディング",
    desc: "HTML5 Drag and Drop APIを使用して、カラム間でのタスク移動を実装する。ドラッグ時のプレースホルダー表示を追加する。",
    priority: "medium",
    dueDate: new Date().toISOString().split('T')[0], // Today
    status: "progress",
    createdAt: new Date().toISOString()
  },
  {
    id: "sample-3",
    title: "モバイルレスポンシブの微調整",
    desc: "スマートフォンやタブレットなど、あらゆる画面幅での表示を確認し、タスクカードとカラムの余白を調整する。",
    priority: "low",
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0], // Day after tomorrow
    status: "todo",
    createdAt: new Date().toISOString()
  }
];

// --- DOM Elements ---
const modal = document.getElementById("task-modal");
const taskForm = document.getElementById("task-form");
const modalTitle = document.getElementById("modal-title");
const btnNewTask = document.getElementById("btn-new-task");
const btnCancel = document.getElementById("btn-cancel");
const btnClose = document.getElementById("modal-close");
const searchInput = document.getElementById("search-input");
const priorityFilter = document.getElementById("priority-filter");
const currentDateSpan = document.getElementById("current-date");

// Form Inputs
const inputId = document.getElementById("task-id");
const inputTitle = document.getElementById("task-title-input");
const inputDesc = document.getElementById("task-desc-input");
const inputPriority = document.getElementById("task-priority-input");
const inputDate = document.getElementById("task-date-input");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  // Set current date in header
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
  currentDateSpan.textContent = new Date().toLocaleDateString('ja-JP', options);

  // Load tasks from Firestore or use samples
  const fetchTasks = async () => {
    try {
      const snapshot = await db.collection("tasks").get();
      if (!snapshot.empty) {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        tasks = [...SAMPLE_TASKS];
        // Initialize Firestore with sample tasks
        const batch = db.batch();
        SAMPLE_TASKS.forEach(task => {
          const docRef = db.collection("tasks").doc(task.id);
          batch.set(docRef, task);
        });
        await batch.commit();
      }
    } catch (err) {
      console.error("Error loading tasks:", err);
      tasks = [...SAMPLE_TASKS];
    }
  };
  await fetchTasks();

  // Render lists
  renderBoard();
  setupDragAndDrop();
  lucide.createIcons(); // Initialize icons
});

// --- Firestore replaces localStorage; no localStorage function needed ---

// --- Render Board ---
function renderBoard() {
  const todoBody = document.getElementById("body-todo");
  const progressBody = document.getElementById("body-progress");
  const doneBody = document.getElementById("body-done");

  // Clear current HTML
  todoBody.innerHTML = "";
  progressBody.innerHTML = "";
  doneBody.innerHTML = "";

  const searchQuery = searchInput.value.toLowerCase().trim();
  const filterPriority = priorityFilter.value;

  const today = new Date().toISOString().split('T')[0];

  // Counters
  let counts = { todo: 0, progress: 0, done: 0 };

  tasks.forEach(task => {
    // 1. Filter checks
    const matchesSearch = task.title.toLowerCase().includes(searchQuery) || 
                          task.desc.toLowerCase().includes(searchQuery);
    const matchesPriority = filterPriority === "all" || task.priority === filterPriority;

    if (!matchesSearch || !matchesPriority) return;

    // Increment counter
    counts[task.status]++;

    // 2. Generate task card element
    const isOverdue = task.dueDate && task.dueDate < today && task.status !== "done";
    const formattedDate = task.dueDate ? formatDate(task.dueDate) : "期限なし";

    const card = document.createElement("div");
    card.classList.add("task-card");
    card.setAttribute("draggable", "true");
    card.setAttribute("data-id", task.id);
    
    card.innerHTML = `
      <div class="card-header">
        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
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
      <p>${escapeHTML(task.desc || "説明はありません。")}</p>
      <div class="card-footer">
        <span class="due-date ${isOverdue ? 'overdue' : ''}">
          <i data-lucide="${isOverdue ? 'alert-triangle' : 'calendar'}"></i>
          ${isOverdue ? '期限切れ: ' : ''}${formattedDate}
        </span>
      </div>
    `;

    // 3. Append to correct column
    if (task.status === "todo") {
      todoBody.appendChild(card);
    } else if (task.status === "progress") {
      progressBody.appendChild(card);
    } else if (task.status === "done") {
      doneBody.appendChild(card);
    }
  });

  // Update headers count badges
  document.getElementById("count-todo").textContent = counts.todo;
  document.getElementById("count-progress").textContent = counts.progress;
  document.getElementById("count-done").textContent = counts.done;

  // Update top stats
  updateStats();
  
  // Re-enable Lucide icons in newly rendered HTML
  lucide.createIcons();
  
  // Re-bind drag events to new DOM nodes
  setupDragAndDrop();
}

// --- Drag & Drop logic ---
function setupDragAndDrop() {
  const cards = document.querySelectorAll(".task-card");
  const columnBodies = document.querySelectorAll(".column-body");

  cards.forEach(card => {
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", card.getAttribute("data-id"));
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      columnBodies.forEach(body => body.classList.remove("drag-over"));
    });
  });

  columnBodies.forEach(body => {
    body.addEventListener("dragover", (e) => {
      e.preventDefault(); // Required to allow drop
      body.classList.add("drag-over");
    });

    body.addEventListener("dragleave", () => {
      body.classList.remove("drag-over");
    });

    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      
      const taskId = e.dataTransfer.getData("text/plain");
      const targetColumn = body.closest(".board-column").getAttribute("data-status");
      
      if (taskId) {
        updateTaskStatus(taskId, targetColumn);
      }
    });
  });
}

function updateTaskStatus(id, newStatus) {
  const taskIndex = tasks.findIndex(t => t.id === id);
  if (taskIndex !== -1 && tasks[taskIndex].status !== newStatus) {
    tasks[taskIndex].status = newStatus;
    // Update status in Firestore
    db.collection("tasks").doc(id).update({ status: newStatus })
      .catch(err => console.error("Error updating status:", err));
    renderBoard();
  }
}

// --- HTML5 Drag/Drop attribute handlers (fallback / global safety) ---
window.allowDrop = function(ev) {
  ev.preventDefault();
};

window.drop = function(ev) {
  ev.preventDefault();
};

// --- Stats calculation ---
function updateStats() {
  const total = tasks.length;
  const progress = tasks.filter(t => t.status === "progress").length;
  const done = tasks.filter(t => t.status === "done").length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-progress").textContent = progress;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("stat-rate").textContent = `${rate}%`;
}

// --- Modal Control ---
function openModal(isEdit = false) {
  modal.classList.add("active");
  if (!isEdit) {
    modalTitle.textContent = "新規タスクの追加";
    taskForm.reset();
    inputId.value = "";
    // Default to today's date
    inputDate.value = new Date().toISOString().split('T')[0];
  } else {
    modalTitle.textContent = "タスクの編集";
  }
}

function closeModal() {
  modal.classList.remove("active");
}

// --- Event Listeners ---
btnNewTask.addEventListener("click", () => openModal(false));
btnCancel.addEventListener("click", closeModal);
btnClose.addEventListener("click", closeModal);

// Modal overlay click to close
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Form Submission (Create or Edit)
taskForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = inputId.value;
  const title = inputTitle.value.trim();
  const desc = inputDesc.value.trim();
  const priority = inputPriority.value;
  const dueDate = inputDate.value;

  if (id) {
    // Edit existing task
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = {
        ...tasks[index],
        title,
        desc,
        priority,
        dueDate
      };
    }
  } else {
    // Create new task
    const newTask = {
      id: "task-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      title,
      desc,
      priority,
      dueDate,
      status: "todo",
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
  }

    // Sync changes to Firestore
    if (id) {
      db.collection("tasks").doc(id).set(tasks[index])
        .catch(err => console.error("Error updating task:", err));
    } else {
      db.collection("tasks").add(newTask)
        .catch(err => console.error("Error adding task:", err));
    }
    renderBoard();
    closeModal();
});

// Search & Filter Events
searchInput.addEventListener("input", renderBoard);
priorityFilter.addEventListener("change", renderBoard);

// --- Task Action Helper Functions (Global Scope) ---
window.deleteTask = function(id) {
  if (confirm("このタスクを削除してもよろしいですか？")) {
    tasks = tasks.filter(t => t.id !== id);
    db.collection("tasks").doc(id).delete()
      .catch(err => console.error("Error deleting task:", err));
    renderBoard();
  }
};

window.editTask = function(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  inputId.value = task.id;
  inputTitle.value = task.title;
  inputDesc.value = task.desc;
  inputPriority.value = task.priority;
  inputDate.value = task.dueDate || "";

  openModal(true);
};

// --- General Helpers ---
function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}
