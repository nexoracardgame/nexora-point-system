"use client";

import type { ComponentProps } from 'react';
import BattleWaitingRoom from './BattleWaitingRoom';
import { HEPTAD_TIERS, type HeptadTier } from '@/lib/heptad-rules';

type Props = Omit<ComponentProps<typeof BattleWaitingRoom>, 'modes' | 'mode' | 'onMode' | 'botId'> & {
  mode: HeptadTier;
  onMode: (tier: HeptadTier) => void | Promise<unknown>;
};

// No separate seat, spectator or bot UI: all modes share the same controller.
export default function HeptadWaitingRoom({ mode, onMode, ...props }: Props) {
  return <BattleWaitingRoom {...props} mode={mode} modes={HEPTAD_TIERS}
    onMode={value => onMode(value as HeptadTier)} botId="heptad-bot" />;
}
