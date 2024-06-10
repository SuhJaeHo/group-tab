// @ts-nocheck
import React, { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import mock from "../data/data.json";

interface IGroup {
  [key: string]: {
    id: string;
    tabIds: string[];
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

  const handleMouseMove = (e: React.MouseEvent) => {
    const groupHeaderElement = document.querySelector("[data-group-is-dragging=true]");
    const tabElement = document.querySelector("[data-tab-is-dragging=true]");

    const groupIds = Object.keys(dataContext.group);

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

  return (
    <div className="w-[inherit] h-[inherit]" onMouseMove={handleMouseMove}>
      <Groups />
    </div>
  );
};

interface IGroupProps {
  id: string;
  tabIds: string[];
  position: { x: number; y: number };
}

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

const Group = React.forwardRef<React.ElementRef<"div">, IGroupProps>((props, forwardedRef) => {
  const { id: groupIdProp, tabIds, position: initPositionProp } = props;
  const groupHeaderRef = useRef<React.ElementRef<"div">>(null);

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
    const headerElement = e.currentTarget as HTMLElement;
    if (headerElement) {
      headerElement.setAttribute("data-group-is-dragging", "true");
      positions.lastPosition.x = e.clientX;
      positions.lastPosition.y = e.clientY;
      headerElement.parentElement?.setAttribute("data-positions", JSON.stringify(positions));
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
      positions.accPosition = positionsValue.accPosition;
    }
  };

  const dynamicStyle = useMemo(
    () => ({
      left: initPositionProp.x,
      top: initPositionProp.y,
    }),
    [initPositionProp]
  );

  return (
    <div
      ref={forwardedRef}
      style={dynamicStyle}
      className="absolute w-[400px] h-[400px] bg-gray-100"
      data-positions={JSON.stringify(positions)}
    >
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
      <div>{groupIdProp}</div>
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

export default { Root: Board, Container, Groups };
