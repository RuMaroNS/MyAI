const { Telegraf } = require('telegraf');
const brain = require('./MyNeuralNetwork');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('⚠️ Ошибка');
});

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    await ctx.reply('🧹 Очищаю память...');
    const result = brain.resetMemory();
    await ctx.reply(result);
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const stats = brain.getStats();
    await ctx.reply(`
📊 **Статистика ИИ**
━━━━━━━━━━━━━━━━
🧠 Обучений: ${stats.learned}
📝 Символов: ${stats.totalCharsProcessed}
📚 База знаний: ${stats.knowledgeSize} фраз
🤖 Автообучение: ${brain.stats.autoLearn ? 'Вкл' : 'Выкл'}
    `);
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    
    // Ссылки
    if (text.match(/https?:\/\/[^\s]+/g)) {
        const msg = await ctx.reply('📖 Обрабатываю...');
        const urls = text.match(/https?:\/\/[^\s]+/g);
        let success = false;
        for (let url of urls) {
            const ok = await brain.readUrl(url);
            if (ok) success = true;
        }
        await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, 
            success ? '✅ Обработано' : '❌ Ошибка');
        return;
    }
    
    // Обучаемся
    brain.learnFromText(text, "user");
    
    // Генерируем ответ (ЧИСТЫЙ ИИ, БЕЗ КОСТЫЛЕЙ)
    await ctx.sendChatAction('typing');
    await brain.sleep(1500);
    
    const answer = brain.generate(120);
    await ctx.reply(answer || "...");
});

bot.launch().then(() => {
    console.log('🚀 АВТОНОМНЫЙ ИИ ЗАПУЩЕН');
    console.log('🤖 Бот сам читает интернет каждые 30 минут');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
