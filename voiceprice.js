let basePrice = 0;
let urgent = false;

let isProcessing = false;

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Попытка ${i + 1}/${retries}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
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
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

const manualInput = document.getElementById('manualInput');
const serviceSelect = document.getElementById('serviceSelect');
const fileLabel = document.getElementById('fileLabel');
const urgentToggle = document.getElementById('urgentToggle');
const resultBlock = document.getElementById('result');

window.toggleUrgent = function() {
  urgent = !urgent;
  urgentToggle.classList.toggle('active', urgent);
  
  if (manualInput.value && parseInt(manualInput.value) > 0) {
    calculate();
  }
}

manualInput.addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    calculate();
  }
});

const serviceTips = {
  "voice_text": "⚡ Загрузите txt или docx, или укажите точное количество слов для озвучки. Все числа, сокращения и единицы должны быть записаны полностью — так, как вы хотите, чтобы их произнесли. Например: 32 м - тридцать два метра",
  "voice_video": "⏱️ Длительность видео небходимо вводить с округлением в большую степень. 6 минут 3 секунды => 7 минут",
  "translate_text": "📚 Введите количество знаков без пробелов или перетяните сюда текстовый документ (txt, docx) для точного расчета.",
  "translate_voice": "🌍 Длительность видео небходимо вводить с округлением в большую степень. 6 минут 3 секунды => 7 минут",
  "voice_camera": "📹 Загрузите txt или docx, или укажите точное количество слов для озвучки. Все числа, сокращения и единицы должны быть записаны полностью — так, как вы хотите, чтобы их произнесли. Например: 120 км → сто двадцать километров."
};

function updateUI() {
  const allowFile = ['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value);
  const fileWrapper = document.getElementById("fileWrapper");
  fileWrapper.classList.toggle('hidden', !allowFile);

  const ph = {
    'voice_text': 'Введите количество слов',
    'voice_video': 'Введите длительность видео (минуты)',
    'translate_text': 'Введите количество знаков без пробелов',
    'translate_voice': 'Введите длительность видео (минуты)',
    'voice_camera': 'Введите количество слов'
  };
  manualInput.placeholder = ph[serviceSelect.value] || 'Введите вручную';
  
  // Анимация смены подсказки
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

serviceSelect.addEventListener('change', updateUI);

document.addEventListener("DOMContentLoaded", updateUI);

// Drag and Drop
const dropZone = document.querySelector('.calculator-wrapper');
const dropOverlay = document.getElementById('dropOverlay');
let dragCounter = 0;

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

  if (!['voice_text', 'translate_text', 'voice_camera'].includes(serviceSelect.value)) {
    serviceSelect.value = 'voice_text';
    updateUI();
  }

  document.getElementById('fileInput').files = e.dataTransfer.files;
  handleFile({ target: { files: e.dataTransfer.files } });
});

document.getElementById('fileInput').addEventListener('change', handleFile);

function handleFile(e) {
  if (isProcessing) {
    console.log('⏳ Уже обрабатывается файл...');
    return;
  }
  
  const file = e.target.files[0];
  if (!file) return;
  
  isProcessing = true;

  const icon = fileLabel.querySelector('.icon');
  const loader = fileLabel.querySelector('.loader');
  icon.classList.add('hidden');
  loader.classList.remove('hidden');

  const done = async (text) => {
    try {
      console.log('📄 Подсчитываем слова/символы...');
      const count = await countBackend(text);
      if (!isNaN(count) && count >= 1) {
        manualInput.value = count;
        calculate();
      } else {
        manualInput.value = 0;
        alert("Файл не содержит слов!");
      }
    } catch (err) {
      alert("Ошибка при подсчёте слов. Проверь файл.");
    } finally {
      icon.classList.remove('hidden');
      loader.classList.add('hidden');
    }
  };

  const fail = (msg) => {
    icon.classList.remove('hidden');
    loader.classList.add('hidden');
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
          setTimeout(() => {
            done(recoveredText);
            isProcessing = false;
          }, 500 + Math.random() * 800);
        };
        fallbackReader.onerror = () => fail("Не удалось прочитать .txt файл (кодировка).");
        fallbackReader.readAsText(file, 'windows-1251');
      } else {
        setTimeout(() => {
          done(text);
          isProcessing = false; // ← ДОБАВИТЬ
        }, 500 + Math.random() * 800);
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
          setTimeout(() => {
            done(text);
            isProcessing = false; // ← ДОБАВИТЬ
          }, 500 + Math.random() * 800);
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

async function countBackend(text) {
  const service = serviceSelect.value;
  const url = service === 'translate_text'
    ? "https://telegram-voicebot.onrender.com/count_chars"
    : "https://telegram-voicebot.onrender.com/count_words";

    const response = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, service })
  });

  if (!response.ok) throw new Error("Ошибка сервера");
  const data = await response.json();
  return service === 'translate_text' ? data.chars : data.words;
}

async function calculate() {
  if (isProcessing) {
    console.log('⏳ Уже идёт расчёт...');
    return;
  }
  isProcessing = true;
  
  const service = serviceSelect.value;
  let value = parseInt(manualInput.value) || 0;

  const resultContent = resultBlock.querySelector('.result-content');
  
  if (!value || value <= 0) {
    if (resultContent) {
      resultContent.innerHTML = '<p style="color: #ff4444; text-align: center; margin: 0;">Введите корректное значение.</p>';
    }
    return;
  }

  if (resultContent) {
    resultContent.innerHTML = `
      <div class="spinner"></div>
      <div style="margin-top:12px;color:#888;text-align:center;">Считаем стоимость...</div>
    `;
  }

  const payload = {
    service: service,
    text: value.toString(),
    is_urgent: urgent
  };

  try {
    const response = await fetchWithRetry("https://telegram-voicebot.onrender.com/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Ошибка сервера");
    const data = await response.json();

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

/*    resultText += `
      <div class="result-row">
        <div class="icon">💲</div>
        <div class="label">В USDT:</div>
        <div class="value">${
          urgent
            ? `${data.price_usdt} USDT ➡️ ${data.price_usdt_urgent} USDT`
            : `${data.price_usdt} USDT`
        }</div>
      </div>
    `;*/

    setTimeout(() => {
      const resultContent = resultBlock.querySelector('.result-content');
      if (resultContent) {
        resultContent.innerHTML = resultText;
      }
    }, 600 + Math.random() * 400);

  } catch (error) {
    const resultContent = resultBlock.querySelector('.result-content');
    if (resultContent) {
      resultContent.innerHTML = '<p style="color: #ff4444; text-align: center; margin: 0;">Ошибка: ' + error.message + '</p>';
    }
  } finally {
    isProcessing = false; // ← ДОБАВИТЬ ЭТОТ БЛОК
  }
}
