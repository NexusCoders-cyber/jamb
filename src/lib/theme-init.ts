/**
 * Theme constants + the tiny script that runs BEFORE the page paints.
 * (No "use client" here on purpose — the root layout is a server component and needs the string.)
 *
 * Without the script the page would first paint light and then flip to dark a moment later
 * (a white flash on every load). The script sets the `dark` class on <html> immediately.
 */
export const THEME_KEY = "qubit-theme";
export type ThemePref = "light" | "dark" | "system";

/** What new visitors get. Change to "system" to follow each phone's own dark-mode setting by default. */
export const DEFAULT_THEME: ThemePref = "light";

export const THEME_COLOR = { light: "#6557d9", dark: "#0d0c18" } as const;

export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(p!=="light"&&p!=="dark"&&p!=="system"){
  p=${JSON.stringify(DEFAULT_THEME)};
  try{var o=JSON.parse(localStorage.getItem("orbit_prefs")||"{}").theme;if(o==="light"||o==="dark")p=o;}catch(e){}
}
var d=p==="dark"||(p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;
if(d){r.classList.add("dark");r.style.colorScheme="dark";}else{r.style.colorScheme="light";}
}catch(e){}})();`;
