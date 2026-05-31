const { Telegraf } = require('telegraf');
const brain = require('./MyNeuralNetwork');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

// Обработчик ошибок
bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('⚠️ Ошибка, но я жив.');
});

// Команда /reset - очистка памяти
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    await ctx.reply('🧹 Очищаю память...');
    const result = brain.resetMemory();
    await ctx.reply(result);
});

// Команда /stats
bot.command('stats', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const stats = brain.getStats();
    await ctx.reply(`
📊 **Статистика**
━━━━━━━━━━
🧠 Обучений: ${stats.learned}
📝 Символов: ${stats.totalCharsProcessed}
💭 Режим думания: ${stats.thinkingMode ? 'Вкл' : 'Выкл'}
📚 База знаний: ${stats.knowledgeSize} фраз
    `);
});

// Команда /think
bot.command('think', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const mode = brain.toggleThinkingMode();
    await ctx.reply(mode ? '🤔 Режим думания ВКЛЮЧЕН' : '⚡ Режим думания ВЫКЛЮЧЕН');
});

// Главный обработчик текста
bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    
    // Парсинг ссылок
    if (text.match(/https?:\/\/[^\s]+/g)) {
        const msg = await ctx.reply('📖 Обрабатываю ссылку...');
        const urls = text.match(/https?:\/\/[^\s]+/g);
        let success = false;
        
        for (let url of urls) {
            const ok = await brain.readUrl(url);
            if (ok) success = true;
        }
        
        if (success) {
            await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, '✅ Ссылка обработана! Мозг обновлен.');
        } else {
            await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, '❌ Не удалось прочитать ссылку.');
        }
        return;
    }
    
    // Обучаемся на сообщении пользователя
    brain.learnFromText(text, "user");
    
    // Индикатор "печатает"
    await ctx.sendChatAction('typing');
    
    // Думаем (если режим включен)
    if (brain.stats.thinkingMode) {
        await brain.sleep(1500);
    }
    
    // Генерируем ОТВЕТ, а не случайный текст
    const answer = brain.generateSmartResponse(text);
    
    await ctx.reply(answer);
});

bot.launch().then(() => {
    console.log('🚀 Бот запущен');
    console.log('🤖 Режим диалога АКТИВЕН');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
