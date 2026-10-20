# Kivo Ultron

A suite of AI departments ("spaces"). **STORE** designs and sells Etsy print-on-demand shirts; **MARKETING** promotes them on Instagram, TikTok and Pinterest; and you can **build your own spaces** with their own teams of bots. ULTRON runs them all.

## Spaces (2.1)
- **+ SPACE** in the title bar opens the Space Builder. Start from a template (Sales Team, YouTube Studio, Research Lab, Finance Desk, Trading Research, Customer Service, Dev Team, Life Admin, Product Lab) or a blank space, or describe what it's for and press **Design the team**.
- Each space gets its own isometric office floor in its own colour, with up to 18 bots at desks. Click any bot to watch it work live.
- Bots run in order, each building on the work before it. ULTRON plans each job and gives every bot its instruction.
- Per bot: name, team, job, Claude model, and tools: **web search** (Claude's server-side web search, about 1p per search), store data, marketing data, and past outputs. Tick **I approve its work** to pause the run for your OK or a redo with a note.
- Finished outputs land in the terminal (formatted, copy or save as Markdown) and hang on the office walls. Each space can run on autopilot every N hours.
- **Hire bots into Store or Marketing** too: they get desks (6 in the Store's NEW HIRES annex, 5 on the Marketing floor), review every mission or campaign, and their notes feed into the next run.
- Tell ULTRON in chat: "hire me 2 bots to check my prices", "build me a sales team", "run the sales team on barbers in Knutsford".
- Export a space to a `.kivo-space.json` file and import it on another PC.
- **Floor styles (2.2):** Neon office, Trading floor (ticker wall, chart screens), Studio (foam walls, ON AIR sign, mics), Lab (glass walls, helix), Print shop (hazard lines, gear) and Space station (star windows, globe). Pick one per space in the builder; Store and Marketing styles are in Settings. The Store now opens as an isometric print shop with your designs on the walls; the classic pixel station is still there in Settings.
- Trading Research is research and a paper-trade journal only: it never places real trades and isn't financial advice.

An autonomous AI commerce station for Windows. Eight Claude-powered agents run an Etsy print-on-demand line from a pixel-art space station:

| Agent | Job |
|---|---|
| ULTRON | Commander: turns your brief into a mission and delegates |
| ANALYST | Reads your Printify orders and feeds back what sells |
| SCOUT | Finds sellable niches and phrases |
| FORGE | Draws original print-ready artwork (exported at 4500×5400 PNG) |
| SCRIBE | Writes the Etsy title, 13 tags and description |
| AUDITOR | Checks trademarks, spelling and Etsy rules |
| LEDGER | Works out Etsy fees, cost, price and margin |
| COURIER | Uploads to Printify and publishes to your Etsy shop |

## Install
Download `Kivo-Ultron-Setup-x.y.z.exe` from [Releases](../../releases/latest). The app updates itself from this repo's releases.

## Setup
Open the app and the setup wizard walks you through it:
1. Paste an Anthropic API key (console.anthropic.com).
2. Paste a Printify token (Printify → Connections → API) after linking your Etsy shop in Printify. Optional: skip it for design-only mode.
3. Pick a shop template (Cottagecore Florals, Coffee & Cosy, Bookish, Pet Parents, Seasonal Autopilot, Profession Gifts, Retro Outdoors, Custom).
4. Pick how hands-off: Full auto, Review first, or Design only.

It picks the blank tee and print provider for you, switches autopilot on and starts the first mission.

## Running the shop from the app
- **Briefing**: tells you exactly what needs you (designs to review, orders on hold, setup gaps).
- **Chat**: talk to ULTRON in plain English; it can start missions and change settings.
- **Orders**: live orders with tracking; on-hold orders are sent to print automatically.
- **Stats**: sales, profit after Etsy fees, best sellers.
- **Customers**: paste a customer message, get a reply drafted with their order details.
- **Click any agent** to zoom into its room and watch its work live: Forge draws the artwork as it's written, Scribe types the Etsy listing, Scout's concepts lock on, Auditor runs its checks, Ledger shows the profit waterfall, Courier ticks through upload and publish, and ULTRON shows the mission plan and selling calendar.
- Failed steps retry automatically (3 tries, resuming from where it broke), and autopilot retries anything parked.
- A built-in selling calendar knows order cut-off dates, so seasonal designs target holidays that can still sell.
- Autopilot learns from sales, makes variations of best sellers, retires listings with no sales, and keeps running in the tray (starts with Windows).

## Releasing an update
Bump `version` in `package.json`, then `GH_TOKEN=… npm run release`. Installed copies pick it up within an hour.

## Marketing department (2.0)
An isometric marketing floor with 15 agents in 7 zones, plus ULTRON as Chief of Staff:
- **Research**: Trend Scout, Competitor Watch
- **Planning**: Strategist, Scheduler
- **Scripting**: Hook Writer, Caption Writer, Script Writer
- **Design**: Art Director, Designer (renders 1080×1350 feed posts and 1000×1500 pins)
- **Editing**: Video Editor (renders 1080×1920 MP4s with ffmpeg; cuts your own footage after watching it), Cover Maker
- **Publishing**: Publisher (posts on schedule), Community (drafts comment replies)
- **Analytics**: Analyst (pulls stats), Reporter (weekly summary fed back into planning)

Finished posts show on the office walls. Click any agent to zoom in and watch its work live.

### Connecting accounts
Each platform needs your own free developer app (Accounts tab walks you through it):
- **Instagram** (Instagram API with Instagram Login): professional account; redirect `https://tomosmira823-wq.github.io/ULTRON-/oauth/`. Instagram only accepts media from a public link, so add a free Cloudinary cloud name + unsigned upload preset.
- **TikTok** (Content Posting API, Direct Post): redirect `http://127.0.0.1:53682/callback/tiktok/`. Posts are private until TikTok audits your app. Video only.
- **Pinterest** (API v5): redirect `http://localhost:53682/callback/pinterest/`. Trial access pins are visible only to you.

Without connected accounts, posts come out as ready-to-post packs (image/video + caption, one-click copy).
