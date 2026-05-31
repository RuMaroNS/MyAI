const { Telegraf } = require('telegraf');
const brain = require('./MyNeuralNetwork');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

// Обработчик ошибок (чтобы бот не падал)
bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('⚠️ Ошибка, но я жив. Попробуйте ещё раз.');
});

// Команда /reset - полная очистка памяти
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== MY_ID) {
        await ctx.reply('⛔ У вас нет прав на эту команду.');
        return;
    }
    
    await ctx.reply('🧹 Очищаю память... Подождите...');
    const result = brain.resetMemory();
    await ctx.reply(result);
    await ctx.reply('💡 Теперь я как новорожденный! Обучайте меня заново.');
    await ctx.reply('📚 Отправьте мне текст или ссылку для обучения.');
});

// Команда /stats - статистика мозга
bot.command('stats', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const stats = brain.getStats();
    await ctx.reply(`
📊 **Статистика нейросети**
━━━━━━━━━━━━━━━━
🧠 Обучений: ${stats.learned}
📝 Символов обработано: ${stats.totalCharsProcessed}
📉 Последняя ошибка (loss): ${stats.lastLoss.toFixed(4)}
💭 Режим "думания": ${stats.thinkingMode ? 'Включен' : 'Выключен'}
⏱️ Последняя активность: ${new Date(stats.lastActivity).toLocaleTimeString()}
    `);
});

// Команда /think - включить/выключить режим думания
bot.command('think', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const mode = brain.toggleThinkingMode();
    await ctx.reply(mode ? '🤔 Режим "думания" ВКЛЮЧЕН (буду думать перед ответом)' : '⚡ Режим "думания" ВЫКЛЮЧЕН (отвечаю мгновенно)');
});

// Обработка текста с индикатором "печатает..."
bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    brain.resetBoredom();

    // Обработка ссылок
    if (text.match(/https?:\/\/[^\s]+/g)) {
        const msg = await ctx.reply('📖 Анализирую содержимое ссылки... Подождите.');
        const urls = text.match(/https?:\/\/[^\s]+/g);
        let success = false;
        
        for (let url of urls) {
            const ok = await brain.readUrl(url);
            if (ok) success = true;
        }
        
        if (success) {
            await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, '✅ Ссылка успешно обработана! Мозг обновлен.');
        } else {
            await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, '❌ Не удалось прочитать ссылку. Возможно, сайт защищен.');
        }
        return;
    }

    // Имитация "печатает..."
    await ctx.sendChatAction('typing');
    
    // Бот "думает" (с задержкой или без)
    const answer = await brain.think(text);
    
    // Отправляем ответ
    await ctx.reply(answer);
});

// Команда /help
bot.command('help', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    await ctx.reply(`
🤖 **Команды бота:**
━━━━━━━━━━━━━━━━━━━━
/reset - Полная очистка памяти
/stats - Показать статистику мозга
/think - Вкл/Выкл режим "думания"
/help - Эта справка

📝 **Как использовать:**
• Отправьте обычный текст — я научусь и отвечу
• Отправьте ссылку — я прочитаю и обучусь
• Чем больше общаетесь, тем умнее я становлюсь
    `);
});

// Запуск
bot.launch().then(() => {
    console.log('🚀 Бот запущен');
    console.log('🤖 Доступные команды: /reset, /stats, /think, /help');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
