export default {
  testDir: "./tests/e2e",
  timeout: 45_000,
  webServer: process.env.WEATHERHANNUN_TEST_URL ? undefined : {command: "python3 -m http.server 8907 --bind 127.0.0.1", url: "http://127.0.0.1:8907", reuseExistingServer: !process.env.CI},
  use: {baseURL: process.env.WEATHERHANNUN_TEST_URL || "http://127.0.0.1:8907", viewport: {width: 390, height: 844}, trace: "retain-on-failure"},
};
