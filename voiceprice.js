// ============================================
// VOICEPRICE.JS - Калькулятор стоимости (автономная версия)
// ============================================

console.log('📦 Загрузка voiceprice.js...');

let basePrice = 0;
let urgent = false;
let isProcessing = false;
let isTextMode = false; // false = Файл, true = Текст
let textDebounceTimer = null;

// Получаем элементы
const manualInput = document.getElementById('calc-manualInput');
const serviceSelect = document.getElementById('calc-serviceSelect');
const fileLabel = document.getElementById('calc-fileLabel');
const urgentToggle = document.getElementById('calc-urgentToggle');
const resultBlock = document.getElementById('calc-result');

// Логирование для отладки
console.log('🔍 Проверка элементов:', {
  manualInput: !!manualInput,
  serviceSelect: !!serviceSelect,
  fileLabel: !!fileLabel,
  urgentToggle: !!urgentToggle,
  resultBlock: !!resultBlock
});

// ============================================
// ПЕРЕКЛЮЧАТЕЛЬ СРОЧНОСТИ
// ============================================

window.calcToggleUrgent = function() {
  if (!urgentToggle || !manualInput) {
    console.error('❌ Элементы не найдены для toggleUrgent');
    return;
  }
  
  urgent = !urgent;
  urgentToggle.classList.toggle('calc-active', urgent);
  
  if (manualInput.value && parseInt(manualInput.value) > 0) {
    calculate();
  }
}

// ============================================
// ПОДСКАЗКИ ДЛЯ УСЛУГ
// ============================================

const serviceTips = {
  "voice_text": "⚡ Загрузите txt или docx, или укажите точное количество слов для озвучки. Все числа, сокращения и единицы должны быть записаны полностью — так, как вы хотите, чтобы их произнесли. Например: 32 м - тридцать два метра",
  "voice_video": "⏱️ Длительность видео необходимо вводить с округлением в большую сторону. 6 минут 3 секунды => 7 минут",
  "translate_text": "📚 Введите количество знаков без пробелов или перетяните сюда текстовый документ (txt, docx) для точного расчета.",
  "translate_voice": "🌍 Длительность видео необходимо вводить с округлением в большую сторону. 6 минут 3 секунды => 7 минут",
  "voice_camera": "📹 Загрузите txt или docx, или укажите точное количество слов для озвучки. Все числа, сокращения и единицы должны быть записаны полностью — так, как вы хотите, чтобы их произнесли. Например: 120 км → сто двадцать километров."
};

function updateUI() {
  if (!serviceSelect || !manualInput) {
    console.error('❌ Элементы не найдены в updateUI');
    return;
  }
  
  const service = serviceSelect.value;
  const allowFile = ['voice_text', 'translate_text', 'voice_camera'].includes(service);
  
  // Показываем/скрываем toggle [Файл]
  const modeToggle = document.getElementById('calc-modeToggle');
  if (modeToggle) {
    if (allowFile) {
      modeToggle.style.display = '';  // Показываем
    } else {
      modeToggle.style.display = 'none';  // Скрываем полностью
      // Возвращаем в режим файла если toggle был скрыт в режиме текста
      if (isTextMode) {
        isTextMode = false;
        const modeIcon = modeToggle.querySelector('.calc-mode-icon');
        const modeText = modeToggle.querySelector('.calc-mode-text');
        modeToggle.classList.remove('calc-active');
        if (modeIcon) modeIcon.textContent = '📎';
        if (modeText) modeText.textContent = 'Файл';
      }
    }
  }

  // Плейсхолдеры для поля ввода
  const ph = {
    'voice_text': 'Введите количество слов',
    'voice_video': 'Введите длительность видео (минуты)',
    'translate_text': 'Введите количество знаков без пробелов',
    'translate_voice': 'Введите длительность видео (минуты)',
    'voice_camera': 'Введите количество слов'
  };
  
  manualInput.placeholder = ph[service] || 'Введите вручную';
  
  // Очищаем поле ввода при смене услуги
  manualInput.value = '';
  
  // Очищаем textarea если в режиме текста
  const textarea = document.getElementById('calc-textArea');
  if (textarea) {
    textarea.value = '';
    updateTextStats();
  }
  
  // ВАЖНО: Восстанавливаем структуру resultContent с tooltipText
  const resultContentBlock = document.getElementById('calc-resultContent');
  
  if (resultContentBlock) {
    // Очищаем старые результаты и восстанавливаем базовую структуру
    resultContentBlock.innerHTML = '<div class="calc-tooltip-info" id="calc-tooltipText"></div>';
  }
  
  // ВАЖНО: Вызываем updateResultZone() ПОСЛЕ очистки, чтобы она заполнила контент
  updateResultZone();
}

function updateResultZone() {
  const service = serviceSelect ? serviceSelect.value : 'voice_text';
  const fileZone = document.getElementById('calc-fileZone');
  const textZone = document.getElementById('calc-textZone');
  const resultContent = document.getElementById('calc-resultContent');
  
  if (!fileZone || !textZone || !resultContent) return;
  
  const allowFile = ['voice_text', 'translate_text', 'voice_camera'].includes(service);
  
  // Если услуга НЕ поддерживает файлы (видео)
  if (!allowFile) {
    fileZone.classList.add('calc-hidden');
    textZone.classList.add('calc-hidden');
    resultContent.classList.remove('calc-hidden');
    
    // Показываем подсказку для видео
    const tooltipText = document.getElementById('calc-tooltipText');
    if (tooltipText) {
      if (service === 'voice_video') {
        tooltipText.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div class="calc-tooltip-icon">🎬</div>
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">Озвучка видео</div>
            <div style="font-size: 0.95rem; opacity: 0.8;">Длительность видео необходимо вводить с округлением в большую сторону.</div>
            <div style="font-size: 0.9rem; opacity: 0.7; margin-top: 8px;">Например: 6 минут 3 секунды → 7 минут</div>
          </div>
        `;
      } else if (service === 'translate_voice') {
        tooltipText.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div class="calc-tooltip-icon">🌍🎬</div>
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">Перевод + озвучка видео</div>
            <div style="font-size: 0.95rem; opacity: 0.8;">Длительность видео необходимо вводить с округлением в большую сторону.</div>
            <div style="font-size: 0.9rem; opacity: 0.7; margin-top: 8px;">Например: 6 минут 3 секунды → 7 минут</div>
          </div>
        `;
      }
    }
  } else {
    // Для текстовых услуг - показываем нужный режим
    
    // ВАЖНО: Сбрасываем состояние fileZone (скрываем loader, показываем контент)
    const fileZoneContent = fileZone ? fileZone.querySelector('.calc-file-zone-content') : null;
    const fileZoneLoader = fileZone ? fileZone.querySelector('.calc-file-zone-loader') : null;
    
    if (fileZoneContent) fileZoneContent.classList.remove('calc-hidden');
    if (fileZoneLoader) fileZoneLoader.classList.add('calc-hidden');
    
    if (isTextMode) {
      fileZone.classList.add('calc-hidden');
      textZone.classList.remove('calc-hidden');
      resultContent.classList.add('calc-hidden');
    } else {
      fileZone.classList.remove('calc-hidden');
      textZone.classList.add('calc-hidden');
      resultContent.classList.add('calc-hidden');
    }
  }
}

if (serviceSelect) {
  serviceSelect.addEventListener('change', updateUI);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  
  // Enter для расчёта
  if (manualInput) {
    manualInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        calculate();
      }
    });
  }
  
  // Drag and Drop
  const dropZone = document.querySelector('.calc-calculator-wrapper');
  const dropOverlay = document.getElementById('calc-dropOverlay');
  let dragCounter = 0;

  if (dropZone && dropOverlay) {
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      
      // Показываем overlay ВСЕГДА
      dropOverlay.classList.add('calc-active');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) {
        dropOverlay.classList.remove('calc-active');
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dropOverlay.classList.remove('calc-active');

      const file = e.dataTransfer.files[0];
      
      if (!file || !['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        alert('Поддерживаются только .txt и .docx');
        return;
      }

      // Автоматически переключаем на подходящую услугу
      if (serviceSelect) {
        const allowFile = ['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value);
        
        if (!allowFile) {
          // Переключаем на "Озвучка текста" по умолчанию
          serviceSelect.value = 'voice_text';
          updateUI();
          console.log('📝 Автоматически переключено на "Озвучка текста"');
        }
        
        // Если в режиме текста - переключаем на файл
        if (isTextMode) {
          calcToggleMode();
        }
      }

      const fileInput = document.getElementById('calc-fileInput');
      if (fileInput) {
        fileInput.files = e.dataTransfer.files;
        handleFile({ target: { files: e.dataTransfer.files } });
      }
    });
  }
});

// ============================================
// FILE INPUT
// ============================================

const fileInput = document.getElementById('calc-fileInput');
if (fileInput) {
  fileInput.addEventListener('change', handleFile);
}

// ============================================
// ОБРАБОТКА ФАЙЛА
// ============================================

function handleFile(e) {
  if (isProcessing) {
    console.log('⏳ Уже обрабатывается файл...');
    return;
  }
  
  const file = e.target.files[0];
  if (!file) return;

  isProcessing = true;

  // СНАЧАЛА скрываем результат и показываем fileZone с loader
  const fileZone = document.getElementById('calc-fileZone');
  const textZone = document.getElementById('calc-textZone');
  const resultContent = document.getElementById('calc-resultContent');
  const fileZoneContent = fileZone ? fileZone.querySelector('.calc-file-zone-content') : null;
  const fileZoneLoader = fileZone ? fileZone.querySelector('.calc-file-zone-loader') : null;
  
  // Показываем fileZone, скрываем результат
  if (fileZone) fileZone.classList.remove('calc-hidden');
  if (textZone) textZone.classList.add('calc-hidden');
  if (resultContent) resultContent.classList.add('calc-hidden');
  
  // Показываем loader
  if (fileZoneContent) fileZoneContent.classList.add('calc-hidden');
  if (fileZoneLoader) fileZoneLoader.classList.remove('calc-hidden');

  const done = async (text) => {
    try {
      console.log('📄 Подсчитываем слова/символы локально...');
      
      // ДОБАВЛЯЕМ СЛУЧАЙНУЮ ЗАДЕРЖКУ 1-2 СЕКУНДЫ
      const randomDelay = 1000 + Math.random() * 1000; // 1000-2000ms
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      const service = serviceSelect.value;
      const count = service === 'translate_text' 
        ? window.PricingCalculator.countChars(text)
        : window.PricingCalculator.countWords(text);
      
      console.log(`✅ Подсчитано: ${count}`);
      
      // НЕ показываем обратно fileZone, loader остаётся пока не появится результат
      
      if (!isNaN(count) && count >= 1) {
        if (manualInput) manualInput.value = count;
        
        // Небольшая пауза перед расчётом
        await new Promise(resolve => setTimeout(resolve, 300));
        
        isProcessing = false;
        
        console.log('🚀 Запускаем calculate()');
        calculate();
      } else {
        // Показываем обратно fileZone только если ошибка
        if (fileZoneContent) fileZoneContent.classList.remove('calc-hidden');
        if (fileZoneLoader) fileZoneLoader.classList.add('calc-hidden');
        
        if (manualInput) manualInput.value = 0;
        alert("Файл не содержит текста!");
        isProcessing = false;
      }
    } catch (err) {
      // Показываем обратно fileZone при ошибке
      if (fileZoneContent) fileZoneContent.classList.remove('calc-hidden');
      if (fileZoneLoader) fileZoneLoader.classList.add('calc-hidden');
      
      console.error('❌ Ошибка обработки:', err);
      alert("Ошибка при подсчёте слов. Проверьте файл.");
      isProcessing = false;
    }
  };

  const fail = (msg) => {
    // Показываем обратно fileZone при ошибке
    if (fileZoneContent) fileZoneContent.classList.remove('calc-hidden');
    if (fileZoneLoader) fileZoneLoader.classList.add('calc-hidden');
    alert(msg);
    isProcessing = false;
  };

  if (file.name.endsWith('.txt')) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const text = event.target.result;
      const looksBroken = text.includes("�") || text.length < 100;

      if (looksBroken) {
        const fallbackReader = new FileReader();
        fallbackReader.onload = function (e) {
          done(e.target.result);
        };
        fallbackReader.onerror = () => fail("Не удалось прочитать .txt файл (кодировка).");
        fallbackReader.readAsText(file, 'windows-1251');
      } else {
        done(text);
      }
    };
    reader.onerror = () => fail("Не удалось прочитать .txt файл.");
    reader.readAsText(file);
  } else if (file.name.endsWith('.docx')) {
    const reader = new FileReader();
    reader.onload = function (event) {
      mammoth.extractRawText({ arrayBuffer: event.target.result })
        .then(result => {
          done(result.value || '');
        })
        .catch(err => {
          fail("Не удалось извлечь текст из .docx файла.");
        });
    };
    reader.onerror = () => fail("Не удалось прочитать .docx файл.");
    reader.readAsArrayBuffer(file);
  } else {
    fail("Поддерживаются только файлы .txt и .docx");
  }
}

// ============================================
// РАСЧЁТ СТОИМОСТИ (БЕЗ API!)
// ============================================

function calculate() {
  if (isProcessing) {
    console.log('⏳ Уже идёт расчёт...');
    return;
  }

  if (!serviceSelect || !manualInput || !resultBlock) {
    console.error('❌ Элементы не найдены в calculate');
    return;
  }

  const service = serviceSelect.value;
  let value = parseInt(manualInput.value) || 0;

  const resultContent = resultBlock.querySelector('.calc-result-content');
  
  if (!value || value <= 0) {
    if (resultContent) {
      resultContent.innerHTML = '<p style="color: #ff4444; text-align: center; margin: 0;">❌ Введите корректное значение</p>';
    }
    return;
  }

  isProcessing = true;

  if (resultContent) {
    resultContent.innerHTML = `
      <div class="calc-spinner"></div>
      <div style="margin-top:12px;color:#888;text-align:center;">Считаем стоимость...</div>
    `;
  }

  setTimeout(() => {
    try {
      console.log('💰 Расчёт стоимости (локально)...', {service, value, urgent});
      
      const result = window.PricingCalculator.calculatePrice(service, value, urgent);
      
      console.log('✅ Результат:', result);

      const serviceTitle = {
        'voice_text': "Озвучка текста",
        'voice_video': "Озвучка видео",
        'translate_text': "Перевод текста",
        'translate_voice': "Перевод + озвучка видео",
        'voice_camera': "Озвучка текста на камеру"
      }[service] || "";

      let resultText = ``;

      resultText += `
        <div class="calc-result-row">
          <span class="calc-icon">📦</span>
          <span class="calc-label">Услуга:</span>
          <span class="calc-value">${serviceTitle}${urgent ? " (СРОЧНО)" : ""}</span>
        </div>
      `;

      if (service === 'voice_text' || service === 'voice_camera') {
        resultText += `
          <div class="calc-result-row">
            <span class="calc-icon">📄</span>
            <span class="calc-label">Слов:</span>
            <span class="calc-value">${result.wordCount}</span>
          </div>
          <div class="calc-result-row">
            <span class="calc-icon">🕑</span>
            <span class="calc-label">До:</span>
            <span class="calc-value">${result.durationMinutes} минут</span>
          </div>
          <div class="calc-result-row">
            <span class="calc-icon">🎯</span>
            <span class="calc-label">Оптимальный хронометраж:</span>
            <span class="calc-value">${result.optimalTiming}</span>
          </div>
        `;
      }

      if (service === 'voice_video' || service === 'translate_voice') {
        resultText += `
          <div class="calc-result-row">
            <span class="calc-icon">🕑</span>
            <span class="calc-label">До:</span>
            <span class="calc-value">${value} минут</span>
          </div>
        `;
      }

      if (service === 'translate_text') {
        resultText += `
          <div class="calc-result-row">
            <span class="calc-icon">📝</span>
            <span class="calc-label">Знаков без пробелов:</span>
            <span class="calc-value">${value}</span>
          </div>
        `;
      }

      resultText += `
        <div class="calc-result-row">
          <span class="calc-icon">⏰</span>
          <span class="calc-label">Срок выполнения:</span>
          <span class="calc-value">${result.deadline.days} ${pluralizeDay(result.deadline.days)}</span>
        </div>
        <div class="calc-result-row">
          <span class="calc-icon">📅</span>
          <span class="calc-label">Дедлайн:</span>
          <span class="calc-value">${result.deadline.date}</span>
        </div>
      `;

      resultText += `
        <div class="calc-result-row">
          <span class="calc-icon">💰</span>
          <span class="calc-label">Стоимость:</span>
          <span class="calc-value">${
            urgent
              ? `${result.priceNormal.toLocaleString('ru-RU')} ₽ ➡️ ${result.priceUrgent.toLocaleString('ru-RU')} ₽`
              : `${result.priceNormal.toLocaleString('ru-RU')} ₽`
          }</span>
        </div>
      `;

      // Кнопка "Заказать"
      // Кнопка "Заказать"
      /*resultText += `
        <div style="margin-top: 20px;">
          <button class="calc-order-button" onclick="showContactOptions()">
            Заказать
          </button>
        </div>
      `;*/
      
      // Сохраняем результат для возврата
      window.lastCalculationResult = resultText;

      if (resultContent) {
        resultContent.innerHTML = resultText;
      }

            // Показываем результат
            const fileZone = document.getElementById('calc-fileZone');
            const textZone = document.getElementById('calc-textZone');
            const resultContentBlock = document.getElementById('calc-resultContent');
            
            if (fileZone) fileZone.classList.add('calc-hidden');
            if (textZone) textZone.classList.add('calc-hidden');
            if (resultContentBlock) resultContentBlock.classList.remove('calc-hidden');

    } catch (error) {
      console.error('❌ Ошибка расчёта:', error);
      
      if (resultContent) {
        resultContent.innerHTML = `
          <p style="color: #ff4444; text-align: center; margin: 0;">
            ❌ Ошибка: ${error.message}
          </p>
        `;
      }
    } finally {
      isProcessing = false;
    }
  }, 300);
}

function pluralizeDay(n) {
  if (n % 10 === 1 && n % 100 !== 11) {
    return "день";
  } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
    return "дня";
  } else {
    return "дней";
  }
}

window.calcCalculate = calculate;
window.calculate = calculate;


// ============================================
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМА: Файл / Текст
// ============================================

window.calcToggleMode = function() {
  const modeToggle = document.getElementById('calc-modeToggle');
  const fileZone = document.getElementById('calc-fileZone');
  const textZone = document.getElementById('calc-textZone');
  const resultContent = document.getElementById('calc-resultContent');
  
  if (!modeToggle || !fileZone || !textZone || !resultContent) {
    console.error('❌ Элементы режима не найдены');
    return;
  }
  
  isTextMode = !isTextMode;
  
  if (isTextMode) {
    // РЕЖИМ ТЕКСТА - просто загораем кнопку
    modeToggle.classList.add('calc-active');
    
    fileZone.classList.add('calc-hidden');
    textZone.classList.remove('calc-hidden');
    resultContent.classList.add('calc-hidden');
    
    // Фокус на textarea
    const textarea = document.getElementById('calc-textArea');
    if (textarea) {
      setTimeout(() => textarea.focus(), 100);
      
      // Подсчёт в реальном времени
      textarea.oninput = function() {
        clearTimeout(textDebounceTimer);
        textDebounceTimer = setTimeout(() => {
          updateTextStats();
        }, 300);
      };
    }
  } else {
    // РЕЖИМ ФАЙЛА - гасим кнопку
    modeToggle.classList.remove('calc-active');
    
    fileZone.classList.remove('calc-hidden');
    textZone.classList.add('calc-hidden');
    resultContent.classList.add('calc-hidden');
    
    // ВАЖНО: Сбрасываем состояние зоны файла
    const fileZoneContent = fileZone ? fileZone.querySelector('.calc-file-zone-content') : null;
    const fileZoneLoader = fileZone ? fileZone.querySelector('.calc-file-zone-loader') : null;
    
    if (fileZoneContent) fileZoneContent.classList.remove('calc-hidden');
    if (fileZoneLoader) fileZoneLoader.classList.add('calc-hidden');
    
    // Очищаем textarea
    const textarea = document.getElementById('calc-textArea');
    if (textarea) textarea.value = '';
    updateTextStats();
  }
}

// ============================================
// ПОДСЧЁТ СЛОВ/СИМВОЛОВ В TEXTAREA
// ============================================

function updateTextStats() {
  const textarea = document.getElementById('calc-textArea');
  const wordCountEl = document.getElementById('calc-textWordCount');
  const charCountEl = document.getElementById('calc-textCharCount');
  
  if (!textarea || !wordCountEl || !charCountEl) return;
  
  const text = textarea.value;
  const service = serviceSelect ? serviceSelect.value : 'voice_text';
  
  const wordCount = window.PricingCalculator.countWords(text);
  const charCount = window.PricingCalculator.countChars(text);
  
  wordCountEl.textContent = wordCount.toLocaleString('ru-RU');
  charCountEl.textContent = charCount.toLocaleString('ru-RU');
  
  // Автоматически подставляем число в поле
  if (manualInput) {
    const count = service === 'translate_text' ? charCount : wordCount;
    manualInput.value = count > 0 ? count : '';
  }
}

// ============================================
// ВСТРОЕННЫЙ ВЫБОР КАНАЛА СВЯЗИ
// ============================================

let orderData = {}; // Данные для заказа
let lastCalculationResult = ''; // Сохранённый результат расчёта

window.showContactOptions = function() {
  const resultContent = document.getElementById('calc-resultContent');
  if (!resultContent) return;
  
  // Сохраняем данные заказа
  const service = serviceSelect ? serviceSelect.value : '';
  const value = manualInput ? parseInt(manualInput.value) : 0;
  
  const serviceTitles = {
    'voice_text': "Озвучка текста",
    'voice_dubbing': "Дубляж",
    'voice_video': "Озвучка видео",
    'translate_text': "Перевод текста",
    'translate_voice': "Перевод + озвучка видео",
    'voice_camera': "Озвучка текста на камеру"
  };
  
  const result = window.PricingCalculator.calculatePrice(service, value, urgent);
  
  orderData = {
    service: serviceTitles[service] || service,
    value: value,
    valueType: ['voice_video', 'translate_voice'].includes(service) ? 'минут' : 
               service === 'translate_text' ? 'символов' : 'слов',
    price: urgent ? result.priceUrgent : result.priceNormal,
    deadline: result.deadline ? result.deadline.text : '',
    urgent: urgent
  };
  
  // Показываем блок с выбором каналов
  const contactHTML = `
    <div class="calc-contact-view">
      <div class="calc-contact-header">
        <div class="calc-contact-title">📞 Выберите удобный способ связи</div>
      </div>
      
      <div class="calc-contact-buttons">
        <a href="https://t.me/malyutinvoice" target="_blank" class="calc-contact-btn calc-contact-telegram">
          <i class="calc-contact-icon fab fa-telegram"></i>
          <div class="calc-contact-info">
            <div class="calc-contact-name">Telegram</div>
          </div>
        </a>
        
        <a href="https://wa.me/79493255256" target="_blank" class="calc-contact-btn calc-contact-whatsapp">
          <i class="calc-contact-icon fab fa-whatsapp"></i>
          <div class="calc-contact-info">
            <div class="calc-contact-name">WhatsApp</div>
          </div>
        </a>
        
        <a href="https://vk.com/tonynof8" target="_blank" class="calc-contact-btn calc-contact-vk">
          <i class="calc-contact-icon fab fa-vk"></i>
          <div class="calc-contact-info">
            <div class="calc-contact-name">ВКонтакте</div>
          </div>
        </a>
        
        <a href="#" class="calc-contact-btn calc-contact-email" onclick="copyEmail(); return false;">
          <i class="calc-contact-icon fas fa-envelope"></i>
          <div class="calc-contact-info">
            <div class="calc-contact-name">Email</div>
          </div>
        </a>
      </div>
      
      <button class="calc-back-button" onclick="showCalculationResult()">
        ← Вернуться к результату расчёта
      </button>
    </div>
  `;
  
  resultContent.innerHTML = contactHTML;
}

window.showCalculationResult = function() {
  const resultContent = document.getElementById('calc-resultContent');
  if (!resultContent || !window.lastCalculationResult) return;
  
  resultContent.innerHTML = window.lastCalculationResult;
}

// ============================================
// КОПИРОВАНИЕ EMAIL
// ============================================

window.copyEmail = function() {
  const email = 'i@nof8.ru';
  
  // Копируем email в буфер обмена
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(() => {
      showNotification('✅ Адрес почты скопирован');
    }).catch(() => {
      fallbackCopyEmail(email);
    });
  } else {
    fallbackCopyEmail(email);
  }
}

// Fallback для старых браузеров
function fallbackCopyEmail(email) {
  const textarea = document.createElement('textarea');
  textarea.value = email;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.top = '0';
  textarea.style.left = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  
  try {
    document.execCommand('copy');
    showNotification('✅ Адрес почты скопирован');
  } catch (err) {
    alert('Email: ' + email);
  }
  
  document.body.removeChild(textarea);
}

// ============================================
// УВЕДОМЛЕНИЕ
// ============================================

function showNotification(text) {
  // Удаляем старое уведомление если есть
  const oldNotification = document.querySelector('.calc-notification');
  if (oldNotification) {
    document.body.removeChild(oldNotification);
  }
  
  // Создаём элемент уведомления (только структура, БЕЗ стилей)
  const notification = document.createElement('div');
  notification.className = 'calc-notification';
  notification.textContent = text;
  
  document.body.appendChild(notification);
  
  // Удаляем через 2.5 секунды
  setTimeout(() => {
    notification.classList.add('calc-hiding');
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 400); // Время анимации исчезновения
  }, 2500);
}

console.log('✅ Встроенный выбор канала связи инициализирован');

console.log('✅ Режим Файл/Текст инициализирован');

console.log('✅ voiceprice.js загружен (автономная версия)');