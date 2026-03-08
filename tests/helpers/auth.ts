/**
 * Mock Clerk auth helpers for testing.
 *
 * Provides mock auth middleware and user factories
 * so tests can simulate authenticated requests without
 * a real Clerk instance.
 */

export interface MockUser {
  userId: string;
  sessionId: string;
  role: "user" | "admin";
}

/**
 * Create a mock user with a given ID.
 * Defaults to a standard user role.
 */
export function createMockUser(id: string = "user_test_123"): MockUser {
  return {
    userId: id,
    sessionId: `sess_${id}_${Date.now()}`,
    role: "user",
  };
}

/**
 * Create a mock admin user with a given ID.
 */
export function createMockAdmin(id: string = "admin_test_001"): MockUser {
  return {
    userId: id,
    sessionId: `sess_${id}_${Date.now()}`,
    role: "admin",
  };
}

/**
 * Create a mock auth object matching Clerk's req.auth shape.
 * Use this to inject into request objects during testing.
 */
export function createMockAuth(user: MockUser) {
  return {
    userId: user.userId,
    sessionId: user.sessionId,
    getToken: async () => `mock_token_${user.userId}`,
  };
}

/**
 * Express-compatible middleware mock that sets req.auth.
 * Usage in tests:
 *   app.use(mockAuthMiddleware(createMockUser("user_123")));
 */
export function mockAuthMiddleware(user: MockUser) {
  return (req: any, _res: any, next: any) => {
    req.auth = createMockAuth(user);
    next();
  };
}

/**
 * Generate a batch of mock users for multi-user testing scenarios.
 */
export function createMockUsers(count: number): MockUser[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUser(`user_test_${i + 1}`)
  );
}
