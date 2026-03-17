// jest.setup.js — CommonJS format (Jest setup files cannot use ESM import)
const { connectDB, closeDB, clearDB } = require('./src/lib/test-utils/db');

// Connect to a new in-memory database before running any tests.
beforeAll(async () => {
    await connectDB();
});

// Clear all test data after every test.
afterEach(async () => {
    await clearDB();
});

// Remove and close the db and server.
afterAll(async () => {
    await closeDB();
});
