# 🔄 SingBox Subscription Converter

A simple and fast subscription link converter into a ready-to-use configuration file for **SingBox**. It runs as a serverless function on **Cloudflare Workers**.

Perfect for turning a set of raw links into a working config in seconds.

## ⚡ Features

- **Multi-link support:** Merges multiple subscription links into a single config.
- **Supported protocols:** VLESS, Trojan, Hysteria2 (and `hy2`).
- **Smart parsing:** Automatically decodes Base64 (handles mixed plain text and base64 seamlessly).
- **Duplicate protection:** Automatically adds suffixes to duplicate server names so the config doesn't break.

## 🚀 How to use

Deploy this script on Cloudflare Workers. Your base URL will look like this: `https://your-worker.workers.dev`

### Method 1: Via query parameter (Recommended)
Use the `?subs=` parameter, separating links with the `|` symbol:

```text
https://your-worker.workers.dev/?subs=https://example.com/sub1|https://example.com/sub2
```

### Method 2: Via URL path
You can pass the links directly in the path (also separated by `|`):

```text
https://your-worker.workers.dev/https://example.com/sub1|https://example.com/sub2
```

> 💡 **Tip:** If you paste the link into a browser, the `|` symbol might automatically encode as `%7C`. The script understands this and handles it correctly.

## 🛠 Installation & Deploy

1. Go to the **Cloudflare Dashboard**.
2. Navigate to **Workers & Pages** and click **Create Application**.
3. Choose **Create Worker**, give it a name, and click **Deploy**.
4. Open the created worker and click **Edit code**.
5. Completely replace the contents of the `worker.js` (or `index.js`) file with the code from this repository.
6. Click **Save and Deploy**.
7. Done! Use your URL to generate configs.

## 📦 What's inside the config?

The script outputs a valid SingBox JSON that includes:
- Proxy groups: `Proxy` (manual selector) and `auto` (automatic urltest to pick the fastest server).
- Basic, stable settings to get you up and running immediately.

## ⚠️ Important notes

- The script ignores broken or unrecognized lines in subscriptions, so a single error won't break the entire config.
- For the script to work correctly, all URLs must start with `http://` or `https://`.

## 🤝 License

MIT. Do whatever you want with this code.

---

# 🔄 Конвертер подписок для SingBox

Простой и быстрый конвертер ссылок-подписок в готовый конфигурационный файл для **SingBox**. Работает как серверная функция на **Cloudflare Workers**.

Идеально подходит, чтобы превратить набор сырых ссылок в рабочий конфиг за пару секунд.

## ⚡ Возможности

- **Мульти-поддержка:** Объединяет несколько ссылок-подписок в один конфиг.
- **Поддержка протоколов:** VLESS, Trojan, Hysteria2 (и `hy2`).
- **Умный парсинг:** Автоматически декодирует Base64 (справляется, даже если в подписке перемешан обычный текст и base64).
- **Защита от дублей:** Автоматически добавляет суффиксы к повторяющимся названиям серверов, чтобы конфиг не сломался.

## 🚀 Как использовать

Разверни этот скрипт на Cloudflare Workers. Твой базовый URL будет выглядеть так: `https://твой-воркер.workers.dev`

### Способ 1: Через параметр запроса (Рекомендуется)
Используй параметр `?subs=`, разделяя ссылки символом `|`:

```text
https://твой-воркер.workers.dev/?subs=https://example.com/sub1|https://example.com/sub2
```

### Способ 2: Через путь URL
Можно передать ссылки прямо в пути (также через `|`):

```text
https://твой-воркер.workers.dev/https://example.com/sub1|https://example.com/sub2
```

> 💡 **Совет:** Если ты вставляешь ссылку в браузер, символ `|` может автоматически закодироваться как `%7C`. Скрипт это понимает и обработает корректно.

## 🛠 Установка и деплой

1. Зайди в панель управления **Cloudflare Dashboard**.
2. Перейди в раздел **Workers & Pages** и нажми **Create Application**.
3. Выбери **Create Worker**, дай ему имя и нажми **Deploy**.
4. Открой созданный воркер, нажми **Edit code**.
5. Полностью замени содержимое файла `worker.js` (или `index.js`) на код из этого репозитория.
6. Нажми **Save and Deploy**.
7. Готово! Используй свой URL для генерации конфигов.

## 📦 Что внутри конфига?

Скрипт выдаёт валидный JSON для SingBox, который включает:
- Группы прокси: `Proxy` (ручной выбор) и `auto` (автоматический выбор самого быстрого сервера).
- Базовые настройки для стабильной и быстрой работы.

## ⚠️ Важные моменты

- Скрипт игнорирует битые или нераспознанные строки в подписках, чтобы одна ошибка не ломала весь конфиг.
- Для корректной работы ссылки обязательно должны начинаться с `http://` или `https://`.

## 🤝 Лицензия

MIT. Делай с этим кодом что хочешь.
