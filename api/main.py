import os
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

GIFTS = ["rose", "lion", "knockback", "speed", "freeze"]

def send_telegram_msg(chat_id, text, reply_markup=None):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    requests.post(url, json=payload)

def get_main_keyboard():
    return {
        "keyboard": [
            [{"text": "👥 Список игроков"}, {"text": "🎁 Список подарков"}],
            [{"text": "📜 Логи"}, {"text": "👤 Профиль"}]
        ],
        "resize_keyboard": True
    }

def get_user_roblox_nick(tg_id):
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    res = requests.get(f"{SUPABASE_URL}/rest/v1/telegram_users?telegram_id=eq.{tg_id}", headers=headers)
    if res.status_code == 200 and len(res.json()) > 0:
        return res.json()[0]["roblox_username"]
    return None

def register_user(tg_id, roblox_nick):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    payload = {"telegram_id": tg_id, "roblox_username": roblox_nick}
    requests.post(f"{SUPABASE_URL}/rest/v1/telegram_users", headers=headers, json=payload)

def send_gift(roblox_username, gift_type):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "username": roblox_username,
        "gift_type": gift_type,
        "amount": 1,
        "status": "pending"
    }
    res = requests.post(f"{SUPABASE_URL}/rest/v1/gifts", headers=headers, json=payload)
    return res.status_code in [200, 201]

def get_online_players_from_db():
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    res = requests.get(f"{SUPABASE_URL}/rest/v1/players_online?is_online=eq.true", headers=headers)
    if res.status_code == 200:
        return res.json()
    return []

# Главная страница для проверки работы
@app.route("/", methods=["GET"])
def home():
    return "Bot is running perfectly!", 200

# Главный обработчик вебхуков
@app.route("/api/webhook", methods=["POST"])
@app.route("/", methods=["POST"])
def webhook():
    update = request.get_json(silent=True)
    if not update:
        return jsonify({"status": "no payload"}), 200

    if "callback_query" in update:
        query = update["callback_query"]
        chat_id = query["message"]["chat"]["id"]
        data = query.get("data", "")

        if data.startswith("gift_"):
            gift_type = data.replace("gift_", "")
            roblox_nick = get_user_roblox_nick(chat_id)

            if roblox_nick and send_gift(roblox_nick, gift_type):
                send_telegram_msg(chat_id, f"✅ Подарок <b>{gift_type}</b> отправлен для <b>{roblox_nick}</b>!")
            else:
                send_telegram_msg(chat_id, "❌ Ошибка отправки подарка.")
        return jsonify({"status": "ok"}), 200

    if "message" in update:
        msg = update["message"]
        chat_id = msg["chat"]["id"]
        text = msg.get("text", "").strip()

        roblox_nick = get_user_roblox_nick(chat_id)

        if text == "/start":
            if roblox_nick:
                send_telegram_msg(chat_id, f"С возвращением, <b>{roblox_nick}</b>!", reply_markup=get_main_keyboard())
            else:
                send_telegram_msg(chat_id, "Привет! Введи свой <b>Никнейм в Roblox</b> для регистрации:")
            return jsonify({"status": "ok"}), 200

        if not roblox_nick:
            register_user(chat_id, text)
            send_telegram_msg(chat_id, f"✅ Твой Roblox ник сохранен: <b>{text}</b>", reply_markup=get_main_keyboard())
            return jsonify({"status": "ok"}), 200

        if text == "👥 Список игроков":
            online_list = get_online_players_from_db()
            if not online_list:
                send_telegram_msg(chat_id, "🟢 <b>Игроков онлайн сейчас нет.</b>")
            else:
                msg_text = f"🟢 <b>Игроки онлайн ({len(online_list)}):</b>\n\n"
                for p in online_list:
                    msg_text += f"• <b>{p['username']}</b>\n"
                send_telegram_msg(chat_id, msg_text)

        elif text == "🎁 Список подарков":
            keyboard = {
                "inline_keyboard": [
                    [{"text": f"🎁 {g.capitalize()}", "callback_data": f"gift_{g}"}] for g in GIFTS
                ]
            }
            send_telegram_msg(chat_id, f"Выбери подарок для отправки (<b>{roblox_nick}</b>):", reply_markup=keyboard)

        elif text == "📜 Логи":
            headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
            res = requests.get(f"{SUPABASE_URL}/rest/v1/gifts?order=created_at.desc&limit=5", headers=headers)
            if res.status_code == 200:
                logs = res.json()
                log_text = "📜 <b>Последние 5 подарков:</b>\n\n"
                for item in logs:
                    log_text += f"• {item.get('username')} — {item.get('gift_type')} [{item.get('status')}]\n"
                send_telegram_msg(chat_id, log_text)
            else:
                send_telegram_msg(chat_id, "❌ Ошибка загрузки логов.")

        elif text == "👤 Профиль":
            send_telegram_msg(chat_id, f"👤 <b>Профиль:</b>\n\n🆔 Telegram ID: <code>{chat_id}</code>\n🎮 Roblox Nick: <b>{roblox_nick}</b>")

    return jsonify({"status": "ok"}), 200
