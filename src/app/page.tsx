"use client";

import { useCallback, useState } from "react";
import TariGame from "./components/TariGame";
import { DetailScreen } from "./components/home/DetailScreen";
import { HomeScreen } from "./components/home/HomeScreen";
import { SiteShell } from "./components/home/SiteShell";
import { movements, type Movement } from "./components/home/movements";

type Screen = "home" | "detail" | "practice";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<Movement>(movements[0]);

  const choose = useCallback((m: Movement) => {
    setSelected(m);
    setScreen("detail");
  }, []);

  const goHome = useCallback(() => setScreen("home"), []);

  // "Jelajahi Gerak" harus menggulir ke bagian koleksi, bukan mengganti layar.
  const explore = useCallback(() => {
    setScreen("home");
    // Tunggu render home sebelum menggulir ke anchor.
    requestAnimationFrame(() => {
      document.getElementById("jelajahi")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  if (screen === "practice") {
    return (
      <SiteShell onHome={goHome} onExplore={explore} immersive={{ title: selected.title, onBack: () => setScreen("detail") }}>
        <TariGame back={() => setScreen("detail")} />
      </SiteShell>
    );
  }

  return (
    <SiteShell onHome={goHome} onExplore={explore}>
      {screen === "home" && <HomeScreen choose={choose} />}
      {screen === "detail" && (
        <DetailScreen selected={selected} back={goHome} start={() => setScreen("practice")} />
      )}
    </SiteShell>
  );
}
