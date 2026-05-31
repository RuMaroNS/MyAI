const fs = require('fs');

class Brain {
    constructor() {
        this.memoryFile = 'memory.json';
        this.memory = this.loadMemory();
    }

    loadMemory() {
        if (!fs.existsSync(this.memoryFile)) return { vocabulary: [], history: [] };
        return JSON.parse(fs.readFileSync(this.memoryFile));
    }

    async think(input) {
        // Учим слова
        const words = input.toLowerCase().match(/\b(\w+)\b/g) || [];
        words.forEach(w => {
            if (!this.memory.vocabulary.includes(w)) {
                this.memory.vocabulary.push(w);
            }
        });
        
        this.memory.history.push(input);
        fs.writeFileSync(this.memoryFile, JSON.stringify(this.memory, null, 2));

        // Ответ "ребенка"
        const count = this.memory.vocabulary.length;
        return `Я понял: "${input}". Теперь я знаю ${count} слов. Учи меня еще!`;
    }
}
module.exports = new Brain();
