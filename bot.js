const { Telegraf } = require('telegraf');
const brain = require('./brain');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    const response = await brain.think(ctx.message.text);
    ctx.reply(response);
});

bot.launch();
