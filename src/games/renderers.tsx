import React, { type ComponentType } from 'react';
import { View } from 'react-native';
import type { UseGameSessionValue } from '@/state/useGameSession';
import { EmptyState } from '@/ui/components';
import { MemoryGridBoard } from './memoryGrid/MemoryGridBoard';
import { NumberPadBoard } from './numberLogic/NumberPadBoard';

/**
 * Renderer registry.
 *
 * A `GameModule` names its play surface by key; the game screen looks it up
 * here. This is the one place where the otherwise platform-agnostic engine
 * layer meets React, and it is why adding a memory or reaction game touches no
 * navigation or screen code — only this map gains an entry.
 */

export interface GameRendererProps {
  session: UseGameSessionValue;
  /** Called once the board decides the game is visually finished. */
  onFinished: () => void;
}

function UnavailableBoard() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <EmptyState
        icon="🚧"
        title="Not ready yet"
        message="This training module is on the roadmap. Its engine has not shipped in this build."
      />
    </View>
  );
}

const renderers: Record<string, ComponentType<GameRendererProps>> = {
  'number-pad': NumberPadBoard,
  'memory-grid': MemoryGridBoard,
  unavailable: UnavailableBoard,
};

export function registerRenderer(key: string, component: ComponentType<GameRendererProps>): void {
  renderers[key] = component;
}

export function getRenderer(key: string): ComponentType<GameRendererProps> {
  return renderers[key] ?? UnavailableBoard;
}
