/**
 * amazonUrlSimpleConverter
 *
 * 開いているAmazonタブのURLを`https://www.amazon.co.jp/dp/ASIN/`形式へ正規化する
 * Service Worker。ツールバーアイコンのクリックを起点に動作する。
 *
 * URLの解析・正規化ロジックは`lib/asin.js`にある。このファイルは
 * `chrome.*`のAPIとの接続だけを担当する。
 */

import {resolveTargetUrl} from "./lib/asin.js";

// ツールバーアイコンのクリックで、現在のタブを正規化URLへ書き換える。
// `chrome.action.onClicked`は常に対象タブを渡すため、タブの再取得は行わない。
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || !tab.id) return;

    const target = resolveTargetUrl(tab);
    if (!target) return;

    await chrome.tabs.update(tab.id, {url: target});
  } catch {
    // UIを出さない仕様のため、エラーは握りつぶす（必要なら`console.error`に変更）
  }
});
