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

// ==================== АУТЕНТИФИКАЦИЯ ====================

function showAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'block';
    document.getElementById('authStatus').textContent = '';
    document.getElementById('loginEmail').value = 'admin@autos.ru';
    document.getElementById('loginPassword').value = 'admin123';
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
    isEditingAction = false;
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const statusEl = document.getElementById('authStatus');
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        isGuestMode = false;
        
        statusEl.textContent = 'Вход выполнен успешно!';
        statusEl.className = 'status-message status-success';
        
        // Обновляем интерфейс
        updateUIForAuthState();
        
        setTimeout(() => {
            hideAuthModal();
            showStatus('Авторизация прошла успешно!', 'success');
            
            // Если была попытка редактирования, открываем соответствующую форму
            if (isEditingAction) {
                if (editingRepairId) {
                    openEditForm(editingRepairId);
                } else {
                    document.getElementById('addRepairForm').classList.add('active');
                    document.getElementById('editRepairForm').classList.remove('active');
                    document.getElementById('dataSection').style.display = 'none';
                    resetAddForm();
                }
            }
        }, 1000);
        
    } catch (error) {
        statusEl.textContent = getErrorMessage(error);
        statusEl.className = 'status-message status-error';
    }
}

function logoutUser() {
    auth.signOut();
}

function checkAuthBeforeEdit(actionCallback, repairId = null) {
    if (isGuestMode) {
        isEditingAction = true;
        editingRepairId = repairId;
        showAuthModal();
    } else {
        actionCallback();
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
        modeText.textContent = 'Гостевой режим';
        userInfo.textContent = 'Гостевой доступ';
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

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

async function loadCarData() {
    try {
        // Пробуем загрузить из localStorage
        const savedData = localStorage.getItem('myCarsData');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                carData = mergeCarData(carData, parsedData);
            } catch (e) {
                console.error('Ошибка парсинга сохраненных данных:', e);
            }
        }
        
        // Если пользователь авторизован, загружаем из Firebase
        if (!isGuestMode && currentUser) {
            const carsRef = db.collection('userCars').doc(currentUser.uid);
            const carsDoc = await carsRef.get();
            
            if (carsDoc.exists) {
                const data = carsDoc.data();
                if (data.carData) {
                    carData = mergeCarData(data.carData, carData);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showStatus('Ошибка загрузки данных. Используются локальные данные.', 'warning');
        return false;
    }
}

function mergeCarData(primaryData, secondaryData) {
    const merged = { ...primaryData };
    
    Object.keys(secondaryData).forEach(carKey => {
        if (!merged[carKey]) {
            merged[carKey] = secondaryData[carKey];
        } else if (secondaryData[carKey].repairs) {
            // Объединяем ремонты
            secondaryData[carKey].repairs.forEach(newRepair => {
                const exists = merged[carKey].repairs.some(r => r.id === newRepair.id);
                if (!exists) {
                    merged[carKey].repairs.push(newRepair);
                }
            });
        }
    });
    
    return merged;
}

async function saveCarData() {
    try {
        // Сохраняем локально
        localStorage.setItem('myCarsData', JSON.stringify(carData));
        
        // Если пользователь авторизован, сохраняем в Firebase
        if (!isGuestMode && currentUser) {
            await db.collection('userCars').doc(currentUser.uid).set({
                email: currentUser.email,
                carData: carData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        showStatus('Данные сохранены локально.', 'warning');
        return false;
    }
}

// ==================== УПРАВЛЕНИЕ ТЕМОЙ ====================

function switchTheme(theme, saveToServer = true) {
    // Удаляем текущие классы темы
    document.body.classList.remove('theme-arch', 'theme-rosepine');
    
    // Добавляем новый класс темы
    document.body.classList.add(`theme-${theme}`);
    
    // Обновляем активную кнопку
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.theme-btn[data-theme="${theme}"]`).classList.add('active');
    
    // Обновляем текст футера
    const themeName = theme === 'arch' ? 'Arch Linux' : 'Rosé Pine';
    document.getElementById('themeName').textContent = themeName;
    
    // Сохраняем тему локально
    localStorage.setItem('myCarsTheme', theme);
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('myCarsTheme') || 'arch';
    switchTheme(savedTheme, false);
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

document.addEventListener('DOMContentLoaded', function() {
    // Загружаем сохраненную тему
    loadSavedTheme();
    
    // Инициализируем приложение в гостевом режиме
    initApp();
    
    // Отслеживаем состояние аутентификации
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isGuestMode = false;
        } else {
            currentUser = null;
            isGuestMode = true;
        }
        updateUIForAuthState();
    });
    
    // Обработчики событий аутентификации
    document.getElementById('loginBtn').addEventListener('click', loginUser);
    document.getElementById('cancelAuthBtn').addEventListener('click', hideAuthModal);
    document.getElementById('loginBtnMain').addEventListener('click', showAuthModal);
    document.getElementById('logoutBtn').addEventListener('click', logoutUser);
    
    // Закрытие модального окна при клике вне его
    document.getElementById('authModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideAuthModal();
        }
    });
});

function initApp() {
    loadCarData().then(() => {
        updateCarInfo();
        updateRepairsTable();
        updateCarStatsDisplay();
        setSortIndicator('date', 'desc');
        setupEventListeners();
    });
    
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
}

function setupEventListeners() {
    // Переключение темы
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            switchTheme(theme);
        });
    });
    
    // Выбор автомобиля
    document.querySelectorAll('.car-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.car-option').forEach(opt => {
                opt.classList.remove('active');
            });
            this.classList.add('active');
            currentCar = this.getAttribute('data-car');
            updateCarInfo();
            updateCarStatsDisplay();
            updateRepairsTable();
            expandedRepairId = null;
            closeAllForms();
        });
    });
    
    // Поиск
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {
        performSearch(this.value);
    });
    
    document.getElementById('clearSearchBtn').addEventListener('click', function() {
        searchInput.value = '';
        performSearch('');
    });

    // Сворачивание блока информации об авто
    const toggleHeader = document.querySelector('.car-info-header');
    if (toggleHeader) {
        toggleHeader.addEventListener('click', function() {
            const carStats = document.getElementById('carStats');
            const icon = this.querySelector('.fa-chevron-down');
            
            if (carStats.classList.contains('collapsed')) {
                // Разворачиваем
                carStats.classList.remove('collapsed');
                if (icon) icon.style.transform = 'rotate(0deg)';
                localStorage.setItem('carStatsCollapsed', 'false');
            } else {
                // Сворачиваем
                carStats.classList.add('collapsed');
                if (icon) icon.style.transform = 'rotate(-90deg)';
                localStorage.setItem('carStatsCollapsed', 'true');
            }
        });
    }
    
    // Кнопки ремонтов с проверкой авторизации
    document.getElementById('addRepairBtn').addEventListener('click', function() {
        checkAuthBeforeEdit(function() {
            document.getElementById('addRepairForm').classList.add('active');
            document.getElementById('editRepairForm').classList.remove('active');
            document.getElementById('dataSection').style.display = 'none';
            resetAddForm();
        });
    });
    
    document.getElementById('saveRepairBtn').addEventListener('click', saveRepair);
    document.getElementById('cancelRepairBtn').addEventListener('click', closeAllForms);
    document.getElementById('updateRepairBtn').addEventListener('click', updateRepair);
    document.getElementById('cancelEditBtn').addEventListener('click', closeAllForms);
    document.getElementById('deleteRepairBtn').addEventListener('click', deleteRepair);
    
    // Файловые операции
    document.getElementById('saveToFileBtn').addEventListener('click', saveToFile);
    document.getElementById('loadFromFileBtn').addEventListener('click', function() {
        checkAuthBeforeEdit(function() {
            document.getElementById('fileInput').click();
        });
    });
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
    document.getElementById('addSampleDataBtn').addEventListener('click', function() {
        checkAuthBeforeEdit(addSampleData);
    });
    document.getElementById('mergeDataBtn').addEventListener('click', function() {
        checkAuthBeforeEdit(mergeData);
    });
    
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    
    // Сортировка таблицы
    document.querySelectorAll('.repairs-table th[data-sort]').forEach(th => {
        th.addEventListener('click', function() {
            const sortField = this.getAttribute('data-sort');
            sortTable(sortField);
        });
    });
    
    // Структура данных
    document.getElementById('toggleStructureBtn').addEventListener('click', toggleStructure);
}

// ==================== ФУНКЦИИ РЕМОНТОВ ====================

function updateCarInfo() {
    const car = carData[currentCar];
    car.totalRepairs = car.repairs.length;
    car.totalSpent = car.repairs.reduce((sum, repair) => sum + repair.total_price, 0);
    
    if (car.repairs.length > 0) {
        const sortedRepairs = [...car.repairs].sort((a, b) => parseDate(b.date) - parseDate(a.date));
        car.lastRepair = sortedRepairs[0].date;
    } else {
        car.lastRepair = '';
    }
    
    saveCarData();
    updateCarStatsDisplay();
}

function updateCarStatsDisplay() {
    const car = carData[currentCar];
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
    
    let filteredRepairs = [...car.repairs];
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredRepairs = car.repairs.filter(repair => {
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
    
    if (searchTerm) {
        searchResultsInfo.classList.remove('hidden');
        resultsCount.textContent = filteredRepairs.length;
        currentSearchTerm.textContent = searchTerm;
    } else {
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
                checkAuthBeforeEdit(function() {
                    openEditForm(repairId);
                }, repairId);
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
    const mileage = parseInt(document.getElementById('repairMileage').value);
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
    const mileage = parseInt(document.getElementById('editRepairMileage').value);
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
}

function resetAddForm() {
    document.getElementById('repairDate').value = '';
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
                    carData[carKey].repairs.push(repair);
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
            Object.keys(loadedData).forEach(carKey => {
                if (!carData[carKey]) {
                    carData[carKey] = loadedData[carKey];
                } else if (loadedData[carKey].repairs) {
                    loadedData[carKey].repairs.forEach(newRepair => {
                        const exists = carData[carKey].repairs.some(r => r.id === newRepair.id);
                        if (!exists) {
                            carData[carKey].repairs.push(newRepair);
                        }
                    });
                }
            });
            
            searchTerm = '';
            document.getElementById('searchInput').value = '';
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
    const jsonInput = document.getElementById('jsonInput').value.trim();
    
    if (!jsonInput) {
        showStatus('Введите JSON данные для объединения', 'error');
        return;
    }
    
    try {
        const newData = JSON.parse(jsonInput);
        
        Object.keys(newData).forEach(carKey => {
            if (!carData[carKey]) {
                carData[carKey] = {
                    model: "Неизвестно",
                    year: 0,
                    color: "",
                    totalSpent: 0,
                    totalRepairs: 0,
                    lastRepair: "",
                    repairs: []
                };
            }
            
            if (newData[carKey].repairs && Array.isArray(newData[carKey].repairs)) {
                newData[carKey].repairs.forEach(newRepair => {
                    const existingIndex = carData[carKey].repairs.findIndex(r => r.id === newRepair.id);
                    if (existingIndex !== -1) {
                        carData[carKey].repairs[existingIndex] = newRepair;
                    } else {
                        carData[carKey].repairs.push(newRepair);
                    }
                });
            }
            
            Object.keys(newData[carKey]).forEach(key => {
                if (key !== 'repairs' && !Array.isArray(newData[carKey][key])) {
                    carData[carKey][key] = newData[carKey][key];
                }
            });
        });
        
        document.getElementById('jsonInput').value = '';
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
    document.getElementById('currentStructure').textContent = JSON.stringify(carData, null, 2);
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
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