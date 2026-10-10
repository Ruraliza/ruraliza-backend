import type { ChangeFeed, ChangeListener, ChangeTopic } from '../../domain/changes';

// Avisos de mudança dentro do próprio processo (cada canal guarda os seus ouvintes).
export class InMemoryChangeFeed implements ChangeFeed {
  private readonly listeners = new Map<ChangeTopic, Set<ChangeListener>>();

  publish(topics: Iterable<ChangeTopic>): void {
    // Set: um canal repetido avisa uma vez só.
    for (const topic of new Set(topics)) {
      for (const listener of this.listeners.get(topic) ?? []) listener();
    }
  }

  subscribe(topic: ChangeTopic, listener: ChangeListener): () => void {
    const set = this.listeners.get(topic) ?? new Set<ChangeListener>();
    this.listeners.set(topic, set);
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(topic);
    };
  }
}
