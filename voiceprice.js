let basePrice = 0;
let urgent = false;
let isProcessing = false;

// ПРАВИЛЬНЫЕ ID из вашего HTML
const manualInput = document.getElementById('calc-manualInput');
const serviceSelect = document.getElementById('calc-serviceSelect');
const fileLabel = document.getElementById('calc-fileLabel');
const urgentToggle = document.getElementById('calc-urgentToggle');
const resultBlock = document.getElementById('calc-result');

// ============================================
// ФУНКЦИЯ RETRY ДЛЯ ВСЕХ ЗАПРОСОВ
// ============================================
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Попытка ${i + 1}/${retries} → ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
      
    } catch (error) {
      console.warn(`⚠️ Попытка ${i + 1} провалилась:`, error.message);
      
      if (i === retries - 1) throw error;
      
      const delay = 3000 * (i + 1);
      console.log(`⏳ Ждём ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ============================================
// ПЕРЕКЛЮЧАТЕЛЬ СРОЧНОСТИ
// ============================================
window.calcToggleUrgent = function() {
  urgent = !urgent;
  if (urgentToggle) {
    urgentToggle.classList.toggle('active', urgent);
  }
  
  if (manualInput && manualInput.value && parseInt(manualInput.value) > 0) {
    calcCalculate();
  }
}

if (manualInput) {
  manualInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      calcCalculate();
    }
  });
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
  if (!serviceSelect) return;
  
  const allowFile = ['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value);
  const fileWrapper = document.getElementById("calc-fileWrapper");
  if (fileWrapper) {
    fileWrapper.classList.toggle('calc-hidden', !allowFile);
  }

  const ph = {
    'voice_text': 'Введите количество слов',
    'voice_video': 'Введите длительность видео (минуты)',
    'translate_text': 'Введите количество знаков без пробелов',
    'translate_voice': 'Введите длительность видео (минуты)',
    'voice_camera': 'Введите количество слов'
  };
  
  if (manualInput) {
    manualInput.placeholder = ph[serviceSelect.value] || 'Введите вручную';
    manualInput.value = '';
  }
  
  const tooltipText = document.getElementById('calc-tooltipText');
  if (tooltipText) {
    tooltipText.classList.add('fade-out');
    setTimeout(() => {
      tooltipText.textContent = serviceTips[serviceSelect.value] || "";
      tooltipText.classList.remove('fade-out');
    }, 300);
  }
}

if (serviceSelect) {
  serviceSelect.addEventListener('change', updateUI);
}

document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  
  // Обновляем дату
  const dateSpan = document.getElementById('calc-currentDate');
  if (dateSpan) {
    const today = new Date();
    dateSpan.textContent = today.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }
});

// ============================================
// DRAG AND DROP
// ============================================
const dropZone = document.querySelector('.calc-calculator-wrapper');
const dropOverlay = document.getElementById('calc-dropOverlay');
let dragCounter = 0;

if (dropZone && dropOverlay) {
  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    dropOverlay.classList.add('active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
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
    dropOverlay.classList.remove('active');

    const file = e.dataTransfer.files[0];
    if (!file || !['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      alert('Поддерживаются только .txt и .docx');
      return;
    }

    if (serviceSelect && !['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value)) {
      serviceSelect.value = 'voice_text';
      updateUI();
    }

    const fileInput = document.getElementById('calc-fileInput');
    if (fileInput) {
      fileInput.files = e.dataTransfer.files;
      handleFile({ target: { files: e.dataTransfer.files } });
    }
  });
}

const fileInput = document.getElementById('calc-fileInput');
if (fileInput) {
  fileInput.addEventListener('change', handleFile);
}

// ============================================
// ОБРАБОТКА ФАЙЛА
// ============================================
async function handleFile(e) {
  if (isProcessing) {
    console.log('⏳ Уже обрабатывается файл...');
    return;
  }
  
  const file = e.target.files[0];
  if (!file) return;

  isProcessing = true;

  const icon = fileLabel?.querySelector('.calc-icon');
  const loader = fileLabel?.querySelector('.calc-loader');
  const resultContent = resultBlock?.querySelector('.calc-result-content');

  if (icon) icon.classList.add('calc-hidden');
  if (loader) loader.classList.remove('calc-hidden');
  
  if (resultContent) {
    resultContent.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="spinner" style="margin: 0 auto 10px;"></div>
        <div>Обрабатываем файл...</div>
        <div style="font-size: 12px; opacity: 0.7; margin-top: 8px;">
          Если долго - сервер запускается (до 60 сек)
        </div>
      </div>
    `;
  }

  const done = async (text) => {
    try {
      console.log('📄 Подсчитываем слова/символы...');
      const count = await countBackend(text);
      
      if (!isNaN(count) && count >= 1) {
        if (manualInput) manualInput.value = count;
        await calcCalculate();
      } else {
        if (manualInput) manualInput.value = 0;
        if (resultContent) {
          resultContent.innerHTML = '<p style="color: #ff4444; text-align: center;">❌ Файл не содержит текста!</p>';
        }
      }
    } catch (err) {
      console.error('❌ Ошибка:', err);
      if (resultContent) {
        resultContent.innerHTML = `
          <p style="color: #ff4444; text-align: center;">
            ❌ Ошибка обработки файла<br>
            <small>${err.message}</small>
          </p>
        `;
      }
    } finally {
      if (icon) icon.classList.remove('calc-hidden');
      if (loader) loader.classList.add('calc-hidden');
      isProcessing = false;
    }
  };

  const fail = (msg) => {
    if (icon) icon.classList.remove('calc-hidden');
    if (loader) loader.classList.add('calc-hidden');
    if (resultContent) {
      resultContent.innerHTML = `<p style="color: #ff4444; text-align: center;">❌ ${msg}</p>`;
    }
    isProcessing = false;
  };

  if (file.name.endsWith('.txt')) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const text = event.target.result;
      const looksBroken = text.includes("�") || text.length < 100;

      if (looksBroken) {
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e) => done(e.target.result);
        fallbackReader.onerror = () => fail("Не удалось прочитать файл (проблема с кодировкой)");
        fallbackReader.readAsText(file, 'windows-1251');
      } else {
        done(text);
      }
    };
    reader.onerror = () => fail("Не удалось прочитать .txt файл");
    reader.readAsText(file);
  } else if (file.name.endsWith('.docx')) {
    const reader = new FileReader();
    reader.onload = function (event) {
      mammoth.extractRawText({ arrayBuffer: event.target.result })
        .then(result => done(result.value || ''))
        .catch(() => fail("Не удалось извлечь текст из .docx"));
    };
    reader.onerror = () => fail("Не удалось прочитать .docx файл");
    reader.readAsArrayBuffer(file);
  } else {
    fail("Поддерживаются только .txt и .docx");
  }
}

// ============================================
// ПОДСЧЁТ СЛОВ/СИМВОЛОВ НА СЕРВЕРЕ
// ============================================
async function countBackend(text) {
  if (!serviceSelect) throw new Error('Service select not found');
  
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
// РАСЧЁТ СТОИМОСТИ (глобальная функция)
// ============================================
window.calcCalculate = async function() {
  if (isProcessing) {
    console.log('⏳ Уже идёт расчёт...');
    return;
  }

  if (!serviceSelect || !manualInput || !resultBlock) {
    console.error('❌ Элементы не найдены');
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
      <div style="text-align: center; padding: 20px;">
        <div class="spinner" style="margin: 0 auto 10px;"></div>
        <div>Рассчитываем стоимость...</div>
        <div style="font-size: 12px; opacity: 0.7; margin-top: 8px;">
          Если долго - сервер запускается (до 60 сек)
        </div>
      </div>
    `;
  }

  const payload = {
    service: service,
    text: value.toString(),
    is_urgent: urgent
  };

  try {
    console.log('💰 Расчёт стоимости...', payload);
    
    const response = await fetchWithRetry("https://telegram-voicebot.onrender.com/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, 3);

    const data = await response.json();
    console.log('✅ Результат:', data);

    // ОСТАВЛЯЕМ ВАШ КОД ФОРМАТИРОВАНИЯ (просто копируем из оригинала)
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

    let resultText = `
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
      if (resultContent) {
        resultContent.innerHTML = resultText;
      }
    }, 600 + Math.random() * 400);

  } catch (error) {
    console.error('❌ Ошибка расчёта:', error);
    
    let errorMsg = 'Произошла ошибка при расчёте';
    if (error.name === 'AbortError' || error.message.includes('CONNECTION')) {
      errorMsg = '🔄 Сервер запускается... Попробуйте через 30 секунд';
    }
    
    if (resultContent) {
      resultContent.innerHTML = `
        <p style="color: #ff4444; text-align: center;">
          ❌ ${errorMsg}<br>
          <button onclick="calcCalculate()" style="margin-top: 12px; padding: 8px 16px; background: var(--calc-button-bg); border: none; color: white; border-radius: var(--calc-radius); cursor: pointer;">
            Попробовать снова
          </button>
        </p>
      `;
    }
  } finally {
    isProcessing = false;
  }
}

// Делаем доступной через window
window.calculate = window.calcCalculate;

// ============================================
// ПРОГРЕВ СЕРВЕРА
// ============================================
(async function warmupServer() {
  try {
    console.log('🔥 Прогреваем сервер...');
    await fetch('https://telegram-voicebot.onrender.com/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'voice_text', text: '100', is_urgent: false })
    }).catch(() => {});
    console.log('✅ Сервер прогрет');
  } catch (error) {
    console.log('⚠️ Сервер спит');
  }
})();
