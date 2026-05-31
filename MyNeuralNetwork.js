const fs = require('fs');

class MyNeuralNetwork {
    constructor() {
        // --- АРХИТЕКТУРА И ГИПЕРПАРАМЕТРЫ ---
        this.hiddenSize = 256;      // Количество скрытых нейронов (мощность памяти)
        this.inputSize = 85;        // Размер входного вектора (алфавит)
        this.outputSize = 85;       // Размер выходного вектора
        this.learningRate = 0.002;  // Скорость обучения
        this.maxGradNorm = 5.0;     // Порог для clipping градиентов (защита от NaN)
        
        // --- ФАЙЛЫ ДАННЫХ ---
        this.weightsFile = 'network_weights.json';
        this.memoryFile = 'brain_memory.json';

        // --- МАТРИЦЫ ВЕСОВ И СМЕЩЕНИЙ ---
        this.Wxh = null; // Вход -> Скрытый слой
        this.Whh = null; // Скрытый -> Скрытый слой (рекуррентная связь)
        this.Why = null; // Скрытый -> Выходной слой
        this.bh = null;  // Смещение скрытого слоя
        this.by = null;  // Смещение выходного слоя

        // --- ОПТИМИЗАТОР ADAM (Кэш для моментов) ---
        this.adam = {
            mWxh: null, vWxh: null,
            mWhh: null, vWhh: null,
            mWhy: null, vWhy: null,
            mbh: null, vbh: null,
            mby: null, vby: null,
            t: 1
        };

        // --- СЛОВАРЬ И АЛФАВИТ ---
        this.charToIdx = {};
        this.idxToChar = {};
        this.vocabSize = 0;

        // --- СТАТИСТИКА ---
        this.stats = {
            learned: 0,
            totalCharsProcessed: 0,
            lastLoss: 0,
            lastActivity: Date.now(),
            boredom: 0
        };

        // --- СТАРТ СИСТЕМЫ ---
        this.initAlphabet();
        this.initNetwork();
    }

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ И СЛОВАРЬ
    // ==========================================

    initAlphabet() {
        const alphabet = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz0123456789 .,!?-\"\':;\n";
        const chars = Array.from(alphabet);
        this.vocabSize = Math.min(chars.length, this.inputSize);

        for (let i = 0; i < this.vocabSize; i++) {
            this.charToIdx[chars[i]] = i;
            this.idxToChar[i] = chars[i];
        }
    }

    initNetwork() {
        if (fs.existsSync(this.weightsFile)) {
            this.loadWeights();
        } else {
            this.createNewNetwork();
        }

        if (fs.existsSync(this.memoryFile)) {
            try {
                const mem = JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
                this.stats = { ...this.stats, ...mem.stats };
            } catch (e) {
                console.error("Ошибка чтения статистики, создаем новую");
            }
        }
    }

    createNewNetwork() {
        // Инициализация Ксавье (Xavier) для tanh
        const scaleX = Math.sqrt(1.0 / this.inputSize);
        const scaleH = Math.sqrt(1.0 / this.hiddenSize);
        const scaleY = Math.sqrt(1.0 / this.hiddenSize);

        this.Wxh = this.createRandomMatrix(this.hiddenSize, this.inputSize, scaleX);
        this.Whh = this.createRandomMatrix(this.hiddenSize, this.hiddenSize, scaleH);
        this.Why = this.createRandomMatrix(this.outputSize, this.hiddenSize, scaleY);

        this.bh = new Array(this.hiddenSize).fill(0);
        this.by = new Array(this.outputSize).fill(0);

        this.initAdamCache();
        console.log('✨ Сгенерированы чистые матрицы весов по методу Xavier.');
    }

    initAdamCache() {
        this.adam.mWxh = this.createZeroMatrix(this.hiddenSize, this.inputSize);
        this.adam.vWxh = this.createZeroMatrix(this.hiddenSize, this.inputSize);
        this.adam.mWhh = this.createZeroMatrix(this.hiddenSize, this.hiddenSize);
        this.adam.vWhh = this.createZeroMatrix(this.hiddenSize, this.hiddenSize);
        this.adam.mWhy = this.createZeroMatrix(this.outputSize, this.hiddenSize);
        this.adam.vWhy = this.createZeroMatrix(this.outputSize, this.hiddenSize);
        this.adam.mbh = new Array(this.hiddenSize).fill(0);
        this.adam.vbh = new Array(this.hiddenSize).fill(0);
        this.adam.mby = new Array(this.outputSize).fill(0);
        this.adam.vby = new Array(this.outputSize).fill(0);
    }

    // ==========================================
    // МАТЕМАТИЧЕСКИЕ ХЕЛПЕРЫ
    // ==========================================

    createRandomMatrix(rows, cols, scale) {
        const matrix = new Array(rows);
        for (let i = 0; i < rows; i++) {
            matrix[i] = new Array(cols);
            for (let j = 0; j < cols; j++) {
                // Нормальное распределение через Бокса-Мюллера
                let u = 0, v = 0;
                while(u === 0) u = Math.random();
                while(v === 0) v = Math.random();
                let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                matrix[i][j] = num * scale;
            }
        }
        return matrix;
    }

    createZeroMatrix(rows, cols) {
        const matrix = new Array(rows);
        for (let i = 0; i < rows; i++) {
            matrix[i] = new Array(cols).fill(0);
        }
        return matrix;
    }

    softmax(arr) {
        let max = arr[0];
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > max) max = arr[i];
        }
        const exps = new Array(arr.length);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            exps[i] = Math.exp(arr[i] - max);
            sum += exps[i];
        }
        for (let i = 0; i < arr.length; i++) {
            exps[i] /= sum;
        }
        return exps;
    }

    // ==========================================
    // ЯДРО СЕТИ: СУПЕР-АЛГОРИТМ BPTT И ОБУЧЕНИЕ
    // ==========================================

    learn(text, epochs = 25) {
        if (!text || text.length < 2) return;
        
        // Препроцессинг текста
        const cleanText = text.toLowerCase();
        const inputs = [];
        for (let char of cleanText) {
            if (this.charToIdx[char] !== undefined) {
                inputs.push(this.charToIdx[char]);
            } else {
                inputs.push(this.charToIdx[' ']); // Замена неизвестных на пробел
            }
        }

        if (inputs.length < 2) return;

        let totalLoss = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            // Списки состояний для шагов по времени (Backpropagation Through Time)
            const xs = {};
            const hs = {};
            const ys = {};
            const ps = {};
            
            // Начальное скрытое состояние пустое
            hs[-1] = new Array(this.hiddenSize).fill(0);

            // 1. FORWARD PASS (Прямой ход по всей цепочке текста)
            for (let t = 0; t < inputs.length - 1; t++) {
                // One-hot кодирование входа
                xs[t] = new Array(this.inputSize).fill(0);
                xs[t][inputs[t]] = 1;

                // Расчет скрытого слоя: h[t] = tanh(Wxh * x + Whh * h[t-1] + bh)
                hs[t] = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    let sum = 0;
                    // Входные связи
                    sum += this.Wxh[i][inputs[t]]; // Эквивалентно матричному умножению на One-Hot vector
                    // Рекуррентные связи
                    for (let j = 0; j < this.hiddenSize; j++) {
                        sum += this.Whh[i][j] * hs[t - 1][j];
                    }
                    sum += this.bh[i];
                    hs[t][i] = Math.tanh(sum);
                }

                // Расчет выходов: y[t] = Why * h[t] + by
                ys[t] = new Array(this.outputSize);
                for (let i = 0; i < this.outputSize; i++) {
                    let sum = 0;
                    for (let j = 0; j < this.hiddenSize; j++) {
                        sum += this.Why[i][j] * hs[t][j];
                    }
                    sum += this.by[i];
                    ys[t][i] = sum;
                }

                // Вероятности через Softmax
                ps[t] = this.softmax(ys[t]);

                // Считаем кросс-энтропийную потерю (Loss)
                const targetIdx = inputs[t + 1];
                totalLoss -= Math.log(Math.max(ps[t][targetIdx], 1e-15));
            }

            // 2. BACKPROPAGATION THROUGH TIME (Обратный проход градиента)
            // Инициализация нулевых матриц градиентов
            const dWxh = this.createZeroMatrix(this.hiddenSize, this.inputSize);
            const dWhh = this.createZeroMatrix(this.hiddenSize, this.hiddenSize);
            const dWhy = this.createZeroMatrix(this.outputSize, this.hiddenSize);
            const dbh = new Array(this.hiddenSize).fill(0);
            const dby = new Array(this.outputSize).fill(0);
            const dhNext = new Array(this.hiddenSize).fill(0);

            // Идем от конца цепочки к началу
            for (let t = inputs.length - 2; t >= 0; t--) {
                const targetIdx = inputs[t + 1];
                const dy = [...ps[t]];
                dy[targetIdx] -= 1; // Производная кросс-энтропии софтмакса

                // Градиенты для выходного слоя
                for (let i = 0; i < this.outputSize; i++) {
                    dby[i] += dy[i];
                    for (let j = 0; j < this.hiddenSize; j++) {
                        dWhy[i][j] += dy[i] * hs[t][j];
                    }
                }

                // Градиент скрытого состояния dh
                const dh = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    let sum = 0;
                    for (let j = 0; j < this.outputSize; j++) {
                        sum += this.Why[j][i] * dy[j];
                    }
                    sum += dhNext[i];
                    dh[i] = sum;
                }

                // Проход через функцию активации tanh (производная: 1 - tanh^2)
                const dhRaw = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    dhRaw[i] = (1 - hs[t][i] * hs[t][i]) * dh[i];
                }

                // Градиенты для рекуррентных и входных весов
                for (let i = 0; i < this.hiddenSize; i++) {
                    dbh[i] += dhRaw[i];
                    dWxh[i][inputs[t]] += dhRaw[i];
                    for (let j = 0; j < this.hiddenSize; j++) {
                        dWhh[i][j] += dhRaw[i] * hs[t - 1][j];
                    }
                }

                // Сохраняем dh для следующего шага назад (t-1)
                for (let i = 0; i < this.hiddenSize; i++) {
                    let sum = 0;
                    for (let j = 0; j < this.hiddenSize; j++) {
                        sum += this.Whh[j][i] * dhRaw[j];
                    }
                    dhNext[i] = sum;
                }
            }

            // 3. GRADIENT CLIPPING (Защита от взрыва градиентов)
            this.clipGradients(dWxh, dWhh, dWhy, dbh, dby);

            // 4. МЕТОД ОПТИМИЗАЦИИ ADAM (Обновление весов)
            this.updateAdam(dWxh, dWhh, dWhy, dbh, dby);
        }

        // Логгирование и статистика
        this.stats.learned++;
        this.stats.totalCharsProcessed += text.length;
        this.stats.lastLoss = totalLoss / (inputs.length - 1);
        
        this.save();
        console.log(`📊 Сеть обновила связи. Шаг: ${this.stats.learned}, Текущая ошибка (Loss): ${this.stats.lastLoss.toFixed(4)}`);
    }

    clipGradients(dWxh, dWhh, dWhy, dbh, dby) {
        let sumSq = 0;
        
        // Считаем общую L2 норму градиентов
        for(let i=0; i<dWxh.length; i++) for(let j=0; j<dWxh[i].length; j++) sumSq += dWxh[i][j]*dWxh[i][j];
        for(let i=0; i<dWhh.length; i++) for(let j=0; j<dWhh[i].length; j++) sumSq += dWhh[i][j]*dWhh[i][j];
        for(let i=0; i<dWhy.length; i++) for(let j=0; j<dWhy[i].length; j++) sumSq += dWhy[i][j]*dWhy[i][j];
        for(let i=0; i<dbh.length; i++) sumSq += dbh[i]*dbh[i];
        for(let i=0; i<dby.length; i++) sumSq += dby[i]*dby[i];

        let norm = Math.sqrt(sumSq);
        if (norm > this.maxGradNorm) {
            let scale = this.maxGradNorm / norm;
            for(let i=0; i<dWxh.length; i++) for(let j=0; j<dWxh[i].length; j++) dWxh[i][j] *= scale;
            for(let i=0; i<dWhh.length; i++) for(let j=0; j<dWhh[i].length; j++) dWhh[i][j] *= scale;
            for(let i=0; i<dWhy.length; i++) for(let j=0; j<dWhy[i].length; j++) dWhy[i][j] *= scale;
            for(let i=0; i<dbh.length; i++) dbh[i] *= scale;
            for(let i=0; i<dby.length; i++) dby[i] *= scale;
        }
    }

    updateAdam(dWxh, dWhh, dWhy, dbh, dby) {
        const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
        const t = this.adam.t;

        // Поправка смещения для Adam
        const biasCorrection1 = 1 - Math.pow(beta1, t);
        const biasCorrection2 = 1 - Math.pow(beta2, t);
        const lrStep = this.learningRate * Math.sqrt(biasCorrection2) / biasCorrection1;

        // Шаг для матрицы Wxh
        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.inputSize; j++) {
                this.adam.mWxh[i][j] = beta1 * this.adam.mWxh[i][j] + (1 - beta1) * dWxh[i][j];
                this.adam.vWxh[i][j] = beta2 * this.adam.vWxh[i][j] + (1 - beta2) * dWxh[i][j] * dWxh[i][j];
                this.Wxh[i][j] -= lrStep * this.adam.mWxh[i][j] / (Math.sqrt(this.adam.vWxh[i][j]) + eps);
            }
        }

        // Шаг для матрицы Whh
        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.adam.mWhh[i][j] = beta1 * this.adam.mWhh[i][j] + (1 - beta1) * dWhh[i][j];
                this.adam.vWhh[i][j] = beta2 * this.adam.vWhh[i][j] + (1 - beta2) * dWhh[i][j] * dWhh[i][j];
                this.Whh[i][j] -= lrStep * this.adam.mWhh[i][j] / (Math.sqrt(this.adam.vWhh[i][j]) + eps);
            }
        }

        // Шаг для матрицы Why
        for (let i = 0; i < this.outputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.adam.mWhy[i][j] = beta1 * this.adam.mWhy[i][j] + (1 - beta1) * dWhy[i][j];
                this.adam.vWhy[i][j] = beta2 * this.adam.vWhy[i][j] + (1 - beta2) * dWhy[i][j] * dWhy[i][j];
                this.Why[i][j] -= lrStep * this.adam.mWhy[i][j] / (Math.sqrt(this.adam.vWhy[i][j]) + eps);
            }
        }

        // Смещения bh и by
        for (let i = 0; i < this.hiddenSize; i++) {
            this.adam.mbh[i] = beta1 * this.adam.mbh[i] + (1 - beta1) * dbh[i];
            this.adam.vbh[i] = beta2 * this.adam.vbh[i] + (1 - beta2) * dbh[i] * dbh[i];
            this.bh[i] -= lrStep * this.adam.mbh[i] / (Math.sqrt(this.adam.vbh[i]) + eps);
        }

        for (let i = 0; i < this.outputSize; i++) {
            this.adam.mby[i] = beta1 * this.adam.mby[i] + (1 - beta1) * dby[i];
            this.adam.vby[i] = beta2 * this.adam.vby[i] + (1 - beta2) * dby[i] * dby[i];
            this.by[i] -= lrStep * this.adam.mby[i] / (Math.sqrt(this.adam.vby[i]) + eps);
        }

        this.adam.t++;
    }

    // ==========================================
    // АВТОНОМНАЯ ГЕНЕРАЦИЯ (САМ ДУМАЕТ БЕЗ ПРОМПТОВ)
    // ==========================================

    generate(length = 80) {
        let h = new Array(this.hiddenSize).fill(0);
        
        // Начинаем со случайного символа нашего алфавита
        let currentIdx = Math.floor(Math.random() * this.vocabSize);
        let result = "";
        
        // Температура генерации (0.5 - жесткая структура, 0.9 - креативный хаос)
        const temperature = 0.55; 

        for (let t = 0; t < length; t++) {
            // Расчет следующего скрытого шага h = tanh(Wxh * x + Whh * h_prev + bh)
            const nextH = new Array(this.hiddenSize);
            for (let i = 0; i < this.hiddenSize; i++) {
                let sum = this.Wxh[i][currentIdx] + this.bh[i];
                for (let j = 0; j < this.hiddenSize; j++) {
                    sum += this.Whh[i][j] * h[j];
                }
                nextH[i] = Math.tanh(sum);
            }
            h = nextH;

            // Расчет сырых вероятностей y = Why * h + by
            const y = new Array(this.outputSize);
            for (let i = 0; i < this.outputSize; i++) {
                let sum = this.by[i];
                for (let j = 0; j < this.hiddenSize; j++) {
                    sum += this.Why[i][j] * h[j];
                }
                y[i] = sum;
            }

            // Применяем температурное масштабирование к распределению Softmax
            const softProbs = this.getTemperatureSoftmax(y, temperature);

            // Случайный выбор символа на основе полученных вероятностей
            currentIdx = this.sampleFromDistribution(softProbs);
            
            // Склеиваем результат
            result += (this.idxToChar[currentIdx] || ' ');
        }

        return this.postProcessText(result);
    }

    getTemperatureSoftmax(y, temp) {
        const scaled = y.map(val => val / temp);
        let max = Math.max(...scaled);
        const exps = scaled.map(val => Math.exp(val - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(e => e / sum);
    }

    sampleFromDistribution(probs) {
        let r = Math.random();
        let cumulative = 0;
        for (let i = 0; i < probs.length; i++) {
            cumulative += probs[i];
            if (r <= cumulative) return i;
        }
        return probs.length - 1;
    }

    postProcessText(text) {
        // Приведение текста в опрятный человеческий вид
        let out = text.trim();
        if (out.length > 0) {
            out = out.charAt(0).toUpperCase() + out.slice(1);
        }
        return out;
    }

    // ==========================================
    // ИНТЕРФЕЙС СОВМЕСТИМОСТИ И ДИСКОВАЯ ПАМЯТЬ
    // ==========================================

    shouldWrite() {
        const now = Date.now();
        const timeSinceLastMsg = (now - this.stats.lastActivity) / 1000;
        this.stats.boredom += timeSinceLastMsg / 3600;
        this.saveStats();
        return this.stats.boredom > 3 && this.stats.learned > 15;
    }

    resetBoredom() {
        this.stats.boredom = 0;
        this.stats.lastActivity = Date.now();
        this.saveStats();
    }

    save() {
        const weights = {
            Wxh: this.Wxh,
            Whh: this.Whh,
            Why: this.Why,
            bh: this.bh,
            by: this.by,
            adamT: this.adam.t
        };
        fs.writeFileSync(this.weightsFile, JSON.stringify(weights));
        this.saveStats();
    }

    saveStats() {
        fs.writeFileSync(this.memoryFile, JSON.stringify({ stats: this.stats }, null, 2));
    }

    loadWeights() {
        try {
            const weights = JSON.parse(fs.readFileSync(this.weightsFile, 'utf8'));
            this.Wxh = weights.Wxh;
            this.Whh = weights.Whh;
            this.Why = weights.Why;
            this.bh = weights.bh;
            this.by = weights.by;
            this.adam.t = weights.adamT || 1;
            this.initAdamCache(); 
            console.log('🧠 Успешно загружена глубокая физическая память весов.');
        } catch (e) {
            console.error("Ошибка парсинга весов, пересоздаем структуру.");
            this.createNewNetwork();
        }
    }

    async readUrl(url) {
        // Заглушка парсера для автономии (чтобы не тянуть тяжелые библиотеки внутрь класса)
        try {
            const axios = require('axios');
            const res = await axios.get(url, { timeout: 4000 });
            const clean = res.data.toString().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 800);
            this.learn(clean, 30);
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new MyNeuralNetwork();
                  
