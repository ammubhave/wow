import {ScriptOnce} from "@tanstack/react-router";
import {createContext, useContext, useEffect} from "react";
import {useLocalStorage} from "usehooks-ts";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {children: React.ReactNode; defaultTheme?: Theme; storageKey?: string};

type ThemeProviderState = {theme: Theme; setTheme: (theme: Theme) => void};

const initialState: ThemeProviderState = {theme: "system", setTheme: () => null};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useLocalStorage<Theme>(storageKey, defaultTheme, {
    initializeWithValue: false,
  });

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      // Follow OS-level light/dark changes while the page is open.
      const query = window.matchMedia("(prefers-color-scheme: dark)");
      const applySystemTheme = () => {
        root.classList.remove("light", "dark");
        root.classList.add(query.matches ? "dark" : "light");
      };
      applySystemTheme();
      query.addEventListener("change", applySystemTheme);
      return () => query.removeEventListener("change", applySystemTheme);
    }

    root.classList.add(theme);
    return undefined;
  }, [theme]);

  const value: ThemeProviderState = {theme, setTheme};

  return (
    // oxlint-disable-next-line react/jsx-no-constructed-context-values -- React Compiler memoizes `value` (it only changes with `theme`).
    <ThemeProviderContext.Provider {...props} value={value}>
      {/* Apply the stored theme before first paint to avoid a flash of the wrong theme. */}
      <ScriptOnce>
        {`try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))||${JSON.stringify(defaultTheme)};if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.add(t)}catch(e){}`}
      </ScriptOnce>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
