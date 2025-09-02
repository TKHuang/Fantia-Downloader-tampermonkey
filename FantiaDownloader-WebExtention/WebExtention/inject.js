/**
 * injectScript - Inject internal script to available access to the `window`
 *
 * @param  {type} file_path Local path of the internal script.
 * @param  {type} tag The tag as string, where the script will be append (default: 'body').
 * @see    {@link http://stackoverflow.com/questions/20499994/access-window-variable-from-content-script}
 */
function injectScript(file_path, tag) {
	var node = document.getElementsByTagName(tag)[0];
	var script = document.createElement('script');
	script.setAttribute('type', 'text/javascript');
	script.setAttribute('src', file_path);
	node.appendChild(script);
}
//if (window.jQuery == undefined) {injectScript(chrome.runtime.getURL('WebExtention/jquery-3.4.1.js'), 'body');}
injectScript(chrome.runtime.getURL('WebExtention/jszip.js'), 'body');
injectScript(chrome.runtime.getURL('WebExtention/zip-full.min.js'), 'body');
injectScript(chrome.runtime.getURL('WebExtention/FantiaDownloader.js'), 'body');

// Bridge messages from the page script to extension background
window.addEventListener('message', function(event) {
	if (event.source !== window) return;
	const data = event.data || {};
	if (!data || data.__from !== 'fantia_downloader_page') return;
	if (data.type === 'download_all') {
		chrome.runtime.sendMessage({
			type: 'download_all',
			items: data.items || [],
			folderName: data.folderName || 'Fantia'
		}, function(){});
	}
}, false);

// Receive progress updates from background and relay to page
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
	if (!message || !message.type) return;
	if (message.type === 'download_progress' || message.type === 'download_done') {
		window.postMessage({ __from: 'fantia_downloader_content', type: message.type, completed: message.completed, total: message.total }, '*');
	}
});