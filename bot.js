process.on('uncaughtException', (err) => console.log('Ошибка:', err));
process.on('unhandledRejection', (err) => console.log('Ошибка промиса:', err));

const { Telegraf } = require('telegraf');
const brain = require('./brain');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    try {
        const response = await brain.think(ctx.message.text);
        ctx.reply(response);
    } catch (e) {
        ctx.reply('Я задумался и чуть не упал, но жив.');
    }
});

bot.launch();
