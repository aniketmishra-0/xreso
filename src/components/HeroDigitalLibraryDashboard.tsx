"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FaJava } from "react-icons/fa6";
import type { IconType } from "react-icons";
import {
  SiCplusplus,
  SiGo,
  SiJavascript,
  SiPython,
  SiRust,
  SiTypescript,
} from "react-icons/si";
import { useEffect, useState } from "react";

type OrbitNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  Icon: IconType;
  color: string;
  delay: number;
};

const ORBIT_DURATION = 38;

const NODES: OrbitNode[] = [
  { id: "rust", label: "Rust", x: 50, y: 14, size: 88, Icon: SiRust, color: "#DEA584", delay: 0 },
  { id: "go", label: "Go", x: 74, y: 28, size: 84, Icon: SiGo, color: "#00ADD8", delay: 0.12 },
  { id: "typescript", label: "TypeScript", x: 75, y: 56, size: 86, Icon: SiTypescript, color: "#3178C6", delay: 0.24 },
  { id: "javascript", label: "JavaScript", x: 50, y: 74, size: 90, Icon: SiJavascript, color: "#F7DF1E", delay: 0.36 },
  { id: "cpp", label: "C++", x: 25, y: 56, size: 86, Icon: SiCplusplus, color: "#00599C", delay: 0.48 },
  { id: "python", label: "Python", x: 26, y: 28, size: 84, Icon: SiPython, color: "#3776AB", delay: 0.6 },
  { id: "java", label: "Java", x: 64, y: 43, size: 78, Icon: FaJava, color: "#ED8B00", delay: 0.72 },
];

export default function HeroDigitalLibraryDashboard() {
  const reducedMotion = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActive((prev) => (prev + 1) % NODES.length);
    }, 1700);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [reducedMotion]);

  const orbitGlowBackground =
    "radial-gradient(circle, color-mix(in srgb, var(--primary) 26%, transparent) 0%, color-mix(in srgb, var(--primary) 8%, transparent) 42%, transparent 74%)";
  const centerAuraBackground = "color-mix(in srgb, var(--primary) 14%, transparent)";
  const innerRingColor = "color-mix(in srgb, var(--primary) 22%, transparent)";
  const outerRingColor = "color-mix(in srgb, var(--primary-light) 20%, transparent)";
  const iconShadowFilter =
    "drop-shadow(0 0 5px rgba(255,255,255,0.52)) drop-shadow(0 0 10px var(--primary-glow))";

  return (
    <motion.div
      className="pointer-events-none relative mx-auto h-[560px] w-full max-w-[780px] overflow-visible select-none"
      animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
      transition={
        reducedMotion
          ? undefined
          : {
              duration: 9,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }
      }
      aria-label="Floating tech logos constellation"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 blur-[36px]"
        style={{ background: orbitGlowBackground }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: innerRingColor }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[438px] w-[438px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: outerRingColor }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 blur-[62px]"
        style={{ background: centerAuraBackground }}
      />

      <motion.div
        className="absolute inset-0"
        animate={reducedMotion ? undefined : { rotate: [0, -360] }}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: ORBIT_DURATION,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }
        }
      >
        {NODES.map((node, index) => {
          const isActive = active === index;

          return (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              aria-label={`${node.label} tech logo`}
            >
              <motion.div
                animate={reducedMotion ? undefined : { rotate: [0, 360] }}
                transition={
                  reducedMotion
                    ? undefined
                    : {
                        duration: ORBIT_DURATION,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }
                }
                className="relative"
              >
                <span
                  className="pointer-events-none absolute"
                  style={{
                    left: -20,
                    top: -20,
                    width: node.size + 40,
                    height: node.size + 40,
                    background:
                      "radial-gradient(circle, color-mix(in srgb, var(--primary) 34%, transparent), color-mix(in srgb, var(--primary) 5%, transparent) 58%, transparent 74%)",
                    opacity: isActive ? 0.88 : 0.42,
                    filter: "blur(14px)",
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-[12%] rounded-full border"
                  style={{
                    borderColor: `${node.color}44`,
                    background: `${node.color}14`,
                  }}
                />

                <motion.div
                  initial={reducedMotion ? false : { opacity: 0.82, scale: 0.95 }}
                  animate={
                    reducedMotion
                      ? { opacity: isActive ? 1 : 0.86, scale: isActive ? 1.06 : 1 }
                      : {
                          opacity: isActive ? 1 : 0.84,
                          y: [0, -4, 0, 3, 0],
                          scale: isActive ? [1, 1.09, 1] : [1, 1.02, 1],
                        }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.25, ease: "easeOut" }
                      : {
                          duration: 6 + node.delay,
                          delay: node.delay,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }
                  }
                  className="relative z-10 flex items-center justify-center"
                  style={{ width: node.size, height: node.size }}
                >
                  <node.Icon
                    className="h-[78%] w-[78%]"
                    style={{
                      color: node.color,
                      filter: iconShadowFilter,
                    }}
                  />
                </motion.div>
              </motion.div>
            </div>
          );
        })}
      </motion.div>

      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="relative flex h-[130px] w-[130px] items-center justify-center overflow-hidden rounded-full"
          style={{
            background: "color-mix(in srgb, var(--bg-surface) 42%, transparent)",
            boxShadow: "0 0 28px var(--primary-glow)",
          }}
          animate={reducedMotion ? undefined : { scale: [1, 1.03, 1] }}
          transition={
            reducedMotion
              ? undefined
              : {
                  duration: 4.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
          }
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full border"
            style={{ borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
          />
          <div
            className="relative z-10 flex h-[86px] w-[86px] items-center justify-center rounded-full border"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
              background: "color-mix(in srgb, var(--bg-primary) 30%, transparent)",
            }}
          >
            <span
              className="text-[26px] font-black tracking-[-0.06em]"
              style={{
                background: "var(--gradient-brand)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              xreso
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
