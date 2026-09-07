// Field Log — Task Tracker frontend logic.
// BACKEND_URL is baked into config.js at container start (see docker-entrypoint.sh),
// never hardcoded here.
(function () {
  const BACKEND_URL = (window.__CONFIG__ && window.__CONFIG__.BACKEND_URL) || '';
  const API = `${BACKEND_URL}/api/tasks`;

  const listEl = document.getElementById('taskList');
  const emptyEl = document.getElementById('emptyState');
  const formEl = document.getElementById('newTaskForm');
  const titleInput = document.getElementById('titleInput');
  const descInput = document.getElementById('descInput');
  const errorEl = document.getElementById('formError');
  const statusPill = document.getElementById('statusPill');
  const template = document.getElementById('entryTemplate');

  const STAMP_TEXT = {
    pending: 'pending',
    in_progress: 'in progress',
    done: 'done ✓',
  };

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderTasks(tasks) {
    listEl.innerHTML = '';
    emptyEl.hidden = tasks.length !== 0;

    for (const task of tasks) {
      const node = template.content.firstElementChild.cloneNode(true);
      node.classList.add(`status-${task.status}`);
      node.dataset.id = task.id;

      node.querySelector('.entry-title').textContent = task.title;
      node.querySelector('.entry-id').textContent = `#${task.id} · ${formatDate(task.created_at)}`;
      node.querySelector('.entry-desc').textContent = task.description || '';
      node.querySelector('.entry-stamp').textContent = STAMP_TEXT[task.status] || task.status;

      const select = node.querySelector('.entry-status-select');
      select.value = task.status;
      select.addEventListener('change', () => updateStatus(task.id, select.value));

      node.querySelector('.tear-btn').addEventListener('click', () => deleteTask(task.id, node));

      listEl.appendChild(node);
    }
  }

  async function loadTasks() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`load failed: ${res.status}`);
      renderTasks(await res.json());
    } catch (err) {
      showError(`could not load the ledger (${err.message})`);
    }
  }

  async function createTask(evt) {
    evt.preventDefault();
    showError('');
    const title = titleInput.value.trim();
    if (!title) return;

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: descInput.value.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `request failed: ${res.status}`);
      }
      titleInput.value = '';
      descInput.value = '';
      await loadTasks();
    } catch (err) {
      showError(err.message);
    }
  }

  async function updateStatus(id, status) {
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      await loadTasks();
    } catch (err) {
      showError(err.message);
    }
  }

  async function deleteTask(id, node) {
    node.classList.add('leaving');
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(`delete failed: ${res.status}`);
      setTimeout(() => node.remove(), 380);
    } catch (err) {
      node.classList.remove('leaving');
      showError(err.message);
    }
  }

  async function checkStatus() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`);
      const body = await res.json();
      if (res.ok && body.db === 'connected') {
        statusPill.textContent = 'backend + db online';
        statusPill.className = 'status-pill status-pill--ok';
      } else {
        statusPill.textContent = 'backend up, db unreachable';
        statusPill.className = 'status-pill status-pill--down';
      }
    } catch {
      statusPill.textContent = 'backend unreachable';
      statusPill.className = 'status-pill status-pill--down';
    }
  }

  formEl.addEventListener('submit', createTask);

  checkStatus();
  loadTasks();
  setInterval(checkStatus, 15000);
})();
