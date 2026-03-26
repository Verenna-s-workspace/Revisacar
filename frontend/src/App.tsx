import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home/home";
import Login from "./pages/login";

export default function App() {
  return (
    <main>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </main>
  );
}


