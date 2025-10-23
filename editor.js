/**
 * Редактор позиций полей для KKT PDF
 * 
 * Флаг отключения редактора:
 * - Установите EDITOR_ENABLED = false для полного отключения редактора
 * - При отключении кнопка "Редактор позиций" будет скрыта
 * - Все функции редактора будут недоступны
 */

// ===== КОНФИГУРАЦИЯ =====
const EDITOR_ENABLED = true; // Установите false для отключения редактора

// ===== ПЕРЕМЕННЫЕ РЕДАКТОРА =====
// editorMode и currentElement объявлены в app.js
let draggedElement = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let originalPositions = {};
let positionHistory = [];
let currentHistoryIndex = -1;
let lastMousePosition = { x: 100, y: 150 };

// ===== ОСНОВНЫЕ ФУНКЦИИ РЕДАКТОРА =====

/**
 * Переключение режима редактора
 */
function toggleEditorMode() {
  if (!EDITOR_ENABLED) {
    console.warn('Редактор позиций отключен в конфигурации');
    return;
  }

  editorMode = !editorMode;
  
  if (editorMode) {
    // Включаем режим редактора
    document.body.classList.add('editor-mode');
    toggleEditorBtn.textContent = 'Закрыть редактор';
    
    // Показываем панель редактора с анимацией
    const positionEditor = document.getElementById('positionEditor');
    if (positionEditor) {
      positionEditor.style.display = 'flex';
      // Небольшая задержка для анимации
      setTimeout(() => {
        positionEditor.classList.add('position-editor--sidebar');
      }, 10);
    }
    
    initializeAdvancedEditor();
    saveOriginalPositions();
    // Перерисовываем поля с названиями
    updatePreview();
  } else {
    // Выключаем режим редактора
    document.body.classList.remove('editor-mode');
    toggleEditorBtn.textContent = 'Редактор позиций';
    
    // Скрываем панель редактора с анимацией
    const positionEditor = document.getElementById('positionEditor');
    if (positionEditor) {
      positionEditor.classList.remove('position-editor--sidebar');
      setTimeout(() => {
        positionEditor.style.display = 'none';
      }, 300); // Время анимации
    }
    
    cleanupAdvancedEditor();
    // Перерисовываем поля без названий
    updatePreview();
  }
}

/**
 * Инициализация продвинутого редактора
 */
function initializeAdvancedEditor() {
  if (!EDITOR_ENABLED) return;

  logger.debug('=== ИНИЦИАЛИЗАЦИЯ РЕДАКТОРА ===', 'editor');
  logger.debug('Режим редактора активен:', editorMode, 'editor');
  
  // Создаем список полей
  createFieldList();
  
  // Создаем точные контролы (если их еще нет)
  if (!document.getElementById('preciseControls')) {
    createPreciseControls();
  }
  
  // Добавляем визуальную сетку
  addVisualGrid();
  
  // Добавляем обработчик для отслеживания позиции курсора мыши
  // Работаем с текущей страницей
  const currentPageElement = window.pageElements[window.currentPage];
  if (currentPageElement) {
    const canvas = currentPageElement.querySelector('.sheet__canvas');
    if (canvas) {
      canvas.addEventListener('mousemove', function(e) {
        // Получаем позицию курсора относительно canvas
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Конвертируем в мм (96 DPI)
        const xMm = (x / 96) * 25.4;
        const yMm = (y / 96) * 25.4;
        
        lastMousePosition = { x: xMm, y: yMm };
      });
      
      canvas.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('overlay-char')) {
          startDrag(e);
        }
      });
    }
  }
  
  // Добавляем обработчики для кнопок редактора
  const addFieldBtn = document.getElementById('addFieldBtn');
  if (addFieldBtn) {
    addFieldBtn.addEventListener('click', createNewField);
  }
  
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn && !undoBtn.hasAttribute('data-listener-attached')) {
    console.log('Прикрепляем обработчик к кнопке отмены');
    undoBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('Кнопка отмены нажата!');
      console.log('Вызываем undoPosition...');
      console.log('undoPosition определена:', typeof undoPosition);
      try {
        undoPosition();
        console.log('undoPosition завершена успешно');
      } catch (error) {
        console.error('Ошибка в undoPosition:', error);
      }
      return false;
    });
    undoBtn.setAttribute('data-listener-attached', 'true');
  } else if (undoBtn) {
    console.log('Обработчик кнопки отмены уже прикреплен');
  } else {
    console.log('Кнопка отмены не найдена!');
  }
  
  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn && !redoBtn.hasAttribute('data-listener-attached')) {
    console.log('Прикрепляем обработчик к кнопке повтора');
    redoBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('Кнопка повтора нажата!');
      console.log('Вызываем redoPosition...');
      console.log('redoPosition определена:', typeof redoPosition);
      try {
        redoPosition();
        console.log('redoPosition завершена успешно');
      } catch (error) {
        console.error('Ошибка в redoPosition:', error);
      }
      return false;
    });
    redoBtn.setAttribute('data-listener-attached', 'true');
  } else if (redoBtn) {
    console.log('Обработчик кнопки повтора уже прикреплен');
  } else {
    console.log('Кнопка повтора не найдена!');
  }
  
  const savePositionsBtn = document.getElementById('savePositions');
  if (savePositionsBtn) {
    savePositionsBtn.addEventListener('click', savePositions);
  }
  
  const resetPositionsBtn = document.getElementById('resetPositions');
  if (resetPositionsBtn) {
    resetPositionsBtn.addEventListener('click', resetPositions);
  }
  
  // Сохраняем начальное состояние в историю
  savePositionToHistory();
}

/**
 * Очистка редактора
 */
function cleanupAdvancedEditor() {
  if (!EDITOR_ENABLED) return;

  // Сохраняем текущие позиции перед закрытием
  saveCurrentPositions();
  
  // Удаляем все обработчики и элементы редактора
  removeDraggableListeners();
  removeVisualGrid();
  removeFieldList();
  removePreciseControls();
  removeKeyboardListeners();
  removeEditorButtonListeners();
}

// ===== ФУНКЦИИ УПРАВЛЕНИЯ ПОЗИЦИЯМИ =====

/**
 * Сохранение текущих позиций в исходные данные
 */
function saveCurrentPositions() {
  if (!EDITOR_ENABLED) return;

  // Собираем все элементы полей со всех страниц
  const allElements = [];
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      const pageElements = canvas.querySelectorAll('.overlay-char');
      allElements.push(...pageElements);
    }
  });

  // Группируем элементы по полям
  const fieldGroups = groupElementsByField(allElements);
  
  // Сохраняем позиции для каждого поля
  Object.keys(fieldGroups).forEach(fieldType => {
    const elements = fieldGroups[fieldType];
    if (elements.length > 0) {
      const firstElement = elements[0];
      const left = parseFloat(firstElement.style.left) || 0;
      const top = parseFloat(firstElement.style.top) || 0;
      
      // Определяем тип поля по названию, тексту и позиции
      let fieldType = 'unknown';
      
      // Определяем поле по data-field-name
      const fieldName = firstElement.getAttribute('data-field-name');
      if (fieldName) {
        fieldType = fieldName;
      } else {
        // Определяем поле по позиции символа
        if (left >= 70 && left <= 90 && top >= 15 && top <= 25) {
          fieldType = 'ОГРН';
        } else if (left >= 70 && left <= 90 && top >= 25 && top <= 35) {
          fieldType = 'ИНН';
        } else if (left >= 70 && left <= 90 && top >= 35 && top <= 45) {
          fieldType = 'КПП';
        }
      }
      
      // Сохраняем позицию
      originalPositions[fieldType] = { left, top, elements };
    }
  });
}

/**
 * Группировка элементов по полям
 */
function groupElementsByField(elements) {
  const groups = {};
  
  elements.forEach(element => {
    const fieldName = element.getAttribute('data-field-name');
    let groupKey = fieldName || 'unknown';
    
    // Для полей без data-field-name группируем по позиции
    if (!fieldName) {
      const left = parseFloat(element.style.left) || 0;
      const top = parseFloat(element.style.top) || 0;
      
      // Группируем по близким позициям (в пределах 5мм)
      const foundGroup = Object.keys(groups).find(key => {
        if (groups[key].length === 0) return false;
        const firstElement = groups[key][0];
        const firstLeft = parseFloat(firstElement.style.left) || 0;
        const firstTop = parseFloat(firstElement.style.top) || 0;
        
        return Math.abs(left - firstLeft) < 5 && Math.abs(top - firstTop) < 5;
      });
      
      if (foundGroup) {
        groupKey = foundGroup;
      } else {
        groupKey = `field_${left}_${top}`;
      }
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(element);
  });
  
  logger.debug('Результат группировки:', groups, 'editor');
  return groups;
}

// ===== ФУНКЦИИ ПЕРЕТАСКИВАНИЯ =====

/**
 * Начало перетаскивания
 */
function startDrag(e) {
  if (!EDITOR_ENABLED) return;

  e.preventDefault();
  draggedElement = e.target;
  isDragging = true;
  
  // Получаем смещение курсора относительно элемента
  const rect = draggedElement.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  
  // Находим группу элементов для перетаскивания
  if (draggedElement.classList.contains('overlay-char')) {
    const fieldName = draggedElement.getAttribute('data-field-name');
    if (fieldName) {
      // Ищем все элементы с тем же data-field-name
      const allElements = [];
      Object.values(window.pageElements).forEach(pageElement => {
        const canvas = pageElement.querySelector('.sheet__canvas');
        if (canvas) {
          const pageElements = canvas.querySelectorAll(`.overlay-char[data-field-name="${fieldName}"]`);
          allElements.push(...pageElements);
        }
      });
      
      // Сохраняем начальные позиции всех элементов группы
      const startPositions = allElements.map(element => ({
        element,
        left: parseFloat(element.style.left) || 0,
        top: parseFloat(element.style.top) || 0
      }));
      
      // Добавляем обработчики для перетаскивания
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
      
      // Сохраняем данные для обработки
      draggedElement._dragData = {
        allElements,
        startPositions,
        fieldName
      };
    }
  }
}

/**
 * Обработка перетаскивания
 */
function handleDrag(e) {
  if (!EDITOR_ENABLED || !isDragging || !draggedElement) return;

  e.preventDefault();
  
  const dragData = draggedElement._dragData;
  if (!dragData) return;
  
  const { allElements, startPositions } = dragData;
  
  // Получаем canvas текущей страницы
  const currentPageElement = window.pageElements[window.currentPage];
  if (!currentPageElement) return;
  
  const canvas = currentPageElement.querySelector('.sheet__canvas');
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const newX = e.clientX - rect.left - dragOffset.x;
  const newY = e.clientY - rect.top - dragOffset.y;
  
  // Конвертируем в мм
  const newLeftMm = (newX / 96) * 25.4;
  const newTopMm = (newY / 96) * 25.4;
  
  // Вычисляем смещение от начальной позиции первого элемента
  const firstElement = allElements[0];
  const firstStartPos = startPositions[0];
  if (!firstElement || !firstStartPos) return;
  
  const deltaX = newLeftMm - firstStartPos.left;
  const deltaY = newTopMm - firstStartPos.top;
  
  // Обновляем позиции всех элементов группы с сохранением относительных позиций
  allElements.forEach((element, index) => {
    const startPos = startPositions[index];
    if (startPos) {
      const newLeft = startPos.left + deltaX;
      const newTop = startPos.top + deltaY;
      
      element.style.left = newLeft + 'mm';
      element.style.top = newTop + 'mm';
      
      // Обновляем позицию названия поля только для первого элемента
      if (index === 0) {
        updateFieldNamePosition(element, newLeft, newTop);
      }
    }
  });
}

/**
 * Остановка перетаскивания
 */
function stopDrag(e) {
  if (!EDITOR_ENABLED || !isDragging) return;

  isDragging = false;
  
  if (draggedElement && draggedElement._dragData) {
    // Сохраняем позиции в историю
    savePositionToHistory();
    
    // Очищаем данные перетаскивания
    delete draggedElement._dragData;
  }
  
  draggedElement = null;
  
  // Удаляем обработчики
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// ===== ФУНКЦИИ УПРАВЛЕНИЯ ЭЛЕМЕНТАМИ =====

/**
 * Создание списка полей
 */
function createFieldList() {
  if (!EDITOR_ENABLED) return;

  // Создаем контейнер для списка полей
  let fieldList = document.getElementById('fieldList');
  if (!fieldList) {
    fieldList = document.createElement('div');
    fieldList.id = 'fieldList';
    fieldList.className = 'field-list';
    fieldList.innerHTML = `
      <h4>Поля документа</h4>
      <div class="field-items"></div>
    `;
    
    // Добавляем в контент панели редактора
    const positionEditor = document.getElementById('positionEditor');
    const editorContent = positionEditor.querySelector('.editor-content');
    if (editorContent) {
      editorContent.appendChild(fieldList);
    } else if (positionEditor) {
      positionEditor.appendChild(fieldList);
    }
  }
  
  // Обновляем список полей
  updateFieldList();
}

/**
 * Обновление списка полей
 */
function updateFieldList() {
  if (!EDITOR_ENABLED) return;

  const fieldList = document.getElementById('fieldList');
  if (!fieldList) return;
  
  const fieldItems = fieldList.querySelector('.field-items');
  if (!fieldItems) return;
  
  // Собираем все элементы со всех страниц
  const allElements = [];
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      const pageElements = canvas.querySelectorAll('.overlay-text, .overlay-char');
      allElements.push(...pageElements);
    }
  });
  
  // Группируем элементы по полям
  const fieldGroups = groupElementsByField(allElements);
  
  // Очищаем список
  fieldItems.innerHTML = '';
  
  // Создаем элемент списка для каждой группы полей
  Object.keys(fieldGroups).forEach((groupKey, groupIndex) => {
    const elements = fieldGroups[groupKey];
    if (elements.length === 0) return;
    
    const firstElement = elements[0];
    const fieldName = firstElement.getAttribute('data-field-name') || groupKey;
    const fieldText = firstElement.textContent || '';
    
    const item = document.createElement('div');
    item.className = 'field-item';
    item.innerHTML = `
      <div class="field-item-name">
        <div style="font-weight: 600; color: var(--text); line-height: 1.2;">${fieldName}</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.2;">${fieldText} • ${elements.length} элементов</div>
      </div>
      <button type="button" class="field-delete-btn" data-action="delete" data-group="${groupKey}" title="Удалить поле">×</button>
    `;
    
    // Добавляем обработчики
    const deleteBtn = item.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteFieldGroup(groupKey));
    }
    
    // Добавляем иконку для новых полей
    if (firstElement.dataset.isNewField === 'true') {
      const icon = document.createElement('span');
      icon.className = 'field-icon new-field';
      icon.textContent = '🆕';
      item.querySelector('.field-info').prepend(icon);
    }
    
    fieldItems.appendChild(item);
  });
}

/**
 * Удаление группы полей
 */
function deleteFieldGroup(groupKey) {
  if (!EDITOR_ENABLED) return;

  // Собираем все элементы со всех страниц
  const allElements = [];
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      const pageElements = canvas.querySelectorAll('.overlay-text, .overlay-char');
      allElements.push(...pageElements);
    }
  });
  
  const fieldGroups = groupElementsByField(allElements);
  const elements = fieldGroups[groupKey];
  
  if (elements && elements.length > 0) {
    // Удаляем все элементы группы
    elements.forEach(element => {
      element.remove();
    });
    
    // Обновляем список полей
    updateFieldList();
    
    // Сохраняем позиции в историю
    savePositionToHistory();
  }
}

/**
 * Создание нового поля
 */
function createNewField() {
  if (!EDITOR_ENABLED) {
    console.warn('Редактор позиций отключен в конфигурации');
    return;
  }

  console.log('=== СОЗДАНИЕ НОВОГО ПОЛЯ ===');
  console.log('Текущая страница:', window.currentPage);
  console.log('Позиция курсора:', lastMousePosition);

  const fieldName = prompt('Введите название поля:');
  if (!fieldName) {
    console.log('Пользователь отменил ввод названия поля');
    return;
  }
  
  const fieldValue = prompt('Введите значение поля:');
  if (!fieldValue) {
    console.log('Пользователь отменил ввод значения поля');
    return;
  }
  
  console.log('Создаем поле:', fieldName, 'со значением:', fieldValue);
  
  // Используем последнюю позицию курсора мыши
  const xPosition = lastMousePosition.x;
  const yPosition = lastMousePosition.y;
  
  console.log('Позиция для размещения:', xPosition, yPosition);
  
  // Создаем новое поле на текущей странице
  placeChars(window.currentPage, xPosition, yPosition, fieldValue, CELL_WIDTH_MM, CELL_GAP_MM, { 
    color: '#000', 
    fieldName: fieldName,
    isNewField: true
  });
  
  console.log('Поле создано, обновляем список...');
  
  // Обновляем список полей
  updateFieldList();
  
  // Сохраняем позиции в историю
  savePositionToHistory();
  
  console.log('=== СОЗДАНИЕ ПОЛЯ ЗАВЕРШЕНО ===');
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

/**
 * Добавление визуальной сетки
 */
function addVisualGrid() {
  if (!EDITOR_ENABLED) return;

  const currentPageElement = window.pageElements[window.currentPage];
  if (!currentPageElement) return;
  
  const canvas = currentPageElement.querySelector('.sheet__canvas');
  if (!canvas) return;
  
  // Удаляем существующую сетку
  removeVisualGrid();
  
  const grid = document.createElement('div');
  grid.className = 'visual-grid';
  grid.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background-image: 
      linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px);
    background-size: 3.78mm 3.78mm;
    opacity: 0.3;
  `;
  canvas.appendChild(grid);
}

/**
 * Удаление визуальной сетки
 */
function removeVisualGrid() {
  if (!EDITOR_ENABLED) return;

  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      canvas.querySelectorAll('.visual-grid').forEach(grid => grid.remove());
    }
  });
}

/**
 * Удаление списка полей
 */
function removeFieldList() {
  if (!EDITOR_ENABLED) return;

  const fieldList = document.getElementById('fieldList');
  if (fieldList) {
    fieldList.remove();
  }
}

/**
 * Удаление точных контролов
 */
function removePreciseControls() {
  if (!EDITOR_ENABLED) return;

  const controls = document.getElementById('preciseControls');
  if (controls) {
    controls.remove();
  }
}

/**
 * Удаление обработчиков перетаскивания
 */
function removeDraggableListeners() {
  if (!EDITOR_ENABLED) return;

  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
}

/**
 * Удаление клавиатурных обработчиков
 */
function removeKeyboardListeners() {
  if (!EDITOR_ENABLED) return;

  document.removeEventListener('keydown', handleKeyboard);
}

/**
 * Удаление обработчиков кнопок редактора
 */
function removeEditorButtonListeners() {
  if (!EDITOR_ENABLED) return;

  const addFieldBtn = document.getElementById('addFieldBtn');
  if (addFieldBtn) {
    addFieldBtn.removeEventListener('click', createNewField);
  }
  
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) {
    undoBtn.removeEventListener('click', undoPosition);
  }
  
  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn) {
    redoBtn.removeEventListener('click', redoPosition);
  }
  
  const savePositionsBtn = document.getElementById('savePositions');
  if (savePositionsBtn) {
    savePositionsBtn.removeEventListener('click', savePositions);
  }
  
  const resetPositionsBtn = document.getElementById('resetPositions');
  if (resetPositionsBtn) {
    resetPositionsBtn.removeEventListener('click', resetPositions);
  }
}

/**
 * Обработка клавиатуры
 */
function handleKeyboard(e) {
  if (!EDITOR_ENABLED) return;

  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'z':
        e.preventDefault();
        undoPosition();
        break;
      case 'y':
        e.preventDefault();
        redoPosition();
        break;
    }
  }
}

// ===== ИСТОРИЯ ПОЗИЦИЙ =====

/**
 * Сохранение позиций в историю
 */
function savePositionToHistory() {
  if (!EDITOR_ENABLED) return;

  console.log('=== СОХРАНЕНИЕ В ИСТОРИЮ ===');

  // Собираем текущие позиции всех элементов со всех страниц
  const positions = {};
  let elementIndex = 0;
  
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      const elements = canvas.querySelectorAll('.overlay-char, .overlay-text');
      elements.forEach((element) => {
        const left = parseFloat(element.style.left) || 0;
        const top = parseFloat(element.style.top) || 0;
        const fieldName = element.getAttribute('data-field-name') || '';
        const page = getElementPage(element);
        
        positions[elementIndex] = { 
          left, 
          top, 
          fieldName,
          page,
          text: element.textContent || ''
        };
        elementIndex++;
      });
    }
  });
  
  console.log('Найдено элементов для сохранения:', elementIndex);
  console.log('Позиции для сохранения:', positions);
  
  // Удаляем позиции после текущего индекса (если мы не в конце истории)
  if (currentHistoryIndex < positionHistory.length - 1) {
    positionHistory = positionHistory.slice(0, currentHistoryIndex + 1);
  }
  
  // Добавляем новую позицию
  positionHistory.push(positions);
  currentHistoryIndex = positionHistory.length - 1;
  
  console.log('Новый индекс истории:', currentHistoryIndex);
  console.log('Размер истории:', positionHistory.length);
  
  // Ограничиваем размер истории
  if (positionHistory.length > 50) {
    positionHistory.shift();
    currentHistoryIndex--;
  }
  
  console.log('=== СОХРАНЕНИЕ ЗАВЕРШЕНО ===');
}

/**
 * Отмена последнего действия
 */
function undoPosition() {
  console.log('=== ФУНКЦИЯ undoPosition ВЫЗВАНА ===');
  console.log('=== НАЧАЛО ОТМЕНЫ ===');
  console.log('EDITOR_ENABLED:', EDITOR_ENABLED);
  console.log('EDITOR_ENABLED тип:', typeof EDITOR_ENABLED);
  console.log('Проверяем условие EDITOR_ENABLED...');
  
  if (!EDITOR_ENABLED) {
    console.log('Редактор отключен, выходим');
    return;
  }

  console.log('Редактор включен, продолжаем...');
  console.log('=== ОТМЕНА ДЕЙСТВИЯ ===');
  console.log('Текущий индекс истории:', currentHistoryIndex);
  console.log('Размер истории:', positionHistory.length);
  console.log('pageElements доступны:', typeof window.pageElements !== 'undefined');
  console.log('Проверяем условие currentHistoryIndex > 0...');

  if (currentHistoryIndex > 0) {
    currentHistoryIndex--;
    const positions = positionHistory[currentHistoryIndex];
    console.log('Восстанавливаем позиции:', positions);
    
    restorePositionsFromHistory(positions);
    
    // Обновляем список полей
    updateFieldList();
    
    console.log('=== ОТМЕНА ЗАВЕРШЕНА ===');
  } else {
    console.log('Нет действий для отмены');
  }
}

/**
 * Повтор последнего действия
 */
function redoPosition() {
  console.log('=== ФУНКЦИЯ redoPosition ВЫЗВАНА ===');
  console.log('=== НАЧАЛО ПОВТОРА ===');
  console.log('EDITOR_ENABLED:', EDITOR_ENABLED);
  console.log('EDITOR_ENABLED тип:', typeof EDITOR_ENABLED);
  console.log('Проверяем условие EDITOR_ENABLED...');
  
  if (!EDITOR_ENABLED) {
    console.log('Редактор отключен, выходим');
    return;
  }

  console.log('Редактор включен, продолжаем...');
  console.log('=== ПОВТОР ДЕЙСТВИЯ ===');
  console.log('Текущий индекс истории:', currentHistoryIndex);
  console.log('Размер истории:', positionHistory.length);
  console.log('Проверяем условие currentHistoryIndex < positionHistory.length - 1...');

  if (currentHistoryIndex < positionHistory.length - 1) {
    currentHistoryIndex++;
    const positions = positionHistory[currentHistoryIndex];
    console.log('Восстанавливаем позиции:', positions);
    
    restorePositionsFromHistory(positions);
    
    // Обновляем список полей
    updateFieldList();
    
    console.log('=== ПОВТОР ЗАВЕРШЕН ===');
  } else {
    console.log('Нет действий для повтора');
  }
}

/**
 * Восстановление позиций из истории
 */
function restorePositionsFromHistory(positions) {
  if (!EDITOR_ENABLED) return;

  console.log('=== ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ ===');
  console.log('Полученные позиции:', positions);
  console.log('pageElements доступны:', typeof window.pageElements !== 'undefined');
  console.log('pageElements:', window.pageElements);

  // Сначала очищаем все элементы
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      canvas.querySelectorAll('.overlay-char, .overlay-text, .field-name-label').forEach(el => el.remove());
    }
  });

  let restoredCount = 0;

  // Восстанавливаем элементы из истории
  Object.values(positions).forEach((posData, index) => {
    if (posData && posData.left !== undefined && posData.top !== undefined) {
      const { left, top, fieldName, page, text } = posData;
      
      console.log(`Восстанавливаем элемент ${index}:`, { left, top, fieldName, page, text });
      
      // Создаем элемент на правильной странице
      const targetPageElement = window.pageElements[page];
      if (targetPageElement) {
        const canvas = targetPageElement.querySelector('.sheet__canvas');
        if (canvas) {
          // Создаем новый элемент
          const newElement = document.createElement('div');
          newElement.className = 'overlay-char';
          newElement.style.left = left + 'mm';
          newElement.style.top = top + 'mm';
          newElement.textContent = text || '';
          
          if (fieldName) {
            newElement.setAttribute('data-field-name', fieldName);
          }
          
          // Применяем стили
          Object.assign(newElement.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '4.32mm',
            height: '7mm',
            textAlign: 'center',
            boxSizing: 'border-box',
            zIndex: '15',
            position: 'absolute',
            pointerEvents: 'auto',
            cursor: 'move',
            fontSize: '18px',
            fontWeight: '700'
          });
          
          // Добавляем обработчики событий
          if (document.body.classList.contains('editor-mode')) {
            newElement.addEventListener('mousedown', function(e) {
              e.preventDefault();
              e.stopPropagation();
              startDrag(e);
            });
            
            newElement.addEventListener('mouseenter', showElementInfo);
            newElement.addEventListener('mouseleave', hideElementInfo);
          }
          
          canvas.appendChild(newElement);
          restoredCount++;
        }
      }
    }
  });

  console.log(`Восстановлено элементов: ${restoredCount}`);
  console.log('=== ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО ===');
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

/**
 * Инициализация редактора (вызывается из app.js)
 */
function initializeEditor() {
  if (!EDITOR_ENABLED) {
    // Скрываем кнопку редактора если он отключен
    const toggleEditorBtn = document.getElementById('toggleEditor');
    if (toggleEditorBtn) {
      toggleEditorBtn.style.display = 'none';
    }
    return;
  }
  
  // Добавляем обработчики событий
  const toggleEditorBtn = document.getElementById('toggleEditor');
  if (toggleEditorBtn) {
    toggleEditorBtn.addEventListener('click', toggleEditorMode);
  }
  
  // Добавляем клавиатурные обработчики
  document.addEventListener('keydown', handleKeyboard);
}

// ===== ФУНКЦИИ РЕНДЕРИНГА И ОВЕРЛЕЕВ =====

/**
 * Утилита для конвертации мм в CSS
 */
function mm(value) { 
  return `${value}mm`; 
}

/**
 * Размещение текста на странице
 */
function placeText(page, leftMm, topMm, text, style = {}) {
  const canvas = preview.querySelector('.unified-canvas');
  if (!canvas) return;
  
  // Вычисляем абсолютную позицию в едином документе
  const absoluteTopMm = topMm + (page - 1) * 297;
  
  // Создаем основной элемент поля
  const el = document.createElement('div');
  el.className = 'overlay-text';
  el.style.left = mm(leftMm);
  el.style.top = mm(absoluteTopMm);
  Object.assign(el.style, {
    zIndex: '15' // Убеждаемся, что текст виден поверх всех фонов
  }, style);
  el.textContent = text || '';
  
  // Устанавливаем атрибут data-page для фильтрации по страницам
  el.setAttribute('data-page', page);
  
  // Добавляем название поля над самим полем (только в режиме редактора)
  if (document.body.classList.contains('editor-mode') && style.fieldName) {
    const fieldName = style.fieldName;
    const nameLabel = document.createElement('div');
    nameLabel.className = 'field-name-label';
    nameLabel.textContent = fieldName;
    nameLabel.style.cssText = `
      position: absolute;
      left: ${mm(leftMm)};
      top: ${mm(topMm - 5)};
      font-size: 10px;
      color: #666;
      background: rgba(255, 255, 255, 0.8);
      padding: 2px 4px;
      border-radius: 2px;
      pointer-events: none;
      z-index: 1000;
    `;
    nameLabel.setAttribute('data-page', page);
    canvas.appendChild(nameLabel);
  }
  
  // Добавляем индикатор страницы (только в режиме редактора)
  if (document.body.classList.contains('editor-mode')) {
    const pageIndicator = document.createElement('div');
    pageIndicator.className = 'page-indicator';
    pageIndicator.textContent = page;
    el.appendChild(pageIndicator);
  }
  
  canvas.appendChild(el);
}

/**
 * Размещение символов на странице
 */
function placeChars(page, leftMm, topMm, text, cellWidthMm, gapMm, style = {}) {
  // Получаем canvas текущей страницы
  const currentPageElement = window.pageElements[page];
  if (!currentPageElement) {
    // Создаем страницу, если она еще не существует
    createPageElement(page);
  }
  
  const canvas = window.pageElements[page].querySelector('.sheet__canvas');
  if (!canvas) return;
  
  // Позиция относительно текущей страницы (без смещения)
  const s = (text || '').toString();
  
  // Извлекаем data-атрибуты из style объекта
  const dataAttributes = {};
  const styleProps = {};
  
  Object.keys(style).forEach(key => {
    if (key.startsWith('data-')) {
      dataAttributes[key] = style[key];
    } else if (key === 'fieldName') {
      // fieldName должен быть data-атрибутом
      dataAttributes['data-field-name'] = style[key];
    } else {
      styleProps[key] = style[key];
    }
  });
  
  // Добавляем название поля над самим полем (только в режиме редактора)
  if (document.body.classList.contains('editor-mode') && style.fieldName) {
    const fieldName = style.fieldName;
    const nameLabel = document.createElement('div');
    nameLabel.className = 'field-name-label';
    nameLabel.textContent = fieldName;
    nameLabel.style.cssText = `
      position: absolute;
      left: ${mm(leftMm)};
      top: ${mm(topMm - 5)};
      font-size: 10px;
      color: #666;
      background: rgba(255, 255, 255, 0.8);
      padding: 2px 4px;
      border-radius: 2px;
      pointer-events: none;
      z-index: 1000;
    `;
    nameLabel.setAttribute('data-page', page);
    canvas.appendChild(nameLabel);
  }
  
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const el = document.createElement('div');
    el.className = 'overlay-char';
    
    // Позиционирование символа в центре ячейки
    // Каждая ячейка имеет ширину cellWidthMm (4.32мм) и интервал gapMm (0мм) между ячейками
    // Расстояние между центрами ячеек = cellWidthMm + gapMm = 4.32мм
    const charLeft = leftMm + i * (cellWidthMm + gapMm);
    const charTop = topMm;
    
    el.style.left = mm(charLeft);
    el.style.top = mm(charTop);
    
    // Добавляем стили для центрирования в клетке
    Object.assign(el.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: mm(cellWidthMm), // 5мм ширина ячейки
      height: mm(CELL_HEIGHT_MM), // 7мм высота ячейки
      textAlign: 'center',
      boxSizing: 'border-box',
      zIndex: '10', // Убеждаемся, что текст виден поверх фоновых изображений
      position: 'absolute'
    }, styleProps);
    
    // Добавляем data-атрибуты
    Object.keys(dataAttributes).forEach(attr => {
      el.setAttribute(attr, dataAttributes[attr]);
    });
    
    // Устанавливаем атрибут data-page для фильтрации по страницам
    el.setAttribute('data-page', page);
    
    // Устанавливаем атрибут data-has-data на основе наличия данных
    if (style.hasData !== undefined) {
      el.setAttribute('data-has-data', style.hasData ? 'true' : 'false');
    } else {
      // По умолчанию, если не указано явно, считаем что данных нет
      el.setAttribute('data-has-data', 'false');
    }
    
    // Отладочная информация для новых полей
    if (style.fieldName) {
      logger.debug(`Создан элемент поля "${style.fieldName}":`, 'fields');
    }
    
    // Если установлен флаг noHighlight, убираем выделение
    if (style.noHighlight) {
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.classList.add('no-highlight');
    }
    
    el.textContent = ch;
    
    // Принудительно применяем стили
    el.style.setProperty('font-size', '18px', 'important');
    el.style.setProperty('font-weight', '700', 'important');
    el.style.setProperty('z-index', '15', 'important');
    
    // Применяем цвет из styleProps, если он указан
    if (styleProps.color) {
      el.style.setProperty('color', styleProps.color.replace('!important', ''), 'important');
    }
    
    // Отладочная информация
    logger.debug(`Создан элемент на странице ${page}:`, 'fields');
    
    // Добавляем индикатор страницы (только в режиме редактора)
    if (document.body.classList.contains('editor-mode')) {
      const pageIndicator = document.createElement('div');
      pageIndicator.className = 'page-indicator';
      pageIndicator.textContent = page;
      el.appendChild(pageIndicator);
    }
    
    canvas.appendChild(el);
    
    // Добавляем обработчики событий для перетаскивания (только в режиме редактора)
    if (document.body.classList.contains('editor-mode')) {
      // Убеждаемся, что элемент может получать события мыши
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'move';
      
      // Добавляем обработчик mousedown для перетаскивания
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        startDrag(e);
      });
      
      // Добавляем обработчики для показа информации
      el.addEventListener('mouseenter', showElementInfo);
      el.addEventListener('mouseleave', hideElementInfo);
    }
  }
}

/**
 * Очистка оверлеев
 */
function clearOverlays() {
  // Очищаем поля на всех страницах
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      canvas.querySelectorAll('.overlay-text, .overlay-char, .field-name-label').forEach(n => n.remove());
    }
  });
}

/**
 * Показ информации об элементе
 */
function showElementInfo(e) {
  if (!editorMode) return;
  
  const element = e.target;
  const left = parseFloat(element.style.left) || 0;
  const top = parseFloat(element.style.top) || 0;
  const fieldName = element.getAttribute('data-field-name') || 'Неизвестно';
  
  updateCoordinates(left, top);
  currentElement.textContent = element.textContent || element.dataset.field || 'Неизвестно';
}

/**
 * Скрытие информации об элементе
 */
function hideElementInfo() {
  if (!editorMode) return;
  currentElement.textContent = '-';
}

/**
 * Переприкрепление обработчиков событий к существующим элементам
 */
function reattachEventHandlersToExistingElements() {
  logger.debug('Переприкрепление обработчиков к существующим элементам...', 'editor');
  
  const canvas = document.querySelector('.unified-canvas');
  if (!canvas) {
    logger.warn('Canvas не найден для переприкрепления обработчиков', 'canvas');
    return;
  }
  
  const allElements = canvas.querySelectorAll('.overlay-char, .overlay-text');
  logger.debug(`Найдено ${allElements.length} элементов для переприкрепления обработчиков`, 'editor');
  
  allElements.forEach((element, index) => {
    // Удаляем старые обработчики (если есть)
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    
    // Прикрепляем новые обработчики
    if (newElement.classList.contains('overlay-char') || newElement.classList.contains('overlay-text')) {
      newElement.addEventListener('mousedown', function(e) {
        logger.debug('=== MOUSEDOWN EVENT TRIGGERED (reattached) ===', 'editor');
        logger.debug('Target element:', 'editor');
        logger.debug('Element text:', 'editor');
        logger.debug('Element field name:', 'editor');
        startDrag(e);
      });
      
      newElement.addEventListener('mouseenter', showElementInfo);
      newElement.addEventListener('mouseleave', hideElementInfo);
      
      // Убеждаемся, что элементы интерактивны
      newElement.style.pointerEvents = 'auto';
      newElement.style.cursor = 'move';
    }
  });
  
  logger.debug('Обработчики переприкреплены к', 'editor');
}

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ РЕДАКТОРА =====

/**
 * Удаление группы полей
 */
function deleteFieldGroup(groupKey) {
  const canvas = preview.querySelector('.unified-canvas');
  if (!canvas) return;
  
  const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
  const fieldGroups = groupElementsByField(elements);
  const fieldElements = fieldGroups[groupKey];
  
  if (!fieldElements || fieldElements.length === 0) return;
  
  const fieldName = fieldElements[0].dataset.fieldName || groupKey || 'Поле';
  
  if (confirm(`Удалить поле "${fieldName}"?`)) {
    // Удаляем все элементы группы
    fieldElements.forEach(element => {
      element.remove();
    });
    
    // Удаляем название поля, если оно есть
    const nameLabels = preview.querySelectorAll('.field-name-label');
    nameLabels.forEach(label => {
      if (label.textContent === fieldName) {
        label.remove();
      }
    });
    
    // Обновляем список полей
    updateFieldList();
    
    // Обновляем точные контролы
    updateCoordinates(0, 0);
    currentElement = null;
  }
}

/**
 * Удаление поля (старая функция для совместимости)
 */
function deleteField(index) {
  const canvas = preview.querySelector('.unified-canvas');
  if (!canvas) return;
  
  const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
  const element = elements[index];
  
  if (!element) return;
  
  const fieldName = element.dataset.fieldName || element.textContent || 'Поле';
  
  if (confirm(`Удалить поле "${fieldName}"?`)) {
    // Удаляем элемент из DOM
    element.remove();
    
    // Удаляем название поля, если оно есть
    const nameLabel = preview.querySelector(`.field-name-label[data-field-index="${index}"]`);
    if (nameLabel) {
      nameLabel.remove();
    }
    
    // Обновляем список полей
    updateFieldList();
    
    // Обновляем точные контролы
    updateCoordinates(0, 0);
    currentElement = null;
  }
}


/**
 * Обновление списка полей
 */
function updateFieldList() {
  logger.debug('Обновление списка полей...', 'editor');
  const fieldList = positionEditor.querySelector('.field-list');
  if (!fieldList) {
    logger.warn('Список полей не найден', 'editor');
    return;
  }
  
  const fieldItems = fieldList.querySelector('.field-items');
  fieldItems.innerHTML = '';
  
  // Группируем элементы по полям из всех страниц
  const allElements = [];
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      const pageElements = canvas.querySelectorAll('.overlay-text, .overlay-char');
      allElements.push(...pageElements);
    }
  });
  
  logger.debug('Найдено элементов для группировки:', allElements.length, 'editor');
  
  const fieldGroups = groupElementsByField(allElements);
  logger.debug('Группы полей:', 'editor');
  
  // Создаем элемент списка для каждой группы полей
  Object.keys(fieldGroups).forEach((groupKey, groupIndex) => {
    const fieldElements = fieldGroups[groupKey];
    if (fieldElements.length === 0) return;
    
    const firstElement = fieldElements[0];
    const fieldName = firstElement.dataset.fieldName || groupKey || `Поле ${groupIndex + 1}`;
    const currentPage = getElementPage(firstElement);
    
    const item = document.createElement('div');
    item.className = 'field-item';
    
    // Создаем название поля
    const fieldNameDiv = document.createElement('div');
    fieldNameDiv.className = 'field-item-name';
    fieldNameDiv.innerHTML = `
      <div style="font-weight: 600; color: var(--text); line-height: 1.2;">${fieldName}</div>
      <div style="font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.2;">стр. ${currentPage}</div>
    `;
    fieldNameDiv.dataset.groupKey = groupKey;
    
    // Добавляем иконку для новых полей
    if (firstElement.dataset.isNewField === 'true') {
      fieldNameDiv.innerHTML = `
        <div style="font-weight: 600; color: var(--ok); line-height: 1.2;">🆕 ${fieldName}</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.2;">стр. ${currentPage}</div>
      `;
    }
    
    // Создаем кнопку удаления
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'field-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Удалить поле';
    deleteBtn.dataset.groupKey = groupKey;
    
    // Добавляем обработчик удаления
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFieldGroup(groupKey);
    });
    
    item.appendChild(fieldNameDiv);
    item.appendChild(deleteBtn);
    
    item.addEventListener('click', () => {
      // Убираем выделение с других элементов
      fieldItems.querySelectorAll('.field-item').forEach(i => i.classList.remove('selected'));
      // Выделяем текущий элемент
      item.classList.add('selected');
      
      // Показываем информацию о первом элементе группы
      const left = parseFloat(firstElement.style.left) || 0;
      const top = parseFloat(firstElement.style.top) || 0;
      updateCoordinates(left, top);
      currentElement.textContent = fieldName;
      
      // Подсвечиваем все элементы группы на странице
      fieldElements.forEach(el => {
        el.style.boxShadow = '0 0 10px rgba(110, 168, 254, 0.8)';
        setTimeout(() => {
          el.style.boxShadow = '';
        }, 2000);
      });
    });
    
    fieldItems.appendChild(item);
  });
}

/**
 * Добавление визуальной сетки
 */
function addVisualGrid() {
  const canvas = preview.querySelector('.unified-canvas');
  if (canvas && !canvas.querySelector('.visual-grid')) {
    const grid = document.createElement('div');
    grid.className = 'visual-grid';
    grid.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      background-image: 
        linear-gradient(to right, rgba(0,255,0,0.1) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,255,0,0.1) 1px, transparent 1px);
      background-size: 3.78mm 3.78mm;
      opacity: 0.3;
    `;
    canvas.appendChild(grid);
  }
}

/**
 * Удаление визуальной сетки
 */
function removeVisualGrid() {
  const canvas = preview.querySelector('.unified-canvas');
  if (canvas) {
    canvas.querySelectorAll('.visual-grid').forEach(grid => grid.remove());
  }
}

/**
 * Включение привязки к сетке
 */
function enableGridSnap() {
  gridSnapEnabled = true;
}

/**
 * Привязка к сетке
 */
function snapToGrid(value) {
  if (!gridSnapEnabled) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Сохранение позиций в историю
 */
function savePositionToHistory() {
  const positions = {};
  const canvas = preview.querySelector('.unified-canvas');
  if (canvas) {
    const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
    elements.forEach((element, index) => {
      const left = parseFloat(element.style.left) || 0;
      const top = parseFloat(element.style.top) || 0;
      positions[index] = { left, top };
    });
  }
  
  // Удаляем все записи после текущего индекса (если мы не в конце истории)
  positionHistory = positionHistory.slice(0, currentHistoryIndex + 1);
  
  // Добавляем новую позицию
  positionHistory.push(positions);
  currentHistoryIndex++;
  
  // Ограничиваем размер истории
  if (positionHistory.length > 50) {
    positionHistory.shift();
    currentHistoryIndex--;
  }
}

/**
 * Отмена последнего действия
 */
function undoPosition() {
  if (currentHistoryIndex > 0) {
    currentHistoryIndex--;
    const positions = positionHistory[currentHistoryIndex];
    const canvas = preview.querySelector('.unified-canvas');
    if (canvas) {
      const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
      
      elements.forEach((element, index) => {
        if (positions[index]) {
          element.style.left = positions[index].left + 'mm';
          element.style.top = positions[index].top + 'mm';
        }
      });
    }
    
    updateCoordinates(0, 0);
    currentElement.textContent = '-';
  }
}

/**
 * Повтор последнего действия
 */
function redoPosition() {
  if (currentHistoryIndex < positionHistory.length - 1) {
    currentHistoryIndex++;
    const positions = positionHistory[currentHistoryIndex];
    const canvas = preview.querySelector('.unified-canvas');
    if (canvas) {
      const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
      
      elements.forEach((element, index) => {
        if (positions[index]) {
          element.style.left = positions[index].left + 'mm';
          element.style.top = positions[index].top + 'mm';
        }
      });
    }
    
    updateCoordinates(0, 0);
    currentElement.textContent = '-';
  }
}

/**
 * Группировка элементов по полю
 */
function findGroupedElements(targetElement) {
  const canvas = preview.querySelector('.unified-canvas');
  if (!canvas) return [targetElement];
  
  // Если у элемента есть data-field-name, группируем по нему
  const fieldName = targetElement.dataset.fieldName;
  logger.debug('Попытка группировки элемента:', 'editor');
  
  if (fieldName) {
    const allElements = Array.from(canvas.querySelectorAll('.overlay-char'));
    const groupedElements = allElements.filter(element => 
      element.dataset.fieldName === fieldName
    );
    
    logger.debug(`Группировка по полю "${fieldName}": найдено ${groupedElements.length} элементов`, 'editor');
    return groupedElements;
  }
  
  // Если нет data-field-name, используем старую логику группировки по позиции
  const allElements = Array.from(canvas.querySelectorAll('.overlay-char'));
  const targetIndex = allElements.indexOf(targetElement);
  
  if (targetIndex === -1) return [targetElement];
  
  const grouped = [targetElement];
  const targetLeft = parseFloat(targetElement.style.left) || 0;
  const targetTop = parseFloat(targetElement.style.top) || 0;
  
  // Ищем элементы слева
  for (let i = targetIndex - 1; i >= 0; i--) {
    const element = allElements[i];
    const left = parseFloat(element.style.left) || 0;
    const top = parseFloat(element.style.top) || 0;
    
    // Проверяем, находится ли элемент на той же строке и рядом
    const cellSpacing = CELL_WIDTH_MM + CELL_GAP_MM; // 4.32мм + 0мм = 4.32мм
    if (Math.abs(top - targetTop) < 1 && 
        Math.abs(left - (targetLeft - (targetIndex - i) * cellSpacing)) < 1) {
      grouped.unshift(element);
    } else {
      break;
    }
  }
  
  // Ищем элементы справа
  for (let i = targetIndex + 1; i < allElements.length; i++) {
    const element = allElements[i];
    const left = parseFloat(element.style.left) || 0;
    const top = parseFloat(element.style.top) || 0;
    
    // Проверяем, находится ли элемент на той же строке и рядом
    const cellSpacing = CELL_WIDTH_MM + CELL_GAP_MM; // 4.32мм + 0мм = 4.32мм
    if (Math.abs(top - targetTop) < 1 && 
        Math.abs(left - (targetLeft + (i - targetIndex) * cellSpacing)) < 1) {
      grouped.push(element);
    } else {
      break;
    }
  }
  
  return grouped;
}

/**
 * Обработчики клавиатуры
 */
function addKeyboardListeners() {
  document.addEventListener('keydown', handleKeyDown);
}

function removeKeyboardListeners() {
  document.removeEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
  if (!editorMode) return;
  
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoPosition();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      redoPosition();
    }
  }
}

/**
 * Удаление обработчиков перетаскивания
 */
function removeDraggableListeners() {
  const canvas = preview.querySelector('.unified-canvas');
  if (canvas) {
    const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
    elements.forEach(element => {
      element.removeEventListener('mousedown', startDrag);
      element.removeEventListener('mouseenter', showElementInfo);
      element.removeEventListener('mouseleave', hideElementInfo);
    });
  }
}

/**
 * Функция для определения страницы элемента
 */
function getElementPage(element) {
  // Ищем элемент в структуре страниц
  for (let pageNum = 1; pageNum <= 10; pageNum++) {
    const pageElement = window.pageElements[pageNum];
    if (pageElement) {
      const canvas = pageElement.querySelector('.sheet__canvas');
      if (canvas && canvas.contains(element)) {
        return pageNum;
      }
    }
  }
  
  // Если не найдено, используем старую логику как fallback
  const top = parseFloat(element.style.top) || 0;
  const pageNumber = Math.floor(top / 297) + 1;
  return Math.max(1, Math.min(10, pageNumber));
}

/**
 * Функция для определения целевой страницы на основе позиции
 */
function determineTargetPage(leftMm, topMm) {
  // Размеры страницы A4 в миллиметрах
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  
  // Определяем номер страницы на основе вертикальной позиции
  const pageNumber = Math.floor(topMm / pageHeightMm) + 1;
  
  // Ограничиваем номер страницы от 1 до 10
  return Math.max(1, Math.min(10, pageNumber));
}

/**
 * Начало перетаскивания
 */
function startDrag(e) {
  if (!EDITOR_ENABLED) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  draggedElement = e.target;
  isDragging = true;
  
  // Получаем смещение курсора относительно элемента
  const rect = draggedElement.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  
  // Находим группу элементов для перетаскивания
  if (draggedElement.classList.contains('overlay-char')) {
    const fieldName = draggedElement.getAttribute('data-field-name');
    if (fieldName) {
      // Ищем все элементы с тем же data-field-name на всех страницах
      const allElements = [];
      Object.values(window.pageElements).forEach(pageElement => {
        const canvas = pageElement.querySelector('.sheet__canvas');
        if (canvas) {
          const pageElements = canvas.querySelectorAll(`.overlay-char[data-field-name="${fieldName}"]`);
          allElements.push(...pageElements);
        }
      });
      
      // Сохраняем начальные позиции всех элементов группы
      const startPositions = allElements.map(element => ({
        element,
        left: parseFloat(element.style.left) || 0,
        top: parseFloat(element.style.top) || 0
      }));
      
      // Добавляем обработчики для перетаскивания
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
      
      // Сохраняем данные для обработки
      draggedElement._dragData = {
        allElements,
        startPositions,
        fieldName
      };
    }
  }
}

/**
 * Обновление позиции названия поля
 */
function updateFieldNamePosition(element, left, top) {
  const fieldName = element.getAttribute('data-field-name');
  if (!fieldName) return;
  
  // Ищем название поля на всех страницах
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      const nameLabel = canvas.querySelector(`.field-name-label[data-field-name="${fieldName}"]`);
      if (nameLabel) {
        nameLabel.style.left = left + 'mm';
        nameLabel.style.top = (top - 5) + 'mm';
      }
    }
  });
}

/**
 * Обновление координат
 */
function updateCoordinates(x, y) {
  if (typeof coordX !== 'undefined' && coordX) {
    coordX.textContent = x.toFixed(1);
  }
  if (typeof coordY !== 'undefined' && coordY) {
    coordY.textContent = y.toFixed(1);
  }
}

/**
 * Сохранение исходных позиций
 */
function saveOriginalPositions() {
  originalPositions = {};
  const canvas = preview.querySelector('.unified-canvas');
  if (canvas) {
    const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
    elements.forEach((element, index) => {
      const left = parseFloat(element.style.left) || 0;
      const top = parseFloat(element.style.top) || 0;
      originalPositions[index] = { left, top, element };
    });
  }
}

/**
 * Сброс позиций
 */
function resetPositions() {
  if (!EDITOR_ENABLED) return;

  // Очищаем все элементы на всех страницах
  Object.values(window.pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (canvas) {
      canvas.querySelectorAll('.overlay-char, .overlay-text, .field-name-label').forEach(el => el.remove());
    }
  });

  // Перерисовываем поля с исходными позициями
  if (typeof updatePreview === 'function') {
    updatePreview();
  } else {
    // Если updatePreview недоступна, перерисовываем вручную
    if (typeof window.renderOverlays === 'function') {
      window.renderOverlays();
    }
  }
  
  // Обновляем список полей
  updateFieldList();
  
  // Сбрасываем координаты
  updateCoordinates(0, 0);
  if (typeof currentElement !== 'undefined' && currentElement) {
    currentElement.textContent = '-';
  }
}

/**
 * Сохранение позиций
 */
function savePositions() {
  const positions = [];
  const canvas = preview.querySelector('.unified-canvas');
  if (!canvas) return;
  
  const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
  
  // Группируем символы по полям
  const fieldGroups = groupElementsByField(elements);
  
  // Создаем позиции для каждого поля
  Object.keys(fieldGroups).forEach(fieldType => {
    const group = fieldGroups[fieldType];
    if (group.length > 0) {
      const firstElement = group[0];
      const left = parseFloat(firstElement.style.left) || 0;
      const top = parseFloat(firstElement.style.top) || 0;
      const fullText = group.map(el => el.textContent).join('');
      // Дополнительная проверка для полей с цифрами
      let finalFieldType = fieldType;
      if (fieldType === 'unknown') {
        if (fullText === '000000000000000' && group.length === 15) {
          finalFieldType = 'ogrn';
        } else if (fullText === '0000000000' && group.length === 10) {
          finalFieldType = 'inn';
        } else if (fullText === '000000000' && group.length === 9) {
          finalFieldType = 'kpp';
        } else if (fullText === '0000' && group.length === 4) {
          finalFieldType = 'ifnsCode';
        }
      }
    
      positions.push({
        fieldType: finalFieldType,
        left: left.toFixed(1),
        top: top.toFixed(1),
        text: fullText
      });
    }
  });
  
  // Генерируем обновленный код
  const code = generateUpdatedRenderOverlaysCode(positions);
  
  // Показываем код в модальном окне для копирования
  showCodeModal(code);
}

/**
 * Генерация кода позиций
 */
function generatePositionCode(positions) {
  let code = '\n// Обновленные позиции элементов:\n';
  
  positions.forEach((pos, index) => {
    // Все поля теперь используют placeChars для единообразия
    code += `window.placeChars(1, ${pos.left}, ${pos.top}, '${pos.text}', CELL_WIDTH_MM, CELL_GAP_MM);\n`;
  });
  
  return code;
}

/**
 * Генерация кода для всех полей
 */
function generateUpdatedRenderOverlaysCode(positions, originalPositions = {}) {
  let code = `// === ОБНОВЛЕННЫЕ ПОЗИЦИИ ПОЛЕЙ ===
// Сгенерировано автоматически из редактора позиций

`;

  // Отладочная информация
  logger.debug('Все позиции полей:', 'editor');
  logger.debug('Тексты полей:', 'editor');
  
  // Группируем элементы по полям
  const canvas = preview.querySelector('.unified-canvas');
  if (!canvas) return '';
  
  const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
  const fieldGroups = groupElementsByField(elements);
  
  logger.debug('Найденные группы полей:', 'editor');

  // Генерируем код для каждого поля
  Object.keys(fieldGroups).forEach(fieldType => {
    const fieldElements = fieldGroups[fieldType];
    if (fieldElements.length === 0) return;
    
    // Берем первый элемент для получения позиции
    const firstElement = fieldElements[0];
    const left = parseFloat(firstElement.style.left) || 0;
    const top = parseFloat(firstElement.style.top) || 0;
    const fieldName = firstElement.dataset.fieldName || fieldType;
    
    // Все поля теперь используют placeChars для единообразия
    // Получаем фактическое значение поля из всех символов
    const fieldValue = fieldElements.map(el => el.textContent).join('');
    
    // Определяем правильное значение по умолчанию на основе названия поля
    let defaultValue = fieldValue; // По умолчанию используем фактическое значение
    
    // Специальные случаи для полей с известными значениями по умолчанию
    if (fieldName.startsWith('ИНН')) {
      defaultValue = '000000000000';
    } else if (fieldName.startsWith('КПП')) {
      defaultValue = '000000000';
    } else if (fieldName.startsWith('ОГРН')) {
      defaultValue = '000000000000000';
    } else if (fieldName === 'Вид документа') {
      defaultValue = '1';
    } else if (fieldName.startsWith('Стр') || fieldName.startsWith('Str')) {
      // Для полей типа Str002, Str003 и т.д.
      const match = fieldName.match(/(\d+)$/);
      if (match) {
        const number = match[1];
        defaultValue = number.padStart(3, '0'); // 002, 003, 004 и т.д.
      }
    } else if (fieldName === '10 страниц' || fieldName === '10 листах') {
      defaultValue = '10';
    } else if (fieldName === 'Заявитель') {
      defaultValue = '1';
    } else if (fieldName.startsWith('ФИО Руководителя')) {
      defaultValue = '0000000000000000000000000000000000000000';
    } else if (fieldName === 'дд1' || fieldName === 'мм1') {
      defaultValue = '01';
    } else if (fieldName === 'гггг1') {
      defaultValue = '0101';
    } else if (fieldName.startsWith('Название организации')) {
      defaultValue = '0000000000000000000000000000000000000000';
    }
    
    // Создаем безопасное имя переменной (убираем пробелы и спецсимволы, начинаем с буквы)
    const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '');
    let safeFieldType = fieldType.replace(/[^a-zA-Z0-9]/g, '');
    
    // Если имя начинается с цифры, добавляем префикс
    if (safeFieldType.match(/^\d/)) {
      safeFieldType = 'field' + safeFieldType;
    }
    
    // Маппинг кириллических названий на латинские (для стандартных полей)
    const fieldNameMapping = {
      'ИНН': 'inn',
      'КПП': 'kpp',
      'ОГРН': 'ogrn',
      'ОГРН/ОГРНИП': 'ogrnOgrnip',
      'Код ИФНС': 'ifnsCode',
      'Наименование организации': 'orgName',
      'Модель ККТ': 'kktModel',
      'Заводской номер ККТ': 'kktSerial',
      'Модель ФН': 'fnModel',
      'Заводской номер ФН': 'fiscalDrive',
      'Адрес': 'address',
      'ОФД': 'ofd',
      'Телефон': 'phone',
      'Email': 'email',
      'Руководитель': 'headName',
      'Дата заявления': 'applicationDate',
      'Вид документа': 'docType',
      'Количество страниц': 'pagesTotal',
      'Количество экземпляров': 'copiesTotal',
      '10 страниц': 'field10stranits',
      '10 листах': 'field10listah',
      'Заявитель': 'Zayavitel',
      'ФИО Руководителя 1': 'FIORukovoditelya1',
      'ФИО Руководителя 2': 'FIORukovoditelya2',
      'ФИО Руководителя 3': 'FIORukovoditelya3',
      'дд1': 'dd1',
      'мм1': 'mm1',
      'гггг1': 'gggg1'
    };
    
    // Используем латинское название поля из маппинга или создаем через транслитерацию
    const latinFieldName = fieldNameMapping[fieldName] || createSafeVariableName(fieldName);
    
    code += `  // ${fieldName}\n`;
    code += `  const ${latinFieldName}Text = data.${latinFieldName} || '${defaultValue}';\n`;
    code += `  window.placeChars(1, ${left}, ${top}, ${latinFieldName}Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.${latinFieldName} ? '#000' : '#999', fieldName: '${fieldName}' });\n\n`;
  });
  
  return code;
}

/**
 * Показ модального окна с кодом для копирования
 */
function showCodeModal(code) {
  // Создаем модальное окно
  const modal = document.createElement('div');
  modal.className = 'code-modal';
  modal.innerHTML = `
    <div class="code-modal-content">
      <div class="code-modal-header">
        <h3>Обновленный код функции renderOverlays</h3>
        <button class="code-modal-close">&times;</button>
      </div>
      <div class="code-modal-body">
        <p>Скопируйте этот код и вставьте его в функцию <code>renderOverlays</code> в файле <code>app.js</code> (добавьте к существующему коду):</p>
        <textarea class="code-textarea" readonly>${code}</textarea>
        <div class="code-modal-actions">
          <button class="btn btn--primary" id="copyCodeBtn">Копировать код</button>
          <button class="btn btn--ghost" id="closeCodeModal">Закрыть</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обработчики событий
  const closeBtn = modal.querySelector('.code-modal-close');
  const closeModalBtn = modal.querySelector('#closeCodeModal');
  const copyBtn = modal.querySelector('#copyCodeBtn');
  const textarea = modal.querySelector('.code-textarea');
  
  // Закрытие модального окна
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  closeBtn.addEventListener('click', closeModal);
  closeModalBtn.addEventListener('click', closeModal);
  
  // Закрытие по клику вне модального окна
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Копирование кода
  copyBtn.addEventListener('click', () => {
    textarea.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Скопировано!';
    setTimeout(() => {
      copyBtn.textContent = 'Копировать код';
    }, 2000);
  });
  
  // Автоматическое выделение текста
  textarea.focus();
  textarea.select();
}

// Дублированная функция createFieldList удалена - используется основная версия выше

/**
 * Точные контролы для позиционирования
 */
function createPreciseControls() {
  const controls = document.createElement('div');
  controls.id = 'preciseControls';
  controls.className = 'precise-controls';
  controls.innerHTML = `
    <h4>Точное позиционирование:</h4>
    <div class="control-group">
      <label>X (мм): <input type="number" id="preciseX" step="0.1" /></label>
      <label>Y (мм): <input type="number" id="preciseY" step="0.1" /></label>
    </div>
    <div class="control-group">
      <button type="button" id="moveUp" class="btn btn--small">↑</button>
      <button type="button" id="moveDown" class="btn btn--small">↓</button>
      <button type="button" id="moveLeft" class="btn btn--small">←</button>
      <button type="button" id="moveRight" class="btn btn--small">→</button>
    </div>
    <div class="control-group">
      <label>
        <input type="checkbox" id="gridSnapToggle" checked />
        Привязка к сетке
      </label>
    </div>
    <div class="control-group">
      <label>Страница: <input type="number" id="precisePage" min="1" max="10" step="1" /></label>
      <button type="button" id="changePage" class="btn btn--small">Переместить</button>
    </div>
  `;
  
  const preciseX = controls.querySelector('#preciseX');
  const preciseY = controls.querySelector('#preciseY');
  const precisePage = controls.querySelector('#precisePage');
  const changePageBtn = controls.querySelector('#changePage');
  const gridSnapToggle = controls.querySelector('#gridSnapToggle');
  
  // Обновление полей при изменении координат
  const updatePreciseControls = () => {
    const x = parseFloat(coordX.textContent) || 0;
    const y = parseFloat(coordY.textContent) || 0;
    preciseX.value = x.toFixed(1);
    preciseY.value = y.toFixed(1);
    
    // Обновляем номер страницы для выбранного элемента
    const selectedItem = positionEditor.querySelector('.field-item.selected');
    if (selectedItem) {
      const groupKey = selectedItem.querySelector('.field-name').dataset.groupKey;
      const canvas = preview.querySelector('.unified-canvas');
      if (canvas) {
        const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
        const element = Array.from(elements).find(el => el.dataset.fieldName === groupKey);
        if (element) {
          const currentPage = getElementPage(element);
          precisePage.value = currentPage;
        }
      }
    }
  };
  
  // Применение точных координат
  const applyPrecisePosition = () => {
    const selectedItem = positionEditor.querySelector('.field-item.selected');
    if (!selectedItem) return;
    
    const groupKey = selectedItem.querySelector('.field-name').dataset.groupKey;
    const canvas = preview.querySelector('.unified-canvas');
    if (!canvas) return;
    
    const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
    const element = Array.from(elements).find(el => el.dataset.fieldName === groupKey);
    
    if (element) {
      const x = parseFloat(preciseX.value) || 0;
      const y = parseFloat(preciseY.value) || 0;
      
      element.style.left = x + 'mm';
      element.style.top = y + 'mm';
      updateCoordinates(x, y);
    }
  };
  
  preciseX.addEventListener('change', applyPrecisePosition);
  preciseY.addEventListener('change', applyPrecisePosition);
  
  // Кнопки перемещения
  const moveStep = 1; // 1мм
  controls.querySelector('#moveUp').addEventListener('click', () => {
    const y = parseFloat(preciseY.value) || 0;
    preciseY.value = (y - moveStep).toFixed(1);
    applyPrecisePosition();
  });
  
  controls.querySelector('#moveDown').addEventListener('click', () => {
    const y = parseFloat(preciseY.value) || 0;
    preciseY.value = (y + moveStep).toFixed(1);
    applyPrecisePosition();
  });
  
  controls.querySelector('#moveLeft').addEventListener('click', () => {
    const x = parseFloat(preciseX.value) || 0;
    preciseX.value = (x - moveStep).toFixed(1);
    applyPrecisePosition();
  });
  
  controls.querySelector('#moveRight').addEventListener('click', () => {
    const x = parseFloat(preciseX.value) || 0;
    preciseX.value = (x + moveStep).toFixed(1);
    applyPrecisePosition();
  });
  
  // Переключение привязки к сетке
  gridSnapToggle.addEventListener('change', (e) => {
    gridSnapEnabled = e.target.checked;
  });
  
  // Перемещение элемента на другую страницу
  const moveElementToPage = () => {
    logger.debug('=== ПЕРЕМЕЩЕНИЕ ЭЛЕМЕНТА НА СТРАНИЦУ ===', 'editor');
    
    // Проверяем все элементы в списке
    const allItems = positionEditor.querySelectorAll('.field-item');
    logger.debug('Все элементы в списке:', 'editor');
    allItems.forEach((item, idx) => {
      logger.debug(`Элемент ${idx}:`, 'editor');
    });
    
    const selectedItem = positionEditor.querySelector('.field-item.selected');
    logger.debug('Выбранный элемент в списке:', 'editor');
    if (!selectedItem) {
      logger.warn('Нет выбранного элемента!', 'editor');
      logger.warn('Попробуйте сначала выбрать поле из списка, кликнув на него', 'editor');
      return;
    }
    
    const newPage = parseInt(precisePage.value) || 1;
    logger.debug('Новая страница:', 'editor');
    if (newPage < 1 || newPage > 10) return;
    
    // Получаем группу элементов по ключу группы
    const groupKey = selectedItem.querySelector('.field-name').dataset.groupKey;
    logger.debug('Ключ группы:', 'editor');
    
    // Находим все элементы этой группы
    const canvas = preview.querySelector('.unified-canvas');
    if (!canvas) return;
    
    const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
    const groupElements = Array.from(elements).filter(el => {
      const fieldName = el.dataset.fieldName || el.getAttribute('data-field-name');
      return fieldName === groupKey;
    });
    
    console.log('Найдено элементов в группе:', groupElements.length);
    if (groupElements.length === 0) {
      console.log('Группа элементов не найдена!');
      return;
    }
    
    // В едином документе просто перемещаем элементы на нужную позицию
    groupElements.forEach((element, idx) => {
      console.log(`Обрабатываем элемент ${idx}:`, element.textContent);
      
      // Получаем текущие координаты элемента
      const currentLeft = parseFloat(element.style.left) || 0;
      const currentTop = parseFloat(element.style.top) || 0;
      console.log(`Текущие координаты элемента ${idx}: (${currentLeft}, ${currentTop})`);
      
      // Вычисляем новую позицию для целевой страницы
      const newTop = (newPage - 1) * 297 + (currentTop % 297);
      
      console.log(`Новая позиция элемента ${idx}: (${currentLeft}, ${newTop})`);
      
      // Устанавливаем новую позицию
      element.style.left = currentLeft + 'mm';
      element.style.top = newTop + 'mm';
      
      // Обновляем индикатор страницы
      const pageIndicator = element.querySelector('.page-indicator');
      if (pageIndicator) {
        pageIndicator.textContent = newPage;
      }
      
      console.log(`Элемент ${idx} успешно перемещен на страницу ${newPage}`);
    });
    
    // Обновляем координаты в интерфейсе для первого элемента
    if (groupElements.length > 0) {
      const firstElement = groupElements[0];
      const currentLeft = parseFloat(firstElement.style.left) || 0;
      const currentTop = parseFloat(firstElement.style.top) || 0;
      updateCoordinates(currentLeft, currentTop);
    }
    
    // Обновляем список полей после перемещения
    updateFieldList();
    
    // Обработчики событий уже установлены в window.placeChars()
    
    logger.debug('=== ПЕРЕМЕЩЕНИЕ ЗАВЕРШЕНО ===', 'editor');
  };
  
  // Обработчик кнопки перемещения
  changePageBtn.addEventListener('click', moveElementToPage);
  
  // Обновляем контролы при изменении координат
  const originalUpdateCoordinates = updateCoordinates;
  updateCoordinates = (x, y) => {
    originalUpdateCoordinates(x, y);
    updatePreciseControls();
  };
  
  // Добавляем в контент редактора
  const editorContent = positionEditor.querySelector('.editor-content');
  if (editorContent) {
    editorContent.appendChild(controls);
  } else {
    positionEditor.appendChild(controls);
  }
}

function removePreciseControls() {
  const controls = positionEditor.querySelector('.precise-controls');
  if (controls) controls.remove();
}

// Экспортируем функции для использования в app.js
window.toggleEditorMode = toggleEditorMode;
window.initializeEditor = initializeEditor;
window.EDITOR_ENABLED = EDITOR_ENABLED;
window.placeText = placeText;
window.placeChars = placeChars;
window.clearOverlays = clearOverlays;
window.showElementInfo = showElementInfo;
window.hideElementInfo = hideElementInfo;
window.reattachEventHandlersToExistingElements = reattachEventHandlersToExistingElements;
