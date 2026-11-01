const {
  relativeTime,
  formatDate,
  formatDateTime,
  formatBytes,
  daysUntil,
  shortHash,
} = require('../src/core/utils/formatters');

// Freeze the clock so relative spans are deterministic.
const NOW = new Date('2024-06-15T12:00:00Z').getTime();

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  Date.now.mockRestore();
});

describe('relativeTime', () => {
  test('reports just-now spans', () => {
    expect(relativeTime(new Date(NOW - 20000).toISOString())).toBe('just now');
    expect(relativeTime(new Date(NOW).toISOString())).toBe('just now');
  });

  test('reports minutes and hours', () => {
    expect(relativeTime(new Date(NOW - 5 * 60000).toISOString())).toBe('5 min ago');
    expect(relativeTime(new Date(NOW - 3 * 3600000).toISOString())).toBe('3 h ago');
  });

  test('reports days and months', () => {
    expect(relativeTime(new Date(NOW - 4 * 86400000).toISOString())).toBe('4 d ago');
    expect(relativeTime(new Date(NOW - 70 * 86400000).toISOString())).toBe('2 mo ago');
  });

  test('marks future timestamps', () => {
    expect(relativeTime(new Date(NOW + 2 * 3600000).toISOString())).toBe('in 2 h');
    expect(relativeTime(new Date(NOW + 10 * 86400000).toISOString())).toBe('in 10 d');
  });

  test('returns empty string for unparseable input', () => {
    expect(relativeTime('not-a-date')).toBe('');
    expect(relativeTime(undefined)).toBe('');
  });
});

describe('formatDate', () => {
  test('formats day month year', () => {
    // Built from local components, then round-tripped through ISO, so the
    // assertion holds in every timezone.
    expect(formatDate(new Date(2024, 2, 5, 10, 0).toISOString())).toBe('5 Mar 2024');
  });

  test('falls back to an em dash for junk input', () => {
    expect(formatDate('nonsense')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatDateTime', () => {
  test('appends the local time', () => {
    const iso = new Date(2024, 5, 15, 9, 5).toISOString();
    expect(formatDateTime(iso)).toBe('15 Jun 2024 · 09:05');
  });

  test('falls back for junk input', () => {
    expect(formatDateTime('junk')).toBe('—');
  });
});

describe('formatBytes', () => {
  test('handles zero and small values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  test('scales to KB and MB', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
  });

  test('returns an em dash for non-numeric input', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes('abc')).toBe('—');
  });
});

describe('daysUntil', () => {
  test('counts whole days to a future date', () => {
    expect(daysUntil(new Date(NOW + 3 * 86400000).toISOString())).toBe(3);
  });

  test('goes negative after expiry', () => {
    expect(daysUntil(new Date(NOW - 2 * 86400000).toISOString())).toBe(-2);
  });

  test('returns null for junk input', () => {
    expect(daysUntil('junk')).toBeNull();
  });
});

describe('shortHash', () => {
  test('returns short strings untouched', () => {
    expect(shortHash('abcdef')).toBe('abcdef');
    expect(shortHash('')).toBe('—');
    expect(shortHash(null)).toBe('—');
  });

  test('elides the middle of long hashes', () => {
    const hash = 'a'.repeat(10) + 'b'.repeat(10) + 'c'.repeat(6);
    expect(shortHash(hash)).toBe('aaaaaaaaaa…cccccc');
  });
});
