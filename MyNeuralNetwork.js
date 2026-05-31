const fs = require('fs');
const axios = require('axios');

class MySon {
    constructor() {
        // Память (то что знает)
        this.knowledge = {};
        
        // Контекст диалога
        this.context = [];
        
        this.stats = {
            learned: 0,
            searched: 0
        };
        
        this.load();
        console.log('👶 Сын родился');
    }
    
    save() {
        fs.writeFileSync('son_memory.json', JSON.stringify({
            knowledge: this.knowledge,
            context: this.context,
            stats: this.stats
        }, null, 2));
    }
    
    load() {
        if (fs.existsSync('son_memory.json')) {
            try {
                const data = JSON.parse(fs.readFileSync('son_memory.json'));
                this.knowledge = data.knowledge || {};
                this.context = data.context || [];
                this.stats = data.stats || this.stats;
                console.log(`📚 Знаю: ${Object.keys(this.knowledge).length} тем`);
            } catch(e) {}
        }
    }
    
    // ========== ИЩЕТ В ИНТЕРНЕТЕ ТО, ЧЕГО НЕ ЗНАЕТ ==========
    async searchAndLearn(question) {
        const searchUrl = `https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(question)}`;
        
        try {
            const response = await axios.get(searchUrl, {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (response.data && response.data.extract) {
                const answer = response.data.extract;
                const title = response.data.title;
                
                // Сохраняем в память
                this.knowledge[question.toLowerCase()] = {
                    answer: answer.substring(0, 500),
                    source: title,
                    learnedAt: Date.now()
                };
                
                this.stats.searched++;
                this.save();
                
                console.log(`🔍 Сын выучил: ${question}`);
                return answer;
            }
        } catch(e) {
            // Пробуем поискать через Яндекс (упрощенно)
            try {
                const yandexUrl = `https://yandex.ru/search/?text=${encodeURIComponent(question)}`;
                const yandexRes = await axios.get(yandexUrl, { timeout: 8000 });
                const match = yandexRes.data.match(/<div class="text-container typo typo_text_m">(.*?)<\/div>/);
                if (match) {
                    const answer = match[1].replace(/<[^>]*>/g, '');
                    this.knowledge[question.toLowerCase()] = {
                        answer: answer.substring(0, 500),
                        source: 'yandex',
                        learnedAt: Date.now()
                    };
                    this.save();
                    return answer;
                }
            } catch(e2) {}
        }
        
        return null;
    }
    
    // ========== УЧИТСЯ ИЗ ССЫЛОК (которые кидаешь) ==========
    async learnFromUrl(url) {
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            let text = response.data;
            text = text.replace(/<[^>]*>/g, ' ');
            text = text.replace(/\s+/g, ' ').trim();
            text = text.substring(0, 2000);
            
            // Извлекаем ключевые понятия
            const words = text.split(/\s+/);
            let currentTopic = null;
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i].toLowerCase();
                if (word.length > 3 && !this.knowledge[word]) {
                    // Берем предложение как ответ
                    const sentence = words.slice(Math.max(0, i-5), Math.min(words.length, i+10)).join(' ');
                    if (sentence.length > 20 && sentence.length < 300) {
                        this.knowledge[word] = {
                            answer: sentence,
                            source: url,
                            learnedAt: Date.now()
                        };
                        this.stats.learned++;
                    }
                }
            }
            
            this.save();
            console.log(`✅ Выучено из: ${url}`);
            return true;
            
        } catch(e) {
            console.log(`❌ Ошибка: ${url}`);
            return false;
        }
    }
    
    // ========== ОТВЕЧАЕТ (сам ищет если не знает) ==========
    async answer(question) {
        // Добавляем в контекст
        this.context.push(question);
        if (this.context.length > 10) this.context.shift();
        
        const cleanQ = question.toLowerCase();
        
        // Ищем ключевые слова в вопросе
        const questionWords = cleanQ.split(/\s+/);
        let foundTopic = null;
        let foundAnswer = null;
        
        // Сначала проверяем что знаем
        for (let word of questionWords) {
            if (word.length > 2 && this.knowledge[word]) {
                foundTopic = word;
                foundAnswer = this.knowledge[word].answer;
                break;
            }
        }
        
        // Если знает - отвечает
        if (foundAnswer) {
            // Делаем ответ естественным
            let response = foundAnswer;
            if (response.length > 300) {
                response = response.substring(0, 300) + '...';
            }
            return response;
        }
        
        // НЕ ЗНАЕТ - ИДЕТ В ИНТЕРНЕТ (молча, сам)
        // Берем главное слово из вопроса
        let searchTerm = questionWords.filter(w => w.length > 3)[0] || cleanQ;
        
        console.log(`🔍 Сын ищет: "${searchTerm}"`);
        
        const newKnowledge = await this.searchAndLearn(searchTerm);
        
        if (newKnowledge) {
            // Ура, выучил! Теперь отвечает
            let response = newKnowledge;
            if (response.length > 350) {
                response = response.substring(0, 350) + '...';
            }
            return response;
        }
        
        // Если ничего не нашел - честно говорит что не знает (но предложит научить)
        return "Я еще не знаю этого, папа. Кинь ссылку на тему или напиши сам — я запомню.";
    }
    
    // ========== КОМАНДЫ ==========
    reset() {
        this.knowledge = {};
        this.context = [];
        this.stats = { learned: 0, searched: 0 };
        this.save();
        return "🧠 Память стерта. Я переродился. Учи меня, папа.";
    }
    
    getStats() {
        return {
            topics: Object.keys(this.knowledge).length,
            learned: this.stats.learned,
            searched: this.stats.searched
        };
    }
}

module.exports = new MySon();
