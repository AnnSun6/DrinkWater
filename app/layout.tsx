import type { Metadata } from "next";
import "./globals.css";



export const metadata: Metadata = {
  title: "Drink Water",
  description: "This is an app to remind your friend to drink water",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
