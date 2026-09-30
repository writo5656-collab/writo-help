# MCBPVP BOT

Tier-testing Discord bot for MCBPVP Club.

## Run it
1. `npm install` (installs `@napi-rs/canvas` too, which draws the champion card; the bot still works if it fails to install)
2. Copy `.env.example` to `.env` and fill it in
3. `npm start`

## One-time Discord setup for tournaments
- **Channel:** `🏆・tournaments`. Sign-up cards, brackets, live scores and champions are posted here.
- **Roles:** the bot creates these on startup. Give them to the right people:
  - `Tournament Host`: can run `/tournament create`
  - `Referee`: gets assigned to match rooms and decides scores
  - `Tournament Ping`: pinged when a tournament is published
- Created automatically when needed: the `🏆 TOURNAMENT MATCHES` category, `👑 Best in <gamemode>` champion roles, and the `🔮 Oracle` role.
- The bot's own role must be **above** the champion/Oracle roles so it can hand them out.

## Running a tournament
1. `/tournament create`: set gamemode, server, size, 1v1/2v2, times, rules and referees in the private panel, then **Publish**
2. Players press **Join** (full = waitlist). Check-in DMs go out before the start (default 30 min).
3. At the start time the bracket is seeded by tier, and every match gets a private room with a referee.
   Players get a DM with a button into their room.
4. The referee scores each round; **End match** advances the winner. No-show and DQ ask for confirmation.
5. The winner gets `👑 Best in <gamemode>`. The best predictor gets `🔮 Oracle` for 7 days.

Other host commands: `/tournament edit | start | cancel | kick | setwinner | list | templates`.
Times accept `2026-09-26 18:00`, `26/09 18:00`, `18:00` or `in 1d 4h`.
