import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts:
 *   /  → Focus search (navigate to bookmarks with search focus)
 *   g d → Go to Dashboard
 *   g b → Go to Bookmarks
 *   g i → Go to Import
 *   g e → Go to Export
 *   g t → Go to Tags
 *   g c → Go to Collections
 *   ? → Show help (console log for now)
 */
export default function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimer = null;

    const handler = (e) => {
      // Don't fire if user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) {
        return;
      }

      const key = e.key;

      // "/" → navigate to bookmarks with search focus
      if (key === "/") {
        e.preventDefault();
        navigate("/bookmarks?search=");
        // Focus the search input after navigation
        setTimeout(() => {
          const input = document.querySelector('input[placeholder="Search bookmarks..."]');
          if (input) input.focus();
        }, 100);
        return;
      }

      // "?" → log help
      if (key === "?") {
        e.preventDefault();
        console.log(
          "Keyboard shortcuts:\n" +
          "  /     → Search bookmarks\n" +
          "  g d   → Dashboard\n" +
          "  g b   → Bookmarks\n" +
          "  g i   → Import\n" +
          "  g e   → Export\n" +
          "  g t   → Tags\n" +
          "  g c   → Collections\n" +
          "  ?     → Show this help"
        );
        return;
      }

      // "g" prefix for navigation
      if (key === "g" && !gPressed) {
        gPressed = true;
        gTimer = setTimeout(() => { gPressed = false; }, 500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimer);
        const routes = {
          d: "/",
          b: "/bookmarks",
          i: "/import",
          e: "/export",
          t: "/tags",
          c: "/collections",
        };
        if (routes[key]) {
          e.preventDefault();
          navigate(routes[key]);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
