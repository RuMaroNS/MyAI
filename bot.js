const { Telegraf } = require('telegraf');
const brain = require('./brain');
const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

// Самообучение
bot.on('text', (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    brain.learn(ctx.message.text);
    ctx.reply(brain.generate(ctx.message.text.split(' ')[0]));
});

// Автономная жизнь: пишет сам раз в 3-6 часов
function scheduleNextThought() {
    const delay = Math.floor(Math.random() * (6 - 3 + 1) + 3) * 3600000;
    setTimeout(async () => {
        const text = brain.generate();
        bot.telegram.sendMessage(MY_ID, `Слушай, а ты знал... ${text}`);
        scheduleNextThought();
    }, delay);
}
scheduleNextThought();

bot.launch();
