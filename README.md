# amazonUrlSimpleConverter

開いているAmazonタブのURLを`https://www.amazon.co.jp/dp/ASIN/`形式へ正規化するChrome拡張機能（Manifest V3）です。

トラッキングパラメータや商品名で長くなったAmazonのURLを、ツールバーアイコンのワンクリックで最小限のクリーンなURLに書き換えます。

## 特徴

- 商品ページのURLを`https://www.amazon.co.jp/dp/<ASIN>/`に正規化
- ポップアップなし。ツールバーアイコンをクリックするだけで現在のタブを書き換え
- 余計な権限を要求しない（`activeTab`のみ）
- 多様なAmazonのURL形式からASINを抽出（後述）

## インストール（パッケージ化されていない拡張機能の読み込み）

1. このリポジトリをクローン、またはダウンロードして展開する
2. Chromeで`chrome://extensions`を開く
3. 右上の「デベロッパーモード」をオンにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリックする
5. このリポジトリのフォルダを選択する

## 使い方

1. Amazonの商品ページ（または商品レビュー・出品者一覧など、ASINを含むページ）を開く
2. ツールバーのアイコンをクリックする
3. 現在のタブが`https://www.amazon.co.jp/dp/<ASIN>/`に書き換わる

ASINが見つからないページや、すでに正規化済みのURLでは何も起こりません（UIは表示しません）。

## 対応URLパターン

次のいずれかからASIN（10桁の英数字）を抽出します。

- パス内のパターン
  - `/dp/<ASIN>`
  - `/gp/product/<ASIN>`
  - `/gp/aw/d/<ASIN>`
  - `/gp/offer-listing/<ASIN>`
  - `/product-reviews/<ASIN>`
  - `/ASIN/<ASIN>`
- クエリパラメータ`asin`または`ASIN`
- 上記で取れない場合、パスセグメントに含まれる10桁コードのフォールバック走査

## 仕様・制限事項

- 抽出元のドメインに関わらず、遷移先は常に`amazon.co.jp`になります（例: `amazon.com`のページでもASINが取れれば`amazon.co.jp`へ寄せます）。
- Amazon以外のドメインでは動作しません。
- エラー時やASIN未検出時は通知を出さず、何もしません。

## 構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能の定義（Manifest V3、`activeTab`権限、Service Worker登録） |
| `background.js` | アイコンクリック時にURLを正規化するService Worker |

## 権限

- `activeTab`: クリックした時点でアクティブなタブのURLを取得し、書き換えるために使用します。常時すべてのタブを監視するわけではありません。
