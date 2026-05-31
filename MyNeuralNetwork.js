const fs = require('fs');
const axios = require('axios');

class MyNeuralNetwork {
    constructor() {
        // --- АРХИТЕКТУРА ---
        this.hiddenSize = 256;
        this.inputSize = 85;
        this.outputSize = 85;
        this.learningRate = 0.002;
        this.maxGradNorm = 5.0;
        
        // --- ФАЙЛЫ ---
        this.weightsFile = 'network_weights.json';
        this.memoryFile = 'brain_memory.json';
        this.knowledgeFile = 'knowledge_base.json';
        this.urlsFile = 'urls_to_read.json';

        // --- МАТРИЦЫ ---
        this.Wxh = null;
        this.Whh = null;
        this.Why = null;
        this.bh = null;
        this.by = null;

        // --- ADAM ---
        this.adam = {
            mWxh: null, vWxh: null,
            mWhh: null, vWhh: null,
            mWhy: null, vWhy: null,
            mbh: null, vbh: null,
            mby: null, vby: null,
            t: 1
        };

        // --- АЛФАВИТ ---
        this.charToIdx = {};
        this.idxToChar = {};
        this.vocabSize = 0;

        // --- БАЗА ЗНАНИЙ ---
        this.knowledgeBase = {};

        // --- СТАТИСТИКА ---
        this.stats = {
            learned: 0,
            totalCharsProcessed: 0,
            lastLoss: 0,
            lastActivity: Date.now(),
            boredom: 0,
            autoLearn: true
        };

        this.urlsQueue = [];
        
        this.initAlphabet();
        this.initNetwork();
        this.loadKnowledgeBase();
        this.loadUrlsQueue();
        this.startAutoLearning();
    }

    // ==========================================
    // АЛФАВИТ
    // ==========================================

    initAlphabet() {
        const alphabet = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz0123456789 .,!?-";
        const chars = Array.from(new Set(alphabet.split('')));
        this.vocabSize = Math.min(chars.length, this.inputSize);

        for (let i = 0; i < this.vocabSize; i++) {
            this.charToIdx[chars[i]] = i;
            this.idxToChar[i] = chars[i];
        }
        
        console.log(`📚 Алфавит: ${this.vocabSize} символов`);
    }

    // ==========================================
    // АВТОНОМНОЕ ОБУЧЕНИЕ
    // ==========================================

    loadUrlsQueue() {
        if (fs.existsSync(this.urlsFile)) {
            try {
                this.urlsQueue = JSON.parse(fs.readFileSync(this.urlsFile, 'utf8'));
            } catch(e) { 
                this.urlsQueue = []; 
            }
        } else {
            this.initDefaultUrls();
        }
    }

    initDefaultUrls() {
        this.urlsQueue = [
            'https://ru.wikipedia.org/wiki/Искусственный_интеллект',
            'https://ru.wikipedia.org/wiki/Нейронная_сеть',
            'https://ru.wikipedia.org/wiki/Машинное_обучение',
            'https://ria.ru/',
            'https://lenta.ru/rss/news',
            'https://habr.com/ru/all/',
            'https://tass.ru/',
            'https://www.vesti.ru/'
        ];
        this.saveUrlsQueue();
    }

    saveUrlsQueue() {
        fs.writeFileSync(this.urlsFile, JSON.stringify(this.urlsQueue, null, 2));
    }

    startAutoLearning() {
        console.log('🤖 ЗАПУЩЕНО АВТОНОМНОЕ ОБУЧЕНИЕ...');
        
        setInterval(async () => {
            if (this.stats.autoLearn && this.urlsQueue.length > 0) {
                await this.autoReadNextUrl();
            }
        }, 30 * 60 * 1000);
    }

    async autoReadNextUrl() {
        if (this.urlsQueue.length === 0) return;
        
        const url = this.urlsQueue.shift();
        this.saveUrlsQueue();
        
        console.log(`🌐 АВТОЧТЕНИЕ: ${url}`);
        const success = await this.readUrl(url);
        
        if (success) {
            console.log('✅ Автообучение успешно');
            await this.extractUrlsFromText();
        }
    }

    async extractUrlsFromText() {
        const allText = Object.keys(this.knowledgeBase).join(' ');
        const urlPattern = /https?:\/\/[^\s<>"']+/g;
        const foundUrls = allText.match(urlPattern) || [];
        
        let newUrls = 0;
        for (let url of foundUrls) {
            if (!this.urlsQueue.includes(url)) {
                this.urlsQueue.push(url);
                newUrls++;
            }
        }
        
        if (newUrls > 0) {
            console.log(`🔗 Найдено ${newUrls} новых ссылок`);
            this.saveUrlsQueue();
        }
    }

    // ==========================================
    // СТАТИСТИКА
    // ==========================================

    getStats() {
        return {
            learned: this.stats.learned,
            totalCharsProcessed: this.stats.totalCharsProcessed,
            lastLoss: this.stats.lastLoss,
            thinkingMode: this.stats.thinkingMode,
            lastActivity: this.stats.lastActivity,
            knowledgeSize: Object.keys(this.knowledgeBase).length
        };
    }

    // ==========================================
    // СБРОС ПАМЯТИ
    // ==========================================

    resetMemory() {
        console.log("🧹 ПОЛНАЯ ОЧИСТКА ПАМЯТИ...");
        
        const files = [this.weightsFile, this.memoryFile, this.knowledgeFile, this.urlsFile];
        for (let file of files) {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        
        this.stats = {
            learned: 0,
            totalCharsProcessed: 0,
            lastLoss: 0,
            lastActivity: Date.now(),
            boredom: 0,
            autoLearn: true
        };
        
        this.knowledgeBase = {};
        this.createNewNetwork();
        this.initDefaultUrls();
        
        return "🧠 Память очищена! Начинаю автономное обучение.";
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
                console.error("Ошибка чтения статистики");
            }
        }
    }

    createNewNetwork() {
        const scaleX = Math.sqrt(1.0 / this.inputSize);
        const scaleH = Math.sqrt(1.0 / this.hiddenSize);
        const scaleY = Math.sqrt(1.0 / this.hiddenSize);

        this.Wxh = this.createRandomMatrix(this.hiddenSize, this.inputSize, scaleX);
        this.Whh = this.createRandomMatrix(this.hiddenSize, this.hiddenSize, scaleH);
        this.Why = this.createRandomMatrix(this.outputSize, this.hiddenSize, scaleY);
        this.bh = new Array(this.hiddenSize).fill(0);
        this.by = new Array(this.outputSize).fill(0);

        this.initAdamCache();
        console.log('✨ Нейросеть инициализирована');
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
    // БАЗА ЗНАНИЙ
    // ==========================================

    loadKnowledgeBase() {
        if (fs.existsSync(this.knowledgeFile)) {
            try {
                this.knowledgeBase = JSON.parse(fs.readFileSync(this.knowledgeFile, 'utf8'));
                console.log(`📚 Загружена база знаний: ${Object.keys(this.knowledgeBase).length} фраз`);
            } catch (e) {
                this.knowledgeBase = {};
            }
        }
    }

    saveKnowledgeBase() {
        const entries = Object.entries(this.knowledgeBase);
        if (entries.length > 1000) {
            entries.sort((a, b) => b[1].count - a[1].count);
            this.knowledgeBase = Object.fromEntries(entries.slice(0, 1000));
        }
        fs.writeFileSync(this.knowledgeFile, JSON.stringify(this.knowledgeBase, null, 2));
    }

    learnFromText(text, source = "user") {
        if (!text || text.length < 5) return false;
        
        const cleanText = text.toLowerCase().replace(/[^\w\s.,!?\-]/g, ' ').substring(0, 500);
        
        const words = cleanText.split(/\s+/);
        for (let i = 0; i < words.length - 2; i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            if (!this.knowledgeBase[phrase]) {
                this.knowledgeBase[phrase] = { count: 0, next: {} };
            }
            this.knowledgeBase[phrase].count++;
            const nextWord = words[i + 3] || '';
            if (nextWord) {
                this.knowledgeBase[phrase].next[nextWord] = (this.knowledgeBase[phrase].next[nextWord] || 0) + 1;
            }
        }
        
        this.learn(cleanText, 15);
        this.saveKnowledgeBase();
        
        console.log(`📖 Выучено: ${text.length} символов от ${source}`);
        return true;
    }

    // ==========================================
    // ОСНОВНОЕ ОБУЧЕНИЕ
    // ==========================================

    learn(text, epochs = 15) {
        if (!text || text.length < 2) return;
        
        const cleanText = text.toLowerCase();
        const inputs = [];
        
        for (let char of cleanText) {
            if (this.charToIdx[char] !== undefined) {
                inputs.push(this.charToIdx[char]);
            } else if (this.charToIdx[' '] !== undefined) {
                inputs.push(this.charToIdx[' ']);
            }
        }

        if (inputs.length < 2) return;

        let totalLoss = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            const xs = {};
            const hs = {};
            const ys = {};
            const ps = {};
            
            hs[-1] = new Array(this.hiddenSize).fill(0);

            for (let t = 0; t < inputs.length - 1; t++) {
                xs[t] = new Array(this.inputSize).fill(0);
                xs[t][inputs[t]] = 1;

                hs[t] = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    let sum = this.Wxh[i][inputs[t]] + this.bh[i];
                    for (let j = 0; j < this.hiddenSize; j++) {
                        sum += this.Whh[i][j] * hs[t - 1][j];
                    }
                    hs[t][i] = Math.tanh(sum);
                }

                ys[t] = new Array(this.outputSize);
                for (let i = 0; i < this.outputSize; i++) {
                    let sum = this.by[i];
                    for (let j = 0; j < this.hiddenSize; j++) {
                        sum += this.Why[i][j] * hs[t][j];
                    }
                    ys[t][i] = sum;
                }

                ps[t] = this.softmax(ys[t]);
                const targetIdx = inputs[t + 1];
                totalLoss -= Math.log(Math.max(ps[t][targetIdx], 1e-15));
            }

            const dWxh = this.createZeroMatrix(this.hiddenSize, this.inputSize);
            const dWhh = this.createZeroMatrix(this.hiddenSize, this.hiddenSize);
            const dWhy = this.createZeroMatrix(this.outputSize, this.hiddenSize);
            const dbh = new Array(this.hiddenSize).fill(0);
            const dby = new Array(this.outputSize).fill(0);
            let dhNext = new Array(this.hiddenSize).fill(0);

            for (let t = inputs.length - 2; t >= 0; t--) {
                const targetIdx = inputs[t + 1];
                const dy = [...ps[t]];
                dy[targetIdx] -= 1;

                for (let i = 0; i < this.outputSize; i++) {
                    dby[i] += dy[i];
                    for (let j = 0; j < this.hiddenSize; j++) {
                        dWhy[i][j] += dy[i] * hs[t][j];
                    }
                }

                const dh = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    let sum = 0;
                    for (let j = 0; j < this.outputSize; j++) {
                        sum += this.Why[j][i] * dy[j];
                    }
                    sum += dhNext[i];
                    dh[i] = sum;
                }

                const dhRaw = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    dhRaw[i] = (1 - hs[t][i] * hs[t][i]) * dh[i];
                }

                for (let i = 0; i < this.hiddenSize; i++) {
                    dbh[i] += dhRaw[i];
                    dWxh[i][inputs[t]] += dhRaw[i];
                    for (let j = 0; j < this.hiddenSize; j++) {
                        dWhh[i][j] += dhRaw[i] * hs[t - 1][j];
                    }
                }

                dhNext = new Array(this.hiddenSize);
                for (let i = 0; i < this.hiddenSize; i++) {
                    let sum = 0;
                    for (let j = 0; j < this.hiddenSize; j++) {
                        sum += this.Whh[j][i] * dhRaw[j];
                    }
                    dhNext[i] = sum;
                }
            }

            this.clipGradients(dWxh, dWhh, dWhy, dbh, dby);
            this.updateAdam(dWxh, dWhh, dWhy, dbh, dby);
        }

        this.stats.learned++;
        this.stats.totalCharsProcessed += text.length;
        this.stats.lastLoss = totalLoss / (inputs.length - 1);
        
        this.save();
        console.log(`📊 Обучение: шаг ${this.stats.learned}, loss: ${this.stats.lastLoss.toFixed(4)}`);
    }

    // ==========================================
    // МАТЕМАТИЧЕСКИЕ МЕТОДЫ
    // ==========================================

    createRandomMatrix(rows, cols, scale) {
        const matrix = new Array(rows);
        for (let i = 0; i < rows; i++) {
            matrix[i] = new Array(cols);
            for (let j = 0; j < cols; j++) {
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

    clipGradients(dWxh, dWhh, dWhy, dbh, dby) {
        let sumSq = 0;
        
        for(let i=0; i<dWxh.length; i++) 
            for(let j=0; j<dWxh[i].length; j++) 
                sumSq += dWxh[i][j]*dWxh[i][j];
        for(let i=0; i<dWhh.length; i++) 
            for(let j=0; j<dWhh[i].length; j++) 
                sumSq += dWhh[i][j]*dWhh[i][j];
        for(let i=0; i<dWhy.length; i++) 
            for(let j=0; j<dWhy[i].length; j++) 
                sumSq += dWhy[i][j]*dWhy[i][j];
        for(let i=0; i<dbh.length; i++) 
            sumSq += dbh[i]*dbh[i];
        for(let i=0; i<dby.length; i++) 
            sumSq += dby[i]*dby[i];

        let norm = Math.sqrt(sumSq);
        if (norm > this.maxGradNorm) {
            let scale = this.maxGradNorm / norm;
            for(let i=0; i<dWxh.length; i++) 
                for(let j=0; j<dWxh[i].length; j++) 
                    dWxh[i][j] *= scale;
            for(let i=0; i<dWhh.length; i++) 
                for(let j=0; j<dWhh[i].length; j++) 
                    dWhh[i][j] *= scale;
            for(let i=0; i<dWhy.length; i++) 
                for(let j=0; j<dWhy[i].length; j++) 
                    dWhy[i][j] *= scale;
            for(let i=0; i<dbh.length; i++) 
                dbh[i] *= scale;
            for(let i=0; i<dby.length; i++) 
                dby[i] *= scale;
        }
    }

    updateAdam(dWxh, dWhh, dWhy, dbh, dby) {
        const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
        const t = this.adam.t;

        const biasCorrection1 = 1 - Math.pow(beta1, t);
        const biasCorrection2 = 1 - Math.pow(beta2, t);
        const lrStep = this.learningRate * Math.sqrt(biasCorrection2) / biasCorrection1;

        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.inputSize; j++) {
                this.adam.mWxh[i][j] = beta1 * this.adam.mWxh[i][j] + (1 - beta1) * dWxh[i][j];
                this.adam.vWxh[i][j] = beta2 * this.adam.vWxh[i][j] + (1 - beta2) * dWxh[i][j] * dWxh[i][j];
                this.Wxh[i][j] -= lrStep * this.adam.mWxh[i][j] / (Math.sqrt(this.adam.vWxh[i][j]) + eps);
            }
        }

        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.adam.mWhh[i][j] = beta1 * this.adam.mWhh[i][j] + (1 - beta1) * dWhh[i][j];
                this.adam.vWhh[i][j] = beta2 * this.adam.vWhh[i][j] + (1 - beta2) * dWhh[i][j] * dWhh[i][j];
                this.Whh[i][j] -= lrStep * this.adam.mWhh[i][j] / (Math.sqrt(this.adam.vWhh[i][j]) + eps);
            }
        }

        for (let i = 0; i < this.outputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.adam.mWhy[i][j] = beta1 * this.adam.mWhy[i][j] + (1 - beta1) * dWhy[i][j];
                this.adam.vWhy[i][j] = beta2 * this.adam.vWhy[i][j] + (1 - beta2) * dWhy[i][j] * dWhy[i][j];
                this.Why[i][j] -= lrStep * this.adam.mWhy[i][j] / (Math.sqrt(this.adam.vWhy[i][j]) + eps);
            }
        }

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
    // ГЕНЕРАЦИЯ ТЕКСТА
    // ==========================================

    generate(length = 120) {
        let h = new Array(this.hiddenSize).fill(0);
        let currentIdx = Math.floor(Math.random() * this.vocabSize);
        let result = "";
        
        const temperature = 0.6;

        for (let t = 0; t < length; t++) {
            const nextH = new Array(this.hiddenSize);
            for (let i = 0; i < this.hiddenSize; i++) {
                let sum = this.Wxh[i][currentIdx] + this.bh[i];
                for (let j = 0; j < this.hiddenSize; j++) {
                    sum += this.Whh[i][j] * h[j];
                }
                nextH[i] = Math.tanh(sum);
            }
            h = nextH;

            const y = new Array(this.outputSize);
            for (let i = 0; i < this.outputSize; i++) {
                let sum = this.by[i];
                for (let j = 0; j < this.hiddenSize; j++) {
                    sum += this.Why[i][j] * h[j];
                }
                y[i] = sum;
            }

            const softProbs = this.getTemperatureSoftmax(y, temperature);
            currentIdx = this.sampleFromDistribution(softProbs);
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
        let out = text.trim().replace(/\s+/g, ' ');
        if (out.length > 0) {
            out = out.charAt(0).toUpperCase() + out.slice(1);
        }
        return out;
    }

    // ==========================================
    // ПАРСИНГ ССЫЛОК
    // ==========================================

    async readUrl(url) {
        try {
            console.log(`🌐 Парсинг: ${url}`);
            const response = await axios.get(url, { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            let text = response.data;
            text = text.replace(/<[^>]*>/g, ' ');
            text = text.replace(/\s+/g, ' ').trim();
            text = text.substring(0, 2000);
            
            if (text.length < 50) {
                return false;
            }
            
            console.log(`📖 Извлечено ${text.length} символов`);
            this.learnFromText(text, "url");
            return true;
            
        } catch (error) {
            console.error(`❌ Ошибка:`, error.message);
            return false;
        }
    }

    // ==========================================
    // СОХРАНЕНИЕ И ЗАГРУЗКА
    // ==========================================

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
            console.log('🧠 Веса загружены');
        } catch (e) {
            console.error("Ошибка загрузки весов");
            this.createNewNetwork();
        }
    }

    resetBoredom() {
        this.stats.boredom = 0;
        this.stats.lastActivity = Date.now();
        this.saveStats();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new MyNeuralNetwork();
