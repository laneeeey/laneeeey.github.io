// src/App.jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Summarizer from "./pages/Summarizer";

export default function App() {
  const location = useLocation();
  const [initUrl, setInitUrl] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const url = params.get("initUrl");
    if (url) {
      const decoded = decodeURIComponent(url);
      setInitUrl(decoded);
      console.log("초기화 URL:", decoded);
    } else {
      setInitUrl(null);
    }
  }, [location.search]);

  return (
    <div>
      <Summarizer initUrl={initUrl || ""} />
    </div>
  );
}
