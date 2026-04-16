import type { CSSProperties } from "react";
import { FaJava } from "react-icons/fa6";
import type { IconType } from "react-icons";
import {
  SiAnsible,
  SiCplusplus,
  SiDocker,
  SiGrafana,
  SiGo,
  SiJavascript,
  SiKubernetes,
  SiLinux,
  SiPrometheus,
  SiPython,
  SiRust,
  SiTerraform,
  SiTypescript,
} from "react-icons/si";
import Logo from "./Logo";
import styles from "./HeroDigitalLibraryDashboard.module.css";

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

export type HeroOrbitMode = "programming" | "advanced";

const PROGRAMMING_NODES: OrbitNode[] = [
  { id: "rust", label: "Rust", x: 50, y: 14, size: 88, Icon: SiRust, color: "#DEA584", delay: 0 },
  { id: "go", label: "Go", x: 74, y: 28, size: 84, Icon: SiGo, color: "#00ADD8", delay: 0.12 },
  { id: "typescript", label: "TypeScript", x: 75, y: 56, size: 86, Icon: SiTypescript, color: "#3178C6", delay: 0.24 },
  { id: "javascript", label: "JavaScript", x: 50, y: 74, size: 90, Icon: SiJavascript, color: "#F7DF1E", delay: 0.36 },
  { id: "cpp", label: "C++", x: 25, y: 56, size: 86, Icon: SiCplusplus, color: "#00599C", delay: 0.48 },
  { id: "python", label: "Python", x: 26, y: 28, size: 84, Icon: SiPython, color: "#3776AB", delay: 0.6 },
  { id: "java", label: "Java", x: 64, y: 43, size: 78, Icon: FaJava, color: "#ED8B00", delay: 0.72 },
];

const ADVANCED_NODES: OrbitNode[] = [
  { id: "kubernetes", label: "Kubernetes", x: 50, y: 14, size: 88, Icon: SiKubernetes, color: "#326CE5", delay: 0 },
  { id: "linux", label: "Linux", x: 74, y: 28, size: 84, Icon: SiLinux, color: "#FCC624", delay: 0.12 },
  { id: "docker", label: "Docker", x: 75, y: 56, size: 86, Icon: SiDocker, color: "#2496ED", delay: 0.24 },
  { id: "terraform", label: "Terraform", x: 50, y: 74, size: 90, Icon: SiTerraform, color: "#844FBA", delay: 0.36 },
  { id: "ansible", label: "Ansible", x: 25, y: 56, size: 86, Icon: SiAnsible, color: "#EE0000", delay: 0.48 },
  { id: "prometheus", label: "Prometheus", x: 26, y: 28, size: 84, Icon: SiPrometheus, color: "#E6522C", delay: 0.6 },
  { id: "grafana", label: "Grafana", x: 64, y: 43, size: 78, Icon: SiGrafana, color: "#F46800", delay: 0.72 },
];

interface HeroDigitalLibraryDashboardProps {
  mode?: HeroOrbitMode;
}

function getNodePosition(node: OrbitNode): CSSProperties {
  return {
    left: `${node.x}%`,
    top: `${node.y}%`,
  };
}

function getNodeHaloStyle(node: OrbitNode): CSSProperties {
  const haloSize = node.size + 40;

  return {
    width: haloSize,
    height: haloSize,
    marginLeft: -haloSize / 2,
    marginTop: -haloSize / 2,
    animationDelay: `${node.delay}s`,
    background:
      "radial-gradient(circle, color-mix(in srgb, var(--primary) 34%, transparent), color-mix(in srgb, var(--primary) 5%, transparent) 58%, transparent 74%)",
  };
}

function getNodeBadgeStyle(node: OrbitNode): CSSProperties {
  return {
    width: node.size,
    height: node.size,
    borderColor: `${node.color}44`,
    background: `${node.color}14`,
    animationDelay: `${node.delay}s`,
  };
}

function getNodeRingStyle(node: OrbitNode): CSSProperties {
  return {
    borderColor: `${node.color}44`,
    background: `${node.color}14`,
  };
}

function getNodeIconStyle(node: OrbitNode): CSSProperties {
  return {
    color: node.color,
    filter:
      "drop-shadow(0 0 5px rgba(255,255,255,0.52)) drop-shadow(0 0 10px var(--primary-glow))",
  };
}

export default function HeroDigitalLibraryDashboard({
  mode = "programming",
}: HeroDigitalLibraryDashboardProps) {
  const nodes = mode === "advanced" ? ADVANCED_NODES : PROGRAMMING_NODES;

  return (
    <div
      className={styles.orbit}
      aria-label={`${mode === "advanced" ? "Advanced stack" : "Programming stack"} logos constellation`}
    >
      <div className={styles.orbitGlow} />
      <div className={styles.innerRing} />
      <div className={styles.outerRing} />
      <div className={styles.centerAura} />

      <div className={styles.nodesLayer}>
        {nodes.map((node) => (
          <div
            key={node.id}
            className={styles.nodePosition}
            style={getNodePosition(node)}
            aria-label={`${node.label} tech logo`}
          >
            <div className={styles.nodeMotion}>
              <span className={styles.nodeHalo} style={getNodeHaloStyle(node)} />
              <div className={styles.nodeBadge} style={getNodeBadgeStyle(node)}>
                <span className={styles.nodeRing} style={getNodeRingStyle(node)} />
                <node.Icon className={styles.nodeIcon} style={getNodeIconStyle(node)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.centerWrap}>
        <div className={styles.centerShell}>
          <span className={styles.centerBorder} />
          <div className={styles.centerInner}>
            <Logo className={styles.centerLogo} />
          </div>
        </div>
      </div>
    </div>
  );
}
