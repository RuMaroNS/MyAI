const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

class Brain {
    constructor() {
        this.memoryFile = 'memory.json';
        this.init();
    }

    init() {
        if (!fs.existsSync(this.memoryFile)) {
            this.save({ chain: {} });
        }
    }

    load() {
        try {
            return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
        } catch (e) { return { chain: {} }; }
    }

    save(data) {
        fs.writeFileSync(this.memoryFile, JSON.stringify(data, null, 2));
    }

    // Умное чтение сайта
    async fetchContent(url) {
        try {
            const { data } = await axios.get(url, { timeout: 10000, responseType: 'text' });
            const $ = cheerio.load(data);
            
            // Удаляем мусор
            $('script, style, nav, footer, noscript').remove();
            
            // Берем только текст из параграфов
            let text = $('p').map((i, el) => $(el).text()).get().join(' ');
            
            // Чистим от лишних пробелов и битых символов
            return text.replace(/\s+/g, ' ').trim();
        } catch (e) { return null; }
    }

    learn(text) {
        const data = this.load();
        // Берем слова, игнорируя спецсимволы и кодировки
        const words = text.toLowerCase().match(/[а-яa-z]{2,}/g) || [];
        for (let i = 0; i < words.length - 1; i++) {
            const current = words[i];
            const next = words[i + 1];
            if (!data.chain[current]) data.chain[current] = [];
            data.chain[current].push(next);
        }
        this.save(data);
    }

    generate(startWord) {
        const data = this.load();
        const chain = data.chain || {};
        const keys = Object.keys(chain);
        if (keys.length === 0) return "Я пытаюсь понять, что ты прислал...";
        
        let current = (startWord && chain[startWord]) ? startWord : keys[Math.floor(Math.random() * keys.length)];
        let result = [current];
        for (let i = 0; i < 10; i++) {
            const next = chain[current];
            if (!next) break;
            current = next[Math.floor(Math.random() * next.length)];
            result.push(current);
        }
        return result.join(' ');
    }
}
module.exports = new Brain();
