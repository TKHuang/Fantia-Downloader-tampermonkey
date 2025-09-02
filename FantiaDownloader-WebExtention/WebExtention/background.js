/* jshint esversion: 9 */

// Background script to handle foldered downloads via chrome.downloads

function sanitizeFilename(name) {
	// Remove illegal characters for filenames on major OSes
	return name
		.replace(/[\\/:*?"<>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function sanitizeFolderName(name) {
	// Remove illegal characters for filenames on major OSes
	return name
		.replace(/[\\/:*?"<>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/\.$/, ' ')
		.trim();
}

let clearTimer = null;
let progressByTab = Object.create(null);
let currentTabId = null;
let downloadsMetaById = Object.create(null); // id -> { folderName, filename, tabId }

function armClearTimer() {
	if (clearTimer) {
		clearTimeout(clearTimer);
	}
	clearTimer = setTimeout(() => {
		clearTimer = null;
	}, 30000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || !message.type) return;

	if (message.type === 'download_all' && Array.isArray(message.items)) {
		const folderName = sanitizeFolderName(message.folderName || 'Fantia');
		const tabId = sender && sender.tab && sender.tab.id;
		const total = (message.items || []).length;
		if (tabId != null) {
			progressByTab[tabId] = { total: total, completed: 0, ids: new Set(), urls: new Set() };
			currentTabId = tabId;
		}
		(message.items || []).forEach((item) => {
			if (!item || !item.url) return;
			if (tabId != null) {
				progressByTab[tabId] && progressByTab[tabId].urls.add(item.url);
			}
			const baseFromUrl = () => {
				const clean = item.url.split('#')[0].split('?')[0];
				const last = clean.split('/').pop() || 'file';
				return sanitizeFilename(last);
			};
			const base = sanitizeFilename(item.filename || baseFromUrl());
			const path = `${folderName}/${base}`;
			chrome.downloads.download({ url: item.url, filename: path, conflictAction: 'overwrite', saveAs: false }, function (downloadId) {
				if (tabId != null && typeof downloadId === 'number') {
					progressByTab[tabId] && progressByTab[tabId].ids.add(downloadId);
					downloadsMetaById[downloadId] = { folderName, filename: base, tabId, active: true };
				}
			});
		});
		sendResponse({ ok: true });
		armClearTimer();
		return true;
	}
});


chrome.downloads.onChanged.addListener((delta) => {
	if (!delta || typeof delta.id !== 'number') return;
	const finished = (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) || (delta.endTime && !delta.error);
	if (!finished) return;
	for (const key in progressByTab) {
		const tabId = Number(key);
		const s = progressByTab[tabId];
		if (!s) continue;
		if (s.ids.has(delta.id)) {
			s.ids.delete(delta.id);
			s.completed += 1;
			try {
				chrome.tabs.sendMessage(tabId, { type: 'download_progress', completed: s.completed, total: s.total });
				if (s.completed >= s.total) {
					chrome.tabs.sendMessage(tabId, { type: 'download_done' });
					delete progressByTab[tabId];
				}
			} catch (e) { }
			break;
		}
	}
});


