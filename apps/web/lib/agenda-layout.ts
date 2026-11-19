/** Places overlapping events side by side in a day column (classic calendar lane layout). */
export interface Placed<T> {
  item: T;
  lane: number;
  lanes: number;
}

export function layoutLanes<T>(items: readonly T[], start: (t: T) => number, end: (t: T) => number): Placed<T>[] {
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (start(item) >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((e) => e <= start(item));
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end(item));
    } else laneEnds[lane] = end(item);
    cluster.push({ item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, end(item));
  }
  flush();
  return out;
}
