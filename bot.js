const { Telegraf } = require('telegraf');
const brain = require('./MyNeuralNetwork'); // Подключаем твой новый файл
const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

// Периодическая проверка "скуки" (автономная жизнь)
setInterval(async () => {
    if (brain.shouldWrite()) {
        const msg = `Слушай... ${brain.generate('привет', 40)}`;
        await bot.telegram.sendMessage(MY_ID, msg);
        brain.resetBoredom();
    }
}, 600000); // Проверка каждые 10 минут

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    brain.resetBoredom();
    const text = ctx.message.text;

    // 1. Если это ссылка - учимся глубоко
    if (text.match(/https?:\/\/[^\s]+/g)) {
        await ctx.reply("📚 Читаю и учусь...");
        const urls = text.match(/https?:\/\/[^\s]+/g);
        for (let url of urls) {
            await brain.readUrl(url); // Внутри readUrl у тебя уже есть learn()
        }
        await ctx.reply("✅ Готово! Я стал немного умнее.");
        return;
    }

    // 2. Если это обычный текст - учимся и отвечаем
    // Учимся агрессивно (50 раз на одно сообщение), чтобы он запоминал
    brain.learn(text, 50); 
    
    // Генерируем ответ
    const answer = brain.generate(text.slice(0, 10), 50);
    ctx.reply(answer || "...");
});

bot.launch();
