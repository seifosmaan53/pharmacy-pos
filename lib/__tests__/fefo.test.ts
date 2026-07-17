import { describe, expect, it } from "vitest";
import { allocateFEFO, type FEFOBatch } from "../fefo";

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

const batch = (id: string, remaining: number, expiresInDays: number): FEFOBatch => ({
  id,
  remaining,
  expiryDate: days(expiresInDays),
});

describe("allocateFEFO", () => {
  it("takes fully from the single batch when it covers demand", () => {
    const batches = [batch("a", 50, 30)];
    expect(allocateFEFO(batches, 20)).toEqual([{ id: "a", take: 20 }]);
  });

  it("prefers the batch expiring soonest, regardless of input order", () => {
    const batches = [batch("late", 100, 90), batch("soon", 100, 5)];
    const allocations = allocateFEFO(batches, 30);
    expect(allocations).toEqual([{ id: "soon", take: 30 }]);
  });

  it("spills over into the next-soonest batch once the first is exhausted", () => {
    const batches = [batch("soon", 10, 5), batch("mid", 10, 20), batch("late", 10, 60)];
    const allocations = allocateFEFO(batches, 15);
    expect(allocations).toEqual([
      { id: "soon", take: 10 },
      { id: "mid", take: 5 },
    ]);
  });

  it("draws across every batch when demand equals total stock", () => {
    const batches = [batch("a", 5, 1), batch("b", 5, 2), batch("c", 5, 3)];
    const allocations = allocateFEFO(batches, 15);
    expect(allocations).toEqual([
      { id: "a", take: 5 },
      { id: "b", take: 5 },
      { id: "c", take: 5 },
    ]);
  });

  it("skips batches with zero remaining", () => {
    const batches = [batch("empty", 0, 1), batch("real", 10, 5)];
    expect(allocateFEFO(batches, 4)).toEqual([{ id: "real", take: 4 }]);
  });

  it("throws INSUFFICIENT_STOCK when total remaining is below demand", () => {
    const batches = [batch("a", 5, 1), batch("b", 3, 2)];
    expect(() => allocateFEFO(batches, 9)).toThrow("INSUFFICIENT_STOCK");
  });

  it("throws on zero or negative quantity", () => {
    const batches = [batch("a", 5, 1)];
    expect(() => allocateFEFO(batches, 0)).toThrow("Quantity must be positive");
    expect(() => allocateFEFO(batches, -1)).toThrow("Quantity must be positive");
  });

  it("does not mutate the input batches array or its objects", () => {
    const batches = [batch("late", 10, 90), batch("soon", 10, 5)];
    const snapshot = JSON.parse(JSON.stringify(batches));
    allocateFEFO(batches, 5);
    expect(JSON.parse(JSON.stringify(batches))).toEqual(snapshot);
  });
});
