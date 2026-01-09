import type { Metadata } from "next";

import { AfkViewport } from "../components/AfkViewport";
import { MapCanvasClient } from "./MapCanvasClient";

export const metadata: Metadata = {
  title: "AFK Map (Phaser)",
};

export default function AfkMapPage() {
  return (
    <AfkViewport>
      <MapCanvasClient />
    </AfkViewport>
  );
}
