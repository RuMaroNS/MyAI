const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

class MyNeuralNetwork {
  constructor() {
    // Параметры сети (уменьшил для скорости)
    this.hiddenSize = 100;   // нейронов в скрытом слое
    this.inputSize = 80;     // размер входного вектора
    this.outputSize = 80;    // размер выходного
    
    // Веса нейросети
    this.Wxh = null;  // вход → скрытый
    this.Whh = null;  // скрытый → скрытый (рекуррентность)
    this.Why = null;  // скрытый → выход
    
    // Словарь символов
    this.charToIdx = {};
    this.idxToChar = {};
    this.vocabSize = 0;
    
    // Состояние сети (память)
    this.h = null;
    
    // Метаданные для совместимости с твоим brain.js
    this.memoryFile = 'brain_memory.json';
    this.stats = { learned: 0, lastActivity: Date.now(), boredom: 0 };
    
    this.init();
  }
  
    init() {
    // 1. Сначала загружаем или создаем веса
    if (fs.existsSync('network_weights.json')) {
      const saved = JSON.parse(fs.readFileSync('network_weights.json', 'utf8'));
      this.Wxh = saved.Wxh;
      this.Whh = saved.Whh;
      this.Why = saved.Why;
      this.charToIdx = saved.charToIdx;
      this.idxToChar = saved.idxToChar;
      this.vocabSize = saved.vocabSize;
      console.log('🧠 Нейросеть загружена');
    } else {
      this.Wxh = this.randomMatrix(this.hiddenSize, this.inputSize);
      this.Whh = this.randomMatrix(this.hiddenSize, this.hiddenSize);
      this.Why = this.randomMatrix(this.outputSize, this.hiddenSize);
      console.log('✨ Создана новая нейросеть');
    }

    // 2. ВАЖНО: Добавляем алфавит сюда, внутри init!
    const alphabet = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz0123456789 .,!?";
    for(let char of alphabet) {
        if(this.charToIdx[char] === undefined) {
            let idx = Object.keys(this.charToIdx).length;
            if(idx < this.inputSize) {
                this.charToIdx[char] = idx;
                this.idxToChar[idx] = char;
            }
        }
    }
    this.vocabSize = Object.keys(this.charToIdx).length;
    
    // Загружаем статистику
    if (fs.existsSync(this.memoryFile)) {
      const mem = JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
      this.stats = mem.stats || this.stats;
    }
    
    this.resetState();
  }

  
  randomMatrix(rows, cols) {
    const m = [];
    for (let i = 0; i < rows; i++) {
      m[i] = [];
      for (let j = 0; j < cols; j++) {
        m[i][j] = (Math.random() - 0.5) * 0.01;
      }
    }
    return m;
  }
  
  resetState() {
    this.h = new Array(this.hiddenSize).fill(0);
  }
  
  sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  
  matVecMul(mat, vec) {
    const res = new Array(mat.length).fill(0);
    for (let i = 0; i < mat.length; i++) {
      for (let j = 0; j < vec.length; j++) {
        res[i] += mat[i][j] * vec[j];
      }
    }
    return res;
  }
  
  forward(inputIdx) {
    // One-hot вектор
    const x = new Array(this.inputSize).fill(0);
    if (inputIdx < this.inputSize) x[inputIdx] = 1;
    
    // Скрытый слой
    const h1 = this.matVecMul(this.Wxh, x);
    const h2 = this.matVecMul(this.Whh, this.h);
    for (let i = 0; i < this.hiddenSize; i++) {
      this.h[i] = this.sigmoid((h1[i] + h2[i]) * 0.5);
    }
    
    // Выходной слой (softmax)
    const yRaw = this.matVecMul(this.Why, this.h);
    let maxVal = Math.max(...yRaw);
    let expSum = 0;
    const y = new Array(this.outputSize);
    for (let i = 0; i < this.outputSize; i++) {
      y[i] = Math.exp((yRaw[i] - maxVal) * 0.5);
      expSum += y[i];
    }
    for (let i = 0; i < this.outputSize; i++) y[i] /= expSum;
    
    return y;
  }
  
  // ОБУЧЕНИЕ (главное!)
  learn(text, epochs = 1) {
    if (!text || text.length < 5) return;
    
    // Строим словарь если пустой
    if (this.vocabSize === 0) {
      this.buildVocab(text);
    }
    
    // Кодируем текст
    const indices = [];
    for (let ch of text.slice(0, 500)) { // лимит 500 символов за раз
      const idx = this.charToIdx[ch];
      if (idx !== undefined) indices.push(idx);
    }
    
    if (indices.length < 5) return;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      this.resetState();
      
      for (let pos = 0; pos < indices.length - 1; pos++) {
        const inputIdx = indices[pos] % this.inputSize;
        const targetIdx = indices[pos + 1] % this.outputSize;
        
        const probs = this.forward(inputIdx);
        
        // Ошибка
        let error = probs[targetIdx];
        for (let i = 0; i < this.outputSize; i++) {
          let err = probs[i];
          if (i === targetIdx) err -= 1;
          
          // Обновляем Why
          for (let j = 0; j < this.hiddenSize; j++) {
            this.Why[i][j] -= 0.05 * err * this.h[j];
          }
        }
        
        // Обновляем скрытые веса (упрощённо)
        for (let i = 0; i < this.hiddenSize; i++) {
          for (let j = 0; j < this.hiddenSize; j++) {
            this.Whh[i][j] -= 0.005 * this.h[i] * this.h[j];
          }
        }
      }
    }
    
    // Обновляем статистику
    this.stats.learned++;
    this.save();
    
    console.log(`📚 Выучено символов: ${this.stats.learned}`);
  }
  
  buildVocab(text) {
    const chars = new Set();
    for (let ch of text) chars.add(ch);
    this.vocabSize = Math.min(chars.size, this.inputSize);
    const charList = Array.from(chars).slice(0, this.vocabSize);
    for (let i = 0; i < charList.length; i++) {
      this.charToIdx[charList[i]] = i;
      this.idxToChar[i] = charList[i];
    }
    console.log(`📖 Словарь: ${this.vocabSize} символов`);
  }
  
  
  // ГЕНЕРАЦИЯ ТЕКСТА (как ребёнок)
  generate(prompt = '', length = 50) {
    if (this.vocabSize === 0) {
      return "Я ещё глупенький, поучи меня... 🍼";
    }
    
    this.resetState();
    
    // Прогоняем промпт через сеть
    for (let ch of prompt) {
      const idx = this.charToIdx[ch];
      if (idx !== undefined) this.forward(idx % this.inputSize);
    }
    
    let result = prompt || "";
    let current = result;
    
    for (let i = 0; i < length; i++) {
      const lastChar = current[current.length - 1] || ' ';
      let lastIdx = this.charToIdx[lastChar];
      if (lastIdx === undefined) lastIdx = 0;
      
      const probs = this.forward(lastIdx % this.inputSize);
      
      // Выбираем символ с учётом температуры
      let sum = 0;
      let rand = Math.random();
      let nextIdx = 0;
      for (let j = 0; j < probs.length; j++) {
        sum += probs[j];
        if (rand <= sum) {
          nextIdx = j;
          break;
        }
      }
      
      const nextChar = this.idxToChar[nextIdx] || '?';
      result += nextChar;
      current = current.slice(1) + nextChar;
    }
    
    // Делаем ответ более "детским"
    if (Math.random() < 0.3) {
      const kidWords = [' 😊', ' 🐶', ' 🌟', ' ага!', ' ух ты!', ' ой!'];
      result += kidWords[Math.floor(Math.random() * kidWords.length)];
    }
    
    return result.slice(0, 200);
  }
  
  // Совместимость с твоим brain.js
  shouldWrite() {
    const now = Date.now();
    const timeSinceLastMsg = (now - this.stats.lastActivity) / 1000;
    this.stats.boredom += timeSinceLastMsg / 3600;
    this.saveStats();
    return this.stats.boredom > 5 && this.stats.learned > 20;
  }
  
  resetBoredom() {
    this.stats.boredom = 0;
    this.stats.lastActivity = Date.now();
    this.saveStats();
  }
  
  save() {
    const data = {
      Wxh: this.Wxh,
      Whh: this.Whh,
      Why: this.Why,
      charToIdx: this.charToIdx,
      idxToChar: this.idxToChar,
      vocabSize: this.vocabSize
    };
    fs.writeFileSync('network_weights.json', JSON.stringify(data, null, 2));
    this.saveStats();
  }
  
  saveStats() {
    fs.writeFileSync(this.memoryFile, JSON.stringify({ stats: this.stats }, null, 2));
  }
  
  // Чтение ссылок и обучение на них
  async readUrl(url) {
    try {
      const { data } = await axios.get(url, { timeout: 5000 });
      const $ = cheerio.load(data);
      $('script, style, nav, footer, header').remove();
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      text = text.slice(0, 1000);
      this.learn(text, 2);
      return true;
    } catch(e) {
      return false;
    }
  }
}

module.exports = new MyNeuralNetwork();
