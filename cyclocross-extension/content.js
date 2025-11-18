/**
 * Cyclocross Lap Time Converter
 * 経過時間をネットラップタイムに変換するChrome拡張機能
 */

// 時間文字列をミリ秒に変換
function parseTimeToMs(timeStr) {
  if (!timeStr || timeStr.trim() === '' || timeStr === '-') {
    return null;
  }

  // MM:SS.mmm または MM:SS または HH:MM:SS 形式に対応
  const patterns = [
    // HH:MM:SS.mmm
    { regex: /^(\d+):(\d{2}):(\d{2})\.(\d{3})$/, type: 'HMS_MS' },
    // HH:MM:SS
    { regex: /^(\d+):(\d{2}):(\d{2})$/, type: 'HMS' },
    // MM:SS.mmm
    { regex: /^(\d+):(\d{2})\.(\d{3})$/, type: 'MS_MS' },
    // MM:SS
    { regex: /^(\d+):(\d{2})$/, type: 'MS' },
  ];

  const trimmed = timeStr.trim();

  for (const { regex, type } of patterns) {
    const match = trimmed.match(regex);
    if (match) {
      switch (type) {
        case 'HMS_MS': {
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
        case 'MS_MS': {
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

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td'));

    // DNS行などはスキップ
    const rankCell = cells[0];
    if (!rankCell || rankCell.textContent.trim() === 'DNS') {
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
      return;
    }

    // 経過時間からネットラップタイムに変換
    let prevMs = 0;
    lapData.forEach(({ cell, textDiv, ms, original }) => {
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

// 初期化
function initialize() {
  // ページの読み込み状態に応じて実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    // すでに読み込まれている場合は少し遅延させて実行
    setTimeout(main, 100);
  }
}

// 拡張機能の起動
initialize();

// 動的に追加されるコンテンツに対応（念のため）
const observer = new MutationObserver((mutations) => {
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
