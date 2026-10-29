import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { PopoverContent } from "@/components/ui/popover";

// Search fields always open downwards. Keep horizontal viewport alignment
// without Radix's automatic vertical flip, and scroll the page when necessary.
export default function SearchPopoverContent({
  style,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverContent>) {
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const placed = useRef(false);
  const [shift, setShift] = useState(0);
  const [widthLimit, setWidthLimit] = useState<number>();
  const alignToViewport = useCallback(() => {
    // Measure the positioning wrapper, which is unaffected by our translation.
    const element = content,
      wrapper = element?.parentElement;
    if (!element || !wrapper || wrapper.style.transform.includes("-200%"))
      return;
    const rect = wrapper.getBoundingClientRect();
    if (!rect) return;
    const rightEdge = document.documentElement.clientWidth - 12;
    setWidthLimit(Math.max(0, rightEdge - 12));
    setShift(
      rect.left < 12
        ? 12 - rect.left
        : rect.right > rightEdge
          ? rightEdge - rect.right
          : 0,
    );
    if (!placed.current) {
      placed.current = true;
      const available = window.innerHeight - rect.top - 12;
      const desired = Math.min(
        element.scrollHeight,
        Math.max(200, window.innerHeight - 220),
      );
      if (rect.top > 200 && available < desired)
        window.scrollBy({
          top: rect.top - 200,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
    }
  }, [content]);
  useLayoutEffect(() => {
    const wrapper = content?.parentElement;
    if (!wrapper) {
      placed.current = false;
      setShift(0);
      return;
    }
    const resize = new ResizeObserver(alignToViewport);
    const position = new MutationObserver(alignToViewport);
    resize.observe(wrapper);
    position.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", alignToViewport);
    alignToViewport();
    return () => {
      resize.disconnect();
      position.disconnect();
      window.removeEventListener("resize", alignToViewport);
    };
  }, [alignToViewport]);
  return (
    <PopoverContent
      {...props}
      ref={setContent}
      side="bottom"
      avoidCollisions={false}
      style={{ ...style, maxWidth: widthLimit, translate: `${shift}px 0` }}
    />
  );
}
