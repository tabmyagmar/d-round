/**
 * The 担当者 by name ("佐藤 一郎、鈴木 花子"), or `null` with none, as the client and 就業先部署 lists
 * and details show them. App-level because both features carry 担当者.
 */
export const chargerNamesOf = (chargers: readonly { user: { name: string } }[]): string | null =>
  chargers.length > 0 ? chargers.map((charger) => charger.user.name).join("、") : null;
