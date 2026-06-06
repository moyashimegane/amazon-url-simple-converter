/**
 * amazonUrlSimpleConverter
 *
 * 開いているAmazonタブのURLを`https://www.amazon.co.jp/dp/ASIN/`形式へ正規化する
 * Service Worker。ツールバーアイコンのクリックを起点に動作する。
 */

/**
 * 商品ページでよく使われるパスからASIN（10桁の英数字）を抽出する正規表現。
 * `/dp/`・`/gp/product/`・`/gp/aw/d/`・`/gp/offer-listing/`・`/product-reviews/`・
 * `/ASIN/`の各パターンを1本に統合している。
 * モジュールトップレベルに置き、呼び出しごとの再生成を避ける。
 * @type {RegExp}
 */
const ASIN_PATH_RE =
  /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing|product-reviews|ASIN)\/([A-Z0-9]{10})/i;

/**
 * 単体のASINコード（10桁の英数字）かどうかを判定する正規表現。
 * クエリ値やパスセグメントのフォールバック判定に使う。
 * @type {RegExp}
 */
const ASIN_CODE_RE = /^[A-Z0-9]{10}$/i;

/**
 * ASINが乗りうるクエリパラメータのキー一覧。
 * @type {readonly string[]}
 */
const ASIN_QUERY_KEYS = ["asin", "ASIN"];

/**
 * Amazonの登録ドメインかどうかを判定する正規表現。
 * `amazon.<tld>`（例: `amazon.com`）または`amazon.<tld>.<cc>`（例: `amazon.co.jp`、
 * `amazon.com.au`）が末尾にあり、かつ`amazon`の直前が文字列先頭またはドット区切りで
 * あることを要求する。これにより`notamazon.com`や`amazon.evil.com`、`amazonaws.com`
 * のような非Amazonドメインを除外する。
 * @type {RegExp}
 */
const AMAZON_HOST_RE = /(^|\.)amazon\.[a-z]{2,3}(\.[a-z]{2})?$/i;

/**
 * ASINから正規化済みの`/dp/`形式URLを組み立てる。
 * @param {string} asin 10桁のASIN
 * @returns {string} `https://www.amazon.co.jp/dp/<ASIN>/`
 */
function normalizeDpLink(asin) {
  const code = String(asin).trim().toUpperCase();
  return `https://www.amazon.co.jp/dp/${code}/`;
}

/**
 * URLからASIN（10桁の英数字）を抽出する。
 * 次の順に探索し、最初に見つかったものを大文字で返す。
 *   1. 既知のパスパターン（`/dp/`、`/gp/product/`など）
 *   2. クエリパラメータ（`asin` / `ASIN`）
 *   3. パスセグメントのフォールバック走査
 * @param {URL} u 対象URL
 * @returns {string|null} 見つかったASIN。なければ`null`
 */
function findASINInURL(u) {
  const path = u.pathname;

  // 1. 商品ページでよく使われるパスパターン（統合済みの`ASIN_PATH_RE`で一括判定）
  const m = path.match(ASIN_PATH_RE);
  if (m && m[1]) return m[1].toUpperCase();

  // 2. クエリ文字列に asin / ASIN が乗っているケース
  for (const key of ASIN_QUERY_KEYS) {
    const v = u.searchParams.get(key);
    if (v && ASIN_CODE_RE.test(v)) return v.toUpperCase();
  }

  // 3. 上記で取れない場合、パスセグメントから10桁コードを総当たりで探す
  for (const seg of path.split("/")) {
    if (ASIN_CODE_RE.test(seg)) return seg.toUpperCase();
  }

  return null;
}

/**
 * ホスト名がAmazonの登録ドメインかどうかを判定する。
 * 部分一致ではなく`AMAZON_HOST_RE`で末尾の登録ドメインを照合するため、
 * `notamazon.com`や`amazon.evil.com`のような非Amazonドメインでは`false`を返す。
 * @param {string} hostname URLのホスト名
 * @returns {boolean}
 */
function isAmazonHost(hostname) {
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
function resolveTargetUrl(tab) {
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

/**
 * 現在アクティブなタブを取得する。
 * @returns {Promise<chrome.tabs.Tab|undefined>}
 */
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  return tab;
}

// ツールバーアイコンのクリックで、現在のタブを正規化URLへ書き換える
chrome.action.onClicked.addListener(async (tabFromClick) => {
  try {
    const tab = tabFromClick?.id ? tabFromClick : await getCurrentTab();
    if (!tab || !tab.id) return;

    const target = resolveTargetUrl(tab);
    if (!target) return;

    await chrome.tabs.update(tab.id, {url: target});
  } catch {
    // UIを出さない仕様のため、エラーは握りつぶす（必要なら`console.error`に変更）
  }
});
