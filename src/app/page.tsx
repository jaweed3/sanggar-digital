"use client";

import { useState } from "react";
import TariGame from "./components/TariGame";
import { DetailScreen } from "./components/home/DetailScreen";
import { HomeScreen } from "./components/home/HomeScreen";
import { SiteShell } from "./components/home/SiteShell";
import { movements, type Movement } from "./components/home/movements";

type Screen = "home" | "detail" | "practice";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<Movement>(movements[0]);
  const choose = (m: Movement) => {
    setSelected(m);
    setScreen("detail");
  };
  return (
    <SiteShell onHome={() => setScreen("home")}>
      {screen === "home" && <HomeScreen choose={choose} />}
      {screen === "detail" && <DetailScreen selected={selected} back={() => setScreen("home")} start={() => setScreen("practice")} />}
      {screen === "practice" && <TariGame back={() => setScreen("detail")} />}
    </SiteShell>
  );
}
