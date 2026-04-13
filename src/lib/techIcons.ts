import {
  SiPython,
  SiJavascript,
  SiTypescript,
  SiReact,
  SiCplusplus,
  SiC,
  SiSharp,
  SiDocker,
  SiGo,
  SiRust,
  SiSwift,
  SiKotlin,
  SiPhp,
  SiRuby,
  SiGit,
  SiGnubash,
  SiLinux,
  SiHtml5,
  SiCss,
  SiNodedotjs,
} from "react-icons/si";
import { FaJava } from "react-icons/fa6";
import {
  FaDatabase,
  FaNetworkWired,
  FaProjectDiagram,
  FaGlobe,
  FaCogs,
  FaStickyNote,
  FaSitemap,
  FaServer,
} from "react-icons/fa";
import { ComponentType } from "react";

export interface TechIconResult {
  Icon: ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  bg: string;
}

/** All canonical category definitions with official brand icons + colors */
export const CATEGORY_CATALOG = [
  { slug: "javascript", name: "JavaScript", description: "JavaScript & TypeScript notes", color: "#F7DF1E", bg: "rgba(247, 223, 30, 0.12)" },
  { slug: "typescript", name: "TypeScript", description: "TypeScript programming notes", color: "#3178C6", bg: "rgba(49, 120, 198, 0.15)" },
  { slug: "python", name: "Python", description: "Python programming notes", color: "#3776AB", bg: "rgba(55, 118, 171, 0.15)" },
  { slug: "sql", name: "SQL", description: "SQL & database query notes", color: "#E48E00", bg: "rgba(228, 142, 0, 0.12)" },
  { slug: "java", name: "Java", description: "Java programming notes", color: "#ED8B00", bg: "rgba(237, 139, 0, 0.12)" },
  { slug: "csharp", name: "C#", description: "C# and .NET programming notes", color: "#512BD4", bg: "rgba(81, 43, 212, 0.12)" },
  { slug: "c", name: "C", description: "C programming notes", color: "#A8B9CC", bg: "rgba(168, 185, 204, 0.12)" },
  { slug: "cpp", name: "C++", description: "C++ programming notes", color: "#00599C", bg: "rgba(0, 89, 156, 0.15)" },
  { slug: "ruby", name: "Ruby", description: "Ruby programming notes", color: "#CC342D", bg: "rgba(204, 52, 45, 0.12)" },
  { slug: "php", name: "PHP", description: "PHP programming notes", color: "#777BB4", bg: "rgba(119, 123, 180, 0.12)" },
  { slug: "go", name: "Go", description: "Go (Golang) programming notes", color: "#00ADD8", bg: "rgba(0, 173, 216, 0.12)" },
  { slug: "rust", name: "Rust", description: "Rust programming notes", color: "#DEA584", bg: "rgba(222, 165, 132, 0.12)" },
  { slug: "swift", name: "Swift", description: "Swift programming notes", color: "#FA7343", bg: "rgba(250, 115, 67, 0.12)" },
  { slug: "kotlin", name: "Kotlin", description: "Kotlin programming notes", color: "#7F52FF", bg: "rgba(127, 82, 255, 0.12)" },
  { slug: "bash", name: "Bash", description: "Shell scripting & Bash notes", color: "#4EAA25", bg: "rgba(78, 170, 37, 0.12)" },
  { slug: "html", name: "HTML", description: "HTML markup notes", color: "#E34F26", bg: "rgba(227, 79, 38, 0.12)" },
  { slug: "css", name: "CSS", description: "CSS styling notes", color: "#1572B6", bg: "rgba(21, 114, 182, 0.12)" },
  { slug: "react", name: "React", description: "React framework notes", color: "#61DAFB", bg: "rgba(97, 218, 251, 0.12)" },
  { slug: "data-structures", name: "Data Structures", description: "DSA and data structures", color: "#4ADE80", bg: "rgba(74, 222, 128, 0.12)" },
  { slug: "algorithms", name: "Algorithms", description: "Algorithm design & analysis", color: "#F472B6", bg: "rgba(244, 114, 182, 0.12)" },
  { slug: "devops", name: "DevOps", description: "DevOps, CI/CD, & infrastructure", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)" },
  { slug: "other", name: "Other", description: "Miscellaneous notes", color: "#9B8FC2", bg: "rgba(155, 143, 194, 0.12)" },
] as const;

/**
 * Maps a category slug to an official tech icon + brand color.
 * Uses CORRECT official logos — no Postgres for SQL, no Docker for DevOps.
 */
export function getTechIcon(slug: string): TechIconResult {
  const icons: Record<string, TechIconResult> = {
    // Core Languages
    python:     { Icon: SiPython, color: "#3776AB", bg: "rgba(55, 118, 171, 0.15)" },
    javascript: { Icon: SiJavascript, color: "#F7DF1E", bg: "rgba(247, 223, 30, 0.12)" },
    typescript: { Icon: SiTypescript, color: "#3178C6", bg: "rgba(49, 120, 198, 0.15)" },
    java:       { Icon: FaJava, color: "#ED8B00", bg: "rgba(237, 139, 0, 0.12)" },
    csharp:     { Icon: SiSharp, color: "#512BD4", bg: "rgba(81, 43, 212, 0.12)" },
    c:          { Icon: SiC, color: "#A8B9CC", bg: "rgba(168, 185, 204, 0.12)" },
    cpp:        { Icon: SiCplusplus, color: "#00599C", bg: "rgba(0, 89, 156, 0.15)" },
    "c-cpp":    { Icon: SiCplusplus, color: "#00599C", bg: "rgba(0, 89, 156, 0.15)" },
    "c-c++":    { Icon: SiCplusplus, color: "#00599C", bg: "rgba(0, 89, 156, 0.15)" },
    ruby:       { Icon: SiRuby, color: "#CC342D", bg: "rgba(204, 52, 45, 0.12)" },
    php:        { Icon: SiPhp, color: "#777BB4", bg: "rgba(119, 123, 180, 0.12)" },
    go:         { Icon: SiGo, color: "#00ADD8", bg: "rgba(0, 173, 216, 0.12)" },
    rust:       { Icon: SiRust, color: "#DEA584", bg: "rgba(222, 165, 132, 0.12)" },
    swift:      { Icon: SiSwift, color: "#FA7343", bg: "rgba(250, 115, 67, 0.12)" },
    kotlin:     { Icon: SiKotlin, color: "#7F52FF", bg: "rgba(127, 82, 255, 0.12)" },
    bash:       { Icon: SiGnubash, color: "#4EAA25", bg: "rgba(78, 170, 37, 0.12)" },

    // Web & Markup
    html:       { Icon: SiHtml5, color: "#E34F26", bg: "rgba(227, 79, 38, 0.12)" },
    css:        { Icon: SiCss, color: "#1572B6", bg: "rgba(21, 114, 182, 0.12)" },
    react:      { Icon: SiReact, color: "#61DAFB", bg: "rgba(97, 218, 251, 0.12)" },
    nodejs:     { Icon: SiNodedotjs, color: "#339933", bg: "rgba(51, 153, 51, 0.12)" },

    // SQL — generic database icon, NOT Postgres
    sql:        { Icon: FaDatabase, color: "#E48E00", bg: "rgba(228, 142, 0, 0.12)" },
    databases:  { Icon: FaDatabase, color: "#38BDF8", bg: "rgba(56, 189, 248, 0.12)" },

    // CS Concepts
    "data-structures": { Icon: FaProjectDiagram, color: "#4ADE80", bg: "rgba(74, 222, 128, 0.12)" },
    algorithms: { Icon: FaSitemap, color: "#F472B6", bg: "rgba(244, 114, 182, 0.12)" },

    // Infra & DevOps — generic gear icon, NOT Docker
    devops:     { Icon: FaServer, color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)" },
    docker:     { Icon: SiDocker, color: "#2496ED", bg: "rgba(36, 150, 237, 0.12)" },

    // Other
    git:        { Icon: SiGit, color: "#F05032", bg: "rgba(240, 80, 50, 0.12)" },
    linux:      { Icon: SiLinux, color: "#FCC624", bg: "rgba(252, 198, 36, 0.12)" },
    "web-dev":  { Icon: FaGlobe, color: "#A78BFA", bg: "rgba(167, 139, 250, 0.12)" },
    networking: { Icon: FaNetworkWired, color: "#FB923C", bg: "rgba(251, 146, 60, 0.12)" },
    other:      { Icon: FaStickyNote, color: "#9B8FC2", bg: "rgba(155, 143, 194, 0.12)" },
  };

  return icons[slug] || { Icon: FaCogs, color: "#9B8FC2", bg: "rgba(155, 143, 194, 0.10)" };
}
