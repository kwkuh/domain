import "dotenv/config";
import { Bot } from "grammy";
import { getDb } from "./lib/db.js";
import { startCron } from "./cron.js";
import * as help from "./commands/help.js";
import * as portfolio from "./commands/portfolio.js";
import * as whois from "./commands/whois.js";
import * as expiry from "./commands/expiry.js";
import * as meta from "./commands/meta.js";
import * as search from "./commands/search.js";
import * as dashboard from "./commands/dashboard.js";
import * as score from "./commands/score.js";
import * as dns from "./commands/dns.js";
import * as watch from "./commands/watch.js";
import * as io from "./commands/io.js";
import * as sales from "./commands/sales.js";
import * as drop from "./commands/drop.js";
import * as landing from "./commands/landing.js";
import * as history from "./commands/history.js";
import * as team from "./commands/team.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN missing. Copy .env.example to .env and set it.");
  process.exit(1);
}

const allowed = (process.env.ALLOWED_USERS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter(Boolean);

const bot = new Bot(token);

getDb(); // init schema

bot.use(async (ctx, next) => {
  if (allowed.length && ctx.from && !allowed.includes(ctx.from.id)) {
    await ctx.reply("Unauthorized. Ask the admin to add your user ID to ALLOWED_USERS.");
    return;
  }
  return next();
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

help.register(bot);
portfolio.register(bot);
whois.register(bot);
expiry.register(bot);
meta.register(bot);
search.register(bot);
dashboard.register(bot);
score.register(bot);
dns.register(bot);
watch.register(bot);
io.register(bot);
sales.register(bot);
drop.register(bot);
landing.register(bot);
history.register(bot);
team.register(bot);

bot.api.setMyCommands([
  { command: "help", description: "Show all commands" },
  { command: "add", description: "Add domain to portfolio" },
  { command: "list", description: "List portfolio" },
  { command: "detail", description: "Domain detail" },
  { command: "whois", description: "RDAP lookup" },
  { command: "expiry", description: "Expiry date" },
  { command: "available", description: "Check availability" },
  { command: "check", description: "Check keyword across TLDs" },
  { command: "upcoming", description: "Expiring soon" },
  { command: "score", description: "Brandability score" },
  { command: "find", description: "Search portfolio" },
  { command: "dashboard", description: "Portfolio stats" },
  { command: "dns", description: "DNS records" },
  { command: "watchlist", description: "Active watches" },
  { command: "export", description: "Export portfolio" },
  { command: "forsale", description: "List domain for sale" },
  { command: "leads", description: "View offer/lead log" },
  { command: "drop", description: "Drop-phase analysis" },
  { command: "landing", description: "Generate for-sale landing page" },
  { command: "timeline", description: "Recent portfolio activity" },
]);

startCron(bot);

console.log("🌐 Domainer starting…");
bot.start({
  drop_pending_updates: true,
  onStart: (me) => console.log(`Listening as @${me.username}`),
});
