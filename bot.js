const { Telegraf } = require('telegraf');
const son = require('./MySon');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

bot.catch((err) => console.error('Ошибка:', err.message));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const result = son.reset();
    await ctx.reply(result);
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const stats = son.getStats();
    await ctx.reply(`
📊 **Сын**
━━━━━━━━━━
📚 Знает тем: ${stats.topics}
🎓 Выучил сам: ${stats.learned}
🔍 Искал в интернете: ${stats.searched}
    `);
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    if (text === '/reset' || text === '/stats') return;
    
    // Если ссылка - учится молча
    if (text.match(/https?:\/\//)) {
        await son.learnFromUrl(text);
        await ctx.reply('✅');
        return;
    }
    
    await ctx.sendChatAction('typing');
    
    // Сын отвечает (сам найдет в интернете если не знает)
    const answer = await son.answer(text);
    
    await ctx.reply(answer);
});

bot.launch().then(() => {
    console.log('👨‍👦 СЫН ЗАПУЩЕН');
    console.log('🤫 Если не знает - молча ищет в интернете и запоминает');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
