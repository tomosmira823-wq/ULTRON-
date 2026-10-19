# Kivo Ultron

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
- Autopilot learns from sales, makes variations of best sellers, retires listings with no sales, and keeps running in the tray (starts with Windows).

## Releasing an update
Bump `version` in `package.json`, then `GH_TOKEN=… npm run release`. Installed copies pick it up within an hour.
