/**
 * Simple, generic LRU cache.
 *
 * Design goals:
 * - O(1) get / set
 * - Capacity is resizable at runtime
 * - No third-party dependencies
 *
 * Implementation note: we rely on `Map`'s built-in insertion-order
 * iteration. On a hit, `get` deletes the entry first and re-inserts it,
 * which moves it to the tail (most-recently-used position).
 */
export class LruCache<K, V> {
  private map = new Map<K, V>()
  private _maxSize: number

  constructor(maxSize = 5) {
    this._maxSize = Math.max(1, maxSize)
  }

  get maxSize(): number {
    return this._maxSize
  }

  get size(): number {
    return this.map.size
  }

  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v === undefined) return undefined
    // hit → move to end
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this._maxSize) {
      // Evict the least-recently-used entry: the FIRST key in Map iteration order.
      const oldest = this.map.keys().next().value as K | undefined
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  /** Returns keys in LRU order (least-recently-used → most-recently-used). */
  keys(): K[] {
    return Array.from(this.map.keys())
  }

  values(): V[] {
    return Array.from(this.map.values())
  }

  resize(maxSize: number): void {
    this._maxSize = Math.max(1, maxSize)
    while (this.map.size > this._maxSize) {
      const oldest = this.map.keys().next().value as K | undefined
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }
}
