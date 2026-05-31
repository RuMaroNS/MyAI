const { Telegraf } = require('telegraf');
const brain = require('./MyNeuralNetwork');

// Инициализация бота. Токен берется из переменных окружения Github Actions
const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    brain.resetBoredom();

    // Если отправлена ссылка - обучаемся на ее контенте
    if (text.match(/https?:\/\/[^\s]+/g)) {
        await ctx.reply("📖 Произвожу парсинг структуры документа...");
        const urls = text.match(/https?:\/\/[^\s]+/g);
        let success = false;
        for (let url of urls) {
            const ok = await brain.readUrl(url);
            if (ok) success = true;
        }
        if (success) {
            await ctx.reply("✅ Матрицы скорректированы на основе внешнего источника.");
        } else {
            await ctx.reply("❌ Не удалось прочесть ссылку.");
        }
        return;
    }

    // Обучаем сеть на вводе (25 эпох BPTT градиентного спуска)
    brain.learn(text, 25);

    // ГЕНЕРАЦИЯ: Полная автономия. Бот сам решает, с какого случайного символа начать генерировать
    const answer = brain.generate(80); 
    
    // Ответ пользователю
    await ctx.reply(answer || "...");
});

bot.launch().then(() => console.log("🚀 Полноценное ИИ-ядро успешно запущено в автономном режиме."));
