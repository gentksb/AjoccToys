/**
 * Background Service Worker
 * ON/OFF状態の管理とアイコンクリック処理
 */

// デフォルト設定
const DEFAULT_SETTINGS = {
  enabled: true, // デフォルトでON
};

// 拡張機能インストール時の初期化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Cyclocross Lap Time Converter がインストールされました');

  // デフォルト設定を保存
  const result = await chrome.storage.local.get(['settings']);
  if (!result.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    console.log('デフォルト設定を保存しました:', DEFAULT_SETTINGS);
  }

  // アイコンの状態を更新
  await updateIcon(DEFAULT_SETTINGS.enabled);
});

// アイコンクリック時の処理
chrome.action.onClicked.addListener(async (tab) => {
  console.log('アイコンがクリックされました。タブID:', tab.id);

  try {
    // 現在の設定を取得
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || DEFAULT_SETTINGS;

    // ON/OFF を切り替え
    const newEnabled = !settings.enabled;
    settings.enabled = newEnabled;

    // 新しい設定を保存
    await chrome.storage.local.set({ settings });
    console.log('設定を更新しました:', settings);

    // アイコンの状態を更新
    await updateIcon(newEnabled);

    // 現在のタブがリザルトページかチェック
    if (tab.url && tab.url.includes('data.cyclocross.jp/race/')) {
      // Content scriptにメッセージを送信
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleConversion',
          enabled: newEnabled
        });
        console.log('Content scriptにメッセージを送信しました:', newEnabled);
      } catch (error) {
        console.log('Content scriptへのメッセージ送信に失敗（ページをリロードしてください）:', error.message);

        // ページをリロード
        await chrome.tabs.reload(tab.id);
      }
    } else {
      console.log('現在のタブはリザルトページではありません。設定のみ保存しました。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
});

// アイコンの状態を更新
async function updateIcon(enabled) {
  try {
    // タイトルを更新
    const title = enabled
      ? 'Cyclocross Lap Time Converter - ON (クリックでOFF)'
      : 'Cyclocross Lap Time Converter - OFF (クリックでON)';

    await chrome.action.setTitle({ title });

    // バッジを設定（ON/OFF表示）
    await chrome.action.setBadgeText({
      text: enabled ? 'ON' : 'OFF'
    });

    // バッジの色を設定
    await chrome.action.setBadgeBackgroundColor({
      color: enabled ? '#4CAF50' : '#9E9E9E'
    });

    console.log('アイコンを更新しました:', enabled ? 'ON' : 'OFF');
  } catch (error) {
    console.error('アイコンの更新に失敗しました:', error);
  }
}

// 初回起動時にアイコンを更新
chrome.storage.local.get(['settings'], (result) => {
  const settings = result.settings || DEFAULT_SETTINGS;
  updateIcon(settings.enabled);
});

// ストレージの変更を監視（他のタブでの変更を反映）
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue;
    if (newSettings) {
      updateIcon(newSettings.enabled);
      console.log('設定が変更されました:', newSettings);
    }
  }
});
