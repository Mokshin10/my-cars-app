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
    editingRepairId = null;
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
        
        await loadUserSettings();
        updateUIForAuthState();
        hideAuthModal();
        showStatus('Успешный вход! Режим редактирования', 'success');
        
        // Выполняем отложенное действие редактирования
        if (isEditingAction) {
            if (editingRepairId) {
                openEditForm(editingRepairId);
            } else {
                openAddForm();
            }
        }
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        showStatus(getErrorMessage(error), 'error');
    }
}

function logoutUser() {
    if (currentUser) {
        auth.signOut();
    }
    
    currentUser = null;
    userSettings = null;
    isGuestMode = true;
    isEditingAction = false;
    editingRepairId = null;
    
    updateUIForAuthState();
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
    const modeIcon = document.getElementById('modeIcon');
    const modeText = document.getElementById('modeText');
    const userInfo = document.getElementById('userInfo');
    
    const saveToFileBtn = document.getElementById('saveToFileBtn');
    const loadFromFileBtn = document.getElementById('loadFromFileBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const mergeDataBtn = document.getElementById('mergeDataBtn');
    const jsonInput = document.getElementById('jsonInput');
    const addSampleDataBtn = document.getElementById('addSampleDataBtn');
    
    if (isGuestMode) {
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'flex';
        if (modeIndicator) {
            modeIndicator.classList.remove('mode-authorized');
            modeIndicator.classList.add('mode-guest');
        }
        if (modeIcon) modeIcon.className = 'fas fa-user';
        if (modeText) modeText.textContent = 'Гость';
        if (userInfo) userInfo.textContent = 'Гостевой доступ';
        
        if (saveToFileBtn) saveToFileBtn.style.display = 'none';
        if (loadFromFileBtn) loadFromFileBtn.style.display = 'none';
        if (exportJsonBtn) exportJsonBtn.style.display = 'none';
        if (mergeDataBtn) mergeDataBtn.style.display = 'none';
        if (jsonInput) jsonInput.style.display = 'none';
        if (addSampleDataBtn) addSampleDataBtn.style.display = 'none';
        
        const addRepairBtn = document.getElementById('addRepairBtn');
        if (addRepairBtn) {
            addRepairBtn.innerHTML = '<i class="fas fa-lock"></i> Войдите для редактирования';
            addRepairBtn.classList.remove('btn-success');
            addRepairBtn.classList.add('btn-secondary');
        }
        
    } else {
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (modeIndicator) {
            modeIndicator.classList.remove('mode-guest');
            modeIndicator.classList.add('mode-authorized');
        }
        if (modeIcon) modeIcon.className = 'fas fa-user-check';
        if (modeText) modeText.textContent = 'Редакт.';
        if (userInfo) userInfo.textContent = `Пользователь: ${currentUser?.email || 'Авторизован'}`;
        
        if (saveToFileBtn) saveToFileBtn.style.display = 'flex';
        if (loadFromFileBtn) loadFromFileBtn.style.display = 'flex';
        if (exportJsonBtn) exportJsonBtn.style.display = 'flex';
        if (mergeDataBtn) mergeDataBtn.style.display = 'flex';
        if (jsonInput) jsonInput.style.display = 'block';
        if (addSampleDataBtn) addSampleDataBtn.style.display = 'flex';
        
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

async function loadCarData() {
    try {
        console.log('Загрузка данных автомобилей...');
        
        const carsRef = db.collection('cars');
        const snapshot = await carsRef.get();
        
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const carId = doc.id;
                const data = doc.data();
                
                if (carData[carId]) {
                    Object.assign(carData[carId], data);
                }
            });
            
            console.log('Данные загружены из Firestore:', carData);
            updateCarInfo();
            updateRepairsCards();
            updateCarStatsDisplay();
            return true;
        } else {
            console.log('Нет данных в Firestore, создаем начальные...');
            await createInitialCarData();
            return true;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showStatus('Ошибка загрузки данных', 'error');
        return false;
    }
}

async function createInitialCarData() {
    try {
        for (const [carId, data] of Object.entries(carData)) {
            await db.collection('cars').doc(carId).set(data);
        }
        
        console.log('Начальные данные созданы в Firestore');
        showStatus('Начальные данные созданы', 'success');
        return true;
        
    } catch (error) {
        console.error('Ошибка создания начальных данных:', error);
        showStatus('Ошибка создания данных', 'error');
        return false;
    }
}

async function saveCarDataToFirestore() {
    try {
        if (isGuestMode) {
            console.log('Гость: данные не сохраняются');
            return false;
        }
        
        console.log('Сохранение данных в Firestore...');
        await db.collection('cars').doc(currentCar).set(carData[currentCar], { merge: true });
        console.log('Данные успешно сохранены');
        return true;
        
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        showStatus('Ошибка сохранения в Firebase', 'error');
        return false;
    }
}

async function saveAllCarDataToFirestore() {
    try {
        if (isGuestMode) {
            console.log('Гость: данные не сохраняются');
            return false;
        }
        
        console.log('Сохранение всех данных в Firestore...');
        
        Object.keys(carData).forEach(carKey => {
            const car = carData[carKey];
            if (car.repairs && Array.isArray(car.repairs)) {
                car.totalRepairs = car.repairs.length;
                car.totalSpent = car.repairs.reduce((sum, repair) => sum + (repair.total_price || 0), 0);
                
                if (car.repairs.length > 0) {
                    const sortedRepairs = [...car.repairs].sort((a, b) => parseDate(b.date) - parseDate(a.date));
                    car.lastRepair = sortedRepairs[0].date || '';
                } else {
                    car.lastRepair = '';
                }
            }
        });
        
        for (const [carId, data] of Object.entries(carData)) {
            await db.collection('cars').doc(carId).set(data, { merge: true });
            console.log(`Сохранен автомобиль ${carId}:`, data);
        }
        
        console.log('Все данные успешно сохранены в Firestore');
        return true;
        
    } catch (error) {
        console.error('Ошибка сохранения всех данных:', error);
        showStatus('Ошибка сохранения в Firebase: ' + error.message, 'error');
        return false;
    }
}

async function loadUserSettings() {
    try {
        if (!currentUser) return false;
        
        const settingsRef = db.collection('userSettings').doc(currentUser.uid);
        const settingsDoc = await settingsRef.get();
        
        if (settingsDoc.exists) {
            userSettings = settingsDoc.data();
            if (userSettings.theme) {
                switchTheme(userSettings.theme, false);
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        return false;
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
        const savedTheme = localStorage.getItem('myCarsTheme') || 'arch';
        const validThemes = ['arch', 'rosepine'];
        
        if (validThemes.includes(savedTheme)) {
            switchTheme(savedTheme, false);
        } else {
            switchTheme('arch', false);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки темы:', error);
        document.body.classList.add('theme-arch');
    }
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализация приложения...');
    
    loadSavedTheme();
    initApp();
    
    auth.onAuthStateChanged(async user => {
        console.log('Состояние аутентификации изменено:', user ? user.email : 'Нет пользователя');
        
        if (user) {
            currentUser = user;
            isGuestMode = false;
            
            console.log('Пользователь авторизован:', user.email);
            await loadUserSettings();
            
        } else {
            console.log('Гостевой режим');
            currentUser = null;
            isGuestMode = true;
            isEditingAction = false;
            editingRepairId = null;
        }
        
        updateUIForAuthState();
        await loadCarData();
    });
});

function initApp() {
    console.log('Инициализация приложения...');

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        console.log('Мобильное устройство обнаружено');
        document.body.classList.add('is-mobile');
    }
    
    setupEventListeners();
    
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
    
    updateSortButtons();
    
    console.log('Приложение инициализировано');
}

function setupEventListeners() {
    console.log('Настройка обработчиков событий...');
    
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
    
    document.getElementById('loginBtnMain')?.addEventListener('click', function(e) {
        e.stopPropagation();
        showAuthModal();
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        logoutUser();
    });
    
    document.getElementById('loginBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        loginUser();
    });
    
    document.getElementById('cancelAuthBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        hideAuthModal();
    });
    
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
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            performSearch(this.value);
        });
    }
    
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            searchInput.value = '';
            searchTerm = '';
            updateRepairsCards();
        });
    }
    
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const sortField = this.getAttribute('data-sort');
            const sortOrder = this.getAttribute('data-order');
            sortRepairsCards(sortField, sortOrder);
        });
    });
    
    document.getElementById('addRepairBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        checkAuthBeforeEdit(openAddForm);
    });
    
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
    
    document.getElementById('saveToFileBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        saveToFile();
    });
    
    document.getElementById('loadFromFileBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('exportJsonBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        exportJson();
    });
    
    document.getElementById('addSampleDataBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        addSampleData();
    });
    
    document.getElementById('mergeDataBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        mergeData();
    });
    
    document.getElementById('fileInput')?.addEventListener('change', function(e) {
        handleFileUpload(e);
    });
    
    document.getElementById('toggleStructureBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStructure();
    });
    
    // Кнопки "Назад к списку ремонтов"
    document.querySelectorAll('.back-to-list-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllForms();
        });
    });
    
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideAuthModal();
            }
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            hideAuthModal();
        }
    });
    
    db.collection('cars').onSnapshot((snapshot) => {
        console.log('Обнаружены изменения в базе данных');
        
        snapshot.docChanges().forEach((change) => {
            if (change.type === "modified") {
                const carId = change.doc.id;
                const data = change.doc.data();
                
                if (carData[carId]) {
                    Object.assign(carData[carId], data);
                    
                    if (carId === currentCar) {
                        updateCarInfo();
                        updateRepairsCards();
                        updateCarStatsDisplay();
                        showStatus('Данные обновлены', 'success');
                    }
                }
            }
        });
    }, (error) => {
        console.error('Ошибка подписки на изменения:', error);
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
    
    repairsContainer.innerHTML = '';
    
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
    
    filteredRepairs.forEach(repair => {
        const isExpanded = expandedRepairId === repair.id;
        
        const card = document.createElement('div');
        card.className = `repair-card ${isExpanded ? 'expanded' : ''}`;
        card.setAttribute('data-repair-id', repair.id);
        
        const displayDate = repair.date || '';
        const displayMileage = repair.mileage ? repair.mileage.toLocaleString('ru-RU') + ' км' : '';
        let displayWork = repair.short_work || 'Ремонтные работы';
        const displaySto = repair.sto || 'Не указано';
        const displayPrice = repair.total_price ? repair.total_price.toLocaleString('ru-RU') + ' руб' : '0 руб';
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const highlightText = (text) => {
                if (!text) return '';
                const regex = new RegExp(`(${term})`, 'gi');
                return text.replace(regex, '<span class="highlight">$1</span>');
            };
            displayWork = highlightText(displayWork);
        }
        
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
        
        card.addEventListener('click', function(e) {
            if (e.target.closest('.edit-repair-btn') || 
                e.target.closest('.repair-card-details') ||
                e.target.closest('.repair-actions')) {
                return;
            }
            
            const repairId = parseInt(this.getAttribute('data-repair-id'));
            const wasExpanded = expandedRepairId === repairId;
            
            if (wasExpanded) {
                // Закрываем карточку
                expandedRepairId = null;
                updateRepairsCards();
            } else {
                // Открываем новую карточку
                expandedRepairId = repairId;
                updateRepairsCards();
                
                // Скроллим к верхней части новой открытой карточки
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        const expandedCard = document.querySelector(`.repair-card[data-repair-id="${repairId}"]`);
                        if (expandedCard) {
                            expandedCard.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start'
                            });
                        }
                    }, 100);
                }
            }
        });
        
        repairsContainer.appendChild(card);
    });
    
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
    let html = '';
    
    if (repair.work_items && repair.work_items.length > 0) {
        html += `
            <div class="details-section">
                <div class="details-title">
                    <i class="fas fa-tools"></i> Работы
                </div>
                <table class="works-table">
                    <thead>
                        <tr>
                            <th>Наименование</th>
                            <th style="text-align: right;">Стоимость</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        repair.work_items.forEach(item => {
            html += `
                <tr>
                    <td>${item.name || ''}</td>
                    <td class="work-price" style="text-align: right;">
                        ${(item.price || 0).toLocaleString('ru-RU')} руб
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td style="font-weight: 600;">Итого по работам:</td>
                            <td style="text-align: right; font-weight: 600;">
                                ${repair.work_items.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString('ru-RU')} руб
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    if (repair.part_items && repair.part_items.length > 0) {
        html += `
            <div class="details-section">
                <div class="details-title">
                    <i class="fas fa-cogs"></i> Запчасти
                </div>
                
                <table class="desktop-parts-table">
                    <thead>
                        <tr>
                            <th>Наименование</th>
                            <th>Производитель</th>
                            <th>Артикул</th>
                            <th>Кол-во</th>
                            <th style="text-align: right;">Стоимость</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        repair.part_items.forEach(item => {
            html += `
                <tr>
                    <td>${item.name || ''}</td>
                    <td>${item.manufacturer || ''}</td>
                    <td>${item.article || ''}</td>
                    <td>${item.quantity || 1}</td>
                    <td class="part-price" style="text-align: right;">
                        ${(item.price || 0).toLocaleString('ru-RU')} руб
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" style="font-weight: 600;">Итого по запчастям:</td>
                            <td style="text-align: right; font-weight: 600;">
                                ${repair.part_items.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString('ru-RU')} руб
                            </td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="parts-list">
        `;
        
        repair.part_items.forEach(item => {
            html += `
                <div class="part-item-mobile">
                    <div class="part-name-mobile">${item.name || ''}</div>
                    <div class="part-details-mobile">
                        ${item.manufacturer ? `<div class="part-detail-mobile"><i class="fas fa-industry"></i> ${item.manufacturer}</div>` : ''}
                        ${item.article ? `<div class="part-detail-mobile"><i class="fas fa-barcode"></i> ${item.article}</div>` : ''}
                        <div class="part-detail-mobile"><i class="fas fa-layer-group"></i> ${item.quantity || 1}</div>
                    </div>
                    <div class="part-price-mobile">${(item.price || 0).toLocaleString('ru-RU')} руб</div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += `
        <div class="details-total">
            <div class="total-label">Общая стоимость ремонта:</div>
            <div class="total-value">${(repair.total_price || 0).toLocaleString('ru-RU')} руб</div>
        </div>
    `;
    
    if (repair.notes && repair.notes.trim()) {
        html += `
            <div class="details-section">
                <div class="details-title">
                    <i class="fas fa-sticky-note"></i> Примечания
                </div>
                <div class="repair-notes">
                    ${repair.notes}
                </div>
            </div>
        `;
    }
    
    html += `
        <div class="repair-actions">
            <button class="btn btn-secondary edit-repair-btn" data-repair-id="${repair.id}">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        </div>
    `;
    
    return html;
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
    
    const saved = await saveCarDataToFirestore();
    showStatus(saved ? 'Ремонт успешно добавлен!' : 'Ошибка сохранения', saved ? 'success' : 'error');
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
    
    const saved = await saveCarDataToFirestore();
    showStatus(saved ? 'Ремонт успешно обновлен!' : 'Ошибка сохранения', saved ? 'success' : 'error');
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
    
    const saved = await saveCarDataToFirestore();
    showStatus(saved ? 'Ремонт успешно удален!' : 'Ошибка сохранения', saved ? 'success' : 'error');
}

// ==================== ФОРМЫ И СКРОЛЛИНГ ====================

function openAddForm() {
    toggleBackButton(true);
    resetAddForm();
    
    document.getElementById('addRepairForm').classList.add('active');
    document.getElementById('editRepairForm').classList.remove('active');
    document.getElementById('dataSection').style.display = 'none';
    
    scrollToForm('addRepairForm');
}

function openEditForm(repairId) {
    const car = carData[currentCar];
    const repair = car.repairs.find(r => r.id === repairId);
    
    if (!repair) return;
    
    toggleBackButton(true);
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
    
    scrollToForm('editRepairForm');
}

function closeAllForms() {
    document.getElementById('addRepairForm').classList.remove('active');
    document.getElementById('editRepairForm').classList.remove('active');
    document.getElementById('dataSection').style.display = 'block';
    resetAddForm();
    editingRepairId = null;
    isEditingAction = false;
    toggleBackButton(false);
    
    scrollToList();
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

function toggleBackButton(show) {
    const backButtons = document.querySelectorAll('.back-to-list-btn');
    backButtons.forEach(btn => {
        btn.style.display = show ? 'block' : 'none';
    });
}

function scrollToForm(formId) {
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const form = document.getElementById(formId);
            if (form) {
                form.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start'
                });
            }
        }, 100);
    }
}

function scrollToList() {
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const repairsContainer = document.getElementById('repairsContainer');
            if (repairsContainer) {
                repairsContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start'
                });
            }
        }, 100);
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

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
    
    updateSortButtons();
    updateRepairsCards();
}

function updateSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        const sortField = btn.getAttribute('data-sort');
        btn.classList.remove('active');
        
        if (sortField === currentSort) {
            btn.classList.add('active');
            
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

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);
            
            Object.keys(loadedData).forEach(carKey => {
                if (carData[carKey]) {
                    if (loadedData[carKey].repairs) {
                        if (!carData[carKey].repairs) {
                            carData[carKey].repairs = [];
                        }
                        
                        loadedData[carKey].repairs.forEach(newRepair => {
                            const exists = carData[carKey].repairs.some(r => r.id === newRepair.id);
                            if (!exists) {
                                carData[carKey].repairs.push(newRepair);
                            }
                        });
                        
                        if (loadedData[carKey].model) carData[carKey].model = loadedData[carKey].model;
                        if (loadedData[carKey].year) carData[carKey].year = loadedData[carKey].year;
                        if (loadedData[carKey].color) carData[carKey].color = loadedData[carKey].color;
                    }
                } else {
                    carData[carKey] = loadedData[carKey];
                }
            });
            
            searchTerm = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            expandedRepairId = null;
            
            updateCarInfo();
            updateRepairsCards();
            
            const saved = await saveAllCarDataToFirestore();
            showStatus(saved ? 'Данные успешно загружены из файла и сохранены!' : 'Ошибка сохранения', saved ? 'success' : 'error');
        } catch (error) {
            showStatus('Ошибка при чтении файла: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
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

function addSampleData() {
    const sampleData = {
        "focus": {
            "repairs": [
                {
                    "id": Date.now(),
                    "date": "01.08.2024",
                    "mileage": 125000,
                    "short_work": "Замена КПП",
                    "total_price": 33000,
                    "sto": "Альфатранс",
                    "work_items": [
                        {"name": "Замена коробки передач", "price": 20000},
                        {"name": "Замена масла КПП", "price": 3000}
                    ],
                    "part_items": [
                        {"name": "Коробка передач (БУ)", "manufacturer": "Ford", "article": "FOCUS-3-KPP", "quantity": 1, "price": 10000},
                        {"name": "Масло КПП", "manufacturer": "Liqui Moly", "article": "LM1234", "quantity": 2, "price": 5000}
                    ],
                    "notes": "КПП с пробегом 70 тыс. км"
                }
            ]
        }
    };
    
    document.getElementById('jsonInput').value = JSON.stringify(sampleData, null, 2);
    showStatus('Пример данных загружен в форму', 'success');
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
        let dataChanged = false;
        
        Object.keys(newData).forEach(carKey => {
            if (carData[carKey]) {
                if (newData[carKey].repairs && Array.isArray(newData[carKey].repairs)) {
                    if (!carData[carKey].repairs) {
                        carData[carKey].repairs = [];
                    }
                    
                    let repairsAdded = 0;
                    newData[carKey].repairs.forEach(newRepair => {
                        const exists = carData[carKey].repairs.some(r => 
                            r.id === newRepair.id || 
                            (r.date === newRepair.date && r.mileage === newRepair.mileage && r.short_work === newRepair.short_work)
                        );
                        if (!exists) {
                            carData[carKey].repairs.push(newRepair);
                            repairsAdded++;
                        }
                    });
                    
                    if (repairsAdded > 0) {
                        dataChanged = true;
                        console.log(`Добавлено ${repairsAdded} ремонтов для ${carKey}`);
                    }
                }
                
                if (newData[carKey].model) carData[carKey].model = newData[carKey].model;
                if (newData[carKey].year) carData[carKey].year = newData[carKey].year;
                if (newData[carKey].color) carData[carKey].color = newData[carKey].color;
                if (newData[carKey].totalSpent !== undefined) carData[carKey].totalSpent = newData[carKey].totalSpent;
                if (newData[carKey].totalRepairs !== undefined) carData[carKey].totalRepairs = newData[carKey].totalRepairs;
                if (newData[carKey].lastRepair) carData[carKey].lastRepair = newData[carKey].lastRepair;
                
            } else {
                carData[carKey] = newData[carKey];
                dataChanged = true;
                console.log(`Создан новый автомобиль: ${carKey}`);
            }
        });
        
        jsonInput.value = '';
        
        if (dataChanged) {
            updateCarInfo();
            updateRepairsCards();
            
            const saved = await saveAllCarDataToFirestore();
            showStatus(saved ? 'Данные успешно объединены и сохранены!' : 'Ошибка сохранения', saved ? 'success' : 'error');
        } else {
            showStatus('Нет новых данных для добавления', 'info');
        }
        
    } catch (error) {
        console.error('Ошибка при парсинге JSON:', error);
        showStatus('Ошибка при парсинге JSON: ' + error.message, 'error');
    }
}

function toggleStructure() {
    const content = document.getElementById('structureContent');
    const chevron = document.getElementById('structureChevron');
    
    if (!content || !chevron) return;
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        content.classList.add('show');
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-up');
    } else {
        content.style.display = 'none';
        content.classList.remove('show');
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
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
