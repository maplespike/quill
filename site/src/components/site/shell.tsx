import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="content">{children}</main>
      <Footer />
    </>
  );
}
