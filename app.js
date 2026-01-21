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

// ==================== АУТЕНТИФИКАЦИЯ ====================

function showAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'flex';
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
            updateRepairsCards();
            updateCarStatsDisplay();
        }
        
        showStatus('Успешный вход!', 'success');
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        showStatus(getErrorMessage(error), 'error');
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
            theme: localStorage.getItem('myCarsTheme') || 'arch',
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
    if (!isGuestMode && currentUser) {
        auth.signOut();
    }
    
    currentUser = null;
    userSettings = null;
    isGuestMode = true;
    
    // Обновляем данные
    updateUIForAuthState();
    updateCarInfo();
    updateRepairsCards();
    updateCarStatsDisplay();
    
    showStatus('Переход в гостевой режим', 'info');
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
    
    // Кнопки управления файлами (скрываем в гостевом режиме)
    const saveToFileBtn = document.getElementById('saveToFileBtn');
    const loadFromFileBtn = document.getElementById('loadFromFileBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const mergeDataBtn = document.getElementById('mergeDataBtn');
    const jsonInput = document.getElementById('jsonInput');
    const addSampleDataBtn = document.getElementById('addSampleDataBtn');
    
    if (isGuestMode) {
        // Гостевой режим
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'flex';
        if (modeIndicator) {
            modeIndicator.classList.remove('mode-authorized');
            modeIndicator.classList.add('mode-guest');
        }
        if (modeText) modeText.textContent = 'Гостевой режим (только просмотр)';
        if (userInfo) userInfo.textContent = 'Только просмотр данных';
        
        // Скрываем кнопки управления файлами
        if (saveToFileBtn) saveToFileBtn.style.display = 'none';
        if (loadFromFileBtn) loadFromFileBtn.style.display = 'none';
        if (exportJsonBtn) exportJsonBtn.style.display = 'none';
        if (mergeDataBtn) mergeDataBtn.style.display = 'none';
        if (jsonInput) jsonInput.style.display = 'none';
        if (addSampleDataBtn) addSampleDataBtn.style.display = 'none';
        
        // Обновляем заголовок раздела
        const dataSectionTitle = document.querySelector('#dataSection h2');
        if (dataSectionTitle) {
            dataSectionTitle.innerHTML = '<i class="fas fa-file-alt"></i> Данные (только просмотр)';
        }
        
        // Обновляем текст кнопки добавления ремонта
        const addRepairBtn = document.getElementById('addRepairBtn');
        if (addRepairBtn) {
            addRepairBtn.innerHTML = '<i class="fas fa-lock"></i> Войдите для добавления ремонта';
            addRepairBtn.classList.remove('btn-success');
            addRepairBtn.classList.add('btn-secondary');
        }
        
    } else {
        // Режим редактирования
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (modeIndicator) {
            modeIndicator.classList.remove('mode-guest');
            modeIndicator.classList.add('mode-authorized');
        }
        if (modeText) modeText.textContent = 'Режим редактирования';
        if (userInfo) userInfo.textContent = `Пользователь: ${currentUser?.email || 'Авторизован'}`;
        
        // Показываем кнопки управления файлами
        if (saveToFileBtn) saveToFileBtn.style.display = 'flex';
        if (loadFromFileBtn) loadFromFileBtn.style.display = 'flex';
        if (exportJsonBtn) exportJsonBtn.style.display = 'flex';
        if (mergeDataBtn) mergeDataBtn.style.display = 'flex';
        if (jsonInput) jsonInput.style.display = 'block';
        if (addSampleDataBtn) addSampleDataBtn.style.display = 'flex';
        
        // Обновляем заголовок раздела
        const dataSectionTitle = document.querySelector('#dataSection h2');
        if (dataSectionTitle) {
            dataSectionTitle.innerHTML = '<i class="fas fa-file-alt"></i> Управление данными';
        }
        
        // Обновляем текст кнопки добавления ремонта
        const addRepairBtn = document.getElementById('addRepairBtn');
        if (addRepairBtn) {
            addRepairBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить ремонт';
            addRepairBtn.classList.remove('btn-secondary');
            addRepairBtn.classList.add('btn-success');
        }
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

async function loadGuestData() {
    try {
        if (guestDataLoaded) return true;
        
        console.log('Загрузка гостевых данных...');
        
        // Пробуем загрузить из публичной коллекции
        try {
            const publicDataRef = db.collection('publicData').doc('guestAccess');
            const publicDataDoc = await publicDataRef.get();
            
            if (publicDataDoc.exists) {
                const data = publicDataDoc.data();
                if (data.carData) {
                    carData = mergeCarData(carData, data.carData);
                    guestDataLoaded = true;
                    console.log('Гостевые данные загружены из Firebase');
                    return true;
                }
            }
        } catch (error) {
            console.warn('Не удалось загрузить гостевые данные из Firebase:', error);
        }
        
        // Если нет данных в Firebase, используем локальные
        const localData = localStorage.getItem('myCarsGuestData');
        if (localData) {
            try {
                const parsedData = JSON.parse(localData);
                carData = mergeCarData(carData, parsedData);
                guestDataLoaded = true;
                console.log('Гостевые данные загружены из localStorage');
                return true;
            } catch (e) {
                console.error('Ошибка парсинга локальных данных:', e);
            }
        }
        
        // Если все еще нет данных, добавляем пример
        if (!guestDataLoaded && samplePeugeotData.peugeot && samplePeugeotData.peugeot.repairs) {
            samplePeugeotData.peugeot.repairs.forEach(repair => {
                repair.id = Date.now() + Math.floor(Math.random() * 1000);
                if (!carData.peugeot.repairs.some(r => r.short_work === repair.short_work)) {
                    carData.peugeot.repairs.push(repair);
                }
            });
            guestDataLoaded = true;
            console.log('Использованы примерные данные');
        }
        
        return guestDataLoaded;
        
    } catch (error) {
        console.error('Ошибка загрузки гостевых данных:', error);
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
            if (userSettings.theme) {
                switchTheme(userSettings.theme, false);
            }
        } else {
            // Если настроек нет, создаем их
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
        } else {
            // Создаем начальные данные для нового пользователя
            await createInitialUserData();
        }
        
        // Обновляем UI
        updateCarInfo();
        updateRepairsCards();
        updateCarStatsDisplay();
        
        return true;
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
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
    const validThemes = ['arch', 'rosepine'];
    if (!validThemes.includes(theme)) {
        theme = 'arch';
    }
    
    document.body.classList.remove('theme-arch', 'theme-rosepine');
    document.body.classList.add(`theme-${theme}`);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const themeBtn = document.querySelector(`.theme-btn[data-theme="${theme}"]`);
    if (themeBtn) {
        themeBtn.classList.add('active');
    } else {
        const archBtn = document.querySelector('.theme-btn[data-theme="arch"]');
        if (archBtn) archBtn.classList.add('active');
    }
    
    const themeName = theme === 'arch' ? 'Arch Linux' : 'Rosé Pine';
    const themeNameEl = document.getElementById('themeName');
    if (themeNameEl) {
        themeNameEl.textContent = themeName;
    }
    
    localStorage.setItem('myCarsTheme', theme);
    
    if (!isGuestMode && userSettings && saveToServer) {
        userSettings.theme = theme;
        saveUserSettings();
    }
}

function loadSavedTheme() {
    try {
        const savedTheme = localStorage.getItem('myCarsTheme');
        const validThemes = ['arch', 'rosepine'];
        
        let themeToLoad = 'arch';
        if (savedTheme && validThemes.includes(savedTheme)) {
            themeToLoad = savedTheme;
        } else {
            localStorage.setItem('myCarsTheme', 'arch');
        }
        
        switchTheme(themeToLoad, false);
        
    } catch (error) {
        console.error('Ошибка загрузки темы:', error);
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
    console.log('DOM загружен, инициализация приложения...');
    
    // Загружаем сохраненную тему
    loadSavedTheme();
    
    // Инициализируем приложение
    initApp();
    
    // Отслеживаем состояние аутентификации
    auth.onAuthStateChanged(async user => {
        console.log('Состояние аутентификации изменено:', user ? user.email : 'Нет пользователя');
        
        if (user) {
            currentUser = user;
            isGuestMode = false;
            
            console.log('Пользователь авторизован:', user.email);
            
            // Загружаем данные пользователя
            await loadUserData();
            
            // Обновляем интерфейс
            updateUIForAuthState();
            updateCarInfo();
            updateRepairsCards();
            updateCarStatsDisplay();
            
        } else {
            console.log('Пользователь не авторизован, гостевой режим');
            currentUser = null;
            isGuestMode = true;
            
            // Загружаем гостевые данные
            await loadGuestData();
            
            // Обновляем интерфейс
            updateUIForAuthState();
            updateCarInfo();
            updateRepairsCards();
            updateCarStatsDisplay();
        }
    });
});

async function initApp() {
    console.log('Инициализация приложения...');
    
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
    
    // Устанавливаем индикатор сортировки
    updateSortButtons();
    
    console.log('Приложение инициализировано');
}

function setupEventListeners() {
    console.log('Настройка обработчиков событий...');
    
    // Переключение темы
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const theme = this.getAttribute('data-theme');
            localStorage.setItem('myCarsTheme', theme);
            switchTheme(theme);
            const themeName = theme === 'arch' ? 'Arch Linux' : 'Rosé Pine';
            showStatus(`Тема изменена на ${themeName}`, 'success');
        });
    });
    
    // Кнопки входа/выхода
    document.getElementById('loginBtnMain')?.addEventListener('click', function(e) {
        e.stopPropagation();
        showAuthModal();
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        logoutUser();
    });
    
    // Кнопки модального окна
    document.getElementById('loginBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        loginUser();
    });
    
    document.getElementById('cancelAuthBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        hideAuthModal();
    });
    
    // Выбор автомобиля
    document.querySelectorAll('.car-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('.car-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            currentCar = this.getAttribute('data-car');
            expandedRepairId = null;
            updateCarInfo();
            updateRepairsCards();
            updateCarStatsDisplay();
        });
    });
    
    // Сворачивание блока статистики
    const carInfoToggle = document.getElementById('carInfoToggle');
    if (carInfoToggle) {
        carInfoToggle.addEventListener('click', function(e) {
            e.stopPropagation();
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
        searchInput.addEventListener('input', function(e) {
            performSearch(this.value);
        });
    }
    
    // Очистка поиска
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            searchInput.value = '';
            searchTerm = '';
            updateRepairsCards();
        });
    }
    
    // Сортировка карточек
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const sortField = this.getAttribute('data-sort');
            const sortOrder = this.getAttribute('data-order');
            sortRepairsCards(sortField, sortOrder);
        });
    });
    
    // Кнопка добавления ремонта (с проверкой авторизации)
    document.getElementById('addRepairBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        document.getElementById('addRepairForm').classList.add('active');
        document.getElementById('editRepairForm').classList.remove('active');
        document.getElementById('dataSection').style.display = 'none';
    });
    
    // Кнопки форм ремонта
    document.getElementById('saveRepairBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        saveRepair();
    });
    
    document.getElementById('cancelRepairBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllForms();
    });
    
    document.getElementById('updateRepairBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        updateRepair();
    });
    
    document.getElementById('cancelEditBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllForms();
    });
    
    document.getElementById('deleteRepairBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteRepair();
    });
    
    // Кнопки управления файлами (только для авторизованных)
    document.getElementById('saveToFileBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        saveToFile();
    });
    
    document.getElementById('loadFromFileBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('exportJsonBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        exportJson();
    });
    
    document.getElementById('addSampleDataBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        addSampleData();
    });
    
    document.getElementById('mergeDataBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isGuestMode) {
            showAuthModal();
            return;
        }
        mergeData();
    });
    
    // Загрузка файла
    document.getElementById('fileInput')?.addEventListener('change', function(e) {
        handleFileUpload(e);
    });
    
    // Сворачивание структуры данных
    document.getElementById('toggleStructureBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStructure();
    });
    
    // Обработчик закрытия модального окна при клике вне его
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideAuthModal();
            }
        });
    }
    
    // Закрытие модального окна по ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            hideAuthModal();
        }
    });
    
    console.log('Обработчики событий настроены');
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
    
    if (!isGuestMode) {
        saveCarData();
    }
    
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

function updateRepairsCards() {
    const car = carData[currentCar];
    const repairsContainer = document.getElementById('repairsContainer');
    const searchResultsInfo = document.getElementById('searchResultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    const currentSearchTerm = document.getElementById('currentSearchTerm');
    
    if (!car || !repairsContainer) return;
    
    let filteredRepairs = [...(car.repairs || [])];
    
    // Фильтрация по поиску
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
    
    // Сортировка
    filteredRepairs = sortRepairs(filteredRepairs, currentSort, currentOrder);
    
    // Обновление информации о результатах поиска
    if (searchTerm && searchResultsInfo) {
        searchResultsInfo.classList.remove('hidden');
        resultsCount.textContent = filteredRepairs.length;
        currentSearchTerm.textContent = searchTerm;
    } else if (searchResultsInfo) {
        searchResultsInfo.classList.add('hidden');
    }
    
    // Очистка контейнера
    repairsContainer.innerHTML = '';
    
    // Если нет ремонтов
    if (filteredRepairs.length === 0) {
        const noRepairsDiv = document.createElement('div');
        noRepairsDiv.className = 'no-repairs';
        noRepairsDiv.innerHTML = `
            <i class="fas fa-tools"></i>
            <p>${searchTerm ? `По запросу "${searchTerm}" ничего не найдено` : 'Нет данных о ремонтах'}</p>
        `;
        repairsContainer.appendChild(noRepairsDiv);
        return;
    }
    
    // Создание карточек
    filteredRepairs.forEach(repair => {
        const isExpanded = expandedRepairId === repair.id;
        
        // Создаем карточку
        const card = document.createElement('div');
        card.className = `repair-card ${isExpanded ? 'expanded' : ''}`;
        card.setAttribute('data-repair-id', repair.id);
        
        // Форматирование данных
        const displayDate = repair.date || '';
        const displayMileage = repair.mileage ? repair.mileage.toLocaleString('ru-RU') + ' км' : '';
        let displayWork = repair.short_work || 'Ремонтные работы';
        const displaySto = repair.sto || 'Не указано';
        const displayPrice = repair.total_price ? repair.total_price.toLocaleString('ru-RU') + ' руб' : '0 руб';
        
        // Подсветка поиска
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const highlightText = (text) => {
                if (!text) return '';
                const regex = new RegExp(`(${term})`, 'gi');
                return text.replace(regex, '<span class="highlight">$1</span>');
            };
            displayWork = highlightText(displayWork);
        }
        
        // Содержимое карточки
        card.innerHTML = `
            <div class="repair-card-header">
                <div class="repair-card-date">${displayDate}</div>
                <div class="repair-card-mileage">${displayMileage}</div>
            </div>
            <div class="repair-card-work">${displayWork}</div>
            <div class="repair-card-footer">
                <div class="repair-card-sto">
                    <i class="fas fa-warehouse"></i> ${displaySto}
                </div>
                <div class="repair-card-price">${displayPrice}</div>
            </div>
            ${isExpanded ? `
            <div class="repair-card-details">
                ${renderRepairDetails(repair)}
            </div>
            ` : ''}
        `;
        
        // Обработчик клика на карточку
        card.addEventListener('click', function(e) {
            if (e.target.closest('.edit-repair-btn') || 
                e.target.closest('.repair-card-details') ||
                e.target.closest('.repair-actions')) {
                return;
            }
            
            const repairId = parseInt(this.getAttribute('data-repair-id'));
            expandedRepairId = expandedRepairId === repairId ? null : repairId;
            updateRepairsCards();
        });
        
        repairsContainer.appendChild(card);
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
            <table class="works-table">
                <thead>
                    <tr>
                        <th>Наименование работы</th>
                        <th style="text-align: right; white-space: nowrap;">Стоимость</th>
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
                    <td style="text-align: right;">
                        <div class="work-price">
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
                        <td style="text-align: right; font-weight: 600;">
                            Итого работ:
                        </td>
                        <td style="text-align: right; font-weight: 600;">
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
        
        // Десктопная версия (таблица)
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
            <!-- Десктопная версия (скрыта на мобильных) -->
            <table class="desktop-parts-table">
                <thead>
                    <tr>
                        <th>Наименование</th>
                        ${hasManufacturer ? '<th style="min-width: 90px;">Производитель</th>' : ''}
                        ${hasArticle ? '<th style="min-width: 70px;">Артикул</th>' : ''}
                        ${hasQuantity ? '<th style="width: 60px; text-align: center;">Кол-во</th>' : ''}
                        <th style="text-align: right; white-space: nowrap;">
                            ${showUnitPrice ? 'Стоимость' : 'Стоимость'}
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
                    ${hasManufacturer ? `<td>${item.manufacturer || '-'}</td>` : ''}
                    ${hasArticle ? `<td style="word-break: break-all;">${item.article || '-'}</td>` : ''}
                    ${hasQuantity ? `<td style="text-align: center;">${quantity}</td>` : ''}
                    <td style="text-align: right;">
                        <div class="part-price">
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
                        <td colspan="${1 + (hasManufacturer ? 1 : 0) + (hasArticle ? 1 : 0) + (hasQuantity ? 1 : 0)}" style="text-align: right; font-weight: 600;">
                            Итого запчастей:
                        </td>
                        <td style="text-align: right; font-weight: 600;">
                            ${partsTotal.toLocaleString('ru-RU')} руб
                        </td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Мобильная версия (скрыта на десктопе) -->
            <div class="parts-list">
        `;
        
        // Мобильная версия (карточки)
        repair.part_items.forEach(item => {
            const quantity = item.quantity || 1;
            const totalPrice = (item.price || 0) * quantity;
            const pricePerUnit = item.price || 0;
            
            detailsHtml += `
                <div class="part-item-mobile">
                    <div class="part-name-mobile">${item.name || ''}</div>
                    <div class="part-details-mobile">
                        ${item.manufacturer && item.manufacturer.trim() !== '' ? 
                            `<div class="part-detail-mobile">
                                <i class="fas fa-industry"></i>
                                <span>${item.manufacturer}</span>
                            </div>` : ''}
                        ${item.article && item.article.trim() !== '' ? 
                            `<div class="part-detail-mobile">
                                <i class="fas fa-barcode"></i>
                                <span>${item.article}</span>
                            </div>` : ''}
                        ${quantity > 1 ? 
                            `<div class="part-detail-mobile">
                                <i class="fas fa-layer-group"></i>
                                <span>${quantity} шт</span>
                            </div>` : ''}
                    </div>
                    <div class="part-price-mobile">
                        ${totalPrice.toLocaleString('ru-RU')} руб
                        ${quantity > 1 && pricePerUnit ? 
                            `<div style="color: var(--text); font-size: 11px; margin-top: 2px;">
                                (${pricePerUnit.toLocaleString('ru-RU')} руб × ${quantity})
                            </div>` : ''}
                    </div>
                    ${item.note ? `<div style="color: var(--warning); font-size: 11px; margin-top: 5px; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.1);">${item.note}</div>` : ''}
                </div>
            `;
        });
        
        detailsHtml += `
                <div class="part-item-mobile" style="background-color: rgba(0, 0, 0, 0.25); border-color: var(--success);">
                    <div class="part-name-mobile" style="font-size: 14px;">Итого запчастей:</div>
                    <div class="part-price-mobile" style="font-size: 15px; color: var(--success);">
                        ${partsTotal.toLocaleString('ru-RU')} руб
                    </div>
                </div>
            </div>
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
        detailsHtml += `
            <div class="repair-actions" style="margin-top: 20px;">
                <button class="btn btn-warning edit-repair-btn" data-repair-id="${repair.id}">
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
    updateRepairsCards();
    
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
    updateRepairsCards();
    
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
    updateRepairsCards();
    
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
    updateRepairsCards();
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

function sortRepairsCards(sortField, sortOrder) {
    currentSort = sortField;
    currentOrder = sortOrder;
    
    // Обновляем кнопки сортировки
    updateSortButtons();
    
    // Обновляем карточки
    updateRepairsCards();
}

function updateSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        const sortField = btn.getAttribute('data-sort');
        btn.classList.remove('active');
        
        if (sortField === currentSort) {
            btn.classList.add('active');
            
            // Обновляем иконку направления сортировки
            const icon = btn.querySelector('i');
            if (icon) {
                if (currentOrder === 'asc') {
                    icon.className = 'fas fa-sort-amount-up';
                } else {
                    icon.className = 'fas fa-sort-amount-down';
                }
            }
        }
    });
}

function performSearch(term) {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
        searchTerm = term.trim();
        expandedRepairId = null;
        updateRepairsCards();
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
            updateRepairsCards();
            
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
        updateRepairsCards();
        
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

// Обработчик изменения размера окна для перерисовки карточек
window.addEventListener('resize', function() {
    updateRepairsCards();
});
