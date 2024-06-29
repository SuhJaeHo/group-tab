/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable @typescript-eslint/no-use-before-define */
// @ts-nocheck
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils";
import { v4 as uuidv4 } from "uuid";

import getGroupMinMaxPositions from "../utils/getGroupMinMaxPositions";
import mock from "../data/data.json";
import getTabMoveStatus, { TabMoveStatus } from "../utils/getTabMoveStatus";
import groupTabsMoveWhenTabOut from "../utils/groupTabsMoveWhenTabOut";
import groupTabsUpdatePositionWithTabOrder from "../utils/groupTabsUpdatePositionWithTabOrder";
import getGroupNewTabListWithTabOrder from "../utils/getGroupNewTabListWithTabOrder";
import updateGroupElementsZIndex, { CustomZIndex } from "../utils/updateGroupElementsZIndex";

interface IGroup {
  [key: string]: {
    id: string;
    tabIds: string[];
    size: { width: number; height: number };
    prevSize: { width: number; height: number };
    position: { x: number; y: number };
    prevPosition: { x: number; y: number };
  };
}
interface ITab {
  [key: string]: {
    id: string;
    groupId: string;
    name: string;
  };
}
export type ContextType = {
  group: IGroup;
  tab: ITab;
};

type ActionType =
  | {
      type: "DIVIDE_TAB";
      payload: {
        groupId: string;
        tabId: string;
        tabOrder: number;
        size: { width: number; height: number };
        clientX: number;
        clientY: number;
      };
    }
  | {
      type: "RESIZE_GROUP_BY_CLICK_HEADER";
      payload: {
        groupId: string;
        size: { width: number; height: number };
        prevSize: { width: number; height: number };
        containerOffset: { top: number; left: number };
        isFullScreen: boolean;
      };
    }
  | {
      type: "UPDATE_GROUP_POSITION";
      payload: {
        groupId: string;
        x: number;
        y: number;
      };
    }
  | {
      type: "UPDATE_GROUP_SIZE";
      payload: {
        groupId: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }
  | {
      type: "UPDATE_TAB_ORDER";
      payload: {
        groupId: string;
        tabIds: string[];
      };
    }
  | {
      type: "COMBINE_TAB";
      payload: {
        currGroupId: string;
        targetGroupId: string;
        currTabId: string;
        newTabIds: string[];
      };
    };

const reducer = (state: ContextType, action: ActionType) => {
  switch (action.type) {
    case "DIVIDE_TAB": {
      const { groupId, tabId, tabOrder, size, clientX, clientY } = action.payload;
      state.group[groupId].tabIds.splice(tabOrder, 1);

      const newGroupId = uuidv4();
      state.group[newGroupId] = {
        id: newGroupId,
        tabIds: [tabId],
        size,
        prevSize: { width: 0, height: 0 },
        position: {
          x: clientX,
          y: clientY,
        },
      };
      return { ...state };
    }
    case "RESIZE_GROUP_BY_CLICK_HEADER": {
      const { groupId, fullSize, prevSize, containerOffset, isFullScreen } = action.payload;
      if (!state.group[groupId]) return state;

      if (isFullScreen) {
        state.group[groupId].size = state.group[groupId].prevSize;
        state.group[groupId].position = state.group[groupId].prevPosition;
      } else {
        state.group[groupId].size = fullSize;
        state.group[groupId].prevSize = prevSize;
        state.group[groupId].prevPosition = state.group[groupId].position;
        state.group[groupId].position = { x: containerOffset.left, y: containerOffset.top };
      }
      return { ...state };
    }
    case "UPDATE_GROUP_POSITION": {
      const { groupId, x, y } = action.payload;
      if (!state.group[groupId]) return state;

      state.group[groupId].position = { x, y };
      return { ...state };
    }
    case "UPDATE_GROUP_SIZE": {
      const { groupId, x, y, width, height } = action.payload;
      if (!state.group[groupId]) return state;

      state.group[groupId].position = { x, y };
      state.group[groupId].size = { width, height };
      return { ...state };
    }
    case "UPDATE_TAB_ORDER": {
      const { groupId, tabIds } = action.payload;
      if (!state.group[groupId]) return state;

      state.group[groupId].tabIds = tabIds;
      return { ...state };
    }
    case "COMBINE_TAB": {
      const { currGroupId, targetGroupId, currTabId, newTabIds } = action.payload;
      if (!state.group[currGroupId]) return state;

      if (state.group[currGroupId].tabIds.length <= 1) {
        delete state.group[currGroupId];
      } else {
        const tabIdx = state.group[currGroupId].tabIds.indexOf(currTabId);
        state.group[currGroupId].tabIds.splice(tabIdx, 1);
      }
      state.group[targetGroupId].tabIds = newTabIds;
      return { ...state };
    }
    default:
      return state;
  }
};

export const DataStateContext = createContext<ContextType>({
  group: {},
  tab: {},
});

export const DataDispatchContext = createContext<React.Dispatch<ActionType> | null>(null);

const Board: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, mock);

  return (
    <DataDispatchContext.Provider value={dispatch}>
      <DataStateContext.Provider value={state}>{children}</DataStateContext.Provider>
    </DataDispatchContext.Provider>
  );
};

interface IPosition {
  x: number;
  y: number;
}

interface IPreview {
  size: { width: number; height: number };
  position: { x: number; y: number };
}

const Container = ({ children }: { children: React.ReactNode }) => {
  const containerRef = useRef<React.ElementRef<"div">>(null);
  const dataContext = useContext(DataStateContext);
  const dataDispatch = useContext(DataDispatchContext);

  const [showTabDividePreview, setShowTabDividePreview] = useState<null | IPreview>(null);
  const showTabDividePreviewRef = useRef<null | IPreview>(null);
  const prevCombineId = useRef("");

  useEffect(() => {
    showTabDividePreviewRef.current = showTabDividePreview;
  }, [showTabDividePreview]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const boardElement = document.querySelector("[data-board-is-dragging=true]");
    const groupHeaderElement = document.querySelector("[data-group-is-dragging=true]") as HTMLElement;
    const tabElement = document.querySelector("[data-tab-is-dragging=true]") as HTMLElement;
    const resizeElement = document.querySelector("[data-resize-is-dragging=true]");

    if (!boardElement || !containerRef.current) return;
    if (resizeElement) {
      const dataAttrPositions = resizeElement.getAttribute("data-position");
      const dataAttrDirection = resizeElement.getAttribute("data-direction");
      const dataGroupId = resizeElement.getAttribute("data-group-id");
      if (dataAttrDirection && dataGroupId) {
        const position = JSON.parse(dataAttrPositions) as IPosition;
        const direction = JSON.parse(dataAttrDirection) as IPosition;
        const groupElement = document.getElementById(dataGroupId);

        if (groupElement) {
          const deltaX = e.clientX - position.x;
          const deltaY = e.clientY - position.y;

          const { minTop, minLeft, maxLeft } = getGroupMinMaxPositions(containerRef, groupElement);

          const handleTop = () => {
            if (groupElement.clientHeight - deltaY <= 200) return;
            if (groupElement.offsetTop + deltaY <= minTop) {
              groupElement.style.height = `${groupElement.clientHeight + groupElement.offsetTop - containerRef.current.offsetTop}px`;
              groupElement.style.top = `${minTop}px`;
            } else {
              groupElement.style.top = `${groupElement.offsetTop + deltaY}px`;
              groupElement.style.height = `${groupElement.clientHeight - deltaY}px`;
              position.y = e.clientY;
            }
          };

          const handleBottom = () => {
            if (groupElement.clientHeight + deltaY <= 200) return;
            if (groupElement.clientHeight + deltaY >= containerRef.current.clientHeight - groupElement.offsetTop + containerRef.current.offsetTop) {
              groupElement.style.height = `${containerRef.current.clientHeight - groupElement.offsetTop + containerRef.current.offsetTop}px`;
            } else {
              groupElement.style.height = `${groupElement.clientHeight + deltaY}px`;
              position.y = e.clientY;
            }
          };

          const handleLeft = () => {
            if (groupElement.clientWidth - deltaX <= 350) return;
            const offsetRight = containerRef.current.offsetWidth - (groupElement.offsetLeft + groupElement.offsetWidth);
            if (groupElement.offsetLeft + deltaX <= minLeft) {
              groupElement.style.left = `${minLeft}px`;
              groupElement.style.width = `${containerRef.current.offsetWidth - offsetRight}px`;
            } else {
              groupElement.style.left = `${groupElement.offsetLeft + deltaX}px`;
              groupElement.style.width = `${groupElement.clientWidth - deltaX}px`;
              position.x = e.clientX;
            }
          };

          const handleRight = () => {
            if (groupElement.clientWidth + deltaX <= 350) return;
            if (groupElement.offsetLeft + deltaX >= maxLeft) {
              groupElement.style.width = `${containerRef.current.clientWidth - groupElement.offsetLeft}px`;
            } else {
              groupElement.style.width = `${groupElement.clientWidth + deltaX}px`;
              position.x = e.clientX;
            }
          };

          if (direction === ResizeDirection.Top) {
            handleTop();
          } else if (direction === ResizeDirection.Bottom) {
            handleBottom();
          } else if (direction === ResizeDirection.Left) {
            handleLeft();
          } else if (direction === ResizeDirection.Right) {
            handleRight();
          } else if (direction === ResizeDirection.TopLeft) {
            handleTop();
            handleLeft();
          } else if (direction === ResizeDirection.TopRight) {
            handleTop();
            handleRight();
          } else if (direction === ResizeDirection.BottomLeft) {
            handleBottom();
            handleLeft();
          } else {
            handleBottom();
            handleRight();
          }
          resizeElement.setAttribute("data-position", JSON.stringify(position));
        }
      }
      return;
    }

    if (tabElement) {
      handleMoveTab(e);
      const dataAttrPosition = tabElement.getAttribute("data-position");
      const dataGroupId = tabElement.getAttribute("data-group-id");
      if (dataAttrPosition && dataContext.group[dataGroupId] && dataContext.group[dataGroupId].tabIds.length > 1) {
        const position = JSON.parse(dataAttrPosition) as IPosition;
        const deltaX = e.clientX - position.x;
        const deltaY = e.clientY - position.y;
        tabElement.style.top = `${tabElement.offsetTop + deltaY}px`;
        tabElement.style.left = `${tabElement.offsetLeft + deltaX}px`;
        position.x = e.clientX;
        position.y = e.clientY;
        tabElement.setAttribute("data-position", JSON.stringify(position));
        return;
      }
    }

    if (groupHeaderElement && groupHeaderElement.parentElement && containerRef.current) {
      const dataAttrPosition = groupHeaderElement.parentElement.getAttribute("data-position");
      const groupElement = groupHeaderElement.parentElement;
      if (dataAttrPosition) {
        const position = JSON.parse(dataAttrPosition) as IPosition;
        const deltaX = e.clientX - position.x;
        const deltaY = e.clientY - position.y;

        let deltaTop = groupElement.offsetTop + deltaY;
        let deltaLeft = groupElement.offsetLeft + deltaX;

        const { minTop, maxTop, minLeft, maxLeft } = getGroupMinMaxPositions(containerRef, groupElement);
        if (deltaTop <= minTop) deltaTop = minTop;
        if (deltaTop >= maxTop) deltaTop = maxTop;
        if (deltaLeft <= minLeft) deltaLeft = minLeft;
        if (deltaLeft >= maxLeft) deltaLeft = maxLeft;

        groupElement.style.top = `${deltaTop}px`;
        groupElement.style.left = `${deltaLeft}px`;

        if (e.clientX <= containerRef.current.clientWidth) position.x = e.clientX;
        if (e.clientY >= 0) position.y = e.clientY;
        groupElement.setAttribute("data-position", JSON.stringify(position));
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    containerRef.current?.setAttribute("data-board-is-dragging", "true");
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    containerRef.current?.setAttribute("data-board-is-dragging", "false");
    handleMouseUpHeader(e);
    handleMouseUpResize(e);
    handleMouseUpTab(e);
  };

  const handleMouseUpHeader = (e: React.MouseEvent) => {
    const headerElement = document.querySelector("[data-group-is-dragging=true]");
    if (headerElement) {
      headerElement.setAttribute("data-group-is-dragging", "false");
      const dataGroupId = headerElement.getAttribute("data-group-id");
      const groupElement = document.getElementById(dataGroupId);
      if (groupElement) {
        dataDispatch({
          type: "UPDATE_GROUP_POSITION",
          payload: {
            groupId: dataGroupId,
            x: parseFloat(groupElement.style.left),
            y: parseFloat(groupElement.style.top),
          },
        });
      }
    }
  };

  const handleMouseUpResize = (e: React.MouseEvent) => {
    const resizeElement = document.querySelector("[data-resize-is-dragging=true]");
    if (resizeElement) {
      resizeElement.setAttribute("data-resize-is-dragging", "false");
      const dataGroupId = resizeElement.getAttribute("data-group-id");

      const groupElement = document.getElementById(dataGroupId);
      if (groupElement) {
        dataDispatch({
          type: "UPDATE_GROUP_SIZE",
          payload: {
            groupId: dataGroupId,
            x: parseFloat(groupElement.style.left),
            y: parseFloat(groupElement.style.top),
            width: groupElement.clientWidth,
            height: groupElement.clientHeight,
          },
        });
      }
    }
  };

  const handleMoveTab = (e: React.MouseEvent) => {
    const currentTabElement = document.querySelector("[data-tab-is-dragging=true]") as HTMLElement;
    const currentTabId = currentTabElement.getAttribute("data-tab-id");
    const currentGroupId = currentTabElement.getAttribute("data-group-id");
    const currentGroupHeaderElement = currentTabElement.parentElement;
    if (!currentTabElement || !currentGroupHeaderElement || !currentGroupId) return;
    const currentTabElementRect = currentTabElement.getBoundingClientRect();
    const currentTabLeft = currentTabElementRect.left + currentTabElementRect.width;

    const currentGroupElement = document.getElementById(currentGroupId);
    if (!currentGroupElement) return;

    const tabMoveStatus = getTabMoveStatus(dataContext);
    if (tabMoveStatus === TabMoveStatus.Divide) {
      // show tab indicator when tab catched to divide
      if (!containerRef.current || dataContext.group[currentGroupId].tabIds.length === 1) return;

      let deltaX = currentTabElementRect.left;
      let deltaY = currentTabElementRect.top;
      const { minTop, maxTop, minLeft, maxLeft } = getGroupMinMaxPositions(containerRef, currentGroupElement);
      if (deltaY < minTop) deltaY = minTop;
      if (deltaY > maxTop) deltaY = maxTop;
      if (deltaX < minLeft) deltaX = minLeft;
      if (deltaX > maxLeft) deltaX = maxLeft;

      const { clientWidth: containerWidth, clientHeight: containerHeight, offsetTop: containerTop } = containerRef.current;

      if (e.clientY <= 0) {
        setShowTabDividePreview({
          size: { width: containerWidth, height: containerHeight / 2 },
          position: {
            x: minLeft,
            y: containerTop,
          },
        });
        return;
      }

      if (e.clientY >= window.innerHeight) {
        setShowTabDividePreview({
          size: { width: containerWidth, height: containerHeight / 2 },
          position: {
            x: minLeft,
            y: containerHeight / 2 + containerTop,
          },
        });
        return;
      }

      if (e.clientX <= 0) {
        setShowTabDividePreview({
          size: { width: containerWidth / 2, height: containerHeight },
          position: {
            x: minLeft,
            y: containerTop,
          },
        });
        return;
      }

      if (e.clientX >= containerWidth) {
        setShowTabDividePreview({
          size: { width: containerWidth / 2, height: containerHeight },
          position: {
            x: containerWidth / 2,
            y: containerTop,
          },
        });
        return;
      }

      let dClientX = e.clientX;
      if (dClientX > maxLeft) dClientX = maxLeft;
      if (dClientX < minLeft) dClientX = minLeft;
      let dClientY = e.clientY;
      if (dClientY > maxTop) dClientY = maxTop;
      if (dClientY < minTop) dClientY = minTop;
      setShowTabDividePreview({
        size: { width: currentGroupElement.clientWidth, height: currentGroupElement.clientHeight },
        position: {
          x: dClientX,
          y: dClientY,
        },
      });

      // if current tab element is combined with other group element, make combined group element's tab move
      const combineGroupId = currentTabElement.getAttribute("data-combine-group-id");
      const combineGroupElement = document.getElementById(combineGroupId);
      if (combineGroupElement) {
        groupTabsMoveWhenTabOut(combineGroupElement, currentTabElement);
      }

      // if current tab element is divided, make current group element's tab move
      const currentTabIsDivided = currentTabElement.getAttribute("data-is-divided");
      if (currentTabIsDivided === "false") {
        groupTabsMoveWhenTabOut(currentGroupElement, currentTabElement);
      }
    } else if (tabMoveStatus === TabMoveStatus.Combine) {
      setShowTabDividePreview(null);

      const currentTabTempOrder = currentTabElement.getAttribute("data-tmp-order");
      const combineGroupId = currentTabElement.getAttribute("data-combine-group-id");
      const combineGroupElement = document.getElementById(combineGroupId);
      if (!combineGroupId || !combineGroupElement) return;
      const isCombined = currentTabElement.getAttribute("data-is-combined");

      // when current tab catched to combine to other groups, set current tab order number with combine group tabs
      if (isCombined === "false" || prevCombineId.current !== combineGroupId) {
        const prevCombineGroupElement = document.getElementById(prevCombineId.current);
        if (prevCombineGroupElement) {
          groupTabsMoveWhenTabOut(prevCombineGroupElement, currentTabElement);
        }
        prevCombineId.current = combineGroupId;
        updateGroupElementsZIndex(combineGroupId);

        if (currentGroupElement.querySelectorAll("[data-tab-id]").length > 1) {
          currentGroupElement.style.zIndex = CustomZIndex.default;
          combineGroupElement.style.zIndex = CustomZIndex.selectedGroup;
        }

        const currentGroupTabElements = currentGroupHeaderElement.querySelectorAll("[data-tab-id]");
        const currentTabIsDivided = currentTabElement.getAttribute("data-is-divided");
        if (currentTabIsDivided === "false") {
          currentGroupTabElements.forEach((tabElement) => {
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
                  tabElement.style.transform = `translate(-${currentTabElement.offsetWidth}px ,0px)`;
                  tabElement.setAttribute("data-transform-status", "-1");
                  tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) - 1));
                }
              }
            }
          });
          currentTabElement.setAttribute("data-is-divided", "true");
        }

        let currentTabNewOrder = 0;
        const combineGroupTabElements = combineGroupElement.querySelectorAll("[data-tab-id]");
        combineGroupTabElements.forEach((tabElement, idx) => {
          if (tabElement instanceof HTMLElement) {
            const tabTempOrder = tabElement.getAttribute("data-tmp-order");
            const tabTransformStatus = tabElement.getAttribute("data-transform-status");
            const tabLeft = tabElement.getBoundingClientRect().left + tabElement.offsetWidth;
            if (currentTabLeft < tabLeft) {
              if (tabTransformStatus === "-1") {
                tabElement.style.transform = "translate(0px, 0px)";
                tabElement.setAttribute("data-transform-status", "0");
                tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) + 1));
              } else if (tabTransformStatus === "1") {
              } else {
                tabElement.style.transform = `translate(${currentTabElement.offsetWidth}px, 0px)`;
                tabElement.setAttribute("data-transform-status", "1");
                tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) + 1));
              }
            } else {
              currentTabNewOrder = Number(tabTempOrder) + 1;
            }
          }
        });
        if (currentTabNewOrder >= combineGroupTabElements.length + 1) currentTabNewOrder = combineGroupTabElements.length;
        currentTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder));
        currentTabElement.setAttribute("data-is-combined", "true");
      } else {
        const combineGroupElementRect = combineGroupElement.getBoundingClientRect();
        let currentTabNewOrder = Math.floor(
          (currentTabLeft - combineGroupElementRect.left - currentTabElement.offsetWidth / 2) / currentTabElement.offsetWidth
        );
        if (currentTabNewOrder >= dataContext.group[combineGroupId].tabIds.length + 1) {
          currentTabNewOrder = dataContext.group[combineGroupId].tabIds.length;
        }
        if (currentTabNewOrder <= 0) currentTabNewOrder = 0;
        if (Number(currentTabTempOrder) === currentTabNewOrder) return;

        const targetTabElement = combineGroupElement.querySelector(`[data-tmp-order="${currentTabNewOrder}"]`);
        if (!targetTabElement) return;
        currentTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder));
        const targetTabTransformStatus = targetTabElement.getAttribute("data-transform-status");
        if (targetTabElement instanceof HTMLElement) {
          if (Number(currentTabTempOrder) > currentTabNewOrder) {
            targetTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder + 1));
            if (targetTabTransformStatus === "-1") {
              targetTabElement.style.transform = "translate(0px, 0px)";
              targetTabElement.setAttribute("data-transform-status", "0");
            } else {
              targetTabElement.style.transform = `translate(${currentTabElement.offsetWidth}px, 0px)`;
              targetTabElement.setAttribute("data-transform-status", "1");
            }
          } else {
            targetTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder - 1));
            if (targetTabTransformStatus === "1") {
              targetTabElement.style.transform = "translate(0px, 0px)";
              targetTabElement.setAttribute("data-transform-status", "0");
            } else {
              targetTabElement.style.transform = `translate(-${currentTabElement.offsetWidth}px, 0px)`;
              targetTabElement.setAttribute("data-transform-status", "-1");
            }
          }
        }
      }
    } else {
      setShowTabDividePreview(null);

      // if current tab was combined before, make combine group element's tab move
      const combineGroupId = currentTabElement.getAttribute("data-combine-group-id");
      const combineGroupElement = document.getElementById(combineGroupId);
      if (combineGroupElement) {
        groupTabsMoveWhenTabOut(combineGroupElement, currentTabElement);
      }

      const isDivided = currentTabElement.getAttribute("data-is-divided");
      if (isDivided === "true") {
        updateGroupElementsZIndex(currentGroupId);

        let currentTabNewOrder = 0;
        currentTabElement.setAttribute("data-is-divided", "false");
        const currentGroupTabElements = currentGroupElement.querySelectorAll("[data-tab-id]");
        currentGroupTabElements.forEach((tabElement, idx) => {
          if (tabElement instanceof HTMLElement) {
            const tabId = tabElement.getAttribute("data-tab-id");
            const tabTransformStatus = tabElement.getAttribute("data-transform-status");
            const tabTempOrder = tabElement.getAttribute("data-tmp-order");
            if (tabId === currentTabId) return;
            const tabLeft = tabElement.getBoundingClientRect().left + tabElement.offsetWidth;
            if (currentTabLeft < tabLeft) {
              if (tabTransformStatus === "-1") {
                tabElement.style.transform = "translate(0px, 0px)";
                tabElement.setAttribute("data-transform-status", "0");
                tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) + 1));
              } else if (tabTransformStatus === "1") {
              } else {
                if (Number(tabTempOrder) === currentGroupTabElements.length - 1) return;
                tabElement.style.transform = `translate(${currentTabElement.offsetWidth}px, 0px)`;
                tabElement.setAttribute("data-transform-status", "1");
                tabElement.setAttribute("data-tmp-order", JSON.stringify(Number(tabTempOrder) + 1));
              }
            } else {
              currentTabNewOrder = Number(tabTempOrder) + 1;
            }
          }
        });
        if (currentTabNewOrder >= currentGroupTabElements.length) currentTabNewOrder = currentGroupTabElements.length - 1;
        currentTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder));
        currentTabElement.setAttribute("data-is-divided", "false");
      } else {
        const currentGroupHeaderElementRect = currentGroupHeaderElement.getBoundingClientRect();
        const currentTabTempOrder = currentTabElement.getAttribute("data-tmp-order");
        let currentTabNewOrder = Math.floor(
          (currentTabLeft - currentGroupHeaderElementRect.left - currentTabElement.offsetWidth / 2) / currentTabElement.offsetWidth
        );
        if (currentTabNewOrder >= dataContext.group[currentGroupId].tabIds.length) {
          currentTabNewOrder = dataContext.group[currentGroupId].tabIds.length - 1;
        }
        if (currentTabNewOrder <= 0) currentTabNewOrder = 0;
        if (Number(currentTabTempOrder) === currentTabNewOrder) return;

        const targetTabElement = currentGroupHeaderElement.querySelector(`[data-tmp-order="${currentTabNewOrder}"]`);
        if (!targetTabElement) return;
        if (targetTabElement instanceof HTMLElement) {
          currentTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder));
          const targetTabTransformStatus = targetTabElement.getAttribute("data-transform-status");
          if (Number(currentTabTempOrder) > currentTabNewOrder) {
            targetTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder + 1));
            if (targetTabTransformStatus === "-1") {
              targetTabElement.style.transform = "translate(0px, 0px)";
              targetTabElement.setAttribute("data-transform-status", "0");
            } else {
              targetTabElement.style.transform = `translate(${currentTabElement.offsetWidth}px, 0px)`;
              targetTabElement.setAttribute("data-transform-status", "1");
            }
          } else {
            targetTabElement.setAttribute("data-tmp-order", JSON.stringify(currentTabNewOrder - 1));
            if (targetTabTransformStatus === "1") {
              targetTabElement.style.transform = "translate(0px, 0px)";
              targetTabElement.setAttribute("data-transform-status", "0");
            } else {
              targetTabElement.style.transform = `translate(-${currentTabElement.offsetWidth}px, 0px)`;
              targetTabElement.setAttribute("data-transform-status", "-1");
            }
          }
        }
      }
    }
  };

  const handleMouseUpTab = (e: React.MouseEvent) => {
    const tabElement = document.querySelector("[data-tab-is-dragging=true]") as HTMLElement;
    if (!tabElement) return;

    tabElement.style.zIndex = CustomZIndex.default;

    const tabMoveStatus = getTabMoveStatus(dataContext);
    tabElement.setAttribute("data-tab-is-dragging", "false");

    const currGroupId = tabElement.getAttribute("data-group-id");
    const currTabId = tabElement.getAttribute("data-tab-id");
    const currTabOrder = tabElement.getAttribute("data-tab-order");
    const currGroupElement = document.getElementById(currGroupId);
    const currGroupHeaderElement = tabElement.parentElement;
    if (!currGroupElement || !currGroupId || !currTabId || !currTabOrder || !tabElement.parentElement) return;

    if (tabMoveStatus === TabMoveStatus.Default) {
      const newTabIds = getGroupNewTabListWithTabOrder(currGroupHeaderElement, tabElement);
      dataDispatch({
        type: "UPDATE_TAB_ORDER",
        payload: {
          groupId: currGroupId,
          tabIds: newTabIds,
        },
      });

      groupTabsUpdatePositionWithTabOrder(currGroupHeaderElement, tabElement);
    } else if (tabMoveStatus === TabMoveStatus.Combine) {
      const combineGroupId = tabElement.getAttribute("data-combine-group-id");
      let combineGroupHeaderElement = null;
      document.querySelectorAll("[data-group-header]").forEach((groupHeaderElement) => {
        if (groupHeaderElement instanceof HTMLElement) {
          if (groupHeaderElement.getAttribute("data-group-id") === combineGroupId) {
            combineGroupHeaderElement = groupHeaderElement;
            return;
          }
        }
      });

      if (!combineGroupHeaderElement) return;
      const newTabIds = getGroupNewTabListWithTabOrder(combineGroupHeaderElement, tabElement);
      dataDispatch({
        type: "COMBINE_TAB",
        payload: {
          currGroupId,
          targetGroupId: combineGroupId,
          currTabId,
          newTabIds,
        },
      });

      groupTabsUpdatePositionWithTabOrder(combineGroupHeaderElement, tabElement);
      groupTabsUpdatePositionWithTabOrder(tabElement.parentElement, tabElement);

      tabElement.removeAttribute("data-combine-group-id");
      updateGroupElementsZIndex(combineGroupId);
    } else {
      if (dataContext.group[currGroupId].tabIds.length === 1) return;
      if (showTabDividePreviewRef.current) {
        groupTabsUpdatePositionWithTabOrder(tabElement.parentElement, tabElement);
        dataDispatch({
          type: "DIVIDE_TAB",
          payload: {
            groupId: currGroupId,
            tabId: currTabId,
            tabOrder: currTabOrder,
            size: { width: showTabDividePreviewRef.current.size.width, height: showTabDividePreviewRef.current.size.height },
            clientX: showTabDividePreviewRef.current.position.x,
            clientY: showTabDividePreviewRef.current.position.y,
          },
        });
      }
      const groupElements = document.querySelectorAll("[data-group]");
      groupElements.forEach((groupElement) => {
        groupElement.style.zIndex = CustomZIndex.default;
      });
    }
    setShowTabDividePreview(null);
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-[inherit] h-[inherit]">
      {children}
      {showTabDividePreview && (
        <div
          className="absolute border-2 border-green-500 bg-green-500/40 shadow-sm shadow-green-300 z-20"
          style={{
            top: `${showTabDividePreview.position.y}px`,
            left: `${showTabDividePreview.position.x}px`,
            width: `${showTabDividePreview.size.width}px`,
            height: `${showTabDividePreview.size.height}px`,
          }}
        />
      )}
    </div>
  );
};

const Groups = () => {
  const dataContext = useContext(DataStateContext);

  return (
    <React.Fragment>
      {Object.keys(dataContext.group).map((groupId) => (
        <Group key={groupId} {...dataContext.group[groupId]} />
      ))}
    </React.Fragment>
  );
};

interface IGroupProps {
  id: string;
  tabIds: string[];
  size: { width: number; height: number };
  position: { x: number; y: number };
}

const Group = React.forwardRef<React.ElementRef<"div">, IGroupProps>((props, forwardedRef) => {
  const { id: groupIdProp, size, position: initPositionProp } = props;

  const position = useMemo(
    () => ({
      x: 0,
      y: 0,
    }),
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    updateGroupElementsZIndex(e.currentTarget.id);
  };

  return (
    <div
      ref={forwardedRef}
      style={{ width: size.width, height: size.height, left: initPositionProp.x, top: initPositionProp.y }}
      className="absolute bg-gray-100"
      id={groupIdProp}
      onMouseDown={handleMouseDown}
      data-group
      data-position={JSON.stringify(position)}
    >
      <GroupHeader {...props} groupPositions={position} />
      <ResizeHandlers groupId={groupIdProp} />
      <div>{groupIdProp}</div>
    </div>
  );
});

const GroupHeader = React.forwardRef<React.ElementRef<"div">, IGroupProps>((props, forwardedRef) => {
  const { id: groupIdProp, tabIds, groupPositions } = props;
  const dataDispatch = useContext(DataDispatchContext);
  const groupHeaderRef = useRef<React.ElementRef<"div">>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const headerElement = e.currentTarget as HTMLElement;
    if (headerElement) {
      headerElement.setAttribute("data-group-is-dragging", "true");
      groupPositions.x = e.clientX;
      groupPositions.y = e.clientY;
      headerElement.parentElement?.setAttribute("data-position", JSON.stringify(groupPositions));
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const groupElement = e.currentTarget.parentElement;
    const containerElement = groupElement?.parentElement;
    if (groupElement && containerElement) {
      dataDispatch({
        type: "RESIZE_GROUP_BY_CLICK_HEADER",
        payload: {
          groupId: groupIdProp,
          fullSize: { width: containerElement.clientWidth, height: containerElement.clientHeight },
          prevSize: { width: groupElement.clientWidth, height: groupElement.clientHeight },
          containerOffset: { top: containerElement.offsetTop, left: containerElement.offsetLeft },
          isFullScreen: groupElement.clientWidth === containerElement.clientWidth && groupElement.clientHeight === containerElement.clientHeight,
        },
      });
    }
  };

  return (
    <div
      className="w-full h-[30px] cursor-pointer bg-gray-800"
      ref={groupHeaderRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      data-group-id={groupIdProp}
      data-group-is-dragging={false}
      data-group-header
    >
      {tabIds.map((tabId, idx) => (
        <Tab key={tabId} {...props} tabId={tabId} tabOrder={idx} />
      ))}
    </div>
  );
});

interface ITabProps extends IGroupProps {
  tabId: string;
  tabOrder: number;
}

const Tab = React.forwardRef<React.ElementRef<"div">, ITabProps>((props, forwardedRef) => {
  const { id: groupIdProp, tabId, tabOrder } = props;
  const dataContext = useContext(DataStateContext);
  const tabRef = useRef<React.ElementRef<"div">>(null);

  const position = useMemo(
    () => ({
      x: 0,
      y: 0,
    }),
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const tabElement = e.currentTarget as HTMLElement;
    if (tabElement) {
      tabElement.style.zIndex = CustomZIndex.selectedTab;
      tabElement.setAttribute("data-tab-is-dragging", "true");
      position.x = e.clientX;
      position.y = e.clientY;
      tabElement.setAttribute("data-position", JSON.stringify(position));
    }
  };

  return (
    <div
      className={`absolute flex justify-center items-center w-[60px] h-[30px] bg-gray-800/30 cursor-pointer transition-transform duration-300`}
      style={{ left: tabOrder * 60, border: `1px solid gray` }}
      ref={tabRef}
      onMouseDown={handleMouseDown}
      data-group-id={groupIdProp}
      data-tab-id={tabId}
      data-tab-order={tabOrder}
      data-tmp-order={tabOrder}
      data-tab-is-dragging={false}
      data-position={JSON.stringify(position)}
      data-transform-status="0"
      data-is-divided={false}
      data-is-combined={false}
    >
      <span className="text-yellow-300">{dataContext.tab[tabId].name}</span>
    </div>
  );
});

enum ResizeDirection {
  Top,
  Bottom,
  Left,
  Right,
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight,
}
const resizeHandlerVariants = cva("absolute", {
  variants: {
    direction: {
      [ResizeDirection.Top]: "top-0 left-[10px] w-[calc(100%-20px)] h-[10px] cursor-ns-resize",
      [ResizeDirection.Bottom]: "bottom-0 left-[10px] w-[calc(100%-20px)] h-[10px] cursor-ns-resize",
      [ResizeDirection.Left]: "left-0 top-[10px] w-[10px] h-[calc(100%-20px)] cursor-ew-resize",
      [ResizeDirection.Right]: "right-0 top-[10px] w-[10px] h-[calc(100%-20px)] cursor-ew-resize",
      [ResizeDirection.TopLeft]: "top-0 left-0 w-[10px] h-[10px] cursor-nwse-resize	",
      [ResizeDirection.TopRight]: "top-0 right-0 w-[10px] h-[10px] cursor-nesw-resize",
      [ResizeDirection.BottomLeft]: "bottom-0 left-0 w-[10px] h-[10px] cursor-nesw-resize",
      [ResizeDirection.BottomRight]: "bottom-0 right-0 w-[10px] h-[10px] cursor-nwse-resize",
    },
  },
});

const ResizeHandlers = ({ groupId }: { groupId: string }) => {
  const position = useMemo(
    () => ({
      x: 0,
      y: 0,
    }),
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const resizeElement = e.target as HTMLElement;
    if (resizeElement) {
      resizeElement.setAttribute("data-resize-is-dragging", "true");
      position.x = e.clientX;
      position.y = e.clientY;
      resizeElement.setAttribute("data-position", JSON.stringify(position));
    }
  };

  return (
    <React.Fragment>
      {Object.keys(ResizeDirection)
        .filter((key) => isNaN(key))
        .map((key) => (
          <div
            key={key}
            className={cn(resizeHandlerVariants({ direction: ResizeDirection[key] }))}
            onMouseDown={handleMouseDown}
            data-group-id={groupId}
            data-direction={JSON.stringify(ResizeDirection[key])}
            data-resize-is-dragging={false}
            data-position={JSON.stringify(position)}
          />
        ))}
    </React.Fragment>
  );
};

export default { Root: Board, Container, Groups, ResizeHandlers };
