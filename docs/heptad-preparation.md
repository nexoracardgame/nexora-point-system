# Seven-card Mode Preparation

Status: draft, not a playable or published mode. No room API or lobby entry is enabled yet.

## Shared Structure

- Waiting room: `HeptadWaitingRoom` delegates to `BattleWaitingRoom`, including seats, spectators, bot actions and optimistic pending state.
- Reuse `BattleWaitingHeader`, `DeckPreparationLayout`, `DeckPreparationHeader`, `BattleCardInspector` and the existing landscape shell when wiring the real controller.
- Room membership, inventory, chat, authoritative outcomes and rank remain live server data. Never simulate these to make the unfinished mode appear playable.
- Keep TRIAD/PENTAD endpoints and rules unchanged.

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

The 105-card validator and board layout are implemented. Do not enable start until room privacy, special-call negotiation, skill targeting, bots, score/rank, reconnect and full-match tests are integrated. The PLAY drawer includes the HEPTAD artwork/selection but creation remains disabled rather than sending the player into a different ruleset.
