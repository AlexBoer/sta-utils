export const MIN_BREAKTHROUGH_TRACK_SIZE = 3;
export const MAX_TRACK_SIZE = 30;
export const MIN_BREAKTHROUGH_COUNT = 1;
export const MAX_BREAKTHROUGH_COUNT = 5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Convert a percentage threshold to the following pip boundary. */
export function percentageToPips(percentage, max) {
  return Math.ceil((Number(percentage) / 100) * Number(max));
}

/** Convert a pip boundary to its percentage of the work track. */
export function pipsToPercentage(pips, max) {
  return Math.round((Number(pips) / Number(max)) * 100);
}

/** Return distinct, ordered interior boundaries for a work track. */
export function normalizeBreakthroughPositionList(max, positions) {
  const size = Math.max(
    MIN_BREAKTHROUGH_TRACK_SIZE,
    Math.trunc(Number(max)) || MIN_BREAKTHROUGH_TRACK_SIZE,
  );
  const source =
    Array.isArray(positions) && positions.length ? positions : [null, null];
  const count = clamp(
    source.length,
    MIN_BREAKTHROUGH_COUNT,
    Math.min(MAX_BREAKTHROUGH_COUNT, size - 1),
  );
  const defaults =
    count === 2
      ? [Math.ceil(size * 0.5), Math.ceil(size * 0.75)]
      : Array.from({ length: count }, (_, index) =>
          Math.ceil((size * (index + 1)) / (count + 1)),
        );
  const normalized = [];

  for (let index = 0; index < count; index++) {
    const raw = source[index];
    const value =
      raw !== null && raw !== "" && Number.isFinite(Number(raw))
        ? Math.round(Number(raw))
        : defaults[index];
    const min = index === 0 ? 1 : normalized[index - 1] + 1;
    const maxPosition = size - (count - index);
    normalized.push(clamp(value, min, maxPosition));
  }

  return normalized;
}

/** Return the legacy pair of breakthrough positions. */
export function normalizeBreakthroughPositions(max, first, second) {
  return normalizeBreakthroughPositionList(max, [first, second]);
}

/** Add a new position without moving existing positions when space remains. */
export function addBreakthroughPosition(max, positions) {
  const normalized = normalizeBreakthroughPositionList(max, positions);
  const size = Math.max(
    MIN_BREAKTHROUGH_TRACK_SIZE,
    Math.trunc(Number(max)) || MIN_BREAKTHROUGH_TRACK_SIZE,
  );
  if (normalized.length >= Math.min(MAX_BREAKTHROUGH_COUNT, size - 1)) {
    return normalized;
  }

  const occupied = new Set(normalized);
  const target = Math.ceil(
    (size * (normalized.length + 1)) / (normalized.length + 2),
  );
  const available = Array.from({ length: size - 1 }, (_, index) => index + 1)
    .filter((position) => !occupied.has(position))
    .sort((left, right) => Math.abs(left - target) - Math.abs(right - target));

  return [...normalized, available[0]].sort((left, right) => left - right);
}

/** Normalize the tracker fields used by persistence, forms, and rendering. */
export function normalizeTrackerBreakthroughs(data) {
  const normalized = { ...data };
  normalized.max = clamp(
    Math.trunc(Number(normalized.max)) || 1,
    normalized.isTimedChallenge ? 1 : MIN_BREAKTHROUGH_TRACK_SIZE,
    MAX_TRACK_SIZE,
  );
  normalized.hideBreakthroughsFromPlayers = Boolean(
    normalized.hideBreakthroughsFromPlayers,
  );

  if (normalized.isTimedChallenge) {
    normalized.breakthroughs = [];
    normalized.breakthrough1 = null;
    normalized.breakthrough2 = null;
  } else {
    const source =
      Array.isArray(normalized.breakthroughs) && normalized.breakthroughs.length
        ? normalized.breakthroughs
        : [normalized.breakthrough1, normalized.breakthrough2];
    normalized.breakthroughs = normalizeBreakthroughPositionList(
      normalized.max,
      source,
    );
    normalized.breakthrough1 = normalized.breakthroughs[0] ?? null;
    normalized.breakthrough2 = normalized.breakthroughs[1] ?? null;
  }

  return normalized;
}
