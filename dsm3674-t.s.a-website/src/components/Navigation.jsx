import React, { useEffect, useState } from "react";
import { Archive, Menu, X } from "lucide-react";

export default function Navigation({ currentPage, setCurrentPage }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: "Home", page: "home" },
    { label: "Stories", page: "stories" },
    { label: "Timeline", page: "timeline" },
    { label: "Map", page: "map" },
    { label: "Archive", page: "archive" },
    { label: "Reference", page: "reference" },
    { label: "Mission", page: "mission" },
  ];

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleNavClick = (page) => {
    setCurrentPage(page);
    setMobileOpen(false);
  };

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <button
          className="brand-wordmark"
          onClick={() => handleNavClick("home")}
          aria-label="Go to home"
        >
          <span>Coppell</span>
          <strong>Archive</strong>
        </button>

        <button
          className="nav-monogram"
          onClick={() => handleNavClick("home")}
          aria-label="Coppell Archive home"
        >
          CA
        </button>

        <div className="nav-actions">
          <button className="archive-pill" onClick={() => handleNavClick("archive")}>
            <Archive size={18} />
            Archive
          </button>
          <button
            className="menu-pill"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="menu-overlay">
          <div className="menu-overlay-inner">
            <div className="menu-label">Pages</div>
            <div className="menu-links">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  className={`menu-link ${
                    currentPage === item.page ? "is-active" : ""
                  }`}
                  onClick={() => handleNavClick(item.page)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="menu-note">
              <span>Community record</span>
              <strong>TSA 2025</strong>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
