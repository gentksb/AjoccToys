/**
 * Cyclocross Lap Time Converter
 * 経過時間をネットラップタイムに変換するChrome拡張機能
 */

// 時間文字列をミリ秒に変換
function parseTimeToMs(timeStr) {
  if (!timeStr || timeStr.trim() === '' || timeStr === '-') {
    return null;
  }

  const trimmed = timeStr.trim();

  // 各種時間フォーマットに対応
  const patterns = [
    // HH:MM:SS.d (小数点第1位)
    { regex: /^(\d+):(\d{2}):(\d{2})\.(\d)$/, type: 'HMS_D1' },
    // HH:MM:SS.dd (小数点第2位)
    { regex: /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/, type: 'HMS_D2' },
    // HH:MM:SS.ddd (小数点第3位、ミリ秒)
    { regex: /^(\d+):(\d{2}):(\d{2})\.(\d{3})$/, type: 'HMS_D3' },
    // HH:MM:SS
    { regex: /^(\d+):(\d{2}):(\d{2})$/, type: 'HMS' },
    // MM:SS.d (小数点第1位) ← これが実際のページで使われている
    { regex: /^(\d+):(\d{2})\.(\d)$/, type: 'MS_D1' },
    // MM:SS.dd (小数点第2位)
    { regex: /^(\d+):(\d{2})\.(\d{2})$/, type: 'MS_D2' },
    // MM:SS.ddd (小数点第3位、ミリ秒)
    { regex: /^(\d+):(\d{2})\.(\d{3})$/, type: 'MS_D3' },
    // MM:SS
    { regex: /^(\d+):(\d{2})$/, type: 'MS' },
  ];

  for (const { regex, type } of patterns) {
    const match = trimmed.match(regex);
    if (match) {
      switch (type) {
        case 'HMS_D1': {
          // HH:MM:SS.d → 1/10秒 = 100ms
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          const deciseconds = parseInt(match[4], 10);
          return (hours * 3600 + minutes * 60 + seconds) * 1000 + deciseconds * 100;
        }
        case 'HMS_D2': {
          // HH:MM:SS.dd → 1/100秒 = 10ms
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          const centiseconds = parseInt(match[4], 10);
          return (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
        }
        case 'HMS_D3': {
          // HH:MM:SS.ddd → ミリ秒
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          const ms = parseInt(match[4], 10);
          return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
        }
        case 'HMS': {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          return (hours * 3600 + minutes * 60 + seconds) * 1000;
        }
        case 'MS_D1': {
          // MM:SS.d → 1/10秒 = 100ms ← 実際のページで使用
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const deciseconds = parseInt(match[3], 10);
          return (minutes * 60 + seconds) * 1000 + deciseconds * 100;
        }
        case 'MS_D2': {
          // MM:SS.dd → 1/100秒 = 10ms
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const centiseconds = parseInt(match[3], 10);
          return (minutes * 60 + seconds) * 1000 + centiseconds * 10;
        }
        case 'MS_D3': {
          // MM:SS.ddd → ミリ秒
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const ms = parseInt(match[3], 10);
          return (minutes * 60 + seconds) * 1000 + ms;
        }
        case 'MS': {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          return (minutes * 60 + seconds) * 1000;
        }
      }
    }
  }

  return null;
}

// ミリ秒を時間文字列に変換
function formatMsToTime(ms, includeDecimal = true) {
  if (ms === null || ms === undefined || ms < 0) {
    return '-';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const deciseconds = Math.floor((ms % 1000) / 100); // 小数点第1位
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = '';
  if (hours > 0) {
    result = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    result = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  if (includeDecimal) {
    result += `.${deciseconds}`;
  }

  return result;
}

// ラップタイムテーブルかどうかを判定
function isLapTimeTable(table) {
  // クラス名で判定
  if (table.classList.contains('table__laptime')) {
    return true;
  }

  // ヘッダーに「周」を含むかで判定
  const headers = table.querySelectorAll('th');
  for (const header of headers) {
    if (/\d+周/.test(header.textContent)) {
      return true;
    }
  }

  return false;
}

// ラップタイム列のインデックスを取得
function getLapTimeColumnIndices(table) {
  const headerRow = table.querySelector('thead tr');
  if (!headerRow) {
    console.log('ヘッダー行が見つかりません');
    return [];
  }

  const headers = Array.from(headerRow.querySelectorAll('th'));
  const lapColumnIndices = [];

  headers.forEach((header, index) => {
    // cell__lapat クラスを持つか、「周」を含むヘッダーを探す
    if (header.classList.contains('cell__lapat') || /\d+周/.test(header.textContent)) {
      lapColumnIndices.push(index);
    }
  });

  console.log(`ラップタイム列を検出: ${lapColumnIndices.length}列 (インデックス: ${lapColumnIndices.join(', ')})`);
  return lapColumnIndices;
}

// テーブルのラップタイムを変換
function convertLapTimesInTable(table) {
  if (!isLapTimeTable(table)) {
    return false;
  }

  console.log('ラップタイムテーブルを発見しました');

  const lapColumnIndices = getLapTimeColumnIndices(table);
  if (lapColumnIndices.length === 0) {
    console.log('ラップタイム列が見つかりませんでした');
    return false;
  }

  const tbody = table.querySelector('tbody');
  if (!tbody) {
    console.log('tbody要素が見つかりません');
    return false;
  }

  const rows = Array.from(tbody.querySelectorAll('tr'));
  let convertedCount = 0;

  console.log(`  tbody内の行数: ${rows.length}`);

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td'));

    // DNS行などはスキップ
    const rankCell = cells[0];
    if (!rankCell || rankCell.textContent.trim() === 'DNS') {
      console.log(`  行${rowIndex + 1}: DNS行のためスキップ`);
      return;
    }

    // 各行のラップタイムデータを収集
    const lapData = [];
    let hasValidData = false;

    lapColumnIndices.forEach(colIndex => {
      if (colIndex < cells.length) {
        const cell = cells[colIndex];
        // div.text-right 要素を探す
        const textDiv = cell.querySelector('div.text-right, div');
        const timeStr = textDiv ? textDiv.textContent.trim() : cell.textContent.trim();
        const ms = parseTimeToMs(timeStr);

        // 最初の数行だけデバッグログを出力
        if (rowIndex < 3) {
          console.log(`  行${rowIndex + 1}, 列${colIndex}: timeStr="${timeStr}", ms=${ms}, textDiv=${!!textDiv}`);
        }

        lapData.push({
          cell: cell,
          textDiv: textDiv,
          ms: ms,
          original: timeStr
        });

        if (ms !== null) {
          hasValidData = true;
        }
      }
    });

    if (!hasValidData) {
      console.log(`  行${rowIndex + 1}: 有効なデータがないためスキップ`);
      return;
    }

    // 経過時間からネットラップタイムに変換
    let prevMs = 0;
    lapData.forEach(({ cell, textDiv, ms, original }, lapIndex) => {
      if (ms !== null && ms > 0) {
        const netLapTime = ms - prevMs;

        if (netLapTime < 0) {
          console.warn(`警告: 行${rowIndex + 1}で負のラップタイムが検出されました (${netLapTime}ms)`);
          prevMs = ms;
          return;
        }

        // 元の形式に小数点が含まれているかチェック
        const includeDecimal = original.includes('.');
        const newTimeStr = formatMsToTime(netLapTime, includeDecimal);

        // 最初の数行だけデバッグログを出力
        if (rowIndex < 3) {
          console.log(`  行${rowIndex + 1}, ラップ${lapIndex + 1}: original="${original}", netLapTime=${netLapTime}ms, newTimeStr="${newTimeStr}"`);
        }

        // セルの内容を更新
        if (original !== '' && original !== '-') {
          const targetElement = textDiv || cell;

          // 元の値をdata属性に保存
          cell.setAttribute('data-original-time', original);
          cell.setAttribute('data-converted', 'true');

          // テキストを更新
          targetElement.textContent = newTimeStr;

          // クラスを追加
          cell.classList.add('converted-lap-time');

          convertedCount++;

          if (rowIndex < 3) {
            console.log(`  → 変換成功: convertedCount=${convertedCount}`);
          }
        } else {
          if (rowIndex < 3) {
            console.log(`  → スキップ: original="${original}"`);
          }
        }

        prevMs = ms;
      }
    });
  });

  if (convertedCount > 0) {
    console.log(`${convertedCount}個のラップタイムを変換しました`);
    table.classList.add('lap-time-converted-table');
    return true;
  }

  return false;
}

// 通知バナーを表示
function showNotification(message, type = 'success') {
  // 既存のバナーがあれば削除
  const existingBanner = document.getElementById('lap-time-converter-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  const banner = document.createElement('div');
  banner.id = 'lap-time-converter-banner';
  banner.className = `lap-time-converter-banner banner-${type}`;
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">⏱️</span>
      <span class="banner-text">${message}</span>
      <button class="banner-close" aria-label="閉じる">×</button>
    </div>
  `;

  // 閉じるボタンのイベント
  const closeButton = banner.querySelector('.banner-close');
  closeButton.addEventListener('click', () => {
    banner.classList.add('fade-out');
    setTimeout(() => banner.remove(), 300);
  });

  document.body.insertBefore(banner, document.body.firstChild);

  // 5秒後に自動的に閉じる
  setTimeout(() => {
    if (banner.parentElement) {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 300);
    }
  }, 5000);
}

// メイン処理
function main() {
  console.log('=== Cyclocross Lap Time Converter ===');
  console.log('拡張機能が起動しました');
  console.log('ページURL:', window.location.href);

  // ラップタイムテーブルを探して処理
  const tables = document.querySelectorAll('table');
  console.log(`ページ内のテーブル数: ${tables.length}`);

  let totalConverted = false;

  tables.forEach((table, index) => {
    console.log(`\nテーブル ${index + 1}/${tables.length} を処理中...`);

    // クラス名をログ出力
    if (table.className) {
      console.log(`  クラス名: ${table.className}`);
    }

    const converted = convertLapTimesInTable(table);
    if (converted) {
      totalConverted = true;
      console.log(`  ✓ テーブル ${index + 1} の変換に成功しました`);
    } else {
      console.log(`  - テーブル ${index + 1} はスキップされました`);
    }
  });

  // 結果を通知
  if (totalConverted) {
    showNotification('ラップタイムを経過時間からネットラップタイムに変換しました', 'success');
    console.log('\n✓ 変換が完了しました');
  } else {
    console.log('\n変換可能なラップタイムテーブルが見つかりませんでした');
  }

  console.log('=====================================\n');
}

// グローバル変数: ON/OFF状態
let isEnabled = true;

// 変換を元に戻す関数
function revertConversion() {
  console.log('=== 変換を元に戻します ===');

  // 変換済みのセルを元に戻す
  const convertedCells = document.querySelectorAll('[data-converted="true"]');
  let revertedCount = 0;

  convertedCells.forEach(cell => {
    const originalTime = cell.getAttribute('data-original-time');
    if (originalTime) {
      // div.text-right 要素を探す
      const textDiv = cell.querySelector('div.text-right, div');
      const targetElement = textDiv || cell;

      // 元の値に戻す
      targetElement.textContent = originalTime;

      // クラスと属性を削除
      cell.classList.remove('converted-lap-time');
      cell.removeAttribute('data-original-time');
      cell.removeAttribute('data-converted');

      revertedCount++;
    }
  });

  // 変換済みテーブルのマーキングを削除
  const convertedTables = document.querySelectorAll('.lap-time-converted-table');
  convertedTables.forEach(table => {
    table.classList.remove('lap-time-converted-table');
  });

  // 通知バナーを削除
  const banner = document.getElementById('lap-time-converter-banner');
  if (banner) {
    banner.remove();
  }

  console.log(`${revertedCount}個のセルを元に戻しました`);
  console.log('=====================================\n');

  // OFF通知を表示
  showNotification('ラップタイム変換をOFFにしました', 'info');
}

// 初期化
async function initialize() {
  try {
    // ストレージから設定を取得
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || { enabled: true };
    isEnabled = settings.enabled;

    console.log('設定を読み込みました。変換:', isEnabled ? 'ON' : 'OFF');

    if (!isEnabled) {
      console.log('変換がOFFのため、処理をスキップします');
      return;
    }

    // ページの読み込み状態に応じて実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', main);
    } else {
      // すでに読み込まれている場合は少し遅延させて実行
      setTimeout(main, 100);
    }
  } catch (error) {
    console.error('設定の読み込みに失敗しました:', error);
    // エラーが発生してもデフォルトで実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', main);
    } else {
      setTimeout(main, 100);
    }
  }
}

// 拡張機能の起動
initialize();

// background.jsからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('メッセージを受信しました:', message);

  if (message.action === 'toggleConversion') {
    const newEnabled = message.enabled;
    console.log(`変換を${newEnabled ? 'ON' : 'OFF'}に切り替えます`);

    isEnabled = newEnabled;

    if (newEnabled) {
      // ONにする: 変換を実行
      main();
    } else {
      // OFFにする: 変換を元に戻す
      revertConversion();
    }

    sendResponse({ success: true });
  }

  return true; // 非同期レスポンスを有効にする
});

// 動的に追加されるコンテンツに対応（念のため）
const observer = new MutationObserver((mutations) => {
  // OFFの場合は何もしない
  if (!isEnabled) {
    return;
  }

  let hasNewTable = false;

  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === 'TABLE' || node.querySelector('table')) {
            hasNewTable = true;
          }
        }
      });
    }
  });

  if (hasNewTable) {
    console.log('新しいテーブルが検出されました。再処理します。');
    setTimeout(main, 100);
  }
});

// オブザーバーを開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});
