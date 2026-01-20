// Глобальные переменные
let currentUser = null;
let userSettings = null;
let carData = {
    "focus": {
        "model": "Ford Focus 3",
        "year": 2012,
        "color": "Серебристый",
        "totalSpent": 0,
        "totalRepairs": 0,
        "lastRepair": "",
        "repairs": []
    },
    "peugeot": {
        "model": "Peugeot 207",
        "year": 2008,
        "color": "Синий",
        "totalSpent": 0,
        "totalRepairs": 0,
        "lastRepair": "",
        "repairs": []
    }
};

const samplePeugeotData = {
    "peugeot": {
        "repairs": [
            {
                "id": 1,
                "date": "01.08.2024",
                "mileage": 125000,
                "short_work": "Замена КПП",
                "total_price": 33000,
                "sto": "Альфатранс",
                "work_items": [
                    {
                        "name": "Замена КПП (БУ)",
                        "price": 30000
                    },
                    {
                        "name": "Замена масла КПП",
                        "price": 3000
                    }
                ],
                "part_items": [],
                "notes": "Замена коробки передач"
            }
        ]
    }
};

let currentCar = 'focus';
let searchTerm = '';
let searchTimeout = null;
let searchDebounceDelay = 300;
let currentSort = 'date';
let currentOrder = 'desc';
let expandedRepairId = null;
let editingRepairId = null;
let isGuestMode = true;
let isEditingAction = false;
let guestDataLoaded = false;

// Логирование тем
console.log('=== ТЕМЫ ===');
console.log('Тема из localStorage при запуске:', localStorage.getItem('myCarsTheme'));
console.log('Класс body при запуске:', document.body.className);

// ==================== АУТЕНТИФИКАЦИЯ ====================

function showAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'block';
    document.getElementById('authStatus').textContent = '';
    document.getElementById('loginEmail').value = 'Mokshin10@gmail.com';
    document.getElementById('loginPassword').value = 'Vjriby';
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
    isEditingAction = false;
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showStatus('Пожалуйста, заполните все поля', 'error');
        return;
    }
    
    // Для тестового аккаунта
    if (email === 'Mokshin10@gmail.com' && password === 'Vjriby') {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            currentUser = userCredential.user;
            isGuestMode = false;
            
            // Загружаем данные пользователя
            await loadUserData();
            
            // Обновляем интерфейс
            updateUIForAuthState();
            hideAuthModal();
            
            // Если была попытка редактирования, выполняем действие
            if (isEditingAction && editingRepairId) {
                openEditForm(editingRepairId);
                isEditingAction = false;
                editingRepairId = null;
            } else {
                updateCarInfo();
                updateRepairsTable();
                updateCarStatsDisplay();
            }
            
            showStatus('Успешный вход!', 'success');
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            showStatus(getErrorMessage(error), 'error');
        }
    } else {
        showStatus('Неверный email или пароль', 'error');
    }
}

async function createInitialUserData() {
    try {
        await db.collection('userCars').doc(currentUser.uid).set({
            email: currentUser.email,
            carData: carData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await db.collection('userSettings').doc(currentUser.uid).set({
            theme: 'arch',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return true;
    } catch (error) {
        console.error('Ошибка создания начальных данных:', error);
        return false;
    }
}

function logoutUser() {
    // Если были в гостевом режиме (авторизованы как гость), не выходим из Firebase
    // чтобы сохранить возможность загружать данные
    if (!isGuestMode) {
        auth.signOut();
        currentUser = null;
        userSettings = null;
    }
    
    isGuestMode = true;
    updateUIForAuthState();
    
    // Обновляем данные из гостевого аккаунта
    loadGuestData().then(() => {
        updateCarInfo();
        updateRepairsTable();
        updateCarStatsDisplay();
        showStatus('Переход в гостевой режим. Данные загружены.', 'info');
    });
}

function checkAuthBeforeEdit(actionCallback, repairId = null) {
    if (isGuestMode) {
        isEditingAction = true;
        editingRepairId = repairId;
        showAuthModal();
    } else {
        actionCallback(repairId);
    }
}

function updateUIForAuthState() {
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginBtnMain');
    const modeIndicator = document.getElementById('modeIndicator');
    const modeText = document.getElementById('modeText');
    const userInfo = document.getElementById('userInfo');
    
    if (isGuestMode) {
        logoutBtn.style.display = 'none';
        loginBtn.style.display = 'flex';
        modeIndicator.classList.remove('mode-authorized');
        modeIndicator.classList.add('mode-guest');
        modeText.textContent = 'Гостевой режим (только просмотр)';
        userInfo.textContent = 'Загружены реальные данные';
    } else {
        logoutBtn.style.display = 'flex';
        loginBtn.style.display = 'none';
        modeIndicator.classList.remove('mode-guest');
        modeIndicator.classList.add('mode-authorized');
        modeText.textContent = 'Режим редактирования';
        userInfo.textContent = `Пользователь: ${currentUser?.email || 'Авторизован'}`;
    }
}

function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Неверный формат email';
        case 'auth/user-disabled':
            return 'Пользователь заблокирован';
        case 'auth/user-not-found':
            return 'Пользователь не найден';
        case 'auth/wrong-password':
            return 'Неверный пароль';
        case 'auth/email-already-in-use':
            return 'Email уже используется';
        case 'auth/weak-password':
            return 'Пароль слишком простой';
        case 'auth/network-request-failed':
            return 'Ошибка сети. Проверьте подключение';
        default:
            return error.message || 'Произошла ошибка';
    }
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================

async function loadInitialGuestData() {
    try {
        // Сначала пробуем загрузить данные из публичной коллекции
        const publicDataRef = db.collection('publicData').doc('guestAccess');
        const publicDataDoc = await publicDataRef.get();
        
        if (publicDataDoc.exists) {
            const data = publicDataDoc.data();
            if (data.carData) {
                carData = mergeCarData(carData, data.carData);
                guestDataLoaded = true;
                return true;
            }
        }
        
        // Если нет публичных данных, используем локальные данные
        const localData = localStorage.getItem('myCarsGuestData');
        if (localData) {
            try {
                const parsedData = JSON.parse(localData);
                carData = mergeCarData(carData, parsedData);
                guestDataLoaded = true;
                return true;
            } catch (e) {
                console.error('Ошибка парсинга локальных данных:', e);
            }
        }
        
        // Если совсем нет данных, используем встроенные примеры
        if (!guestDataLoaded) {
            // Добавляем пример данных для Пежо
            if (samplePeugeotData.peugeot && samplePeugeotData.peugeot.repairs) {
                samplePeugeotData.peugeot.repairs.forEach(repair => {
                    repair.id = Date.now() + Math.floor(Math.random() * 1000);
                    if (!carData.peugeot.repairs.some(r => r.short_work === repair.short_work)) {
                        carData.peugeot.repairs.push(repair);
                    }
                });
                guestDataLoaded = true;
            }
        }
        
        return guestDataLoaded;
    } catch (error) {
        console.error('Ошибка загрузки гостевых данных:', error);
        return false;
    }
}

async function loadGuestData() {
    try {
        if (guestDataLoaded) return true;
        
        console.log('Загрузка гостевых данных напрямую из аккаунта...');
        
        // Креденшалы для гостевого доступа (только чтение)
        const guestEmail = 'Mokshin10@gmail.com';
        const guestPassword = 'Vjriby';
        
        try {
            // Входим в аккаунт для загрузки данных
            await auth.signInWithEmailAndPassword(guestEmail, guestPassword);
            const tempUser = auth.currentUser;
            
            if (tempUser) {
                console.log('Гостевая авторизация успешна, загружаем данные...');
                
                // Загружаем данные пользователя
                const userCarsRef = db.collection('userCars').doc(tempUser.uid);
                const userCarsDoc = await userCarsRef.get();
                
                if (userCarsDoc.exists) {
                    const data = userCarsDoc.data();
                    if (data.carData) {
                        console.log('Данные успешно загружены из аккаунта');
                        
                        // ПОЛНОСТЬЮ заменяем текущие данные на данные из аккаунта
                        // Это важно - чтобы не было остатков от демо-данных
                        carData = JSON.parse(JSON.stringify(data.carData));
                        
                        // Убеждаемся, что все поля есть
                        ['focus', 'peugeot'].forEach(carKey => {
                            if (carData[carKey]) {
                                // Убеждаемся, что есть все обязательные поля
                                if (!carData[carKey].repairs) carData[carKey].repars = [];
                                if (!carData[carKey].model) carData[carKey].model = carKey === 'focus' ? 'Ford Focus 3' : 'Peugeot 207';
                                if (!carData[carKey].year) carData[carKey].year = carKey === 'focus' ? 2012 : 2008;
                                if (!carData[carKey].color) carData[carKey].color = carKey === 'focus' ? 'Серебристый' : 'Синий';
                                if (!carData[carKey].totalSpent) carData[carKey].totalSpent = 0;
                                if (!carData[carKey].totalRepairs) carData[carKey].totalRepairs = 0;
                                if (!carData[carKey].lastRepair) carData[carKey].lastRepair = '';
                            }
                        });
                        
                        // Обновляем текущий автомобиль если нужно
                        if (!carData[currentCar]) {
                            currentCar = Object.keys(carData)[0] || 'focus';
                        }
                        
                        guestDataLoaded = true;
                        console.log('carData после загрузки:', {
                            focus: { repairs: carData.focus?.repairs?.length || 0 },
                            peugeot: { repairs: carData.peugeot?.repairs?.length || 0 }
                        });
                    } else {
                        console.error('carData не найдено в документе пользователя');
                    }
                } else {
                    console.error('Документ пользователя не найден');
                }
                
                // НЕ ВЫХОДИМ из аккаунта сразу - оставляем авторизованным
                // для возможности обновления данных в реальном времени
                console.log('Остаемся в гостевой авторизации для обновления данных');
                
            } else {
                console.error('Не удалось войти в гостевой аккаунт');
            }
            
        } catch (authError) {
            console.error('Ошибка гостевой авторизации:', authError);
            // При ошибке аутентификации используем базовую структуру
            resetToBasicStructure();
        }
        
        // Если все еще не загружено, сбрасываем
        if (!guestDataLoaded) {
            resetToBasicStructure();
        }
        
        guestDataLoaded = true;
        return true;
        
    } catch (error) {
        console.error('Критическая ошибка загрузки гостевых данных:', error);
        resetToBasicStructure();
        guestDataLoaded = true;
        return false;
    }
}

function resetToBasicStructure() {
    console.log('Сброс к базовой структуре данных');
    carData = {
        "focus": {
            "model": "Ford Focus 3",
            "year": 2012,
            "color": "Серебристый",
            "totalSpent": 0,
            "totalRepairs": 0,
            "lastRepair": "",
            "repairs": []
        },
        "peugeot": {
            "model": "Peugeot 207",
            "year": 2008,
            "color": "Синий",
            "totalSpent": 0,
            "totalRepairs": 0,
            "lastRepair": "",
            "repairs": []
        }
    };
}

async function loadUserData() {
    try {
        if (!currentUser) return false;
        
        // Загружаем настройки пользователя
        const settingsRef = db.collection('userSettings').doc(currentUser.uid);
        const settingsDoc = await settingsRef.get();
        
        if (settingsDoc.exists) {
            userSettings = settingsDoc.data();
            
            // Проверяем приоритет тем:
            // 1. Сначала пробуем загрузить тему из localStorage (текущая сессия)
            const localStorageTheme = localStorage.getItem('myCarsTheme');
            
            if (localStorageTheme && localStorageTheme !== userSettings.theme) {
                // Если в localStorage другая тема, чем в настройках пользователя
                // Обновляем настройки пользователя под текущую тему
                userSettings.theme = localStorageTheme;
                await saveUserSettings();
                switchTheme(localStorageTheme, false);
            } else if (userSettings.theme) {
                // Иначе используем тему из настроек пользователя
                switchTheme(userSettings.theme, false);
            }
        } else {
            // Если настроек нет, создаем их с темой из localStorage
            const savedTheme = localStorage.getItem('myCarsTheme') || 'arch';
            userSettings = { theme: savedTheme };
            await saveUserSettings();
            switchTheme(savedTheme, false);
        }
        
        // Загружаем данные пользователя
        const userCarsRef = db.collection('userCars').doc(currentUser.uid);
        const userCarsDoc = await userCarsRef.get();
        
        if (userCarsDoc.exists) {
            const data = userCarsDoc.data();
            if (data.carData) {
                carData = mergeCarData(carData, data.carData);
            }
            
            // Обновляем UI
            updateCarInfo();
            updateRepairsTable();
            updateCarStatsDisplay();
            
            return true;
        } else {
            // Создаем начальные данные для нового пользователя
            await createInitialUserData();
            return true;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        // При ошибке используем тему из localStorage
        const savedTheme = localStorage.getItem('myCarsTheme') || 'arch';
        switchTheme(savedTheme, false);
        
        showStatus('Ошибка загрузки данных', 'error');
        return false;
    }
}

function mergeCarData(primaryData, secondaryData) {
    const merged = { ...primaryData };
    
    Object.keys(secondaryData).forEach(carKey => {
        if (!merged[carKey]) {
            merged[carKey] = secondaryData[carKey];
        } else {
            // Обновляем основные данные автомобиля
            Object.keys(secondaryData[carKey]).forEach(key => {
                if (key !== 'repairs') {
                    merged[carKey][key] = secondaryData[carKey][key];
                }
            });
            
            // Объединяем ремонты
            if (secondaryData[carKey].repairs && Array.isArray(secondaryData[carKey].repairs)) {
                secondaryData[carKey].repairs.forEach(newRepair => {
                    const exists = merged[carKey].repairs.some(r => r.id === newRepair.id);
                    if (!exists) {
                        merged[carKey].repairs.push(newRepair);
                    }
                });
            }
        }
    });
    
    return merged;
}

async function saveCarData() {
    try {
        if (isGuestMode) {
            console.log('Гостевой режим: данные не сохраняются');
            return false;
        }
        
        if (!currentUser) {
            console.error('Пользователь не авторизован');
            return false;
        }
        
        console.log('Сохранение данных в Firebase...');
        
        // Сохраняем только в Firebase
        await db.collection('userCars').doc(currentUser.uid).set({
            email: currentUser.email,
            carData: carData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('Данные успешно сохранены в Firebase');
        return true;
        
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        showStatus('Ошибка сохранения в Firebase', 'error');
        return false;
    }
}

// ==================== УПРАВЛЕНИЕ ТЕМОЙ ====================

function switchTheme(theme, saveToServer = true) {
    // Проверяем допустимость темы
    const validThemes = ['arch', 'rosepine'];
    if (!validThemes.includes(theme)) {
        console.warn(`Неизвестная тема: ${theme}, устанавливаю arch`);
        theme = 'arch';
    }
    
    // Удаляем текущие классы тем
    document.body.classList.remove('theme-arch', 'theme-rosepine');
    
    // Добавляем новый класс темы
    document.body.classList.add(`theme-${theme}`);
    
    // Обновляем активную кнопку темы
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const themeBtn = document.querySelector(`.theme-btn[data-theme="${theme}"]`);
    if (themeBtn) {
        themeBtn.classList.add('active');
    } else {
        // Если кнопка не найдена, активируем Arch
        const archBtn = document.querySelector('.theme-btn[data-theme="arch"]');
        if (archBtn) archBtn.classList.add('active');
    }
    
    // Обновляем текст футера
    const themeName = theme === 'arch' ? 'Arch Linux' : 'Rosé Pine';
    const themeNameEl = document.getElementById('themeName');
    if (themeNameEl) {
        themeNameEl.textContent = themeName;
    }
    
    // Всегда сохраняем в localStorage (для гостевого и авторизованного режима)
    localStorage.setItem('myCarsTheme', theme);
    console.log('Тема сохранена в localStorage:', theme);
    
    // Сохраняем в настройках пользователя если авторизован
    if (!isGuestMode && userSettings && saveToServer) {
        userSettings.theme = theme;
        saveUserSettings();
        console.log('Тема сохранена в настройках пользователя');
    }
}

function loadSavedTheme() {
    try {
        const savedTheme = localStorage.getItem('myCarsTheme');
        
        // Допустимые темы
        const validThemes = ['arch', 'rosepine'];
        
        // Определяем тему для загрузки
        let themeToLoad = 'arch'; // По умолчанию Arch
        
        if (savedTheme && validThemes.includes(savedTheme)) {
            themeToLoad = savedTheme;
        } else {
            // Если тема не сохранена или некорректна, сохраняем Arch
            themeToLoad = 'arch';
            localStorage.setItem('myCarsTheme', 'arch');
        }
        
        console.log('Загружаем тему из localStorage:', themeToLoad);
        switchTheme(themeToLoad, false);
        
    } catch (error) {
        console.error('Ошибка загрузки темы:', error);
        // Устанавливаем тему Arch по умолчанию
        document.body.classList.add('theme-arch');
        localStorage.setItem('myCarsTheme', 'arch');
    }
}

async function saveUserSettings() {
    try {
        if (!currentUser || !userSettings) return;
        
        await db.collection('userSettings').doc(currentUser.uid).set({
            ...userSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
    }
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

document.addEventListener('DOMContentLoaded', function() {
    // Загружаем сохраненную тему ПЕРВЫМ делом
    loadSavedTheme();
    
    // Инициализируем приложение
    initApp();
    
    // Отслеживаем состояние аутентификации
    auth.onAuthStateChanged(async user => {
    if (user) {
        // Если это ваш основной аккаунт (по email)
        if (user.email === 'Mokshin10@gmail.com') {
            currentUser = user;
            isGuestMode = false;
            
            console.log('Основной пользователь вошел:', user.email);
            
            // Загружаем данные пользователя
            await loadUserData();
            
            // Обновляем интерфейс
            updateUIForAuthState();
            updateCarInfo();
            updateRepairsTable();
            updateCarStatsDisplay();
            
        } else {
            // Если это гостевая авторизация
            console.log('Гостевая авторизация активна');
            isGuestMode = true;
            currentUser = null;
            
            // Загружаем гостевые данные
            if (!guestDataLoaded) {
                await loadGuestData();
                updateCarInfo();
                updateRepairsTable();
                updateCarStatsDisplay();
            }
            
            updateUIForAuthState();
        }
        
    } else {
        // Если никто не авторизован - автоматически входим в гостевой режим
        console.log('Нет авторизации, пытаемся войти как гость...');
        isGuestMode = true;
        currentUser = null;
        
        try {
            // Пробуем войти как гость
            await auth.signInWithEmailAndPassword('Mokshin10@gmail.com', 'Vjriby');
            // После успешного входа сработает onAuthStateChanged снова
        } catch (error) {
            console.error('Не удалось войти в гостевой режим:', error);
            // При ошибке просто показываем интерфейс
            updateUIForAuthState();
        }
    }
});
});

async function initApp() {
    // Загружаем сохраненную тему ПЕРВЫМ делом
    loadSavedTheme();
    
    // Настраиваем обработчики событий
    setupEventListeners();
    
    // Восстанавливаем состояние свернутого блока
    const carStatsCollapsed = localStorage.getItem('carStatsCollapsed') === 'true';
    if (carStatsCollapsed) {
        document.getElementById('carStats').classList.add('collapsed');
        const toggleHeader = document.querySelector('.car-info-header');
        if (toggleHeader) {
            const icon = toggleHeader.querySelector('.fa-chevron-down');
            if (icon) {
                icon.style.transform = 'rotate(-90deg)';
            }
        }
    }
    
    // Инициализируем UI
    updateUIForAuthState();
    
    // Устанавливаем индикатор сортировки
    setSortIndicator('date', 'desc');
    
    // Данные загружаются автоматически через auth.onAuthStateChanged
    console.log('Приложение инициализировано, ожидание загрузки данных...');
}

function setupEventListeners() {
    // Переключение темы
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            console.log('Пользователь выбрал тему:', theme);
            
            // Сохраняем тему в localStorage сразу
            localStorage.setItem('myCarsTheme', theme);
            
            // Применяем тему
            switchTheme(theme);
            
            // Показываем статус
            const themeName = theme === 'arch' ? 'Arch Linux' : 'Rosé Pine';
            showStatus(`Тема изменена на ${themeName}`, 'success');
        });
    });
    
    // Кнопки входа/выхода
    document.getElementById('loginBtnMain')?.addEventListener('click', showAuthModal);
    document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
    
    // Кнопки модального окна
    document.getElementById('loginBtn')?.addEventListener('click', loginUser);
    document.getElementById('cancelAuthBtn')?.addEventListener('click', hideAuthModal);
    
    // Выбор автомобиля
    document.querySelectorAll('.car-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.car-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            currentCar = this.getAttribute('data-car');
            expandedRepairId = null;
            updateCarInfo();
            updateRepairsTable();
            updateCarStatsDisplay();
        });
    });
    
    // Сворачивание блока статистики
    const carInfoToggle = document.getElementById('carInfoToggle');
    if (carInfoToggle) {
        carInfoToggle.addEventListener('click', function() {
            const carStats = document.getElementById('carStats');
            const isCollapsed = carStats.classList.contains('collapsed');
            const icon = this.querySelector('.fa-chevron-down');
            
            if (isCollapsed) {
                carStats.classList.remove('collapsed');
                if (icon) icon.style.transform = 'rotate(0deg)';
                localStorage.setItem('carStatsCollapsed', 'false');
            } else {
                carStats.classList.add('collapsed');
                if (icon) icon.style.transform = 'rotate(-90deg)';
                localStorage.setItem('carStatsCollapsed', 'true');
            }
        });
    }
    
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            performSearch(this.value);
        });
    }
    
    // Очистка поиска
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            searchTerm = '';
            updateRepairsTable();
        });
    }
    
    // Сортировка таблицы
    document.querySelectorAll('.repairs-table th[data-sort]').forEach(th => {
        th.addEventListener('click', function() {
            const sortField = this.getAttribute('data-sort');
            sortTable(sortField);
        });
    });
    
    // Кнопки управления ремонтами
    document.getElementById('addRepairBtn')?.addEventListener('click', function() {
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        document.getElementById('addRepairForm').classList.add('active');
        document.getElementById('editRepairForm').classList.remove('active');
        document.getElementById('dataSection').style.display = 'none';
    });
    
    document.getElementById('saveRepairBtn')?.addEventListener('click', saveRepair);
    document.getElementById('cancelRepairBtn')?.addEventListener('click', closeAllForms);
    document.getElementById('updateRepairBtn')?.addEventListener('click', updateRepair);
    document.getElementById('cancelEditBtn')?.addEventListener('click', closeAllForms);
    document.getElementById('deleteRepairBtn')?.addEventListener('click', deleteRepair);
    
    // Работа с файлами
    document.getElementById('saveToFileBtn')?.addEventListener('click', saveToFile);
    document.getElementById('loadFromFileBtn')?.addEventListener('click', function() {
        document.getElementById('fileInput').click();
    });
    document.getElementById('exportJsonBtn')?.addEventListener('click', exportJson);
    document.getElementById('addSampleDataBtn')?.addEventListener('click', addSampleData);
    document.getElementById('mergeDataBtn')?.addEventListener('click', mergeData);
    
    // Загрузка файла
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
    
    // Сворачивание структуры данных
    const toggleStructureBtn = document.getElementById('toggleStructureBtn');
    if (toggleStructureBtn) {
        toggleStructureBtn.addEventListener('click', toggleStructure);
    }
}

// ==================== ФУНКЦИИ РЕМОНТОВ ====================

function updateCarInfo() {
    const car = carData[currentCar];
    if (!car) return;
    
    car.totalRepairs = car.repairs ? car.repairs.length : 0;
    car.totalSpent = car.repairs ? car.repairs.reduce((sum, repair) => sum + (repair.total_price || 0), 0) : 0;
    
    if (car.repairs && car.repairs.length > 0) {
        const sortedRepairs = [...car.repairs].sort((a, b) => parseDate(b.date) - parseDate(a.date));
        car.lastRepair = sortedRepairs[0].date || '';
    } else {
        car.lastRepair = '';
    }
    
    saveCarData();
    updateCarStatsDisplay();
}

function updateCarStatsDisplay() {
    const car = carData[currentCar];
    if (!car) return;
    
    document.getElementById('carModel').textContent = car.model || '';
    document.getElementById('carYear').textContent = car.year || '';
    document.getElementById('carColor').textContent = car.color || '';
    document.getElementById('totalRepairs').textContent = car.totalRepairs || 0;
    document.getElementById('totalSpent').textContent = (car.totalSpent || 0).toLocaleString('ru-RU') + ' руб';
    document.getElementById('lastRepair').textContent = car.lastRepair || 'Нет данных';
}

function updateRepairsTable() {
    const car = carData[currentCar];
    const repairsBody = document.getElementById('repairsBody');
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    const currentSearchTerm = document.getElementById('currentSearchTerm');
    
    if (!car || !repairsBody) return;
    
    let filteredRepairs = [...(car.repairs || [])];
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredRepairs = (car.repairs || []).filter(repair => {
            const shortMatch = repair.short_work && repair.short_work.toLowerCase().includes(term);
            const worksMatch = repair.work_items && repair.work_items.some(item => 
                item.name && item.name.toLowerCase().includes(term)
            );
            const partsMatch = repair.part_items && repair.part_items.some(item => 
                (item.name && item.name.toLowerCase().includes(term)) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(term)) ||
                (item.article && item.article.toLowerCase().includes(term))
            );
            const stoMatch = repair.sto && repair.sto.toLowerCase().includes(term);
            const notesMatch = repair.notes && repair.notes.toLowerCase().includes(term);
            
            return shortMatch || worksMatch || partsMatch || stoMatch || notesMatch;
        });
    }
    
    filteredRepairs = sortRepairs(filteredRepairs, currentSort, currentOrder);
    
    if (searchTerm && searchResultsInfo) {
        searchResultsInfo.classList.remove('hidden');
        resultsCount.textContent = filteredRepairs.length;
        currentSearchTerm.textContent = searchTerm;
    } else if (searchResultsInfo) {
        searchResultsInfo.classList.add('hidden');
    }
    
    if (filteredRepairs.length === 0) {
        repairsBody.innerHTML = `
            <tr>
                <td colspan="5" class="no-results">
                    ${searchTerm ? 'По запросу "' + searchTerm + '" ничего не найдено' : 'Нет данных о ремонтах'}
                </td>
            </tr>
        `;
        return;
    }
    
    const isMobile = window.innerWidth <= 768;
    
    repairsBody.innerHTML = filteredRepairs.map(repair => {
        const isExpanded = expandedRepairId === repair.id;
        
        // Форматирование данных
        let displayDate = repair.date || '';
        let displayMileage = repair.mileage ? repair.mileage.toLocaleString('ru-RU') : '';
        let displayWork = repair.short_work || 'Ремонтные работы';
        let displaySto = repair.sto || '';
        let displayPrice = repair.total_price ? repair.total_price.toLocaleString('ru-RU') : '0';
        
        if (isMobile) {
            // Для мобильных: дата в формате дд.мм.гг
            if (displayDate) {
                const match = displayDate.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                if (match) {
                    displayDate = `${match[1]}.${match[2]}.${match[3].slice(2)}`;
                }
            }
            
            // Подсветка поиска
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const highlightText = (text) => {
                    if (!text) return '';
                    const regex = new RegExp(`(${term})`, 'gi');
                    return text.replace(regex, '<span class="highlight">$1</span>');
                };
                displayWork = highlightText(repair.short_work || 'Ремонтные работы');
                displaySto = highlightText(repair.sto || '');
            }
            
            // МОБИЛЬНАЯ ВЕРСИЯ - улучшенные карточки
            return `
                <tr class="${isExpanded ? 'expanded' : ''}" data-repair-id="${repair.id}">
                    <td>
                        <div class="mobile-repair-card">
                            <div class="mobile-repair-header">
                                <span class="mobile-repair-date">${displayDate}</span>
                                <span class="mobile-repair-mileage">${displayMileage} км</span>
                            </div>
                            <div class="repair-part">${displayWork}</div>
                            <div class="mobile-repair-info">
                                <div class="repair-sto">
                                    <i class="fas fa-warehouse"></i> ${displaySto || 'Не указано'}
                                </div>
                                <div class="repair-price">${displayPrice} руб</div>
                            </div>
                        </div>
                    </td>
                </tr>
                ${isExpanded ? `
                <tr id="details-${repair.id}" class="repair-details-row">
                    <td colspan="1">
                        <div class="repair-details active" id="repair-details-${repair.id}">
                            ${renderRepairDetails(repair)}
                        </div>
                    </td>
                </tr>
                ` : ''}
            `;
        } else {
            // ДЕСКТОПНАЯ ВЕРСИЯ - обычная таблица
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const highlightText = (text) => {
                    if (!text) return '';
                    const regex = new RegExp(`(${term})`, 'gi');
                    return text.replace(regex, '<span class="highlight">$1</span>');
                };
                displayWork = highlightText(repair.short_work || 'Ремонтные работы');
                displaySto = highlightText(repair.sto || '');
            }
            
            return `
                <tr class="${isExpanded ? 'expanded' : ''}" data-repair-id="${repair.id}">
                    <td>${displayDate}</td>
                    <td>${displayMileage}</td>
                    <td>
                        <div class="repair-part">${displayWork}</div>
                    </td>
                    <td class="repair-sto">${displaySto}</td>
                    <td class="repair-price">${displayPrice} руб</td>
                </tr>
                ${isExpanded ? `
                <tr id="details-${repair.id}" class="repair-details-row">
                    <td colspan="5">
                        <div class="repair-details active" id="repair-details-${repair.id}">
                            ${renderRepairDetails(repair)}
                        </div>
                    </td>
                </tr>
                ` : ''}
            `;
        }
    }).join('');
    
    // Обработчики кликов на строки
    document.querySelectorAll('.repairs-table tr[data-repair-id]').forEach(row => {
        row.addEventListener('click', function(e) {
            if (e.target.tagName === 'TH' || e.target.closest('th')) return;
            if (e.target.closest('.edit-repair-btn')) return;
            
            const repairId = parseInt(this.getAttribute('data-repair-id'));
            expandedRepairId = expandedRepairId === repairId ? null : repairId;
            updateRepairsTable();
        });
    });
    
    // Обработчики кнопок редактирования с проверкой авторизации
    setTimeout(() => {
        document.querySelectorAll('.edit-repair-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const repairId = parseInt(this.getAttribute('data-repair-id'));
                checkAuthBeforeEdit(openEditForm, repairId);
            });
        });
    }, 100);
    
    updateStructureDisplay();
}

function renderRepairDetails(repair) {
    let detailsHtml = `
        <div class="details-section">
            <div class="details-title">
                <i class="fas fa-tools"></i> Работы
            </div>
    `;
    
    if (repair.work_items && repair.work_items.length > 0) {
        const worksTotal = repair.work_items.reduce((sum, item) => sum + (item.price || 0), 0);
        
        detailsHtml += `
            <table class="details-table">
                <thead>
                    <tr>
                        <th style="min-width: 180px;">Наименование работы</th>
                        <th style="min-width: 100px; white-space: nowrap;">Стоимость</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        repair.work_items.forEach(item => {
            detailsHtml += `
                <tr>
                    <td style="word-break: break-word;">
                        <div style="font-weight: 500;">${item.name || ''}</div>
                        ${item.note ? `<div style="color: var(--warning); font-size: 11px; margin-top: 3px;">${item.note}</div>` : ''}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div class="work-price" style="font-weight: 600; font-size: 13px;">
                            ${item.price ? item.price.toLocaleString('ru-RU') : '0'} руб
                        </div>
                    </td>
                </tr>
            `;
        });
        
        detailsHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td style="text-align: right; font-weight: 600; padding-top: 10px; border-top: 1px solid var(--border);">
                            Итого работ:
                        </td>
                        <td style="text-align: right; font-weight: 600; padding-top: 10px; border-top: 1px solid var(--border); white-space: nowrap;">
                            ${worksTotal.toLocaleString('ru-RU')} руб
                        </td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else {
        detailsHtml += `<p style="color: var(--text); font-style: italic; font-size: 13px; padding: 10px;">Нет информации о работах</p>`;
    }
    
    detailsHtml += `</div><div class="details-section">
            <div class="details-title">
                <i class="fas fa-cog"></i> Запчасти
            </div>`;
    
    if (repair.part_items && repair.part_items.length > 0) {
        const partsTotal = repair.part_items.reduce((sum, item) => {
            const quantity = item.quantity || 1;
            return sum + (item.price || 0) * quantity;
        }, 0);
        
        // Проверяем, есть ли данные в столбцах
        const hasManufacturer = repair.part_items.some(item => 
            item.manufacturer && item.manufacturer.trim() !== ''
        );
        const hasArticle = repair.part_items.some(item => 
            item.article && item.article.trim() !== ''
        );
        const hasQuantity = repair.part_items.some(item => 
            item.quantity !== undefined && item.quantity !== null && item.quantity !== 1
        );
        const showUnitPrice = repair.part_items.some(item => 
            (item.quantity || 1) > 1 && item.price
        );
        
        detailsHtml += `
            <table class="details-table" style="width: 100%; table-layout: auto;">
                <thead>
                    <tr>
                        <th style="min-width: 150px; word-break: break-word;">Наименование</th>
                        ${hasManufacturer ? '<th style="min-width: 90px; max-width: 120px;">Производитель</th>' : ''}
                        ${hasArticle ? '<th style="min-width: 70px; max-width: 100px;">Артикул</th>' : ''}
                        ${hasQuantity ? '<th style="width: 60px; text-align: center;">Кол-во</th>' : ''}
                        <th style="min-width: 100px; text-align: right; white-space: nowrap;">
                            ${showUnitPrice ? 'Стоимость (общ.)' : 'Стоимость'}
                        </th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        repair.part_items.forEach(item => {
            const quantity = item.quantity || 1;
            const totalPrice = (item.price || 0) * quantity;
            const pricePerUnit = item.price || 0;
            
            detailsHtml += `
                <tr>
                    <td style="word-break: break-word;">
                        <div style="font-weight: 500;">${item.name || ''}</div>
                        ${item.note ? `<div style="color: var(--warning); font-size: 11px; margin-top: 3px;">${item.note}</div>` : ''}
                    </td>
                    ${hasManufacturer ? `<td style="max-width: 120px; word-break: break-word;">${item.manufacturer || '-'}</td>` : ''}
                    ${hasArticle ? `<td style="max-width: 100px; word-break: break-all;">${item.article || '-'}</td>` : ''}
                    ${hasQuantity ? `<td style="text-align: center;">${quantity}</td>` : ''}
                    <td style="text-align: right; white-space: nowrap;">
                        <div class="part-price" style="font-weight: 600; font-size: 13px;">
                            ${totalPrice.toLocaleString('ru-RU')} руб
                        </div>
                        ${quantity > 1 && pricePerUnit ? `
                        <div style="color: var(--text); font-size: 10px; margin-top: 2px;">
                            (${pricePerUnit.toLocaleString('ru-RU')} руб × ${quantity})
                        </div>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
        
        detailsHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="${1 + (hasManufacturer ? 1 : 0) + (hasArticle ? 1 : 0) + (hasQuantity ? 1 : 0)}" style="text-align: right; font-weight: 600; padding-top: 10px; border-top: 1px solid var(--border);">
                            Итого запчастей:
                        </td>
                        <td style="text-align: right; font-weight: 600; padding-top: 10px; border-top: 1px solid var(--border); white-space: nowrap;">
                            ${partsTotal.toLocaleString('ru-RU')} руб
                        </td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else {
        detailsHtml += `<p style="color: var(--text); font-style: italic; font-size: 13px; padding: 10px;">Нет информации о запчастях</p>`;
    }
    
    detailsHtml += `</div>
        <div class="details-total">
            <div class="total-label">Общая стоимость ремонта:</div>
            <div class="total-value" style="white-space: nowrap;">${repair.total_price ? repair.total_price.toLocaleString('ru-RU') : '0'} руб</div>
        </div>`;
    
    if (repair.notes) {
        detailsHtml += `
            <div class="repair-notes" style="margin-top: 15px;">
                <i class="fas fa-sticky-note"></i> 
                <div style="display: inline-block; margin-left: 8px;">
                    <div style="font-weight: 600; margin-bottom: 5px;">Примечания:</div>
                    <div style="word-break: break-word; font-size: 13px;">${repair.notes}</div>
                </div>
            </div>
        `;
    }
    
    // Добавляем кнопку редактирования только если авторизованы
    if (!isGuestMode) {
        const isMobile = window.innerWidth <= 768;
        const buttonStyle = isMobile ? 'style="width: 100%; justify-content: center;"' : '';
        
        detailsHtml += `
            <div class="repair-actions" style="margin-top: 20px;">
                <button class="btn btn-warning edit-repair-btn" data-repair-id="${repair.id}" ${buttonStyle}>
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
        `;
    }
    
    return detailsHtml;
}

// ==================== ОПЕРАЦИИ С РЕМОНТАМИ ====================

async function saveRepair() {
    const date = document.getElementById('repairDate').value.trim();
    const mileage = parseInt(document.getElementById('repairMileage').value) || 0;
    const shortWork = document.getElementById('repairShortWork').value.trim();
    const sto = document.getElementById('repairSto').value.trim();
    const price = parseInt(document.getElementById('repairPrice').value);
    const worksText = document.getElementById('repairWorks').value.trim();
    const partsText = document.getElementById('repairParts').value.trim();
    const notes = document.getElementById('repairNotes').value.trim();
    
    if (!date || !shortWork || !sto || isNaN(price) || price <= 0) {
        showStatus('Пожалуйста, заполните обязательные поля корректно', 'error');
        return;
    }
    
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!dateRegex.test(date)) {
        showStatus('Дата должна быть в формате ДД.ММ.ГГГГ', 'error');
        return;
    }
    
    const repairId = Date.now();
    
    // Парсим работы
    const workItems = [];
    if (worksText) {
        const lines = worksText.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (line) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    workItems.push({
                        name: parts[0].trim(),
                        price: parseFloat(parts[1].trim()) || 0
                    });
                } else if (parts.length === 1) {
                    workItems.push({
                        name: parts[0].trim(),
                        price: 0
                    });
                }
            }
        });
    }
    
    // Парсим запчасти
    const partItems = [];
    if (partsText) {
        const lines = partsText.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (line) {
                const parts = line.split('|');
                if (parts.length >= 5) {
                    partItems.push({
                        name: parts[0].trim(),
                        manufacturer: parts[1].trim(),
                        article: parts[2].trim(),
                        quantity: parseInt(parts[3].trim()) || 1,
                        price: parseFloat(parts[4].trim()) || 0
                    });
                } else if (parts.length === 1) {
                    partItems.push({
                        name: parts[0].trim(),
                        manufacturer: '',
                        article: '',
                        quantity: 1,
                        price: 0
                    });
                }
            }
        });
    }
    
    const repair = {
        id: repairId,
        date,
        mileage: mileage || 0,
        short_work: shortWork,
        total_price: price,
        sto,
        work_items: workItems,
        part_items: partItems,
        notes
    };
    
    carData[currentCar].repairs.push(repair);
    closeAllForms();
    updateCarInfo();
    updateRepairsTable();
    
    const saved = await saveCarData();
    showStatus(saved ? 'Ремонт успешно добавлен!' : 'Ремонт добавлен локально', saved ? 'success' : 'warning');
}

async function updateRepair() {
    const repairId = parseInt(document.getElementById('editRepairId').value);
    const date = document.getElementById('editRepairDate').value.trim();
    const mileage = parseInt(document.getElementById('editRepairMileage').value) || 0;
    const shortWork = document.getElementById('editRepairShortWork').value.trim();
    const sto = document.getElementById('editRepairSto').value.trim();
    const price = parseInt(document.getElementById('editRepairPrice').value);
    const worksText = document.getElementById('editRepairWorks').value.trim();
    const partsText = document.getElementById('editRepairParts').value.trim();
    const notes = document.getElementById('editRepairNotes').value.trim();
    
    if (!date || !shortWork || !sto || isNaN(price) || price <= 0) {
        showStatus('Пожалуйста, заполните обязательные поля корректно', 'error');
        return;
    }
    
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!dateRegex.test(date)) {
        showStatus('Дата должна быть в формате ДД.ММ.ГГГГ', 'error');
        return;
    }
    
    const car = carData[currentCar];
    const repairIndex = car.repairs.findIndex(r => r.id === repairId);
    
    if (repairIndex === -1) {
        showStatus('Ремонт не найден', 'error');
        return;
    }
    
    // Парсим работы
    const workItems = [];
    if (worksText) {
        const lines = worksText.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (line) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    workItems.push({
                        name: parts[0].trim(),
                        price: parseFloat(parts[1].trim()) || 0
                    });
                } else if (parts.length === 1) {
                    workItems.push({
                        name: parts[0].trim(),
                        price: 0
                    });
                }
            }
        });
    }
    
    // Парсим запчасти
    const partItems = [];
    if (partsText) {
        const lines = partsText.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (line) {
                const parts = line.split('|');
                if (parts.length >= 5) {
                    partItems.push({
                        name: parts[0].trim(),
                        manufacturer: parts[1].trim(),
                        article: parts[2].trim(),
                        quantity: parseInt(parts[3].trim()) || 1,
                        price: parseFloat(parts[4].trim()) || 0
                    });
                } else if (parts.length === 1) {
                    partItems.push({
                        name: parts[0].trim(),
                        manufacturer: '',
                        article: '',
                        quantity: 1,
                        price: 0
                    });
                }
            }
        });
    }
    
    car.repairs[repairIndex] = {
        id: repairId,
        date,
        mileage: mileage || 0,
        short_work: shortWork,
        total_price: price,
        sto,
        work_items: workItems,
        part_items: partItems,
        notes
    };
    
    closeAllForms();
    updateCarInfo();
    updateRepairsTable();
    
    const saved = await saveCarData();
    showStatus(saved ? 'Ремонт успешно обновлен!' : 'Ремонт обновлен локально', saved ? 'success' : 'warning');
}

async function deleteRepair() {
    const repairId = parseInt(document.getElementById('editRepairId').value);
    
    if (!confirm('Вы уверены, что хотите удалить этот ремонт?')) {
        return;
    }
    
    const car = carData[currentCar];
    const repairIndex = car.repairs.findIndex(r => r.id === repairId);
    
    if (repairIndex === -1) {
        showStatus('Ремонт не найден', 'error');
        return;
    }
    
    car.repairs.splice(repairIndex, 1);
    closeAllForms();
    updateCarInfo();
    updateRepairsTable();
    
    const saved = await saveCarData();
    showStatus(saved ? 'Ремонт успешно удален!' : 'Ремонт удален локально', saved ? 'success' : 'warning');
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function closeAllForms() {
    document.getElementById('addRepairForm').classList.remove('active');
    document.getElementById('editRepairForm').classList.remove('active');
    document.getElementById('dataSection').style.display = 'block';
    resetAddForm();
    editingRepairId = null;
    isEditingAction = false;
}

function resetAddForm() {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('ru-RU').replace(/\//g, '.');
    
    document.getElementById('repairDate').value = formattedDate;
    document.getElementById('repairMileage').value = '';
    document.getElementById('repairShortWork').value = '';
    document.getElementById('repairSto').value = '';
    document.getElementById('repairPrice').value = '';
    document.getElementById('repairWorks').value = '';
    document.getElementById('repairParts').value = '';
    document.getElementById('repairNotes').value = '';
}

function openEditForm(repairId) {
    const car = carData[currentCar];
    const repair = car.repairs.find(r => r.id === repairId);
    
    if (!repair) return;
    
    editingRepairId = repairId;
    document.getElementById('editRepairId').value = repairId;
    document.getElementById('editRepairDate').value = repair.date || '';
    document.getElementById('editRepairMileage').value = repair.mileage || '';
    document.getElementById('editRepairShortWork').value = repair.short_work || '';
    document.getElementById('editRepairSto').value = repair.sto || '';
    document.getElementById('editRepairPrice').value = repair.total_price || '';
    document.getElementById('editRepairNotes').value = repair.notes || '';
    
    let worksText = '';
    if (repair.work_items && repair.work_items.length > 0) {
        worksText = repair.work_items.map(item => `${item.name || ''}=${item.price || 0}`).join('\n');
    }
    document.getElementById('editRepairWorks').value = worksText;
    
    let partsText = '';
    if (repair.part_items && repair.part_items.length > 0) {
        partsText = repair.part_items.map(item => 
            `${item.name || ''}|${item.manufacturer || ''}|${item.article || ''}|${item.quantity || 1}|${item.price || 0}`
        ).join('\n');
    }
    document.getElementById('editRepairParts').value = partsText;
    
    document.getElementById('editRepairForm').classList.add('active');
    document.getElementById('addRepairForm').classList.remove('active');
    document.getElementById('dataSection').style.display = 'none';
}

function addSampleData() {
    Object.keys(samplePeugeotData).forEach(carKey => {
        if (carData[carKey]) {
            if (samplePeugeotData[carKey].repairs && Array.isArray(samplePeugeotData[carKey].repairs)) {
                samplePeugeotData[carKey].repairs.forEach(repair => {
                    repair.id = Date.now() + Math.floor(Math.random() * 1000);
                    if (!carData[carKey].repairs.some(r => r.id === repair.id)) {
                        carData[carKey].repairs.push(repair);
                    }
                });
            }
        }
    });
    
    updateCarInfo();
    updateRepairsTable();
    saveCarData();
    
    showStatus('Пример данных успешно добавлен!', 'success');
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
}

function sortRepairs(repairs, sortBy, order) {
    return repairs.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
            case 'date':
                aValue = parseDate(a.date);
                bValue = parseDate(b.date);
                break;
            case 'mileage':
                aValue = a.mileage || 0;
                bValue = b.mileage || 0;
                break;
            case 'short_work':
                aValue = (a.short_work || '').toLowerCase();
                bValue = (b.short_work || '').toLowerCase();
                break;
            case 'sto':
                aValue = (a.sto || '').toLowerCase();
                bValue = (b.sto || '').toLowerCase();
                break;
            case 'price':
                aValue = a.total_price || 0;
                bValue = b.total_price || 0;
                break;
            default:
                aValue = parseDate(a.date);
                bValue = parseDate(b.date);
        }
        
        let comparison = 0;
        if (typeof aValue === 'string') {
            comparison = aValue.localeCompare(bValue);
        } else {
            comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
        
        return order === 'desc' ? comparison * -1 : comparison;
    });
}

function sortTable(sortField) {
    let newOrder = 'asc';
    if (currentSort === sortField) {
        newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    } else {
        newOrder = 'asc';
    }
    
    currentSort = sortField;
    currentOrder = newOrder;
    setSortIndicator(sortField, newOrder);
    updateRepairsTable();
}

function setSortIndicator(sortField, order) {
    document.querySelectorAll('.repairs-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        th.setAttribute('data-order', '');
    });
    
    const currentTh = document.querySelector(`.repairs-table th[data-sort="${sortField}"]`);
    if (currentTh) {
        currentTh.setAttribute('data-order', order);
        currentTh.classList.add(order === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
}

function performSearch(term) {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
        searchTerm = term.trim();
        expandedRepairId = null;
        updateRepairsTable();
    }, searchDebounceDelay);
}

// ==================== ФАЙЛОВЫЕ ОПЕРАЦИИ ====================

function saveToFile() {
    try {
        const dataStr = JSON.stringify(carData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `мои_авто_${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        showStatus('Данные успешно сохранены в файл!', 'success');
    } catch (error) {
        showStatus('Ошибка при сохранении файла: ' + error.message, 'error');
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);
            
            // Объединяем данные
            carData = mergeCarData(carData, loadedData);
            
            searchTerm = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            expandedRepairId = null;
            
            updateCarInfo();
            updateRepairsTable();
            
            const saved = await saveCarData();
            showStatus(saved ? 'Данные успешно загружены из файла!' : 'Данные загружены локально', saved ? 'success' : 'warning');
        } catch (error) {
            showStatus('Ошибка при чтении файла: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

function exportJson() {
    try {
        const dataStr = JSON.stringify(carData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `мои_авто_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        showStatus('Данные успешно экспортированы в JSON!', 'success');
    } catch (error) {
        showStatus('Ошибка при экспорте: ' + error.message, 'error');
    }
}

async function mergeData() {
    const jsonInput = document.getElementById('jsonInput');
    if (!jsonInput) return;
    
    const jsonText = jsonInput.value.trim();
    
    if (!jsonText) {
        showStatus('Введите JSON данные для объединения', 'error');
        return;
    }
    
    try {
        const newData = JSON.parse(jsonText);
        
        // Объединяем данные
        carData = mergeCarData(carData, newData);
        
        jsonInput.value = '';
        updateCarInfo();
        updateRepairsTable();
        
        const saved = await saveCarData();
        showStatus(saved ? 'Данные успешно объединены!' : 'Данные объединены локально', saved ? 'success' : 'warning');
    } catch (error) {
        showStatus('Ошибка при парсинге JSON: ' + error.message, 'error');
    }
}

function toggleStructure() {
    const content = document.getElementById('structureContent');
    const chevron = document.getElementById('structureChevron');
    const container = document.querySelector('.data-example:last-child');
    
    if (!content || !chevron || !container) return;
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        content.classList.add('show');
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-up');
        container.classList.remove('structure-collapsed');
        container.classList.add('structure-expanded');
    } else {
        content.style.display = 'none';
        content.classList.remove('show');
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
        container.classList.remove('structure-expanded');
        container.classList.add('structure-collapsed');
    }
}

function updateStructureDisplay() {
    const currentStructure = document.getElementById('currentStructure');
    if (currentStructure) {
        currentStructure.textContent = JSON.stringify(carData, null, 2);
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'status-message';
    statusEl.classList.add(`status-${type}`);
    
    setTimeout(() => {
        statusEl.className = 'status-message';
    }, 3000);
}

// Обработчик изменения размера окна для перерисовки таблицы
window.addEventListener('resize', function() {
    updateRepairsTable();
});
