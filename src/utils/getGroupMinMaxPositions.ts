export default function getGroupMinMaxPositions(containerRef: React.MutableRefObject<HTMLElement>, groupElement: HTMLElement) {
  const {
    offsetTop: containerTop,
    offsetLeft: containerLeft,
    clientWidth: containerWidth,
    clientHeight: containerHeight,
  } = containerRef.current;
  const { clientWidth: groupWidth, clientHeight: groupHeight } = groupElement;

  const minTop = containerTop;
  const maxTop = containerTop + containerHeight - groupHeight;
  const minLeft = containerLeft;
  const maxLeft = containerWidth - groupWidth;

  return { minTop, maxTop, minLeft, maxLeft };
}
