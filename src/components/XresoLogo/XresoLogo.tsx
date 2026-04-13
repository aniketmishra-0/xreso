import Image from "next/image";
import styles from "./XresoLogo.module.css";

interface XresoLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function XresoLogo({
  size = 36,
  className = "",
  showText = true,
}: XresoLogoProps) {
  return (
    <div className={`${styles.logoWrap} ${className}`}>
      <div className={styles.logoMark} style={{ width: size, height: size }}>
        <Image
          src="/logo.png"
          alt="xreso logo"
          width={size}
          height={size}
          className={styles.logoImg}
          priority
        />
      </div>
      {showText && <span className={styles.logoText}>xreso</span>}
    </div>
  );
}
