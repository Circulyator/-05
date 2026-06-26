// ============================================================
// НАСТРОЙКА SUPABASE
// ============================================================

const DB_URL = 'https://bmzdlgwonfrhijyqirwc.supabase.co';
const DB_KEY = 'sb_publishable_JPQYCh884Vc2xo1AxPnHiA_TedKOXYm';

// НЕ ИСПОЛЬЗУЕМ const supabase - используем ДРУГОЕ имя
const api = window.supabase.createClient(DB_URL, DB_KEY);

// ============================================================
// ПЕРЕМЕННЫЕ
// ============================================================

let user = null;
let tickets = [];
let knowledge = [];
let nextId = 1;

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function $(id) {
    return document.getElementById(id);
}

function show(element) {
    element.style.display = 'flex';
}

function hide(element) {
    element.style.display = 'none';
}

// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================

function showLogin() {
    $('loginForm').style.display = 'block';
    $('registerForm').style.display = 'none';
    $('authError').textContent = '';
    $('registerError').textContent = '';
}

function showRegister() {
    $('loginForm').style.display = 'none';
    $('registerForm').style.display = 'block';
    $('authError').textContent = '';
    $('registerError').textContent = '';
}

async function login() {
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value.trim();

    if (!email || !password) {
        $('authError').textContent = 'Заполните все поля';
        return;
    }

    try {
        const result = await api
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', password);

        if (result.error) throw result.error;

        const users = result.data;
        if (!users || users.length === 0) {
            $('authError').textContent = 'Неверный email или пароль';
            return;
        }

        user = users[0];
        await loadData();
        showApp();

    } catch (e) {
        $('authError').textContent = 'Ошибка сервера';
        console.error(e);
    }
}

async function register() {
    const name = $('regFullName').value.trim();
    const dept = $('regDepartment').value.trim();
    const email = $('regEmail').value.trim();
    const pass = $('regPassword').value;
    const pass2 = $('regPassword2').value;

    if (!name || !email || !pass) {
        $('registerError').textContent = 'Заполните все поля';
        return;
    }

    if (pass.length < 3) {
        $('registerError').textContent = 'Пароль минимум 3 символа';
        return;
    }

    if (pass !== pass2) {
        $('registerError').textContent = 'Пароли не совпадают';
        return;
    }

    try {
        const check = await api.from('users').select('id').eq('email', email);

        if (check.data && check.data.length > 0) {
            $('registerError').textContent = 'Email уже используется';
            return;
        }

        await api.from('users').insert({
            email: email,
            password_hash: pass,
            role: 'user',
            full_name: name,
            department: dept || 'Не указан'
        });

        alert('✅ Регистрация успешна! Войдите.');
        showLogin();

    } catch (e) {
        $('registerError').textContent = 'Ошибка регистрации';
        console.error(e);
    }
}

function logout() {
    user = null;
    tickets = [];
    knowledge = [];
    hide($('mainApp'));
    show($('authPage'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadData() {
    try {
        const tResult = await api.from('tickets').select('*').order('created_at', { ascending: false });
        tickets = tResult.data || [];

        if (tickets.length > 0) {
            const parts = tickets[0].number.split('-');
            nextId = parseInt(parts[parts.length - 1]) + 1;
        }

        const kResult = await api.from('knowledge_base').select('*');
        knowledge = kResult.data || [];

    } catch (e) {
        console.error('Ошибка загрузки:', e);
    }
}

// ============================================================
// ПОКАЗ ОСНОВНОГО ИНТЕРФЕЙСА
// ============================================================

function showApp() {
    hide($('authPage'));
    show($('mainApp'));

    $('currentUserName').textContent = user.full_name;

    const roles = {
        chief: 'Начальник IT',
        admin: 'Администратор',
        user: 'Пользователь'
    };
    $('currentUserRole').textContent = roles[user.role] || '—';

    if (user.role === 'user') {
        document.querySelectorAll('.nav-link[data-page="dashboard"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nav-link[data-page="kanban"]').forEach(el => el.style.display = 'none');
    }

    const start = user.role === 'user' ? 'tickets' : 'dashboard';
    navigate(start);
    renderAll();
}

// ============================================================
// НАВИГАЦИЯ
// ============================================================

function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = $('page-' + page);
    if (target) target.classList.add('active');

    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (link) link.classList.add('active');

    if (page === 'dashboard') renderDashboard();
    if (page === 'tickets') renderTickets();
    if (page === 'kanban') renderKanban();
    if (page === 'knowledge') renderKnowledge();
}

// ============================================================
// ДАШБОРД
// ============================================================

function renderDashboard() {
    $('widgetTotal').textContent = tickets.length;
    $('widgetOpen').textContent = tickets.filter(t => t.status === 'new').length;
    $('widgetOverdue').textContent = tickets.filter(t => t.status === 'new' || t.status === 'in_progress').length;

    const today = new Date().toISOString().split('T')[0];
    $('widgetResolved').textContent = tickets.filter(t =>
        t.status === 'resolved' && t.resolved_at && t.resolved_at.startsWith(today)
    ).length;
}

// ============================================================
// ЗАЯВКИ
// ============================================================

function renderTickets() {
    const status = $('filterStatus')?.value || 'all';
    const priority = $('filterPriority')?.value || 'all';
    const search = ($('filterSearch')?.value || '').toLowerCase();

    let filtered = tickets;

    if (status !== 'all') filtered = filtered.filter(t => t.status === status);
    if (priority !== 'all') filtered = filtered.filter(t => t.priority === priority);
    if (search) filtered = filtered.filter(t =>
        t.number.toLowerCase().includes(search) ||
        t.title.toLowerCase().includes(search)
    );

    const pLabels = { critical: 'Критический', high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const sLabels = { new: 'Новая', in_progress: 'В работе', resolved: 'Решена', closed: 'Закрыта' };
    const cLabels = { hardware: 'Оборудование', software: 'ПО', network: 'Сеть', access: 'Доступы', other: 'Другое' };

    const tbody = $('ticketsBody');

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8;">Заявок нет</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td><strong>${t.number}</strong></td>
            <td>${t.title}</td>
            <td>${cLabels[t.category] || t.category}</td>
            <td><span class="priority priority-${t.priority}">${pLabels[t.priority]}</span></td>
            <td><span class="status status-${t.status}">${sLabels[t.status]}</span></td>
            <td>${new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
        </tr>
    `).join('');
}

// ============================================================
// КАНБАН
// ============================================================

function renderKanban() {
    const cols = {
        new: { el: $('colNew'), count: $('countNew') },
        in_progress: { el: $('colProgress'), count: $('countProgress') },
        resolved: { el: $('colResolved'), count: $('countResolved') },
        closed: { el: $('colClosed'), count: $('countClosed') }
    };

    const icons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

    for (const [status, data] of Object.entries(cols)) {
        const items = tickets.filter(t => t.status === status);
        data.count.textContent = items.length;

        if (items.length === 0) {
            data.el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">Пусто</div>';
            continue;
        }

        data.el.innerHTML = items.map(t => `
            <div class="kanban-card" onclick="changeStatus(${t.id})">
                <div class="kanban-card-title">${icons[t.priority] || ''} ${t.title}</div>
                <div class="kanban-card-meta">${t.number}</div>
            </div>
        `).join('');
    }
}

async function changeStatus(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const flow = { new: 'in_progress', in_progress: 'resolved', resolved: 'closed', closed: 'new' };
    const newStatus = flow[ticket.status];
    if (!newStatus) return;

    const updates = { status: newStatus };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    if (newStatus === 'closed') updates.closed_at = new Date().toISOString();

    try {
        await api.from('tickets').update(updates).eq('id', id);
        await loadData();
        renderAll();
    } catch (e) {
        console.error('Ошибка:', e);
    }
}

// ============================================================
// БАЗА ЗНАНИЙ
// ============================================================

function renderKnowledge() {
    const search = ($('kbSearch')?.value || '').toLowerCase();

    let filtered = knowledge;
    if (search) filtered = knowledge.filter(k =>
        k.title.toLowerCase().includes(search) ||
        (k.tags || '').toLowerCase().includes(search) ||
        (k.problem || '').toLowerCase().includes(search)
    );

    const icons = { hardware: '🖥️', software: '💿', network: '🌐', access: '🔑', other: '📌' };
    const grid = $('kbGrid');

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Статей нет</div>';
        return;
    }

    grid.innerHTML = filtered.map(k => `
        <div class="kb-card">
            <h3>${icons[k.category] || ''} ${k.title}</h3>
            <p><strong>Проблема:</strong> ${k.problem}</p>
            <p><strong>Решение:</strong> ${k.solution}</p>
            ${k.tags ? `<p style="font-size:12px;color:#94a3b8;margin-top:8px;">Теги: ${k.tags}</p>` : ''}
        </div>
    `).join('');
}

// ============================================================
// СОЗДАНИЕ ЗАЯВКИ
// ============================================================

function openTicketModal() {
    $('ticketModal').classList.add('show');
    $('ticketModal').style.display = 'flex';
}

function closeTicketModal() {
    $('ticketModal').style.display = 'none';
    $('ticketModal').classList.remove('show');
    $('ticketTitle').value = '';
    $('ticketDescription').value = '';
    $('ticketCategory').value = '';
    $('ticketError').textContent = '';
}

async function createTicket() {
    const title = $('ticketTitle').value.trim();
    const category = $('ticketCategory').value;
    const priority = $('ticketPriority').value;
    const description = $('ticketDescription').value.trim();
    const error = $('ticketError');

    if (!title || !category) {
        error.textContent = 'Заполните обязательные поля';
        return;
    }

    try {
        const number = `INC-2026-${String(nextId).padStart(4, '0')}`;
        nextId++;

        const admins = await api.from('users').select('id').eq('role', 'admin').limit(1);
        const assigneeId = admins.data && admins.data.length > 0 ? admins.data[0].id : null;

        await api.from('tickets').insert({
            number: number,
            title: title,
            description: description,
            category: category,
            priority: priority,
            status: 'new',
            creator_id: user.id,
            assignee_id: assigneeId
        });

        closeTicketModal();
        await loadData();
        renderAll();

    } catch (e) {
        error.textContent = 'Ошибка создания заявки';
        console.error(e);
    }
}

// ============================================================
// СОЗДАНИЕ СТАТЬИ
// ============================================================

function openKbModal() {
    $('kbModal').classList.add('show');
    $('kbModal').style.display = 'flex';
}

function closeKbModal() {
    $('kbModal').style.display = 'none';
    $('kbModal').classList.remove('show');
    $('kbTitle').value = '';
    $('kbProblem').value = '';
    $('kbSolution').value = '';
}

async function createKbArticle() {
    const title = $('kbTitle').value.trim();
    const category = $('kbCategory').value;
    const problem = $('kbProblem').value.trim();
    const solution = $('kbSolution').value.trim();

    if (!title || !problem || !solution) {
        alert('Заполните все поля');
        return;
    }

    try {
        await api.from('knowledge_base').insert({
            title: title,
            problem: problem,
            solution: solution,
            category: category,
            tags: title,
            author_id: user.id
        });

        closeKbModal();
        await loadData();
        renderKnowledge();

    } catch (e) {
        alert('Ошибка создания статьи');
        console.error(e);
    }
}

// ============================================================
// ОБНОВЛЕНИЕ ВСЕГО
// ============================================================

function renderAll() {
    renderDashboard();
    renderTickets();
    renderKanban();
    renderKnowledge();
}

// ============================================================
// СОЗДАНИЕ ТЕСТОВОГО АДМИНА
// ============================================================

async function createTestAdmin() {
    try {
        const check = await api.from('users').select('id').eq('email', 'admin@kommash.ru');

        if (!check.data || check.data.length === 0) {
            await api.from('users').insert({
                email: 'admin@kommash.ru',
                password_hash: 'admin123',
                role: 'admin',
                full_name: 'Администратор',
                department: 'IT-отдел'
            });
            console.log('✅ Админ создан: admin@kommash.ru / admin123');
        }
    } catch (e) {
        console.log('ℹ️', e.message);
    }
}

// ============================================================
//  СОБЫТИЯ
// ============================================================

// Авторизация
$('loginBtn').addEventListener('click', login);
$('registerBtn').addEventListener('click', register);
$('showRegisterLink').addEventListener('click', showRegister);
$('showLoginLink').addEventListener('click', showLogin);
$('logoutBtn').addEventListener('click', logout);

// Навигация
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.page);
    });
});

// Модалки заявок
$('newTicketBtn').addEventListener('click', openTicketModal);
$('closeTicketModal').addEventListener('click', closeTicketModal);
$('saveTicketBtn').addEventListener('click', createTicket);

// Модалки знаний
$('newKbBtn').addEventListener('click', openKbModal);
$('closeKbModal').addEventListener('click', closeKbModal);
$('saveKbBtn').addEventListener('click', createKbArticle);

// Фильтры
$('filterStatus')?.addEventListener('change', renderTickets);
$('filterPriority')?.addEventListener('change', renderTickets);
$('filterSearch')?.addEventListener('input', renderTickets);
$('kbSearch')?.addEventListener('input', renderKnowledge);

// Enter
$('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
});
$('regPassword2')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') register();
});

// Закрытие модалок по клику вне
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    });
});

// ============================================================
// ЗАПУСК
// ============================================================

(async function start() {
    console.log('🚀 Запуск...');
    await createTestAdmin();
    show($('authPage'));
    console.log('✅ Готово!');
    console.log('📧 admin@kommash.ru');
    console.log('🔑 admin123');
})();