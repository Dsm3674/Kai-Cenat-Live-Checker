import React, { useState, useEffect } from "react";
import { communityImages } from "../data/communityAssets";

export default function TimelinePage() {
  const [selectedEra, setSelectedEra] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile and handle scroll
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const revealEls = document.querySelectorAll('.reveal, .fade-in-up, .fade-in');
    
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    revealEls.forEach(el => obs.observe(el));

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    return () => {
      obs.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const eras = [
    {
      id: 1,
      era: "Early Roots",
      years: "1840–1950",
      shortDesc: "Small farming settlement.",
      fullDetails: "Coppell began in 1840 as a farming settlement originally called Gibbs Station. Life centered around agriculture, small churches, and one-room schoolhouses.",
    img: communityImages.history,
      citation: "https://www.coppelltx.gov/610/History-of-Coppell",
      color: "#e6dcc5"
    },
    {
      id: 2,
      era: "Growth & Identity",
      years: "1950–1990",
      shortDesc: "Schools, music, and rapid expansion.",
      fullDetails: "After the opening of DFW Airport, Coppell shifted from rural farmland to a growing suburb. Music, marching band culture, and youth arts shaped the city's identity.",
    img: communityImages.civic,
      citation: "https://coppellstudentmedia.com/121647/entertainment/rock-musics-evolution-its-influence-on-the-world-and-coppell/",
      color: "#05d9e8"
    },
    {
      id: 3,
      era: "Community Era",
      years: "1990–2010",
      shortDesc: "Farmers markets, youth programs, and culture.",
      fullDetails: "Community institutions began defining Coppell's character. The Farmers Market, youth programs, and school traditions strengthened community ties.",
    img: communityImages.farmers,
      citation: "https://coppellstudentmedia.com/20840/entertainment/the-end-of-the-harry-potter-era/",
      color: "#d1f7ff"
    },
    {
      id: 4,
      era: "Present Day",
      years: "2010–2025",
      shortDesc: "Modern arts and mutual aid.",
      fullDetails: "Coppell now embraces a diverse civic culture shaped by arts programs, mutual aid organizations, and young community-driven initiatives.",
    img: communityImages.neighbors,
      citation: "https://www.coppelltx.gov/1225/2025-Yard-of-the-Month-Winners",
      color: "#ff2a6d"
    }
  ];

  return (
    <div className="page-container" style={{
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* BRUTALIST BACKGROUND ELEMENTS */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: isMobile ? 0.2 : 0.4
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 50px, rgba(255, 42, 109, 0.03) 50px, rgba(255, 42, 109, 0.03) 100px)',
          transform: `translateY(${scrollY * 0.2}px)`
        }} />
        
        {!isMobile && (
          <>
            <div style={{
              position: 'absolute',
              top: '10%',
              right: '5%',
              width: '200px',
              height: '200px',
              border: '8px solid rgba(255, 42, 109, 0.1)',
              transform: 'rotate(45deg)',
              animation: 'floatBlock 8s ease-in-out infinite'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '15%',
              left: '8%',
              width: '150px',
              height: '150px',
              border: '6px solid rgba(5, 217, 232, 0.1)',
              transform: 'rotate(-25deg)',
              animation: 'floatBlock 10s ease-in-out infinite 2s'
            }} />
          </>
        )}
      </div>

      {/* ENHANCED BRUTALIST HEADER */}
      <header className="page-head fade-in reveal" style={{
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
        padding: isMobile ? '2.5rem 1rem 2rem' : '4rem 2rem 3rem',
        background: 'var(--bg)',
        borderBottom: isMobile ? '4px solid var(--ink)' : '6px solid var(--ink)',
        marginBottom: isMobile ? '2rem' : '3rem'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: '0',
          right: '0',
          height: isMobile ? '8px' : '12px',
          background: 'linear-gradient(90deg, #ff2a6d 0%, #05d9e8 50%, #d1f7ff 100%)',
          animation: 'slideGradient 8s linear infinite'
        }} />

        {!isMobile && (
          <>
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              width: '60px',
              height: '60px',
              border: '4px solid var(--ink)',
              borderRight: 'none',
              borderBottom: 'none'
            }} />
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '60px',
              height: '60px',
              border: '4px solid var(--ink)',
              borderLeft: 'none',
              borderBottom: 'none'
            }} />
          </>
        )}

        <div style={{
          position: 'relative',
          display: 'inline-block'
        }}>
          <h2 className="xxl skew" style={{
            position: 'relative',
            fontSize: isMobile ? '2.5rem' : undefined,
            textShadow: isMobile ? '4px 4px 0 rgba(255, 42, 109, 0.3)' : '6px 6px 0 rgba(255, 42, 109, 0.3)',
            animation: 'titleGlitch 5s infinite'
          }}>
            TIMELINE
          </h2>
          
          <div style={{
            position: 'absolute',
            bottom: isMobile ? '-12px' : '-20px',
            left: '10%',
            right: '10%',
            height: isMobile ? '3px' : '4px',
            background: '#ff2a6d',
            animation: 'expandWidth 1.5s ease'
          }} />
          <div style={{
            position: 'absolute',
            bottom: isMobile ? '-18px' : '-28px',
            left: '20%',
            right: '20%',
            height: isMobile ? '2px' : '3px',
            background: '#05d9e8',
            animation: 'expandWidth 1.8s ease'
          }} />
        </div>

        <p className="lead" style={{
          marginTop: isMobile ? '1.8rem' : '2.5rem',
          fontSize: isMobile ? '0.85rem' : '1.1rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: isMobile ? '0.08em' : '0.15em',
          animation: 'fadeInUp 1s ease 0.3s both',
          padding: isMobile ? '0 1rem' : '0'
        }}>
          <span style={{ color: '#ff2a6d' }}>///</span> Explore Coppell's Cultural Eras <span style={{ color: '#05d9e8' }}>///</span>
        </p>

        {!isMobile && (
          <div style={{
            position: 'absolute',
            bottom: '-3px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '40px',
            height: '40px',
            background: '#ff2a6d',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
        )}
      </header>

      {/* BRUTALIST ERA CARDS */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        padding: isMobile ? '0 1rem' : '0 2rem'
      }}>
        <div className="reveal fade-in-up" style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: isMobile ? '1.5rem' : '2rem',
          maxWidth: '1200px',
          margin: isMobile ? '0 auto 2rem' : '0 auto 4rem'
        }}>
          {eras.map((era, idx) => (
            <div
              key={era.id}
              className="timeline-card slab"
              onClick={() => setSelectedEra(era)}
              style={{
                padding: '0',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                animation: isMobile ? 'none' : `cardFloat ${5 + idx * 0.5}s ease-in-out infinite`,
                border: isMobile ? '3px solid var(--ink)' : '4px solid var(--ink)',
                background: 'var(--panel)',
                boxShadow: '8px 8px 0 var(--shadow)'
              }}
              onMouseEnter={(e) => {
                if (!isMobile) {
                  e.currentTarget.style.transform = 'translateY(-15px) rotate(3deg) scale(1.05)';
                  e.currentTarget.style.boxShadow = `20px 20px 0 ${era.color}`;
                  e.currentTarget.style.borderColor = era.color;
                }
              }}
              onMouseLeave={(e) => {
                if (!isMobile) {
                  e.currentTarget.style.transform = 'translateY(0) rotate(0deg) scale(1)';
                  e.currentTarget.style.boxShadow = '8px 8px 0 var(--shadow)';
                  e.currentTarget.style.borderColor = 'var(--ink)';
                }
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: isMobile ? '6px' : '8px',
                background: era.color,
                zIndex: 5
              }} />

              <div style={{
                position: 'absolute',
                top: isMobile ? '12px' : '15px',
                left: isMobile ? '12px' : '15px',
                width: isMobile ? '40px' : '50px',
                height: isMobile ? '40px' : '50px',
                background: era.color,
                border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '1.2rem' : '1.5rem',
                fontWeight: '900',
                zIndex: 4,
                animation: isMobile ? 'none' : `bounce 2s ease-in-out infinite ${idx * 0.2}s`
              }}>
                {era.id}
              </div>

              <div style={{
                width: '100%',
                height: isMobile ? '180px' : '140px',
                overflow: 'hidden',
                border: isMobile ? '2px solid var(--ink)' : '3px solid var(--ink)',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                position: 'relative',
                zIndex: 2
              }}>
                <img 
                  src={era.img} 
                  alt={era.era}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.6s ease, filter 0.4s ease',
                    filter: 'grayscale(0.4) contrast(1.2)'
                  }}
                />
                
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(to bottom, transparent 40%, ${era.color}33)`,
                  pointerEvents: 'none'
                }} />
              </div>

              <div style={{ 
                padding: isMobile ? '1.25rem' : '1.5rem',
                position: 'relative',
                zIndex: 2
              }}>
                <h3 style={{ 
                  fontSize: isMobile ? '1.1rem' : '1.3rem',
                  fontWeight: '900',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                  transition: 'color 0.3s ease'
                }}>{era.era}</h3>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    width: isMobile ? '20px' : '30px',
                    height: '2px',
                    background: era.color
                  }} />
                  <p style={{ 
                    fontSize: isMobile ? '0.7rem' : '0.75rem',
                    fontFamily: '"Courier New", monospace',
                    fontWeight: '700',
                    letterSpacing: '0.1em',
                    opacity: 0.9
                  }}>{era.years}</p>
                </div>
                
                <p style={{ 
                  fontSize: isMobile ? '0.85rem' : '0.9rem',
                  lineHeight: '1.5',
                  opacity: 0.85,
                  marginBottom: '1rem'
                }}>{era.shortDesc}</p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                  color: era.color,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  <div style={{
                    width: isMobile ? '18px' : '20px',
                    height: isMobile ? '18px' : '20px',
                    border: `2px solid ${era.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? '0.8rem' : '1rem'
                  }}>→</div>
                  EXPLORE
                </div>
              </div>

              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: isMobile ? '4px' : '5px',
                background: `repeating-linear-gradient(90deg, ${era.color} 0px, ${era.color} 10px, var(--ink) 10px, var(--ink) 20px)`
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* BRUTALIST HORIZONTAL TIMELINE */}
      <div className="slab reveal fade-in-up" style={{ 
        marginTop: isMobile ? '3rem' : '5rem',
        padding: isMobile ? '2.5rem 1.5rem' : '4rem 3rem',
        position: 'relative',
        border: isMobile ? '4px solid var(--ink)' : '6px solid var(--ink)',
        background: 'var(--panel)',
        boxShadow: isMobile ? '8px 8px 0 rgba(255, 42, 109, 0.2)' : '16px 16px 0 rgba(255, 42, 109, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? '0.5rem' : '1rem',
          marginBottom: isMobile ? '2rem' : '3rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            width: isMobile ? '40px' : '60px',
            height: isMobile ? '3px' : '4px',
            background: '#ff2a6d'
          }} />
          <h3 className="display" style={{ 
            textAlign: 'center',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            fontSize: isMobile ? '1.5rem' : undefined
          }}>
            Timeline Flow
          </h3>
          <div style={{
            width: isMobile ? '40px' : '60px',
            height: isMobile ? '3px' : '4px',
            background: '#05d9e8'
          }} />
        </div>
        
        <div style={{ 
          position: 'relative', 
          padding: isMobile ? '2rem 0' : '4rem 0'
        }}>
          {!isMobile && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '8%',
              right: '8%',
              height: '6px',
              background: 'var(--ink)',
              transform: 'translateY(-50%)',
              zIndex: 1
            }}>
              {[0, 33, 66].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${pos}%`,
                  width: '10%',
                  height: '100%',
                  background: ['#ff2a6d', '#05d9e8', '#d1f7ff'][i],
                  animation: `slideSegment 3s ease-in-out infinite ${i * 0.5}s`
                }} />
              ))}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: isMobile ? '2rem' : '2rem',
            position: 'relative',
            zIndex: 2
          }}>
            {eras.map((era, index) => (
              <div
                key={`timeline-point-${era.id}`}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease',
                  padding: isMobile ? '1rem' : '0',
                  background: isMobile ? era.color + '11' : 'transparent',
                  border: isMobile ? `2px solid ${era.color}` : 'none'
                }}
                onClick={() => setSelectedEra(era)}
              >
                <div style={{
                  width: isMobile ? '45px' : '50px',
                  height: isMobile ? '45px' : '50px',
                  background: era.color,
                  border: isMobile ? '3px solid var(--ink)' : '4px solid var(--ink)',
                  margin: isMobile ? '0 auto 1rem' : '0 auto 1.5rem',
                  position: 'relative',
                  boxShadow: isMobile ? '0 0 0 6px var(--bg)' : '0 0 0 10px var(--bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? '1.3rem' : '1.5rem',
                  fontWeight: '900',
                  animation: isMobile ? 'none' : `nodePulse 2s ease-in-out infinite ${index * 0.3}s`
                }}>
                  {era.id}
                </div>

                <div style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  color: 'var(--ink)',
                  letterSpacing: '0.08em',
                  fontWeight: '700',
                  marginBottom: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  background: era.color + '22',
                  border: `2px solid ${era.color}`,
                  display: 'inline-block'
                }}>
                  {era.years}
                </div>

                <div style={{
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em'
                }}>
                  {era.era}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="lead" style={{ 
          marginTop: isMobile ? '2rem' : '3rem',
          textAlign: 'center',
          fontSize: isMobile ? '0.75rem' : '0.95rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: isMobile ? '0.05em' : '0.1em',
          padding: isMobile ? '0 1rem' : '0'
        }}>
          <span style={{ color: '#ff2a6d' }}>▶</span> {isMobile ? 'Tap' : 'Click'} any era to explore <span style={{ color: '#05d9e8' }}>◀</span>
        </p>

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isMobile ? '8px' : '12px',
          background: 'repeating-linear-gradient(90deg, #ff2a6d 0px, #ff2a6d 20px, #05d9e8 20px, #05d9e8 40px, #d1f7ff 40px, #d1f7ff 60px)'
        }} />
      </div>

      {/* ENHANCED MODAL */}
      {selectedEra && (
        <div 
          className="timeline-modal" 
          onClick={() => setSelectedEra(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 1000,
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: isMobile ? '0' : '1rem',
            backdropFilter: 'blur(12px)',
            animation: 'modalFadeIn 0.4s ease',
            overflowY: 'auto'
          }}
        >
          <div 
            className="modal-content slab" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: isMobile ? '100%' : '800px',
              width: '100%',
              maxHeight: isMobile ? 'none' : '90vh',
              minHeight: isMobile ? '100vh' : 'auto',
              overflow: 'auto',
              position: 'relative',
              animation: 'modalSlideUp 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
              boxShadow: isMobile ? 'none' : `24px 24px 0 ${selectedEra.color}`,
              border: isMobile ? 'none' : `6px solid ${selectedEra.color}`,
              borderRadius: isMobile ? '0' : undefined,
              margin: isMobile ? '0' : 'auto'
            }}
          >
            <div style={{
              position: isMobile ? 'fixed' : 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: isMobile ? '8px' : '12px',
              background: selectedEra.color,
              zIndex: 10
            }} />

            <button 
              className="close-overlay" 
              onClick={() => setSelectedEra(null)}
              style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? '1rem' : '1.5rem',
                right: isMobile ? '1rem' : '1.5rem',
                width: isMobile ? '40px' : '44px',
                height: isMobile ? '40px' : '44px',
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: `3px solid ${selectedEra.color}`,
                cursor: 'pointer',
                fontSize: isMobile ? '1.3rem' : '1.5rem',
                fontWeight: 'bold',
                transition: 'all 0.3s ease',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ 
              padding: isMobile ? '3rem 1.25rem 2rem' : '2rem 2rem 2rem 2rem', 
              marginTop: isMobile ? '8px' : '12px' 
            }}>
              <div style={{
                animation: 'slideRight 0.6s cubic-bezier(0.23, 1, 0.32, 1)'
              }}>
                <h3 style={{
                  fontSize: isMobile ? '1.75rem' : 'clamp(2rem, 5vw, 3rem)',
                  marginBottom: '0.5rem',
                  position: 'relative',
                  display: 'inline-block',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em'
                }}>
                  {selectedEra.era}
                  <div style={{
                    position: 'absolute',
                    bottom: '-8px',
                    left: 0,
                    width: '100%',
                    height: isMobile ? '4px' : '5px',
                    background: selectedEra.color,
                    animation: 'expandWidth 0.8s ease'
                  }} />
                </h3>
                <p className="years" style={{
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  marginBottom: isMobile ? '1.5rem' : '2rem',
                  animation: 'fadeInUp 0.7s ease',
                  fontFamily: '"Courier New", monospace',
                  fontWeight: '700',
                  letterSpacing: '0.1em'
                }}>{selectedEra.years}</p>
              </div>

              <div style={{
                width: '100%',
                height: isMobile ? '220px' : '320px',
                overflow: 'hidden',
                marginBottom: isMobile ? '1.5rem' : '2rem',
                border: `${isMobile ? '4px' : '5px'} solid ${selectedEra.color}`,
                position: 'relative',
                animation: 'zoomIn 0.8s ease'
              }}>
                <img
                  src={selectedEra.img}
                  alt={selectedEra.era}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: 'grayscale(0.2) contrast(1.1)'
                  }}
                />
              </div>

              <div className="modal-body" style={{
                animation: 'fadeInUp 0.9s ease'
              }}>
                <p className="lead" style={{
                  marginBottom: isMobile ? '1.5rem' : '2rem',
                  lineHeight: '1.7',
                  fontSize: isMobile ? '0.95rem' : '1.05rem'
                }}>{selectedEra.fullDetails}</p>

                <div style={{
                  marginTop: isMobile ? '1.5rem' : '2rem',
                  padding: isMobile ? '1.25rem' : '1.5rem',
                  background: selectedEra.color + '11',
                  border: `${isMobile ? '2px' : '3px'} dashed ${selectedEra.color}`,
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'slideLeft 1s ease'
                }}>
                  <h4 style={{
                    fontSize: isMobile ? '1rem' : '1.2rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    marginBottom: '0.75rem',
                    color: selectedEra.color,
                    letterSpacing: '0.05em'
                  }}>
                    Historical Context
                  </h4>
                  <p style={{ 
                    fontSize: isMobile ? '0.85rem' : '0.95rem', 
                    lineHeight: '1.6'
                  }}>
                    {selectedEra.id === 1 && "This era laid the foundation for Coppell's agricultural heritage and community spirit that continues today."}
                    {selectedEra.id === 2 && "The transformation from rural to suburban brought new opportunities and challenges, shaping modern Coppell."}
                    {selectedEra.id === 3 && "Community institutions emerged as pillars of support, creating lasting bonds between residents."}
                    {selectedEra.id === 4 && "Today's Coppell reflects decades of growth while maintaining its commitment to community connection."}
                  </p>
                </div>

                <div style={{ 
                  marginTop: isMobile ? '1.5rem' : '2rem',
                  animation: 'fadeInUp 1.1s ease'
                }}>
                  <h4 style={{
                    fontSize: isMobile ? '1rem' : '1.2rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    marginBottom: '1rem',
                    position: 'relative',
                    paddingLeft: '1.5rem',
                    letterSpacing: '0.05em'
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '6px',
                      background: selectedEra.color
                    }} />
                    Key Developments
                  </h4>
                  <ul style={{
                    paddingLeft: isMobile ? '1.5rem' : '2rem',
                    lineHeight: '1.9',
                    fontSize: isMobile ? '0.85rem' : '0.95rem'
                  }}>
                    {selectedEra.id === 1 && (
                      <>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.1s both' }}>Establishment of Gibbs Station trading post</li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.2s both' }}>Formation of first community churches</li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.3s both' }}>Development of agricultural infrastructure</li>
                      </>
                    )}
                    {selectedEra.id === 2 && (
                      <>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.1s both' }}>
                          Opening of DFW International Airport (1974)
                        </li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.2s both' }}>
                          Rapid suburban development and population growth
                        </li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.3s both' }}>
                          Establishment of school music and arts programs
                        </li>
                      </>
                    )}
                    {selectedEra.id === 3 && (
                      <>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.1s both' }}>Launch of Coppell Farmers Market</li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.2s both' }}>Expansion of youth arts & sports programs</li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.3s both' }}>Growth of community traditions & identity</li>
                      </>
                    )}
                    {selectedEra.id === 4 && (
                      <>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.1s both' }}>Rise of community-driven arts programs</li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.2s both' }}>Expansion of Metrocrest Services outreach</li>
                        <li style={{ animation: 'fadeInLeft 0.5s ease 0.3s both' }}>Increased involvement in grassroots mutual aid</li>
                      </>
                    )}
                  </ul>
                </div>

                {selectedEra.citation && (
                  <p className="citation" style={{
                    marginTop: isMobile ? '1.5rem' : '2rem',
                    textAlign: 'center',
                    animation: 'fadeIn 1.3s ease',
                    fontSize: isMobile ? '0.8rem' : '0.9rem'
                  }}>
                    <em>
                      Source:{" "}
                      <a
                        href={selectedEra.citation}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: selectedEra.color,
                          textDecoration: 'underline',
                          fontWeight: '700',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.textShadow = `0 0 10px ${selectedEra.color}`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = selectedEra.color;
                          e.currentTarget.style.textShadow = 'none';
                        }}
                      >
                        {selectedEra.citation}
                      </a>
                    </em>
                  </p>
                )}

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
