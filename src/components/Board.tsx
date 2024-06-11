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
    position: { x: number; y: number };
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

type ActionType = {
  type: "DIVIDE_TAB";
  payload: {
    groupId: string;
    tabId: string;
    tabOrder: number;
    clientX: number;
    clientY: number;
  };
};

const reducer = (state: ContextType, action: ActionType) => {
  switch (action.type) {
    case "DIVIDE_TAB":
      const { groupId, tabId, tabOrder, clientX, clientY } = action.payload;
      state.group[groupId].tabIds.splice(tabOrder, 1);

      const newGroupId = uuidv4();
      state.group[newGroupId] = {
        id: newGroupId,
        tabIds: [tabId],
        position: {
          x: clientX,
          y: clientY,
        },
      };
      return { ...state };
    default:
      return state;
  }
};

export const DataStateContext = createContext<ContextType>({
  group: {},
  tab: {},
});

export const DataDispatchContext = createContext<React.Dispatch<ActionType> | null>(null);

const Board: React.FC<{ children: React.ReactNode }> = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, dispatch] = useReducer(reducer, mock);

  return (
    <DataDispatchContext.Provider value={dispatch}>
      <DataStateContext.Provider value={state}>{children}</DataStateContext.Provider>
    </DataDispatchContext.Provider>
  );
};

const Container = ({ children }: { children: React.ReactNode }) => {
  const dataContext = useContext(DataStateContext);

  const handleMouseMove = (e: React.MouseEvent) => {
    const boardElement = document.querySelector("[data-board-is-dragging=true]");
    const groupHeaderElement = document.querySelector("[data-group-is-dragging=true]");
    const tabElement = document.querySelector("[data-tab-is-dragging=true]");
    const resizeElement = document.querySelector("[data-resize-is-dragging=true]");

    const groupIds = Object.keys(dataContext.group);

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

    if (tabElement && groupIds.length <= 1) {
      const dataAttrPositions = tabElement.getAttribute("data-positions");
      if (dataAttrPositions) {
        const positions = JSON.parse(dataAttrPositions) as any;
        const deltaX = e.clientX - positions.lastPosition.x;
        const deltaY = e.clientY - positions.lastPosition.y;
        positions.accPosition.x += deltaX;
        positions.accPosition.y += deltaY;
        tabElement.style.transform = `translate(${positions.accPosition.x}px, ${positions.accPosition.y}px)`;
        positions.lastPosition.x = e.clientX;
        positions.lastPosition.y = e.clientY;
        tabElement.setAttribute("data-positions", JSON.stringify(positions));
      }
      return;
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
      resizeElement.setAttribute("data-resize-is-dragging", "false");
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
  const { id: groupIdProp, position: initPositionProp } = props;

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
      left: initPositionProp.x,
      top: initPositionProp.y,
    }),
    [initPositionProp]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const groupElements = document.querySelectorAll("[data-group]");
    groupElements.forEach((groupElement) => {
      if (groupElement.id === e.currentTarget.id) {
        groupElement.style.zIndex = "1";
      } else {
        groupElement.style.zIndex = "initial";
      }
    });
  };

  return (
    <div
      ref={forwardedRef}
      style={dynamicStyle}
      className="absolute w-[400px] h-[400px] bg-gray-100"
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

const GroupHeader = React.forwardRef<React.ElementRef<"div">, IGroupProps>(
  (props, forwardedRef) => {
    const { tabIds, groupPositions } = props;
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
      if (headerElement) {
        headerElement.setAttribute("data-group-is-dragging", "false");
      }

      if (headerElement.parentElement) {
        const dataAttrPositions = headerElement.parentElement.getAttribute("data-positions");
        const positionsValue = JSON.parse(dataAttrPositions) as typeof positions;
        groupPositions.accPosition = positionsValue.accPosition;
      }
    };

    return (
      <div
        className="w-full h-[30px] cursor-pointer bg-orange-300"
        ref={groupHeaderRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        data-group-is-dragging={false}
      >
        {tabIds.map((tabId, idx) => (
          <Tab key={tabId} {...props} tabId={tabId} tabOrder={idx} />
        ))}
      </div>
    );
  }
);

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
      const tabElementRect = tabElement.getBoundingClientRect();
      const groupHeaderElementRect = tabElement.parentElement.getBoundingClientRect();

      if (
        Math.abs(tabElementRect.top - groupHeaderElementRect.top) <= 30 ||
        Math.abs(tabElementRect.left - groupHeaderElementRect.left) <= 30 ||
        Math.abs(tabElementRect.bottom - groupHeaderElementRect.bottom) <= 30 ||
        Math.abs(tabElementRect.right - groupHeaderElementRect.right) <= 30
      ) {
        tabElement.style.transform = "translate(0px, 0px)";
        tabElement.setAttribute("data-positions", JSON.stringify({ x: 0, y: 0 }));
      } else if (false) {
        // todo: combine tabs
      } else {
        dataDispatch({
          type: "DIVIDE_TAB",
          payload: {
            groupId: groupIdProp,
            tabId,
            tabOrder,
            clientX: e.clientX,
            clientY: e.clientY,
          },
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
const resizeHandlerVariants = cva("absolute bg-gray-300", {
  variants: {
    direction: {
      [ResizeDirection.Top]: "top-0 left-[10px] w-[calc(100%-20px)] h-[10px] cursor-ns-resize",
      [ResizeDirection.Bottom]:
        "bottom-0 left-[10px] w-[calc(100%-20px)] h-[10px] cursor-ns-resize",
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
