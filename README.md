# Kivo Ultron

A suite of AI departments ("spaces"). **STORE** designs and sells Etsy print-on-demand shirts; **MARKETING** promotes them on Instagram, TikTok and Pinterest; and you can **build your own spaces** with their own teams of bots. ULTRON runs them all.

## Rooms (2.3)
- **+ ROOM** in the title bar opens the room picker. Each room is a hand-made layout with its own furniture and a ready crew:
  - **Podcast Studio:** round table with mics, cameras, softbox lights, a glass control room and a green room. Crew: Showrunner, Guest Researcher, Question Writer, Show Notes, Clip Picker, Promo Writer.
  - **Video Studio:** green-screen set, writers' room, edit bay and a thumbnail wall.
  - **Trading Floor:** triple-monitor desks, a candle-chart video wall, ticker, world clocks and a glass risk office. Research and paper trades only.
  - **Sales Office:** headset call pods, a pipeline board, a THIS WEEK screen and a deal gong.
  - **Research Lab:** lab benches, a library wall and a holo-helix.
  - **Dev Studio:** dual-screen desks, blinking server racks, a kanban wall and a break area.
- The **Store** now runs in its own Print Shop room: printers, a shirt rail, packing table and your designs on the walls (classic pixel station still in Settings).
- Bots run in order, each building on the last; ULTRON plans each job. Web search, store/marketing data and past outputs are per-bot tools. Tick "I approve its work" to pause for your OK.
- Every room has spare desks: **+ HIRE A BOT** fills them. Store and Marketing take 6 hires each, and hires' notes feed into the next run.
- Tell ULTRON: "add a podcast studio", "hire me 2 bots to check my prices", "run the sales office on barbers in Knutsford".
- Export a room to a `.kivo-space.json` file and import it on another PC.

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
