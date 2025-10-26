// ===== СИСТЕМА ЛОГИРОВАНИЯ =====
const LOG_CONFIG = {
  // Уровни логирования: 'none', 'error', 'warn', 'info', 'debug'
  level: 'warn', // По умолчанию показываем только предупреждения и ошибки
  // Категории логирования
  categories: {
    validation: true,    // Валидация форм
    pdf: true,          // Генерация PDF
    canvas: false,      // Работа с Canvas (очень много логов)
    fields: false,      // Заполнение полей (очень много логов)
    editor: false,      // Редактор позиций (очень много логов)
    drag: false,        // Перетаскивание элементов (очень много логов)
    init: true,         // Инициализация
    error: true         // Ошибки (всегда включены)
  }
};

// Функции логирования
const logger = {
  error: (message, category = 'error') => {
    if (LOG_CONFIG.categories[category] !== false) {
      console.error(`[ERROR] ${message}`);
    }
  },
  warn: (message, category = 'warn') => {
    if (LOG_CONFIG.categories[category] !== false) {
      console.warn(`[WARN] ${message}`);
    }
  },
  info: (message, category = 'info') => {
    if (LOG_CONFIG.level === 'info' || LOG_CONFIG.level === 'debug') {
      if (LOG_CONFIG.categories[category] !== false) {
        console.info(`[INFO] ${message}`);
      }
    }
  },
  debug: (message, category = 'debug') => {
    if (LOG_CONFIG.level === 'debug') {
      if (LOG_CONFIG.categories[category] !== false) {
        console.log(`[DEBUG] ${message}`);
      }
    }
  }
};

// Функция для переключения уровня логирования
window.setLogLevel = (level) => {
  LOG_CONFIG.level = level;
  console.log(`Уровень логирования изменен на: ${level}`);
};

// ===== DADATA API ИНТЕГРАЦИЯ =====
const DADATA_API_KEY = '9457c3a11abb348f8c7670296265b3dd6d31098f';
const DADATA_API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';

// Функция для получения данных организации по ИНН или ОГРН
async function fetchOrganizationData(query) {
  try {
    const response = await fetch(DADATA_API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_API_KEY}`
      },
      body: JSON.stringify({ query: query })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.suggestions && data.suggestions.length > 0) {
      return data.suggestions[0].data;
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка при запросе к DaData API:', error);
    return null;
  }
}

// Функция для автозаполнения полей на основе данных из DaData
function fillOrganizationFields(organizationData) {
  if (!organizationData) return;

  // Заполняем ИНН
  if (organizationData.inn && document.getElementById('inn')) {
    document.getElementById('inn').value = organizationData.inn;
  }

  // Заполняем КПП (если есть, только для юрлиц)
  if (organizationData.kpp && document.getElementById('kpp')) {
    document.getElementById('kpp').value = organizationData.kpp;
  } else if (document.getElementById('kpp')) {
    // Если КПП нет, оставляем поле пустым
    document.getElementById('kpp').value = '';
  }

  // Заполняем ОГРН
  if (organizationData.ogrn && document.getElementById('ogrn')) {
    document.getElementById('ogrn').value = organizationData.ogrn;
  }

  // Заполняем наименование организации - используем full_with_opf или full
  if (organizationData.name && document.getElementById('orgName')) {
    const orgName = organizationData.name.full_with_opf || organizationData.name.full || organizationData.name.short;
    document.getElementById('orgName').value = orgName;
  }

  // Заполняем адрес (если есть)
  if (organizationData.address && organizationData.address.value && document.getElementById('address')) {
    document.getElementById('address').value = organizationData.address.value;
  }

  // Дизейблим выпадающий список "тип заявителя"
  const applicantTypeSelect = document.getElementById('applicantType');
  if (applicantTypeSelect) {
    applicantTypeSelect.disabled = true;
    
    // Определяем тип заявителя на основе данных
    if (organizationData.type === 'INDIVIDUAL') {
      applicantTypeSelect.value = 'ip';
    } else if (organizationData.type === 'LEGAL') {
      // Определяем ООО или АО по полному наименованию
      const fullName = organizationData.name.full_with_opf || organizationData.name.full || '';
      if (fullName.includes('ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ') || fullName.includes('ООО')) {
        applicantTypeSelect.value = 'ooo';
      } else if (fullName.includes('АКЦИОНЕРНОЕ ОБЩЕСТВО') || fullName.includes('ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО') || fullName.includes('ПАО')) {
        applicantTypeSelect.value = 'ao';
      } else {
        applicantTypeSelect.value = 'other';
      }
    }
  }

  // Устанавливаем флаг автозаполнения и обновляем превью
  window.isAutoFillMode = true;
  updatePreview();
  window.isAutoFillMode = false;
}

// ===== ФУНКЦИИ НАВИГАЦИИ ПО СТРАНИЦАМ =====

function showPage(pageNumber) {
  if (pageNumber < 1 || pageNumber > totalPages) return;

  currentPage = pageNumber;
  window.currentPage = currentPage; // Обновляем глобальную переменную
  
  // Обновляем UI
  document.getElementById('currentPageNumber').textContent = pageNumber;
  document.getElementById('prevPage').disabled = pageNumber === 1;
  document.getElementById('nextPage').disabled = pageNumber === totalPages;
  
  // Показываем только текущую страницу
  const preview = document.getElementById('preview');
  preview.innerHTML = '';
  
  if (pageElements[pageNumber]) {
    preview.appendChild(pageElements[pageNumber]);
  } else {
    // Создаем страницу, если она еще не была создана
    createPageElement(pageNumber);
    // После создания добавляем её в превью
    preview.appendChild(pageElements[pageNumber]);
  }
  
  // Обновляем поля для текущей страницы
  const data = Object.fromEntries(new FormData(form));
  const applicantType = data.applicantType || ''; // Получаем тип заявителя из формы (может быть пустым)
  const overlayData = {
    ogrn: data.ogrn || defaultValues.ogrn,
    inn: data.inn || defaultValues.inn,
    kpp: data.kpp || defaultValues.kpp,
    orgName: data.orgName || '', // Не используем defaultValues для orgName, чтобы префикс работал корректно
    address: data.address || defaultValues.address,
    phone: data.phone || defaultValues.phone,
    email: data.email || defaultValues.email,
    kktModel: data.kktModel || defaultValues.kktModel,
    kktSerial: data.kktSerial || defaultValues.kktSerial,
    fnModel: data.fnModel === 'other' ? data.fnModelOther : (data.fnModel || defaultValues.fnModel),
    fiscalDriveNumber: data.fiscalDriveNumber || defaultValues.fiscalDriveNumber,
    ofd: data.ofd || defaultValues.ofd,
    operationType: data.operationType || 'registration',
    ifnsCode: data.ifnsCode || defaultValues.ifnsCode,
    applicationDate: data.applicationDate || defaultValues.applicationDate,
    headName: data.headName || defaultValues.headName,
    notes: data.notes || '',
    fioApplicant: data.fioApplicant || '',
    zayavitel: data.zayavitel || '1',
    applicantType: data.applicantType || '',
    docType: '1',
    pagesTotal: '10',
    copiesTotal: '10',
    Str002: '002',
    Str003: '003',
    Str004: '004',
    Str005: '005',
    Str006: '006',
    Str007: '007',
    Str008: '008',
    Str009: '009',
    Str010: '010',
    field10stranits: '10',
    field10listah: '10',
    Nazvanieorganizatsii1: (() => {
      let orgNameText = data.orgName ? data.orgName.toUpperCase() : '';
      
      // Не добавляем префиксы при автозаполнении
      if (!window.isAutoFillMode) {
        let prefix = '';
        if (applicantType === 'ip') {
          prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
        } else if (applicantType === 'ooo') {
          prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
        } else if (applicantType === 'ao') {
          prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
        }
        if (prefix) {
          orgNameText = orgNameText ? prefix + orgNameText : prefix;
        }
      }
      
      return orgNameText.substring(0, 40);
    })(),
    Nazvanieorganizatsii2: (() => {
      let orgNameText = data.orgName ? data.orgName.toUpperCase() : '';
      
      // Не добавляем префиксы при автозаполнении
      if (!window.isAutoFillMode) {
        let prefix = '';
        if (applicantType === 'ip') {
          prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
        } else if (applicantType === 'ooo') {
          prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
        } else if (applicantType === 'ao') {
          prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
        }
        if (prefix) {
          orgNameText = orgNameText ? prefix + orgNameText : prefix;
        }
      }
      
      return orgNameText.substring(40, 80);
    })(),
    Nazvanieorganizatsii3: (() => {
      let orgNameText = data.orgName ? data.orgName.toUpperCase() : '';
      
      // Не добавляем префиксы при автозаполнении
      if (!window.isAutoFillMode) {
        let prefix = '';
        if (applicantType === 'ip') {
          prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
        } else if (applicantType === 'ooo') {
          prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
        } else if (applicantType === 'ao') {
          prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
        }
        if (prefix) {
          orgNameText = orgNameText ? prefix + orgNameText : prefix;
        }
      }
      
      return orgNameText.substring(80, 120);
    })(),
    FIORukovoditelya1: (data.headName || '').substring(0, 20) || '00000000000000000000',
    FIORukovoditelya2: (data.headName || '').substring(20, 40) || '00000000000000000000',
    FIORukovoditelya3: (data.headName || '').substring(40, 60) || '00000000000000000000',
    dd1: data.applicationDate ? new Date(data.applicationDate).getDate().toString().padStart(2, '0') : '00',
    mm1: data.applicationDate ? (new Date(data.applicationDate).getMonth() + 1).toString().padStart(2, '0') : '00',
    gggg1: data.applicationDate ? new Date(data.applicationDate).getFullYear().toString() : '0000',
    
    // Поля DateStr2-DateStr10 в формате "дд.мм.гг"
    DateStr2: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr3: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr4: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr5: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr6: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr7: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr8: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr9: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr10: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
  };
  
  // Очищаем поля только на текущей странице
  const currentPageElement = pageElements[pageNumber];
  if (currentPageElement) {
    const canvas = currentPageElement.querySelector('.sheet__canvas');
    if (canvas) {
      canvas.querySelectorAll('.overlay-text, .overlay-char, .field-name-label').forEach(n => n.remove());
    }
  }
  
  // Рендерим поля для всех страниц
  renderOverlays(overlayData);
  
  logger.info(`Показана страница ${pageNumber}`, 'init');
}

function createPageElement(pageNumber) {
  const pageElement = document.createElement('div');
  pageElement.className = 'sheet a4 sheet--knd';
  pageElement.id = `sheet${pageNumber}`;
  
  // Создаем canvas для страницы
  const canvas = document.createElement('div');
  canvas.className = 'sheet__canvas';
  canvas.style.cssText = `
    position: relative;
    width: 210mm;
    height: 297mm;
    z-index: 1;
  `;
  
  // Добавляем фоновое изображение
  const backgroundImg = document.createElement('img');
  backgroundImg.src = `./template/page-${pageNumber}.png`;
  backgroundImg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    pointer-events: none;
    z-index: 1;
  `;
  
  backgroundImg.onload = () => {
    logger.debug(`Фоновое изображение страницы ${pageNumber} загружено`, 'canvas');
  };
  
  backgroundImg.onerror = (error) => {
    logger.error(`Ошибка загрузки фонового изображения страницы ${pageNumber}`, 'error');
  };
  
  canvas.appendChild(backgroundImg);
  pageElement.appendChild(canvas);
  
  // Сохраняем элемент страницы
  pageElements[pageNumber] = pageElement;
  window.pageElements = pageElements; // Обновляем глобальную переменную
  
  // НЕ добавляем в превью сразу - это будет сделано в showPage()
  
  logger.info(`Создан элемент страницы ${pageNumber}`, 'init');
}

function nextPage() {
  if (currentPage < totalPages) {
    showPage(currentPage + 1);
  }
}

function prevPage() {
  if (currentPage > 1) {
    showPage(currentPage - 1);
  }
}

function updatePageNavigation() {
  document.getElementById('currentPageNumber').textContent = currentPage;
  document.getElementById('totalPages').textContent = totalPages;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages;
}


// Функция для переключения категорий логирования
window.toggleLogCategory = (category, enabled) => {
  LOG_CONFIG.categories[category] = enabled;
  console.log(`Категория логирования '${category}' ${enabled ? 'включена' : 'отключена'}`);
};

// Функция для показа текущей конфигурации
window.showLogConfig = () => {
  console.log('Текущая конфигурация логирования:', LOG_CONFIG);
};

// ===== ОСНОВНЫЕ ПЕРЕМЕННЫЕ =====
const form = document.getElementById('kkt-form');
const preview = document.getElementById('preview');
const toggleEditorBtn = document.getElementById('toggleEditor');
const exportPdfBtn = document.getElementById('exportPdf');
const positionEditor = document.getElementById('positionEditor');
const savePositionsBtn = document.getElementById('savePositions');
const resetPositionsBtn = document.getElementById('resetPositions');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const addFieldBtn = document.getElementById('addFieldBtn');
const coordX = document.getElementById('coordX');
const coordY = document.getElementById('coordY');
const currentElement = document.getElementById('currentElement');
// встроенный шаблон из папки template/

let renderedPages = 0;
// Переменные редактора
let editorMode = false; // Режим редактора позиций

// Переменные для навигации по страницам
let currentPage = 1;
let totalPages = 10;
let pageElements = {}; // Хранит элементы для каждой страницы

// Делаем переменные доступными глобально для отладки
window.currentPage = currentPage;
window.totalPages = totalPages;
window.pageElements = pageElements;

const selectLabels = {
  applicantType: { org: 'Организация', ip: 'Индивидуальный предприниматель' },
  operationType: { registration: 'Регистрация', reregistration: 'Перерегистрация', deRegistration: 'Снятие с учёта' }
};

// Посимвольные клетки: размеры в миллиметрах
const CELL_WIDTH_MM = 4.32;  // ширина каждой ячейки
const CELL_HEIGHT_MM = 6.0;  // высота каждой ячейки
const CELL_GAP_MM = 0.0;     // интервал между ячейками (0мм - ячейки вплотную)

function setText(bind, value) {
  const nodes = preview.querySelectorAll(`[data-bind="${bind}"]`);
  nodes.forEach(n => { n.textContent = value && String(value).trim() ? value : '—'; });
}

// Флаг автозаполнения для DaData - глобальный
window.isAutoFillMode = false;

// Значения по умолчанию для полей
const defaultValues = {
  ogrn: '000000000000000', // 15 символов
  inn: '000000000000',     // 12 символов
  kpp: '000000000',        // 9 символов
  orgName: 'НАИМЕНОВАНИЕ ОРГАНИЗАЦИИ',
  address: 'АДРЕС УСТАНОВКИ ККТ',
  phone: 'ТЕЛЕФОН',
  email: 'EMAIL',
  kktModel: '',
  kktSerial: 'ЗАВОДСКОЙ НОМЕР ККТ',
  fnModel: '',
  fiscalDriveNumber: 'ЗАВОДСКОЙ НОМЕР ФН',
  ofd: '',
  ifnsCode: '0000',
  headName: 'ФИО РУКОВОДИТЕЛЯ',
  applicationDate: 'ДД.ММ.ГГГГ'
};

function formatDateISOToRu(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  } catch {
    return value;
  }
}

function updatePreview() {
  const data = Object.fromEntries(new FormData(form));
  const applicantType = data.applicantType || ''; // Получаем тип заявителя из формы (может быть пустым)

  // Преобразуем данные формы в формат, ожидаемый renderOverlays
  const overlayData = {
    // Основные поля
    ogrn: data.ogrn || defaultValues.ogrn,
    inn: data.inn || defaultValues.inn,
    kpp: data.kpp || defaultValues.kpp,
    orgName: data.orgName || '', // Не используем defaultValues для orgName, чтобы префикс работал корректно
    address: data.address || defaultValues.address,
    phone: data.phone || defaultValues.phone,
    email: data.email || defaultValues.email,
    
    // ККТ поля
    kktModel: data.kktModel || defaultValues.kktModel,
    kktSerial: data.kktSerial || defaultValues.kktSerial,
    fnModel: data.fnModel === 'other' ? data.fnModelOther : (data.fnModel || defaultValues.fnModel),
    fiscalDriveNumber: data.fiscalDriveNumber || defaultValues.fiscalDriveNumber,
    ofd: data.ofd || defaultValues.ofd,
    
    // Регистрация
    operationType: data.operationType || 'registration',
    ifnsCode: data.ifnsCode || defaultValues.ifnsCode,
    applicationDate: data.applicationDate || defaultValues.applicationDate,
    headName: data.headName || defaultValues.headName,
    notes: data.notes || '',
    fioApplicant: data.fioApplicant || '',
    
    // Заявитель
    zayavitel: data.zayavitel || '1',
    
    // Фиксированные значения
    docType: '1',
    pagesTotal: '10',
    copiesTotal: '10',
    
    // Номера строк (фиксированные)
    Str002: '002',
    Str003: '003',
    Str004: '004',
    Str005: '005',
    Str006: '006',
    Str007: '007',
    Str008: '008',
    Str009: '009',
    Str010: '010',
    
    // Количество страниц
    field10stranits: '10',
    field10listah: '10',
    
    // Разбивка названия организации на части
    // Для ИП добавляем префикс
    Nazvanieorganizatsii1: (() => {
      let orgNameText = data.orgName ? data.orgName.toUpperCase() : '';
      
      // Не добавляем префиксы при автозаполнении
      if (!window.isAutoFillMode) {
        let prefix = '';
        if (applicantType === 'ip') {
          prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
        } else if (applicantType === 'ooo') {
          prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
        } else if (applicantType === 'ao') {
          prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
        }
        if (prefix) {
          orgNameText = orgNameText ? prefix + orgNameText : prefix;
        }
      }
      
      return orgNameText.substring(0, 40);
    })(),
    Nazvanieorganizatsii2: (() => {
      let orgNameText = data.orgName ? data.orgName.toUpperCase() : '';
      
      // Не добавляем префиксы при автозаполнении
      if (!window.isAutoFillMode) {
        let prefix = '';
        if (applicantType === 'ip') {
          prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
        } else if (applicantType === 'ooo') {
          prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
        } else if (applicantType === 'ao') {
          prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
        }
        if (prefix) {
          orgNameText = orgNameText ? prefix + orgNameText : prefix;
        }
      }
      
      return orgNameText.substring(40, 80);
    })(),
    Nazvanieorganizatsii3: (() => {
      let orgNameText = data.orgName ? data.orgName.toUpperCase() : '';
      
      // Не добавляем префиксы при автозаполнении
      if (!window.isAutoFillMode) {
        let prefix = '';
        if (applicantType === 'ip') {
          prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
        } else if (applicantType === 'ooo') {
          prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
        } else if (applicantType === 'ao') {
          prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
        }
        if (prefix) {
          orgNameText = orgNameText ? prefix + orgNameText : prefix;
        }
      }
      
      return orgNameText.substring(80, 120);
    })(),
    
    // Разбивка ФИО руководителя на части
    FIORukovoditelya1: (data.headName || '').substring(0, 20) || '00000000000000000000',
    FIORukovoditelya2: (data.headName || '').substring(20, 40) || '00000000000000000000',
    FIORukovoditelya3: (data.headName || '').substring(40, 60) || '00000000000000000000',
    
    // Разбивка даты
    dd1: data.applicationDate ? new Date(data.applicationDate).getDate().toString().padStart(2, '0') : '00',
    mm1: data.applicationDate ? (new Date(data.applicationDate).getMonth() + 1).toString().padStart(2, '0') : '00',
    gggg1: data.applicationDate ? new Date(data.applicationDate).getFullYear().toString() : '0000',
    
    // Поля DateStr2-DateStr10 в формате "дд.мм.гг"
    DateStr2: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr3: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr4: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr5: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr6: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr7: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr8: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr9: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
    DateStr10: data.applicationDate ? (() => {
      const date = new Date(data.applicationDate);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}.${month}.${year}`;
    })() : '00.00.00',
  };

  setText('applicantTypeLabel', selectLabels.applicantType[data.applicantType] || '—');
  setText('ogrn', data.ogrn);
  setText('inn', data.inn);
  setText('kpp', data.kpp);
  setText('orgName', data.orgName);
  setText('address', data.address);
  setText('phone', data.phone);
  setText('email', data.email);

  setText('kktModel', data.kktModel);
  setText('kktSerial', data.kktSerial);
  
  // Обработка поля "Модель ФН"
  const fnModelValue = data.fnModel === 'other' ? data.fnModelOther : data.fnModel;
  setText('fnModel', fnModelValue);
  
  setText('fiscalDriveNumber', data.fiscalDriveNumber);
  setText('ofd', data.ofd);

  setText('operationTypeLabel', selectLabels.operationType[data.operationType] || '—');
  setText('ifnsCode', data.ifnsCode);
  setText('applicationDate', formatDateISOToRu(data.applicationDate));
  setText('headName', data.headName);
  setText('notes', data.notes);
  setText('fioApplicant', data.fioApplicant);

  // === Текстовые оверлеи ===
  // Всегда вызываем renderOverlays чтобы обновить поля названия организации с префиксом
  window.renderOverlays(overlayData);
  
  // Обновляем отображение текущей страницы
  showPage(currentPage);
  
  // Обновляем поле "Вид документа" в зависимости от типа операции
  updateDocTypeField(data.operationType);
  
  // Обновляем поля ИНН, КПП, ОГРН/ОГРНИП в зависимости от значений в панели управления
  updateInnField(data.inn);
  updateKppField(data.kpp);
  updateOgrnField(data.ogrn);
  updateZayavitelField(data.zayavitel);
  updateFioApplicantFields(data.fioApplicant);
  updateDateFields(data.applicationDate);
  
  // Обновляем поле "Дата заявления" в панели управления на основе полей в PDF
  // Используем setTimeout чтобы избежать циклических обновлений
  setTimeout(() => {
    updateApplicationDateFromPDF();
  }, 100);
  
  // Добавляем глобальную функцию для тестирования
  window.testDateUpdate = updateApplicationDateFromPDF;
}

// Функция транслитерации кириллицы в латиницу
function transliterateToLatin(text) {
  const transliterationMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  
  return text.split('').map(char => transliterationMap[char] || char).join('');
}

// Создание безопасного имени переменной из кириллического текста
function createSafeVariableName(text) {
  // Сначала транслитерируем
  let result = transliterateToLatin(text);
  
  // Убираем все символы, кроме букв, цифр и подчеркиваний
  result = result.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Если начинается с цифры, добавляем префикс
  if (result.match(/^\d/)) {
    result = 'field' + result;
  }
  
  // Если пустая строка, создаем базовое имя
  if (!result) {
    result = 'field';
  }
  
  return result;
}

// Обновление поля "Вид документа" в зависимости от типа операции
function updateDocTypeField(operationType) {
  // Определяем значение поля "Вид документа"
  const docTypeValue = operationType === 'reregistration' ? '2' : '1';
  
  // Находим все элементы поля "Вид документа" в превью
  const canvas = preview.querySelector('.sheet__canvas');
  if (!canvas) return;
  
  const docTypeElements = canvas.querySelectorAll('.overlay-char[data-field-name="Вид документа"]');
  
  // Обновляем значение каждого символа
  docTypeElements.forEach((element, index) => {
    if (index === 0) {
      // Первый символ - это значение (1 или 2)
      element.textContent = docTypeValue;
      // Принудительно обновляем стили для отображения
      element.style.display = 'block';
      element.style.visibility = 'visible';
      element.style.opacity = '1';
      // Убираем выделение - делаем прозрачным фон и убираем границу
      element.style.background = 'transparent !important';
      element.style.border = 'none !important';
    } else {
      // Остальные символы - пустые
      element.textContent = '';
      // Убираем выделение и для пустых символов
      element.style.background = 'transparent !important';
      element.style.border = 'none !important';
    }
  });
}

// Обновление поля ИНН в превью
function updateInnField(innValue) {
  logger.debug('Обновление поля ИНН:', 'fields');
  
  // Ограничиваем ИНН до 12 символов
  const limitedInnValue = (innValue || '').substring(0, 12);
  
  // Обновляем поля на всех страницах
  Object.values(pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (!canvas) return;
    
    // Ищем элементы ИНН на текущей странице
    const innElements = canvas.querySelectorAll('.overlay-char[data-field-name^="ИНН"]');
    logger.debug(`Найдено элементов ИНН на странице: ${innElements.length}`, 'fields');
  
  // Заполняем символы значением ИНН
    if (limitedInnValue && limitedInnValue.trim() !== '' && limitedInnValue !== '000000000000') {
      const innString = limitedInnValue.toString().toUpperCase();
      logger.debug('Заполняем ИНН строкой:', innString, 'fields');
      
      innElements.forEach((element, index) => {
        if (index < innString.length) {
          const char = innString[index];
          element.textContent = char;
          element.style.setProperty('color', '#000', 'important');
          element.style.setProperty('font-size', '18px', 'important');
          element.style.setProperty('font-weight', '700', 'important');
          element.setAttribute('data-has-data', 'true');
        } else {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        }
      });
  } else {
    // Если данные не введены, показываем предзаполненные значения по умолчанию
    const defaultInnString = '000000000000';
    
      innElements.forEach((element, index) => {
        if (index < defaultInnString.length) {
          const char = defaultInnString[index];
          element.textContent = char;
          element.style.setProperty('color', '#999', 'important');
          element.style.setProperty('font-size', '18px', 'important');
          element.style.setProperty('font-weight', '700', 'important');
          element.setAttribute('data-has-data', 'false');
        } else {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        }
      });
    }
    });
}

// Обновление поля КПП в превью
function updateKppField(kppValue) {
  logger.debug('Обновление поля КПП:', 'fields');
  
  // Ограничиваем КПП до 9 символов
  const limitedKppValue = (kppValue || '').substring(0, 9);
  
  // Обновляем поля на всех страницах
  Object.values(pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (!canvas) return;
    
    // Ищем элементы КПП на текущей странице
    const kppElements = canvas.querySelectorAll('.overlay-char[data-field-name^="КПП"]');
    logger.debug(`Найдено элементов КПП на странице: ${kppElements.length}`, 'fields');
  
  // Заполняем символы значением КПП
    if (limitedKppValue && limitedKppValue.trim() !== '' && limitedKppValue !== '000000000') {
      const kppString = limitedKppValue.toString().toUpperCase();
      logger.debug('Заполняем КПП строкой:', kppString, 'fields');
      
      kppElements.forEach((element, index) => {
        if (index < kppString.length) {
          const char = kppString[index];
          element.textContent = char;
          element.style.setProperty('color', '#000', 'important');
          element.style.setProperty('font-size', '18px', 'important');
          element.style.setProperty('font-weight', '700', 'important');
          element.setAttribute('data-has-data', 'true');
        } else {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        }
      });
  } else {
    // Если данные не введены, показываем предзаполненные значения по умолчанию
    const defaultKppString = '000000000';
    
      kppElements.forEach((element, index) => {
        if (index < defaultKppString.length) {
          const char = defaultKppString[index];
          element.textContent = char;
          element.style.setProperty('color', '#999', 'important');
          element.style.setProperty('font-size', '18px', 'important');
          element.style.setProperty('font-weight', '700', 'important');
          element.setAttribute('data-has-data', 'false');
        } else {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        }
      });
    }
    });
}

// Обновление поля ОГРН/ОГРНИП в превью
function updateOgrnField(ogrnValue) {
  logger.debug('Обновление поля ОГРН:', 'fields');
  
  // Ограничиваем ОГРН до 15 символов
  const limitedOgrnValue = (ogrnValue || '').substring(0, 15);
  
  // Обновляем поля на всех страницах
  Object.values(pageElements).forEach(pageElement => {
    const canvas = pageElement.querySelector('.sheet__canvas');
    if (!canvas) return;
    
    // Ищем элементы ОГРН на текущей странице
  const ogrnElements = canvas.querySelectorAll('.overlay-char[data-field-name^="ОГРН"]');
    logger.debug(`Найдено элементов ОГРН на странице: ${ogrnElements.length}`, 'fields');
  
  // Заполняем символы значением ОГРН/ОГРНИП
    if (limitedOgrnValue && limitedOgrnValue.trim() !== '' && limitedOgrnValue !== '000000000000000') {
      const ogrnString = limitedOgrnValue.toString().toUpperCase();
      logger.debug('Заполняем ОГРН/ОГРНИП строкой:', ogrnString, 'fields');
      
    ogrnElements.forEach((element, index) => {
        if (index < ogrnString.length) {
          const char = ogrnString[index];
        element.textContent = char;
        element.style.setProperty('color', '#000', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
          element.setAttribute('data-has-data', 'true');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
  } else {
    // Если данные не введены, показываем предзаполненные значения по умолчанию
    const defaultOgrnString = '000000000000000';
      
      ogrnElements.forEach((element, index) => {
        if (index < defaultOgrnString.length) {
          const char = defaultOgrnString[index];
        element.textContent = char;
          element.style.setProperty('color', '#999', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
          element.setAttribute('data-has-data', 'false');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
  }
  });
}

// Обновление полей названий организации в превью
function updateOrgNameFields(orgNameValue, applicantType) {
  const canvas = preview.querySelector('.sheet__canvas');
  if (!canvas) {
    logger.warn('Canvas не найден для обновления названий организации', 'canvas');
    return;
  }
  
  // Очищаем все поля названий организации
  const orgName1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="Название организации 1"]');
  const orgName2Elements = canvas.querySelectorAll('.overlay-char[data-field-name="Название организации 2"]');
  const orgName3Elements = canvas.querySelectorAll('.overlay-char[data-field-name="Название организации 3"]');
  
  // Добавляем префиксы для разных типов организаций
  let fullOrgNameString = '';
  let prefix = '';
  if (applicantType === 'ip') {
    prefix = 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ';
  } else if (applicantType === 'ooo') {
    prefix = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ';
  } else if (applicantType === 'ao') {
    prefix = 'АКЦИОНЕРНОЕ ОБЩЕСТВО ';
  }
  
  if (prefix) {
    fullOrgNameString = orgNameValue && orgNameValue.trim() !== '' 
      ? prefix + orgNameValue.toString().toUpperCase() 
      : prefix;
  } else {
    fullOrgNameString = orgNameValue ? orgNameValue.toString().toUpperCase() : '';
  }
  
  // Разбиваем на части по 40 символов
  if (fullOrgNameString && fullOrgNameString.trim() !== '') {
    const parts = [];
    let currentIndex = 0;
    
    while (currentIndex < fullOrgNameString.length) {
      let part = fullOrgNameString.slice(currentIndex, currentIndex + 40);
      
      // Если последний символ пробел, удаляем его и переходим к следующему символу
      if (part.length === 40 && part[39] === ' ') {
        part = part.slice(0, 39);
        // Увеличиваем индекс, чтобы пропустить пробел при следующей итерации
        currentIndex += 40;
      } else {
        currentIndex += 40;
      }
      
      // Если первый символ пробел и это не первая строка, удаляем пробел
      if (parts.length > 0 && part.length > 0 && part[0] === ' ') {
        part = part.slice(1);
      }
      
      parts.push(part);
    }
    
               // Заполняем первое поле
               if (parts[0]) {
                 orgName1Elements.forEach((element, index) => {
                   if (index < parts[0].length) {
                     element.textContent = parts[0][index];
                     element.style.setProperty('color', '#000', 'important');
                     element.setAttribute('data-has-data', 'true');
                   } else {
                     element.textContent = '0';
                     element.style.setProperty('color', '#999', 'important');
                     element.setAttribute('data-has-data', 'false');
                   }
                 });
               }
    
    // Заполняем второе поле
    if (parts[1]) {
      orgName2Elements.forEach((element, index) => {
        if (index < parts[1].length) {
          element.textContent = parts[1][index];
          element.style.setProperty('color', '#000', 'important');
          element.setAttribute('data-has-data', 'true');
        } else {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        }
      });
    } else {
      // Очищаем второе поле если его нет
      orgName2Elements.forEach((element) => {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      });
    }
    
    // Заполняем третье поле
    if (parts[2]) {
      orgName3Elements.forEach((element, index) => {
        if (index < parts[2].length) {
          element.textContent = parts[2][index];
          element.style.setProperty('color', '#000', 'important');
          element.setAttribute('data-has-data', 'true');
        } else {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        }
      });
    } else {
      // Очищаем третье поле если его нет
      orgName3Elements.forEach((element) => {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      });
    }
  } else {
    // Если fullOrgNameString пуста, очищаем все поля
    orgName1Elements.forEach((element) => {
      element.textContent = '0';
      element.style.setProperty('color', '#999', 'important');
      element.setAttribute('data-has-data', 'false');
    });
    orgName2Elements.forEach((element) => {
      element.textContent = '';
      element.setAttribute('data-has-data', 'false');
    });
    orgName3Elements.forEach((element) => {
      element.textContent = '';
      element.setAttribute('data-has-data', 'false');
    });
  }
}

// Обновление поля "Заявитель"
function updateZayavitelField(zayavitelValue) {
  logger.debug('Обновление поля Заявитель:', 'fields');
  const canvas = preview.querySelector('.sheet__canvas');
  if (!canvas) {
    logger.warn('Canvas не найден для обновления Заявитель', 'canvas');
    return;
  }
  
  const zayavitelElements = canvas.querySelectorAll('.overlay-char[data-field-name="Заявитель"]');
  logger.debug('Найдено элементов Заявитель:', 'fields');
  
  // Значение по умолчанию - "1" (пользователь)
  const defaultValue = '1';
  const displayValue = zayavitelValue || defaultValue;
  
  // Заполняем поле значением
  zayavitelElements.forEach((element, index) => {
    if (index < displayValue.length) {
      const char = displayValue[index];
      element.textContent = char;
      element.style.setProperty('color', '#000', 'important');
      element.style.setProperty('font-size', '18px', 'important');
      element.style.setProperty('font-weight', '700', 'important');
      element.setAttribute('data-has-data', 'true');
    } else {
      element.textContent = '';
      element.setAttribute('data-has-data', 'false');
    }
  });
}

// Обновление полей ФИО заявителя
function updateFioApplicantFields(fioApplicantValue) {
  logger.debug('Обновление полей ФИО заявителя:', 'fields');
  const canvas = preview.querySelector('.sheet__canvas');
  if (!canvas) {
    logger.warn('Canvas не найден для обновления ФИО заявителя', 'canvas');
    return;
  }
  
  const fio1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="ФИО Руководителя 1"]');
  const fio2Elements = canvas.querySelectorAll('.overlay-char[data-field-name="ФИО Руководителя 2"]');
  const fio3Elements = canvas.querySelectorAll('.overlay-char[data-field-name="ФИО Руководителя 3"]');
  
  console.log('Найдено элементов ФИО 1:', fio1Elements.length);
  console.log('Найдено элементов ФИО 2:', fio2Elements.length);
  console.log('Найдено элементов ФИО 3:', fio3Elements.length);
  
  // Значение по умолчанию - строка из нулей (60 символов для трех полей по 20)
  const defaultValue = '000000000000000000000000000000000000000000000000000000000000';
  
  if (fioApplicantValue && fioApplicantValue.trim() !== '') {
    // Преобразуем в верхний регистр, но сохраняем пробелы
    let fioString = fioApplicantValue.toString().toUpperCase();
    
    console.log('Введенный текст:', fioString, 'длина:', fioString.length);
    
    // Разбиваем на части по 20 символов (без дополнения нулями)
    const part1 = fioString.substring(0, 20);
    const part2 = fioString.substring(20, 40);
    const part3 = fioString.substring(40, 60);
    
    console.log('Часть 1 (20 символов):', part1, 'длина:', part1.length);
    console.log('Часть 2 (20 символов):', part2, 'длина:', part2.length);
    console.log('Часть 3 (20 символов):', part3, 'длина:', part3.length);
    
    // Заполняем первое поле
    fio1Elements.forEach((element, index) => {
      if (index < part1.length) {
        element.textContent = part1[index];
        element.style.setProperty('color', '#000', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
        element.setAttribute('data-has-data', 'true');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
    
    // Заполняем второе поле
    fio2Elements.forEach((element, index) => {
      if (index < part2.length) {
        element.textContent = part2[index];
        element.style.setProperty('color', '#000', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
        element.setAttribute('data-has-data', 'true');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
    
    // Заполняем третье поле
    fio3Elements.forEach((element, index) => {
      if (index < part3.length) {
        element.textContent = part3[index];
        element.style.setProperty('color', '#000', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
        element.setAttribute('data-has-data', 'true');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
    
  } else {
    // Если поле пустое, заполняем предзаполненными значениями (нули)
    const defaultPart1 = defaultValue.substring(0, 20);
    const defaultPart2 = defaultValue.substring(20, 40);
    const defaultPart3 = defaultValue.substring(40, 60);
    
    // Заполняем первое поле предзаполненными значениями
    fio1Elements.forEach((element, index) => {
      if (index < defaultPart1.length) {
        element.textContent = defaultPart1[index];
        element.style.setProperty('color', '#999', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
        element.setAttribute('data-has-data', 'false');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
    
    // Заполняем второе поле предзаполненными значениями
    fio2Elements.forEach((element, index) => {
      if (index < defaultPart2.length) {
        element.textContent = defaultPart2[index];
        element.style.setProperty('color', '#999', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
        element.setAttribute('data-has-data', 'false');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
    
    // Заполняем третье поле предзаполненными значениями
    fio3Elements.forEach((element, index) => {
      if (index < defaultPart3.length) {
        element.textContent = defaultPart3[index];
        element.style.setProperty('color', '#999', 'important');
        element.style.setProperty('font-size', '18px', 'important');
        element.style.setProperty('font-weight', '700', 'important');
        element.setAttribute('data-has-data', 'false');
      } else {
        element.textContent = '';
        element.setAttribute('data-has-data', 'false');
      }
    });
  }
}

// Обновление полей даты заявления
function updateDateFields(applicationDateValue) {
  logger.debug('=== ОБНОВЛЕНИЕ ПОЛЕЙ ДАТЫ ЗАЯВЛЕНИЯ ===', 'fields');
  logger.debug('Входное значение:', 'fields');
  const canvas = preview.querySelector('.sheet__canvas');
  if (!canvas) {
    logger.warn('Canvas не найден для обновления даты', 'canvas');
    return;
  }
  
  const dd1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="дд1"]');
  const mm1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="мм1"]');
  const gggg1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="гггг1"]');
  
  logger.debug('Найдено элементов дд1:', 'fields');
  logger.debug('Найдено элементов мм1:', 'fields');
  logger.debug('Найдено элементов гггг1:', 'fields');
  
  if (applicationDateValue && applicationDateValue.trim() !== '') {
    try {
      // Парсим дату
      const date = new Date(applicationDateValue);
      
      if (!isNaN(date.getTime())) {
        // Извлекаем компоненты даты
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        
        logger.debug('День:', 'fields');
        
        // Заполняем поле дня (дд1)
        dd1Elements.forEach((element, index) => {
          if (index < day.length) {
            element.textContent = day[index];
            element.style.setProperty('color', '#000', 'important');
            element.style.setProperty('font-size', '18px', 'important');
            element.style.setProperty('font-weight', '700', 'important');
            element.setAttribute('data-has-data', 'true');
          } else {
            element.textContent = '';
            element.setAttribute('data-has-data', 'false');
          }
        });
        
        // Заполняем поле месяца (мм1)
        mm1Elements.forEach((element, index) => {
          if (index < month.length) {
            element.textContent = month[index];
            element.style.setProperty('color', '#000', 'important');
            element.style.setProperty('font-size', '18px', 'important');
            element.style.setProperty('font-weight', '700', 'important');
            element.setAttribute('data-has-data', 'true');
          } else {
            element.textContent = '';
            element.setAttribute('data-has-data', 'false');
          }
        });
        
        // Заполняем поле года (гггг1)
        gggg1Elements.forEach((element, index) => {
          if (index < year.length) {
            element.textContent = year[index];
            element.style.setProperty('color', '#000', 'important');
            element.style.setProperty('font-size', '18px', 'important');
            element.style.setProperty('font-weight', '700', 'important');
            element.setAttribute('data-has-data', 'true');
          } else {
            element.textContent = '';
            element.setAttribute('data-has-data', 'false');
          }
        });
        
        // Заполняем поля DateStr2-DateStr10 в формате "дд.мм.гг"
        const dateStr = `${day}.${month}.${year.slice(-2)}`;
        
        // Получаем canvas для каждой страницы
        for (let page = 2; page <= 10; page++) {
          const pageCanvas = window.pageElements[page]?.querySelector('.sheet__canvas');
          if (pageCanvas) {
            const fieldName = `DateStr${page}`;
            const dateStrElements = pageCanvas.querySelectorAll(`.overlay-char[data-field-name="${fieldName}"]`);
            
            // Заполняем поле
            dateStrElements.forEach((element, index) => {
              if (index < dateStr.length) {
                element.textContent = dateStr[index];
                element.style.setProperty('color', '#000', 'important');
                element.setAttribute('data-has-data', 'true');
              } else {
                element.textContent = '';
                element.setAttribute('data-has-data', 'false');
              }
            });
          }
        }
        
      } else {
        logger.warn('Неверный формат даты:', 'validation');
        // Если дата неверная, заполняем предзаполненными значениями
        fillDateFieldsWithDefaults(dd1Elements, mm1Elements, gggg1Elements);
        
        // Очищаем поля DateStr2-DateStr10
        for (let page = 2; page <= 10; page++) {
          const pageCanvas = window.pageElements[page]?.querySelector('.sheet__canvas');
          if (pageCanvas) {
            const fieldName = `DateStr${page}`;
            const dateStrElements = pageCanvas.querySelectorAll(`.overlay-char[data-field-name="${fieldName}"]`);
            dateStrElements.forEach((element) => {
              element.textContent = '';
              element.setAttribute('data-has-data', 'false');
            });
          }
        }
      }
    } catch (error) {
      logger.error('Ошибка парсинга даты:', 'error');
      // Если ошибка парсинга, заполняем предзаполненными значениями
      fillDateFieldsWithDefaults(dd1Elements, mm1Elements, gggg1Elements);
      
      // Очищаем поля DateStr2-DateStr10
      for (let page = 2; page <= 10; page++) {
        const pageCanvas = window.pageElements[page]?.querySelector('.sheet__canvas');
        if (pageCanvas) {
          const fieldName = `DateStr${page}`;
          const dateStrElements = pageCanvas.querySelectorAll(`.overlay-char[data-field-name="${fieldName}"]`);
          dateStrElements.forEach((element) => {
            element.textContent = '';
            element.setAttribute('data-has-data', 'false');
          });
        }
      }
    }
  } else {
    // Если поле пустое, заполняем предзаполненными значениями
    fillDateFieldsWithDefaults(dd1Elements, mm1Elements, gggg1Elements);
    
    // Очищаем поля DateStr2-DateStr10
    for (let page = 2; page <= 10; page++) {
      const pageCanvas = window.pageElements[page]?.querySelector('.sheet__canvas');
      if (pageCanvas) {
        const fieldName = `DateStr${page}`;
        const dateStrElements = pageCanvas.querySelectorAll(`.overlay-char[data-field-name="${fieldName}"]`);
        dateStrElements.forEach((element) => {
          element.textContent = '';
          element.setAttribute('data-has-data', 'false');
        });
      }
    }
  }
}

// Вспомогательная функция для заполнения полей даты предзаполненными значениями
function fillDateFieldsWithDefaults(dd1Elements, mm1Elements, gggg1Elements) {
  const defaultDay = '00';
  const defaultMonth = '00';
  const defaultYear = '0000';
  
  // Заполняем поле дня предзаполненными значениями
  dd1Elements.forEach((element, index) => {
    if (index < defaultDay.length) {
      element.textContent = defaultDay[index];
      element.style.setProperty('color', '#999', 'important');
      element.style.setProperty('font-size', '18px', 'important');
      element.style.setProperty('font-weight', '700', 'important');
      element.setAttribute('data-has-data', 'false');
    } else {
      element.textContent = '';
      element.setAttribute('data-has-data', 'false');
    }
  });
  
  // Заполняем поле месяца предзаполненными значениями
  mm1Elements.forEach((element, index) => {
    if (index < defaultMonth.length) {
      element.textContent = defaultMonth[index];
      element.style.setProperty('color', '#999', 'important');
      element.style.setProperty('font-size', '18px', 'important');
      element.style.setProperty('font-weight', '700', 'important');
      element.setAttribute('data-has-data', 'false');
    } else {
      element.textContent = '';
      element.setAttribute('data-has-data', 'false');
    }
  });
  
  // Заполняем поле года предзаполненными значениями
  gggg1Elements.forEach((element, index) => {
    if (index < defaultYear.length) {
      element.textContent = defaultYear[index];
      element.style.setProperty('color', '#999', 'important');
      element.style.setProperty('font-size', '18px', 'important');
      element.style.setProperty('font-weight', '700', 'important');
      element.setAttribute('data-has-data', 'false');
    } else {
      element.textContent = '';
      element.setAttribute('data-has-data', 'false');
    }
  });
}

// Функция updateDataStrFields удалена - поля DataStr2-DataStr10 находились за пределами видимых страниц

// Функция updateDataStrFieldsWithDefaults удалена - поля DataStr2-DataStr10 находились за пределами видимых страниц

// Обновление поля "Дата заявления" в панели управления на основе полей в PDF
function updateApplicationDateFromPDF() {
  logger.debug('=== ОБНОВЛЕНИЕ ПОЛЯ "ДАТА ЗАЯВЛЕНИЯ" ИЗ PDF ===', 'fields');
  const canvas = preview.querySelector('.sheet__canvas');
  if (!canvas) {
    logger.warn('Canvas не найден для обновления даты заявления', 'canvas');
    return;
  }
  
  const dd1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="дд1"]');
  const mm1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="мм1"]');
  const gggg1Elements = canvas.querySelectorAll('.overlay-char[data-field-name="гггг1"]');
  
  logger.debug('Найдено элементов дд1:', 'fields');
  logger.debug('Найдено элементов мм1:', 'fields');
  logger.debug('Найдено элементов гггг1:', 'fields');
  
  // Собираем значения из полей PDF
  const day = Array.from(dd1Elements).map(el => el.textContent).join('').trim();
  const month = Array.from(mm1Elements).map(el => el.textContent).join('').trim();
  const year = Array.from(gggg1Elements).map(el => el.textContent).join('').trim();
  
  logger.debug('Значения из PDF - День:', 'fields');
  logger.debug('Длина значений - День:', 'fields');
  
  // Проверяем, что хотя бы одно поле заполнено и не содержит только нули
  const hasValidDay = day && day !== '00' && day.length === 2;
  const hasValidMonth = month && month !== '00' && month.length === 2;
  const hasValidYear = year && year !== '0000' && year.length === 4;
  
  logger.debug('Проверка полей - День:', 'fields');
  
  if (hasValidDay || hasValidMonth || hasValidYear) {
    try {
      // Используем текущую дату как основу, если какое-то поле не заполнено
      const now = new Date();
      const defaultDay = now.getDate().toString().padStart(2, '0');
      const defaultMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const defaultYear = now.getFullYear().toString();
      
      // Заменяем пустые поля значениями по умолчанию
      const finalDay = hasValidDay ? day : defaultDay;
      const finalMonth = hasValidMonth ? month : defaultMonth;
      const finalYear = hasValidYear ? year : defaultYear;
      
      // Формируем дату в формате YYYY-MM-DD
      const dateString = `${finalYear}-${finalMonth.padStart(2, '0')}-${finalDay.padStart(2, '0')}`;
      const date = new Date(dateString);
      
      if (!isNaN(date.getTime())) {
        // Обновляем поле "Дата заявления" в панели управления
        const applicationDateInput = document.getElementById('applicationDate');
        if (applicationDateInput) {
          applicationDateInput.value = dateString;
          logger.debug('Поле "Дата заявления" обновлено:', 'fields');
        }
      } else {
        logger.warn('Неверная дата:', 'validation');
      }
    } catch (error) {
      logger.error('Ошибка при формировании даты:', 'error');
    }
  } else {
    logger.warn('Ни одно поле даты не заполнено корректно', 'validation');
  }
}

// Восстановление позиций после перерисовки
function restorePositions() {
  if (Object.keys(originalPositions).length > 0) {
    const canvas = preview.querySelector('.sheet__canvas');
    if (canvas) {
      const elements = canvas.querySelectorAll('.overlay-text, .overlay-char');
      elements.forEach((element, index) => {
        if (originalPositions[index]) {
          element.style.left = originalPositions[index].left + 'mm';
          element.style.top = originalPositions[index].top + 'mm';
        }
      });
      
      // Обработчики событий уже установлены в window.placeChars()
    }
  }
}

form.addEventListener('input', updatePreview);
form.addEventListener('change', updatePreview);
form.addEventListener('reset', () => {
  setTimeout(updatePreview, 0);
});

// Обработчик для поля "Модель ФН"
document.addEventListener('DOMContentLoaded', () => {
  const fnModelSelect = document.getElementById('fnModel');
  const fnModelOtherContainer = document.getElementById('fnModelOtherContainer');
  const fnModelOtherInput = document.getElementById('fnModelOther');
  
  if (fnModelSelect && fnModelOtherContainer && fnModelOtherInput) {
    fnModelSelect.addEventListener('change', (e) => {
      if (e.target.value === 'other') {
        fnModelOtherContainer.style.display = 'block';
        fnModelOtherInput.required = true;
      } else {
        fnModelOtherContainer.style.display = 'none';
        fnModelOtherInput.required = false;
        fnModelOtherInput.value = '';
      }
    });
  }

  // Обработчик для поля "Наименование (ФИО для ИП)" - преобразование в верхний регистр
  const orgNameInput = document.getElementById('orgName');
  if (orgNameInput) {
    orgNameInput.addEventListener('input', (e) => {
      // Сохраняем позицию курсора
      const cursorPosition = e.target.selectionStart;
      
      // Преобразуем текст в верхний регистр
      const upperCaseValue = e.target.value.toUpperCase();
      
      // Обновляем значение поля
      e.target.value = upperCaseValue;
      
      // Восстанавливаем позицию курсора
      e.target.setSelectionRange(cursorPosition, cursorPosition);
      
      // Обновляем превью
      updatePreview();
    });
  }

  // Обработчики автозаполнения через DaData API
  const innInput = document.getElementById('inn');
  const ogrnInput = document.getElementById('ogrn');
  
  // Флаг автозаполнения - чтобы не добавлять префиксы при автозаполнении
  let isAutoFillMode = false;
  
  // Обработчик для поля ИНН
  if (innInput) {
    let innTimeout;
    innInput.addEventListener('input', (e) => {
      clearTimeout(innTimeout);
      
      // Ждем 1 секунду после остановки ввода перед запросом
      innTimeout = setTimeout(async () => {
        const innValue = e.target.value.trim();
        
        // Проверяем, что введено не менее 10 символов (минимальный ИНН)
        if (innValue.length >= 10 && innValue.length <= 12) {
          console.log('Запрос данных по ИНН:', innValue);
          const orgData = await fetchOrganizationData(innValue);
          if (orgData) {
            isAutoFillMode = true; // Устанавливаем флаг автозаполнения
            fillOrganizationFields(orgData);
            isAutoFillMode = false; // Сбрасываем флаг после заполнения
          }
        }
      }, 1000);
    });
  }
  
  // Обработчик для поля ОГРН
  if (ogrnInput) {
    let ogrnTimeout;
    ogrnInput.addEventListener('input', (e) => {
      clearTimeout(ogrnTimeout);
      
      // Ждем 1 секунду после остановки ввода перед запросом
      ogrnTimeout = setTimeout(async () => {
        const ogrnValue = e.target.value.trim();
        
        // Проверяем, что введено не менее 13 символов (минимальный ОГРН)
        if (ogrnValue.length >= 13 && ogrnValue.length <= 15) {
          console.log('Запрос данных по ОГРН:', ogrnValue);
          const orgData = await fetchOrganizationData(ogrnValue);
          if (orgData) {
            isAutoFillMode = true; // Устанавливаем флаг автозаполнения
            fillOrganizationFields(orgData);
            isAutoFillMode = false; // Сбрасываем флаг после заполнения
          }
        }
      }, 1000);
    });
  }
  
  // Делаем флаг глобальным
  window.isAutoFillMode = isAutoFillMode;

  // Обработчики для полей operationType, zayavitel и applicantType
  const operationTypeSelect = document.getElementById('operationType');
  const zayavitelSelect = document.getElementById('zayavitel');
  const applicantTypeSelect = document.getElementById('applicantType');
  
  if (operationTypeSelect) {
    operationTypeSelect.addEventListener('change', updatePreview);
  }
  
  if (zayavitelSelect) {
    zayavitelSelect.addEventListener('change', updatePreview);
  }
  
  if (applicantTypeSelect) {
    applicantTypeSelect.addEventListener('change', updatePreview);
  }

});


// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  // Загружаем встроенный шаблон
  loadBundledTemplate();
  
  // Инициализируем редактор позиций
  initializeAdvancedEditor();
});

function validate() {
  let ok = true;
  const requiredIds = ['inn', 'orgName', 'address', 'kktModel', 'kktSerial', 'fnModel', 'ofd', 'ifnsCode', 'applicationDate', 'headName'];
  requiredIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const parent = el.closest('.field') || el.parentElement;
    el.setCustomValidity('');
    parent?.classList.remove('field--error');

    if (!el.value.trim()) {
      el.setCustomValidity('Поле обязательно');
      parent?.classList.add('field--error');
      ok = false;
      return;
    }

    if (el.id === 'inn' && !/^\d{10}$|^\d{12}$/.test(el.value.trim())) {
      el.setCustomValidity('ИНН: 10 или 12 цифр');
      parent?.classList.add('field--error');
      ok = false;
    }

    if (el.id === 'ifnsCode' && !/^\d{4}$/.test(el.value.trim())) {
      el.setCustomValidity('Код ИФНС: 4 цифры');
      parent?.classList.add('field--error');
      ok = false;
    }
  });
  return ok;
}


// инициализация
// updatePreview() вызывается автоматически из loadBundledTemplate()

// === Оверлеи: утилиты ===



function renderOverlays(data) {
  window.clearOverlays();
  const digits = (s) => (s || '').replace(/\D+/g, '');
  const upper = (s) => (s || '').toString().toUpperCase();

  // Фиксированные по инструкции значения
  const pagesTotal = 10;
  const copiesTotal = 10;
  const docType = '1';

  // === ПОЛЯ БУДУТ ДОБАВЛЕНЫ ЧЕРЕЗ РЕДАКТОР ===
  // Все поля теперь создаются и управляются через редактор позиций

 // === ОБНОВЛЕННЫЕ ПОЗИЦИИ ПОЛЕЙ ===
// Сгенерировано автоматически из редактора позиций

  // ИНН - дублируем на все страницы (макс 12 символов)
  const innText = (data.inn || '000000000000').substring(0, 12).padEnd(12, '0');
  const hasInnData = data.inn && data.inn.trim() !== '' && data.inn !== '000000000000';
  logger.debug('Создание полей ИНН:', 'fields');
  for (let page = 1; page <= 10; page++) {
    const fieldName = page === 1 ? 'ИНН' : `ИНН${page}`;
    window.placeChars(page, 74.6032, 28.3069, innText, CELL_WIDTH_MM, CELL_GAP_MM, { 
      color: data.inn ? '#000 !important' : '#999 !important', 
      fieldName: fieldName,
      hasData: hasInnData
    });
  }

  // КПП - дублируем на все страницы (макс 9 символов)
  const kppText = (data.kpp || '000000000').substring(0, 9).padEnd(9, '0');
  const hasKppData = data.kpp && data.kpp.trim() !== '' && data.kpp !== '000000000';
  logger.debug('Создание полей КПП:', 'fields');
  for (let page = 1; page <= 10; page++) {
    const fieldName = page === 1 ? 'КПП' : `КПП${page}`;
    window.placeChars(page, 74.6032, 37.5661, kppText, CELL_WIDTH_MM, CELL_GAP_MM, { 
      color: data.kpp ? '#000 !important' : '#999 !important', 
      fieldName: fieldName,
      hasData: hasKppData
    });
  }

  // Вид документа
  const docTypeText = data.docType || '1';
  window.placeChars(1, 55.8201, 68.2538, docTypeText, CELL_WIDTH_MM, CELL_GAP_MM, { 
    color: '#000', 
    fieldName: 'Вид документа',
    noHighlight: true // Специальный флаг для отключения выделения
  });

  // Название организации 1
  const Nazvanieorganizatsii1Text = data.Nazvanieorganizatsii1 || '0000000000000000000000000000000000000000';
  const hasOrgName1Data = data.Nazvanieorganizatsii1 && data.Nazvanieorganizatsii1.trim() !== '' && data.Nazvanieorganizatsii1 !== '0000000000000000000000000000000000000000';
  window.placeChars(1, 18.254, 95.7672, Nazvanieorganizatsii1Text, CELL_WIDTH_MM, CELL_GAP_MM, { 
    color: data.Nazvanieorganizatsii1 ? '#000 !important' : '#999 !important', 
    fieldName: 'Название организации 1',
    hasData: hasOrgName1Data
  });
  
  // Название организации 2
  const Nazvanieorganizatsii2Text = data.Nazvanieorganizatsii2 || '0000000000000000000000000000000000000000';
  const hasOrgName2Data = data.Nazvanieorganizatsii2 && data.Nazvanieorganizatsii2.trim() !== '' && data.Nazvanieorganizatsii2 !== '0000000000000000000000000000000000000000';
  window.placeChars(1, 18.254, 106.878, Nazvanieorganizatsii2Text, CELL_WIDTH_MM, CELL_GAP_MM, { 
    color: data.Nazvanieorganizatsii2 ? '#000 !important' : '#999 !important', 
    fieldName: 'Название организации 2',
    hasData: hasOrgName2Data
  });

  // Название организации 3
  const Nazvanieorganizatsii3Text = data.Nazvanieorganizatsii3 || '0000000000000000000000000000000000000000';
  const hasOrgName3Data = data.Nazvanieorganizatsii3 && data.Nazvanieorganizatsii3.trim() !== '' && data.Nazvanieorganizatsii3 !== '0000000000000000000000000000000000000000';
  window.placeChars(1, 18.254, 117.725, Nazvanieorganizatsii3Text, CELL_WIDTH_MM, CELL_GAP_MM, { 
    color: data.Nazvanieorganizatsii3 ? '#000 !important' : '#999 !important', 
    fieldName: 'Название организации 3',
    hasData: hasOrgName3Data
  });
  
  // Стр 002 - страница 2
  const Str002Text = data.Str002 || '002';
  window.placeChars(2, 126.3, 38.1, Str002Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str002 ? '#000' : '#999', fieldName: 'Стр 002', noHighlight: true });

  // Стр003 - страница 3
  const Str003Text = data.Str003 || '003';
  window.placeChars(3, 126.3, 38.1, Str003Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str003 ? '#000' : '#999', fieldName: 'Стр003', noHighlight: true });
  
  // DateStr2 - на странице 2
  const DateStr2Text = data.DateStr2 || '00.00.00';
  window.placeChars(2, 152.3, 247.3, DateStr2Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr2 ? '#000' : '#999', fieldName: 'DateStr2' });
  
  // Str004 - страница 4
  const Str004Text = data.Str004 || '004';
  window.placeChars(4, 126.3, 38.1, Str004Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str004 ? '#000' : '#999', fieldName: 'Str004', noHighlight: true });

  // DateStr3 - на странице 3
  const DateStr3Text = data.DateStr3 || '00.00.00';
  window.placeChars(3, 152.3, 247.3, DateStr3Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr3 ? '#000' : '#999', fieldName: 'DateStr3' });

  // Str005 - страница 5
  const Str005Text = data.Str005 || '005';
  window.placeChars(5, 126.3, 38.1, Str005Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str005 ? '#000' : '#999', fieldName: 'Str005', noHighlight: true });

  // DateStr4 - на странице 4
  const DateStr4Text = data.DateStr4 || '00.00.00';
  window.placeChars(4, 152.3, 247.3, DateStr4Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr4 ? '#000' : '#999', fieldName: 'DateStr4' });

  // Str006 - страница 6
  const Str006Text = data.Str006 || '006';
  window.placeChars(6, 126.3, 38.1, Str006Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str006 ? '#000' : '#999', fieldName: 'Str006', noHighlight: true });

  // DateStr5 - на странице 5
  const DateStr5Text = data.DateStr5 || '00.00.00';
  window.placeChars(5, 152.7, 258.4, DateStr5Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr5 ? '#000' : '#999', fieldName: 'DateStr5' });

  // Str007 - страница 7
  const Str007Text = data.Str007 || '007';
  window.placeChars(7, 126.3, 38.1, Str007Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str007 ? '#000' : '#999', fieldName: 'Str007', noHighlight: true });

  // DateStr6 - на странице 6
  const DateStr6Text = data.DateStr6 || '00.00.00';
  window.placeChars(6, 152.4, 250.7, DateStr6Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr6 ? '#000' : '#999', fieldName: 'DateStr6' });

  // Str008 - страница 8
  const Str008Text = data.Str008 || '008';
  window.placeChars(8, 126.3, 38.1, Str008Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str008 ? '#000' : '#999', fieldName: 'Str008', noHighlight: true });

  // DateStr7 - на странице 7
  const DateStr7Text = data.DateStr7 || '00.00.00';
  window.placeChars(7, 152.1, 254.2, DateStr7Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr7 ? '#000' : '#999', fieldName: 'DateStr7' });

  // Str009 - страница 9
  const Str009Text = data.Str009 || '009';
  window.placeChars(9, 126.3, 38.1, Str009Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str009 ? '#000' : '#999', fieldName: 'Str009', noHighlight: true });

  // DateStr8 - на странице 8
  const DateStr8Text = data.DateStr8 || '00.00.00';
  window.placeChars(8, 152.3, 258.4, DateStr8Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr8 ? '#000' : '#999', fieldName: 'DateStr8' });

  // Str010 - страница 10
  const Str010Text = data.Str010 || '010';
  window.placeChars(10, 126.3, 38.1, Str010Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.Str010 ? '#000' : '#999', fieldName: 'Str010', noHighlight: true });

  // DateStr9 - на странице 9
  const DateStr9Text = data.DateStr9 || '00.00.00';
  window.placeChars(9, 152.3, 251.0, DateStr9Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr9 ? '#000' : '#999', fieldName: 'DateStr9' });

  // DateStr10 - на странице 10
  const DateStr10Text = data.DateStr10 || '00.00.00';
  window.placeChars(10, 152.5, 244.7, DateStr10Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.DateStr10 ? '#000' : '#999', fieldName: 'DateStr10' });

  // 10 страниц
  const field10stranitsText = data.field10stranits || '10';
  window.placeChars(1, 68.7831, 142.593, field10stranitsText, CELL_WIDTH_MM, CELL_GAP_MM, { color: '#000', fieldName: '10 страниц', noHighlight: true });
  
  // 10 листах
  const field10listahText = data.field10listah || '10';
  window.placeChars(1, 36.8606, 153.616, field10listahText, CELL_WIDTH_MM, CELL_GAP_MM, { color: '#000', fieldName: '10 листах', noHighlight: true });
 
  // Заявитель
  const ZayavitelText = data.Zayavitel || '1';
  window.placeChars(1, 19.6648, 176.367, ZayavitelText, CELL_WIDTH_MM, CELL_GAP_MM, { color: '#000', fieldName: 'Заявитель', noHighlight: true });

  // ФИО Руководителя 1
  const FIORukovoditelya1Text = data.FIORukovoditelya1 || '00000000000000000000';
  window.placeChars(1, 18.3422, 187.565, FIORukovoditelya1Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.FIORukovoditelya1 ? '#000' : '#999', fieldName: 'ФИО Руководителя 1' });

  // ФИО Руководителя 2
  const FIORukovoditelya2Text = data.FIORukovoditelya2 || '00000000000000000000';
  window.placeChars(1, 18.3421, 198.677, FIORukovoditelya2Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.FIORukovoditelya2 ? '#000' : '#999', fieldName: 'ФИО Руководителя 2' });

  // ФИО Руководителя 3
  const FIORukovoditelya3Text = data.FIORukovoditelya3 || '00000000000000000000';
  window.placeChars(1, 18.3422, 209.524, FIORukovoditelya3Text, CELL_WIDTH_MM, CELL_GAP_MM, { color: data.FIORukovoditelya3 ? '#000' : '#999', fieldName: 'ФИО Руководителя 3' });

  // дд1 - всегда создаем 2 ячейки
  const dd1Text = data.dd1 || '00';
  window.placeChars(1, 57.2311, 234.656, dd1Text.padEnd(2, '0'), CELL_WIDTH_MM, CELL_GAP_MM, { color: data.dd1 ? '#000' : '#999', fieldName: 'дд1' });

  // мм1 - всегда создаем 2 ячейки
  const mm1Text = data.mm1 || '00';
  window.placeChars(1, 69.9294, 234.657, mm1Text.padEnd(2, '0'), CELL_WIDTH_MM, CELL_GAP_MM, { color: data.mm1 ? '#000' : '#999', fieldName: 'мм1' });

  // гггг1 - всегда создаем 4 ячейки
  const gggg1Text = data.gggg1 || '0000';
  window.placeChars(1, 83.1569, 234.656, gggg1Text.padEnd(4, '0'), CELL_WIDTH_MM, CELL_GAP_MM, { color: data.gggg1 ? '#000' : '#999', fieldName: 'гггг1' });
// Поля DataStr2-DataStr10 удалены - они находились за пределами видимых страниц





  // ОГРН/ОГРНИП - дублируем на все страницы (макс 15 символов)
  const ogrnOgrnipText = (data.ogrn || '000000000000000').substring(0, 15).padEnd(15, '0');
  const hasOgrnData = data.ogrn && data.ogrn.trim() !== '' && data.ogrn !== '000000000000000';
  logger.debug('Создание полей ОГРН/ОГРНИП:', 'fields');
  for (let page = 1; page <= 10; page++) {
    const fieldName = page === 1 ? 'ОГРН/ОГРНИП' : `ОГРН${page}`;
    window.placeChars(page, 74.6032, 19.3122, ogrnOgrnipText, CELL_WIDTH_MM, CELL_GAP_MM, { 
      color: data.ogrn ? '#000 !important' : '#999 !important', 
      fieldName: fieldName,
      hasData: hasOgrnData
    });
  }

  // Обновляем список полей после создания всех элементов
  if (editorMode) {
    updateFieldList();
  }
  
  // Обновляем поля DataStr2-DataStr10 на основе даты заявления
  if (data.applicationDate) {
    try {
      const date = new Date(data.applicationDate);
      // Поля DataStr2-DataStr10 удалены - они находились за пределами видимых страниц
    } catch (error) {
      logger.error('Ошибка при обновлении полей DataStr:', 'error');
      // Поля DataStr2-DataStr10 удалены - они находились за пределами видимых страниц
    }
  } else {
    // Поля DataStr2-DataStr10 удалены - они находились за пределами видимых страниц
  }
}

// Флаг для предотвращения повторного вызова
let templateLoaded = false;

async function loadBundledTemplate() {
  if (templateLoaded) {
    console.log('Шаблон уже загружен, пропускаем');
    return;
  }
  
  templateLoaded = true;
  console.log('Начинаем загрузку шаблона...');
  
  const maxPages = 10; // только существующие страницы
  const urls = [];
  for (let i = 1; i <= maxPages; i++) {
    urls.push(`./template/page-${i}.png`);
  }
  // проверяем какие существуют
  const existing = [];
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u, { method: 'HEAD' });
      if (res.ok) existing.push(u);
    } catch (error) {
      console.error('Ошибка при проверке файла', u, ':', error);
    }
  }));
  
  // Сортируем файлы по номеру страницы
  existing.sort((a, b) => {
    const numA = parseInt(a.match(/page-(\d+)\.png/)[1]);
    const numB = parseInt(b.match(/page-(\d+)\.png/)[1]);
    return numA - numB;
  });
  if (!existing.length) {
    alert('Файлы шаблона не найдены. Поместите page-1.png … page-10.png в папку template/.');
    return;
  }
  
  // Обновляем общее количество страниц
  totalPages = existing.length;
  window.totalPages = totalPages; // Обновляем глобальную переменную
  
  // Очищаем превью
  const preview = document.getElementById('preview');
  preview.innerHTML = '';
  
  // Инициализируем навигацию
  updatePageNavigation();
  
  // Показываем первую страницу
  showPage(1);
  
  logger.info(`Загружено ${totalPages} страниц шаблона`, 'init');
  
  // Оверлеи поверх шаблона
  // Используем значения по умолчанию для первой загрузки
  
  // Получаем сегодняшнюю дату для заполнения полей даты
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // Формат YYYY-MM-DD
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const year = today.getFullYear().toString().slice(-2);
  const dateStr = `${day}.${month}.${year}`;
  
  const defaultData = {
    ogrn: defaultValues.ogrn,
    inn: defaultValues.inn,
    kpp: defaultValues.kpp,
    orgName: defaultValues.orgName,
    address: defaultValues.address,
    phone: defaultValues.phone,
    email: defaultValues.email,
    kktModel: defaultValues.kktModel,
    kktSerial: defaultValues.kktSerial,
    fnModel: defaultValues.fnModel,
    fiscalDriveNumber: defaultValues.fiscalDriveNumber,
    ofd: defaultValues.ofd,
    ifnsCode: defaultValues.ifnsCode,
    headName: defaultValues.headName,
    applicationDate: defaultValues.applicationDate,
    operationType: 'registration',
    applicantType: '',
    zayavitel: '1',
    docType: '1',
    pagesTotal: '10',
    copiesTotal: '10',
    Str002: '002',
    Str003: '003',
    Str004: '004',
    Str005: '005',
    Str006: '006',
    Str007: '007',
    Str008: '008',
    Str009: '009',
    Str010: '010',
    field10stranits: '10',
    field10listah: '10',
    Nazvanieorganizatsii1: (defaultValues.orgName || '').substring(0, 40) || '0000000000000000000000000000000000000000',
    Nazvanieorganizatsii2: (defaultValues.orgName || '').substring(40, 80) || '0000000000000000000000000000000000000000',
    Nazvanieorganizatsii3: (defaultValues.orgName || '').substring(80, 120) || '0000000000000000000000000000000000000000',
    FIORukovoditelya1: '00000000000000000000',
    FIORukovoditelya2: '00000000000000000000',
    FIORukovoditelya3: '00000000000000000000',
    dd1: day,
    mm1: month,
    gggg1: today.getFullYear().toString(),
    DateStr2: dateStr,
    DateStr3: dateStr,
    DateStr4: dateStr,
    DateStr5: dateStr,
    DateStr6: dateStr,
    DateStr7: dateStr,
    DateStr8: dateStr,
    DateStr9: dateStr,
    DateStr10: dateStr,
  };
  renderOverlays(defaultData);
  
  // Устанавливаем сегодняшнюю дату по умолчанию для поля "Дата заявления"
  const applicationDateInput = document.getElementById('applicationDate');
  if (applicationDateInput && !applicationDateInput.value) {
    applicationDateInput.value = todayString;
    logger.debug('Установлена дата заявления по умолчанию:', 'init');
  }
  
  // Обновляем поля даты в PDF
  if (applicationDateInput && applicationDateInput.value) {
    updateDateFields(applicationDateInput.value);
  }
  
  // Обновляем превью после загрузки шаблона
  updatePreview();
  
  // Инициализируем обработчики навигации по страницам
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', prevPage);
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', nextPage);
  }
  
}

// загрузка происходит в DOMContentLoaded

// Улучшенный интерактивный редактор позиций
// Функция toggleEditorMode перенесена в editor.js

// Функция initializeAdvancedEditor перенесена в editor.js

// Функции редактора перенесены в editor.js

// Функции редактора перенесены в editor.js

// Функции редактора перенесены в editor.js

// Функции редактора перенесены в editor.js

// Функции редактора перенесены в editor.js

// Функция updateFieldNamePosition перенесена в editor.js

// Функция deleteFieldGroup перенесена в editor.js

// Функция deleteField перенесена в editor.js

// Функция createNewField перенесена в editor.js

// Функция updateFieldList перенесена в editor.js

// Функции addVisualGrid и removeVisualGrid перенесены в editor.js

// Функции enableGridSnap и snapToGrid перенесены в editor.js

// Функции savePositionToHistory, undoPosition, redoPosition перенесены в editor.js

// Функция findGroupedElements перенесена в editor.js

// Функции addKeyboardListeners, removeKeyboardListeners, handleKeyDown перенесены в editor.js

// Функция removeDraggableListeners перенесена в editor.js

// Функции getElementPage и determineTargetPage перенесены в editor.js

// Функция startDrag перенесена в editor.js

// Функции updateCoordinates, saveOriginalPositions, resetPositions перенесены в editor.js

// Функция savePositions перенесена в editor.js

// Функция generatePositionCode перенесена в editor.js

// Функция generateUpdatedRenderOverlaysCode перенесена в editor.js

// Функция showCodeModal перенесена в editor.js

// Функции createFieldList и removeFieldList перенесены в editor.js

// Функции createPreciseControls и removePreciseControls перенесены в editor.js

// Функция createPageCanvas перенесена в pdf-export.js

// Функция exportToPDF перенесена в pdf-export.js

// Обработчики событий
// toggleEditorBtn обрабатывается в editor.js через initializeEditor()
// exportPdfBtn обрабатывается в pdf-export.js через initializePDFExport()
// savePositionsBtn, resetPositionsBtn, undoBtn, redoBtn, addFieldBtn обрабатываются в editor.js

// Инициализируем редактор позиций (если он включен)
if (typeof initializeEditor === 'function') {
  initializeEditor();
} else {
  // Если редактор недоступен, скрываем кнопку
  const toggleEditorBtn = document.getElementById('toggleEditor');
  if (toggleEditorBtn) {
    toggleEditorBtn.style.display = 'none';
  }
}

// Инициализируем модуль экспорта PDF
if (typeof initializePDFExport === 'function') {
  initializePDFExport();
}


