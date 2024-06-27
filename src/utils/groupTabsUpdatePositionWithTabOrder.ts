export default function groupTabsUpdatePositionWithTabOrder(groupHeaderElement: HTMLElement, currentTabElement: HTMLElement) {
  groupHeaderElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
    const tabOrder = tabElement.getAttribute("data-tab-order");
    if (tabElement instanceof HTMLElement) {
      tabElement.classList.remove("transition-transform", "duration-300");
      tabElement.style.left = `${Number(tabOrder) * tabElement.offsetWidth}px`;
      tabElement.style.transform = "translate(0px, 0px)";
    }
  });

  const currentTabNewOrder = currentTabElement.getAttribute("data-tab-order");
  if (currentTabNewOrder) {
    currentTabElement.style.top = "0px";
    currentTabElement.style.left = `${Number(currentTabNewOrder) * currentTabElement.offsetWidth}px`;
    currentTabElement.style.transform = "translate(0px, 0px)";
    currentTabElement.setAttribute("data-position", JSON.stringify({ x: 0, y: 0 }));
  }

  groupHeaderElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
    if (tabElement instanceof HTMLElement) {
      tabElement.classList.add("transition-transform", "duration-300");
      tabElement.setAttribute("data-transform-status", "0");
    }
  });
}
