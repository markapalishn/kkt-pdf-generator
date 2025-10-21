# Диаграммы активности KKT PDF Service

## Диаграмма активности - Инициализация приложения

```mermaid
flowchart TD
    Start([Запуск приложения]) --> LoadHTML[Загрузка HTML]
    LoadHTML --> LoadCSS[Загрузка CSS стилей]
    LoadCSS --> LoadJS[Загрузка JavaScript модулей]
    LoadJS --> InitLogger[Инициализация логгера]
    InitLogger --> LoadTemplate[Загрузка шаблона страниц]
    LoadTemplate --> CreatePages[Создание элементов страниц]
    CreatePages --> ShowPage1[Отображение первой страницы]
    ShowPage1 --> InitEditor[Инициализация редактора]
    InitEditor --> InitPDF[Инициализация PDF модуля]
    InitPDF --> Ready[Приложение готово]
    Ready --> End([Конец])
```

## Диаграмма активности - Навигация по страницам

```mermaid
flowchart TD
    Start([Пользователь нажимает кнопку навигации]) --> CheckButton{Какая кнопка?}
    CheckButton -->|Предыдущая| CheckPrev{currentPage > 1?}
    CheckButton -->|Следующая| CheckNext{currentPage < totalPages?}
    
    CheckPrev -->|Да| DecrementPage[currentPage--]
    CheckPrev -->|Нет| Disabled[Кнопка отключена]
    
    CheckNext -->|Да| IncrementPage[currentPage++]
    CheckNext -->|Нет| Disabled
    
    DecrementPage --> UpdateUI[Обновление UI навигации]
    IncrementPage --> UpdateUI
    UpdateUI --> ClearPreview[Очистка превью]
    ClearPreview --> ShowPage[Показать страницу currentPage]
    ShowPage --> RenderFields[Рендеринг полей для страницы]
    RenderFields --> End([Завершение])
    Disabled --> End
```

## Диаграмма активности - Редактирование позиций

```mermaid
flowchart TD
    Start([Пользователь включает редактор]) --> ToggleMode[Переключение режима редактора]
    ToggleMode --> CheckMode{Режим редактора?}
    CheckMode -->|Включить| EnableEditor[Включение редактора]
    CheckMode -->|Выключить| DisableEditor[Выключение редактора]
    
    EnableEditor --> AddGrid[Добавление визуальной сетки]
    AddGrid --> CreateFieldList[Создание списка полей]
    CreateFieldList --> AddListeners[Добавление обработчиков событий]
    AddListeners --> RenderWithLabels[Рендеринг полей с названиями]
    RenderWithLabels --> Ready[Редактор готов]
    
    DisableEditor --> RemoveGrid[Удаление сетки]
    RemoveGrid --> RemoveFieldList[Удаление списка полей]
    RemoveFieldList --> RemoveListeners[Удаление обработчиков]
    RemoveListeners --> RenderNormal[Обычный рендеринг полей]
    RenderNormal --> Ready
    
    Ready --> UserAction[Ожидание действий пользователя]
    UserAction --> DragField[Перетаскивание поля]
    UserAction --> CreateField[Создание нового поля]
    UserAction --> DeleteField[Удаление поля]
    UserAction --> SavePositions[Сохранение позиций]
    UserAction --> ToggleMode
    
    DragField --> StartDrag[Начало перетаскивания]
    StartDrag --> TrackMouse[Отслеживание мыши]
    TrackMouse --> UpdatePosition[Обновление позиции]
    UpdatePosition --> CheckMouse{Мышь отпущена?}
    CheckMouse -->|Нет| TrackMouse
    CheckMouse -->|Да| EndDrag[Завершение перетаскивания]
    EndDrag --> SaveHistory[Сохранение в историю]
    SaveHistory --> UserAction
    
    CreateField --> PromptName[Запрос названия поля]
    PromptName --> PromptValue[Запрос значения поля]
    PromptValue --> PlaceField[Размещение поля]
    PlaceField --> SaveHistory
    SaveHistory --> UserAction
    
    DeleteField --> ConfirmDelete[Подтверждение удаления]
    ConfirmDelete --> RemoveField[Удаление поля из DOM]
    RemoveField --> UpdateList[Обновление списка полей]
    UpdateList --> UserAction
    
    SavePositions --> GenerateCode[Генерация кода позиций]
    GenerateCode --> ShowModal[Показ модального окна]
    ShowModal --> UserAction
```

## Диаграмма активности - Экспорт в PDF

```mermaid
flowchart TD
    Start([Пользователь нажимает "Экспорт PDF"]) --> CheckLibraries{Библиотеки загружены?}
    CheckLibraries -->|Нет| ShowError[Показать ошибку]
    CheckLibraries -->|Да| HideUI[Скрыть UI элементы]
    
    HideUI --> GetPages[Получить все страницы]
    GetPages --> CheckPages{Страницы найдены?}
    CheckPages -->|Нет| ShowError
    CheckPages -->|Да| CreatePDF[Создать PDF документ]
    
    CreatePDF --> LoopStart[Начать цикл по страницам]
    LoopStart --> CheckPage{Есть еще страницы?}
    CheckPage -->|Нет| FinalizePDF[Завершить PDF]
    CheckPage -->|Да| CreateContainer[Создать временный контейнер]
    
    CreateContainer --> ClonePage[Клонировать страницу]
    ClonePage --> WaitImages[Ожидать загрузки изображений]
    WaitImages --> CreateCanvas[Создать canvas для страницы]
    CreateCanvas --> DrawBackground[Нарисовать фоновое изображение]
    DrawBackground --> DrawText[Нарисовать текстовые элементы]
    DrawText --> AddToPDF[Добавить страницу в PDF]
    AddToPDF --> NextPage[Следующая страница]
    NextPage --> CheckPage
    
    FinalizePDF --> CreateBlob[Создать blob файла]
    CreateBlob --> DownloadFile[Скачать файл]
    DownloadFile --> RestoreUI[Восстановить UI элементы]
    RestoreUI --> Success[Успешное завершение]
    
    ShowError --> RestoreUI
    Success --> End([Конец])
```

## Диаграмма активности - Валидация формы

```mermaid
flowchart TD
    Start([Изменение поля формы]) --> GetValue[Получить значение поля]
    GetValue --> CheckField{Какое поле?}
    
    CheckField -->|ИНН| ValidateINN[Валидация ИНН]
    CheckField -->|КПП| ValidateKPP[Валидация КПП]
    CheckField -->|ОГРН| ValidateOGRN[Валидация ОГРН]
    CheckField -->|Другое| ValidateOther[Валидация другого поля]
    
    ValidateINN --> CheckINNLength{Длина = 10 или 12?}
    CheckINNLength -->|Нет| INNError[Ошибка ИНН]
    CheckINNLength -->|Да| CheckINNDigits{Только цифры?}
    CheckINNDigits -->|Нет| INNError
    CheckINNDigits -->|Да| INNValid[ИНН валиден]
    
    ValidateKPP --> CheckKPPLength{Длина = 9?}
    CheckKPPLength -->|Нет| KPPError[Ошибка КПП]
    CheckKPPLength -->|Да| CheckKPPDigits{Только цифры?}
    CheckKPPDigits -->|Нет| KPPError
    CheckKPPDigits -->|Да| KPPValid[КПП валиден]
    
    ValidateOGRN --> CheckOGRNLength{Длина = 13 или 15?}
    CheckOGRNLength -->|Нет| OGRNError[Ошибка ОГРН]
    CheckOGRNLength -->|Да| CheckOGRNDigits{Только цифры?}
    CheckOGRNDigits -->|Нет| OGRNError
    CheckOGRNDigits -->|Да| OGRNValid[ОГРН валиден]
    
    ValidateOther --> OtherValid[Поле валидно]
    
    INNValid --> UpdateField[Обновить поле]
    KPPValid --> UpdateField
    OGRNValid --> UpdateField
    OtherValid --> UpdateField
    
    INNError --> ShowError[Показать ошибку]
    KPPError --> ShowError
    OGRNError --> ShowError
    
    UpdateField --> RenderPreview[Перерисовать превью]
    RenderPreview --> End([Завершение])
    ShowError --> End
```

## Диаграмма активности - Создание canvas для PDF

```mermaid
flowchart TD
    Start([createPageCanvas вызвана]) --> CreateCanvas[Создать canvas элемент]
    CreateCanvas --> SetSize[Установить размеры canvas]
    SetSize --> SetDPI[Установить DPI = 144]
    SetDPI --> CalculateSize[Вычислить размеры в пикселях]
    CalculateSize --> SetWhiteBackground[Установить белый фон]
    
    SetWhiteBackground --> FindImage[Найти фоновое изображение]
    FindImage --> CheckImage{Изображение найдено?}
    CheckImage -->|Нет| DrawText[Рисовать текстовые элементы]
    CheckImage -->|Да| CalculateAspect[Вычислить пропорции изображения]
    
    CalculateAspect --> CheckAspect{Изображение шире страницы?}
    CheckAspect -->|Да| ScaleWidth[Масштабировать по ширине]
    CheckAspect -->|Нет| ScaleHeight[Масштабировать по высоте]
    
    ScaleWidth --> DrawImage[Нарисовать изображение]
    ScaleHeight --> DrawImage
    DrawImage --> DrawText
    
    DrawText --> FindTextElements[Найти текстовые элементы]
    FindTextElements --> LoopText[Цикл по текстовым элементам]
    LoopText --> CheckText{Есть еще элементы?}
    CheckText -->|Нет| ReturnCanvas[Вернуть canvas]
    CheckText -->|Да| GetTextData[Получить данные элемента]
    
    GetTextData --> CheckTextContent{Текст не пустой?}
    CheckTextContent -->|Нет| LoopText
    CheckTextContent -->|Да| ParsePosition[Распарсить позицию]
    ParsePosition --> ConvertToPixels[Конвертировать в пиксели]
    ConvertToPixels --> SetFont[Установить шрифт]
    SetFont --> DrawTextElement[Нарисовать текстовый элемент]
    DrawTextElement --> LoopText
    
    ReturnCanvas --> End([Завершение])
```

## Диаграмма активности - Обработка ошибок

```mermaid
flowchart TD
    Start([Возникла ошибка]) --> LogError[Записать в лог]
    LogError --> CheckErrorType{Тип ошибки?}
    
    CheckErrorType -->|PDF Export| PDFError[Ошибка экспорта PDF]
    CheckErrorType -->|Template Loading| TemplateError[Ошибка загрузки шаблона]
    CheckErrorType -->|Field Validation| ValidationError[Ошибка валидации]
    CheckErrorType -->|Editor| EditorError[Ошибка редактора]
    CheckErrorType -->|Other| GeneralError[Общая ошибка]
    
    PDFError --> RestoreUI[Восстановить UI]
    RestoreUI --> ShowPDFAlert[Показать alert с ошибкой PDF]
    
    TemplateError --> ShowTemplateAlert[Показать alert с ошибкой шаблона]
    
    ValidationError --> HighlightField[Подсветить поле с ошибкой]
    HighlightField --> ShowValidationAlert[Показать alert валидации]
    
    EditorError --> DisableEditor[Отключить редактор]
    DisableEditor --> ShowEditorAlert[Показать alert редактора]
    
    GeneralError --> ShowGeneralAlert[Показать общий alert]
    
    ShowPDFAlert --> End([Завершение])
    ShowTemplateAlert --> End
    ShowValidationAlert --> End
    ShowEditorAlert --> End
    ShowGeneralAlert --> End
```
