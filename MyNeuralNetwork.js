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
            thinkingMode: true
        };

        // --- РЕЖИМ ДУМАНИЯ ---
        this.thinkingTime = 2000;
        this.lastThinkTime = 0;

        this.initAlphabet();
        this.initNetwork();
        this.loadKnowledgeBase();
    }

    // ==========================================
    // СТАТИСТИКА И РЕЖИМЫ (ПРАВИЛЬНОЕ МЕСТО)
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

    toggleThinkingMode() {
        this.stats.thinkingMode = !this.stats.thinkingMode;
        this.saveStats();
        return this.stats.thinkingMode;
    }

    // ==========================================
    // АЛФАВИТ
    // ==========================================

    initAlphabet() {
        const alphabet = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz0123456789 .,!?-\"\':;()[]{}@#$%^&*+=/\\|~`\n";
        const chars = Array.from(new Set(alphabet.split('')));
        this.vocabSize = Math.min(chars.length, this.inputSize);

        for (let i = 0; i < this.vocabSize; i++) {
            this.charToIdx[chars[i]] = i;
            this.idxToChar[i] = chars[i];
        }
        
        console.log(`📚 Алфавит: ${this.vocabSize} символов`);
    }

    // ==========================================
    // СБРОС ПАМЯТИ
    // ==========================================

    resetMemory() {
        console.log("🧹 ПРОИЗВОДИТСЯ ПОЛНАЯ ОЧИСТКА ПАМЯТИ...");
        
        if (fs.existsSync(this.weightsFile)) {
            fs.unlinkSync(this.weightsFile);
        }
        if (fs.existsSync(this.memoryFile)) {
            fs.unlinkSync(this.memoryFile);
        }
        if (fs.existsSync(this.knowledgeFile)) {
            fs.unlinkSync(this.knowledgeFile);
        }
        
        this.stats = {
            learned: 0,
            totalCharsProcessed: 0,
            lastLoss: 0,
            lastActivity: Date.now(),
            boredom: 0,
            thinkingMode: true
        };
        
        this.knowledgeBase = {};
        this.createNewNetwork();
        
        console.log("✨ ПАМЯТЬ ПОЛНОСТЬЮ ОЧИЩЕНА!");
        return "🧠 Память полностью очищена! Я начинаю обучение с нуля.";
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
        
        return true;
    }

    // ==========================================
    // РЕЖИМ ДУМАНИЯ
    // ==========================================

    async think(question) {
        if (!this.stats.thinkingMode) {
            return this.generateAnswer(question);
        }
        
        console.log("🤔 Мозг анализирует запрос...");
        
        const complexity = Math.min(question.length / 50, 3);
        const thinkDelay = this.thinkingTime * (0.5 + complexity);
        
        await this.sleep(thinkDelay);
        
        const answer = this.generateAnswer(question);
        
        console.log(`💭 Думал ${(thinkDelay/1000).toFixed(1)} секунд`);
        return answer;
    }

    generateAnswer(question) {
        const words = question.toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length - 2; i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            if (this.knowledgeBase[phrase] && this.knowledgeBase[phrase].count > 2) {
                return this.generateFromPattern(phrase);
            }
        }
        
        return this.generate(100);
    }

    generateFromPattern(phrase) {
        const pattern = this.knowledgeBase[phrase];
        if (!pattern) return this.generate(80);
        
        let result = phrase;
        let current = phrase;
        
        for (let i = 0; i < 15; i++) {
            if (!this.knowledgeBase[current]) break;
            const nextWords = this.knowledgeBase[current].next;
            if (Object.keys(nextWords).length === 0) break;
            
            const total = Object.values(nextWords).reduce((a, b) => a + b, 0);
            let rand = Math.random() * total;
            let selected = '';
            for (const [word, count] of Object.entries(nextWords)) {
                rand -= count;
                if (rand <= 0) {
                    selected = word;
                    break;
                }
            }
            
            if (selected) {
                result += ' ' + selected;
                const words = result.split(' ');
                current = words.slice(-3).join(' ');
            }
        }
        
        return result;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    generate(length = 80) {
        let h = new Array(this.hiddenSize).fill(0);
        let currentIdx = Math.floor(Math.random() * this.vocabSize);
        let result = "";
        
        const temperature = 0.65;

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

            const y = new A
