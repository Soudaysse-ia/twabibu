import { describe, expect, it } from 'vitest';
import { layoutLanes } from './agenda-layout';

const ev = (id: string, s: number, e: number) => ({ id, s, e });

describe('layoutLanes', () => {
  it('keeps separate events full width and splits overlapping ones', () => {
    const placed = layoutLanes([ev('a', 0, 30), ev('b', 30, 60), ev('c', 40, 70), ev('d', 100, 120)], (x) => x.s, (x) => x.e);
    const by = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(by.a).toMatchObject({ lane: 0, lanes: 1 });
    expect(by.b).toMatchObject({ lane: 0, lanes: 2 });
    expect(by.c).toMatchObject({ lane: 1, lanes: 2 });
    expect(by.d).toMatchObject({ lane: 0, lanes: 1 });
  });
  it('reuses a free lane inside a cluster', () => {
    const placed = layoutLanes([ev('a', 0, 60), ev('b', 0, 20), ev('c', 30, 50)], (x) => x.s, (x) => x.e);
    const by = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(by.a!.lane).toBe(0);
    expect(by.b!.lane).toBe(1);
    expect(by.c!.lane).toBe(1);
    expect(by.c!.lanes).toBe(2);
  });
});
