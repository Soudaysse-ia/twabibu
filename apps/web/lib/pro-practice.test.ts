import { describe, expect, it } from 'vitest';
import { currentMembership } from './pro-practice';

describe('practice shown in Twabibu Pro', () => {
  const memberships = [{ organizationId: 'a' }, { organizationId: 'b' }];

  it('follows the remembered choice', () => {
    expect(currentMembership(memberships, 'b')).toEqual({ organizationId: 'b' });
  });

  it('falls back to the first practice when there is no choice or the account left that practice', () => {
    expect(currentMembership(memberships, undefined)).toEqual({ organizationId: 'a' });
    expect(currentMembership(memberships, 'removed')).toEqual({ organizationId: 'a' });
    expect(currentMembership([], 'a')).toBeUndefined();
  });
});
