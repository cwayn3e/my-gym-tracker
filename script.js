<<<<<<< HEAD
import { db } from './db.js';

// --- Data Management ---
const STORAGE_KEY = 'gymtracker_data';
let appData = {
    workouts: [],
    favorites: [
        "Жим лежа",
        "Приседания со штангой",
        "Становая тяга",
        "Подтягивания",
        "Отжимания на брусьях",
        "Гиперэкстензия",
        "Тяга верхнего блока",
        "Тяга штанги в наклоне",
        "Жим гантелей сидя",
        "Подъем на бицепс"
    ]
};

// --- State ---
let currentScreen = 'home';
let editingWorkoutId = null;
let currentWorkoutData = { id: null, date: '', name: '', exercises: [] };
let viewingWorkoutId = null;
let currentTheme = 'cyber';
let currentCalendarDate = new Date();

// --- Elements ---
const screens = {
    home: document.getElementById('screen-home'),
    workout: document.getElementById('screen-workout'),
    view: document.getElementById('screen-view')
};

// Modals
const modalFavorites = document.getElementById('modal-favorites');
const modalSettings = document.getElementById('modal-settings');
const modalConfirm = document.getElementById('modal-confirm');
const toastEl = document.getElementById('toast');


// Home Screen Elements
const workoutsList = document.getElementById('workouts-list');
const emptyState = document.getElementById('empty-state');

// Workout Edit Screen Elements
const workoutDateInput = document.getElementById('workout-date');
const workoutNameInput = document.getElementById('workout-name');
const exercisesList = document.getElementById('exercises-list');
const exercisesCount = document.getElementById('exercises-count');

// View Screen Elements
const viewTitle = document.getElementById('view-title');
const viewDate = document.getElementById('view-date');
const viewExercisesList = document.getElementById('view-exercises-list');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    injectDatalist();
    renderHome();
    setupEventListeners();
    await loadTheme();
    startClock();
    
        // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);

                    // Проверяем обновления при каждом запуске
                    registration.update();

                    // Когда новый SW найден
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New SW installed, activating...');
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });
                }, err => {
                    console.log('ServiceWorker registration failed:', err);
                });

            // Перезагружаем только один раз при смене контроллера
            let reloading = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!reloading) {
                    reloading = true;
                    console.log('SW updated, reloading...');
                    window.location.reload();
                }
            });
        });
    }
    
    // Hide splash screen
    const hideSplash = () => {
        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    };
    setTimeout(hideSplash, 1500);
});

async function loadData() {
    try {
        appData.workouts = await db.getAllWorkouts();
        
        // Load settings
        const favorites = await db.getSetting('favorites');
        if (favorites && favorites.length > 0) appData.favorites = favorites;
        
        const username = await db.getSetting('username');
        appData.username = username || null;
    } catch (e) {
        console.error("Error loading data from IndexedDB", e);
    }
}

async function saveData() {
    // Эта функция теперь в основном синхронизирует избранное, 
    // так как тренировки сохраняются индивидуально через db.saveWorkout
    await db.saveSetting('favorites', appData.favorites);
    updateDatalist();
    
    // Auto-sync to cloud if enabled
    if (appData.username) {
        syncToCloud(true);
    }
}

function injectDatalist() {
    const datalist = document.createElement('datalist');
    datalist.id = 'favorites-datalist';
    document.body.appendChild(datalist);
    updateDatalist();
}

function updateDatalist() {
    const datalist = document.getElementById('favorites-datalist');
    datalist.innerHTML = '';
    appData.favorites.forEach(fav => {
        const option = document.createElement('option');
        option.value = fav;
        datalist.appendChild(option);
    });
}

// --- Navigation ---
function navigateTo(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    currentScreen = screenName;
    window.scrollTo(0, 0);
}

// --- Toast ---
function showToast(message, duration = 3000) {
    toastEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ${message}
    `;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, duration);
}

// --- Live Clock ---
let clockInterval;
function startClock() {
    const clockEl = document.getElementById('live-clock');
    const giantClockEl = document.getElementById('giant-clock-text');
    
    if (clockInterval) clearInterval(clockInterval);
    
    clockInterval = setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour12: false });
        clockEl.textContent = timeStr;
        if (giantClockEl) giantClockEl.textContent = timeStr;
    }, 1000);
}

// --- Giant Clock Overlay ---
function toggleGiantClock() {
    const overlay = document.getElementById('giant-clock-overlay');
    overlay.classList.toggle('hidden');
}

// --- Theme Switching ---
async function loadTheme() {
    let theme = await db.getSetting('theme');
    if (!theme) {
        theme = localStorage.getItem('gymtracker_theme') || 'cyber';
    }
    if (theme) {
        currentTheme = theme;
        // Mirror to localStorage for fast anti-flash sync read on next startup
        try { localStorage.setItem('gymtracker_theme', currentTheme); } catch(e) {}
        applyTheme();
    }
}

async function toggleTheme() {
    currentTheme = currentTheme === 'minimal' ? 'cyber' : 'minimal';
    // Mirror to localStorage for instant anti-flash read on next cold start
    try { localStorage.setItem('gymtracker_theme', currentTheme); } catch(e) {}
    applyTheme();
    await db.saveSetting('theme', currentTheme);
}

function applyTheme() {
    const isMinimal = currentTheme === 'minimal';
    const mascotPath = 'icons/rabbit_girl_new.png';
    const bgColor    = isMinimal ? '#ffffff' : '#0d0f14';

    // Toggle CSS classes on body
    document.body.classList.remove('theme-minimal', 'theme-cyber');
    document.body.classList.add(`theme-${currentTheme}`);

    // Update dynamic theme-color meta tag for browser chrome
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
    }
    metaTheme.content = bgColor;

    // Update all mascot image instances
    const headerAvatar = document.getElementById('header-avatar');
    const splashAvatar = document.getElementById('splash-avatar');
    const emptyAvatar  = document.getElementById('empty-avatar');

    if (headerAvatar) headerAvatar.src = mascotPath;
    if (splashAvatar) splashAvatar.src  = mascotPath;
    if (emptyAvatar)  emptyAvatar.src   = mascotPath;
}

// --- Date Utils ---
function getTodayDateStr() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU', options);
    } catch(e) {
        return dateStr;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Home Screen ---
function renderHome() {
    workoutsList.innerHTML = '';
    // renderCalendar(); // Removed from home screen
    
    if (appData.workouts.length === 0) {
        emptyState.classList.remove('hidden');
        workoutsList.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    workoutsList.classList.remove('hidden');
    
    // Sort workouts newest first
    const sortedWorkouts = [...appData.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedWorkouts.forEach(wk => {
        const completedEx = wk.exercises.filter(ex => ex.done).length;
        const totalEx = wk.exercises.length;
        
        const card = document.createElement('div');
        const isCompleted = totalEx > 0 && completedEx === totalEx;
        const isToday = wk.date === getTodayDateStr();
        
        const plateauCountTotal = wk.exercises.reduce((acc, ex) => {
            const count = getPlateauCount(ex.name, ex.weight, ex.reps, wk.date, wk.id);
            return count >= 2 ? acc + 1 : acc;
        }, 0);
        const plateauSummaryHtml = plateauCountTotal > 0 ? `<div class="plateau-indicator" title="Упражнений на плато">${plateauCountTotal}×</div>` : '';

        let cardClass = 'workout-card';
        if (isCompleted) cardClass += ' is-completed';
        else if (isToday) cardClass += ' is-active';
        card.className = cardClass;
        card.innerHTML = `
            <div class="workout-card-header">
                <div class="workout-card-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${formatDateDisplay(wk.date)}
                </div>
                ${plateauSummaryHtml}
                <button class="icon-btn-small btn-duplicate" data-id="${wk.id}" title="Повторить тренировку">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
            <h3 class="workout-card-title">${wk.name || 'Без названия'}</h3>
            <div class="workout-card-stats">
                <div class="stat-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Упражнений: ${totalEx}
                </div>
                ${completedEx === totalEx && totalEx > 0 ? 
                    `<div class="stat-badge" style="color: var(--success-color); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.1);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        Выполнено
                    </div>` : 
                    `<div class="stat-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Прогресс: ${completedEx}/${totalEx}
                    </div>`
                }
            </div>
        `;
        
        const duplicateBtn = card.querySelector('.btn-duplicate');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateWorkout(wk.id);
            });
        }
        
        card.addEventListener('click', () => openWorkoutView(wk.id));
        workoutsList.appendChild(card);
    });
}

// --- Calendar Logic ---
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust for Russian week (starts on Monday)
    let startDay = firstDay === 0 ? 6 : firstDay - 1;
    
    calendarGrid.innerHTML = '';
    
    // Day labels
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekDays.forEach(day => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'calendar-day-label';
        dayLabel.textContent = day;
        calendarGrid.appendChild(dayLabel);
    });
    
    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }
    
    // Days of the month
    const workoutDays = new Set(appData.workouts.map(w => w.date));
    const todayStr = getTodayDateStr();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        
        if (workoutDays.has(dateStr)) {
            dayCell.classList.add('has-workout');
            
            // Add a little dot for workout
            const dot = document.createElement('div');
            dot.className = 'calendar-dot';
            dayCell.appendChild(dot);
        }
        
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }
        
        dayCell.addEventListener('click', () => showDaySummary(dateStr));
        calendarGrid.appendChild(dayCell);
    }
}

function showDaySummary(dateStr) {
    const summaryCard = document.getElementById('day-summary');
    const summaryDate = document.getElementById('summary-date');
    const summaryContent = document.getElementById('summary-content');
    
    const workouts = appData.workouts.filter(w => w.date === dateStr);
    
    summaryDate.textContent = formatDateDisplay(dateStr);
    summaryContent.innerHTML = '';
    
    if (workouts.length === 0) {
        summaryContent.innerHTML = '<p class="no-workouts">В этот день тренировок не было.</p>';
    } else {
        workouts.forEach(wk => {
            const wkEl = document.createElement('div');
            wkEl.className = 'summary-workout-item';
            
            const exercisesStr = wk.exercises.map(ex => ex.name).join(', ') || 'Без упражнений';
            
            wkEl.innerHTML = `
                <strong>${wk.name || 'Тренировка'}</strong>
                <p>${exercisesStr}</p>
                <button class="btn-link btn-open-wk" data-id="${wk.id}">Открыть</button>
            `;
            wkEl.querySelector('.btn-open-wk').addEventListener('click', (e) => {
                openWorkoutView(e.currentTarget.getAttribute('data-id'));
            });
            summaryContent.appendChild(wkEl);
        });
    }
    
    summaryCard.classList.remove('hidden');
}

// --- Edit Screen ---
function openNewWorkout() {
    editingWorkoutId = null;
    currentWorkoutData = {
        id: generateId(),
        date: getTodayDateStr(),
        name: '',
        exercises: []
    };
    
    document.getElementById('workout-screen-title').textContent = 'Новая тренировка';
    initEditScreen();
    navigateTo('workout');
}

function duplicateWorkout(id) {
    const wk = appData.workouts.find(w => w.id === id);
    if (!wk) return;
    
    editingWorkoutId = null; // We are creating a new workout
    
    // Deep copy and reset specific fields
    const duplicatedData = JSON.parse(JSON.stringify(wk));
    
    currentWorkoutData = {
        id: generateId(),
        date: getTodayDateStr(),
        name: duplicatedData.name,
        exercises: duplicatedData.exercises.map(ex => ({
            ...ex,
            id: generateId(), // generate new ID for the exercise
            done: false // Reset done status
        }))
    };
    
    document.getElementById('workout-screen-title').textContent = 'Новая тренировка';
    initEditScreen();
    navigateTo('workout');
    showToast('Тренировка скопирована');
}

function openEditWorkout(id) {
    const wk = appData.workouts.find(w => w.id === id);
    if (!wk) return;
    
    editingWorkoutId = id;
    // Deep copy
    currentWorkoutData = JSON.parse(JSON.stringify(wk));
    
    document.getElementById('workout-screen-title').textContent = 'Редактирование';
    initEditScreen();
    navigateTo('workout');
}

function initEditScreen() {
    workoutDateInput.value = currentWorkoutData.date;
    workoutNameInput.value = currentWorkoutData.name;
    renderEditExercises();
}

function renderEditExercises() {
    exercisesList.innerHTML = '';
    exercisesCount.textContent = currentWorkoutData.exercises.length;
    
    currentWorkoutData.exercises.forEach((ex, index) => {
        const exEl = document.createElement('div');
        exEl.className = 'exercise-edit-card';
        const plateauCount = getPlateauCount(ex.name, ex.weight, ex.reps, currentWorkoutData.date, currentWorkoutData.id);
        const plateauHtml = plateauCount >= 2 ? `<div class="plateau-indicator">${plateauCount}×</div>` : '';
        
        exEl.innerHTML = `
            <div class="exercise-edit-header">
                <div class="exercise-number">${index + 1}</div>
                ${plateauHtml}
                <button class="icon-btn btn-remove-exercise" data-index="${index}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
            
            <div class="form-group exercise-name-input">
                <label class="form-label">Упражнение</label>
                <input type="text" class="form-input ex-name" placeholder="Название (напр. Жим лежа)" value="${ex.name || ''}" list="favorites-datalist" data-index="${index}">
            </div>
            
            <div class="set-rep-row">
                <div class="form-group">
                    <label class="form-label">Подходы</label>
                    <input type="number" class="form-input ex-sets" placeholder="3" value="${ex.sets || ''}" min="1" data-index="${index}">
                </div>
                <div class="form-group">
                    <label class="form-label">Повторения</label>
                    <input type="number" class="form-input ex-reps" placeholder="10" value="${ex.reps || ''}" min="1" data-index="${index}">
                </div>
                <div class="form-group">
                    <label class="form-label">Вес (кг)</label>
                    <input type="number" class="form-input ex-weight" placeholder="50" value="${ex.weight || ''}" step="0.5" data-index="${index}">
                </div>
            </div>
            
            <div class="form-group">
                <input type="text" class="form-input ex-comment" placeholder="Комментарий (опционально)" value="${ex.comment || ''}" data-index="${index}">
            </div>
        `;
        
        exercisesList.appendChild(exEl);
    });
    
    initSortable('exercises-list', true);
    
    // Attach event listeners for dynamic inputs
    document.querySelectorAll('.btn-remove-exercise').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            currentWorkoutData.exercises.splice(index, 1);
            renderEditExercises();
        });
    });
    
    const updateExData = (e, field) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        currentWorkoutData.exercises[index][field] = e.target.value;
        
        // Update plateau badge in real-time
        if (field === 'name' || field === 'weight' || field === 'reps') {
            const cardEl = e.target.closest('.exercise-edit-card');
            updateCardPlateauBadge(cardEl, currentWorkoutData.exercises[index]);
        }
    };
    
    document.querySelectorAll('.ex-name').forEach(el => el.addEventListener('input', e => updateExData(e, 'name')));
    document.querySelectorAll('.ex-sets').forEach(el => el.addEventListener('input', e => updateExData(e, 'sets')));
    document.querySelectorAll('.ex-reps').forEach(el => el.addEventListener('input', e => updateExData(e, 'reps')));
    document.querySelectorAll('.ex-weight').forEach(el => el.addEventListener('input', e => updateExData(e, 'weight')));
    document.querySelectorAll('.ex-comment').forEach(el => el.addEventListener('input', e => updateExData(e, 'comment')));
}

function addNewExercise() {
    currentWorkoutData.exercises.push({
        id: generateId(),
        name: '',
        sets: '',
        reps: '',
        weight: '',
        comment: '',
        done: false
    });
    renderEditExercises();
    
    // Scroll to bottom
    setTimeout(() => {
        document.getElementById('workout-content').scrollTop = document.getElementById('workout-content').scrollHeight;
    }, 50);
}

async function saveWorkout() {
    // Update main fields
    currentWorkoutData.date = workoutDateInput.value || getTodayDateStr();
    currentWorkoutData.name = workoutNameInput.value.trim();
    
    if (!currentWorkoutData.name) {
        // Auto-generate name if empty
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const dayName = days[new Date(currentWorkoutData.date).getDay()];
        currentWorkoutData.name = `Тренировка (${dayName})`;
    }
    
    // Clean up empty exercises
    currentWorkoutData.exercises = currentWorkoutData.exercises.filter(ex => ex.name.trim() !== '');
    
    if (editingWorkoutId) {
        const index = appData.workouts.findIndex(w => w.id === editingWorkoutId);
        if (index !== -1) {
            appData.workouts[index] = currentWorkoutData;
        }
    } else {
        appData.workouts.push(currentWorkoutData);
    }
    
    try {
            await db.saveWorkout(currentWorkoutData);
            updateDatalist();
            renderHome();
            showToast('Тренировка сохранена');

            if (appData.username) {
                await syncToCloud(true);
            }

            if (editingWorkoutId) {
                openWorkoutView(currentWorkoutData.id);
            } else {
                navigateTo('home');
            }
        } catch (e) {
            console.error('Ошибка сохранения (saveWorkout):', e);
            showToast('Ошибка сохранения');
        }
    }

// --- View Screen ---
function openWorkoutView(id) {
    const wk = appData.workouts.find(w => w.id === id);
    if (!wk) return;
    
    viewingWorkoutId = id;
    
    viewTitle.textContent = wk.name || 'Тренировка';
    viewDate.textContent = formatDateDisplay(wk.date);
    
    renderViewExercises(wk);
    updateProgress(wk);
    
    navigateTo('view');
    closeModal(document.getElementById('modal-calendar'));
}

function renderViewExercises(wk) {
    viewExercisesList.innerHTML = '';
    
    if (wk.exercises.length === 0) {
        viewExercisesList.innerHTML = `
            <div class="empty-state" style="height: auto; padding: 2rem;">
                <p class="empty-desc">В этой тренировке нет упражнений.</p>
            </div>
        `;
        return;
    }
    
    wk.exercises.forEach((ex, index) => {
        const exEl = document.createElement('div');
        exEl.className = `exercise-view-card ${ex.done ? 'done' : ''}`;
        
        let statsHtml = '';
        if (ex.sets || ex.reps) {
            const setsReps = `${ex.sets ? ex.sets : '?'} <span class="accent-text">×</span> ${ex.reps ? ex.reps : '?'}`;
            statsHtml += `<div class="stat-chip">${setsReps}</div>`;
        }
        if (ex.weight) {
            statsHtml += `<div class="stat-chip">${ex.weight} кг</div>`;
        }
        
        const plateauCount = getPlateauCount(ex.name, ex.weight, ex.reps, wk.date, wk.id);
        const plateauHtml = plateauCount >= 2 ? `<div class="plateau-indicator">${plateauCount}×</div>` : '';
        
        exEl.innerHTML = `
            ${plateauHtml}
            <div class="checkbox-wrapper">
                <div class="custom-checkbox" data-id="${ex.id}" data-workout-id="${wk.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            </div>
            <div class="exercise-view-content">
                <h4 class="exercise-view-title">${ex.name}</h4>
                <div class="exercise-view-stats">
                    ${statsHtml}
                </div>
                ${ex.comment ? `<div class="exercise-view-comment">${ex.comment}</div>` : ''}
            </div>
        `;
        
        viewExercisesList.appendChild(exEl);
    });
    
    initSortable('view-exercises-list', false);
    
    // Checkbox event listeners
    document.querySelectorAll('.custom-checkbox').forEach(cb => {
        cb.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const exId = el.getAttribute('data-id');
            const wkId = el.getAttribute('data-workout-id');
            toggleExerciseStatus(wkId, exId, el);
        });
    });
}





























async function toggleExerciseStatus(wkId, exId, checkboxEl) {
    const wk = appData.workouts.find(w => w.id === wkId);
    if (!wk) return;

    const ex = wk.exercises.find(e => e.id === exId);
    if (!ex) return;

    ex.done = !ex.done;

    // Update UI
    const cardEl = checkboxEl.closest('.exercise-view-card');
    if (ex.done) {
        cardEl.classList.add('done');
    } else {
        cardEl.classList.remove('done');
    }

    updateProgress(wk);
    renderHome();

    // Если тренировка завершена — сохраняем и показываем поздравление
    const total = wk.exercises.length;
    const done = wk.exercises.filter(e => e.done).length;
    const isCompleted = total > 0 && done === total;

    if (isCompleted) {
        // Гарантированное сохранение в БД
        await db.saveWorkout(wk);

        // Сохраняем в профиль Supabase для мгновенного обновления на других устройствах
        if (appData.username) {
            await syncCompletedWorkoutToProfile(wk);
        }

        // Только для iPhone и только для профиля Катюша (Валику не показываем)
        const isIPhone = navigator.userAgent.includes('iPhone');
        const isKatusha = appData.username === 'Катюша';
        const isValik = appData.username === 'Валик';
        if (isIPhone && isKatusha) {
            await showiOSCongratulation(wk);
        } else if (!isValik) {
            showToast('Тренировка завершена! ✨');
            navigateTo('home');
        } else {
            showToast('Тренировка завершена! ✨');
            navigateTo('home');
        }

        // Автосинхронизация
        if (appData.username) {
            syncToCloud(true);
        }
    } else {
        // Промежуточные изменения (если тренировка не завершена) — сохраняем
        await db.saveWorkout(wk);
        if (appData.username) {
            syncToCloud(true);
        }
    }
}

// ── iOS поздравление (только для Катюши) ──
async function showiOSCongratulation(wk) {
    spawnConfetti();
    const overlay = document.getElementById('ios-congratulations');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('active');
    }));
    await new Promise(resolve => setTimeout(resolve, 3000));
    overlay.classList.remove('active');
    await new Promise(resolve => setTimeout(resolve, 600));
    overlay.classList.add('hidden');
    clearConfetti();
    navigateTo('home');
}

function updateCardPlateauBadge(cardEl, exercise) {
    const badge = cardEl.querySelector('.plateau-indicator');
    const count = getPlateauCount(exercise.name, exercise.weight, exercise.reps, currentWorkoutData.date, currentWorkoutData.id);
    
    if (count >= 2) {
        if (badge) {
            badge.textContent = `${count}×`;
            badge.classList.remove('hidden');
        } else {
            const newBadge = document.createElement('div');
            newBadge.className = 'plateau-indicator';
            newBadge.textContent = `${count}×`;
            const header = cardEl.querySelector('.exercise-edit-header');
            if (header) header.appendChild(newBadge);
        }
    } else if (badge) {
        badge.classList.add('hidden');
    }
}

function getPlateauCount(exerciseName, weight, reps, currentWorkoutDate, currentWorkoutId) {
    if (!exerciseName || !weight || !reps) return 1;
    
    let count = 1;
    // Sort all workouts by date newest first, then by ID (which is time-based)
    const sortedWorkouts = [...appData.workouts].sort((a, b) => {
        if (b.date !== a.date) return new Date(b.date) - new Date(a.date);
        return b.id.localeCompare(a.id);
    });

    // We want workouts that are older or same-day but not the current one
    const olderWorkouts = sortedWorkouts.filter(w => {
        if (w.id === currentWorkoutId) return false;
        if (w.date < currentWorkoutDate) return true;
        if (w.date === currentWorkoutDate) {
            // Same day: use ID comparison (id is generated with Date.now().toString(36))
            // But wait, the ID might not be perfectly chronological if generated very close.
            // Still, for same-day, we just need a consistent "previous".
            return w.id < currentWorkoutId; 
        }
        return false;
    });

    for (const wk of olderWorkouts) {
        const matchingEx = wk.exercises.find(ex => ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase());
        if (matchingEx) {
            // Compare as numbers to handle "100" vs "100.0"
            const w1 = parseFloat(matchingEx.weight);
            const w2 = parseFloat(weight);
            const r1 = parseInt(matchingEx.reps);
            const r2 = parseInt(reps);
            
            if (!isNaN(w1) && !isNaN(w2) && w1 === w2 && !isNaN(r1) && !isNaN(r2) && r1 === r2) {
                count++;
            } else {
                break;
            }
        } else {
            continue; 
        }
    }
    return count;
}

// ── iOS confetti helpers ──────────────────────────────────────────────────
function spawnConfetti() {
    const container = document.getElementById('ios-confetti-container');
    if (!container) return;
    container.innerHTML = '';

    const symbols = ['\u2665', '\u2726', '\u2605', '\u2728', '\u2661', '\u2733'];
    const colors  = ['#ff69b4','#e83e8c','#FFD700','#FFA500','#ff1493','#fffbe0','#ff85c2'];

    for (let i = 0; i < 38; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-particle';
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        const size   = (0.85 + Math.random() * 1.45).toFixed(2);
        const delay  = (Math.random() * 2.2).toFixed(2);
        const dur    = (2.2 + Math.random() * 3.0).toFixed(2);
        el.style.cssText = [
            `left:${(Math.random() * 102).toFixed(1)}%`,
            `top:${(-8 - Math.random() * 18).toFixed(1)}%`,
            `color:${colors[Math.floor(Math.random() * colors.length)]}`,
            `font-size:${size}rem`,
            `animation-delay:${delay}s`,
            `animation-duration:${dur}s`
        ].join(';');
        container.appendChild(el);
    }
}

function clearConfetti() {
    const c = document.getElementById('ios-confetti-container');
    if (c) c.innerHTML = '';
}




































// --- Drag and Drop ---
function initSortable(containerId, isEditMode) {
    const el = document.getElementById(containerId);
    if (!el || !window.Sortable) return;

    // Destroy existing instance if any
    const existing = Sortable.get(el);
    if (existing) existing.destroy();

    Sortable.create(el, {
        animation: 200,
        delay: 500,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        fallbackTolerance: 3,
        onStart: () => {
            if (navigator.vibrate) navigator.vibrate(50);
        },
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            if (oldIndex === newIndex) return;

            let wk;
            if (isEditMode) {
                wk = currentWorkoutData;
            } else {
                wk = appData.workouts.find(w => w.id === viewingWorkoutId);
            }

            if (!wk) return;

            // Move in array
            const movedItem = wk.exercises.splice(oldIndex, 1)[0];
            wk.exercises.splice(newIndex, 0, movedItem);

            // Save to DB
            await db.saveWorkout(wk);

            // Re-render to update indexes and data-attributes
            if (isEditMode) {
                renderEditExercises();
            } else {
                renderViewExercises(wk);
            }
            
            renderHome();
        }
    });
}

function updateProgress(wk) {
    const total = wk.exercises.length;
    const done = wk.exercises.filter(e => e.done).length;
    
    progressText.textContent = `${done} / ${total}`;
    
    if (total === 0) {
        progressFill.style.width = '0%';
    } else {
        const percent = (done / total) * 100;
        progressFill.style.width = `${percent}%`;
    }
}

async function deleteWorkout() {
    if (!viewingWorkoutId) return;
    
    await db.deleteWorkout(viewingWorkoutId);
    appData.workouts = appData.workouts.filter(w => w.id !== viewingWorkoutId);
    
    // Auto-sync to cloud if enabled
    if (appData.username) {
        syncToCloud(true);
    }
    
    renderHome();
    closeModal(modalConfirm);
    showToast('Тренировка удалена');
    navigateTo('home');
}

// --- Favorites Modal ---
function renderFavoritesModal() {
    const list = document.getElementById('favorites-list');
    list.innerHTML = '';
    
    appData.favorites.forEach((fav, index) => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <span>${fav}</span>
            <button class="icon-btn btn-remove-fav" data-index="${index}" style="width:32px;height:32px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;
        list.appendChild(item);
    });
    
    document.querySelectorAll('.btn-remove-fav').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            appData.favorites.splice(idx, 1);
            await saveData();
            renderFavoritesModal();
        });
    });
}

async function addFavorite() {
    const input = document.getElementById('new-favorite-input');
    const val = input.value.trim();
    if (val && !appData.favorites.includes(val)) {
        appData.favorites.unshift(val); // Add to top
        await saveData();
        input.value = '';
        renderFavoritesModal();
    }
}

// --- Settings (theme only — no user name) ---
async function loadSettings() {
    // Nothing to load by name; theme is loaded separately via loadTheme()
}

async function saveSettings() {
    await toggleTheme();
    closeModal(modalSettings);
    showToast('Тема изменена');
}

// --- Modals Utils ---
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

// --- Supabase Cloud Sync ---
const SUPABASE_URL = 'https://ccekjgkopqkshxhdjezd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e1w5LQ8Jnjj2NGSuPrXZzA_ietBW25E';

async function syncToCloud(silent = false) {
    if (!appData.username && silent) return;
    
    const btn = document.getElementById('btn-login');
    
    try {
        const data = await db.exportAllData();
        const username = appData.username;
        if (!username) return;
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gym_sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                sync_code: username,
                data: data
            })
        });

        if (!response.ok) throw new Error('Cloud save failed');

        if (!silent) showToast('Данные в облаке!');
    } catch (e) {
        console.error(e);
        if (!silent) showToast('Ошибка сохранения в облако');
    }
}

async function loginAccount() {
    const input = document.getElementById('input-username');
    const btn = document.getElementById('btn-login');
    const name = input.value.trim();
    
    if (!name) {
        showToast('Введите имя (Катюша или Валик)');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = 'Вход...';
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gym_sync?sync_code=eq.${name}&select=data`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const result = await response.json();
        
        // If account exists, ask to import
        if (result && result.length > 0) {
            if (confirm(`Найдена резервная копия для "${name}". Загрузить её и заменить текущие данные?`)) {
                await db.importAllData(result[0].data);
                appData.username = name;
                await db.saveSetting('username', name);
                showToast('Данные загружены! Перезагрузка...');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }
        }
        
        // If not found or user cancelled import, just link the account
        appData.username = name;
        await db.saveSetting('username', name);
        await syncToCloud(); // Save current local data to cloud for this user
        
        updateSettingsUI();
        showToast(`Вы вошли как ${name}`);
    } catch (e) {
        console.error(e);
        showToast('Ошибка при входе');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Войти';
    }
}

async function logoutAccount() {
    if (confirm('Выйти из аккаунта? Авто-сохранение в облако прекратится.')) {
        appData.username = null;
        await db.saveSetting('username', null);
        updateSettingsUI();
        showToast('Вы вышли из аккаунта');
    }
}

function updateSettingsUI() {
    const statusBox = document.getElementById('account-status');
    const loginForm = document.getElementById('login-form');
    const nameEl = document.getElementById('active-username');
    
    if (appData.username) {
        statusBox.classList.remove('hidden');
        loginForm.classList.add('hidden');
        nameEl.textContent = appData.username;
    } else {
        statusBox.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
}


// ── Сохранение завершённой тренировки в профиль Supabase ──────────────
async function syncCompletedWorkoutToProfile(workout) {
    if (!appData.username) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gym_profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                username: appData.username,
                workout_id: workout.id,
                workout_data: workout,
                completed_at: new Date().toISOString()
            })
        });

        if (!response.ok) throw new Error('Profile save failed');
    } catch (e) {
        console.error('Ошибка сохранения в профиль:', e);
    }
}

// ── Экспорт / Импорт данных ─────────────────────────────────────────────
async function exportData() {
    try {
        const data = await db.exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = getTodayDateStr();
        a.download = `gymtracker_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ Данные экспортированы');
    } catch (e) {
        console.error('Ошибка экспорта:', e);
        showToast('❌ Ошибка экспорта');
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.workouts || !data.settings) {
            showToast('❌ Неверный формат файла');
            return;
        }
        
        // Показываем подтверждение
        if (!confirm(`Загрузить ${data.workouts.length} тренировок? Текущие данные будут заменены.`)) {
            return;
        }
        
        await db.importAllData(data);
        
        // Перезагружаем данные
        await loadData();
        renderHome();
        showToast(`✅ Загружено ${data.workouts.length} тренировок`);
        
        // Сброс input, чтобы можно было выбрать тот же файл повторно
        event.target.value = '';
    } catch (e) {
        console.error('Ошибка импорта:', e);
        showToast('❌ Ошибка импорта');
        event.target.value = '';
    }
}

// --- Events Setup ---
function setupEventListeners() {
    // Buttons
    document.getElementById('btn-new-workout').addEventListener('click', openNewWorkout);
    document.getElementById('btn-back-home').addEventListener('click', () => navigateTo('home'));
    document.getElementById('btn-back-view').addEventListener('click', () => navigateTo('home'));
    
    document.getElementById('btn-add-exercise').addEventListener('click', addNewExercise);
    document.getElementById('btn-save-workout').addEventListener('click', saveWorkout);
    
    document.getElementById('btn-edit-workout').addEventListener('click', () => {
        if (viewingWorkoutId) openEditWorkout(viewingWorkoutId);
    });
    
    document.getElementById('btn-delete-workout').addEventListener('click', () => {
        openModal(modalConfirm);
    });
    
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => closeModal(modalConfirm));
    document.getElementById('btn-confirm-delete').addEventListener('click', deleteWorkout);
    
    // Favorites
    document.getElementById('btn-favorites-manage').addEventListener('click', () => {
        renderFavoritesModal();
        openModal(modalFavorites);
    });
    document.getElementById('btn-close-favorites').addEventListener('click', () => closeModal(modalFavorites));
    document.getElementById('btn-add-favorite').addEventListener('click', addFavorite);
    
    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => {
        updateSettingsUI();
        openModal(modalSettings);
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => closeModal(modalSettings));
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

    document.getElementById('btn-close-summary').addEventListener('click', () => {
        document.getElementById('day-summary').classList.add('hidden');
    });

    // Calendar Modal
    const modalCalendar = document.getElementById('modal-calendar');
    document.getElementById('btn-history').addEventListener('click', () => {
        currentCalendarDate = new Date(); // Reset to today when opening
        renderCalendar();
        openModal(modalCalendar);
    });
    document.getElementById('btn-close-calendar').addEventListener('click', () => closeModal(modalCalendar));

    document.getElementById('btn-prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('btn-next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // Giant Clock
    document.getElementById('live-clock').addEventListener('click', toggleGiantClock);
    document.getElementById('giant-clock-overlay').addEventListener('click', toggleGiantClock);

    document.getElementById('new-favorite-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFavorite();
    });

        // Sync Buttons
    document.getElementById('btn-login').addEventListener('click', loginAccount);
    document.getElementById('btn-logout').addEventListener('click', logoutAccount);
    
    // Export / Import
    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);
    
    // Close modals on outside click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });
    
    // Swipe gestures on modal sheets (simple implementation)
    let touchStartY = 0;
    const modalSheet = document.querySelector('.modal-sheet');
    if (modalSheet) {
        modalSheet.addEventListener('touchstart', e => {
            touchStartY = e.changedTouches[0].screenY;
        });
        modalSheet.addEventListener('touchend', e => {
            const touchEndY = e.changedTouches[0].screenY;
            if (touchEndY - touchStartY > 100) {
                // Determine which modal is active and close it
                document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => closeModal(modal));
            }
        });
    }
}

=======
import { db } from './db.js';

// --- Data Management ---
const STORAGE_KEY = 'gymtracker_data';
let appData = {
    workouts: [],
    favorites: [
        "Жим лежа",
        "Приседания со штангой",
        "Становая тяга",
        "Подтягивания",
        "Отжимания на брусьях",
        "Гиперэкстензия",
        "Тяга верхнего блока",
        "Тяга штанги в наклоне",
        "Жим гантелей сидя",
        "Подъем на бицепс"
    ]
};

// --- State ---
let currentScreen = 'home';
let editingWorkoutId = null;
let currentWorkoutData = { id: null, date: '', name: '', exercises: [] };
let viewingWorkoutId = null;
let currentTheme = 'cyber';
let currentCalendarDate = new Date();

// --- Elements ---
const screens = {
    home: document.getElementById('screen-home'),
    workout: document.getElementById('screen-workout'),
    view: document.getElementById('screen-view')
};

// Modals
const modalFavorites = document.getElementById('modal-favorites');
const modalSettings = document.getElementById('modal-settings');
const modalConfirm = document.getElementById('modal-confirm');
const toastEl = document.getElementById('toast');


// Home Screen Elements
const workoutsList = document.getElementById('workouts-list');
const emptyState = document.getElementById('empty-state');

// Workout Edit Screen Elements
const workoutDateInput = document.getElementById('workout-date');
const workoutNameInput = document.getElementById('workout-name');
const exercisesList = document.getElementById('exercises-list');
const exercisesCount = document.getElementById('exercises-count');

// View Screen Elements
const viewTitle = document.getElementById('view-title');
const viewDate = document.getElementById('view-date');
const viewExercisesList = document.getElementById('view-exercises-list');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    injectDatalist();
    renderHome();
    setupEventListeners();
    await loadTheme();
    startClock();
    
        // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);

                    // Проверяем обновления при каждом запуске
                    registration.update();

                    // Когда новый SW найден
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New SW installed, activating...');
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });
                }, err => {
                    console.log('ServiceWorker registration failed:', err);
                });

            // Перезагружаем только один раз при смене контроллера
            let reloading = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!reloading) {
                    reloading = true;
                    console.log('SW updated, reloading...');
                    window.location.reload();
                }
            });
        });
    }
    
    // Hide splash screen
    const hideSplash = () => {
        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    };
    setTimeout(hideSplash, 1500);
});

async function loadData() {
    try {
        appData.workouts = await db.getAllWorkouts();
        
        // Load settings
        const favorites = await db.getSetting('favorites');
        if (favorites && favorites.length > 0) appData.favorites = favorites;
        
        const username = await db.getSetting('username');
        appData.username = username || null;
    } catch (e) {
        console.error("Error loading data from IndexedDB", e);
    }
}

async function saveData() {
    // Эта функция теперь в основном синхронизирует избранное, 
    // так как тренировки сохраняются индивидуально через db.saveWorkout
    await db.saveSetting('favorites', appData.favorites);
    updateDatalist();
    
    // Auto-sync to cloud if enabled
    if (appData.username) {
        syncToCloud(true);
    }
}

function injectDatalist() {
    const datalist = document.createElement('datalist');
    datalist.id = 'favorites-datalist';
    document.body.appendChild(datalist);
    updateDatalist();
}

function updateDatalist() {
    const datalist = document.getElementById('favorites-datalist');
    datalist.innerHTML = '';
    appData.favorites.forEach(fav => {
        const option = document.createElement('option');
        option.value = fav;
        datalist.appendChild(option);
    });
}

// --- Navigation ---
function navigateTo(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    currentScreen = screenName;
    window.scrollTo(0, 0);
}

// --- Toast ---
function showToast(message, duration = 3000) {
    toastEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ${message}
    `;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, duration);
}

// --- Live Clock ---
let clockInterval;
function startClock() {
    const clockEl = document.getElementById('live-clock');
    const giantClockEl = document.getElementById('giant-clock-text');
    
    if (clockInterval) clearInterval(clockInterval);
    
    clockInterval = setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour12: false });
        clockEl.textContent = timeStr;
        if (giantClockEl) giantClockEl.textContent = timeStr;
    }, 1000);
}

// --- Giant Clock Overlay ---
function toggleGiantClock() {
    const overlay = document.getElementById('giant-clock-overlay');
    overlay.classList.toggle('hidden');
}

// --- Theme Switching ---
async function loadTheme() {
    let theme = await db.getSetting('theme');
    if (!theme) {
        theme = localStorage.getItem('gymtracker_theme') || 'cyber';
    }
    if (theme) {
        currentTheme = theme;
        // Mirror to localStorage for fast anti-flash sync read on next startup
        try { localStorage.setItem('gymtracker_theme', currentTheme); } catch(e) {}
        applyTheme();
    }
}

async function toggleTheme() {
    currentTheme = currentTheme === 'minimal' ? 'cyber' : 'minimal';
    // Mirror to localStorage for instant anti-flash read on next cold start
    try { localStorage.setItem('gymtracker_theme', currentTheme); } catch(e) {}
    applyTheme();
    await db.saveSetting('theme', currentTheme);
}

function applyTheme() {
    const isMinimal = currentTheme === 'minimal';
    const mascotPath = 'icons/rabbit_girl_new.png';
    const bgColor    = isMinimal ? '#ffffff' : '#0d0f14';

    // Toggle CSS classes on body
    document.body.classList.remove('theme-minimal', 'theme-cyber');
    document.body.classList.add(`theme-${currentTheme}`);

    // Update dynamic theme-color meta tag for browser chrome
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
    }
    metaTheme.content = bgColor;

    // Update all mascot image instances
    const headerAvatar = document.getElementById('header-avatar');
    const splashAvatar = document.getElementById('splash-avatar');
    const emptyAvatar  = document.getElementById('empty-avatar');

    if (headerAvatar) headerAvatar.src = mascotPath;
    if (splashAvatar) splashAvatar.src  = mascotPath;
    if (emptyAvatar)  emptyAvatar.src   = mascotPath;
}

// --- Date Utils ---
function getTodayDateStr() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU', options);
    } catch(e) {
        return dateStr;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Home Screen ---
function renderHome() {
    workoutsList.innerHTML = '';
    // renderCalendar(); // Removed from home screen
    
    if (appData.workouts.length === 0) {
        emptyState.classList.remove('hidden');
        workoutsList.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    workoutsList.classList.remove('hidden');
    
    // Sort workouts newest first
    const sortedWorkouts = [...appData.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedWorkouts.forEach(wk => {
        const completedEx = wk.exercises.filter(ex => ex.done).length;
        const totalEx = wk.exercises.length;
        
        const card = document.createElement('div');
        const isCompleted = totalEx > 0 && completedEx === totalEx;
        const isToday = wk.date === getTodayDateStr();
        
        const plateauCountTotal = wk.exercises.reduce((acc, ex) => {
            const count = getPlateauCount(ex.name, ex.weight, ex.reps, wk.date, wk.id);
            return count >= 2 ? acc + 1 : acc;
        }, 0);
        const plateauSummaryHtml = plateauCountTotal > 0 ? `<div class="plateau-indicator" title="Упражнений на плато">${plateauCountTotal}×</div>` : '';

        let cardClass = 'workout-card';
        if (isCompleted) cardClass += ' is-completed';
        else if (isToday) cardClass += ' is-active';
        card.className = cardClass;
        card.innerHTML = `
            <div class="workout-card-header">
                <div class="workout-card-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${formatDateDisplay(wk.date)}
                </div>
                ${plateauSummaryHtml}
                <button class="icon-btn-small btn-duplicate" data-id="${wk.id}" title="Повторить тренировку">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
            <h3 class="workout-card-title">${wk.name || 'Без названия'}</h3>
            <div class="workout-card-stats">
                <div class="stat-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Упражнений: ${totalEx}
                </div>
                ${completedEx === totalEx && totalEx > 0 ? 
                    `<div class="stat-badge" style="color: var(--success-color); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.1);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        Выполнено
                    </div>` : 
                    `<div class="stat-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Прогресс: ${completedEx}/${totalEx}
                    </div>`
                }
            </div>
        `;
        
        const duplicateBtn = card.querySelector('.btn-duplicate');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateWorkout(wk.id);
            });
        }
        
        card.addEventListener('click', () => openWorkoutView(wk.id));
        workoutsList.appendChild(card);
    });
}

// --- Calendar Logic ---
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust for Russian week (starts on Monday)
    let startDay = firstDay === 0 ? 6 : firstDay - 1;
    
    calendarGrid.innerHTML = '';
    
    // Day labels
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekDays.forEach(day => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'calendar-day-label';
        dayLabel.textContent = day;
        calendarGrid.appendChild(dayLabel);
    });
    
    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }
    
    // Days of the month
    const workoutDays = new Set(appData.workouts.map(w => w.date));
    const todayStr = getTodayDateStr();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        
        if (workoutDays.has(dateStr)) {
            dayCell.classList.add('has-workout');
            
            // Add a little dot for workout
            const dot = document.createElement('div');
            dot.className = 'calendar-dot';
            dayCell.appendChild(dot);
        }
        
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }
        
        dayCell.addEventListener('click', () => showDaySummary(dateStr));
        calendarGrid.appendChild(dayCell);
    }
}

function showDaySummary(dateStr) {
    const summaryCard = document.getElementById('day-summary');
    const summaryDate = document.getElementById('summary-date');
    const summaryContent = document.getElementById('summary-content');
    
    const workouts = appData.workouts.filter(w => w.date === dateStr);
    
    summaryDate.textContent = formatDateDisplay(dateStr);
    summaryContent.innerHTML = '';
    
    if (workouts.length === 0) {
        summaryContent.innerHTML = '<p class="no-workouts">В этот день тренировок не было.</p>';
    } else {
        workouts.forEach(wk => {
            const wkEl = document.createElement('div');
            wkEl.className = 'summary-workout-item';
            
            const exercisesStr = wk.exercises.map(ex => ex.name).join(', ') || 'Без упражнений';
            
            wkEl.innerHTML = `
                <strong>${wk.name || 'Тренировка'}</strong>
                <p>${exercisesStr}</p>
                <button class="btn-link btn-open-wk" data-id="${wk.id}">Открыть</button>
            `;
            wkEl.querySelector('.btn-open-wk').addEventListener('click', (e) => {
                openWorkoutView(e.currentTarget.getAttribute('data-id'));
            });
            summaryContent.appendChild(wkEl);
        });
    }
    
    summaryCard.classList.remove('hidden');
}

// --- Edit Screen ---
function openNewWorkout() {
    editingWorkoutId = null;
    currentWorkoutData = {
        id: generateId(),
        date: getTodayDateStr(),
        name: '',
        exercises: []
    };
    
    document.getElementById('workout-screen-title').textContent = 'Новая тренировка';
    initEditScreen();
    navigateTo('workout');
}

function duplicateWorkout(id) {
    const wk = appData.workouts.find(w => w.id === id);
    if (!wk) return;
    
    editingWorkoutId = null; // We are creating a new workout
    
    // Deep copy and reset specific fields
    const duplicatedData = JSON.parse(JSON.stringify(wk));
    
    currentWorkoutData = {
        id: generateId(),
        date: getTodayDateStr(),
        name: duplicatedData.name,
        exercises: duplicatedData.exercises.map(ex => ({
            ...ex,
            id: generateId(), // generate new ID for the exercise
            done: false // Reset done status
        }))
    };
    
    document.getElementById('workout-screen-title').textContent = 'Новая тренировка';
    initEditScreen();
    navigateTo('workout');
    showToast('Тренировка скопирована');
}

function openEditWorkout(id) {
    const wk = appData.workouts.find(w => w.id === id);
    if (!wk) return;
    
    editingWorkoutId = id;
    // Deep copy
    currentWorkoutData = JSON.parse(JSON.stringify(wk));
    
    document.getElementById('workout-screen-title').textContent = 'Редактирование';
    initEditScreen();
    navigateTo('workout');
}

function initEditScreen() {
    workoutDateInput.value = currentWorkoutData.date;
    workoutNameInput.value = currentWorkoutData.name;
    renderEditExercises();
}

function renderEditExercises() {
    exercisesList.innerHTML = '';
    exercisesCount.textContent = currentWorkoutData.exercises.length;
    
    currentWorkoutData.exercises.forEach((ex, index) => {
        const exEl = document.createElement('div');
        exEl.className = 'exercise-edit-card';
        const plateauCount = getPlateauCount(ex.name, ex.weight, ex.reps, currentWorkoutData.date, currentWorkoutData.id);
        const plateauHtml = plateauCount >= 2 ? `<div class="plateau-indicator">${plateauCount}×</div>` : '';
        
        exEl.innerHTML = `
            <div class="exercise-edit-header">
                <div class="exercise-number">${index + 1}</div>
                ${plateauHtml}
                <button class="icon-btn btn-remove-exercise" data-index="${index}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
            
            <div class="form-group exercise-name-input">
                <label class="form-label">Упражнение</label>
                <input type="text" class="form-input ex-name" placeholder="Название (напр. Жим лежа)" value="${ex.name || ''}" list="favorites-datalist" data-index="${index}">
            </div>
            
            <div class="set-rep-row">
                <div class="form-group">
                    <label class="form-label">Подходы</label>
                    <input type="number" class="form-input ex-sets" placeholder="3" value="${ex.sets || ''}" min="1" data-index="${index}">
                </div>
                <div class="form-group">
                    <label class="form-label">Повторения</label>
                    <input type="number" class="form-input ex-reps" placeholder="10" value="${ex.reps || ''}" min="1" data-index="${index}">
                </div>
                <div class="form-group">
                    <label class="form-label">Вес (кг)</label>
                    <input type="number" class="form-input ex-weight" placeholder="50" value="${ex.weight || ''}" step="0.5" data-index="${index}">
                </div>
            </div>
            
            <div class="form-group">
                <input type="text" class="form-input ex-comment" placeholder="Комментарий (опционально)" value="${ex.comment || ''}" data-index="${index}">
            </div>
        `;
        
        exercisesList.appendChild(exEl);
    });
    
    initSortable('exercises-list', true);
    
    // Attach event listeners for dynamic inputs
    document.querySelectorAll('.btn-remove-exercise').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            currentWorkoutData.exercises.splice(index, 1);
            renderEditExercises();
        });
    });
    
    const updateExData = (e, field) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        currentWorkoutData.exercises[index][field] = e.target.value;
        
        // Update plateau badge in real-time
        if (field === 'name' || field === 'weight' || field === 'reps') {
            const cardEl = e.target.closest('.exercise-edit-card');
            updateCardPlateauBadge(cardEl, currentWorkoutData.exercises[index]);
        }
    };
    
    document.querySelectorAll('.ex-name').forEach(el => el.addEventListener('input', e => updateExData(e, 'name')));
    document.querySelectorAll('.ex-sets').forEach(el => el.addEventListener('input', e => updateExData(e, 'sets')));
    document.querySelectorAll('.ex-reps').forEach(el => el.addEventListener('input', e => updateExData(e, 'reps')));
    document.querySelectorAll('.ex-weight').forEach(el => el.addEventListener('input', e => updateExData(e, 'weight')));
    document.querySelectorAll('.ex-comment').forEach(el => el.addEventListener('input', e => updateExData(e, 'comment')));
}

function addNewExercise() {
    currentWorkoutData.exercises.push({
        id: generateId(),
        name: '',
        sets: '',
        reps: '',
        weight: '',
        comment: '',
        done: false
    });
    renderEditExercises();
    
    // Scroll to bottom
    setTimeout(() => {
        document.getElementById('workout-content').scrollTop = document.getElementById('workout-content').scrollHeight;
    }, 50);
}

async function saveWorkout() {
    // Update main fields
    currentWorkoutData.date = workoutDateInput.value || getTodayDateStr();
    currentWorkoutData.name = workoutNameInput.value.trim();
    
    if (!currentWorkoutData.name) {
        // Auto-generate name if empty
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const dayName = days[new Date(currentWorkoutData.date).getDay()];
        currentWorkoutData.name = `Тренировка (${dayName})`;
    }
    
    // Clean up empty exercises
    currentWorkoutData.exercises = currentWorkoutData.exercises.filter(ex => ex.name.trim() !== '');
    
    if (editingWorkoutId) {
        const index = appData.workouts.findIndex(w => w.id === editingWorkoutId);
        if (index !== -1) {
            appData.workouts[index] = currentWorkoutData;
        }
    } else {
        appData.workouts.push(currentWorkoutData);
    }
    
    try {
            await db.saveWorkout(currentWorkoutData);
            updateDatalist();
            renderHome();
            showToast('Тренировка сохранена');

            if (appData.username) {
                await syncToCloud(true);
            }

            if (editingWorkoutId) {
                openWorkoutView(currentWorkoutData.id);
            } else {
                navigateTo('home');
            }
        } catch (e) {
            console.error('Ошибка сохранения (saveWorkout):', e);
            showToast('Ошибка сохранения');
        }
    }

// --- View Screen ---
function openWorkoutView(id) {
    const wk = appData.workouts.find(w => w.id === id);
    if (!wk) return;
    
    viewingWorkoutId = id;
    
    viewTitle.textContent = wk.name || 'Тренировка';
    viewDate.textContent = formatDateDisplay(wk.date);
    
    renderViewExercises(wk);
    updateProgress(wk);
    
    navigateTo('view');
    closeModal(document.getElementById('modal-calendar'));
}

function renderViewExercises(wk) {
    viewExercisesList.innerHTML = '';
    
    if (wk.exercises.length === 0) {
        viewExercisesList.innerHTML = `
            <div class="empty-state" style="height: auto; padding: 2rem;">
                <p class="empty-desc">В этой тренировке нет упражнений.</p>
            </div>
        `;
        return;
    }
    
    wk.exercises.forEach((ex, index) => {
        const exEl = document.createElement('div');
        exEl.className = `exercise-view-card ${ex.done ? 'done' : ''}`;
        
        let statsHtml = '';
        if (ex.sets || ex.reps) {
            const setsReps = `${ex.sets ? ex.sets : '?'} <span class="accent-text">×</span> ${ex.reps ? ex.reps : '?'}`;
            statsHtml += `<div class="stat-chip">${setsReps}</div>`;
        }
        if (ex.weight) {
            statsHtml += `<div class="stat-chip">${ex.weight} кг</div>`;
        }
        
        const plateauCount = getPlateauCount(ex.name, ex.weight, ex.reps, wk.date, wk.id);
        const plateauHtml = plateauCount >= 2 ? `<div class="plateau-indicator">${plateauCount}×</div>` : '';
        
        exEl.innerHTML = `
            ${plateauHtml}
            <div class="checkbox-wrapper">
                <div class="custom-checkbox" data-id="${ex.id}" data-workout-id="${wk.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            </div>
            <div class="exercise-view-content">
                <h4 class="exercise-view-title">${ex.name}</h4>
                <div class="exercise-view-stats">
                    ${statsHtml}
                </div>
                ${ex.comment ? `<div class="exercise-view-comment">${ex.comment}</div>` : ''}
            </div>
        `;
        
        viewExercisesList.appendChild(exEl);
    });
    
    initSortable('view-exercises-list', false);
    
    // Checkbox event listeners
    document.querySelectorAll('.custom-checkbox').forEach(cb => {
        cb.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const exId = el.getAttribute('data-id');
            const wkId = el.getAttribute('data-workout-id');
            toggleExerciseStatus(wkId, exId, el);
        });
    });
}





























async function toggleExerciseStatus(wkId, exId, checkboxEl) {
    const wk = appData.workouts.find(w => w.id === wkId);
    if (!wk) return;

    const ex = wk.exercises.find(e => e.id === exId);
    if (!ex) return;

    ex.done = !ex.done;

    // Update UI
    const cardEl = checkboxEl.closest('.exercise-view-card');
    if (ex.done) {
        cardEl.classList.add('done');
    } else {
        cardEl.classList.remove('done');
    }

    updateProgress(wk);
    renderHome();

    // Если тренировка завершена — сохраняем и показываем поздравление
    const total = wk.exercises.length;
    const done = wk.exercises.filter(e => e.done).length;
    const isCompleted = total > 0 && done === total;

    if (isCompleted) {
        // Гарантированное сохранение в БД
        await db.saveWorkout(wk);

        // Сохраняем в профиль Supabase для мгновенного обновления на других устройствах
        if (appData.username) {
            await syncCompletedWorkoutToProfile(wk);
        }

        // Только для iPhone и только для профиля Катюша (Валику не показываем)
        const isIPhone = navigator.userAgent.includes('iPhone');
        const isKatusha = appData.username === 'Катюша';
        const isValik = appData.username === 'Валик';
        if (isIPhone && isKatusha) {
            await showiOSCongratulation(wk);
        } else if (!isValik) {
            showToast('Тренировка завершена! ✨');
            navigateTo('home');
        } else {
            showToast('Тренировка завершена! ✨');
            navigateTo('home');
        }

        // Автосинхронизация
        if (appData.username) {
            syncToCloud(true);
        }
    } else {
        // Промежуточные изменения (если тренировка не завершена) — сохраняем
        await db.saveWorkout(wk);
        if (appData.username) {
            syncToCloud(true);
        }
    }
}

// ── iOS поздравление (только для Катюши) ──
async function showiOSCongratulation(wk) {
    spawnConfetti();
    const overlay = document.getElementById('ios-congratulations');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('active');
    }));
    await new Promise(resolve => setTimeout(resolve, 3000));
    overlay.classList.remove('active');
    await new Promise(resolve => setTimeout(resolve, 600));
    overlay.classList.add('hidden');
    clearConfetti();
    navigateTo('home');
}

function updateCardPlateauBadge(cardEl, exercise) {
    const badge = cardEl.querySelector('.plateau-indicator');
    const count = getPlateauCount(exercise.name, exercise.weight, exercise.reps, currentWorkoutData.date, currentWorkoutData.id);
    
    if (count >= 2) {
        if (badge) {
            badge.textContent = `${count}×`;
            badge.classList.remove('hidden');
        } else {
            const newBadge = document.createElement('div');
            newBadge.className = 'plateau-indicator';
            newBadge.textContent = `${count}×`;
            const header = cardEl.querySelector('.exercise-edit-header');
            if (header) header.appendChild(newBadge);
        }
    } else if (badge) {
        badge.classList.add('hidden');
    }
}

function getPlateauCount(exerciseName, weight, reps, currentWorkoutDate, currentWorkoutId) {
    if (!exerciseName || !weight || !reps) return 1;
    
    let count = 1;
    // Sort all workouts by date newest first, then by ID (which is time-based)
    const sortedWorkouts = [...appData.workouts].sort((a, b) => {
        if (b.date !== a.date) return new Date(b.date) - new Date(a.date);
        return b.id.localeCompare(a.id);
    });

    // We want workouts that are older or same-day but not the current one
    const olderWorkouts = sortedWorkouts.filter(w => {
        if (w.id === currentWorkoutId) return false;
        if (w.date < currentWorkoutDate) return true;
        if (w.date === currentWorkoutDate) {
            // Same day: use ID comparison (id is generated with Date.now().toString(36))
            // But wait, the ID might not be perfectly chronological if generated very close.
            // Still, for same-day, we just need a consistent "previous".
            return w.id < currentWorkoutId; 
        }
        return false;
    });

    for (const wk of olderWorkouts) {
        const matchingEx = wk.exercises.find(ex => ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase());
        if (matchingEx) {
            // Compare as numbers to handle "100" vs "100.0"
            const w1 = parseFloat(matchingEx.weight);
            const w2 = parseFloat(weight);
            const r1 = parseInt(matchingEx.reps);
            const r2 = parseInt(reps);
            
            if (!isNaN(w1) && !isNaN(w2) && w1 === w2 && !isNaN(r1) && !isNaN(r2) && r1 === r2) {
                count++;
            } else {
                break;
            }
        } else {
            continue; 
        }
    }
    return count;
}

// ── iOS confetti helpers ──────────────────────────────────────────────────
function spawnConfetti() {
    const container = document.getElementById('ios-confetti-container');
    if (!container) return;
    container.innerHTML = '';

    const symbols = ['\u2665', '\u2726', '\u2605', '\u2728', '\u2661', '\u2733'];
    const colors  = ['#ff69b4','#e83e8c','#FFD700','#FFA500','#ff1493','#fffbe0','#ff85c2'];

    for (let i = 0; i < 38; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-particle';
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        const size   = (0.85 + Math.random() * 1.45).toFixed(2);
        const delay  = (Math.random() * 2.2).toFixed(2);
        const dur    = (2.2 + Math.random() * 3.0).toFixed(2);
        el.style.cssText = [
            `left:${(Math.random() * 102).toFixed(1)}%`,
            `top:${(-8 - Math.random() * 18).toFixed(1)}%`,
            `color:${colors[Math.floor(Math.random() * colors.length)]}`,
            `font-size:${size}rem`,
            `animation-delay:${delay}s`,
            `animation-duration:${dur}s`
        ].join(';');
        container.appendChild(el);
    }
}

function clearConfetti() {
    const c = document.getElementById('ios-confetti-container');
    if (c) c.innerHTML = '';
}




































// --- Drag and Drop ---
function initSortable(containerId, isEditMode) {
    const el = document.getElementById(containerId);
    if (!el || !window.Sortable) return;

    // Destroy existing instance if any
    const existing = Sortable.get(el);
    if (existing) existing.destroy();

    Sortable.create(el, {
        animation: 200,
        delay: 500,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        fallbackTolerance: 3,
        onStart: () => {
            if (navigator.vibrate) navigator.vibrate(50);
        },
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            if (oldIndex === newIndex) return;

            let wk;
            if (isEditMode) {
                wk = currentWorkoutData;
            } else {
                wk = appData.workouts.find(w => w.id === viewingWorkoutId);
            }

            if (!wk) return;

            // Move in array
            const movedItem = wk.exercises.splice(oldIndex, 1)[0];
            wk.exercises.splice(newIndex, 0, movedItem);

            // Save to DB
            await db.saveWorkout(wk);

            // Re-render to update indexes and data-attributes
            if (isEditMode) {
                renderEditExercises();
            } else {
                renderViewExercises(wk);
            }
            
            renderHome();
        }
    });
}

function updateProgress(wk) {
    const total = wk.exercises.length;
    const done = wk.exercises.filter(e => e.done).length;
    
    progressText.textContent = `${done} / ${total}`;
    
    if (total === 0) {
        progressFill.style.width = '0%';
    } else {
        const percent = (done / total) * 100;
        progressFill.style.width = `${percent}%`;
    }
}

async function deleteWorkout() {
    if (!viewingWorkoutId) return;
    
    await db.deleteWorkout(viewingWorkoutId);
    appData.workouts = appData.workouts.filter(w => w.id !== viewingWorkoutId);
    
    // Auto-sync to cloud if enabled
    if (appData.username) {
        syncToCloud(true);
    }
    
    renderHome();
    closeModal(modalConfirm);
    showToast('Тренировка удалена');
    navigateTo('home');
}

// --- Favorites Modal ---
function renderFavoritesModal() {
    const list = document.getElementById('favorites-list');
    list.innerHTML = '';
    
    appData.favorites.forEach((fav, index) => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <span>${fav}</span>
            <button class="icon-btn btn-remove-fav" data-index="${index}" style="width:32px;height:32px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;
        list.appendChild(item);
    });
    
    document.querySelectorAll('.btn-remove-fav').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            appData.favorites.splice(idx, 1);
            await saveData();
            renderFavoritesModal();
        });
    });
}

async function addFavorite() {
    const input = document.getElementById('new-favorite-input');
    const val = input.value.trim();
    if (val && !appData.favorites.includes(val)) {
        appData.favorites.unshift(val); // Add to top
        await saveData();
        input.value = '';
        renderFavoritesModal();
    }
}

// --- Settings (theme only — no user name) ---
async function loadSettings() {
    // Nothing to load by name; theme is loaded separately via loadTheme()
}

async function saveSettings() {
    await toggleTheme();
    closeModal(modalSettings);
    showToast('Тема изменена');
}

// --- Modals Utils ---
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

// --- Supabase Cloud Sync ---
const SUPABASE_URL = 'https://ccekjgkopqkshxhdjezd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e1w5LQ8Jnjj2NGSuPrXZzA_ietBW25E';

async function syncToCloud(silent = false) {
    if (!appData.username && silent) return;
    
    const btn = document.getElementById('btn-login');
    
    try {
        const data = await db.exportAllData();
        const username = appData.username;
        if (!username) return;
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gym_sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                sync_code: username,
                data: data
            })
        });

        if (!response.ok) throw new Error('Cloud save failed');

        if (!silent) showToast('Данные в облаке!');
    } catch (e) {
        console.error(e);
        if (!silent) showToast('Ошибка сохранения в облако');
    }
}

async function loginAccount() {
    const input = document.getElementById('input-username');
    const btn = document.getElementById('btn-login');
    const name = input.value.trim();
    
    if (!name) {
        showToast('Введите имя (Катюша или Валик)');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = 'Вход...';
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gym_sync?sync_code=eq.${name}&select=data`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const result = await response.json();
        
        // If account exists, ask to import
        if (result && result.length > 0) {
            if (confirm(`Найдена резервная копия для "${name}". Загрузить её и заменить текущие данные?`)) {
                await db.importAllData(result[0].data);
                appData.username = name;
                await db.saveSetting('username', name);
                showToast('Данные загружены! Перезагрузка...');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }
        }
        
        // If not found or user cancelled import, just link the account
        appData.username = name;
        await db.saveSetting('username', name);
        await syncToCloud(); // Save current local data to cloud for this user
        
        updateSettingsUI();
        showToast(`Вы вошли как ${name}`);
    } catch (e) {
        console.error(e);
        showToast('Ошибка при входе');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Войти';
    }
}

async function logoutAccount() {
    if (confirm('Выйти из аккаунта? Авто-сохранение в облако прекратится.')) {
        appData.username = null;
        await db.saveSetting('username', null);
        updateSettingsUI();
        showToast('Вы вышли из аккаунта');
    }
}

function updateSettingsUI() {
    const statusBox = document.getElementById('account-status');
    const loginForm = document.getElementById('login-form');
    const nameEl = document.getElementById('active-username');
    
    if (appData.username) {
        statusBox.classList.remove('hidden');
        loginForm.classList.add('hidden');
        nameEl.textContent = appData.username;
    } else {
        statusBox.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
}


// ── Сохранение завершённой тренировки в профиль Supabase ──────────────
async function syncCompletedWorkoutToProfile(workout) {
    if (!appData.username) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gym_profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                username: appData.username,
                workout_id: workout.id,
                workout_data: workout,
                completed_at: new Date().toISOString()
            })
        });

        if (!response.ok) throw new Error('Profile save failed');
    } catch (e) {
        console.error('Ошибка сохранения в профиль:', e);
    }
}

// ── Экспорт / Импорт данных ─────────────────────────────────────────────
async function exportData() {
    try {
        const data = await db.exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = getTodayDateStr();
        a.download = `gymtracker_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ Данные экспортированы');
    } catch (e) {
        console.error('Ошибка экспорта:', e);
        showToast('❌ Ошибка экспорта');
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.workouts || !data.settings) {
            showToast('❌ Неверный формат файла');
            return;
        }
        
        // Показываем подтверждение
        if (!confirm(`Загрузить ${data.workouts.length} тренировок? Текущие данные будут заменены.`)) {
            return;
        }
        
        await db.importAllData(data);
        
        // Перезагружаем данные
        await loadData();
        renderHome();
        showToast(`✅ Загружено ${data.workouts.length} тренировок`);
        
        // Сброс input, чтобы можно было выбрать тот же файл повторно
        event.target.value = '';
    } catch (e) {
        console.error('Ошибка импорта:', e);
        showToast('❌ Ошибка импорта');
        event.target.value = '';
    }
}

// --- Events Setup ---
function setupEventListeners() {
    // Buttons
    document.getElementById('btn-new-workout').addEventListener('click', openNewWorkout);
    document.getElementById('btn-back-home').addEventListener('click', () => navigateTo('home'));
    document.getElementById('btn-back-view').addEventListener('click', () => navigateTo('home'));
    
    document.getElementById('btn-add-exercise').addEventListener('click', addNewExercise);
    document.getElementById('btn-save-workout').addEventListener('click', saveWorkout);
    
    document.getElementById('btn-edit-workout').addEventListener('click', () => {
        if (viewingWorkoutId) openEditWorkout(viewingWorkoutId);
    });
    
    document.getElementById('btn-delete-workout').addEventListener('click', () => {
        openModal(modalConfirm);
    });
    
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => closeModal(modalConfirm));
    document.getElementById('btn-confirm-delete').addEventListener('click', deleteWorkout);
    
    // Favorites
    document.getElementById('btn-favorites-manage').addEventListener('click', () => {
        renderFavoritesModal();
        openModal(modalFavorites);
    });
    document.getElementById('btn-close-favorites').addEventListener('click', () => closeModal(modalFavorites));
    document.getElementById('btn-add-favorite').addEventListener('click', addFavorite);
    
    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => {
        updateSettingsUI();
        openModal(modalSettings);
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => closeModal(modalSettings));
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

    document.getElementById('btn-close-summary').addEventListener('click', () => {
        document.getElementById('day-summary').classList.add('hidden');
    });

    // Calendar Modal
    const modalCalendar = document.getElementById('modal-calendar');
    document.getElementById('btn-history').addEventListener('click', () => {
        currentCalendarDate = new Date(); // Reset to today when opening
        renderCalendar();
        openModal(modalCalendar);
    });
    document.getElementById('btn-close-calendar').addEventListener('click', () => closeModal(modalCalendar));

    document.getElementById('btn-prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('btn-next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // Giant Clock
    document.getElementById('live-clock').addEventListener('click', toggleGiantClock);
    document.getElementById('giant-clock-overlay').addEventListener('click', toggleGiantClock);

    document.getElementById('new-favorite-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFavorite();
    });

        // Sync Buttons
    document.getElementById('btn-login').addEventListener('click', loginAccount);
    document.getElementById('btn-logout').addEventListener('click', logoutAccount);
    
    // Export / Import
    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);
    
    // Close modals on outside click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });
    
    // Swipe gestures on modal sheets (simple implementation)
    let touchStartY = 0;
    const modalSheet = document.querySelector('.modal-sheet');
    if (modalSheet) {
        modalSheet.addEventListener('touchstart', e => {
            touchStartY = e.changedTouches[0].screenY;
        });
        modalSheet.addEventListener('touchend', e => {
            const touchEndY = e.changedTouches[0].screenY;
            if (touchEndY - touchStartY > 100) {
                // Determine which modal is active and close it
                document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => closeModal(modal));
            }
        });
    }
}

>>>>>>> 85a8334 (fix: remove duplicate SW registration block causing SyntaxError)
