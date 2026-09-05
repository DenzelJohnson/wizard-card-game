import { describe, expect, it } from 'vitest';

import config from '../../vitest.config';

describe('Vitest workspace isolation', () => {
  it('does not discover tests inside local Git worktrees', () => {
    expect(config.test?.exclude).toContain('.worktrees/**');
  });
});
