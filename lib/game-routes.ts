export const GAME_HOME = "/game";
export const GAME_PENTAD = "/game/pentad";

export function isGameRoute(pathname: string) {
  return pathname === GAME_HOME || pathname.startsWith(`${GAME_HOME}/`) || pathname === "/battle" || pathname.startsWith("/battle/");
}
