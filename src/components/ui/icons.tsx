import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.5l1.9 5.3a4 4 0 0 0 2.3 2.3l5.3 1.9-5.3 1.9a4 4 0 0 0-2.3 2.3L12 21.5l-1.9-5.3a4 4 0 0 0-2.3-2.3L2.5 12l5.3-1.9a4 4 0 0 0 2.3-2.3L12 2.5z" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21.5 12 3 4.5l3 7.5-3 7.5L21.5 12z" />
    </Icon>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </Icon>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5.5a3 3 0 0 1 6 0v5a3 3 0 0 1-.4 1.5M5.5 11a6.5 6.5 0 0 0 9.8 5.6M12 17.5V21M3 3l18 18" />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21.5 7v10l-6-3.5z" />
    </Icon>
  );
}

export function VideoOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 10.5 21.5 7v10M2.5 8.5A2.5 2.5 0 0 1 5 6h8.5a2 2 0 0 1 2 2v7.5a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5zM3 3l18 18" />
    </Icon>
  );
}

export function PhoneOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 9.5c6-4 13-4 19 0v3.2a1.7 1.7 0 0 1-1.9 1.7l-3-.4a1.7 1.7 0 0 1-1.5-1.5l-.2-1.7a12.5 12.5 0 0 0-5.8 0l-.2 1.7A1.7 1.7 0 0 1 7.4 14l-3 .4a1.7 1.7 0 0 1-1.9-1.7z" />
    </Icon>
  );
}

export function ScreenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.5A2 2 0 0 1 5 6.5h2l1.3-2h7.4l1.3 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </Icon>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12h4l2.5-6 4 12 2.5-6h6" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 2.5 20h19L12 3.5z" />
      <path d="M12 10v4M12 17.2v.1" />
    </Icon>
  );
}
