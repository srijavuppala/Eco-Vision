chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_ACTIVE_TAB_CONTEXT") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse({
        title: tab?.title || "",
        url: tab?.url || ""
      });
      return;
    }

    sendResponse({ error: "Unknown message" });
  })();

  return true;
});

