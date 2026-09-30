import Image from "next/image";

/**
 * Qubit brand mark — the official logo everywhere (app shells, admin
 * portal, landing/onboarding, signup, blog, favicon, PWA icon).
 * The source PNG has rounded corners + transparency baked in; pick the
 * smallest asset that covers the render size to keep payloads light.
 */
export default function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const src = size <= 96 ? "/logo-192.png" : "/logo-512.png";
  return (
    <Image
      src={src}
      alt="Qubit logo"
      width={size}
      height={size}
      priority={size >= 64}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
