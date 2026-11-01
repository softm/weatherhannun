import test from "node:test";
import assert from "node:assert/strict";
import {allowedOrigin,cacheKey,createRateLimiter,normalizeText,DEFAULT_VOICE} from "../server.mjs";

test("브리핑 문장을 제한하고 제어문자를 제거한다",()=>{
  assert.equal(normalizeText("  오늘\n 날씨\u0000 입니다. "),"오늘 날씨 입니다.");
  assert.equal(normalizeText("가".repeat(500)).length,350);
  assert.equal(normalizeText(null),"");
});
test("IP별 분당 합성 호출량을 제한한다",()=>{
  const allow=createRateLimiter(2);
  assert.equal(allow("a",0),true);assert.equal(allow("a",1),true);assert.equal(allow("a",2),false);
  assert.equal(allow("a",60_001),true);assert.equal(allow("b",2),true);
});
test("운영 원본만 허용하고 음원 캐시 키는 문장과 화자를 구분한다",()=>{
  assert.equal(allowedOrigin("https://softm.github.io"),true);
  assert.equal(allowedOrigin("https://example.com"),false);
  assert.notEqual(cacheKey("맑음",DEFAULT_VOICE),cacheKey("비",DEFAULT_VOICE));
});
