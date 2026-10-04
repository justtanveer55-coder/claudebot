# Docket — multi-user reminder app

Each person visits your site, creates a profile, adds tasks (one-off or
repeating on chosen weekdays), and connects Telegram. A server-side check
runs every 15 minutes and messages whoever has something due — no one
needs the site open.

## 1. Create your Telegram bot (2 min)
1. In Telegram, message **@BotFather**.
2. Send `/newbot`, follow the prompts, name it whatever you like.
3. BotFather gives you a **token** (looks like `123456:ABC-...`) — save it.
4. Also note the **bot username** it assigned (e.g. `docket_reminders_bot`).

## 2. Create a free database (2 min)
1. Go to https://neon.tech, sign up free, create a project.
2. Copy the connection string it gives you (starts with `postgresql://`).

## 3. Deploy the app (5 min)
1. Push this folder to a GitHub repo (or upload directly if your host supports it).
2. Go to https://render.com, sign up free, **New → Web Service**, connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add environment variables:
   - `DATABASE_URL` = the Neon connection string
   - `TELEGRAM_BOT_TOKEN` = your bot token
   - `TELEGRAM_BOT_USERNAME` = your bot username (no @)
   - `CRON_SECRET` = any random string you make up (e.g. `docket-9f2a`)
5. Deploy. Render gives you a URL like `https://docket-xxxx.onrender.com`.

## 4. Connect Telegram to your server (1 min)
Visit this URL once in your browser (fill in your own values):
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-render-url>/api/telegram-webhook
```
You should see `{"ok":true,...}`.

## 5. Set up the free scheduler (2 min)
Render's free tier sleeps when idle, so an external ping both wakes it and
triggers the reminder check.
1. Go to https://cron-job.org, sign up free.
2. Create a job that hits this URL every 15 minutes:
```
https://<your-render-url>/api/cron?secret=<CRON_SECRET>
```

## 6. Share it
Send everyone `https://<your-render-url>/`. Each person enters their name,
gets their own list, taps the Telegram link, and presses **Start**.
That's it — done.

## Notes
- Everyone's tasks and phone-free reminders live in the same small database — fine for a personal/family scale.
- If you'd rather send to WhatsApp specifically instead of Telegram, Meta's
  official Cloud API lets you register up to 5 personal numbers as free
  test recipients without business verification — ask and I'll adapt the
  server code for that instead.
