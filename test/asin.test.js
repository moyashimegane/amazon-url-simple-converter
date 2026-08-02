import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {isAmazonHost, resolveTargetUrl} from "../lib/asin.js";

/**
 * `resolveTargetUrl`は`chrome.tabs.Tab`を受け取るが、参照するのは`url`のみ。
 * テストでは最小限のオブジェクトを渡す。
 */
const tab = (url) => ({id: 1, url});

describe("resolveTargetUrl", () => {
  describe("正規化する", () => {
    const cases = [
      [
        "/dp/にrefとクエリが付いている",
        "https://www.amazon.co.jp/dp/B0DGHYDZS5/ref=abc?th=1",
        "https://www.amazon.co.jp/dp/B0DGHYDZS5/",
      ],
      [
        "商品名スラッグが前置されている",
        "https://www.amazon.co.jp/%E3%82%BD%E3%83%8B%E3%83%BC/dp/B09XS7JWHH/",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
      [
        "/gp/product/形式",
        "https://www.amazon.co.jp/gp/product/B09XS7JWHH",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
      [
        "言語切り替えの/-/en/が挟まっている",
        "https://www.amazon.co.jp/-/en/dp/B09XS7JWHH",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
      [
        "/product-reviews/形式",
        "https://www.amazon.co.jp/product-reviews/B09XS7JWHH/ref=cm_cr_dp",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
      [
        "クエリのasinから抽出する",
        "https://www.amazon.co.jp/gp/aw/reviews.html?asin=B09XS7JWHH",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
    ];

    for (const [name, input, expected] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), expected);
      });
    }
  });

  describe("何もしない", () => {
    const cases = [
      ["既に正規化済み", "https://www.amazon.co.jp/dp/B09XS7JWHH/"],
      ["検索結果ページ", "https://www.amazon.co.jp/s?k=keyboard"],
      ["カート", "https://www.amazon.co.jp/gp/cart/view.html"],
      ["カテゴリページ", "https://www.amazon.co.jp/b?node=2127209051"],
      ["Amazonではないドメイン", "https://notamazon.com/dp/B09XS7JWHH"],
      ["amazonを含む別ドメイン", "https://amazon.evil.com/dp/B09XS7JWHH"],
      ["AWS", "https://console.amazonaws.com/dp/B09XS7JWHH"],
    ];

    for (const [name, input] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), null);
      });
    }
  });

  it("urlが無いタブではnullを返す", () => {
    assert.equal(resolveTargetUrl({id: 1}), null);
  });
});

describe("isAmazonHost", () => {
  it("各国のAmazonドメインを許可する", () => {
    for (const host of [
      "www.amazon.co.jp",
      "amazon.co.jp",
      "www.amazon.com",
      "www.amazon.com.au",
      "www.amazon.de",
    ]) {
      assert.equal(isAmazonHost(host), true, host);
    }
  });

  it("Amazonを騙るドメインを拒否する", () => {
    for (const host of [
      "notamazon.com",
      "amazon.evil.com",
      "console.amazonaws.com",
      "amazon.co.jp.evil.com",
    ]) {
      assert.equal(isAmazonHost(host), false, host);
    }
  });
});
