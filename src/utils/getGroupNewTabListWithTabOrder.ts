export default function getGroupNewTabListWithTabOrder(groupHeaderElement: HTMLElement, currentTabElement: HTMLElement) {
  const newTabIds = [];

  groupHeaderElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
    if (tabElement instanceof HTMLElement) {
      const tabId = tabElement.getAttribute("data-tab-id");
      const tabNewOrder = tabElement.getAttribute("data-tmp-order");
      if (tabId && tabNewOrder) {
        newTabIds[Number(tabNewOrder)] = tabId;
      }
    }
  });

  const currentTabNewOrder = currentTabElement.getAttribute("data-tmp-order");
  const currentTabId = currentTabElement.getAttribute("data-tab-id");
  newTabIds[Number(currentTabNewOrder)] = currentTabId;
  return newTabIds;
}
