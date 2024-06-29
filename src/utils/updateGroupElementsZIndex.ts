export const CustomZIndex = {
  default: "initial",
  selectedTab: "30",
  selectedGroup: "20",
} as const;

export default function updateGroupElementsZIndex(currentGroupId: string) {
  const groupElements = document.querySelectorAll("[data-group]");
  groupElements.forEach((groupElement) => {
    if (groupElement instanceof HTMLElement) {
      if (groupElement.id === currentGroupId) {
        groupElement.style.zIndex = CustomZIndex.selectedGroup;
      } else {
        groupElement.style.zIndex = CustomZIndex.default;
      }
    }
  });
}
