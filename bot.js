const { Telegraf } = require('telegraf');
const brain = require('./brain');
const bot = new Telegraf(process.env.BOT_TOKEN);
const MY_ID = 6176762600;

// Функция размышления
async function thinkAndWrite() {
    if (brain.shouldWrite()) {
        const msg = `Я тут подумал... ${brain.generate()}`;
        bot.telegram.sendMessage(MY_ID, msg);
        brain.resetBoredom();
    }
}

// Проверяем возможность написать каждые 10 минут
setInterval(thinkAndWrite, 600000);

bot.on('text', async (ctx) => {
    if (ctx.from.id !== MY_ID) return;
    
    // Сбрасываем скуку, когда ты пишешь
    brain.resetBoredom();
    
    brain.learn(ctx.message.text);
    ctx.reply(brain.generate());
});

bot.launch();

