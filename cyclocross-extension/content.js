/**
 * Cyclocross Lap Time Converter
 * 経過時間をネットラップタイムに変換するChrome拡張機能
 */

// グローバル変数: ON/OFF状態
let isEnabled = true;

// グローバル変数: グラフ用データ（テーブルごと）
const graphDataMap = new Map(); // key: table要素, value: { riders: [...], startLoopIndex: ... }

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
    // MM:SS.d (小数点第1位) ← 1分以上のラップで使われる
    { regex: /^(\d+):(\d{2})\.(\d)$/, type: 'MS_D1' },
    // MM:SS.dd (小数点第2位)
    { regex: /^(\d+):(\d{2})\.(\d{2})$/, type: 'MS_D2' },
    // MM:SS.ddd (小数点第3位、ミリ秒)
    { regex: /^(\d+):(\d{2})\.(\d{3})$/, type: 'MS_D3' },
    // MM:SS
    { regex: /^(\d+):(\d{2})$/, type: 'MS' },
    // SS.d (秒のみ、小数点第1位) ← スタートループなど1分未満で使われる
    { regex: /^(\d{1,2})\.(\d)$/, type: 'S_D1' },
    // SS.dd (秒のみ、小数点第2位)
    { regex: /^(\d{1,2})\.(\d{2})$/, type: 'S_D2' },
    // SS.ddd (秒のみ、小数点第3位)
    { regex: /^(\d{1,2})\.(\d{3})$/, type: 'S_D3' },
    // SS (秒のみ)
    { regex: /^(\d{1,2})$/, type: 'S' },
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
        case 'S_D1': {
          // SS.d → 秒のみ、1/10秒 = 100ms
          const seconds = parseInt(match[1], 10);
          const deciseconds = parseInt(match[2], 10);
          return seconds * 1000 + deciseconds * 100;
        }
        case 'S_D2': {
          // SS.dd → 秒のみ、1/100秒 = 10ms
          const seconds = parseInt(match[1], 10);
          const centiseconds = parseInt(match[2], 10);
          return seconds * 1000 + centiseconds * 10;
        }
        case 'S_D3': {
          // SS.ddd → 秒のみ、ミリ秒
          const seconds = parseInt(match[1], 10);
          const ms = parseInt(match[2], 10);
          return seconds * 1000 + ms;
        }
        case 'S': {
          // SS → 秒のみ
          const seconds = parseInt(match[1], 10);
          return seconds * 1000;
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
  } else if (minutes > 0) {
    result = `${minutes}:${String(seconds).padStart(2, '0')}`;
  } else {
    // 秒のみ（1分未満）
    result = `${seconds}`;
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
    return { lapColumnIndices: [], startLoopIndex: null };
  }

  const headers = Array.from(headerRow.querySelectorAll('th'));
  const lapColumnIndices = [];
  let startLoopIndex = null;

  headers.forEach((header, index) => {
    const headerText = header.textContent.trim();

    // スタートループかどうかを先に判定
    const isStartLoop =
      /start\s*loop/i.test(headerText) ||
      /スタートループ/.test(headerText) ||
      /^0周/.test(headerText) ||
      /^0\s*lap/i.test(headerText) ||
      /^lap\s*0/i.test(headerText);

    // cell__lapat クラスを持つか、「周」を含むヘッダー、またはスタートループを探す
    if (header.classList.contains('cell__lapat') || /\d+周/.test(headerText) || isStartLoop) {
      lapColumnIndices.push(index);

      // スタートループを検出（複数のパターンに対応）
      if (isStartLoop) {
        startLoopIndex = lapColumnIndices.length - 1; // lapColumnIndices内でのインデックス
        console.log(`スタートループを検出: 列${index} (ヘッダー: "${headerText}", ラップインデックス: ${startLoopIndex})`);
      }
    }
  });

  console.log(`ラップタイム列を検出: ${lapColumnIndices.length}列 (インデックス: ${lapColumnIndices.join(', ')})`);
  if (startLoopIndex !== null) {
    console.log(`  ※ スタートループ(0周)が含まれています (ラップインデックス: ${startLoopIndex})`);
  }

  return { lapColumnIndices, startLoopIndex };
}

// テーブルのラップタイムを変換
function convertLapTimesInTable(table) {
  if (!isLapTimeTable(table)) {
    return false;
  }

  console.log('ラップタイムテーブルを発見しました');

  const { lapColumnIndices, startLoopIndex } = getLapTimeColumnIndices(table);
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

  // 全選手のラップタイムを保存（ベストラップ検出用）
  const allLapTimes = []; // [{ cell, netLapTime, lapIndex, rowIndex }, ...]

  // グラフ用データ保存用
  const graphRiders = [];

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td'));

    // DNS行などはスキップ
    const rankCell = cells[0];
    if (!rankCell || rankCell.textContent.trim() === 'DNS') {
      console.log(`  行${rowIndex + 1}: DNS行のためスキップ`);
      return;
    }

    // 選手情報を取得（グラフ用）
    const rank = cells[0] ? cells[0].textContent.trim() : '';
    const riderNameCell = cells[1];
    const riderName = riderNameCell ? (riderNameCell.querySelector('a') || riderNameCell).textContent.trim() : '選手' + (rowIndex + 1);

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
    const riderLapTimes = []; // この選手のラップタイム（ベストラップ検出用）
    const graphLapTimes = []; // グラフ用ラップタイム配列（ミリ秒）

    lapData.forEach(({ cell, textDiv, ms, original }, lapIndex) => {
      if (ms !== null && ms > 0) {
        const netLapTime = ms - prevMs;

        if (netLapTime < 0) {
          console.warn(`警告: 行${rowIndex + 1}で負のラップタイムが検出されました (${netLapTime}ms)`);
          prevMs = ms;
          return;
        }

        // 最初の列（lapIndex === 0）は既にネットラップタイムなのでセルの更新はスキップ
        // ただし、ベストラップ判定には含める必要がある
        // スタートループの除外は別途 startLoopIndex で判定される
        if (lapIndex === 0) {
          if (rowIndex < 3) {
            console.log(`  行${rowIndex + 1}, ラップ${lapIndex + 1}: 最初の列のためセル更新スキップ (original="${original}", netLapTime=${netLapTime}ms)`);
          }
          // ベストラップ判定用にラップタイムを記録
          if (original !== '' && original !== '-') {
            riderLapTimes.push({ cell, netLapTime, lapIndex });
            allLapTimes.push({ cell, netLapTime, lapIndex, rowIndex });
            graphLapTimes.push(netLapTime); // グラフ用データ
          }
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
          cell.setAttribute('data-net-lap-time', netLapTime.toString()); // ベストラップ検出用

          // テキストを更新
          targetElement.textContent = newTimeStr;

          // クラスを追加
          cell.classList.add('converted-lap-time');

          // ラップタイムを記録
          riderLapTimes.push({ cell, netLapTime, lapIndex });
          allLapTimes.push({ cell, netLapTime, lapIndex, rowIndex });
          graphLapTimes.push(netLapTime); // グラフ用データ

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

    // この選手のベストラップを検出（スタートループを除外）
    if (riderLapTimes.length > 0) {
      // スタートループを除外してベストラップを計算
      const validRiderLaps = startLoopIndex !== null
        ? riderLapTimes.filter(lt => lt.lapIndex !== startLoopIndex)
        : riderLapTimes;

      if (validRiderLaps.length > 0) {
        const minLapTime = Math.min(...validRiderLaps.map(lt => lt.netLapTime));
        validRiderLaps.forEach(({ cell, netLapTime }) => {
          if (netLapTime === minLapTime) {
            cell.classList.add('rider-best-lap');
            cell.setAttribute('data-rider-best', 'true');
          }
        });
      }
    }

    // グラフ用データに選手情報を追加
    if (graphLapTimes.length > 0) {
      graphRiders.push({
        name: riderName,
        rank: rank,
        lapTimes: graphLapTimes,
        row: row
      });
    }
  });

  // レース全体のベストラップを検出（スタートループを除外）
  if (allLapTimes.length > 0) {
    // スタートループを除外してベストラップを計算
    const validAllLaps = startLoopIndex !== null
      ? allLapTimes.filter(lt => lt.lapIndex !== startLoopIndex)
      : allLapTimes;

    if (validAllLaps.length > 0) {
      const overallBestLapTime = Math.min(...validAllLaps.map(lt => lt.netLapTime));
      let bestLapCount = 0;

      validAllLaps.forEach(({ cell, netLapTime }) => {
        if (netLapTime === overallBestLapTime) {
          cell.classList.add('overall-best-lap');
          cell.setAttribute('data-overall-best', 'true');
          bestLapCount++;
        }
      });

      console.log(`  ベストラップ: ${formatMsToTime(overallBestLapTime, true)} (${bestLapCount}箇所)`);
      if (startLoopIndex !== null) {
        console.log(`  ※ スタートループは除外しました`);
      }
    }
  }

  if (convertedCount > 0) {
    console.log(`${convertedCount}個のラップタイムを変換しました`);
    table.classList.add('lap-time-converted-table');

    // グラフ用データを保存
    graphDataMap.set(table, {
      riders: graphRiders,
      startLoopIndex: startLoopIndex
    });
    console.log(`  グラフ用データ保存: ${graphRiders.length}名の選手`);

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

      // グラフボタンを追加
      addGraphButton(table);
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
      cell.classList.remove('rider-best-lap');
      cell.classList.remove('overall-best-lap');
      cell.removeAttribute('data-original-time');
      cell.removeAttribute('data-converted');
      cell.removeAttribute('data-net-lap-time');
      cell.removeAttribute('data-rider-best');
      cell.removeAttribute('data-overall-best');

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

// ============================================
// グラフ機能
// ============================================

// Canvas折れ線グラフ描画関数
function drawLineGraph(canvas, riders, options = {}) {
  const {
    skipFirstLap = false,
    width = 800,
    height = 400,
    padding = { top: 40, right: 20, bottom: 60, left: 80 }
  } = options;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 背景をクリア
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (riders.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('選手を選択してください', width / 2, height / 2);
    return;
  }

  // データ範囲を計算
  let maxLaps = 0;
  let maxTime = 0;
  let minTime = Infinity;

  riders.forEach(rider => {
    const times = skipFirstLap ? rider.lapTimes.slice(1) : rider.lapTimes;
    maxLaps = Math.max(maxLaps, times.length);
    times.forEach(time => {
      maxTime = Math.max(maxTime, time);
      minTime = Math.min(minTime, time);
    });
  });

  if (maxLaps === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('表示するデータがありません', width / 2, height / 2);
    return;
  }

  // グラフエリアの計算
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const graphX = padding.left;
  const graphY = padding.top;

  // スケール計算
  const timeRange = maxTime - minTime;
  const timePadding = timeRange * 0.1; // 上下に10%のパディング
  const yMin = Math.max(0, minTime - timePadding);
  const yMax = maxTime + timePadding;

  const xScale = graphWidth / (maxLaps - 1 || 1);
  const yScale = graphHeight / (yMax - yMin);

  // 座標変換関数
  const toX = (lapIndex) => graphX + lapIndex * xScale;
  const toY = (time) => graphY + graphHeight - (time - yMin) * yScale;

  // グリッド線を描画
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;

  // 横線（Y軸グリッド）
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = graphY + (graphHeight / ySteps) * i;
    ctx.beginPath();
    ctx.moveTo(graphX, y);
    ctx.lineTo(graphX + graphWidth, y);
    ctx.stroke();

    // Y軸ラベル
    const timeValue = yMax - ((yMax - yMin) / ySteps) * i;
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatMsToTime(timeValue, true), graphX - 10, y + 4);
  }

  // 縦線（X軸グリッド）
  for (let i = 0; i < maxLaps; i++) {
    const x = toX(i);
    ctx.beginPath();
    ctx.moveTo(x, graphY);
    ctx.lineTo(x, graphY + graphHeight);
    ctx.stroke();

    // X軸ラベル
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const lapNumber = skipFirstLap ? i + 2 : i + 1;
    ctx.fillText(`${lapNumber}周`, x, graphY + graphHeight + 20);
  }

  // 軸を描画
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphHeight);
  ctx.lineTo(graphX + graphWidth, graphY + graphHeight);
  ctx.stroke();

  // 選手ごとに折れ線を描画
  const colors = [
    '#4CAF50', '#2196F3', '#F44336', '#FF9800', '#9C27B0',
    '#00BCD4', '#FFEB3B', '#E91E63', '#3F51B5', '#8BC34A'
  ];

  riders.forEach((rider, riderIndex) => {
    const times = skipFirstLap ? rider.lapTimes.slice(1) : rider.lapTimes;
    if (times.length === 0) return;

    const color = colors[riderIndex % colors.length];

    // 折れ線を描画
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    times.forEach((time, lapIndex) => {
      const x = toX(lapIndex);
      const y = toY(time);

      if (lapIndex === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // データポイントを描画
    ctx.fillStyle = color;
    times.forEach((time, lapIndex) => {
      const x = toX(lapIndex);
      const y = toY(time);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // 凡例を描画
  const legendX = graphX + graphWidth - 150;
  const legendY = graphY + 10;
  const legendItemHeight = 20;

  riders.forEach((rider, index) => {
    const color = colors[index % colors.length];
    const y = legendY + index * legendItemHeight;

    // 色の四角
    ctx.fillStyle = color;
    ctx.fillRect(legendX, y, 15, 15);

    // 選手名
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const nameText = `${rider.rank} ${rider.name}`;
    ctx.fillText(nameText.length > 15 ? nameText.substring(0, 15) + '...' : nameText, legendX + 20, y + 12);
  });

  // タイトル
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ラップタイム推移', width / 2, 20);
}

// グラフコンテナを作成
function createGraphContainer(table) {
  const container = document.createElement('div');
  container.className = 'lap-graph-container';
  container.style.display = 'none'; // 初期状態は非表示

  // コントロールエリア
  const controls = document.createElement('div');
  controls.className = 'lap-graph-controls';

  // 左側のコントロール（1周目トグル）
  const leftControls = document.createElement('div');
  leftControls.className = 'lap-graph-left-controls';

  const firstLapToggle = document.createElement('label');
  firstLapToggle.className = 'lap-graph-toggle';
  firstLapToggle.innerHTML = `
    <input type="checkbox" class="first-lap-toggle" checked>
    <span>1周目を表示</span>
  `;
  leftControls.appendChild(firstLapToggle);
  controls.appendChild(leftControls);

  // 中央のコントロール（クイック選択ボタン）
  const centerControls = document.createElement('div');
  centerControls.className = 'lap-graph-quick-select';

  const quickSelectLabel = document.createElement('span');
  quickSelectLabel.textContent = 'クイック選択:';
  quickSelectLabel.style.cssText = 'margin-right: 8px; font-size: 13px; color: #666;';
  centerControls.appendChild(quickSelectLabel);

  // 上位3名ボタン
  const top3Button = document.createElement('button');
  top3Button.className = 'lap-graph-quick-button';
  top3Button.textContent = '上位3名';
  top3Button.addEventListener('click', () => {
    const graphData = graphDataMap.get(table);
    if (!graphData) return;

    // すべてのチェックボックスを解除
    graphData.riders.forEach(rider => {
      const checkbox = rider.row.querySelector('.rider-select-checkbox');
      if (checkbox) checkbox.checked = false;
    });

    // 上位3名（最初の3名）をチェック
    graphData.riders.slice(0, 3).forEach(rider => {
      const checkbox = rider.row.querySelector('.rider-select-checkbox');
      if (checkbox) checkbox.checked = true;
    });

    updateGraph(table);
  });
  centerControls.appendChild(top3Button);

  // 全選手ボタン
  const allButton = document.createElement('button');
  allButton.className = 'lap-graph-quick-button';
  allButton.textContent = '全選手';
  allButton.addEventListener('click', () => {
    const graphData = graphDataMap.get(table);
    if (!graphData) return;

    // すべてのチェックボックスをチェック
    graphData.riders.forEach(rider => {
      const checkbox = rider.row.querySelector('.rider-select-checkbox');
      if (checkbox) checkbox.checked = true;
    });

    updateGraph(table);
  });
  centerControls.appendChild(allButton);

  // すべて解除ボタン
  const clearButton = document.createElement('button');
  clearButton.className = 'lap-graph-quick-button';
  clearButton.textContent = 'すべて解除';
  clearButton.addEventListener('click', () => {
    const graphData = graphDataMap.get(table);
    if (!graphData) return;

    // すべてのチェックボックスを解除
    graphData.riders.forEach(rider => {
      const checkbox = rider.row.querySelector('.rider-select-checkbox');
      if (checkbox) checkbox.checked = false;
    });

    updateGraph(table);
  });
  centerControls.appendChild(clearButton);

  controls.appendChild(centerControls);

  // 右側のコントロール（選手選択情報）
  const rightControls = document.createElement('div');
  rightControls.className = 'lap-graph-right-controls';

  const selectionInfo = document.createElement('div');
  selectionInfo.className = 'lap-graph-selection-info';
  selectionInfo.textContent = '選手を選択してグラフに表示';
  rightControls.appendChild(selectionInfo);

  controls.appendChild(rightControls);

  container.appendChild(controls);

  // Canvasエリア
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'lap-graph-canvas-wrapper';

  const canvas = document.createElement('canvas');
  canvas.className = 'lap-graph-canvas';
  canvasWrapper.appendChild(canvas);

  container.appendChild(canvasWrapper);

  return container;
}

// グラフを更新
function updateGraph(table) {
  const graphData = graphDataMap.get(table);
  if (!graphData) return;

  const container = table.parentElement.querySelector('.lap-graph-container');
  if (!container) return;

  const canvas = container.querySelector('.lap-graph-canvas');
  const firstLapToggle = container.querySelector('.first-lap-toggle');
  const skipFirstLap = !firstLapToggle.checked;

  // 選択された選手を取得
  const selectedRiders = [];
  graphData.riders.forEach(rider => {
    const checkbox = rider.row.querySelector('.rider-select-checkbox');
    if (checkbox && checkbox.checked) {
      selectedRiders.push(rider);
    }
  });

  // 選択情報を更新
  const selectionInfo = container.querySelector('.lap-graph-selection-info');
  if (selectedRiders.length === 0) {
    selectionInfo.textContent = '選手を選択してグラフに表示';
  } else {
    selectionInfo.textContent = `${selectedRiders.length}名の選手を表示中`;
  }

  // グラフを描画
  drawLineGraph(canvas, selectedRiders, { skipFirstLap });
}

// 選手選択チェックボックスを追加
function addRiderCheckboxes(table) {
  const graphData = graphDataMap.get(table);
  if (!graphData) return;

  graphData.riders.forEach(rider => {
    // 既にチェックボックスがある場合はスキップ
    if (rider.row.querySelector('.rider-select-checkbox')) return;

    // チェックボックスを作成
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'rider-select-checkbox';
    // インラインスタイルで確実にインライン表示
    checkbox.style.cssText = `
      display: inline-block !important;
      margin-right: 8px;
      cursor: pointer;
      vertical-align: middle;
    `;

    // チェック状態変更時にグラフを更新し、自動展開
    checkbox.addEventListener('change', () => {
      const container = table.parentElement.querySelector('.lap-graph-container');
      const toggleButton = table.parentElement.querySelector('.lap-graph-toggle-button');

      // チェックがついたら自動的にグラフを表示
      if (checkbox.checked && container && container.style.display === 'none') {
        container.style.display = 'block';
        if (toggleButton) {
          toggleButton.textContent = '📊 グラフを非表示';
        }
      }

      updateGraph(table);
    });

    // 選手名セルの先頭に追加
    const nameCell = rider.row.querySelector('td:nth-child(2)');
    if (nameCell) {
      // セルの最初の子要素の前に挿入
      nameCell.insertBefore(checkbox, nameCell.firstChild);

      // a要素を取得してインライン表示に設定（サイト側のCSSを上書き）
      const link = nameCell.querySelector('a');
      if (link) {
        link.style.display = 'inline';
        link.classList.add('rider-name-with-checkbox');
      }
    }
  });
}

// グラフに移動するボタンを作成（上部用）
function createScrollToGraphButton(table) {
  const button = document.createElement('button');
  button.className = 'lap-graph-scroll-button';
  button.textContent = '⬇️ グラフに移動';
  button.style.cssText = `
    margin: 10px 0;
    padding: 10px 20px;
    background-color: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#1976D2';
  });

  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#2196F3';
  });

  button.addEventListener('click', () => {
    const container = table.parentElement.querySelector('.lap-graph-container');
    if (!container) return;

    // グラフが非表示の場合は表示する
    if (container.style.display === 'none') {
      container.style.display = 'block';
      const toggleButton = table.parentElement.querySelector('.lap-graph-toggle-button');
      if (toggleButton) {
        toggleButton.textContent = '📊 グラフを非表示';
      }
      updateGraph(table);
    }

    // グラフまでスクロール
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  return button;
}

// グラフ表示/非表示トグルボタンを作成（下部用）
function createGraphToggleButton(table) {
  const button = document.createElement('button');
  button.className = 'lap-graph-toggle-button';
  button.textContent = '📊 グラフを表示';
  button.style.cssText = `
    margin: 10px 0;
    padding: 10px 20px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#45a049';
  });

  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#4CAF50';
  });

  button.addEventListener('click', () => {
    const container = table.parentElement.querySelector('.lap-graph-container');
    if (!container) return;

    const isVisible = container.style.display !== 'none';

    if (isVisible) {
      // 非表示にする
      container.style.display = 'none';
      button.textContent = '📊 グラフを表示';
    } else {
      // 表示する
      container.style.display = 'block';
      button.textContent = '📊 グラフを非表示';
      updateGraph(table);

      // グラフまでスクロール
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  return button;
}

// グラフボタンを追加
function addGraphButton(table) {
  // 既にボタンがある場合はスキップ
  const existingButton = table.parentElement.querySelector('.lap-graph-toggle-button');
  if (existingButton) return;

  // テーブル上部に説明付きボタンを追加
  const topSection = document.createElement('div');
  topSection.className = 'lap-graph-top-section';
  topSection.style.cssText = `
    margin: 10px 0;
    padding: 12px;
    background-color: #f0f8ff;
    border: 1px solid #b3d9ff;
    border-radius: 6px;
  `;

  const description = document.createElement('p');
  description.style.cssText = `
    margin: 0 0 10px 0;
    font-size: 13px;
    color: #333;
    line-height: 1.6;
  `;
  description.innerHTML = '<strong>💡 グラフ表示:</strong> 選手名の左側のチェックボックスを選択すると、ラップタイムの推移をグラフで比較できます';

  const topButton = createScrollToGraphButton(table);
  topSection.appendChild(description);
  topSection.appendChild(topButton);

  // テーブルの前に挿入
  table.parentElement.insertBefore(topSection, table);

  // テーブル下部にもボタンを追加
  const bottomButton = createGraphToggleButton(table);

  // グラフコンテナを作成
  const graphContainer = createGraphContainer(table);
  table.parentElement.insertBefore(bottomButton, table.nextSibling);
  table.parentElement.insertBefore(graphContainer, bottomButton.nextSibling);

  // 選手選択チェックボックスを追加
  addRiderCheckboxes(table);

  // 1周目トグルのイベントリスナー
  const firstLapToggle = graphContainer.querySelector('.first-lap-toggle');
  if (firstLapToggle) {
    firstLapToggle.addEventListener('change', () => {
      updateGraph(table);
    });
  }
}
