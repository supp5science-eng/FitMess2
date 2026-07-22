/**
 * Pure unit conversions for the onboarding pickers. The app always *stores*
 * metric (cm, kg); these only convert for display when the user flips a
 * unit toggle, so the persisted value never depends on the chosen unit.
 * Tested in `__tests__/units.test.ts` (F015 money-math rule).
 */

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const LBS_PER_KG = 2.2046226218;

/** cm -> {feet, inches}, inches rounded to the nearest whole inch with the
 *  12" rollover handled (e.g. 11.6" -> +1 foot, 0"). */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = Math.round(totalInches - feet * INCHES_PER_FOOT);
  if (inches === INCHES_PER_FOOT) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

/** cm -> `6'1"` display string. */
export function formatFeetInches(cm: number): string {
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
}

/** kg -> whole lbs (rounded), for display only. */
export function kgToLbs(kg: number): number {
  return Math.round(kg * LBS_PER_KG);
}
