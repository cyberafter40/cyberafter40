import type { AnyGameModule, GameCategory, GameVariant } from './types';

/**
 * Central catalogue of playable game modules.
 *
 * The registry is the seam that makes MindCode a platform rather than a single
 * game: screens, the daily challenge scheduler and the stats layer all resolve
 * games through here by id, so shipping a new brain-training module means
 * writing an engine and calling `registerGameModule` once.
 */
const modules = new Map<string, AnyGameModule>();

export function registerGameModule(module: AnyGameModule): void {
  if (modules.has(module.id)) {
    throw new Error(`Game module "${module.id}" is already registered`);
  }
  if (module.variants.length === 0) {
    throw new Error(`Game module "${module.id}" must declare at least one variant`);
  }
  modules.set(module.id, module);
}

/** Test/hot-reload helper. Not used in production paths. */
export function resetRegistry(): void {
  modules.clear();
}

export function getGameModule(id: string): AnyGameModule {
  const found = modules.get(id);
  if (!found) {
    throw new Error(
      `Unknown game module "${id}". Registered: ${[...modules.keys()].join(', ') || '(none)'}`,
    );
  }
  return found;
}

export function tryGetGameModule(id: string): AnyGameModule | undefined {
  return modules.get(id);
}

export function listGameModules(): AnyGameModule[] {
  return [...modules.values()];
}

export function listLiveGameModules(): AnyGameModule[] {
  return listGameModules().filter((m) => m.status === 'live');
}

export function listByCategory(category: GameCategory): AnyGameModule[] {
  return listGameModules().filter((m) => m.category === category);
}

export function getVariant(moduleId: string, variantId: string): GameVariant<any> {
  const module = getGameModule(moduleId);
  const variant = module.variants.find((v) => v.id === variantId);
  if (!variant) {
    throw new Error(`Unknown variant "${variantId}" for game module "${moduleId}"`);
  }
  return variant;
}

/** Variants a player of `level` is allowed to start. */
export function unlockedVariants(moduleId: string, level: number): GameVariant<any>[] {
  return getGameModule(moduleId).variants.filter((v) => v.unlocksAtLevel <= level);
}
