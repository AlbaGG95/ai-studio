import type { Metadata } from "next";

import { MapCanvasClient } from "./MapCanvasClient";

export const metadata: Metadata = {
  title: "AFK Map (Phaser)",
};

export default function AfkMapPage() {
  return <MapCanvasClient />;
}
