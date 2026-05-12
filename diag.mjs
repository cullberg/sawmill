const mod = await import("./src/state/usePlan.ts");
const planks = [
  { specId: 't', x: 0, y: 50, width: 150, thickness: 25, sequence: 1, label: 't' },
  { specId: 't', x: 0, y: 80, width: 150, thickness: 25, sequence: 2, label: 't' },
  { specId: 't', x: 0, y: 110, width: 150, thickness: 25, sequence: 3, label: 't' },
  { specId: 't', x: 60, y: 0, width: 40, thickness: 100, sequence: 4, label: 't' }
];
const { circlePolygon } = await import("./src/core/geometry.ts");
const shape = circlePolygon(0, 0, 200, 48);
console.log("best =", mod.bestPlankingRotation(planks, shape));
