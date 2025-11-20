# Cyclocross Lap Time Converter - 開発者向けドキュメント

このドキュメントは、開発者および Claude のために技術的な詳細、アーキテクチャ、今後の開発方針を記載しています。

## プロジェクト概要

**目的**: シクロクロス公式リザルトページ（https://data.cyclocross.jp/）の機能を拡張し、ラップタイム分析を容易にするChrome拡張機能

**技術スタック**:

- Chrome Extension Manifest V3
- Vanilla JavaScript (フレームワークなし)
- Canvas 2D API（グラフ描画）
- CSS3（アニメーション、グリッドレイアウト）

**開発哲学**:

- **軽量**: 外部ライブラリに依存せず、高速で軽量な実装
- **ユーザーフレンドリー**: 最小限の操作で最大の価値を提供
- **保守性**: 読みやすく、拡張しやすいコード構造

## ファイル構成

```
cyclocross-extension/
├── manifest.json       # 拡張機能の設定ファイル（Manifest V3）
├── background.js       # バックグラウンドスクリプト（ON/OFF状態管理）
├── content.js          # メインロジック（~1200行）
└── styles.css          # スタイルシート（~650行）
```

## アーキテクチャ

### 1. データフロー

```
ページ読み込み
  ↓
DOM Ready（document_idle）
  ↓
テーブル検出（table__laptime）
  ↓
ラップタイム列検出（cell__lapat）
  ↓
データ形式判定（ラップタイム形式 or 経過時間形式）← NEW!
  ↓
データ変換（形式に応じた処理）
  ├─ 経過時間形式: 経過時間 → ネットラップ計算
  └─ ラップタイム形式: ラップタイム → 経過時間計算
  ↓
DOM更新 + グラフデータ保存
  ↓
ベストラップ検出 + ハイライト
  ↓
グラフUI追加（ボタン、チェックボックス）
```

### 2. 主要モジュール

#### 時間パース・フォーマット (content.js:12-102)

```javascript
parseTimeToMs(timeStr); // 時間文字列 → ミリ秒
formatMsToTime(ms, includeMs); // ミリ秒 → 時間文字列
```

**対応フォーマット**:

- `SS.d` (例: 45.2) - 1 分未満
- `MM:SS.d` (例: 9:28.1) - 標準フォーマット
- `HH:MM:SS.d` (例: 1:09:28.1) - 1 時間以上

#### テーブル検出 (content.js:104-196)

```javascript
detectLapTimeColumns(table); // ラップタイム列を自動検出
convertLapTimesInTable(table); // テーブル全体を変換
```

**検出ロジック**:

1. ヘッダー行から `cell__lapat` クラスを検出
2. 「1 周」「2 周」などのテキストで列インデックスを特定
3. 各選手の行をループしてデータを取得

#### データ形式判定 (content.js:228-285) ← NEW!

```javascript
detectDataFormat(table, lapColumnIndices); // 'laptime' or 'cumulative'
```

**判定ロジック**:

1. 1位の選手（最初の有効な行）のデータを取得
2. 最初の2つの有効なラップタイムを比較
3. 2周目のタイムが1周目の1.8倍未満 → **ラップタイム形式**
4. 2周目のタイムが1周目の1.8倍以上 → **経過時間形式**

**背景**:

一部の主催者レースでは、経過時間ではなく周回ごとのラップタイムが直接掲載されています（例: https://data.cyclocross.jp/race/24051）。このような場合、従来のロジックでは誤った変換が行われるため、データ形式を自動判定する機能を追加しました。

**例**:

- **経過時間形式**: 1周目=6:13.2 (373200ms), 2周目=12:28.2 (748200ms) → 748200 / 373200 = 約2.0倍 → 経過時間形式
- **ラップタイム形式**: 1周目=6:13.2 (373200ms), 2周目=6:15.0 (375000ms) → 375000 / 373200 = 約1.0倍 → ラップタイム形式

**処理の違い**:

- **ラップタイム形式の場合**:
  - 元データ: 各周のラップタイム（例: 6:13.2, 6:15.0, 6:18.6）
  - 変換後の表示: 経過時間（例: 6:13.2, 12:28.2, 18:46.8）
  - ベストラップ検出: 元データ（ラップタイム）を使用

- **経過時間形式の場合**（従来通り）:
  - 元データ: 経過時間（例: 6:13.2, 12:28.2, 18:46.8）
  - 変換後の表示: ネットラップタイム（例: 6:13.2, 6:15.0, 6:18.6）
  - ベストラップ検出: 計算したラップタイムを使用

#### スタートループ検出

```javascript
detectStartLoop(lapTimes, startLoopIndex);
```

**ロジック**:

- 1 周目が 2 周目の 60%未満の場合、スタートループと判定
- ベストラップ計算から除外

#### ベストラップ検出 (content.js:533-667)

```javascript
highlightBestLapsInTable(table);
```

**処理**:

1. 全選手のラップタイムを収集
2. 選手ごとの最速ラップを検出（`.rider-best-lap`）
3. レース全体の最速ラップを検出（`.overall-best-lap`）
4. CSS クラスを追加してハイライト表示

#### グラフ機能 (content.js:682-1203)

**データ構造**:

```javascript
graphDataMap = new Map();
// key: table要素
// value: {
//   riders: [
//     { name, rank, lapTimes: [ms...], row: element },
//     ...
//   ],
//   startLoopIndex: number
// }
```

**Canvas 描画** (content.js:682-864):

```javascript
drawLineGraph(canvas, riders, options);
```

- グリッド、軸、凡例を描画
- 10 色のカラーパレット
- skipFirstLap オプションで 1 周目の表示/非表示を切り替え

**UI components** (content.js:866-1203):

- `createGraphContainer()`: グラフコンテナ生成
- `updateGraph()`: グラフ更新
- `addRiderCheckboxes()`: 選手選択チェックボックス追加
- `createScrollToGraphButton()`: グラフ移動ボタン（上部）
- `createGraphToggleButton()`: 表示/非表示ボタン（下部）
- `addGraphButton()`: グラフ UI 全体の統合

### 3. ON/OFF 切り替え (background.js + content.js)

**background.js**:

```javascript
chrome.action.onClicked.addListener(); // アイコンクリック検出
chrome.storage.local; // 状態を保存
chrome.tabs.sendMessage(); // コンテンツスクリプトに通知
```

**content.js**:

```javascript
chrome.runtime.onMessage.addListener(); // メッセージ受信
revertAllConversions(); // 変換を元に戻す
```

## 技術的な決定事項

### なぜ Chart.js を使わなかったか？

**決定**: 自作 Canvas 実装

**理由**:

1. **軽量性**: Chart.js (~200KB) vs 自作 (~5KB)
2. **カスタマイズ性**: 完全なコントロール
3. **依存関係の削減**: バージョン管理の負担軽減
4. **学習目的**: Canvas API の習得

**トレードオフ**:

- ✅ 高速、軽量
- ✅ 完全カスタマイズ可能
- ❌ 高度な機能は自前実装が必要
- ❌ メンテナンスコストがやや高い

### CSS 設計

**方針**:

- BEM 風の命名規則（`.lap-graph-container`, `.lap-graph-controls`）
- `!important` の使用は最小限（サイト側 CSS との競合時のみ）
- ダークモード対応（`@media (prefers-color-scheme: dark)`）
- レスポンシブ対応（`@media (max-width: 768px)`）

### パフォーマンス最適化

1. **遅延実行**: グラフは選手選択時に初めて描画
2. **キャッシュ**: `graphDataMap` で変換結果を保存
3. **DOM 操作の最小化**: 一括更新を優先
4. **イベントリスナーの最適化**: 必要な要素にのみ設定

## 開発ガイド

### ローカル開発環境のセットアップ

1. リポジトリをクローン:

   ```bash
   git clone https://github.com/gentksb/ajocc-tools.git
   cd ajocc-tools
   ```

2. Chrome 拡張機能として読み込み:

   - `chrome://extensions/` を開く
   - デベロッパーモードを ON
   - 「パッケージ化されていない拡張機能を読み込む」
   - `cyclocross-extension` フォルダを選択

3. コード変更後:
   - `chrome://extensions/` で「再読み込み」ボタンをクリック
   - ページをリロード（Ctrl+R）

### デバッグ方法

**コンソールログ**:

```javascript
console.log("Cyclocross Lap Time Converter: メッセージ");
```

**開発者ツール**:

- F12 → Console タブでログ確認
- Elements タブで DOM ツリー確認
- Network タブでリソース読み込み確認

**テストページ**:

- https://data.cyclocross.jp/race/24830
- https://data.cyclocross.jp/race/（他のレース）

### コーディング規約

**JavaScript**:

- インデント: 2 スペース
- 関数名: camelCase
- コメント: 日本語 OK
- グローバル変数: 最小限（`isEnabled`, `graphDataMap`のみ）

**CSS**:

- インデント: 2 スペース
- クラス名: kebab-case
- コメントで機能ごとにセクション分け

### Git Workflow

**ブランチ戦略**:

- `main`: 安定版
- `claude/*`: Claude 作業用ブランチ
- 機能ごとにブランチを作成（推奨）

**コミットメッセージ**:

```
<type>: <subject>

<body>
```

例:

```
Fix checkbox and rider name inline display

根本的な修正:
- チェックボックスに display: inline-block !important を設定
- a要素に display: inline を設定
```

## 今後の拡張計画

### 優先度: 中

#### CSV エクスポート機能

**機能概要**:

- 変換後のネットラップタイムを CSV 形式でダウンロード
- エクスポートボタンをテーブル上部に配置
- ファイル名: `YYYYMMDD_カテゴリ_laptimes.csv`

**技術仕様**:

```javascript
function exportToCSV(table) {
  const rows = [];
  rows.push(['順位', '選手名', '1周', '2周', '3周', ...]);

  // データ収集
  ...

  const csv = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  // ダウンロード
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
}
```

**実装ファイル**:

- `content.js` (修正): CSV 生成とダウンロードロジック
- `styles.css` (修正): エクスポートボタンのスタイル

### 優先度: 低

#### より高度なラップ比較機能

**現状**: グラフ機能で複数選手の選択と可視化が可能

**追加機能案**:

- ラップごとの差分を数値で表示
- 差分をヒートマップで視覚化
- 「どの周で差がついたか」を分析

**技術仕様**:

- 選択した 2 名以上の選手のラップタイムを比較
- 差分計算: `rider1.lapTimes[i] - rider2.lapTimes[i]`
- 色分け表示: プラス（遅い）= 赤、マイナス（速い）= 青

## トラブルシューティング

### よくある問題

**問題**: チェックボックスとライダー名が縦に並ぶ

**原因**: サイト側の CSS で`a`要素が`display: block`になっている

**解決策**:

- チェックボックス: `display: inline-block !important`
- a 要素: `display: inline !important`
- インラインスタイルで確実に上書き

**問題**: グラフが描画されない

**原因**: Canvas のサイズが未設定

**解決策**:

```javascript
canvas.width = 800;
canvas.height = 400;
```

**問題**: ベストラップが正しく検出されない

**原因**: スタートループの影響

**解決策**:

```javascript
// スタートループを検出して除外
const lapsToCheck =
  startLoopIndex !== -1
    ? lapTimes.slice(startLoopIndex + 1)
    : lapTimes.slice(1);
```

## パフォーマンス測定

### ベンチマーク（100 名の選手）

- テーブル変換: ~50ms
- ベストラップ検出: ~30ms
- グラフ描画: ~20ms（1 選手あたり）
- 合計: ~100ms（快適に動作）

### 最適化の余地

- [ ] Web Workers での並列処理
- [ ] Virtual Scrolling（選手数が非常に多い場合）
- [ ] Canvas のオフスクリーン描画

## セキュリティ考慮事項

1. **XSS 対策**: `innerHTML` の使用は最小限、`textContent` を優先
2. **CSP 準拠**: Manifest V3 の Content Security Policy に準拠
3. **パーミッション最小化**: 必要なパーミッションのみ要求

**現在のパーミッション**:

- `storage`: ON/OFF 状態の保存
- `host_permissions`: `https://data.cyclocross.jp/*` のみ

## リリースプロセス

1. **バージョン更新**: `manifest.json` の `version` フィールド
2. **変更ログ**: コミットメッセージを確認
3. **テスト**: 複数のリザルトページで動作確認
4. **タグ付け**: `git tag v1.x.x`
5. **プッシュ**: `git push origin master --tags`

## コントリビューション

**歓迎する貢献**:

- バグ修正
- 新機能の実装
- ドキュメントの改善
- テストの追加

**プルリクエストのガイドライン**:

1. 機能ごとにブランチを作成
2. コミットメッセージは明確に
3. 既存のコーディング規約に従う
4. 動作確認済みであることを確認

## 参考リンク

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [CSS Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries)

## ライセンス

MIT License - 詳細は [LICENSE](./LICENSE) を参照

## 作者

[gentksb](https://github.com/gentksb)

## 最終更新日

2025-01-19
