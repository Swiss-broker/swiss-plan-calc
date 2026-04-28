import { useEffect, useRef } from "react";

/**
 * Léger effet parallax / tilt 3D sur pointer move.
 * - Utilise requestAnimationFrame, ne touche jamais au state React,
 *   donc aucun re-render et aucun impact sur les calculs.
 * - Désactivé automatiquement si prefers-reduced-motion est activé,
 *   ou sur les écrans tactiles (pour iPad/iPhone => pas de jitter).
 */
export function useParallaxTilt<T extends HTMLElement>(options?: {
  max?: number; // angle max en degrés
  scale?: number; // scale au hover
  perspective?: number;
}) {
  const ref = useRef<T | null>(null);
  const max = options?.max ?? 5;
  const scale = options?.scale ?? 1.01;
  const perspective = options?.perspective ?? 900;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const apply = () => {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      el.style.transform = `perspective(${perspective}px) rotateX(${currentY.toFixed(2)}deg) rotateY(${currentX.toFixed(2)}deg) scale(${scale})`;
      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        frame = requestAnimationFrame(apply);
      } else {
        frame = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      targetX = (px - 0.5) * 2 * max;
      targetY = -(py - 0.5) * 2 * max;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onEnter = () => {
      el.style.willChange = "transform";
      el.style.transition = "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      el.style.transform = "";
      el.style.willChange = "";
    };
  }, [max, scale, perspective]);

  return ref;
}
