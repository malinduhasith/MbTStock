import seed from "./inventory.json";
import { WorkshopApp } from "../components/workshop-app";
import { InventoryItem } from "../lib/inventory";

export default function HomePage() {
  return <WorkshopApp seed={seed as InventoryItem[]} />;
}
