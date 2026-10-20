# Seven-card Mode Preparation

Status: playable implementation. PLAY > HEPTAD opens the dedicated seven-card room API and client.

## Shared Structure

- Waiting room: `HeptadWaitingRoom` delegates to `BattleWaitingRoom`, including seats, spectators, bot actions and optimistic pending state.
- The controller reuses `BattleWaitingHeader`, `DeckPreparationLayout`, `DeckPreparationHeader`, `BattleCardInspector`, the shared cinematic scenes and the existing landscape shell.
- Room membership, inventory, chat, authoritative outcomes and rank remain live server data. Never simulate these to make the unfinished mode appear playable.
- TRIAD/PENTAD keep their existing endpoints. Seven-card scoring opts into secondary-monster contributions in the shared skill engine; default scoring is unchanged.

## Confirmed Outline

Three fights, seven turns each, maximum 21 points. Monster slots on turns 1/2/5; skill slots on 3/4/6/7. Element comparison on monster turns. Attack branch uses main plus attack monster; support branch uses main plus support monster. Turn 1 compares ATK + SUP when required.

The confirmed 35-card split is 10 hand monsters, 10 hand skills, 5 special skills, 5 reserve skills and 5 reserve monsters, repeated for three fights (105 total). Each skill number is allowed once across the entire match, including every pile in every fight. Special calls are allowed on turns 2 through 6, at most 1/2/3 times in fights 1/2/3. The caller reveals first; the opponent must explicitly accept or decline their own special call before resolution. Used card instances cannot be reused.

Monster tier filtering supports bronze/silver/gold/all; skills are not restricted by monster tier. A tied match uses a remaining monster from each side, comparing ATK + SUP. No wagering or transfer of owned cards is implemented.

## Confirmed Follow-Ups

1. 35 cards every fight, 105 total; the source's later mention of 30 is superseded.
2. One copy of each skill number across all 105 cards, not one per fight.
3. The remaining-monster ATK + SUP duel is a match-end fallback, not the regular resolution of every turn. No remaining monsters means a draw. Reuse the first-monster PENTAD comparison when a monster clash ties completely; no RPS for this clash.
4. Skills do not carry from turn 3 to 4 or from turn 6 to 7. Retaining their artwork on the board is not permission to score them again. Each attack/support turn includes the corresponding secondary monster plus the main monster. No invented fight-long skill duration.
5. `HEPTAD_SLOT_POSITIONS` is the single formation map: main apex, two secondary monsters, four bottom skills. Turn 6 goes to support-right, turn 7 to support-left. Both players use identical dimensions and a shared landscape composition.

## Runtime and Verification

`lib/heptad-room-store.ts` owns authoritative state in a transactional PostgreSQL JSONB room row. `/api/heptad-rooms` authenticates membership and validates epochs, decks, choices and special quotas. Opponents' decks and unrevealed picks are redacted. Broadcast notifications use polling as a fallback. Result rank updates are recorded once and exclude bots. Room exits navigate immediately and send an idempotent background request.

`app/game/heptad/HeptadClient.tsx` provides shared waiting controls, three-fight deck preparation, both bot seats, spectator access, target selection, cinematics, chat and event history. Both formations follow their profile side. The hand and chat have separate viewport space.

Automated checks: `test-heptad-match.cjs` (32 complete bot matches, tier/deck validation, privacy, forfeits, skill targeting and no carryover), `test-heptad-api.cjs` (mocked persistence/auth, concurrent actions and exactly-once rank), `test-heptad-ui.cjs` (real client with mocked API at desktop and landscape phone sizes), `test-heptad-board.cjs` (14 slots across seven viewport sizes), and existing TRIAD/PENTAD regressions. These are not a substitute for physical-device or production two-account testing.
