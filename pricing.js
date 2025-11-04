const DASHES_RE = /[\u2010\u2011\u2012\u2013\u2014\u2212]/g;
const NON_BREAK_SPACES_RE = /[\u00A0\u202F]/g;
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D]/g;
const CLEAN_RE = /[^\wа-яА-ЯёЁ\s\-]/g;
const SPACE_RE = /\s+/g;

function countWordsInNumber(num) {
  num = Math.abs(parseInt(num));
  
  if (num === 0) return 1;
  if (num <= 20) return 1;
  if (num <= 99) return 2;
  if (num <= 999) {
    let words = 1;
    let remainder = num % 100;
    if (remainder > 0) {
      words += countWordsInNumber(remainder);
    }
    return words;
  }
  if (num <= 9999) {
    let thousands = Math.floor(num / 1000);
    let remainder = num % 1000;
    let words = countWordsInNumber(thousands) + 1;
    if (remainder > 0) {
      words += countWordsInNumber(remainder);
    }
    return words;
  }
  if (num <= 999999) {
    let thousands = Math.floor(num / 1000);
    let remainder = num % 1000;
    let words = countWordsInNumber(thousands) + 1;
    if (remainder > 0) {
      words += countWordsInNumber(remainder);
    }
    return words;
  }
  return Math.floor(num.toString().length / 2) + 2;
}

function countWords(text) {
  if (!text) return 0;
  
  text = text.replace(DASHES_RE, '-');
  text = text.replace(NON_BREAK_SPACES_RE, ' ');
  text = text.replace(ZERO_WIDTH_RE, '');
  
  const symbolReplacements = {
    '№': 'номер',
    '$': 'доллар',
    '#': 'хэштэг',
    '@': 'собака',
    '%': 'процент',
    '€': 'евро',
    '£': 'фунт',
    '¥': 'иена',
    '₽': 'рубль',
    '°': 'градус',
    '=': 'равно'
  };
  
  const symbolsPattern = /([№$#@%€£¥₽°=])/g;
  text = text.replace(symbolsPattern, ' $1 ');
  
  for (const [symbol, word] of Object.entries(symbolReplacements)) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escapedSymbol}($|\\s)`, 'g');
    text = text.replace(regex, `$1${word}$2`);
  }
  
  text = text.replace(/\b\d+([.,]\d+)?\b/g, (match) => {
    const num = match.replace(/[.,]/g, '');
    const wordCount = countWordsInNumber(num);
    return ' СЛОВО '.repeat(wordCount).trim();
  });
  
  text = text.replace(/-/g, ' ');
  text = text.replace(/[^\wа-яА-ЯёЁ\s]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  
  const words = text.split(' ');
  const filteredWords = words.filter(word => word.trim() !== '');
  
  return filteredWords.length;
}

function countChars(text) {
  if (!text) return 0;
  return text.replace(/\s/g, '').length;
}

function roundToHundred(value, minimum = 500) {
  return Math.max(minimum, Math.floor((parseInt(value) + 50) / 100) * 100);
}

function calculateTextPrice(words) {
  const minutes = Math.ceil(words / 120);
  let raw;
  
  if (minutes <= 8) {
    raw = minutes * 250;
  } else if (minutes <= 16) {
    raw = minutes * 200;
  } else {
    raw = minutes * 167;
  }
  
  return roundToHundred(raw);
}

function calculateVideoPrice(minutes) {
  minutes = Math.ceil(minutes);
  let raw;
  
  if (minutes <= 2) {
    return 500;
  } else if (minutes <= 5) {
    raw = minutes * 250;
  } else if (minutes <= 10) {
    raw = minutes * 200;
  } else {
    raw = minutes * 167;
  }
  
  return roundToHundred(raw);
}

function calculateTranslateTextPrice(chars) {
  const raw = (chars / 1000) * 200;
  return roundToHundred(raw);
}

function calculateTranslateVoicePrice(minutes) {
  minutes = Math.ceil(minutes);
  const translatePrice = minutes * 200;
  const voicePrice = calculateVideoPrice(minutes);
  return roundToHundred(translatePrice + voicePrice);
}

function calculateFacePrice(words) {
  const basePrice = calculateTextPrice(words);
  const rawPrice = basePrice * 4;
  return roundToHundred(rawPrice, 5000);
}

function applyUrgentMarkup(price) {
  let markup;
  
  if (price <= 500) {
    markup = 1.0;
  } else if (price <= 600) {
    markup = 0.8;
  } else if (price <= 700) {
    markup = 0.7;
  } else if (price <= 800) {
    markup = 0.6;
  } else if (price <= 900) {
    markup = 0.5;
  } else if (price <= 2000) {
    markup = 0.5;
  } else if (price <= 2100) {
    markup = 0.45;
  } else if (price <= 2200) {
    markup = 0.45;
  } else if (price <= 2500) {
    markup = 0.4;
  } else if (price <= 2700) {
    markup = 0.35;
  } else if (price <= 2900) {
    markup = 0.32;
  } else if (price <= 3000) {
    markup = 0.31;
  } else if (price <= 4000) {
    markup = 0.30;
  } else if (price <= 4200) {
    markup = 0.27;
  } else if (price <= 4300) {
    markup = 0.27;
  } else if (price <= 4400) {
    markup = 0.26;
  } else {
    markup = 0.25;
  }
  
  const urgentPrice = price + Math.floor(price * markup);
  return Math.floor((urgentPrice + 99) / 100) * 100;
}

function calculateDeadline(durationMinutes, isUrgent = false, extraDays = 0) {
  let today = new Date();
  const weekday = today.getDay();
  
  const pythonWeekday = weekday === 0 ? 6 : weekday - 1;
  
  if (pythonWeekday >= 5 && !isUrgent) {
    const daysUntilMonday = 7 - pythonWeekday;
    today.setDate(today.getDate() + daysUntilMonday);
  }
  
  if (isUrgent && durationMinutes <= 30) {
    const finishDate = new Date(today);
    finishDate.setDate(finishDate.getDate() + 1);
    return {
      days: 1,
      date: formatDate(finishDate),
      text: `1 день (до ${formatDate(finishDate)} включительно)`
    };
  }
  
  let daysNeeded;
  if (durationMinutes <= 10) {
    daysNeeded = 1;
  } else if (durationMinutes <= 20) {
    daysNeeded = 2;
  } else if (durationMinutes <= 30) {
    daysNeeded = 3;
  } else {
    daysNeeded = 4;
  }
  
  daysNeeded += extraDays;
  
  let finishDate = new Date(today);
  let addedDays = 0;
  
  while (addedDays < daysNeeded) {
    finishDate.setDate(finishDate.getDate() + 1);
    const day = finishDate.getDay();
    if (day >= 1 && day <= 5) {
      addedDays++;
    }
  }
  
  const deadlineDays = Math.floor((finishDate - today) / (1000 * 60 * 60 * 24));
  
  return {
    days: deadlineDays,
    date: formatDate(finishDate),
    text: `${deadlineDays} ${pluralizeDay(deadlineDays)} (до ${formatDate(finishDate)} включительно)`
  };
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
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

function getOptimalTiming(words) {
  const seconds = words * 0.45;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function calculatePrice(service, value, isUrgent = false) {
  let price = 0;
  let wordCount = 0;
  let charsCount = 0;
  let durationMinutes = 0;
  let deadline = null;
  let optimalTiming = null;
  
  switch (service) {
    case 'voice_text':
      wordCount = parseInt(value);
      price = calculateTextPrice(wordCount);
      durationMinutes = Math.ceil(wordCount / 120);
      deadline = calculateDeadline(durationMinutes, isUrgent);
      optimalTiming = getOptimalTiming(wordCount);
      break;
      
    case 'voice_video':
      durationMinutes = parseInt(value);
      price = calculateVideoPrice(durationMinutes);
      deadline = calculateDeadline(durationMinutes, isUrgent);
      break;
      
    case 'translate_text':
      charsCount = parseInt(value);
      price = calculateTranslateTextPrice(charsCount);
      durationMinutes = charsCount / 120;
      deadline = calculateDeadline(durationMinutes, isUrgent);
      break;
      
    case 'translate_voice':
      durationMinutes = parseInt(value);
      price = calculateTranslateVoicePrice(durationMinutes);
      deadline = calculateDeadline(durationMinutes, isUrgent, 3);
      break;
      
    case 'voice_camera':
      wordCount = parseInt(value);
      price = calculateFacePrice(wordCount);
      durationMinutes = Math.ceil(wordCount / 120);
      deadline = calculateDeadline(durationMinutes, isUrgent);
      optimalTiming = getOptimalTiming(wordCount);
      break;
  }
  
  const priceUrgent = isUrgent ? applyUrgentMarkup(price) : null;
  
  return {
    service,
    wordCount,
    charsCount,
    durationMinutes,
    priceNormal: price,
    priceUrgent: priceUrgent,
    deadline: deadline,
    optimalTiming: optimalTiming,
    isUrgent
  };
}

window.PricingCalculator = {
  calculatePrice,
  countWords,
  countChars
};
