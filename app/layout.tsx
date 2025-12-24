import type { Metadata } from "next";
import { Toaster } from 'react-hot-toast'  
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
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              marginTop: '50vh',  
              transform: 'translateY(-50%)',
            },
          }}
        />
      </body>
    </html>
  );
}
