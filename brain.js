const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

class Brain {
    constructor() {
        this.memoryFile = 'memory.json';
        this.data = this.load();
    }

    load() {
        if (!fs.existsSync(this.memoryFile)) return { associations: {}, history: [] };
        return JSON.parse(fs.readFileSync(this.memoryFile));
    }

    async getWordsFromUrl(url) {
        try {
            const { data } = await axios.get(url, { timeout: 10000 });
            const $ = cheerio.load(data);
            $('script, style, nav, footer').remove(); // Убираем технический мусор
            return $('body').text().toLowerCase().match(/\b(\w+)\b/g) || [];
        } catch (e) {
            return []; // Если не прочитал — молчит
        }
    }

    async think(input) {
        let words = [];
        
        // Если это ссылка — читаем сайт
        if (input.startsWith('http')) {
            words = await this.getWordsFromUrl(input);
        } else {
            // Если текст — берем слова из него
            words = input.toLowerCase().match(/\b(\w+)\b/g) || [];
        }

        // Обучение: связываем слова
        for (let i = 0; i < words.length - 1; i++) {
            const w1 = words[i], w2 = words[i+1];
            if (!this.data.associations[w1]) this.data.associations[w1] = [];
            if (!this.data.associations[w1].includes(w2)) {
                this.data.associations[w1].push(w2);
            }
        }
        
        this.data.history.push(input);
        fs.writeFileSync(this.memoryFile, JSON.stringify(this.data));

        // Генерация ответа: пытаемся ответить тем, что выучили
        const startWord = words[words.length - 1];
        const nextWords = this.data.associations[startWord];
        
        if (!nextWords) return "..."; 
        
        return nextWords[Math.floor(Math.random() * nextWords.length)];
    }
}
module.exports = new Brain();
