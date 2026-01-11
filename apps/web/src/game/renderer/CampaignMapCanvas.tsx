import GameCanvas, { type SceneFactory } from "./GameCanvas";

type CampaignMapCanvasProps = {
  sceneFactory: SceneFactory;
  backgroundColor?: string;
};

export default function CampaignMapCanvas({ sceneFactory, backgroundColor }: CampaignMapCanvasProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
      }}
    >
      <GameCanvas sceneFactory={sceneFactory} backgroundColor={backgroundColor ?? "#0b1224"} />
    </div>
  );
}
