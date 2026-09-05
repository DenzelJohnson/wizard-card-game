import { describe, expect, it } from 'vitest';

import config from '../../vitest.config';

describe('Vitest workspace isolation', () => {
  it('does not discover tests inside local Git worktrees', () => {
    const resolvedConfig = typeof config === 'function' ? config({} as never) : config;

    expect(resolvedConfig.test?.exclude).toContain('.worktrees/**');
  });
});
