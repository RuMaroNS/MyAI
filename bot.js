const { Telegraf } = require('telegraf');
const son = require('./MySon');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    await ctx.reply(son.reset());
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const stats = son.getStats();
    await ctx.reply(`
🧠 **Нейросеть**
━━━━━━━━━━━━━━
📚 Связей: ${stats.words}
🔍 Поисков: ${stats.searches}
💬 Диалогов: ${stats.context}
    `);
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    const text = ctx.message.text;
    if (text === '/reset' || text === '/stats') return;
    
    await ctx.sendChatAction('typing');
    
    const answer = await son.think(text);
    
    await ctx.reply(answer);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
