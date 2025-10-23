# Архитектура KKT PDF Service

## Диаграмма классов

```mermaid
classDiagram
    class KKTPDFService {
        +logger: Logger
        +currentPage: number
        +totalPages: number
        +pageElements: object
        +form: HTMLFormElement
        +preview: HTMLElement
        +loadBundledTemplate()
        +showPage(pageNumber)
        +updatePreview()
        +renderOverlays(data)
    }

    class Logger {
        +categories: object
        +log(message, category)
        +debug(message, category)
        +info(message, category)
        +warn(message, category)
        +error(message, category)
    }

    class PageNavigation {
        +currentPage: number
        +totalPages: number
        +showPage(pageNumber)
        +nextPage()
        +prevPage()
        +updatePageNavigation()
        +createPageElement(pageNumber)
    }

    class FieldRenderer {
        +renderOverlays(data)
        +clearOverlays()
        +placeChars(page, left, top, text, style)
        +placeText(page, left, top, text, style)
        +updateFieldValue(fieldName, value)
    }

    class FormValidator {
        +validateForm()
        +validateField(fieldName, value)
        +setFieldLimits()
    }

    class PositionEditor {
        +editorMode: boolean
        +draggedElement: HTMLElement
        +positionHistory: array
        +toggleEditorMode()
        +startDrag(event)
        +savePositionToHistory()
        +undoPosition()
        +redoPosition()
        +createNewField()
        +deleteFieldGroup(groupKey)
        +updateFieldList()
    }

    class VisualGrid {
        +gridSnapEnabled: boolean
        +gridSize: number
        +addVisualGrid()
        +removeVisualGrid()
        +enableGridSnap()
        +snapToGrid(value)
    }

    class PDFExporter {
        +exportToPDF()
        +createPageCanvas(container, pageNumber)
        +initializePDFExport()
    }

    class CanvasGenerator {
        +dpi: number
        +scale: number
        +createPageCanvas(container, pageNumber)
        +drawBackgroundImage(ctx, img)
        +drawTextElements(ctx, elements)
    }

    KKTPDFService --> Logger
    KKTPDFService --> PageNavigation
    KKTPDFService --> FieldRenderer
    KKTPDFService --> FormValidator
    KKTPDFService --> PositionEditor
    KKTPDFService --> PDFExporter
    PositionEditor --> VisualGrid
    PDFExporter --> CanvasGenerator
```

## Диаграмма последовательности - Экспорт PDF

```mermaid
sequenceDiagram
    participant User
    participant App as app.js
    participant PDF as pdf-export.js
    participant Canvas as CanvasGenerator
    participant Browser

    User->>App: Нажимает "Экспорт PDF"
    App->>PDF: exportToPDF()
    PDF->>PDF: Проверка библиотек (jsPDF, html2canvas)
    PDF->>PDF: Скрытие UI элементов
    PDF->>PDF: Получение pageElements
    
    loop Для каждой страницы
        PDF->>PDF: Создание временного контейнера
        PDF->>PDF: Клонирование страницы
        PDF->>PDF: Ожидание загрузки изображений
        PDF->>Canvas: createPageCanvas(container, pageNumber)
        Canvas->>Canvas: Создание canvas с высоким DPI
        Canvas->>Canvas: Рисование фонового изображения
        Canvas->>Canvas: Рисование текстовых элементов
        Canvas-->>PDF: Возврат canvas
        PDF->>PDF: Добавление страницы в PDF
    end
    
    PDF->>Browser: Создание и скачивание файла
    PDF->>PDF: Восстановление UI элементов
    PDF-->>App: Завершение экспорта
    App-->>User: PDF файл скачан
```

## Диаграмма последовательности - Редактирование позиций

```mermaid
sequenceDiagram
    participant User
    participant App as app.js
    participant Editor as editor.js
    participant Field as FieldRenderer

    User->>App: Нажимает "Редактор позиций"
    App->>Editor: toggleEditorMode()
    Editor->>Editor: Включение режима редактора
    Editor->>Field: Перерисовка полей с названиями
    Editor->>Editor: Создание визуальной сетки
    Editor->>Editor: Создание списка полей
    
    User->>Editor: Перетаскивает поле
    Editor->>Editor: startDrag(event)
    Editor->>Editor: Поиск группы элементов
    Editor->>Editor: Сохранение начальных позиций
    
    loop Во время перетаскивания
        Editor->>Editor: onMouseMove(event)
        Editor->>Editor: Обновление позиций элементов
        Editor->>Editor: Обновление координат в UI
    end
    
    User->>Editor: Отпускает поле
    Editor->>Editor: onMouseUp()
    Editor->>Editor: Сохранение в историю
    Editor->>Editor: Очистка обработчиков
    
    User->>Editor: Нажимает "Сохранить позиции"
    Editor->>Editor: savePositions()
    Editor->>Editor: Генерация кода
    Editor->>Editor: Показ модального окна с кодом
```

## Диаграмма состояний - Навигация по страницам

```mermaid
stateDiagram-v2
    [*] --> Loading: Загрузка приложения
    Loading --> Page1: Шаблон загружен
    Page1 --> Page2: nextPage()
    Page2 --> Page3: nextPage()
    Page3 --> Page4: nextPage()
    Page4 --> Page5: nextPage()
    Page5 --> Page6: nextPage()
    Page6 --> Page7: nextPage()
    Page7 --> Page8: nextPage()
    Page8 --> Page9: nextPage()
    Page9 --> Page10: nextPage()
    Page10 --> Page9: prevPage()
    Page9 --> Page8: prevPage()
    Page8 --> Page7: prevPage()
    Page7 --> Page6: prevPage()
    Page6 --> Page5: prevPage()
    Page5 --> Page4: prevPage()
    Page4 --> Page3: prevPage()
    Page3 --> Page2: prevPage()
    Page2 --> Page1: prevPage()
    
    state Page1 {
        [*] --> Rendering
        Rendering --> Ready: Поля отрендерены
        Ready --> Rendering: Обновление данных
    }
    
    state Page2 {
        [*] --> Rendering
        Rendering --> Ready: Поля отрендерены
        Ready --> Rendering: Обновление данных
    }
    
    state Page10 {
        [*] --> Rendering
        Rendering --> Ready: Поля отрендерены
        Ready --> Rendering: Обновление данных
    }
```

## Диаграмма компонентов

```mermaid
graph TB
    subgraph "Frontend Layer"
        HTML[HTML Interface]
        CSS[CSS Styles]
    end
    
    subgraph "Application Layer"
        APP[app.js<br/>Main Application]
        EDITOR[editor.js<br/>Position Editor]
        PDF[pdf-export.js<br/>PDF Export]
    end
    
    subgraph "External Libraries"
        JSPDF[jsPDF Library]
        HTML2CANVAS[html2canvas Library]
    end
    
    subgraph "Browser APIs"
        CANVAS[Canvas API]
        FILE[File Download API]
        DOM[DOM API]
    end
    
    HTML --> APP
    CSS --> HTML
    APP --> EDITOR
    APP --> PDF
    EDITOR --> DOM
    PDF --> JSPDF
    PDF --> HTML2CANVAS
    PDF --> CANVAS
    PDF --> FILE
    APP --> DOM
```

## Диаграмма использования (Use Case)

```mermaid
graph TD
    User[Пользователь] --> UC1[Заполнение формы]
    User --> UC2[Навигация по страницам]
    User --> UC3[Редактирование позиций полей]
    User --> UC4[Экспорт в PDF]
    
    UC1 --> UC1_1[Ввод ИНН/КПП/ОГРН]
    UC1 --> UC1_2[Ввод данных организации]
    UC1 --> UC1_3[Валидация полей]
    
    UC2 --> UC2_1[Переход к следующей странице]
    UC2 --> UC2_2[Переход к предыдущей странице]
    UC2 --> UC2_3[Отображение номера страницы]
    
    UC3 --> UC3_1[Включение режима редактора]
    UC3 --> UC3_2[Перетаскивание полей]
    UC3 --> UC3_3[Создание новых полей]
    UC3 --> UC3_4[Удаление полей]
    UC3 --> UC3_5[Отмена/повтор действий]
    UC3 --> UC3_6[Сохранение позиций]
    
    UC4 --> UC4_1[Генерация PDF документа]
    UC4 --> UC4_2[Скачивание файла]
    UC4 --> UC4_3[Обработка ошибок]
```
