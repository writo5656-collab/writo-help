# MCBPVP BOT

Tier-testing Discord bot for MCBPVP Club.

## Run it
1. `npm install` (installs `@napi-rs/canvas` too, which draws the champion card; the bot still works if it fails to install)
2. Copy `.env.example` to `.env` and fill it in
3. `npm start`

## One-time Discord setup for tournaments
Run **`/tournament setup verified_role:@Verified`** (admin). It creates everything, visible only to your Verified role, with a pinned post in each channel explaining what it is for. It is safe to run again (it repairs permissions and missing posts):

```
🏆 TOURNAMENTS                 read-only, only the bot posts
 ├─ 📢・tournament-signups    sign-up cards
 ├─ 🗂・brackets              brackets, updated after every match
 ├─ 🔴・live-matches          live scores + 🔮 predictions
 ├─ 👑・champions             winners + champion cards
 └─ 💬・tournament-chat       open chat for players
🏆 TOURNAMENT MATCHES          private match rooms (made automatically)
```

- **Roles:** the bot creates these on startup. Give them out:
  - `Tournament Host`: can run `/tournament create`
  - `Referee`: gets assigned to match rooms and decides scores
  - `Tournament Ping`: pinged when a tournament is published
- Created automatically when needed: `👑 Best in <gamemode>` champion roles and the `🔮 Oracle` role.
- The bot's own role must be **above** the champion/Oracle roles so it can hand them out.
- To rename channels, edit `CHANNELS` at the top of `tournaments.js`.

## Running a tournament
1. `/tournament create`: set gamemode, server, size, 1v1/2v2, times, rules and referees in the private panel, then **Publish**
2. Players press **Join** (full = waitlist). Check-in DMs go out before the start (default 30 min).
3. At the start time the bracket is seeded by tier, and every match gets a private room with a referee.
   Players get a DM with a button into their room.
4. The referee scores each round; **End match** advances the winner. No-show and DQ ask for confirmation.
5. The winner gets `👑 Best in <gamemode>`. The best predictor gets `🔮 Oracle` for 7 days.

Other host commands: `/tournament edit | start | cancel | kick | setwinner | list | templates`.
### Time zones
- Players see every tournament time in **their own** timezone (Discord timestamps), and each card also lists the start time for India, Pakistan, the Gulf, SE Asia, EU, UK, US and Brazil.
- Hosts run **`/tournament timezone`** once. Times they type are then read in their timezone.
- Times accept `26/09 18:00`, `2026-09-26 18:00`, `18:00`, `in 1d 4h`, a zone suffix like `18:00 CET` / `18:00 UTC+1`, or a Discord timestamp `<t:1790000000:F>`.
- The setup panel warns when the start time falls at night (00:00–07:00) for any region.
