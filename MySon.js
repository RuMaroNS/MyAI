const fs = require('fs');
const axios = require('axios');

class MySon {
    constructor() {
        // ЧИСТАЯ НЕЙРОСЕТЬ (только связи между словами)
        this.synapses = {};
        
        // Контекст (чистые сообщения, без обработки)
        this.context = [];
        
        this.stats = {
            words: 0,
            searches: 0
        };
        
        this.load();
        console.log('👶 Нейросеть запущена. Никаких шаблонов.');
    }
    
    save() {
        fs.writeFileSync('son_brain.json', JSON.stringify({
            synapses: this.synapses,
            context: this.context,
            stats: this.stats
        }, null, 2));
    }
    
    load() {
        if (fs.existsSync('son_brain.json')) {
            try {
                const data = JSON.parse(fs.readFileSync('son_brain.json'));
                this.synapses = data.synapses || {};
                this.context = data.context || [];
                this.stats = data.stats || this.stats;
            } catch(e) {}
        }
    }
    
    // ========== ОБУЧЕНИЕ (СТРОИТ СВЯЗИ) ==========
    learn(text) {
        const words = text.toLowerCase().split(/\s+/);
        
        for (let i = 0; i < words.length - 1; i++) {
            const current = words[i];
            const next = words[i + 1];
            
            if (!this.synapses[current]) {
                this.synapses[current] = {};
            }
            
            this.synapses[current][next] = (this.synapses[current][next] || 0) + 1;
        }
        
        this.stats.words = Object.keys(this.synapses).length;
        this.save();
    }
    
    // ========== ИЩЕТ В ИНТЕРНЕТЕ ==========
    async search(query) {
        try {
            const response = await axios.get(
                `https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }
            );
            
            if (response.data && response.data.extract) {
                this.stats.searches++;
                return response.data.extract;
            }
        } catch(e) {}
        return null;
    }
    
    // ========== ГЕНЕРАЦИЯ (ЧИСТЫЙ РАЗУМ, БЕЗ ШАБЛОНОВ) ==========
    generate(startWord, maxLength = 60) {
        if (Object.keys(this.synapses).length === 0) {
            return null;
        }
        
        let current = startWord;
        let result = [current];
        let safety = 0;
        
        while (result.length < maxLength && safety < 100) {
            safety++;
            
            const connections = this.synapses[current];
            if (!connections) break;
            
            // Вычисляем вероятности
            let total = 0;
            const options = [];
            for (let [word, weight] of Object.entries(connections)) {
                total += weight;
                options.push({ word, weight });
            }
            
            // Случайный выбор с весами
            let rand = Math.random() * total;
            let nextWord = null;
            for (let opt of options) {
                rand -= opt.weight;
                if (rand <= 0) {
                    nextWord = opt.word;
                    break;
                }
            }
            
            if (!nextWord) break;
            
            result.push(nextWord);
            current = nextWord;
            
            // Останавливаемся на знаке препинания
            if (nextWord.match(/[.!?]$/)) break;
        }
        
        return result.join(' ');
    }
    
    // ========== ГЛАВНЫЙ МОЗГ ==========
    async think(input) {
        // Запоминаем контекст
        this.context.push(input);
        if (this.context.length > 5) this.context.shift();
        
        // Учимся из ввода
        this.learn(input);
        
        const cleanInput = input.toLowerCase();
        const inputWords = cleanInput.split(/\s+/);
        
        // Пытаемся найти стартовое слово для генерации
        let startWord = null;
        
        // Берем последнее значимое слово из вопроса
        for (let i = inputWords.length - 1; i >= 0; i--) {
            const word = inputWords[i];
            if (this.synapses[word] && word.length > 2) {
                startWord = word;
                break;
            }
        }
        
        // Если нет связей - берем любое слово из памяти
        if (!startWord && Object.keys(this.synapses).length > 0) {
            const keys = Object.keys(this.synapses);
            startWord = keys[Math.floor(Math.random() * keys.length)];
        }
        
        // Пытаемся найти информацию в интернете
        const searchTerm = inputWords.find(w => w.length > 3) || cleanInput;
        const internetInfo = await this.search(searchTerm);
        
        if (internetInfo) {
            // Обучаемся из найденного
            this.learn(internetInfo);
        }
        
        // ГЕНЕРИРУЕМ ОТВЕТ (чистая генерация)
        let answer = null;
        
        if (startWord) {
            answer = this.generate(startWord, 50);
        }
        
        // Если генерация не удалась - пробуем с другим словом
        if (!answer || answer.length < 5) {
            const fallbackWords = ['я', 'ты', 'он', 'она', 'это', 'так', 'ну', 'да', 'нет'];
            for (let w of fallbackWords) {
                if (this.synapses[w]) {
                    answer = this.generate(w, 40);
                    if (answer && answer.length > 5) break;
                }
            }
        }
        
        // Если все равно нет - берем кусок из интернета
        if ((!answer || answer.length < 5) && internetInfo) {
            const sentences = internetInfo.split(/[.!?]/);
            for (let s of sentences) {
                if (s.length > 20 && s.length < 150) {
                    answer = s.trim();
                    break;
                }
            }
            if (answer) {
                answer = answer.charAt(0).toUpperCase() + answer.slice(1) + '.';
            }
        }
        
        // Последний шанс
        if (!answer || answer.length < 3) {
            answer = this.generate('я', 30);
            if (!answer || answer.length < 3) {
                answer = '...';
            }
        }
        
        // Обучаемся на своем ответе
        this.learn(answer);
        
        // Форматируем
        if (answer.charAt(0)) {
            answer = answer.charAt(0).toUpperCase() + answer.slice(1);
        }
        
        return answer;
    }
    
    // ========== КОМАНДЫ ==========
    reset() {
        this.synapses = {};
        this.context = [];
        this.stats = { words: 0, searches: 0 };
        this.save();
        return "🧠 Нейросеть перезапущена.";
    }
    
    getStats() {
        return {
            words: this.stats.words,
            searches: this.stats.searches,
            context: this.context.length
        };
    }
}

module.exports = new MySon();
