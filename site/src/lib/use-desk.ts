import { useEffect, useState } from "react";
import { emptyDesk, loadDesk, saveDesk, type DeskState } from "@/lib/desk";

export function useDesk() {
  const [desk, setDesk] = useState<DeskState>(emptyDesk);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDesk(loadDesk());
    setReady(true);
  }, []);

  function update(next: DeskState) {
    saveDesk(next);
    setDesk(next);
  }

  return { desk, ready, update };
}
