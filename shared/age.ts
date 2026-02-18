/**
 * Northern Hemisphere: official birthday is January 1
 * Southern Hemisphere: official birthday is August 1
 * A horse born Dec 31 turns 1 on Jan 1 (the next day)
 */
export function calculateOfficialAge(
  birthTimestamp: number,
  hemisphere: "northern" | "southern" = "northern",
  asOfDate: Date = new Date(),
): number {
  const birthDate = new Date(birthTimestamp * 1000);
  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  const officialMonth = hemisphere === "northern" ? 0 : 7; // 0=Jan, 7=Aug
  const officialDay = 1;

  // Find the year of the first official birthday on or after birth
  let firstOfficialYear = birthYear;
  if (
    officialMonth < birthMonth ||
    (officialMonth === birthMonth && officialDay < birthDay)
  ) {
    firstOfficialYear++;
  }

  const asOfYear = asOfDate.getUTCFullYear();
  const asOfMonth = asOfDate.getUTCMonth();
  const asOfDay = asOfDate.getUTCDate();

  const birthdayPassed =
    asOfMonth > officialMonth ||
    (asOfMonth === officialMonth && asOfDay >= officialDay);

  if (birthdayPassed) {
    return Math.max(0, asOfYear - firstOfficialYear + 1);
  }
  return Math.max(0, asOfYear - firstOfficialYear);
}
