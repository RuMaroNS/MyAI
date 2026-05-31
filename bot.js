const { Telegraf } = require('telegraf');
const brain = require('./myBrain');  // ← поменял с './brain' на './myBrain'
const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

// Функция размышления (остаётся без изменений)
async function thinkAndWrite() {
    if (brain.shouldWrite()) {
        const msg = `😴 ${brain.generate()}`;
        bot.telegram.sendMessage(MY_ID, msg);
        brain.resetBoredom();
    }
}

setInterval(thinkAndWrite, 600000);

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    brain.resetBoredom();
    
    // Если в сообщении есть ссылка - читаем и учимся
    const text = ctx.message.text;
    const urls = text.match(/https?:\/\/[^\s]+/g);
    
    if (urls) {
        for (let url of urls) {
            const ok = await brain.readUrl(url);
            if (ok) {
                await ctx.reply(`📖 Прочитал ссылку! ${brain.generate('', 40)}`);
            }
        }
        return;
    }
    
    // Обычное обучение
    brain.learn(text);
    const answer = brain.generate(text, 60);
    ctx.reply(answer);
});

bot.launch();
