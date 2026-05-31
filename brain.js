const fs = require('fs');

class Brain {
    constructor() {
        this.memoryFile = 'memory.json';
        this.init();
    }

    init() {
        if (!fs.existsSync(this.memoryFile)) {
            fs.writeFileSync(this.memoryFile, JSON.stringify({ chain: {} }));
        }
    }

    load() {
        return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
    }

    learn(text) {
        const data = this.load();
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        for (let i = 0; i < words.length - 1; i++) {
            const current = words[i];
            const next = words[i + 1];
            if (!data.chain[current]) data.chain[current] = [];
            data.chain[current].push(next);
        }
        fs.writeFileSync(this.memoryFile, JSON.stringify(data, null, 2));
    }

    // Генерация предложения без промптов, просто связи слов
    generate(startWord) {
        const data = this.load();
        const keys = Object.keys(data.chain);
        if (keys.length === 0) return "Я еще учусь...";
        
        let current = startWord && data.chain[startWord] ? startWord : keys[Math.floor(Math.random() * keys.length)];
        let result = [current];

        for (let i = 0; i < 8; i++) {
            const nextWords = data.chain[current];
            if (!nextWords) break;
            current = nextWords[Math.floor(Math.random() * nextWords.length)];
            result.push(current);
        }
        return result.join(' ');
    }
}
module.exports = new Brain();
