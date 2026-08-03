export interface RankedSource {
  name: string;
  gbPerDay?: number;
}

export function rankSourcesWithoutNames(
  sources: RankedSource[],
  totalGbPerDay: number,
  limit = 5,
): { name: string; sharePct: number }[] {
  const total = totalGbPerDay || 1;
  return [...sources]
    .sort((left, right) => (right.gbPerDay ?? 0) - (left.gbPerDay ?? 0))
    .slice(0, limit)
    .map((source, index) => ({
      name: `Source ${index + 1}`,
      sharePct: Math.round(((source.gbPerDay ?? 0) / total) * 1000) / 10,
    }));
}

export function redactSourceNames(value: string, sources: RankedSource[]): string {
  return [...sources]
    .filter((source) => source.name.length > 0)
    .sort((left, right) => right.name.length - left.name.length)
    .reduce(
      (redacted, source) => redacted.split(source.name).join("source"),
      value,
    );
}
