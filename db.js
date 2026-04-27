const DB_NAME = 'GymTrackerDB';
const DB_VERSION = 1;

/**
 * Инициализация базы данных GymTrackerDB
 */
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Хранилище для тренировок
        if (!db.objectStoreNames.contains('workouts')) {
            db.createObjectStore('workouts', { keyPath: 'id' });
        }
        
        // Хранилище для настроек (имя пользователя, избранное)
        if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
        }
    };

    request.onsuccess = (event) => {
        resolve(event.target.result);
    };

    request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
    };
});

/**
 * Модуль для работы с базой данных
 */
export const db = {
    /**
     * Получить все тренировки
     */
    async getAllWorkouts() {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction('workouts', 'readonly');
            const store = transaction.objectStore('workouts');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Сохранить тренировку (создать или обновить)
     */
    async saveWorkout(workout) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction('workouts', 'readwrite');
            const store = transaction.objectStore('workouts');
            const request = store.put(workout);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Удалить тренировку по ID
     */
    async deleteWorkout(id) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction('workouts', 'readwrite');
            const store = transaction.objectStore('workouts');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Получить настройку по ключу
     */
    async getSetting(key) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction('settings', 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Сохранить настройку
     */
    async saveSetting(key, value) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction('settings', 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Миграция данных из localStorage в IndexedDB
     */
    async migrateFromLocalStorage() {
        const legacyData = localStorage.getItem('gymtracker_data');
        const legacyUser = localStorage.getItem('gymUserName');

        if (!legacyData && !legacyUser) return;

        console.log('Detected legacy data. Starting migration...');

        try {
            if (legacyData) {
                const data = JSON.parse(legacyData);
                
                // Переносим тренировки
                if (data.workouts && Array.isArray(data.workouts)) {
                    for (const workout of data.workouts) {
                        await this.saveWorkout(workout);
                    }
                }
                
                // Переносим избранное
                if (data.favorites) {
                    await this.saveSetting('favorites', data.favorites);
                }
            }

            // Переносим имя пользователя
            if (legacyUser) {
                await this.saveSetting('userName', legacyUser);
            }

            // Очищаем старое хранилище
            localStorage.removeItem('gymtracker_data');
            localStorage.removeItem('gymUserName');
            
            console.log('Migration to IndexedDB completed successfully.');
        } catch (error) {
            console.error('Error during migration:', error);
        }
    }
};

// Запуск миграции при загрузке модуля
db.migrateFromLocalStorage();
