const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

class Brain {
    constructor() {
        this.memoryFile = 'memory.json';
    }

    load() {
        if (!fs.existsSync(this.memoryFile)) return { words: [], history: [] };
        return JSON.parse(fs.readFileSync(this.memoryFile));
    }

    save(data) {
        fs.writeFileSync(this.memoryFile, JSON.stringify(data, null, 2));
    }

    async think(input) {
        let memory = this.load();
        memory.history.push(input);

        // Если ссылка - парсим и добавляем слова в память
        if (input.startsWith('http')) {
            try {
                const { data } = await axios.get(input, { timeout: 10000 });
                const $ = cheerio.load(data);
                const text = $('body').text().toLowerCase();
                const newWords = text.match(/\b(\w+){3,}\b/g) || [];
                
                newWords.forEach(w => {
                    if (!memory.words.includes(w)) memory.words.push(w);
                });
            } catch (e) {
                memory.history.push("Ошибка чтения ссылки: " + e.message);
            }
        }

        this.save(memory);
        return `Я записал. Теперь в памяти ${memory.words.length} уникальных слов.`;
    }
}
module.exports = new Brain();

