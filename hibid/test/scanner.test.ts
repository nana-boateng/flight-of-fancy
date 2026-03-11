import { describe, expect, test } from 'bun:test';
import { shouldNotifyEscalation } from '../src/scanner';

describe('shouldNotifyEscalation', () => {
  test('notifies initially', () => {
    const result = shouldNotifyEscalation({
      previousBidCents: null,
      previousReason: null,
      previousCount: 0,
      currentBidCents: 40000,
      minutesRemaining: 45,
    });

    expect(result.notify).toBe(true);
    expect(result.reason).toBe('initial');
  });

  test('notifies on price drop', () => {
    const result = shouldNotifyEscalation({
      previousBidCents: 50000,
      previousReason: 'initial',
      previousCount: 1,
      currentBidCents: 44000,
      minutesRemaining: 40,
    });

    expect(result.notify).toBe(true);
    expect(result.reason).toBe('price_drop');
  });

  test('notifies for time critical once', () => {
    const result = shouldNotifyEscalation({
      previousBidCents: 50000,
      previousReason: 'price_drop',
      previousCount: 2,
      currentBidCents: 48000,
      minutesRemaining: 12,
    });

    expect(result.notify).toBe(true);
    expect(result.reason).toBe('time_critical');
  });
});
