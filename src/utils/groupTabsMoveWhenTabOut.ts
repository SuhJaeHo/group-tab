export default function groupTabsMoveWhenTabOut(groupElement: HTMLElement, currentTabElement: HTMLElement) {
  const currentTabTempOrder = currentTabElement.getAttribute("data-tmp-order");
  const currentTabElementRect = currentTabElement.getBoundingClientRect();
  const combineGroupId = currentTabElement.getAttribute("data-combine-group-id");

  const tabElements = groupElement.querySelectorAll("[data-tab-id]");
  tabElements.forEach((tabElement, idx) => {
    if (tabElement instanceof HTMLElement) {
      const tabTempOrder = tabElement.getAttribute("data-tmp-order");
      const tabTransformStatus = tabElement.getAttribute("data-transform-status");
      if (Number(currentTabTempOrder) < Number(tabTempOrder)) {
        if (tabTransformStatus === "1") {
          tabElement.style.transform = "translate(0px, 0px)";
          tabElement.setAttribute("data-transform-status", "0");
          tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) - 1));
        } else if (tabTransformStatus === "-1") {
          tabElement.style.transform = "translate(0px, 0px)";
          tabElement.setAttribute("data-transform-status", "0");
          tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) + 1));
        } else {
          tabElement.style.transform = `translate(-${currentTabElementRect.width}px ,0px)`;
          tabElement.setAttribute("data-transform-status", "-1");
          tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) - 1));
        }
      }
    }
  });

  if (combineGroupId) {
    currentTabElement.removeAttribute("data-combine-group-id");
    return;
  }
  currentTabElement.setAttribute("data-is-divided", "true");
}
