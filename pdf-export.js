/**
 * Модуль экспорта в PDF для KKT PDF
 * 
 * Содержит функции для создания и экспорта PDF документов
 */

// ===== ФУНКЦИЯ ЭКСПОРТА В PDF =====

/**
 * Функция экспорта в PDF
 */
async function exportToPDF() {
  const data = Object.fromEntries(new FormData(form));
  const fileName = `KKT_Application_${(data.orgName || 'unnamed').replace(/\s+/g, '_')}.pdf`;

  try {
    logger.info('Начинаем экспорт PDF...', 'pdf');
    
    // Проверяем доступность библиотек
    if (!window.jspdf && !window.jsPDF) {
      throw new Error('jsPDF не загружена');
    }
    if (!window.html2canvas) {
      throw new Error('html2canvas не загружена');
    }
    
    logger.debug('Библиотеки загружены успешно', 'pdf');
    
    // Скрываем названия полей и желтые ячейки перед экспортом
    const fieldLabels = preview.querySelectorAll('.field-name-label');
    const yellowCells = preview.querySelectorAll('.overlay-char[style*="background"]');
    
    fieldLabels.forEach(label => {
      label.style.display = 'none';
    });
    
    yellowCells.forEach(cell => {
      cell.style.background = 'transparent';
      cell.style.border = 'none';
    });
    
    logger.debug('Названия полей и выделения скрыты', 'pdf');
    
    // Получаем все страницы из новой структуры
    const pageElements = Object.values(window.pageElements || {});
    if (pageElements.length === 0) {
      throw new Error('Не найдено страниц для экспорта');
    }
    
    logger.debug('Найдено страниц для экспорта:', pageElements.length, 'pdf');
    
    // Ограничиваем количество страниц до 10 (стандартное количество для заявления ККТ)
    const maxPages = 10;
    const pagesToExport = pageElements.length > maxPages ? maxPages : pageElements.length;
    logger.info(`Экспортируем ${pagesToExport} страниц из ${pageElements.length} найденных`, 'pdf');
    
    // Создаем PDF
    const { jsPDF } = window.jspdf || window.jsPDF;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Экспортируем каждую страницу
    for (let i = 0; i < pagesToExport; i++) {
      logger.debug(`Экспортируем страницу ${i + 1}...`, 'pdf');
      
      // Создаем временный контейнер для текущей страницы
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 210mm;
        height: 297mm;
        background: white;
        overflow: hidden;
        z-index: 10000;
      `;
      
      // Клонируем страницу
      const pageBackground = pageElements[i].cloneNode(true);
      pageBackground.style.position = 'absolute';
      pageBackground.style.top = '0';
      pageBackground.style.left = '0';
      
      // Убеждаемся, что изображения загружены
      const images = pageBackground.querySelectorAll('img');
      for (const img of images) {
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000);
          });
        }
      }
      
      tempContainer.appendChild(pageBackground);
      
      // Добавляем все элементы для текущей страницы
      const currentPageElement = pageElements[i];
      const allElements = currentPageElement.querySelectorAll('.overlay-char, .overlay-text');
      allElements.forEach(element => {
        const clonedElement = element.cloneNode(true);
        clonedElement.style.background = 'transparent';
        clonedElement.style.border = 'none';
        tempContainer.appendChild(clonedElement);
      });
      
      // Добавляем временный контейнер в DOM (скрытый)
      tempContainer.style.position = 'absolute';
      tempContainer.style.top = '-9999px';
      tempContainer.style.left = '-9999px';
      tempContainer.style.visibility = 'hidden';
      document.body.appendChild(tempContainer);
      
      // Небольшая задержка для рендеринга
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Создаем canvas напрямую вместо html2canvas
      const canvas = await createPageCanvas(tempContainer, i + 1);
      
      // Удаляем временный контейнер
      document.body.removeChild(tempContainer);
      
      // Добавляем страницу в PDF (кроме первой)
      if (i > 0) {
        pdf.addPage();
      }
      
      // Добавляем изображение на страницу с высоким качеством
      const imgData = canvas.toDataURL('image/png', 0.7);
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      
      logger.debug(`Страница ${i + 1} добавлена в PDF`, 'pdf');
    }
    
    logger.info('Все страницы добавлены в PDF', 'pdf');
    
    // Сохраняем PDF
    const pdfBlob = pdf.output('blob', { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.type = 'application/pdf';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    logger.info(`PDF сохранен как: ${fileName}`, 'pdf');
    
    // Восстанавливаем названия полей и выделения
    fieldLabels.forEach(label => {
      label.style.display = '';
    });
    
    yellowCells.forEach(cell => {
      cell.style.background = '';
      cell.style.border = '';
    });
    
    logger.info('Экспорт завершен успешно', 'pdf');
    
  } catch (error) {
    logger.error('Ошибка экспорта:', 'error');
    alert(`Не удалось сформировать PDF: ${error.message}`);
    
    // Восстанавливаем названия полей и выделения в случае ошибки
    const fieldLabels = preview.querySelectorAll('.field-name-label');
    const yellowCells = preview.querySelectorAll('.overlay-char[style*="background"]');
    
    fieldLabels.forEach(label => {
      label.style.display = '';
    });
    
    yellowCells.forEach(cell => {
      cell.style.background = '';
      cell.style.border = '';
    });
  }
}

/**
 * Функция для создания canvas страницы напрямую
 */
async function createPageCanvas(container, pageNumber) {
  console.log(`Создаем canvas для страницы ${pageNumber} напрямую`);
  
  // Создаем canvas с высоким разрешением
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const dpi = 144; // Высокое разрешение для качественного PDF
  const mmToInch = 1 / 25.4;
  const widthInch = 210 * mmToInch; // A4 width in inches
  const heightInch = 297 * mmToInch; // A4 height in inches
  const widthPx = Math.round(widthInch * dpi);
  const heightPx = Math.round(heightInch * dpi);
  
  canvas.width = widthPx;
  canvas.height = heightPx;
  
  // Устанавливаем белый фон
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);
  
  // Масштаб для перевода из мм в пиксели
  const scale = dpi * mmToInch;
  
  try {
    // Рисуем фоновое изображение
    const backgroundImg = container.querySelector('img');
    if (backgroundImg && backgroundImg.complete && backgroundImg.naturalWidth > 0) {
      const imgAspect = backgroundImg.naturalWidth / backgroundImg.naturalHeight;
      const pageAspect = widthPx / heightPx;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspect > pageAspect) {
        drawWidth = widthPx;
        drawHeight = widthPx / imgAspect;
        drawX = 0;
        drawY = (heightPx - drawHeight) / 2;
      } else {
        drawHeight = heightPx;
        drawWidth = heightPx * imgAspect;
        drawX = (widthPx - drawWidth) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(backgroundImg, drawX, drawY, drawWidth, drawHeight);
    }
    
    // Рисуем текстовые элементы
    const textElements = container.querySelectorAll('.overlay-char, .overlay-text');
    
    textElements.forEach((element, index) => {
      const text = element.textContent;
      
      if (!text || text.trim() === '') {
        return;
      }
      
      // Получаем позицию элемента из стилей
      const leftStr = element.style.left || '0mm';
      const topStr = element.style.top || '0mm';
      const widthStr = element.style.width || '5mm';
      const heightStr = element.style.height || '7mm';
      
      const leftMm = parseFloat(leftStr.replace('mm', '')) || 0;
      const topMm = parseFloat(topStr.replace('mm', '')) || 0;
      const widthMm = parseFloat(widthStr.replace('mm', '')) || 5;
      const heightMm = parseFloat(heightStr.replace('mm', '')) || 7;
      
      // Конвертируем в пиксели
      const leftPx = leftMm * scale;
      const adjustedTopMm = topMm < 0 ? topMm + 297 : topMm;
      const topPx = adjustedTopMm * scale;
      const widthPx = widthMm * scale;
      const heightPx = heightMm * scale;
      
      // Получаем стили текста
      const fontSizeStr = element.style.fontSize || '18px';
      const fontSize = parseFloat(fontSizeStr.replace('px', '')) || 18;
      const fontWeight = element.style.fontWeight || '700';
      const color = element.style.color || '#000000';
      
      // Настраиваем контекст для текста
      ctx.fillStyle = color;
      ctx.font = `${fontWeight} ${fontSize}px 'Courier New', Courier, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Рисуем текст в центре ячейки
      const textX = leftPx + widthPx / 2;
      const textY = topPx + heightPx / 2;
      
      ctx.fillText(text, textX, textY);
    });
    
    console.log(`Canvas для страницы ${pageNumber} создан успешно, размер: ${canvas.width}x${canvas.height}`);
    
  } catch (error) {
    console.error(`Ошибка при создании canvas для страницы ${pageNumber}:`, error);
  }
  
  return canvas;
}

// ===== ИНИЦИАЛИЗАЦИЯ PDF МОДУЛЯ =====

/**
 * Инициализация модуля экспорта PDF
 */
function initializePDFExport() {
  // Добавляем обработчик для кнопки экспорта PDF
  const exportPdfBtn = document.getElementById('exportPdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
  }
  
  console.log('PDF Export module initialized');
}

// Экспортируем функции для использования в других модулях
window.exportToPDF = exportToPDF;
window.createPageCanvas = createPageCanvas;
window.initializePDFExport = initializePDFExport;
