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
    /^(\d+):(\d{2}):(\d{2})\.(\d{3})$/,
    // HH:MM:SS
    /^(\d+):(\d{2}):(\d{2})$/,
    // MM:SS.mmm
    /^(\d+):(\d{2})\.(\d{3})$/,
    // MM:SS
    /^(\d+):(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = timeStr.trim().match(pattern);
    if (match) {
      if (match.length === 5) {
        // HH:MM:SS.mmm
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const ms = parseInt(match[4], 10);
        return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
      } else if (match.length === 4 && pattern.source.includes('HH')) {
        // HH:MM:SS
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
      } else if (match.length === 4) {
        // MM:SS.mmm
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const ms = parseInt(match[3], 10);
        return (minutes * 60 + seconds) * 1000 + ms;
      } else if (match.length === 3) {
        // MM:SS
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        return (minutes * 60 + seconds) * 1000;
      }
    }
  }

  return null;
}

// ミリ秒を時間文字列に変換
function formatMsToTime(ms, includeMs = true) {
  if (ms === null || ms === undefined) {
    return '-';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = '';
  if (hours > 0) {
    result = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    result = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  if (includeMs && milliseconds > 0) {
    result += `.${String(milliseconds).padStart(3, '0')}`;
  }

  return result;
}

// セルが時間データかどうかを判定
function isTimeCell(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed === '' || trimmed === '-') return true; // 空セルも許容
  return /^\d+:\d{2}(:\d{2})?(\.\d{3})?$/.test(trimmed);
}

// ラップタイム列を検出
function detectLapTimeColumns(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return [];

  // ヘッダー行を探す
  let headerRow = null;
  let dataStartIndex = 0;

  for (let i = 0; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('th, td'));
    if (cells.length > 0) {
      // ラップタイムっぽいヘッダーがあるか確認
      const hasLapHeader = cells.some(cell =>
        /周|lap|ラップ/i.test(cell.textContent)
      );
      if (hasLapHeader) {
        headerRow = rows[i];
        dataStartIndex = i + 1;
        break;
      }
    }
  }

  // データ行から時間列を検出
  const lapColumns = [];
  if (dataStartIndex < rows.length) {
    const sampleRow = rows[dataStartIndex];
    const cells = Array.from(sampleRow.querySelectorAll('td, th'));

    // 連続する時間フォーマットのセルを検出
    let inLapSequence = false;
    let sequenceStart = -1;

    cells.forEach((cell, index) => {
      const text = cell.textContent.trim();
      if (isTimeCell(text)) {
        if (!inLapSequence) {
          inLapSequence = true;
          sequenceStart = index;
        }
      } else if (inLapSequence) {
        // 連続が途切れた
        if (sequenceStart >= 0 && index - sequenceStart >= 2) {
          // 2列以上の時間データがあればラップタイムとみなす
          for (let i = sequenceStart; i < index; i++) {
            lapColumns.push(i);
          }
        }
        inLapSequence = false;
        sequenceStart = -1;
      }
    });

    // 最後まで連続していた場合
    if (inLapSequence && sequenceStart >= 0 && cells.length - sequenceStart >= 2) {
      for (let i = sequenceStart; i < cells.length; i++) {
        lapColumns.push(i);
      }
    }
  }

  return lapColumns;
}

// テーブルのラップタイムを変換
function convertLapTimes(table) {
  const lapColumns = detectLapTimeColumns(table);

  if (lapColumns.length === 0) {
    console.log('ラップタイム列が見つかりませんでした');
    return false;
  }

  console.log(`ラップタイム列を検出: ${lapColumns.length}列`);

  const rows = Array.from(table.querySelectorAll('tr'));
  let convertedCount = 0;

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length === 0) return;

    // ヘッダー行はスキップ
    if (cells[0].tagName === 'TH' && rowIndex === 0) return;

    // 各行のラップタイムを処理
    const lapTimes = [];
    let hasValidData = false;

    lapColumns.forEach(colIndex => {
      if (colIndex < cells.length) {
        const cell = cells[colIndex];
        const timeStr = cell.textContent.trim();
        const ms = parseTimeToMs(timeStr);
        lapTimes.push({ cell, ms, original: timeStr });
        if (ms !== null) {
          hasValidData = true;
        }
      }
    });

    if (!hasValidData) return;

    // 経過時間からネットラップタイムに変換
    let prevMs = 0;
    lapTimes.forEach(({ cell, ms, original }, index) => {
      if (ms !== null) {
        const netLapTime = ms - prevMs;

        // 元の形式にミリ秒が含まれているかチェック
        const includeMs = original.includes('.');
        const newTimeStr = formatMsToTime(netLapTime, includeMs);

        // セルの内容を更新
        if (cell.textContent.trim() !== newTimeStr) {
          // 元の値を data-original 属性に保存
          cell.setAttribute('data-original', original);
          cell.textContent = newTimeStr;
          cell.classList.add('converted-lap-time');
          convertedCount++;
        }

        prevMs = ms;
      }
    });
  });

  if (convertedCount > 0) {
    console.log(`${convertedCount}個のラップタイムを変換しました`);
    return true;
  }

  return false;
}

// 通知バナーを表示
function showNotification(message) {
  const banner = document.createElement('div');
  banner.id = 'lap-time-converter-banner';
  banner.className = 'lap-time-converter-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">⏱️</span>
      <span class="banner-text">${message}</span>
      <button class="banner-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
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
  console.log('Cyclocross Lap Time Converter: 起動しました');

  // すべてのテーブルを処理
  const tables = document.querySelectorAll('table');
  let totalConverted = false;

  tables.forEach((table, index) => {
    console.log(`テーブル ${index + 1}/${tables.length} を処理中...`);
    const converted = convertLapTimes(table);
    if (converted) {
      totalConverted = true;
      table.classList.add('lap-time-converted-table');
    }
  });

  if (totalConverted) {
    showNotification('ラップタイムを経過時間からネットラップタイムに変換しました');
  } else {
    console.log('変換可能なラップタイムが見つかりませんでした');
  }
}

// DOMの読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// 動的に追加されるコンテンツにも対応
const observer = new MutationObserver((mutations) => {
  let shouldRerun = false;
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && (node.tagName === 'TABLE' || node.querySelector('table'))) {
          shouldRerun = true;
        }
      });
    }
  });

  if (shouldRerun) {
    main();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
