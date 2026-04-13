"use client";

import Link from "next/link";
import { getTechIcon } from "@/lib/techIcons";
import styles from "./CategoryCard.module.css";

interface CategoryCardProps {
  name: string;
  slug: string;
  description: string;
  noteCount: number;
  icon: string;
  gradient: string;
}

export default function CategoryCard({
  name,
  slug,
  description,
  noteCount,
}: CategoryCardProps) {
  const { Icon, color, bg } = getTechIcon(slug);

  return (
    <Link
      href={`/browse?category=${slug}`}
      className={styles.card}
      id={`category-${slug}`}
    >
      <div className={styles.iconWrap} style={{ background: bg }}>
        <Icon size={26} color={color} className={styles.icon} />
      </div>
      <div className={styles.content}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.description}>{description}</p>
        <span className={styles.count}>{noteCount} notes</span>
      </div>
      <div className={styles.arrow}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
      <div className={styles.glowBg} style={{ background: color }} />
    </Link>
  );
}
