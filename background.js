function normalizeDpLink(asin) {
  const code = String(asin).trim().toUpperCase();
  return `https://www.amazon.co.jp/dp/${code}/`;
}

function findASINInURL(u) {
  const path = u.pathname;

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/gp\/offer-listing\/([A-Z0-9]{10})/i,
    /\/product-reviews\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
  ];

  for (const re of patterns) {
    const m = path.match(re);
    if (m && m[1]) return m[1].toUpperCase();
  }

  for (const key of ["asin", "ASIN"]) {
    const v = u.searchParams.get(key);
    if (v && /^[A-Z0-9]{10}$/i.test(v)) return v.toUpperCase();
  }

  const segs = path.split("/");
  for (const seg of segs) {
    if (/^[A-Z0-9]{10}$/i.test(seg)) return seg.toUpperCase();
  }

  return null;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  return tab;
}

chrome.action.onClicked.addListener(async (tabFromClick) => {
  try {
    const tab = tabFromClick?.id ? tabFromClick : await getCurrentTab();
    if (!tab || !tab.id) return;

    // `activeTab` が付与されていれば url が取れる想定
    const urlStr = tab.url;
    if (!urlStr) return;

    const u = new URL(urlStr);

    // Amazonドメインだけ対象（amazon.co.jp 以外でもASINが取れたら .co.jp に寄せる）
    if (!/amazon\./i.test(u.hostname)) return;

    const asin = findASINInURL(u);
    if (!asin) return;

    const target = normalizeDpLink(asin);
    if (target === urlStr) return;

    await chrome.tabs.update(tab.id, {url: target});
  } catch {
    // UI不要とのことなので握りつぶし（必要なら console.error に変更）
  }
});
