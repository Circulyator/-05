const SUPABASE_URL = 'https://dtuaygbjszhrwqkfvknf.supabase.co/rest/v1/';
const SUPABASE_KEY = 'sb_publishable_k7vWq8Qt_WwlbJF3RvpR2Q_Wmx6RMy7';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadData() {
    const { data: t } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
    tickets = t || [];
    if (tickets.length > 0) {
        const parts = tickets[0].number.split('-');
        nextTicketId = parseInt(parts[parts.length - 1]) + 1;
    }

    const { data: kb } = await supabase.from('knowledge_base').select('*');
    knowledgeBase = kb || [];

    if (currentUser) {
        const { data: n } = await supabase.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        notifications = n || [];
        updateNotifBadge();
    }
}

// ==================== АВТОРИЗАЦИЯ ====================
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authError').textContent = '';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authError').textContent = '';
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const error = document.getElementById('authError');

    if (!email || !password) { error.textContent = 'Заполните все поля'; return; }

    const { data: user, error: err } = await supabase.from('users').select('*').eq('email', email).eq('password_hash', password).single();
    if (err || !user) { error.textContent = 'Неверный email или пароль'; return; }

    currentUser = user;
    await loadData();
    showMainInterface();
}

async function register() {
    const fullName = document.getElementById('regFullName').value.trim();
    const department = document.getElementById('regDepartment').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    const error = document.getElementById('authError');

    if (!fullName || !email || !password) { error.textContent = 'Заполните ФИО, Email и Пароль'; return; }
    if (password.length < 3) { error.textContent = 'Пароль должен быть от 3 символов'; return; }
    if (password !== password2) { error.textContent = 'Пароли не совпадают'; return; }

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) { error.textContent = 'Пользователь с таким email уже существует'; return; }

    const { data: newUser, error: insertErr } = await supabase.from('users').insert({
        email, password_hash: password, role: 'user', full_name: fullName, department: department || 'Не указан'
    }).select().single();

    if (insertErr) { error.textContent = 'Ошибка регистрации'; return; }

    currentUser = newUser;
    await loadData();
    showMainInterface();
}

function showMainInterface() {
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('currentUserName').textContent = currentUser.full_name;

    const roleNames = { chief: 'Начальник IT-отдела', admin: 'Системный администратор', user: 'Пользователь' };
    document.getElementById('currentUserRole').textContent = roleNames[currentUser.role] || '—';

    if (currentUser.role === 'user') {
        document.querySelectorAll('.nav-link[data-page="dashboard"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nav-link[data-page="kanban"]').forEach(el => el.style.display = 'none');
    }
    if (currentUser.role === 'admin') {
        document.querySelectorAll('.nav-link[data-page="dashboard"]').forEach(el => el.style.display = 'none');
    }

    renderAll();
    navigateTo(currentUser.role === 'user' ? 'tickets' : 'dashboard');
}

function logout() {
    currentUser = null;
    tickets = [];
    knowledgeBase = [];
    notifications = [];
    document.getElementById('authPage').style.display = 'flex';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => { l.classList.remove('active'); l.style.display = ''; });
}

// ==================== НАВИГАЦИЯ ====================
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (link) link.classList.add('active');
    if (page === 'dashboard') renderDashboard();
    if (page === 'tickets') renderTickets();
    if (page === 'kanban') renderKanban();
    if (page === 'knowledge') renderKnowledgeBase();
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(link.dataset.page); });
});

// ==================== ДАШБОРД ====================
function renderDashboard() {
    document.getElementById('widgetTotal').textContent = tickets.length;
    document.getElementById('widgetOpen').textContent = tickets.filter(t => t.status === 'new').length;
    document.getElementById('widgetOverdue').textContent = tickets.filter(t => t.status === 'new' || t.status === 'in_progress').length;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('widgetResolved').textContent = tickets.filter(t => t.status === 'resolved' && t.resolved_at && t.resolved_at.startsWith(today)).length;

    const canvas = document.getElementById('loadChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    supabase.from('users').select('*').eq('role', 'admin').then(({ data: admins }) => {
        if (!admins || admins.length === 0) return;
        const barWidth = w / admins.length - 60;
        admins.forEach((admin, i) => {
            const count = tickets.filter(t => t.assignee_id === admin.id && t.status === 'in_progress').length;
            const barH = count * 40;
            const x = 40 + i * (barWidth + 60);
            const y = h - barH - 40;
            ctx.fillStyle = '#1E5AFA';
            ctx.fillRect(x, y, barWidth, barH);
            ctx.fillStyle = '#1A1D26';
            ctx.font = '14px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(count + ' заявок', x + barWidth / 2, y - 10);
            ctx.fillText(admin.full_name, x + barWidth / 2, h - 10);
        });
        ctx.beginPath();
        ctx.strokeStyle = '#E5E7EB';
        ctx.moveTo(30, h - 40);
        ctx.lineTo(w - 10, h - 40);
        ctx.stroke();
    });
}

// ==================== ЗАЯВКИ ====================
function renderTickets() {
    const status = document.getElementById('filterStatus')?.value || 'all';
    const priority = document.getElementById('filterPriority')?.value || 'all';
    const search = (document.getElementById('filterSearch')?.value || '').toLowerCase();

    let filtered = tickets;
    if (status !== 'all') filtered = filtered.filter(t => t.status === status);
    if (priority !== 'all') filtered = filtered.filter(t => t.priority === priority);
    if (search) filtered = filtered.filter(t => t.number.toLowerCase().includes(search) || t.title.toLowerCase().includes(search));

    const priorityLabels = { critical: 'Критический', high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const statusLabels = { new: 'Новая', in_progress: 'В работе', resolved: 'Решена', closed: 'Закрыта' };
    const categoryLabels = { hardware: 'Оборудование', software: 'ПО', network: 'Сеть', access: 'Доступы', other: 'Другое' };

    document.getElementById('ticketsBody').innerHTML = filtered.map(t => `
        <tr>
            <td><strong>${t.number}</strong></td>
            <td>${t.title}</td>
            <td>${categoryLabels[t.category] || t.category}</td>
            <td><span class="priority priority--${t.priority}">${priorityLabels[t.priority]}</span></td>
            <td><span class="status status--${t.status}">${statusLabels[t.status]}</span></td>
            <td>${new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
        </tr>
    `).join('');
}

// ==================== КАНБАН ====================
function renderKanban() {
    const cols = {
        new: { el: document.getElementById('colNew'), count: document.getElementById('countNew') },
        in_progress: { el: document.getElementById('colProgress'), count: document.getElementById('countProgress') },
        resolved: { el: document.getElementById('colResolved'), count: document.getElementById('countResolved') },
        closed: { el: document.getElementById('colClosed'), count: document.getElementById('countClosed') },
    };

    for (const [status, data] of Object.entries(cols)) {
        if (!data.el) continue;
        const filtered = tickets.filter(t => t.status === status);
        data.count.textContent = filtered.length;
        const priorityLabels = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
        data.el.innerHTML = filtered.map(t => `
            <div class="kanban__card" onclick="changeStatus(${t.id})">
                <div class="kanban__card-title">${priorityLabels[t.priority]} ${t.title}</div>
                <div class="kanban__card-meta">${t.number}</div>
            </div>
        `).join('');
    }
}

async function changeStatus(id) {
    const ticket = tickets.find(t => t.id === id);
    const flow = { new: 'in_progress', in_progress: 'resolved', resolved: 'closed', closed: 'new' };
    const newStatus = flow[ticket.status];
    const updates = { status: newStatus };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    if (newStatus === 'closed') updates.closed_at = new Date().toISOString();

    await supabase.from('tickets').update(updates).eq('id', id);

    const statusLabels = { new: 'создана', in_progress: 'в работе', resolved: 'решена', closed: 'закрыта' };
    await supabase.from('notifications').insert({
        user_id: currentUser.id,
        ticket_id: id,
        message: `Заявка ${ticket.number} "${ticket.title}" → "${statusLabels[newStatus]}"`
    });

    await loadData();
    renderKanban();
    renderTickets();
    renderDashboard();
}

// ==================== БАЗА ЗНАНИЙ ====================
function renderKnowledgeBase() {
    const search = (document.getElementById('kbSearch')?.value || '').toLowerCase();
    let filtered = knowledgeBase;
    if (search) filtered = knowledgeBase.filter(k => k.title.toLowerCase().includes(search) || (k.tags || '').toLowerCase().includes(search));

    const categoryLabels = { hardware: '🖥️ Оборудование', software: '💿 ПО', network: '🌐 Сеть', access: '🔑 Доступы', other: '📌 Другое' };
    document.getElementById('kbGrid').innerHTML = filtered.map(k => `
        <div class="kb-card">
            <h3>${categoryLabels[k.category] || ''} ${k.title}</h3>
            <p><strong>Проблема:</strong> ${k.problem}</p>
            <p><strong>Решение:</strong> ${k.solution}</p>
            <p style="font-size:11px;color:var(--text-light);margin-top:8px;">Теги: ${k.tags || ''}</p>
        </div>
    `).join('');
}

// ==================== УВЕДОМЛЕНИЯ ====================
function updateNotifBadge() {
    const unread = notifications.filter(n => !n.is_read).length;
    const badge = document.getElementById('notifCount');
    const dropdown = document.getElementById('notifDropdown');
    if (badge) badge.textContent = unread;
    if (dropdown) {
        dropdown.innerHTML = notifications.length > 0
            ? notifications.slice(0, 5).map(n => `<div style="padding:8px;border-bottom:1px solid #eee;font-size:13px;${n.is_read ? '' : 'font-weight:600;'}">${n.message}</div>`).join('')
            : '<p class="notifications__empty">Уведомлений пока нет</p>';
    }
}

// ==================== МОДАЛКИ ====================
function openTicketModal() { document.getElementById('ticketModal').style.display = 'flex'; }
function closeTicketModal() {
    document.getElementById('ticketModal').style.display = 'none';
    document.getElementById('ticketTitle').value = '';
    document.getElementById('ticketDescription').value = '';
    document.getElementById('ticketError').textContent = '';
}

async function createTicket() {
    const title = document.getElementById('ticketTitle').value.trim();
    const category = document.getElementById('ticketCategory').value;
    const priority = document.getElementById('ticketPriority').value;
    const description = document.getElementById('ticketDescription').value.trim();
    const error = document.getElementById('ticketError');

    if (!title || !category) { error.textContent = 'Заполните обязательные поля'; return; }

    const number = `INC-2026-${String(nextTicketId).padStart(4, '0')}`;
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
    const assigneeId = admins?.[0]?.id || null;

    const { error: insertErr } = await supabase.from('tickets').insert({ number, title, description, category, priority, status: 'new', creator_id: currentUser.id, assignee_id: assigneeId });
    if (insertErr) { error.textContent = 'Ошибка создания заявки'; return; }

    nextTicketId++;
    closeTicketModal();
    await loadData();
    renderTickets();
    renderKanban();
    renderDashboard();
}

function openKbModal() { document.getElementById('kbModal').style.display = 'flex'; }
function closeKbModal() { document.getElementById('kbModal').style.display = 'none'; }

async function createKbArticle() {
    const title = document.getElementById('kbTitle').value.trim();
    const category = document.getElementById('kbCategory').value;
    const problem = document.getElementById('kbProblem').value.trim();
    const solution = document.getElementById('kbSolution').value.trim();
    if (!title || !problem || !solution) { alert('Заполните все поля'); return; }

    await supabase.from('knowledge_base').insert({ title, problem, solution, category, tags: title, author_id: currentUser.id });
    closeKbModal();
    await loadData();
    renderKnowledgeBase();
}

// ==================== ФИЛЬТРЫ ====================
document.getElementById('filterStatus')?.addEventListener('change', renderTickets);
document.getElementById('filterPriority')?.addEventListener('change', renderTickets);
document.getElementById('filterSearch')?.addEventListener('input', renderTickets);
document.getElementById('kbSearch')?.addEventListener('input', renderKnowledgeBase);

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function renderAll() {
    renderDashboard();
    renderTickets();
    renderKanban();
    renderKnowledgeBase();
}

document.getElementById('loginPassword')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
document.getElementById('regPassword2')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') register(); });

document.getElementById('authPage').style.display = 'flex';