/**
 * @jest-environment node
 */

import { validateAgentApiKey } from '@/lib/auth/agent-auth';

describe('Agent API Key Authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY: 'test-agent-secret-key-12345',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects null or missing authorization header', () => {
    expect(validateAgentApiKey(null)).toBe(false);
    expect(validateAgentApiKey('')).toBe(false);
  });

  it('rejects incorrect bearer token', () => {
    expect(validateAgentApiKey('Bearer wrong-key')).toBe(false);
    expect(validateAgentApiKey('wrong-key')).toBe(false);
  });

  it('accepts correct bearer token with Bearer prefix', () => {
    expect(validateAgentApiKey('Bearer test-agent-secret-key-12345')).toBe(true);
  });

  it('accepts correct token without Bearer prefix', () => {
    expect(validateAgentApiKey('test-agent-secret-key-12345')).toBe(true);
  });

  it('rejects when AGENT_API_KEY environment variable is missing', () => {
    delete process.env.AGENT_API_KEY;
    expect(validateAgentApiKey('Bearer test-agent-secret-key-12345')).toBe(false);
  });
});
