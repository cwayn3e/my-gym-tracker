# GymTracker — AGENTS.md

## Описание проекта
PWA-приложение для отслеживания тренировок в зале. Работает на IndexedDB, синхронизируется с Supabase. Поддерживает два профиля: Катюша и Валик.

## Стек
- Чистый JavaScript (vanilla), IndexedDB (`db.js`)
- Supabase REST API для облачной синхронизации
- Service Worker для PWA (офлайн + кеширование)
- Две темы: Cyber (тёмная) и Minimal (светлая)

## Структура файлов
- `script.js` — основная логика приложения (ES module, `type="module"`)
- `db.js` — обёртка над IndexedDB (workouts + settings)
- `service-worker.js` — PWA Service Worker (лёгкий, без дублирования логики)
- `storage.js` + `server.js` — серверная часть (Express, не используется на GitHub Pages)
- `index.html` + `public/index.html` — точки входа (основная в корне)
- `public/` — дубликаты файлов для серверной раздачи

## Важные изменения в этом чате

### 1. Поздравления
- Только для `username === 'Катюша'` + iPhone — confetti + iOS overlay
- Для `username === 'Валик'` — только обычный toast
- Функция `showiOSCongratulation()` в `script.js`
- Проверки `isKatusha`, `isValik`, `isIPhone` в `toggleExerciseStatus()`

### 2. Сохранение в Supabase профиль
- Новая функция `syncCompletedWorkoutToProfile(workout)` в `script.js`
- Пишет в таблицу `gym_profiles`: username, workout_id, workout_data, completed_at
- Вызывается при завершении тренировки (после `db.saveWorkout`)

### 3. PWA / Service Worker
- `updateViaCache: 'none'` при регистрации
- `skipWaiting()` на install, `clients.claim()` на activate
- `registration.update()` при каждом запуске
- `controllerchange` с однократной перезагрузкой
- Кеширование: только статика (html, css, js, иконки), динамические запросы (Supabase, SortableCDN) не кешируются

### 4. Известные проблемы
- Два набора файлов: корень (`script.js`) и `public/script.js` — нужно поддерживать синхронизацию
- `public/script.js` — старая копия (1363 строки, без правок чата)

### 5. Прочее
- Supabase URL: `https://ccekjgkopqkshxhdjezd.supabase.co`
- Таблицы: `gym_sync` (общая синхронизация), `gym_profiles` (завершённые тренировки)
- `db.migrateFromLocalStorage()` запускается при загрузке `db.js`
- Версия SW: CACHE_NAME = `gymtracker-v2`

## Запуск
- `npm start` — запуск Express сервера (порт 3000)
- GitHub Pages: `https://cwayn3e.github.io/my-gym-tracker/`
