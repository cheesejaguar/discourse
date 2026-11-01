export const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT || '54329', 10);
export const TEST_DATABASE_URL = `postgresql://test:test@localhost:${TEST_DB_PORT}/hvnp_test`;
