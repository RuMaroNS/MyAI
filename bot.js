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
📊 **Статистика**
━━━━━━━━━━
🧠 Обучений: ${stats.learned}
📝 Символов: ${stats.totalCharsProcessed}
📚 База знаний: ${stats.knowledgeSize} фраз
    `);
});

bot.command('think', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const mode = brain.toggleThinkingMode();
    await ctx.reply(mode ? '🤔 Режим думания ВКЛ' : '⚡ Режим думания ВЫКЛ');
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    
    // Ссылки
    if (text.match(/https?:\/\/[^\s]+/g)) {
        const msg = await ctx.reply('📖 Обрабатываю ссылку...');
        const urls = text.match(/https?:\/\/[^\s]+/g);
        let success = false;
        for (let url of urls) {
            const ok = await brain.readUrl(url);
            if (ok) success = true;
        }
        await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, 
            success ? '✅ Ссылка обработана!' : '❌ Не удалось');
        return;
    }
    
    // Обучаемся
    brain.learnFromText(text, "user");
    
    // Печатает...
    await ctx.sendChatAction('typing');
    
    // Думаем
    if (brain.stats.thinkingMode) {
        await brain.sleep(1000);
    }
    
    // ВАЖНО: вызываем УМНЫЙ ответ, а не генерацию!
    const answer = brain.generateSmartResponse(text);
    
    await ctx.reply(answer);
});

bot.launch().then(() => console.log('🚀 Бот запущен'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
