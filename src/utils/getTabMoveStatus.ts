import { ContextType } from "../components/Board";

export enum TabMoveStatus {
  Default,
  Divide,
  Combine,
}

export default function getTabMoveStatus(dataContext: ContextType) {
  const tabElement = document.querySelector("[data-tab-is-dragging=true]");
  if (tabElement && tabElement.parentElement) {
    const currGroupId = tabElement.getAttribute("data-group-id");
    if (!currGroupId) return;

    const distance = 10;
    const tabElementRect = tabElement.getBoundingClientRect();
    const groupHeaderElementRect = tabElement.parentElement.getBoundingClientRect();

    const { width: tabWidth, height: tabHeight, left: tabLeft, top: tabTop } = tabElementRect;
    const { width: groupHeaderWidth, height: groupHeaderHeight, left: groupHeaderLeft, top: groupHeaderTop } = groupHeaderElementRect;

    // default
    if (
      !(tabElementRect.x === groupHeaderElementRect.x) &&
      ((groupHeaderLeft >= tabLeft && groupHeaderLeft - (tabLeft + tabWidth) <= distance) ||
        (groupHeaderLeft <= tabLeft && tabLeft - (groupHeaderLeft + groupHeaderWidth) <= distance)) &&
      ((groupHeaderTop >= tabTop && groupHeaderTop - (tabTop + tabHeight) <= distance) ||
        (groupHeaderTop <= tabTop && tabTop - (groupHeaderTop + groupHeaderHeight) <= distance))
    ) {
      tabElement.removeAttribute("data-target-group-id");
      return TabMoveStatus.Default;
    }

    // combine
    let closestGroupId = "";
    const groupHeaderElements = document.querySelectorAll("[data-group-header]");
    groupHeaderElements.forEach((groupHeaderElement) => {
      const dataGroupId = groupHeaderElement.getAttribute("data-group-id");
      if (!dataGroupId) return;

      const groupElement = document.getElementById(dataGroupId);
      if (groupElement) {
        if (currGroupId === dataGroupId) return;
        const groupHeaderElementRect = groupHeaderElement.getBoundingClientRect();

        const { width: tabWidth, height: tabHeight, left: tabLeft, top: tabTop } = tabElementRect;
        const { width: groupHeaderWidth, height: groupHeaderHeight, left: groupHeaderLeft, top: groupHeaderTop } = groupHeaderElementRect;

        if (
          ((groupHeaderLeft >= tabLeft && groupHeaderLeft - (tabLeft + tabWidth) <= distance) ||
            (groupHeaderLeft <= tabLeft && tabLeft - (groupHeaderLeft + groupHeaderWidth) <= distance)) &&
          ((groupHeaderTop >= tabTop && groupHeaderTop - (tabTop + tabHeight) <= distance) ||
            (groupHeaderTop <= tabTop && tabTop - (groupHeaderTop + groupHeaderHeight) <= distance))
        ) {
          closestGroupId = dataGroupId;
          return;
        }
      }
    });

    if (closestGroupId !== "") {
      tabElement.setAttribute("data-target-group-id", closestGroupId);
      return TabMoveStatus.Combine;
    }

    // default
    if (dataContext.group[currGroupId].tabIds.length === 1) {
      tabElement.removeAttribute("data-target-group-id");
      return TabMoveStatus.Default;
    }

    // divide
    if (tabElementRect.x !== groupHeaderElementRect.x) return TabMoveStatus.Divide;
  }
}
