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

  describe("ASINではない10桁コードを商品IDと誤認しない", () => {
    const cases = [
      ["ストアページID", "https://www.amazon.co.jp/stores/page/ABCDEFGHIJ"],
      ["小文字のパススラッグ", "https://www.amazon.co.jp/hogehoge12/x"],
      ["数字始まりのキャンペーンスラッグ", "https://www.amazon.co.jp/2026summer/deals"],
    ];

    for (const [name, input] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), null);
      });
    }
  });

  describe("商品ページ以外のAmazonサービスでは動かない", () => {
    const cases = [
      ["Amazon Music", "https://music.amazon.co.jp/albums/B0ABCDEFGH"],
      ["Kindle Cloud Reader", "https://read.amazon.co.jp/?asin=B0BXXXXXXX"],
      ["Prime Video", "https://www.primevideo.com/detail/B0ABCDEFGH"],
    ];

    for (const [name, input] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), null);
      });
    }
  });

  describe("遷移先は元URLのホストを維持する", () => {
    const cases = [
      [
        "amazon.comはamazon.comのまま",
        "https://www.amazon.com/dp/B09XS7JWHH/ref=x",
        "https://www.amazon.com/dp/B09XS7JWHH/",
      ],
      [
        "amazon.com.auはamazon.com.auのまま",
        "https://www.amazon.com.au/gp/product/B09XS7JWHH",
        "https://www.amazon.com.au/dp/B09XS7JWHH/",
      ],
      [
        "wwwなしのホストも維持する",
        "https://amazon.co.jp/gp/product/B09XS7JWHH",
        "https://amazon.co.jp/dp/B09XS7JWHH/",
      ],
    ];

    for (const [name, input, expected] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), expected);
      });
    }
  });

  describe("既に正規化済みなら再読み込みしない", () => {
    const cases = [
      ["末尾スラッシュあり", "https://www.amazon.co.jp/dp/B09XS7JWHH/"],
      ["末尾スラッシュなし", "https://www.amazon.co.jp/dp/B09XS7JWHH"],
      ["amazon.comで末尾スラッシュなし", "https://www.amazon.com/dp/B09XS7JWHH"],
      // Amazonのスクリプトが付ける`?th=1`・`?psc=1`は正規化済みとみなす
      ["Amazonが付けたth", "https://www.amazon.co.jp/dp/B09XS7JWHH?th=1"],
      ["末尾スラッシュとth", "https://www.amazon.co.jp/dp/B09XS7JWHH/?th=1"],
      ["thとpsc", "https://www.amazon.co.jp/dp/B09XS7JWHH/?th=1&psc=1"],
    ];

    for (const [name, input] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), null);
      });
    }
  });

  describe("自動付与以外のクエリは除去する", () => {
    const cases = [
      [
        "thと一緒にrefが付いている",
        "https://www.amazon.co.jp/dp/B09XS7JWHH?th=1&ref=abc",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
      [
        "アフィリエイトタグが付いている",
        "https://www.amazon.co.jp/dp/B09XS7JWHH?tag=example-22",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
      [
        "フラグメントが付いている",
        "https://www.amazon.co.jp/dp/B09XS7JWHH#customerReviews",
        "https://www.amazon.co.jp/dp/B09XS7JWHH/",
      ],
    ];

    for (const [name, input, expected] of cases) {
      it(name, () => {
        assert.equal(resolveTargetUrl(tab(input)), expected);
      });
    }
  });

  describe("書籍のASIN（ISBN-10）を扱える", () => {
    it("数字10桁", () => {
      assert.equal(
        resolveTargetUrl(tab("https://www.amazon.co.jp/dp/4048930842/ref=x")),
        "https://www.amazon.co.jp/dp/4048930842/",
      );
    });

    it("チェックディジットがXで終わる", () => {
      assert.equal(
        resolveTargetUrl(tab("https://www.amazon.co.jp/dp/477418411X/ref=x")),
        "https://www.amazon.co.jp/dp/477418411X/",
      );
    });
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

  it("商品ページを持たないサービスのサブドメインを拒否する", () => {
    for (const host of [
      "music.amazon.co.jp",
      "read.amazon.co.jp",
      "aws.amazon.com",
      "sellercentral.amazon.co.jp",
    ]) {
      assert.equal(isAmazonHost(host), false, host);
    }
  });
});
