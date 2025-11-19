# Cyclocross Lap Time Converter - 開発者向けドキュメント

このドキュメントは、開発者およびClaudeのために技術的な詳細、アーキテクチャ、今後の開発方針を記載しています。

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
経過時間パース → ネットラップ計算
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
parseTimeToMs(timeStr)  // 時間文字列 → ミリ秒
formatMsToTime(ms, includeMs)  // ミリ秒 → 時間文字列
```

**対応フォーマット**:
- `SS.d` (例: 45.2) - 1分未満
- `MM:SS.d` (例: 9:28.1) - 標準フォーマット
- `HH:MM:SS.d` (例: 1:09:28.1) - 1時間以上

#### テーブル検出 (content.js:104-196)
```javascript
detectLapTimeColumns(table)  // ラップタイム列を自動検出
convertLapTimesInTable(table)  // テーブル全体を変換
```

**検出ロジック**:
1. ヘッダー行から `cell__lapat` クラスを検出
2. 「1周」「2周」などのテキストで列インデックスを特定
3. 各選手の行をループして経過時間を取得

#### スタートループ検出 (content.js:198-256)
```javascript
detectStartLoop(lapTimes, startLoopIndex)
```

**ロジック**:
- 1周目が2周目の60%未満の場合、スタートループと判定
- ベストラップ計算から除外

#### ベストラップ検出 (content.js:533-667)
```javascript
highlightBestLapsInTable(table)
```

**処理**:
1. 全選手のラップタイムを収集
2. 選手ごとの最速ラップを検出（`.rider-best-lap`）
3. レース全体の最速ラップを検出（`.overall-best-lap`）
4. CSSクラスを追加してハイライト表示

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

**Canvas描画** (content.js:682-864):
```javascript
drawLineGraph(canvas, riders, options)
```
- グリッド、軸、凡例を描画
- 10色のカラーパレット
- skipFirstLapオプションで1周目の表示/非表示を切り替え

**UI components** (content.js:866-1203):
- `createGraphContainer()`: グラフコンテナ生成
- `updateGraph()`: グラフ更新
- `addRiderCheckboxes()`: 選手選択チェックボックス追加
- `createScrollToGraphButton()`: グラフ移動ボタン（上部）
- `createGraphToggleButton()`: 表示/非表示ボタン（下部）
- `addGraphButton()`: グラフUI全体の統合

### 3. ON/OFF切り替え (background.js + content.js)

**background.js**:
```javascript
chrome.action.onClicked.addListener()  // アイコンクリック検出
chrome.storage.local  // 状態を保存
chrome.tabs.sendMessage()  // コンテンツスクリプトに通知
```

**content.js**:
```javascript
chrome.runtime.onMessage.addListener()  // メッセージ受信
revertAllConversions()  // 変換を元に戻す
```

## 技術的な決定事項

### なぜChart.jsを使わなかったか？

**決定**: 自作Canvas実装

**理由**:
1. **軽量性**: Chart.js (~200KB) vs 自作 (~5KB)
2. **カスタマイズ性**: 完全なコントロール
3. **依存関係の削減**: バージョン管理の負担軽減
4. **学習目的**: Canvas APIの習得

**トレードオフ**:
- ✅ 高速、軽量
- ✅ 完全カスタマイズ可能
- ❌ 高度な機能は自前実装が必要
- ❌ メンテナンスコストがやや高い

### CSS設計

**方針**:
- BEM風の命名規則（`.lap-graph-container`, `.lap-graph-controls`）
- `!important` の使用は最小限（サイト側CSSとの競合時のみ）
- ダークモード対応（`@media (prefers-color-scheme: dark)`）
- レスポンシブ対応（`@media (max-width: 768px)`）

### パフォーマンス最適化

1. **遅延実行**: グラフは選手選択時に初めて描画
2. **キャッシュ**: `graphDataMap` で変換結果を保存
3. **DOM操作の最小化**: 一括更新を優先
4. **イベントリスナーの最適化**: 必要な要素にのみ設定

## 開発ガイド

### ローカル開発環境のセットアップ

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/gentksb/ajocc-tools.git
   cd ajocc-tools
   ```

2. Chrome拡張機能として読み込み:
   - `chrome://extensions/` を開く
   - デベロッパーモードをON
   - 「パッケージ化されていない拡張機能を読み込む」
   - `cyclocross-extension` フォルダを選択

3. コード変更後:
   - `chrome://extensions/` で「再読み込み」ボタンをクリック
   - ページをリロード（Ctrl+R）

### デバッグ方法

**コンソールログ**:
```javascript
console.log('Cyclocross Lap Time Converter: メッセージ');
```

**開発者ツール**:
- F12 → Console タブでログ確認
- Elements タブでDOMツリー確認
- Network タブでリソース読み込み確認

**テストページ**:
- https://data.cyclocross.jp/race/24830
- https://data.cyclocross.jp/race/（他のレース）

### コーディング規約

**JavaScript**:
- インデント: 2スペース
- 関数名: camelCase
- コメント: 日本語OK
- グローバル変数: 最小限（`isEnabled`, `graphDataMap`のみ）

**CSS**:
- インデント: 2スペース
- クラス名: kebab-case
- コメントで機能ごとにセクション分け

### Git Workflow

**ブランチ戦略**:
- `main`: 安定版
- `claude/*`: Claude作業用ブランチ
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

#### CSVエクスポート機能

**機能概要**:
- 変換後のネットラップタイムをCSV形式でダウンロード
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
- `content.js` (修正): CSV生成とダウンロードロジック
- `styles.css` (修正): エクスポートボタンのスタイル

### 優先度: 低

#### より高度なラップ比較機能

**現状**: グラフ機能で複数選手の選択と可視化が可能

**追加機能案**:
- ラップごとの差分を数値で表示
- 差分をヒートマップで視覚化
- 「どの周で差がついたか」を分析

**技術仕様**:
- 選択した2名以上の選手のラップタイムを比較
- 差分計算: `rider1.lapTimes[i] - rider2.lapTimes[i]`
- 色分け表示: プラス（遅い）= 赤、マイナス（速い）= 青

## トラブルシューティング

### よくある問題

**問題**: チェックボックスとライダー名が縦に並ぶ

**原因**: サイト側のCSSで`a`要素が`display: block`になっている

**解決策**:
- チェックボックス: `display: inline-block !important`
- a要素: `display: inline !important`
- インラインスタイルで確実に上書き

**問題**: グラフが描画されない

**原因**: Canvasのサイズが未設定

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
const lapsToCheck = startLoopIndex !== -1
  ? lapTimes.slice(startLoopIndex + 1)
  : lapTimes.slice(1);
```

## パフォーマンス測定

### ベンチマーク（100名の選手）

- テーブル変換: ~50ms
- ベストラップ検出: ~30ms
- グラフ描画: ~20ms（1選手あたり）
- 合計: ~100ms（快適に動作）

### 最適化の余地

- [ ] Web Workers での並列処理
- [ ] Virtual Scrolling（選手数が非常に多い場合）
- [ ] Canvasのオフスクリーン描画

## セキュリティ考慮事項

1. **XSS対策**: `innerHTML` の使用は最小限、`textContent` を優先
2. **CSP準拠**: Manifest V3のContent Security Policyに準拠
3. **パーミッション最小化**: 必要なパーミッションのみ要求

**現在のパーミッション**:
- `storage`: ON/OFF状態の保存
- `host_permissions`: `https://data.cyclocross.jp/*` のみ

## リリースプロセス

1. **バージョン更新**: `manifest.json` の `version` フィールド
2. **変更ログ**: コミットメッセージを確認
3. **テスト**: 複数のリザルトページで動作確認
4. **タグ付け**: `git tag v1.x.x`
5. **プッシュ**: `git push origin main --tags`

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
- [シクロクロス公式サイト](https://data.cyclocross.jp/)

## ライセンス

MIT License - 詳細は [LICENSE](./LICENSE) を参照

## 作者

[gentksb](https://github.com/gentksb)

## 最終更新日

2025-01-19
