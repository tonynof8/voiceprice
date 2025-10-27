let basePrice = 0;
let urgent = false;
let isProcessing = false;
let currentAbortController = null; // Для отмены предыдущих запросов

// Получаем элементы с проверкой
const manualInput = document.getElementById('manualInput');
const serviceSelect = document.getElementById('serviceSelect');
const fileLabel = document.getElementById('fileLabel');
const urgentToggle = document.getElementById('urgentToggle');
const resultBlock = document.getElementById('result');

// Логирование для отладки
console.log('🔍 Проверка элементов:', {
  manualInput: !!manualInput,
  serviceSelect: !!serviceSelect,
  fileLabel: !!fileLabel,
  urgentToggle: !!urgentToggle,
  resultBlock: !!resultBlock
});

// ============================================
// ФУНКЦИЯ RETRY С ОТМЕНОЙ ЗАПРОСОВ
// ============================================
async function fetchWithRetry(url, options, retries = 3, externalSignal = null) {
  const requestId = Math.random().toString(36).substring(7);
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 [${requestId}] Попытка ${i + 1}/${retries}`);
      console.log(`📤 [${requestId}] URL:`, url);
      
      const startTime = Date.now();
      
      // Локальный контроллер для таймаута
      const controller = new AbortController();
      const signal = externalSignal || controller.signal;
      
      // Агрессивный таймаут для первой попытки: 8 секунд
      // Для второй и третьей: 15 секунд
      const timeout = i === 0 ? 8000 : 15000;
      
      const timeoutId = setTimeout(() => {
        console.error(`⏱️ [${requestId}] Таймаут после ${timeout/1000} сек`);
        if (!externalSignal) controller.abort();
      }, timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: signal,
        mode: 'cors',
        credentials: 'omit',
        keepalive: false
      });
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ [${requestId}] Ответ за ${duration}ms, статус: ${response.status}`);
      
      // Если первый запрос был медленным (>5 сек), логируем это
      if (i === 0 && duration > 5000) {
        console.warn(`🐌 [${requestId}] Первый запрос медленный: ${duration}ms (сервер спал?)`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [${requestId}] Ошибка сервера:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ [${requestId}] Успех:`, data);
      
      return {
        ok: true,
        status: response.status,
        data: data,
        json: async () => data
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`🛑 [${requestId}] Запрос отменён (таймаут)`);
        
        // Если это был первый запрос и он завис - retry сразу
        if (i === 0) {
          console.log(`🔄 [${requestId}] Сервер спал, пробуем сразу снова...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Пауза 0.5 сек
          continue;
        }
        
        throw error;
      }
      
      console.error(`❌ [${requestId}] Попытка ${i + 1} провалилась:`, {
        name: error.name,
        message: error.message
      });
      
      if (i === retries - 1) {
        console.error(`💥 [${requestId}] Все попытки исчерпаны`);
        throw error;
      }
      
      // Exponential backoff: 1, 2, 4 секунды
      const delay = Math.min(1000 * Math.pow(2, i), 4000);
      console.log(`⏳ [${requestId}] Ждём ${delay}ms перед retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ============================================
// ПЕРЕКЛЮЧАТЕЛЬ СРОЧНОСТИ
// ============================================
window.calcToggleUrgent = function() {
  if (!urgentToggle || !manualInput) {
    console.error('❌ Элементы не найдены для toggleUrgent');
    return;
  }
  
  urgent = !urgent;
  urgentToggle.classList.toggle('active', urgent);
  
  if (manualInput.value && parseInt(manualInput.value) > 0) {
    calculate();
  }
}

// ДОБАВИТЬ ЭТУ СТРОКУ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
window.toggleUrgent = window.calcToggleUrgent;

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
  
  const allowFile = ['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value);
  const fileWrapper = document.getElementById("fileWrapper");
  
  if (fileWrapper) {
    fileWrapper.classList.toggle('hidden', !allowFile);
  }

  const ph = {
    'voice_text': 'Введите количество слов',
    'voice_video': 'Введите длительность видео (минуты)',
    'translate_text': 'Введите количество знаков без пробелов',
    'translate_voice': 'Введите длительность видео (минуты)',
    'voice_camera': 'Введите количество слов'
  };
  
  manualInput.placeholder = ph[serviceSelect.value] || 'Введите вручную';
  
  const tooltipText = document.getElementById('tooltipText');
  if (tooltipText) {
    tooltipText.classList.add('fade-out');
    
    setTimeout(() => {
      tooltipText.textContent = serviceTips[serviceSelect.value] || "";
      tooltipText.classList.remove('fade-out');
    }, 300);
  }
  
  manualInput.value = '';
}

if (serviceSelect) {
  serviceSelect.addEventListener('change', updateUI);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  updateUI();

// ============================================
// ENTER ДЛЯ РАСЧЁТА
// ============================================
  if (manualInput) {
    manualInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        console.log('⌨️ Enter нажат, запускаем calculate()');
        calculate();
      }
    });
    
    // Дополнительно добавляем keydown (для совместимости)
    manualInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        console.log('⌨️ Enter (keydown) нажат, запускаем calculate()');
        calculate();
      }
    });
    
    console.log('✅ Обработчики Enter добавлены');
  } else {
    console.error('❌ manualInput не найден для Enter');
  }
  
  // ============================================
  // DRAG AND DROP (инициализация после загрузки DOM)
  // ============================================
  const dropZone = document.querySelector('.calculator-wrapper');
  const dropOverlay = document.getElementById('dropOverlay');
  let dragCounter = 0;

  console.log('🎯 Drag and Drop элементы:', {
    dropZone: dropZone,
    dropOverlay: dropOverlay
  });

  if (dropZone && dropOverlay) {
    console.log('✅ Drag and Drop инициализирован');
    
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      console.log('📥 dragenter, counter:', dragCounter);
      dropOverlay.classList.add('active');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      console.log('📤 dragleave, counter:', dragCounter);
      if (dragCounter === 0) {
        dropOverlay.classList.remove('active');
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
      console.log('📦 drop событие');
      dropOverlay.classList.remove('active');

      const file = e.dataTransfer.files[0];
      console.log('📄 Файл:', file?.name, file?.type);
      
      if (!file || !['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        alert('Поддерживаются только .txt и .docx');
        return;
      }

      if (serviceSelect && !['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value)) {
        serviceSelect.value = 'voice_text';
        updateUI();
      }

      const fileInput = document.getElementById('fileInput');
      if (fileInput) {
        fileInput.files = e.dataTransfer.files;
        handleFile({ target: { files: e.dataTransfer.files } });
      } else {
        console.error('❌ fileInput не найден при drop');
      }
    });
  } else {
    console.error('❌ Drag and Drop не инициализирован:', {
      dropZone: !!dropZone,
      dropOverlay: !!dropOverlay
    });
  }
  
  // Обновляем текущую дату в футере
  setTimeout(() => {
    const dateSpan = document.getElementById('currentDate');
    console.log('🗓️ Элемент даты:', dateSpan);
    
    if (dateSpan) {
      const today = new Date();
      const formatted = today.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      console.log('📅 Устанавливаем дату:', formatted);
      dateSpan.textContent = formatted;
    } else {
      console.error('❌ Элемент currentDate не найден');
    }
  }, 100);
});

// ============================================
// FILE INPUT
// ============================================
const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', handleFile);
} else {
  console.error('❌ fileInput не найден');
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

  if (!fileLabel || !resultBlock) {
    console.error('❌ Элементы не найдены в handleFile');
    return;
  }

  isProcessing = true;

  const icon = fileLabel.querySelector('.icon');
  const loader = fileLabel.querySelector('.loader');
  
  if (icon) icon.classList.add('hidden');
  if (loader) loader.classList.remove('hidden');

const done = async (text) => {
  try {
    console.log('📄 Подсчитываем слова/символы...');
    const count = await countBackend(text);
    
    // СРАЗУ УБИРАЕМ СПИННЕР ПОСЛЕ ПОДСЧЁТА
    if (icon) icon.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
    
    if (!isNaN(count) && count >= 1) {
      if (manualInput) manualInput.value = count;
            
      // СБРАСЫВАЕМ ФЛАГ ПЕРЕД ВЫЗОВОМ calculate()
      isProcessing = false;
      
      console.log('🚀 Запускаем calculate()');
      calculate();
    } else {
      if (manualInput) manualInput.value = 0;
      alert("Файл не содержит текста!");
      isProcessing = false;
    }
  } catch (err) {
    // При ошибке тоже убираем спиннер
    if (icon) icon.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
    
    console.error('❌ Ошибка обработки:', err);
    alert("Ошибка при подсчёте слов. Проверьте файл.");
    isProcessing = false;
  }
};

  const fail = (msg) => {
    if (icon) icon.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
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
          const recoveredText = e.target.result;
          done(recoveredText);
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
          const text = result.value || '';
          done(text);
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
// ПОДСЧЁТ СЛОВ/СИМВОЛОВ НА СЕРВЕРЕ
// ============================================
async function countBackend(text) {
  if (!serviceSelect) {
    throw new Error('serviceSelect не найден');
  }
  
  const service = serviceSelect.value;
  const url = service === 'translate_text'
    ? "https://telegram-voicebot.onrender.com/count_chars"
    : "https://telegram-voicebot.onrender.com/count_words";

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, service })
  }, 3);

  const data = await response.json();
  return service === 'translate_text' ? data.chars : data.words;
}

// ============================================
// РАСЧЁТ СТОИМОСТИ
// ============================================
async function calculate() {
  if (isProcessing) {
    console.log('⏳ Уже идёт расчёт...');
    return;
  }

  if (!serviceSelect || !manualInput || !resultBlock) {
    console.error('❌ Элементы не найдены в calculate');
    return;
  }

  // ОТМЕНЯЕМ ПРЕДЫДУЩИЙ ЗАПРОС ЕСЛИ ЕСТЬ
  if (currentAbortController) {
    console.log('🛑 Отменяем предыдущий запрос');
    currentAbortController.abort();
    currentAbortController = null;
  }

  const service = serviceSelect.value;
  let value = parseInt(manualInput.value) || 0;

  const resultContent = resultBlock.querySelector('.result-content');
  
  if (!value || value <= 0) {
    if (resultContent) {
      resultContent.innerHTML = '<p style="color: #ff4444; text-align: center; margin: 0;">❌ Введите корректное значение</p>';
    }
    return;
  }

  isProcessing = true;
  
  // СОЗДАЁМ НОВЫЙ КОНТРОЛЛЕР
  currentAbortController = new AbortController();
  
  // БЛОКИРУЕМ КНОПКУ
  const calcButton = document.querySelector('button[onclick="calcCalculate()"]');
  if (calcButton) {
    calcButton.disabled = true;
    calcButton.style.opacity = '0.5';
    calcButton.style.cursor = 'not-allowed';
    calcButton.textContent = 'Рассчитываем...';
  }

  if (resultContent) {
    resultContent.innerHTML = `
      <div class="spinner"></div>
      <div id="calc-loading-message" style="margin-top:12px;color:#888;text-align:center;">Считаем стоимость...</div>
      <div id="calc-loading-timer" style="margin-top:8px;color:#666;font-size:12px;text-align:center;">0 сек</div>
    `;
  
    // Таймер для показа времени ожидания
    let seconds = 0;
    const timerInterval = setInterval(() => {
      seconds++;
      const timerEl = document.getElementById('calc-loading-timer');
      const messageEl = document.getElementById('calc-loading-message');
    
      if (timerEl) {
        timerEl.textContent = `${seconds} сек`;
      
        if (seconds >= 5 && messageEl) {
          messageEl.textContent = 'Сервер просыпается, подождите...';
          timerEl.style.color = '#ff9800';
        }
      
        if (seconds >= 10 && messageEl) {
          messageEl.textContent = 'Сервер долго отвечает, ждём...';
          timerEl.style.color = '#ff6b35';
        }
      }
    }, 1000);
  
  // Сохраняем интервал для очистки
  window.calcTimerInterval = timerInterval;
}

  const payload = {
    service: service,
    text: value.toString(),
    is_urgent: urgent
  };

try {
  console.log('💰 Расчёт стоимости...', payload);
  console.log('🕐 Timestamp:', new Date().toISOString());
  
  // Делаем быстрый ping перед основным запросом
  const pingStart = Date.now();
  try {
    await fetch('https://telegram-voicebot.onrender.com/calculate', {
      method: 'HEAD',
      mode: 'no-cors',
      keepalive: false
    });
    console.log(`🏓 Ping за ${Date.now() - pingStart}ms`);
  } catch (e) {
    console.log('🏓 Ping failed (это нормально)');
  }
  
  const response = await fetchWithRetry(
    "https://telegram-voicebot.onrender.com/calculate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    3,
    currentAbortController.signal
  );
    
  const response = await fetchWithRetry(
    "https://telegram-voicebot.onrender.com/calculate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    3,
    currentAbortController.signal // Передаём signal для отмены
  );

  const data = await response.json();
  console.log('✅ Результат:', data);

  function secondsToTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

    let serviceTitle = {
      'voice_text': "Озвучка текста",
      'voice_video': "Озвучка видео",
      'translate_text': "Перевод текста",
      'translate_voice': "Перевод + озвучка видео",
      'voice_camera': "Озвучка текста на камеру"
    }[service] || "";

    let resultText = ``;

    resultText += `
      <div class="result-row">
        <div class="icon">📦</div>
        <div class="label">Услуга:</div>
        <div class="value">${serviceTitle}${urgent ? " (СРОЧНО)" : ""}</div>
      </div>
    `;

    if (service === 'voice_text' || service === 'voice_camera') {
      const words = data.word_count;
      const minutes = Math.ceil(words / 120);
      const optimal_time = secondsToTime(Math.round(words * 60 / 133));
      resultText += `
        <div class="result-row">
          <div class="icon">📄</div>
          <div class="label">Слов:</div>
          <div class="value">${words}</div>
        </div>
        <div class="result-row">
          <div class="icon">🕑</div>
          <div class="label">До:</div>
          <div class="value">${minutes} минут</div>
        </div>
        <div class="result-row">
          <div class="icon">🎯</div>
          <div class="label">Оптимальный хронометраж:</div>
          <div class="value">${optimal_time}</div>
        </div>
      `;
    }

    if (service === 'voice_video' || service === 'translate_voice') {
      resultText += `
        <div class="result-row">
          <div class="icon">🕑</div>
          <div class="label">До:</div>
          <div class="value">${value} минут</div>
        </div>
      `;
    }

    if (service === 'translate_text') {
      resultText += `
        <div class="result-row">
          <div class="icon">📝</div>
          <div class="label">Знаков без пробелов:</div>
          <div class="value">${value}</div>
        </div>
      `;
    }

    const deadline = urgent ? data.deadline_urgent : data.deadline;
    const match = deadline.match(/^(.+?) \(до (.+?) включительно\)$/);

    let daysOnly = '';
    if (match?.[1]) {
      const num = parseInt(match[1]);
      if (!isNaN(num)) {
        daysOnly = num === 1 ? '1 день' : `до ${num} дней`;
      } else {
        daysOnly = `до ${match[1]}`;
      }
    }

    const dateOnly = match?.[2] || "";

    resultText += `
      <div class="result-row">
        <div class="icon">⏰</div>
        <div class="label">Срок выполнения:</div>
        <div class="value">${daysOnly}</div>
      </div>
      <div class="result-row">
        <div class="icon">📅</div>
        <div class="label">Дедлайн:</div>
        <div class="value">${dateOnly}</div>
      </div>
    `;

    resultText += `
      <div class="result-row">
        <div class="icon">💰</div>
        <div class="label">Стоимость:</div>
        <div class="value">${
          urgent
            ? `${data.price_rub.toLocaleString('ru-RU')} ₽ ➡️ ${data.price_rub_urgent.toLocaleString('ru-RU')} ₽`
            : `${data.price_rub.toLocaleString('ru-RU')} ₽`
        }</div>
      </div>
    `;

    setTimeout(() => {
      const resultContent = resultBlock.querySelector('.result-content');
      if (resultContent) {
        resultContent.innerHTML = resultText;
      }
    }, 600 + Math.random() * 400);

  } catch (error) {
    // Игнорируем ошибки отмены
    if (error.name === 'AbortError') {
      console.log('🛑 Запрос отменён пользователем');
      return;
    }
    
    console.error('❌ Ошибка расчёта:', error);
    
    const resultContent = resultBlock.querySelector('.result-content');
    if (resultContent) {
      resultContent.innerHTML = `
        <p style="color: #ff4444; text-align: center; margin: 0;">
          ❌ Ошибка: ${error.message}
          <br><br>
          <button onclick="calculate()" style="padding: 8px 16px; background: var(--button-bg); border: none; color: white; border-radius: var(--radius); cursor: pointer;">
            Попробовать снова
          </button>
        </p>
      `;
    }
} finally {
  isProcessing = false;
  currentAbortController = null;
  
  // Останавливаем таймер
  if (window.calcTimerInterval) {
    clearInterval(window.calcTimerInterval);
    window.calcTimerInterval = null;
  }
  
  // РАЗБЛОКИРУЕМ КНОПКУ
  if (calcButton) {
    calcButton.disabled = false;
    calcButton.style.opacity = '1';
    calcButton.style.cursor = 'pointer';
    calcButton.textContent = 'Рассчитать стоимость';
  }
}
}

// Делаем доступными глобально
window.calcCalculate = calculate;
window.calculate = calculate;

// ============================================
// ОЧИСТКА ПРИ УХОДЕ СО СТРАНИЦЫ
// ============================================
window.addEventListener('beforeunload', () => {
  if (currentAbortController) {
    console.log('🧹 Очистка: отмена запросов');
    currentAbortController.abort();
  }
});
// ============================================
// АКТИВНЫЙ ПРОГРЕВ СЕРВЕРА
// ============================================
let warmupInterval = null;

async function warmupServer() {
  try {
    console.log('🔥 Прогреваем сервер...');
    const start = Date.now();
    
    await fetch('https://telegram-voicebot.onrender.com/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        service: 'voice_text', 
        text: '100', 
        is_urgent: false 
      }),
      keepalive: false
    });
    
    const duration = Date.now() - start;
    console.log(`✅ Сервер прогрет за ${duration}ms`);
  } catch (error) {
    console.log('⚠️ Сервер спит или недоступен');
  }
}

// Прогрев при загрузке
warmupServer();

// Прогрев каждые 5 минут
warmupInterval = setInterval(() => {
  console.log('⏰ Плановый прогрев сервера...');
  warmupServer();
}, 5 * 60 * 1000); // 5 минут

// Остановка прогрева при закрытии страницы
window.addEventListener('beforeunload', () => {
  if (warmupInterval) {
    clearInterval(warmupInterval);
  }
  if (currentAbortController) {
    currentAbortController.abort();
  }
});
