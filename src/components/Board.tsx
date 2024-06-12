/* eslint-disable @typescript-eslint/no-use-before-define */
// @ts-nocheck
import React, { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils";
import { v4 as uuidv4 } from "uuid";

import mock from "../data/data.json";

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
  };
}
type ContextType = {
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
        isFullScreen: boolean;
      };
    }
  | {
      type: "UPDATE_GROUP_POSITION_WITH_TRANSFORM";
      payload: {
        groupId: string;
        transformValue: { x: number; y: number };
      };
    }
  | {
      type: "UPDATE_GROUP_POSITION";
      payload: {
        groupId: string;
        x: number;
        y: number;
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
      const { groupId, size, prevSize, isFullScreen } = action.payload;
      if (!state.group[groupId]) return state;

      if (isFullScreen) {
        state.group[groupId].size = state.group[groupId].prevSize;
        state.group[groupId].position = state.group[groupId].prevPosition;
      } else {
        state.group[groupId].size = size;
        state.group[groupId].prevSize = prevSize;
        state.group[groupId].prevPosition = state.group[groupId].position;
        state.group[groupId].position = { x: 0, y: 0 };
      }
      return { ...state };
    }
    case "UPDATE_GROUP_POSITION_WITH_TRANSFORM": {
      const { groupId, transformValue } = action.payload;
      if (!state.group[groupId]) return state;

      state.group[groupId].position = {
        x: state.group[groupId].position.x + transformValue.x,
        y: state.group[groupId].position.y + transformValue.y,
      };
      return { ...state };
    }
    case "UPDATE_GROUP_POSITION": {
      const { groupId, x, y } = action.payload;
      if (!state.group[groupId]) return state;

      state.group[groupId].position = { x, y };
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

const Container = ({ children }: { children: React.ReactNode }) => {
  const dataContext = useContext(DataStateContext);
  const dataDispatch = useContext(DataDispatchContext);

  const handleMouseMove = (e: React.MouseEvent) => {
    const boardElement = document.querySelector("[data-board-is-dragging=true]");
    const groupHeaderElement = document.querySelector("[data-group-is-dragging=true]");
    const tabElement = document.querySelector("[data-tab-is-dragging=true]");
    const resizeElement = document.querySelector("[data-resize-is-dragging=true]");

    if (!boardElement) return;
    if (resizeElement) {
      const dataAttrPositions = resizeElement.getAttribute("data-positions");
      const dataAttrDirection = resizeElement.getAttribute("data-direction");
      const dataGroupId = resizeElement.getAttribute("data-group-id");
      if (dataAttrDirection && dataGroupId) {
        const positions = JSON.parse(dataAttrPositions) as any;
        const direction = JSON.parse(dataAttrDirection) as any;
        const groupElement = document.getElementById(dataGroupId);

        if (groupElement) {
          const deltaX = e.clientX - positions.lastPosition.x;
          const deltaY = e.clientY - positions.lastPosition.y;

          const handleTop = () => {
            if (groupElement.clientHeight - deltaY <= 200) return;
            groupElement.style.top = `${groupElement.offsetTop + deltaY}px`;
            groupElement.style.height = `${groupElement.clientHeight - deltaY}px`;
            positions.lastPosition.y = e.clientY;
          };

          const handleBottom = () => {
            if (groupElement.clientHeight + deltaY <= 200) return;
            groupElement.style.height = `${groupElement.clientHeight + deltaY}px`;
            positions.lastPosition.y = e.clientY;
          };

          const handleLeft = () => {
            if (groupElement.clientWidth - deltaX <= 350) return;
            groupElement.style.left = `${groupElement.offsetLeft + deltaX}px`;
            groupElement.style.width = `${groupElement.clientWidth - deltaX}px`;
            positions.lastPosition.x = e.clientX;
          };

          const handleRight = () => {
            if (groupElement.clientWidth + deltaX <= 350) return;
            groupElement.style.width = `${groupElement.clientWidth + deltaX}px`;
            positions.lastPosition.x = e.clientX;
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
          resizeElement.setAttribute("data-positions", JSON.stringify(positions));
        }
      }
      return;
    }

    if (tabElement) {
      const dataAttrPositions = tabElement.getAttribute("data-positions");
      const dataGroupId = tabElement.getAttribute("data-group-id");
      if (dataAttrPositions && dataContext.group[dataGroupId] && dataContext.group[dataGroupId].tabIds.length > 1) {
        const positions = JSON.parse(dataAttrPositions) as any;
        const deltaX = e.clientX - positions.lastPosition.x;
        const deltaY = e.clientY - positions.lastPosition.y;
        positions.accPosition.x += deltaX;
        positions.accPosition.y += deltaY;
        tabElement.style.transform = `translate(${positions.accPosition.x}px, ${positions.accPosition.y}px)`;
        positions.lastPosition.x = e.clientX;
        positions.lastPosition.y = e.clientY;
        tabElement.setAttribute("data-positions", JSON.stringify(positions));
        return;
      }
    }

    if (groupHeaderElement && groupHeaderElement.parentElement) {
      const dataAttrPositions = groupHeaderElement.parentElement.getAttribute("data-positions");
      if (dataAttrPositions) {
        const positions = JSON.parse(dataAttrPositions) as any;
        const deltaX = e.clientX - positions.lastPosition.x;
        const deltaY = e.clientY - positions.lastPosition.y;
        positions.accPosition.x += deltaX;
        positions.accPosition.y += deltaY;
        groupHeaderElement.parentElement.style.transform = `translate(${positions.accPosition.x}px, ${positions.accPosition.y}px)`;
        positions.lastPosition.x = e.clientX;
        positions.lastPosition.y = e.clientY;
        groupHeaderElement.parentElement.setAttribute("data-positions", JSON.stringify(positions));
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const boardElement = e.currentTarget as HTMLElement;
    if (boardElement) {
      boardElement.setAttribute("data-board-is-dragging", "true");
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const boardElement = e.currentTarget as HTMLElement;
    if (boardElement) {
      boardElement.setAttribute("data-board-is-dragging", "false");
    }

    const resizeElement = document.querySelector("[data-resize-is-dragging=true]");
    if (resizeElement) {
      const dataGroupId = resizeElement.getAttribute("data-group-id");
      resizeElement.setAttribute("data-resize-is-dragging", "false");

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

  return (
    <div
      className="w-[inherit] h-[inherit]"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-board-is-dragging={false}
    >
      {children}
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

  const positions = useMemo(
    () => ({
      lastPosition: {
        x: 0,
        y: 0,
      },
      accPosition: {
        x: 0,
        y: 0,
      },
    }),
    []
  );

  const dynamicStyle = useMemo(
    () => ({
      width: size.width,
      height: size.height,
      left: initPositionProp.x,
      top: initPositionProp.y,
    }),
    [size, initPositionProp]
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
      style={dynamicStyle}
      className="absolute bg-gray-100"
      id={groupIdProp}
      onMouseDown={handleMouseDown}
      data-group
      data-positions={JSON.stringify(positions)}
    >
      <GroupHeader {...props} groupPositions={positions} />
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
      groupPositions.lastPosition.x = e.clientX;
      groupPositions.lastPosition.y = e.clientY;
      headerElement.parentElement?.setAttribute("data-positions", JSON.stringify(groupPositions));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const headerElement = e.currentTarget as HTMLElement;
    const gropuElement = headerElement.parentElement;
    if (headerElement) {
      headerElement.setAttribute("data-group-is-dragging", "false");
    }

    // update group position and reset translate property
    if (gropuElement) {
      const regex = /translate\((-?\d+)px,\s*(-?\d+)px\)/;
      const match = gropuElement.style.transform.match(regex);
      if (match) {
        dataDispatch({
          type: "UPDATE_GROUP_POSITION_WITH_TRANSFORM",
          payload: {
            groupId: groupIdProp,
            transformValue: { x: parseFloat(match[1]), y: parseFloat(match[2]) },
          },
        });
      }
      gropuElement.style.transform = `translate(0px, 0px)`;
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
          size: { width: containerElement.clientWidth, height: containerElement.clientHeight },
          prevSize: { width: groupElement.clientWidth, height: groupElement.clientHeight },
          isFullScreen:
            groupElement.clientWidth === containerElement.clientWidth &&
            groupElement.clientHeight === containerElement.clientHeight,
        },
      });
    }
  };

  return (
    <div
      className="w-full h-[30px] cursor-pointer bg-orange-300"
      ref={groupHeaderRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
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
  const dataDispatch = useContext(DataDispatchContext);
  const tabRef = useRef<React.ElementRef<"div">>(null);

  const positions = useMemo(
    () => ({
      lastPosition: {
        x: 0,
        y: 0,
      },
      accPosition: {
        x: 0,
        y: 0,
      },
    }),
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const tabElement = e.target as HTMLElement;
    if (tabElement) {
      tabElement.setAttribute("data-tab-is-dragging", "true");
      positions.lastPosition.x = e.clientX;
      positions.lastPosition.y = e.clientY;
      tabElement.setAttribute("data-positions", JSON.stringify(positions));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const tabElement = e.target as HTMLElement;
    if (tabElement && tabElement.parentElement) {
      tabElement.setAttribute("data-tab-is-dragging", "false");
      const dist = 10;
      const tabElementRect = tabElement.getBoundingClientRect();
      const groupHeaderElementRect = tabElement.parentElement.getBoundingClientRect();

      if (
        !(tabElementRect.x === groupHeaderElementRect.x) &&
        ((groupHeaderElementRect.left >= tabElementRect.left &&
          groupHeaderElementRect.left - (tabElementRect.left + tabElementRect.width) <= dist) ||
          (groupHeaderElementRect.left <= tabElementRect.left &&
            tabElementRect.left - (groupHeaderElementRect.left + groupHeaderElementRect.width) <= dist)) &&
        ((groupHeaderElementRect.top >= tabElementRect.top &&
          groupHeaderElementRect.top - (tabElementRect.top + tabElementRect.height) <= dist) ||
          (groupHeaderElementRect.top <= tabElementRect.top &&
            tabElementRect.top - (groupHeaderElementRect.top + groupHeaderElementRect.height) <= dist))
      ) {
        tabElement.style.transform = "translate(0px, 0px)";
        tabElement.setAttribute("data-positions", JSON.stringify({ x: 0, y: 0 }));
        return;
      }

      // combine tab
      // todo: combine tab to closest group
      let closestGroupId = "";
      const groupHeaderElements = document.querySelectorAll("[data-group-header]");
      groupHeaderElements.forEach((groupHeaderElement) => {
        const groupElement = groupHeaderElement.parentElement;
        if (groupElement) {
          if (groupElement.id === groupIdProp) return;
          const groupHeaderElementRect = groupHeaderElement.getBoundingClientRect();

          if (
            ((groupHeaderElementRect.left >= tabElementRect.left &&
              groupHeaderElementRect.left - (tabElementRect.left + tabElementRect.width) <= dist) ||
              (groupHeaderElementRect.left <= tabElementRect.left &&
                tabElementRect.left - (groupHeaderElementRect.left + groupHeaderElementRect.width) <= dist)) &&
            ((groupHeaderElementRect.top >= tabElementRect.top &&
              groupHeaderElementRect.top - (tabElementRect.top + tabElementRect.height) <= dist) ||
              (groupHeaderElementRect.top <= tabElementRect.top &&
                tabElementRect.top - (groupHeaderElementRect.top + groupHeaderElementRect.height) <= dist))
          ) {
            dataDispatch({
              type: "COMBINE_TAB",
              payload: {
                currGroupId: groupIdProp,
                targetGroupId: groupElement.id,
                tabId,
              },
            });
            closestGroupId = groupElement.id;
            return;
          }
        }
      });
      if (closestGroupId !== "") return;

      // divide tab
      const groupElement = document.getElementById(groupIdProp);
      if (groupElement && tabElementRect.x !== groupHeaderElementRect.x) {
        dataDispatch({
          type: "DIVIDE_TAB",
          payload: {
            groupId: groupIdProp,
            tabId,
            tabOrder,
            size: { width: groupElement.clientWidth, height: groupElement.clientHeight },
            clientX: e.clientX,
            clientY: e.clientY,
          },
        });
        const groupElements = document.querySelectorAll("[data-group]");
        groupElements.forEach((groupElement) => {
          groupElement.style.zIndex = "initial";
        });
      }
    }
  };

  const dynamicStyle = useMemo(
    () => ({
      left: tabOrder * 60,
    }),
    [tabOrder]
  );

  return (
    <div
      style={dynamicStyle}
      className="absolute w-[60px] h-[30px] bg-blue-300 cursor-pointer border-r-2"
      ref={tabRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-group-id={groupIdProp}
      data-tab-id={tabId}
      data-tab-is-dragging={false}
      data-positions={JSON.stringify(positions)}
    />
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
  const dataDispatch = useContext(DataDispatchContext);

  const positions = useMemo(
    () => ({
      lastPosition: {
        x: 0,
        y: 0,
      },
      accPosition: {
        x: 0,
        y: 0,
      },
    }),
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const resizeElement = e.target as HTMLElement;
    if (resizeElement) {
      resizeElement.setAttribute("data-resize-is-dragging", "true");
      positions.lastPosition.x = e.clientX;
      positions.lastPosition.y = e.clientY;
      resizeElement.setAttribute("data-positions", JSON.stringify(positions));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const resizeElement = e.target as HTMLElement;
    if (resizeElement) {
      resizeElement.setAttribute("data-resize-is-dragging", "false");
    }

    const groupElement = document.getElementById(groupId);
    if (groupElement) {
      dataDispatch({
        type: "UPDATE_GROUP_POSITION",
        payload: {
          groupId,
          x: parseFloat(groupElement.style.left),
          y: parseFloat(groupElement.style.top),
        },
      });
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
            onMouseUp={handleMouseUp}
            data-direction={JSON.stringify(ResizeDirection[key])}
            data-resize-is-dragging={false}
            data-positions={JSON.stringify(positions)}
            data-group-id={groupId}
          />
        ))}
    </React.Fragment>
  );
};

export default { Root: Board, Container, Groups, ResizeHandlers };
