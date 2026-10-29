import type { Metadata } from "next";
import "./globals.css";

// Fonts (Inter + Noto Sans Ethiopic), next-intl and the `lang` toggle arrive in T0.6.
export const metadata: Metadata = {
  title: "Servaddis",
  description: "The hiring platform built only for hospitality.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
