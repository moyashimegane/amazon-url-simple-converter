# amazonUrlSimpleConverter

開いているAmazonタブのURLを`/dp/<ASIN>/`形式へ正規化するChrome拡張機能（Manifest V3）です。

トラッキングパラメータや商品名で長くなったAmazonのURLを、ツールバーアイコンのワンクリックで最小限のクリーンなURLに書き換えます。

## 特徴

- 商品ページのURLを`https://<閲覧中のAmazonドメイン>/dp/<ASIN>/`に正規化
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
3. 現在のタブが`https://<閲覧中のAmazonドメイン>/dp/<ASIN>/`に書き換わる

ASINが見つからないページや、すでに正規化済みのURLでは何も起こりません（UIは表示しません）。

## 対応URLパターン

次のいずれかからASINを抽出します。ASINとして扱うのは`B`で始まる10文字、または書籍のISBN-10（数字9桁＋`0`-`9`か`X`）の2系統です。

- パス内のパターン
  - `/dp/<ASIN>`
  - `/gp/product/<ASIN>`
  - `/gp/aw/d/<ASIN>`
  - `/gp/offer-listing/<ASIN>`
  - `/product-reviews/<ASIN>`
  - `/ASIN/<ASIN>`
- クエリパラメータ`asin`または`ASIN`

任意のパスセグメントから10桁コードを探すフォールバック走査は行いません。ストアページIDやURLスラッグを商品IDと誤認するためです。

## 仕様・制限事項

- 遷移先は元URLのドメインを維持します（例: `amazon.com`のページなら`amazon.com`のまま`/dp/`へ短縮します）。同じASINでも国ごとに取扱の有無・価格・配送条件が異なるためです。
- `www.amazon.<tld>`以外のサブドメイン（`music.amazon.co.jp`、`read.amazon.co.jp`など）では動作しません。
- Amazon以外のドメインでは動作しません。
- すでに`/dp/<ASIN>`形式のURLでは何もしません。Amazonが自動で付与する`th`・`psc`のクエリは、この判定では無視します。
- エラー時やASIN未検出時は通知を出さず、何もしません。

## 構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能の定義（Manifest V3、`activeTab`権限、Service Worker登録） |
| `background.js` | アイコンクリックと`chrome.*`のAPIを繋ぐService Worker |
| `lib/asin.js` | ASINの抽出とURL正規化のロジック（`chrome.*`に非依存） |
| `test/asin.test.js` | `lib/asin.js`のユニットテスト（`npm test`で実行） |

## 権限

- `activeTab`: クリックした時点でアクティブなタブのURLを取得し、書き換えるために使用します。常時すべてのタブを監視するわけではありません。

## ライセンス

[MIT License](LICENSE)で公開しています。
