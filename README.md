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
1. **Settings → Anthropic API key** (console.anthropic.com).
2. Optional: connect Etsy inside Printify, create a Printify Personal Access Token, paste it in Settings, load your shop, pick a product and print provider.

## Releasing an update
Bump `version` in `package.json`, then `GH_TOKEN=… npm run release`. Installed copies pick it up within an hour.
