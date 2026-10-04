const express = require('express');
const path = require('path');
const { pool, init } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME; // without @
const CRON_SECRET = process.env.CRON_SECRET;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

// ---------- Users ----------

app.post('/api/users', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  const result = await pool.query(
    'INSERT INTO users (name) VALUES ($1) RETURNING id, name, chat_id',
    [name.trim()]
  );
  res.json(result.rows[0]);
});

app.get('/api/users/:id', async (req, res) => {
  const result = await pool.query('SELECT id, name, chat_id FROM users WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ...result.rows[0], botUsername: BOT_USERNAME });
});

// ---------- Tasks ----------

app.get('/api/tasks/:userId', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
    [req.params.userId]
  );
  res.json(result.rows);
});

app.post('/api/tasks', async (req, res) => {
  const { userId, text, repeat, due, time, days } = req.body;
  if (!userId || !text) return res.status(400).json({ error: 'userId and text required' });
  const result = await pool.query(
    `INSERT INTO tasks (user_id, text, repeat, due, time, days)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, text, repeat || 'none', due || null, time || null, days || null]
  );
  res.json(result.rows[0]);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const { done } = req.body;
  const result = await pool.query(
    'UPDATE tasks SET done = $1 WHERE id = $2 RETURNING *',
    [done, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/tasks/:id', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Telegram webhook: captures chat_id when someone hits Start ----------

app.post('/api/telegram-webhook', async (req, res) => {
  const msg = req.body.message;
  if (msg && msg.text && msg.text.startsWith('/start')) {
    const parts = msg.text.split(' ');
    const userId = parts[1];
    const chatId = msg.chat.id;
    if (userId) {
      await pool.query('UPDATE users SET chat_id = $1 WHERE id = $2', [chatId, userId]);
      await sendTelegramMessage(chatId, "You're connected. I'll send your reminders here.");
    }
  }
  res.sendStatus(200);
});

// ---------- Cron endpoint: called every ~15 min by an external scheduler ----------

app.get('/api/cron', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.sendStatus(403);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentDay = now.getDay(); // 0=Sun..6=Sat
  const windowMinutes = 15;

  const usersResult = await pool.query('SELECT id, chat_id FROM users WHERE chat_id IS NOT NULL');
  const usersById = Object.fromEntries(usersResult.rows.map(u => [u.id, u.chat_id]));

  const tasksResult = await pool.query('SELECT * FROM tasks WHERE done = false');
  let sent = 0;

  for (const task of tasksResult.rows) {
    const chatId = usersById[task.user_id];
    if (!chatId) continue;

    if (task.repeat === 'none') {
      if (!task.due) continue;
      const due = new Date(task.due);
      const diffMin = (due - now) / 60000;
      if (diffMin <= 0 && diffMin > -windowMinutes && task.last_sent !== today) {
        await sendTelegramMessage(chatId, `Reminder: ${task.text}`);
        await pool.query('UPDATE tasks SET last_sent = $1, done = true WHERE id = $2', [today, task.id]);
        sent++;
      }
    } else {
      const activeDays = task.repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : (task.days || []);
      if (!activeDays.includes(currentDay) || !task.time) continue;
      const [h, m] = task.time.split(':').map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(h, m, 0, 0);
      const diffMin = (scheduled - now) / 60000;
      if (diffMin <= 0 && diffMin > -windowMinutes && task.last_sent !== today) {
        await sendTelegramMessage(chatId, `Reminder: ${task.text}`);
        await pool.query('UPDATE tasks SET last_sent = $1 WHERE id = $2', [today, task.id]);
        sent++;
      }
    }
  }

  res.json({ checked: tasksResult.rows.length, sent });
});

const PORT = process.env.PORT || 3000;
init().then(() => {
  app.listen(PORT, () => console.log(`Running on port ${PORT}`));
});
