export default {
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {baseURL: process.env.WEATHERHANNUN_TEST_URL || "http://127.0.0.1:8899", viewport: {width: 390, height: 844}, trace: "retain-on-failure"},
};
