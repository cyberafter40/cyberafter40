import { registerGameModule, tryGetGameModule } from '@/engine/registry';
import { memoryGridModule } from './memoryGrid/module';
import { numberLogicModule } from './numberLogic/module';
import { upcomingModules } from './upcoming';

/**
 * Single place where the platform learns which games exist.
 *
 * Called once at app start (and again harmlessly on Fast Refresh). Adding a
 * brain-training module to MindCode is a one-line change here plus the module
 * itself — no screen, service or scoring code needs to know about it.
 */
export function registerAllGameModules(): void {
  for (const module of [numberLogicModule, memoryGridModule, ...upcomingModules]) {
    if (!tryGetGameModule(module.id)) registerGameModule(module);
  }
}

/** The module the Daily Challenge draws from in v1. */
export const DEFAULT_MODULE_ID = numberLogicModule.id;

export { numberLogicModule, memoryGridModule };
export * from './upcoming';
