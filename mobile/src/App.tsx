import { useEffect } from "react";
import { TabBar, ToastHost } from "./components/ui";
import { useRoute } from "./lib/router";
import { applyTheme, settings } from "./lib/storage";
import { AlertsScreen } from "./screens/AlertsScreen";
import { AssistantScreen } from "./screens/AssistantScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MapScreen } from "./screens/MapScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { PlaceListScreen, InfoScreen, SettingsScreen } from "./screens/MoreSubScreens";
import { PlaceScreen } from "./screens/PlaceScreen";
import { ToolsScreen } from "./screens/ToolsScreen";

const TAB_PATHS = ["/", "/map", "/alerts", "/tools", "/more"];

export default function App() {
  const route = useRoute();
  const theme = settings.use().theme;

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  // Each screen starts at the top when you navigate to it.
  useEffect(() => {
    document.getElementById("screen")?.scrollTo(0, 0);
  }, [route.path, route.params.toString()]);

  let screen: React.ReactNode;
  switch (route.path) {
    case "/": screen = <HomeScreen />; break;
    case "/map": screen = <MapScreen />; break;
    case "/alerts": screen = <AlertsScreen />; break;
    case "/tools": screen = <ToolsScreen />; break;
    case "/more": screen = <MoreScreen />; break;
    case "/place": screen = <PlaceScreen params={route.params} />; break;
    case "/assistant": screen = <AssistantScreen params={route.params} />; break;
    case "/settings": screen = <SettingsScreen />; break;
    case "/saved": screen = <PlaceListScreen kind="saved" />; break;
    case "/history": screen = <PlaceListScreen kind="history" />; break;
    case "/help": screen = <InfoScreen kind="help" />; break;
    case "/about": screen = <InfoScreen kind="about" />; break;
    default: screen = <HomeScreen />;
  }

  const showTabs = TAB_PATHS.includes(route.path);
  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col overflow-hidden bg-bg text-ink shadow-2xl sm:border-x sm:border-line">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Globe and map screens fill the space; other screens scroll. */}
        {route.path === "/" || route.path === "/map" ? (
          screen
        ) : (
          <main id="screen" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {screen}
          </main>
        )}
        <ToastHost />
      </div>
      {showTabs && <TabBar active={route.path} />}
    </div>
  );
}
