import { createElement, type ReactElement } from "react";
import "./index.css";
import { Composition, registerRoot } from "remotion";
import {
  CONTACT_SHEET_HEIGHT,
  CONTACT_SHEET_WIDTH,
  ContactSheet,
} from "./characters/ContactSheet";

/**
 * Dedicated entry for the character acceptance harness (docs/characters.md):
 * `npm run contact-sheet` bundles THIS file, not src/index.ts, so a still of
 * ContactSheet never drags in every genre pack's scene compositions. Only
 * Character/motion/theme are on this bundle's dependency graph — a v2-red
 * scene file elsewhere in the tree can't break this render.
 *
 * No JSX here on purpose: this file is .ts, and `<Composition />` syntax is
 * only valid in .tsx — createElement keeps the file a plain .ts module.
 */
const ContactSheetRoot = (): ReactElement =>
  createElement(Composition, {
    id: "ContactSheet",
    component: ContactSheet,
    fps: 30,
    width: CONTACT_SHEET_WIDTH,
    height: CONTACT_SHEET_HEIGHT,
    durationInFrames: 60,
  });

registerRoot(ContactSheetRoot);
