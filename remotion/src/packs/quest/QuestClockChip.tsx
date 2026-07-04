import { ClockChip } from "../ClockChip";
import { quest } from "./theme";

/** ClockChip in the quest palette — one wiring spot instead of five. */
export const QuestClockChip: React.FC = () => (
  <ClockChip color={quest.textDim} background={quest.panel} border={quest.panelBorder} />
);
