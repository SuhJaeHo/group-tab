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
  | { type: "COMBINE_TAB"; payload: { currGroupId: string; targetGroupId: string; tabId: string; tabOrder: number } }
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
    case "COMBINE_TAB": {
      const { currGroupId, targetGroupId, tabId } = action.payload;
      // todo: combine tab to closest group
      if (!state.group[currGroupId]) return state;

      if (state.group[currGroupId].tabIds.length <= 1) {
        delete state.group[currGroupId];
      } else {
        const tabIdx = state.group[currGroupId].tabIds.indexOf(tabId);
        state.group[currGroupId].tabIds.splice(tabIdx, 1);
      }
      state.group[targetGroupId].tabIds.push(tabId);
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
            if (
              groupElement.clientHeight + deltaY >=
              containerRef.current.clientHeight - groupElement.offsetTop + containerRef.current.offsetTop
            ) {
              groupElement.style.height = `${
                containerRef.current.clientHeight - groupElement.offsetTop + containerRef.current.offsetTop
              }px`;
            } else {
              groupElement.style.height = `${groupElement.clientHeight + deltaY}px`;
              position.y = e.clientY;
            }
          };

          const handleLeft = () => {
            if (groupElement.clientWidth - deltaX <= 350) return;
            if (groupElement.offsetLeft + deltaX <= minLeft) {
              groupElement.style.left = `${minLeft}px`;
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
    const tabElement = document.querySelector("[data-tab-is-dragging=true]") as HTMLElement;
    const currGroupId = tabElement.getAttribute("data-group-id");
    if (!tabElement || !currGroupId) return;

    const tabMoveStatus = getTabMoveStatus(dataContext);

    if (tabMoveStatus === TabMoveStatus.Divide) {
      const currGroupElement = document.getElementById(currGroupId);

      if (!containerRef.current || !currGroupElement || dataContext.group[currGroupId].tabIds.length === 1) return;
      const tabElementRect = tabElement.getBoundingClientRect();
      let deltaX = tabElementRect.left;
      let deltaY = tabElementRect.top;
      const { minTop, maxTop, minLeft, maxLeft } = getGroupMinMaxPositions(containerRef, currGroupElement);
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

      let dClientX = e.clientX > maxLeft ? maxLeft : e.clientX < minLeft ? minLeft : e.clientX;
      let dClientY = e.clientY > maxTop ? maxTop : e.clientY < minTop ? minTop : e.clientY;
      setShowTabDividePreview({
        size: { width: currGroupElement.clientWidth, height: currGroupElement.clientHeight },
        position: {
          x: dClientX,
          y: dClientY,
        },
      });

      // tab move when tab catched to divide
      const currTabTmpOrder = tabElement.getAttribute("data-tmp-order");
      const currTabTmpOrderNumber = Number(currTabTmpOrder);
      if (!currTabTmpOrder || !tabElement.parentElement) return;

      if (tabElement.getAttribute("data-is-divided") === "true") return;
      const tabElements = tabElement.parentElement.querySelectorAll("[data-tab-id]");
      tabElements.forEach((tabElement) => {
        const tabTmpOrder = tabElement.getAttribute("data-tmp-order");
        const tabTmpOrderNumber = Number(tabTmpOrder);
        const tabTransformStatus = tabElement.getAttribute("data-transform-status");
        if (tabTmpOrderNumber === currTabTmpOrderNumber) return;
        if (tabTmpOrderNumber > currTabTmpOrderNumber && tabElement instanceof HTMLElement) {
          if (tabTransformStatus === "1") {
            tabElement.style.transform = `translate(0px, 0px)`;
            tabElement.setAttribute("data-transform-status", "0");
            tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber - 1));
          } else if (tabTransformStatus === "-1") {
            tabElement.style.transform = `translate(0px, 0px)`;
            tabElement.setAttribute("data-transform-status", "0");
            tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber + 1));
          } else {
            tabElement.style.transform = `translate(-${tabElementRect.width}px ,0px)`;
            tabElement.setAttribute("data-transform-status", "-1");
            tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber - 1));
          }
        }
      });
      tabElement.setAttribute("data-is-divided", "true");
    } else {
      setShowTabDividePreview(null);

      const combineTargetGroupId = tabElement.getAttribute("data-target-group-id");
      const currTabId = tabElement.getAttribute("data-tab-id");
      const currTabOrder = tabElement.getAttribute("data-tmp-order");
      const currTabOrderNumber = Number(currTabOrder);
      const currTabIsDivided = tabElement.getAttribute("data-is-divided");
      if (!currTabId || !currTabOrder || !currTabIsDivided || !tabElement.parentElement) return;

      if (combineTargetGroupId) {
        const tabElementRect = tabElement.getBoundingClientRect();
        const currTabTmpOrder = tabElement.getAttribute("data-tmp-order");
        const currTabTmpOrderNumber = Number(currTabTmpOrder);
        if (!currTabTmpOrder || !tabElement.parentElement) return;
        if (tabElement.getAttribute("data-is-divided") === "true") return;
        const tabElements = tabElement.parentElement.querySelectorAll("[data-tab-id]");
        tabElements.forEach((tabElement) => {
          const tabTmpOrder = tabElement.getAttribute("data-tmp-order");
          const tabTmpOrderNumber = Number(tabTmpOrder);
          const tabTransformStatus = tabElement.getAttribute("data-transform-status");
          if (tabTmpOrderNumber === currTabTmpOrderNumber) return;
          if (tabTmpOrderNumber > currTabTmpOrderNumber && tabElement instanceof HTMLElement) {
            if (tabTransformStatus === "1") {
              tabElement.style.transform = `translate(0px, 0px)`;
              tabElement.setAttribute("data-transform-status", "0");
              tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber - 1));
            } else if (tabTransformStatus === "-1") {
              tabElement.style.transform = `translate(0px, 0px)`;
              tabElement.setAttribute("data-transform-status", "0");
              tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber + 1));
            } else {
              tabElement.style.transform = `translate(-${tabElementRect.width}px ,0px)`;
              tabElement.setAttribute("data-transform-status", "-1");
              tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber - 1));
            }
          }
        });
        tabElement.setAttribute("data-is-divided", "true");
      } else {
        const tabElementRect = tabElement.getBoundingClientRect();
        const groupHeaderElementRect = tabElement.parentElement?.getBoundingClientRect();
        const currTabLeft = tabElementRect.left + tabElementRect.width;

        if (currTabIsDivided === "true") {
          let newOrder = 0;
          tabElement.setAttribute("data-is-divided", "false");
          const tabElements = tabElement.parentElement.querySelectorAll("[data-tab-id]");
          tabElements.forEach((tabElement, idx) => {
            if (tabElement instanceof HTMLElement) {
              const tabId = tabElement.getAttribute("data-tab-id");
              const tabTransformStatus = tabElement.getAttribute("data-transform-status");
              const tabTmpOrder = tabElement.getAttribute("data-tmp-order");
              const tabTmpOrderNumber = Number(tabTmpOrder);
              if (tabId === currTabId) return;
              const targetTabLeft = tabElement.getBoundingClientRect().left + tabElement.offsetWidth;
              if (currTabLeft < targetTabLeft) {
                if (tabTransformStatus === "-1") {
                  tabElement.style.transform = "translate(0px, 0px)";
                  tabElement.setAttribute("data-transform-status", "0");
                  tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber + 1));
                } else if (tabTransformStatus === "1") {
                } else {
                  tabElement.style.transform = `translate(${tabElementRect.width}px, 0px)`;
                  tabElement.setAttribute("data-transform-status", "1");
                  tabElement.setAttribute("data-tmp-order", JSON.stringify(tabTmpOrderNumber + 1));
                }
              } else {
                newOrder = idx + 1;
              }
            }
          });
          tabElement.setAttribute("data-tmp-order", JSON.stringify(newOrder));
          return;
        }

        let newOrder = Math.floor((currTabLeft - groupHeaderElementRect.left - tabElementRect.width / 2) / tabElementRect.width);
        if (newOrder >= dataContext.group[currGroupId].tabIds.length) newOrder = dataContext.group[currGroupId].tabIds.length - 1;
        if (newOrder <= 0) newOrder = 0;
        if (currTabOrderNumber === newOrder) return;
        const targetTabElement = tabElement.parentElement.querySelector(`[data-tmp-order="${newOrder}"]`);
        if (!targetTabElement) return;
        tabElement.setAttribute("data-tmp-order", JSON.stringify(newOrder));
        const targetTabElementTransformStatus = targetTabElement.getAttribute("data-transform-status");
        if (targetTabElement && targetTabElement instanceof HTMLElement) {
          if (currTabOrderNumber > newOrder) {
            targetTabElement.setAttribute("data-tmp-order", JSON.stringify(newOrder + 1));
            if (targetTabElementTransformStatus === "-1") {
              targetTabElement.style.transform = "translate(0px, 0px)";
              targetTabElement.setAttribute("data-transform-status", "0");
            } else {
              targetTabElement.style.transform = `translate(${tabElementRect.width}px, 0px)`;
              targetTabElement.setAttribute("data-transform-status", "1");
            }
          } else {
            targetTabElement.setAttribute("data-tmp-order", JSON.stringify(newOrder - 1));
            if (targetTabElementTransformStatus === "1") {
              targetTabElement.style.transform = "translate(0px, 0px)";
              targetTabElement.setAttribute("data-transform-status", "0");
            } else {
              targetTabElement.style.transform = `translate(${-tabElementRect.width}px, 0px)`;
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

    const tabMoveStatus = getTabMoveStatus(dataContext);
    tabElement.setAttribute("data-tab-is-dragging", "false");

    const currGroupId = tabElement.getAttribute("data-group-id");
    const currTabId = tabElement.getAttribute("data-tab-id");
    const currTabOrder = tabElement.getAttribute("data-tab-order");
    const currGroupElement = document.getElementById(currGroupId);
    if (!currGroupElement || !currGroupId || !currTabId || !currTabOrder || !tabElement.parentElement) return;

    if (tabMoveStatus === TabMoveStatus.Default) {
      const newTabIds = [];
      tabElement.parentElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
        const tabId = tabElement.getAttribute("data-tab-id");
        const tabOrder = tabElement.getAttribute("data-tmp-order");
        if (tabElement instanceof HTMLElement) {
          tabElement.classList.remove("transition-transform", "duration-300");
          tabElement.style.left = `${Number(tabOrder) * tabElement.offsetWidth}px`;
          tabElement.style.transform = "translate(0px, 0px)";
        }
        if (tabId && tabOrder) {
          newTabIds[Number(tabOrder)] = tabId;
        }
        tabElement.setAttribute("data-tmp-order", tabOrder);
      });
      dataDispatch({
        type: "UPDATE_TAB_ORDER",
        payload: {
          groupId: currGroupId,
          tabIds: newTabIds,
        },
      });
      const newTabOrder = tabElement.getAttribute("data-tab-order");
      if (newTabOrder) {
        tabElement.style.top = "0px";
        tabElement.style.left = `${Number(newTabOrder) * tabElement.offsetWidth}px`;
        tabElement.style.transform = "translate(0px, 0px)";
        tabElement.setAttribute("data-position", JSON.stringify({ x: 0, y: 0 }));
      }
      tabElement.parentElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
        if (tabElement instanceof HTMLElement) {
          tabElement.classList.add("transition-transform", "duration-300");
          tabElement.setAttribute("data-transform-status", "0");
        }
      });
    } else if (tabMoveStatus === TabMoveStatus.Combine) {
      tabElement.parentElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
        const tabOrder = tabElement.getAttribute("data-tab-order");
        if (tabElement instanceof HTMLElement) {
          tabElement.classList.remove("transition-transform", "duration-300");
          tabElement.style.left = `${Number(tabOrder) * tabElement.offsetWidth}px`;
          tabElement.style.transform = "translate(0px, 0px)";
        }
      });
      const newTabOrder = tabElement.getAttribute("data-tab-order");
      if (newTabOrder) {
        tabElement.style.top = "0px";
        tabElement.style.left = `${Number(newTabOrder) * tabElement.offsetWidth}px`;
        tabElement.style.transform = "translate(0px, 0px)";
        tabElement.setAttribute("data-position", JSON.stringify({ x: 0, y: 0 }));
      }
      tabElement.parentElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
        if (tabElement instanceof HTMLElement) {
          tabElement.classList.add("transition-transform", "duration-300");
          tabElement.setAttribute("data-transform-status", "0");
        }
      });
      const targetGroupId = tabElement.getAttribute("data-target-group-id");
      dataDispatch({
        type: "COMBINE_TAB",
        payload: {
          currGroupId,
          targetGroupId,
          tabId: currTabId,
        },
      });
      tabElement.removeAttribute("data-target-group-id");
      const groupElements = document.querySelectorAll("[data-group]");
      groupElements.forEach((groupElement) => {
        groupElement.style.zIndex = "initial";
      });
    } else {
      if (dataContext.group[currGroupId].tabIds.length === 1) return;
      if (showTabDividePreviewRef.current) {
        tabElement.parentElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
          const tabOrder = tabElement.getAttribute("data-tab-order");
          if (tabElement instanceof HTMLElement) {
            tabElement.classList.remove("transition-transform", "duration-300");
            tabElement.style.left = `${Number(tabOrder) * tabElement.offsetWidth}px`;
            tabElement.style.transform = "translate(0px, 0px)";
          }
        });
        const newTabOrder = tabElement.getAttribute("data-tab-order");
        if (newTabOrder) {
          tabElement.style.top = "0px";
          tabElement.style.left = `${Number(newTabOrder) * tabElement.offsetWidth}px`;
          tabElement.style.transform = "translate(0px, 0px)";
          tabElement.setAttribute("data-position", JSON.stringify({ x: 0, y: 0 }));
        }
        tabElement.parentElement.querySelectorAll("[data-tab-id]").forEach((tabElement) => {
          if (tabElement instanceof HTMLElement) {
            tabElement.classList.add("transition-transform", "duration-300");
            tabElement.setAttribute("data-transform-status", "0");
          }
        });
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
        groupElement.style.zIndex = "initial";
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
    const groupElements = document.querySelectorAll("[data-group]");
    groupElements.forEach((groupElement) => {
      if (groupElement.id === e.currentTarget.id) {
        groupElement.style.zIndex = "20";
      } else {
        groupElement.style.zIndex = "initial";
      }
    });
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
          isFullScreen:
            groupElement.clientWidth === containerElement.clientWidth && groupElement.clientHeight === containerElement.clientHeight,
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
