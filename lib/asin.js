/**
 * AmazonのURLからASINを抽出し、`/dp/`形式へ正規化するロジック。
 *
 * `chrome.*`のAPIに依存しないため、Node上でそのままユニットテストできる。
 * Service Worker側の処理は`background.js`にある。
 */

/**
 * 商品ページでよく使われるパスからASIN（10桁の英数字）を抽出する正規表現。
 * `/dp/`・`/gp/product/`・`/gp/aw/d/`・`/gp/offer-listing/`・`/product-reviews/`・
 * `/ASIN/`の各パターンを1本に統合している。
 * モジュールトップレベルに置き、呼び出しごとの再生成を避ける。
 * @type {RegExp}
 */
export const ASIN_PATH_RE =
  /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing|product-reviews|ASIN)\/([A-Z0-9]{10})/i;

/**
 * ASINとして妥当なコードかどうかを判定する正規表現。
 *
 * ASINは10文字の識別子で、実際に流通しているものは次の2系統に分かれる。
 *   - 書籍以外: `B`で始まる10文字（`B09XS7JWHH`など）
 *   - 書籍: ISBN-10をそのまま流用したもの。数字9桁＋チェックディジット
 *     （`0`から`9`または`X`）
 *
 * 単純な`[A-Z0-9]{10}`ではストアページIDやURLスラッグまで通してしまい、
 * 商品ページではないURLを`/dp/`へ書き換えてしまうため、上記2系統に絞る。
 * @type {RegExp}
 */
export const ASIN_STRICT_RE = /^(B[0-9A-Z]{9}|[0-9]{9}[0-9X])$/;

/**
 * ASINとして妥当なコードかどうかを判定する。
 * 呼び出し側で大文字化してから渡すこと。
 * @param {string} code 判定対象
 * @returns {boolean}
 */
export function isValidAsin(code) {
  return ASIN_STRICT_RE.test(code);
}

/**
 * ASINが乗りうるクエリパラメータのキー一覧。
 * @type {readonly string[]}
 */
export const ASIN_QUERY_KEYS = ["asin", "ASIN"];

/**
 * Amazonの商品ページを持つホストかどうかを判定する正規表現。
 *
 * `amazon.<tld>`（例: `amazon.com`）または`amazon.<tld>.<cc>`（例: `amazon.co.jp`、
 * `amazon.com.au`）に、`www.`のみを任意のサブドメインとして許可する。
 *
 * サブドメインを限定するのは、`music.amazon.co.jp`や`read.amazon.co.jp`のような
 * 商品ページを持たないサービスで実行され、利用中の画面から離脱してしまうのを
 * 防ぐため。あわせて`notamazon.com`・`amazon.evil.com`・`amazonaws.com`のような
 * 非Amazonドメインも除外される。
 * @type {RegExp}
 */
export const AMAZON_HOST_RE = /^(www\.)?amazon\.[a-z]{2,3}(\.[a-z]{2})?$/i;

/**
 * ASINから正規化済みの`/dp/`形式URLを組み立てる。
 * @param {string} asin 10桁のASIN
 * @returns {string} `https://www.amazon.co.jp/dp/<ASIN>/`
 */
export function normalizeDpLink(asin) {
  const code = String(asin).trim().toUpperCase();
  return `https://www.amazon.co.jp/dp/${code}/`;
}

/**
 * URLからASINを抽出する。
 * 次の順に探索し、最初に見つかった妥当なASINを大文字で返す。
 *   1. 既知のパスパターン（`/dp/`、`/gp/product/`など）
 *   2. クエリパラメータ（`asin` / `ASIN`）
 *
 * どちらも`isValidAsin`による検証を通す。任意のパスセグメントから10桁コードを
 * 探すフォールバックは、ストアページIDやURLスラッグを誤検出するため行わない。
 * @param {URL} u 対象URL
 * @returns {string|null} 見つかったASIN。なければ`null`
 */
export function findASINInURL(u) {
  // 1. 商品ページでよく使われるパスパターン（統合済みの`ASIN_PATH_RE`で一括判定）
  const m = u.pathname.match(ASIN_PATH_RE);
  if (m && m[1]) {
    const code = m[1].toUpperCase();
    if (isValidAsin(code)) return code;
  }

  // 2. クエリ文字列に asin / ASIN が乗っているケース
  for (const key of ASIN_QUERY_KEYS) {
    const v = u.searchParams.get(key);
    if (!v) continue;
    const code = v.trim().toUpperCase();
    if (isValidAsin(code)) return code;
  }

  return null;
}

/**
 * ホスト名がAmazonの商品ページを持つホストかどうかを判定する。
 * `AMAZON_HOST_RE`で全体を照合するため、`notamazon.com`や`amazon.evil.com`の
 * ような非Amazonドメインに加え、`music.amazon.co.jp`のような商品ページを持たない
 * サービスのサブドメインでも`false`を返す。
 * @param {string} hostname URLのホスト名
 * @returns {boolean}
 */
export function isAmazonHost(hostname) {
  return AMAZON_HOST_RE.test(hostname);
}

/**
 * タブのURLから、正規化後の遷移先URLを決定する。
 * Amazon以外・ASIN未検出・既に正規化済みの場合は、書き換え不要として`null`を返す。
 * @param {chrome.tabs.Tab} tab 対象タブ
 * @returns {string|null} 遷移先URL。書き換え不要なら`null`
 * @throws {TypeError} `tab.url`が不正なURL文字列の場合、`new URL()`が例外を投げる
 *   （呼び出し側の`try`/`catch`で捕捉する想定）
 */
export function resolveTargetUrl(tab) {
  const currentUrl = tab.url;
  if (!currentUrl) return null;

  // `activeTab`権限が付与されていれば`tab.url`が取得できる想定
  const u = new URL(currentUrl);

  // Amazonドメイン以外は対象外（`.co.jp`以外でもASINが取れれば`.co.jp`に寄せる）
  if (!isAmazonHost(u.hostname)) return null;

  const asin = findASINInURL(u);
  if (!asin) return null;

  const target = normalizeDpLink(asin);

  // 既に目的の形なら何もしない
  if (target === currentUrl) return null;

  return target;
}
