## Telegram Bot Setup & Commands

### 1. Overview

The Telegram bot is used as the main interface to:
- **Monitor system status**
- **Check safety / kill-switch state**
- **Trigger emergency actions (killswitch)**  

The implementation lives in:
- `interaction/telegram/TelegramBot.ts`
- `interaction/telegram/CommandHandler.ts`
- `interaction/telegram/TelegramNotifier.ts`

---

### 2. Prerequisites

- **Telegram account**
- **Node.js environment** (same as the main app)
- The project already installed:  
  `npm install`

---

### 3. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**.
2. Start a chat and send: `/newbot`
3. Follow the prompts:
   - Choose a **name** (display name)
   - Choose a **username** (must end with `bot`, e.g. `tk_trading_system_bot`)
4. BotFather will respond with:
   - **HTTP API token** – something like `123456789:AA...`
5. Keep this token safe; it will be used as `TELEGRAM_BOT_TOKEN`.

---

### 4. Get Admin User IDs & Chat ID

You need:
- **Admin user IDs**: who can use the bot commands
- **Chat ID**: default chat where notifications are sent

#### 4.1 Get your Telegram user ID

1. In Telegram, search for a bot like **@userinfobot** or **@getidsbot**.
2. Start it and send any message (`/start`).
3. It will reply with your **user ID** (a numeric value).

Repeat for each admin you want to authorize.

#### 4.2 Get a chat ID

There are two common ways:

- **Private chat with the bot**
  1. Start a chat with your bot and send any message.
  2. Use a tool (like `@RawDataBot` / `@getidsbot`) to get the `chat.id` of that conversation.

- **Group chat**
  1. Create a group.
  2. Add your bot to the group.
  3. Send a message in the group.
  4. Use a tool to get the group `chat.id`.

Use this `chat.id` as `TELEGRAM_CHAT_ID`.

---

### 5. Environment Configuration

The bot reads its settings from environment variables (see `config/environment.ts`).  
Make sure the following are set (e.g. in `.env` or your deployment environment):

- **`TELEGRAM_BOT_TOKEN`**:  
  The API token from BotFather.

- **`TELEGRAM_CHAT_ID`**:  
  Default chat ID for system notifications (string).

- **`TELEGRAM_ADMIN_IDS`**:  
  Comma-separated list of Telegram user IDs allowed to use bot commands.  
  Example:
  ```bash
  TELEGRAM_ADMIN_IDS=123456789,987654321
  ```

- **`LOG_LEVEL`** (optional but recommended):  
  Controls log verbosity for the whole app, including Telegram integration (e.g. `info`, `debug`).

#### Example `.env` snippet

```bash
TELEGRAM_BOT_TOKEN=123456789:AA-example-token-from-botfather
TELEGRAM_CHAT_ID=123456789
TELEGRAM_ADMIN_IDS=123456789,987654321
LOG_LEVEL=info
```

---

### 6. Starting the Bot

The Telegram bot is created when the main app is started (see `app.ts` / `interaction` bootstrap).

From the project root:

```bash
npm install
npm run build
npm start
```

Once running, you should see a log similar to:

- `Telegram bot initialized and listening`

If there are configuration issues (invalid token, network problems), the logger will output errors.

---

### 7. Authorization Model

- Only users whose IDs are present in **`TELEGRAM_ADMIN_IDS`** are allowed to run commands.
- Any message starting with `/` (a command) from a non-admin will receive:
  - A **“Access Denied”** message
  - A **security log** entry via `AuditLogger.logSecurityEvent` / `logTraderAction` where applicable.

If you do not see responses from the bot:
- Verify your user ID is included in `TELEGRAM_ADMIN_IDS`.
- Restart the app after changing env variables.

---

### 8. Available Commands

All commands must be sent via **direct message** to the bot (or in an authorized group where the bot is present).

#### 8.1 `/start`

- **Purpose**: Basic greeting and confirmation that the system is online.
- **Who can use**: Admins only.
- **Behavior**:
  - Sends a welcome message:
    - Confirms TK Trading System is online.
    - Reminds you to use `/help` for commands.

**Example:**
```text
/start
```

#### 8.2 `/help`

- **Purpose**: Show the list of available commands and their categories.
- **Who can use**: Admins only.
- **Behavior**:
  - Returns:
    - Information commands section.
    - Emergency commands section.

**Example:**
```text
/help
```

#### 8.3 `/status`

- **Purpose**: Query the current system / asset state.
- **Syntax**:
  - `/status` – overall status (all assets / summary)
  - `/status BTC` – status for a specific asset (e.g., BTC)
- **Who can use**: Admins only.
- **Behavior**:
  - Routes to `CommandHandler.handle('status', args, userId)`.
  - Should return:
    - Gate evaluations,
    - Permission state,
    - Key risk/context info (implementation-specific).

**Examples:**
```text
/status
/status BTC
```

#### 8.4 `/safety`

- **Purpose**: Check system safety controls.
- **Who can use**: Admins only.
- **Behavior**:
  - Routes to `CommandHandler.handle('safety', [], userId)`.
  - Should report:
    - Circuit breaker status
    - Kill-switch status
    - Any Tier 1 violations / risk constraints (implementation-specific).

**Example:**
```text
/safety
```

#### 8.5 `/killswitch`

- **Purpose**: Emergency stop – engages the system’s kill-switch.
- **Who can use**: Admins only (and should be restricted to trusted operators).
- **Behavior**:
  - Routes to `CommandHandler.handle('killswitch', [], userId)`.
  - Typically:
    - Disables further trading / execution.
    - Logs an audit entry (Tier 1 / security / override, depending on implementation).
    - Sends a confirmation message to the caller (and possibly broadcast via `TelegramNotifier`).

**Example:**
```text
/killswitch
```

---

### 9. Audit & Logging Behavior

Every command routed through `TelegramBot` generates an audit trail:

- In `TelegramBot.routeCommand(...)`, the bot calls:
  ```ts
  this.auditLogger.logTraderAction({
    actionType: 'COMMAND_RECEIVED',
    traderId: userId,
    asset: 'SYSTEM',
    details: { command, args: [...] },
    timestamp: new Date(),
  });
  ```
- This is stored via `AuditLogger` into:
  - Application logs (`logs/app.log`)
  - Audit logs (`logs/audit.log`)

In case of errors:
- The bot attempts to send a formatted error message back to the chat.
- Errors are also logged with `log.error(...)`.

---

### 10. Troubleshooting

- **Bot not responding**
  - Verify:
    - `TELEGRAM_BOT_TOKEN` is correct.
    - Network access to `api.telegram.org`.
    - The Node process is running without uncaught exceptions.

- **“Access Denied” when you use commands**
  - Check that your Telegram user ID is included in `TELEGRAM_ADMIN_IDS`.
  - Restart the app after changing env variables.

- **No notifications in the chat**
  - Confirm `TELEGRAM_CHAT_ID` is correct.
  - Make sure the bot has been started at least once in that chat (you sent `/start` or any message).

---

### 11. Extending Commands

To add a new command:

1. **Update `CommandHandler`**
   - Add a branch in `handle(command, args, userId)` to implement your new behavior.

2. **Wire the regex in `TelegramBot.setupHandlers()`**
   - Example:
     ```ts
     this.bot.onText(/\/mycommand(?:\s+(.*))?/, (msg, match) => {
       if (!this.isAuthorized(msg)) return;
       void this.routeCommand(msg, 'mycommand', match?.[1]);
     });
     ```

3. **Update this doc**
   - Document:
     - Syntax
     - Permissions
     - Expected output / side effects


