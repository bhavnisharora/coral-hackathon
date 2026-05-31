import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata = {
  title: "Coral Agent",
  description: "AI-powered bug triage for engineering teams",
};

export default function RootLayout({ children }) {
  return (
     <html lang="en">
      <body>

        <Toaster position="top-right" />

        {children}

      </body>
    </html>
  );
}
