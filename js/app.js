// ============================================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// ============================================================

const supabaseUrl = 'https://bmzdlgwonfrhijyqirwc.supabase.co/rest/v1/';
const supabaseKey = 'sb_publishable_JPQYCh884Vc2xo1AxPnHiA_TedKOXYm';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================

let currentUser = null;
let tickets = [];
let knowledgeBase = [];
let nextTicketId = 1;

// ============================================================
// DOM-ЭЛЕМЕНТЫ
// ============================================================

const $ = id => document.getElementById(id);
const authPage = $('authPage');
const mainApp = $('mainApp');
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const authError = $('authError');
const registerError = $('registerError');

// ============================================================
// ФУНКЦИИ АВТОРИЗАЦИИ
// ============================================================

// Показать форму входа
function showLoginForm() {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    authError.textContent = '';
    registerError.textContent = '';
}

// Показать форму регистрации
function showRegisterForm() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authError.textContent = '';
    registerError.textContent = '';
}

// Вход
async function login() {
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value.trim();

    if (!email || !password) {
        authError.textContent = 'Заполните все поля';
        return;
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', password);

        if (error || !data || data.length === 0) {
            authError.textContent = 'Неверный email или пароль';
            return;
        }

        currentUser = data[0];
        await loadData();
        showMainApp();

    } catch (err) {
        authError.textContent = 'Ошибка сервера';
        console.error(err);
    }
}

// Регистрация
async function register() {
    const fullName = $('regFullName').value.trim();
    const department = $('regDepartment').value.trim();
    const email = $('regEmail').value.trim();
    const password = $('regPassword').value;
    const password2 = $('regPassword2').value;

    if (!fullName || !email || !password) {
        registerError.textContent = 'Заполните все поля';
        return;
    }

    if (password.length < 3) {
        registerError.textContent = 'Пароль должен быть минимум 3 символа';
        return;
    }

    if (password !== password2) {
        registerError.textContent = 'Пароли не совпадают';
        return;
    }

    try {
        // Проверяем, существует ли пользователь
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email);

        if (existing && existing.length > 0) {
            registerError.textContent = 'Пользователь с таким email уже существует';
            return;
        }

        // Создаём пользователя
        const { data, error } = await supabase
            .from('users')
            .insert({
                email: email,
                password_hash: password,
                role: 'user',
                full_name: fullName,
                department: department || 'Не указан'
            })
            .select();

        if (error) throw error;

        alert('✅ Регистрация успешна! Теперь войдите.');
        showLoginForm();

    } catch (err) {
        registerError.textContent = 'Ошибка регистрации';
        console.error(err);
    }
}

// Выход
function logout() {
    currentUser = null;
    tickets = [];
    knowledgeBase = [];
    mainApp.style.display = 'none';
    authPage.style.display = 'flex';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadData() {
    try {
        // Загружаем заявки
        const { data: t } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });

        tickets = t || [];

        // Вычисляем следующий ID
        if (tickets.length > 0) {
            const lastNumber = tickets[0].number;
            const parts = lastNumber.split('-');
            nextTicketId = parseInt(parts[parts.length - 1]) + 1;
        }

        // Загружаем базу знаний
        const { data: kb } = await supabase
            .from('knowledge_base')
            .select('*');

        knowledgeBase = kb || [];

    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }
}

// ============================================================
// ПОКАЗ ОСНОВНОГО ИНТЕРФЕЙСА
// ============================================================

function showMainApp() {
    authPage.style.display = 'none';
    mainApp.style.display = 'block';

    // Информация о пользователе
    $('currentUserName').textContent = currentUser.full_name;

    const roles = {
        chief: 'Начальник IT-отдела',
        admin: 'Системный администратор',
        user: 'Пользователь'
    };
    $('currentUserRole').textContent = roles[currentUser.role] || '—';

    // Скрываем недоступные разделы
    if (currentUser.role === 'user') {
        document.querySelectorAll('.nav-link[data-page="dashboard"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nav-link[data-page="kanban"]').forEach(el => el.style.display = 'none');
    }

    // Переход на нужную страницу
    const startPage = currentUser.role === 'user' ? 'tickets' : 'dashboard';
    navigateTo(startPage);
    renderAll();
}

// ============================================================
// НАВИГАЦИЯ
// ============================================================

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = $('page-' + page);
    if (target) target.classList.add('active');

    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (link) link.classList.add('active');

    // Рендерим нужную страницу
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

    if (status !== 'all') {
        filtered = filtered.filter(t => t.status === status);
    }

    if (priority !== 'all') {
        filtered = filtered.filter(t => t.priority === priority);
    }

    if (search) {
        filtered = filtered.filter(t =>
            t.number.toLowerCase().includes(search) ||
            t.title.toLowerCase().includes(search)
        );
    }

    const priorityLabels = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий'
    };

    const statusLabels = {
        new: 'Новая',
        in_progress: 'В работе',
        resolved: 'Решена',
        closed: 'Закрыта'
    };

    const categoryLabels = {
        hardware: 'Оборудование',
        software: 'ПО',
        network: 'Сеть',
        access: 'Доступы',
        other: 'Другое'
    };

    const tbody = $('ticketsBody');

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-light);">Заявок не найдено</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td><strong>${t.number}</strong></td>
            <td>${t.title}</td>
            <td>${categoryLabels[t.category] || t.category}</td>
            <td><span class="priority priority-${t.priority}">${priorityLabels[t.priority]}</span></td>
            <td><span class="status status-${t.status}">${statusLabels[t.status]}</span></td>
            <td>${new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
        </tr>
    `).join('');
}

// ============================================================
// КАНБАН
// ============================================================

function renderKanban() {
    const columns = {
        new: { element: $('colNew'), count: $('countNew') },
        in_progress: { element: $('colProgress'), count: $('countProgress') },
        resolved: { element: $('colResolved'), count: $('countResolved') },
        closed: { element: $('colClosed'), count: $('countClosed') }
    };

    const priorityIcons = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢'
    };

    for (const [status, data] of Object.entries(columns)) {
        const items = tickets.filter(t => t.status === status);
        data.count.textContent = items.length;

        if (items.length === 0) {
            data.element.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:20px;font-size:13px;">Нет заявок</div>';
            continue;
        }

        data.element.innerHTML = items.map(t => `
            <div class="kanban-card" onclick="changeStatus(${t.id})">
                <div class="kanban-card-title">${priorityIcons[t.priority] || ''} ${t.title}</div>
                <div class="kanban-card-meta">${t.number}</div>
            </div>
        `).join('');
    }
}

// Смена статуса
async function changeStatus(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const flow = {
        new: 'in_progress',
        in_progress: 'resolved',
        resolved: 'closed',
        closed: 'new'
    };

    const newStatus = flow[ticket.status];
    if (!newStatus) return;

    const updates = { status: newStatus };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    if (newStatus === 'closed') updates.closed_at = new Date().toISOString();

    try {
        await supabase.from('tickets').update(updates).eq('id', id);
        await loadData();
        renderAll();
    } catch (err) {
        console.error('Ошибка изменения статуса:', err);
    }
}

// ============================================================
// БАЗА ЗНАНИЙ
// ============================================================

function renderKnowledge() {
    const search = ($('kbSearch')?.value || '').toLowerCase();

    let filtered = knowledgeBase;

    if (search) {
        filtered = filtered.filter(k =>
            k.title.toLowerCase().includes(search) ||
            (k.tags || '').toLowerCase().includes(search) ||
            (k.problem || '').toLowerCase().includes(search)
        );
    }

    const categoryIcons = {
        hardware: '🖥️',
        software: '💿',
        network: '🌐',
        access: '🔑',
        other: '📌'
    };

    const grid = $('kbGrid');

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">Статей не найдено</div>';
        return;
    }

    grid.innerHTML = filtered.map(k => `
        <div class="kb-card">
            <h3>${categoryIcons[k.category] || ''} ${k.title}</h3>
            <p><strong>Проблема:</strong> ${k.problem}</p>
            <p><strong>Решение:</strong> ${k.solution}</p>
            ${k.tags ? `<p style="font-size:12px;color:var(--text-light);margin-top:8px;">Теги: ${k.tags}</p>` : ''}
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
        const number = `INC-2026-${String(nextTicketId).padStart(4, '0')}`;
        nextTicketId++;

        // Назначаем первому админу
        const { data: admins } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .limit(1);

        const assigneeId = admins && admins.length > 0 ? admins[0].id : null;

        await supabase.from('tickets').insert({
            number: number,
            title: title,
            description: description,
            category: category,
            priority: priority,
            status: 'new',
            creator_id: currentUser.id,
            assignee_id: assigneeId
        });

        closeTicketModal();
        await loadData();
        renderAll();

    } catch (err) {
        error.textContent = 'Ошибка создания заявки';
        console.error(err);
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
        await supabase.from('knowledge_base').insert({
            title: title,
            problem: problem,
            solution: solution,
            category: category,
            tags: title,
            author_id: currentUser.id
        });

        closeKbModal();
        await loadData();
        renderKnowledge();

    } catch (err) {
        alert('Ошибка создания статьи');
        console.error(err);
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
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', 'admin@kommash.ru');

        if (!existing || existing.length === 0) {
            await supabase.from('users').insert({
                email: 'admin@kommash.ru',
                password_hash: 'admin123',
                role: 'admin',
                full_name: 'Администратор',
                department: 'IT-отдел'
            });
            console.log('✅ Тестовый админ создан!');
            console.log('📧 admin@kommash.ru');
            console.log('🔑 admin123');
        } else {
            console.log('ℹ️ Тестовый админ уже существует');
        }
    } catch (err) {
        console.log('ℹ️', err.message);
    }
}

// ============================================================
// НАВЕШИВАНИЕ СОБЫТИЙ
// ============================================================

// Авторизация
$('loginBtn').addEventListener('click', login);
$('registerBtn').addEventListener('click', register);
$('showRegisterLink').addEventListener('click', showRegisterForm);
$('showLoginLink').addEventListener('click', showLoginForm);

// Выход
$('logoutBtn').addEventListener('click', logout);

// Навигация
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
    });
});

// Модалки заявок
$('newTicketBtn').addEventListener('click', openTicketModal);
$('closeTicketModal').addEventListener('click', closeTicketModal);
$('saveTicketBtn').addEventListener('click', createTicket);

// Модалки базы знаний
$('newKbBtn').addEventListener('click', openKbModal);
$('closeKbModal').addEventListener('click', closeKbModal);
$('saveKbBtn').addEventListener('click', createKbArticle);

// Фильтры
$('filterStatus')?.addEventListener('change', renderTickets);
$('filterPriority')?.addEventListener('change', renderTickets);
$('filterSearch')?.addEventListener('input', renderTickets);
$('kbSearch')?.addEventListener('input', renderKnowledge);

// Enter на формах
$('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
});

$('regPassword2')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') register();
});

// Клик вне модалки
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

(async function init() {
    console.log('🚀 Запуск HelpDesk...');

    // Создаём тестового админа
    await createTestAdmin();

    // Показываем форму входа
    showLoginForm();
    authPage.style.display = 'flex';

    console.log('✅ HelpDesk готов!');
    console.log('📧 admin@kommash.ru');
    console.log('🔑 admin123');
})();