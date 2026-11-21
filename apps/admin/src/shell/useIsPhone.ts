import { useEffect, useState } from "react";

const PHONE_QUERY = "(max-width: 47.99rem)";

/** True at phone width, where the side menu is an off-screen drawer. */
export function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia?.(PHONE_QUERY).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE_QUERY);
    if (!query) return;
    const onChange = () => setPhone(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return phone;
}
