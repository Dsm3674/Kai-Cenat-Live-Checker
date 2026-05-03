import React, { useState, useEffect } from "react";
import { CheckCircle, Search } from "lucide-react";

import { communityImages } from "../data/communityAssets";


export default function ArchivePage() {
  const [submitted, setSubmitted] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobile, setIsMobile] = useState(false);

  const categories = ["All", "Food", "Arts", "Social Services", "Mutual Aid"];

  const resources = [
    {
      title: "Coppell Farmers Market",
      link: "https://coppellfarmersmarket.org/",
      img: communityImages.farmers,
      category: "Food",
      desc:
        "A cornerstone of Coppell culture. Providing fresh, local produce and a weekly gathering space for residents to support small-scale agriculture.",
    },
    {
      title: "NoteLove",
      link: "https://www.notelove.org/",
      img: communityImages.notelove,
      category: "Arts",
      desc:
        "Bridging the gap in music education. This youth-led nonprofit offers free lessons, ensuring that creative expression is accessible to every student.",
    },
    {
      title: "Metrocrest Services",
      link: "https://metrocrestservices.org/",
      img: communityImages.metrocrest,
      category: "Social Services",
      desc:
        "The regional safety net. From rent assistance to a robust food pantry, they provide essential support for neighbors facing financial crisis.",
    },
    {
      title: "Neighbors In Need",
      link: "https://www.instagram.com/neighbors_in_need_/",
      img: communityImages.neighbors,
      category: "Mutual Aid",
      desc:
        "Hyperlocal community care. A grassroots network coordinating direct help, rides, and grocery deliveries across the city of Coppell.",
    },
  ];

  const filtered = resources.filter((r) => {
    const matchesQuery =
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.desc.toLowerCase().includes(query.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || r.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      window.scrollTo({ top: isMobile ? 300 : 400, behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const timeout = setTimeout(() => {
      document
        .querySelectorAll(".archive-card-uniform.reveal")
        .forEach((el) => {
          el.classList.add("show");
        });
    }, 50);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', checkMobile);
    };
  }, [filtered]);

  return (
    <div className="page archive-page" style={{ 
      padding: isMobile ? '1rem' : '2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* HEADER SECTION */}
      <header className="page-head reveal" style={{
        position: 'relative',
        padding: isMobile ? '2rem 1rem' : '3rem 2rem',
        marginBottom: isMobile ? '2rem' : '3rem',
        textAlign: 'center'
      }}>
        <h2 className="xxl skew" style={{
          fontSize: isMobile ? '2.5rem' : '4rem',
          marginBottom: isMobile ? '0.5rem' : '1rem'
        }}>ARCHIVE</h2>
        <p className="kicker" style={{
          fontSize: isMobile ? '0.9rem' : '1.1rem',
          fontWeight: '700',
          letterSpacing: '0.1em'
        }}>Digital Preservation — Community Ledger</p>

        {/* Abstract design element */}
        {!isMobile && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              padding: "10px",
              border: "2px solid var(--mag)",
              color: "var(--mag)",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              transform: "rotate(5deg)",
            }}
          >
            FILE_ID: COPPELL_2025_TSA
          </div>
        )}
      </header>

      {/* WHY ARCHIVE - Deep Dive */}
      <div className="slab reveal fade-in-up" style={{
        padding: isMobile ? '1.5rem' : '2rem',
        marginBottom: isMobile ? '2rem' : '3rem',
        border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)'
      }}>
        <div className="eyebrow" style={{
          fontSize: isMobile ? '0.7rem' : '0.8rem',
          marginBottom: isMobile ? '0.5rem' : '1rem'
        }}>THE PURPOSE</div>
        <h2 className="display" style={{
          fontSize: isMobile ? '1.5rem' : '2.5rem',
          marginBottom: isMobile ? '0.75rem' : '1rem'
        }}>Protecting Local History</h2>
        <p className="lead" style={{ 
          marginTop: isMobile ? '0.75rem' : '1rem',
          fontSize: isMobile ? '0.9rem' : '1.05rem',
          lineHeight: '1.7'
        }}>
          In a rapidly growing suburb, history is easily overwritten by new
          developments. This archive exists to document the{" "}
          <strong>human infrastructure</strong> of Coppell—the nonprofits,
          student groups, and volunteers that create our city's soul.
        </p>
      </div>

      {/* SEARCH & FILTER BAR */}
      <section
        className="reveal fade-in-up delay-1"
        style={{ marginBottom: isMobile ? '2rem' : '3rem' }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: "wrap",
            gap: isMobile ? '0.75rem' : '1rem',
            alignItems: isMobile ? 'stretch' : 'center',
            background: "var(--panel)",
            padding: isMobile ? '1rem' : '1.5rem',
            border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)',
            boxShadow: isMobile ? '4px 4px 0 var(--mag)' : '8px 8px 0 var(--mag)',
          }}
        >
          <div style={{ 
            flex: isMobile ? 'none' : '1', 
            minWidth: isMobile ? 'auto' : '280px', 
            position: "relative" 
          }}>
            <Search
              style={{
                position: "absolute",
                left: "12px",
                top: "12px",
                opacity: 0.5,
              }}
              size={isMobile ? 18 : 20}
            />
            <input
              type="text"
              style={{ 
                paddingLeft: "40px", 
                marginBottom: 0,
                width: '100%',
                fontSize: isMobile ? '0.9rem' : '1rem',
                padding: isMobile ? '0.6rem 0.6rem 0.6rem 40px' : '0.75rem 0.75rem 0.75rem 40px'
              }}
              placeholder="Search the collection..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={{ 
            display: "flex", 
            gap: isMobile ? '0.4rem' : '0.5rem', 
            flexWrap: "wrap",
            justifyContent: isMobile ? 'center' : 'flex-start'
          }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
                  fontSize: isMobile ? '0.7rem' : '0.8rem',
                  background:
                    activeCategory === cat
                      ? "var(--mag)"
                      : "transparent",
                  color:
                    activeCategory === cat ? "white" : "var(--ink)",
                  border: "2px solid var(--ink)",
                  cursor: "pointer",
                  fontWeight: "800",
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* GRID OF ARCHIVAL RECORDS */}
      <section>
        <div className="archive-grid" style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: isMobile ? '1.5rem' : '2rem',
          marginBottom: isMobile ? '2rem' : '3rem'
        }}>
          {filtered.map((r, i) => (
            <div
              key={i}
              className={`archive-card-uniform reveal fade-in-up delay-${
                (i % 3) + 1
              }`}
              style={{
                background: "var(--panel)",
                border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)',
                position: "relative",
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Category Tag Badge */}
              <div
                style={{
                  position: "absolute",
                  top: isMobile ? '8px' : '10px',
                  right: isMobile ? '8px' : '10px',
                  background: "var(--ink)",
                  color: "var(--bg)",
                  padding: isMobile ? '3px 6px' : '2px 8px',
                  fontSize: isMobile ? '0.65rem' : '0.7rem',
                  fontWeight: "900",
                  zIndex: 5,
                }}
              >
                {r.category}
              </div>

              <div className="archive-thumb-box" style={{
                width: '100%',
                height: isMobile ? '180px' : '200px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <img
                  src={r.img}
                  alt={r.title}
                  className="archive-thumb-img"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>

              <div className="archive-content" style={{
                padding: isMobile ? '1.25rem' : '1.5rem',
                flex: 1,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <h3
                  style={{
                    fontSize: isMobile ? '1.2rem' : '1.5rem',
                    marginBottom: isMobile ? '0.5rem' : '0.75rem',
                    fontWeight: '900'
                  }}
                >
                  {r.title}
                </h3>
                <p
                  style={{
                    marginBottom: isMobile ? '1rem' : '1.5rem',
                    opacity: 0.8,
                    fontSize: isMobile ? '0.85rem' : '0.9rem',
                    lineHeight: '1.6',
                    flex: 1
                  }}
                >
                  {r.desc}
                </p>
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn wire"
                  style={{ 
                    width: "100%",
                    padding: isMobile ? '0.6rem 1rem' : '0.75rem 1.5rem',
                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                    textAlign: 'center',
                    display: 'inline-block',
                    textDecoration: 'none',
                    border: '2px solid var(--ink)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ACCESS FILE →
                </a>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="slab" style={{ 
            textAlign: "center",
            padding: isMobile ? '2rem 1rem' : '3rem 2rem',
            border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)'
          }}>
            <p style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}>
              No records found matching your query.
            </p>
          </div>
        )}
      </section>

      {/* SUBMISSION SECTION */}
      <section
        className="slab reveal fade-in-up delay-1"
        style={{ 
          marginTop: isMobile ? '3rem' : '4rem', 
          background: "var(--bg)",
          padding: isMobile ? '1.5rem' : '2rem',
          border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)'
        }}
      >
        <div className="eyebrow" style={{
          fontSize: isMobile ? '0.7rem' : '0.8rem',
          marginBottom: isMobile ? '0.5rem' : '1rem'
        }}>CONTRIBUTE TO THE RECORD</div>
        <h3 className="display" style={{
          fontSize: isMobile ? '1.5rem' : '2.5rem',
          marginBottom: isMobile ? '1rem' : '1.5rem'
        }}>Submit a New Entry</h3>

        {submitted ? (
          <div
            className="success-msg fade-in"
            style={{ 
              border: isMobile ? '3px solid #05d9e8' : '4px solid #05d9e8',
              padding: isMobile ? '2rem 1rem' : '3rem 2rem',
              textAlign: 'center',
              background: 'var(--panel)'
            }}
          >
            <CheckCircle size={isMobile ? 48 : 64} color="#05d9e8" />
            <h3 style={{ 
              marginTop: isMobile ? '0.75rem' : '1rem',
              fontSize: isMobile ? '1.3rem' : '1.8rem'
            }}>
              SUBMISSION RECEIVED
            </h3>
            <p className="lead" style={{
              fontSize: isMobile ? '0.9rem' : '1rem',
              marginTop: isMobile ? '0.75rem' : '1rem',
              lineHeight: '1.6'
            }}>
              Your contribution has been indexed and is awaiting
              verification by the student team.
            </p>
            <button
              className="btn slab"
              style={{ 
                marginTop: isMobile ? '1rem' : '1.5rem',
                padding: isMobile ? '0.75rem 2rem' : '1rem 3rem',
                fontSize: isMobile ? '0.85rem' : '1rem',
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: '2px solid var(--ink)',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              onClick={() => setSubmitted(false)}
            >
              NEW SUBMISSION
            </button>
          </div>
        ) : (
          <div
            className="archive-form"
            style={{ marginTop: isMobile ? '1.5rem' : '2rem' }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? '1rem' : '1.5rem',
              }}
            >
              <div className="form-field">
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '800',
                  fontSize: isMobile ? '0.75rem' : '0.85rem',
                  letterSpacing: '0.05em'
                }}>ORGANIZATION NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coppell Arts Council"
                  style={{
                    width: '100%',
                    padding: isMobile ? '0.6rem' : '0.75rem',
                    fontSize: isMobile ? '0.9rem' : '1rem',
                    border: '2px solid var(--ink)',
                    background: 'var(--bg)'
                  }}
                />
              </div>
              <div className="form-field">
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '800',
                  fontSize: isMobile ? '0.75rem' : '0.85rem',
                  letterSpacing: '0.05em'
                }}>ESTABLISHED YEAR</label>
                <input 
                  type="text" 
                  placeholder="YYYY"
                  style={{
                    width: '100%',
                    padding: isMobile ? '0.6rem' : '0.75rem',
                    fontSize: isMobile ? '0.9rem' : '1rem',
                    border: '2px solid var(--ink)',
                    background: 'var(--bg)'
                  }}
                />
              </div>
            </div>

            <div className="form-field" style={{ marginTop: isMobile ? '1rem' : '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '800',
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                letterSpacing: '0.05em'
              }}>DESCRIPTION & IMPACT</label>
              <textarea
                required
                placeholder="Explain how this group supports the Coppell community..."
                style={{
                  width: '100%',
                  minHeight: isMobile ? '100px' : '120px',
                  padding: isMobile ? '0.6rem' : '0.75rem',
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  border: '2px solid var(--ink)',
                  background: 'var(--bg)',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="form-field" style={{ marginTop: isMobile ? '1rem' : '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '800',
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                letterSpacing: '0.05em'
              }}>OFFICIAL WEBSITE (URL)</label>
              <input 
                type="url" 
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: isMobile ? '0.6rem' : '0.75rem',
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  border: '2px solid var(--ink)',
                  background: 'var(--bg)'
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="btn slab"
              style={{
                width: isMobile ? '100%' : 'fit-content',
                padding: isMobile ? '0.75rem 2rem' : '1rem 4rem',
                marginTop: isMobile ? '1.5rem' : '2rem',
                fontSize: isMobile ? '0.9rem' : '1rem',
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: '2px solid var(--ink)',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              STAMP & SUBMIT
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
