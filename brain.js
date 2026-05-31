const fs = require('fs');

class Brain {
    constructor() {
        this.memoryFile = 'memory.json';
        this.init();
    }

    init() {
        if (!fs.existsSync(this.memoryFile)) {
            this.save({ 
                chain: {}, 
                name: "Малыш", 
                stats: { learned: 0, lastActivity: Date.now(), boredom: 0 } 
            });
        }
    }

    load() {
        try {
            return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
        } catch (e) { 
            return { chain: {}, name: "Малыш", stats: { learned: 0, lastActivity: Date.now(), boredom: 0 } }; 
        }
    }

    save(data) {
        fs.writeFileSync(this.memoryFile, JSON.stringify(data, null, 2));
    }

    // Логика "размышления": должен ли он сам проявить инициативу?
    shouldWrite() {
        let data = this.load();
        const now = Date.now();
        const timeSinceLastMsg = (now - data.stats.lastActivity) / 1000; // секунд
        
        // Скука растет со временем. 3600 - это один час тишины = +1 к скуке.
        data.stats.boredom += timeSinceLastMsg / 3600; 
        this.save(data);

        // Если бот заскучал (порог > 5), он пишет сам.
        return data.stats.boredom > 5;
    }

    resetBoredom() {
        let data = this.load();
        data.stats.boredom = 0;
        data.stats.lastActivity = Date.now();
        this.save(data);
    }

    // Эволюция: если много выучил, меняет имя
    evolve() {
        let data = this.load();
        if (data.stats.learned > 50 && data.name === "Малыш") {
            data.name = "Робон"; 
            this.save(data);
            return true;
        }
        return false;
    }

    learn(text) {
        let data = this.load();
        // Чистим текст: только буквы, от 3 символов
        const words = text.toLowerCase().match(/[а-яa-z]{3,}/g) || [];
        for (let i = 0; i < words.length - 1; i++) {
            if (!data.chain[words[i]]) data.chain[words[i]] = [];
            data.chain[words[i]].push(words[i + 1]);
        }
        data.stats.learned += 1;
        this.save(data);
    }

    generate() {
        let data = this.load();
        let keys = Object.keys(data.chain);
        if (keys.length === 0) return "Я пока думаю...";
        
        let current = keys[Math.floor(Math.random() * keys.length)];
        let res = [current];
        
        // Генерируем фразу из 7 слов
        for (let i = 0; i < 7; i++) {
            let next = data.chain[current];
            if (!next || next.length === 0) break;
            current = next[Math.floor(Math.random() * next.length)];
            res.push(current);
        }
        return res.join(' ');
    }
}

module.exports = new Brain();
