import {test, expect} from "@playwright/test";

test("해외 지역은 공통 API의 MET Norway 예보로 주요 화면을 표시한다", async ({page}) => {
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/?lat=51.5074&lon=-0.1278&name=London");
  await expect(page.locator("#currentTemp")).not.toHaveText("--", {timeout: 25_000});
  await expect(page.locator("#dataFooterStatus")).toContainText("MET Norway");
  const briefing = page.locator("#startupWeatherBriefing");
  if (await briefing.isVisible()) await page.locator("#startupBriefingClose").click();
  await page.locator('button[data-view="hourly"]:visible').click();
  await expect(page.locator("#view-hourly")).toHaveClass(/active/);
  await page.locator('button[data-view="weekly"]:visible').click();
  await expect(page.locator("#view-weekly")).toHaveClass(/active/);
  expect(errors.filter(message => !message.includes("favicon"))).toEqual([]);
});

test("국내 키 미설정 시 임시 예보임을 명확히 표시하고 화면은 유지한다", async ({page}) => {
  await page.goto("/?lat=37.5665&lon=126.978&name=서울");
  await expect(page.locator("#currentTemp")).not.toHaveText("--", {timeout: 25_000});
  await expect(page.locator("#updatedBadge")).toContainText("임시 모델 예보");
  await expect(page.locator("#dataFooterStatus")).toContainText("공식 API 미연결");
});
