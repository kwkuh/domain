import type { Bot } from "grammy";

const HELP = `🌐 *domain* — domain portfolio manager

*Portfolio*
/add <domain> [--buy=N] [--bin=N] [--tag=a,b]
/list [--tag=] [--status=] [--expiring=N]
/detail <domain>
/remove <domain>     /restore <domain>     /purge <domain>
/pin /unpin /star /unstar <domain>

*WHOIS / RDAP*
/whois /expiry /registrar /ns /age <domain>
/available <domain>
/check <keyword> [--tlds=com,id,ai]

*Expiry & renewals*
/upcoming [--days=N]
/expired
/renew <domain>
/remind <domain> --days=N

*Metadata*
/tag /untag /tags <domain>
/note /notes <domain>
/cost /bin /floor <domain> <amount>
/category <domain> <cat>

*Search*
/find <q> [--contains= --starts-with= --ends-with= --length= --tld= --tag= --expiring= --registrar=]

*Scoring*
/score /brandability /length /vowel-ratio <domain>
/typo /plural /singular /hyphen <domain>

*DNS*
/dns /a /aaaa /mx /txt /cname /soa /spf /dmarc <domain>
/parking <domain>

*Watchlist*
/watch /unwatch <domain> [kind]
/watchlist
/watchns /watchexpiry /watchstatus <domain>

*Dashboard*
/dashboard /stats /summary
/health [--no-bin|--no-tag|--no-note|--expired]

*Sales*
/forsale <domain> [bin]  /unlist <domain>
/offer <domain> <amount> [buyer note...]
/counter <domain> <amount>
/sold <domain> <price>
/lead add|note|close <domain> [...]
/leads [domain]
/marketplace

*Drop Radar*
/drop <domain>
/pending <domain>
/dropwatch <domain>
/droplist

*Landing page*
/landing <domain> [--tg=user] [--email=foo] [--wa=+62...]
/publish /unpublish <domain>

*History*
/history /events <domain>
/timeline [--limit=N]
/changes <domain>

*Import / Export*
/export [--format=csv|json|ndjson|txt]
(send a .csv/.txt/.json file to import)

Self-hosted. Open source. Zero paid APIs.
github.com/kwkuh/domain`;

export function register(bot: Bot) {
  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply(HELP, { parse_mode: "Markdown" });
  });
}
