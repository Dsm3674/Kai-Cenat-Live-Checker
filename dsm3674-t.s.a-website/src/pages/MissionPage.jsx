import React, { useEffect, useState } from "react";
import Footer from "../components/Footer";

export default function MissionPage() {
  const [activeCard, setActiveCard] = useState(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
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
    };
  }, []);

  const stats = [
    { number: '100+', label: 'Stories Collected', color: '#ff2a6d' },
    { number: '4', label: 'Anchor Organizations', color: '#05d9e8' },
    { number: '10K+', label: 'Community Members', color: '#d1f7ff' },
    { number: '2025', label: 'TSA Competition', color: '#ff2a6d' }
  ];

  const pillars = [
    {
      title: 'ORGANIZATIONS',
      subtitle: 'Anchors, Not Ads',
      icon: '🏛️',
      content: 'We highlight groups like Coppell Farmers Market, NoteLove, Metrocrest Services, and Neighbors In Need as pillars of daily life. These aren\'t sponsors — they\'re community anchors. Together, they reflect food access, youth mentorship, mutual aid, and wraparound support that help Coppell stay connected and resilient.',
      features: ['Food Access Networks', 'Youth Mentorship', 'Mutual Aid Systems', 'Emergency Support']
    },
    {
      title: 'PEOPLE',
      subtitle: 'Neighbors First',
      icon: '👥',
      content: 'Every pin on our map represents real people: volunteers packing grocery bags, teens offering music lessons, families supporting one another during hard weeks, coaches, teachers, artists, and local workers who make daily life feel personal rather than distant. Coppell\'s community is not abstract — it is built on human stories.',
      features: ['Volunteer Network', 'Local Artists', 'Community Leaders', 'Student Voices']
    },
    {
      title: 'DESIGN',
      subtitle: 'Brutalist On Purpose',
      icon: '🎨',
      content: 'Our bold, blocky design mirrors a living bulletin board: layers of posters, handwritten notes, maps, announcements, and reminders — the kind of materials you see in real community spaces. The design celebrates honesty, texture, and the raw energy of a city that shows up.',
      features: ['Bold Typography', 'Raw Layouts', 'Honest Design', 'Community Aesthetic']
    }
  ];

  return (
    <div className="page mission">

      {/* ANIMATED HEADER */}
      <header className="page-head fade-in reveal" style={{
        position: 'relative',
        overflow: 'hidden'
      }}>
        <h2 className="xxl skew" style={{
          position: 'relative',
          display: 'inline-block',
          animation: 'titleGlitch 5s infinite'
        }}>
          MISSION
          <div style={{
            position: 'absolute',
            bottom: '-8px',
            left: 0,
            width: '100%',
            height: '5px',
            background: 'linear-gradient(90deg, #ff2a6d, #05d9e8, #d1f7ff)',
            animation: 'slideWidth 1.5s ease'
          }} />
        </h2>
        <p className="kicker" style={{
          animation: 'fadeInUp 1s ease 0.3s both'
        }}>
          why this archive exists
        </p>

        {/* Animated corner accents */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100px',
          height: '100px',
          background: '#ff2a6d',
          clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
          opacity: 0.1,
          animation: 'pulse 3s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '80px',
          height: '80px',
          background: '#05d9e8',
          clipPath: 'polygon(0 0, 100% 100%, 0 100%)',
          opacity: 0.1,
          animation: 'pulse 3s ease-in-out infinite 1.5s'
        }} />
      </header>

      {/* HERO STATS SECTION */}
      <section className="slab fade-in-up reveal" style={{
        background: 'var(--panel)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Parallax background pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255, 42, 109, 0.03) 30px, rgba(255, 42, 109, 0.03) 60px)',
          transform: `translateY(${scrollY * 0.1}px)`,
          pointerEvents: 'none'
        }} />

        <div className="eyebrow" style={{ position: 'relative', zIndex: 2 }}>BY THE NUMBERS</div>
        <h3 className="display" style={{ 
          marginBottom: '2rem',
          position: 'relative',
          zIndex: 2
        }}>
          Our Impact in Metrics
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.5rem',
          position: 'relative',
          zIndex: 2
        }}>
          {stats.map((stat, idx) => (
            <div
              key={idx}
              style={{
                border: '4px solid var(--ink)',
                padding: '1.5rem',
                textAlign: 'center',
                background: 'var(--bg)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                animation: `popIn 0.6s ease ${idx * 0.15}s both`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-12px) rotate(-2deg)';
                e.currentTarget.style.boxShadow = `16px 16px 0 ${stat.color}`;
                e.currentTarget.style.borderColor = stat.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) rotate(0deg)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--ink)';
              }}
            >
              {/* Animated background accent */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: `radial-gradient(circle, ${stat.color}22 0%, transparent 70%)`,
                animation: 'rotate 20s linear infinite',
                pointerEvents: 'none'
              }} />

              <div style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                fontWeight: '900',
                lineHeight: 1,
                color: stat.color,
                marginBottom: '0.5rem',
                position: 'relative',
                zIndex: 2,
                textShadow: '3px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                {stat.number}
              </div>
              <div style={{
                fontSize: '0.95rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                position: 'relative',
                zIndex: 2
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PURPOSE SECTION WITH ANIMATION */}
      <section className="slab fade-in-up reveal" style={{
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="eyebrow">PURPOSE</div>
        <h3 className="display" style={{
          position: 'relative',
          display: 'inline-block'
        }}>
          A Living Community Ledger
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: 0,
            width: '0%',
            height: '4px',
            background: '#ff2a6d',
            animation: 'expandWidth 2s ease forwards'
          }} />
        </h3>
        <p className="lead" style={{
          marginTop: '1.5rem',
          animation: 'fadeInUp 1s ease 0.3s both'
        }}>
          The Coppell Archive is a student-built project for TSA that treats a
          website like a neighborhood bulletin board: loud, layered, and
          unapologetically human. It gathers organizations, stories, and places
          that show how Coppell cares for its people.
        </p>

        {/* Decorative quote box */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          borderLeft: '6px solid #ff2a6d',
          background: 'rgba(255, 42, 109, 0.05)',
          fontStyle: 'italic',
          fontSize: '1.1rem',
          animation: 'slideRight 1s ease 0.5s both'
        }}>
          "This isn't just a website — it's a digital monument to the people who make Coppell home."
        </div>
      </section>

      {/* ENHANCED THREE PILLARS */}
      <section className="slab mission-grid" style={{
        background: 'var(--panel)',
        position: 'relative'
      }}>
        <div style={{
          gridColumn: '1 / -1',
          marginBottom: '2rem'
        }}>
          <div className="eyebrow">CORE PRINCIPLES</div>
          <h3 className="display">The Three Pillars</h3>
        </div>

        {pillars.map((pillar, idx) => (
          <div
            key={idx}
            className={`mission-card fade-in-up delay-${idx + 1} reveal`}
            style={{
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
              border: activeCard === idx ? '4px solid #ff2a6d' : '3px solid var(--ink)',
              transform: activeCard === idx ? 'scale(1.02)' : 'scale(1)'
            }}
            onClick={() => setActiveCard(activeCard === idx ? null : idx)}
            onMouseEnter={(e) => {
              if (activeCard !== idx) {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '12px 12px 0 rgba(255, 42, 109, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeCard !== idx) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {/* Icon badge */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              fontSize: '2rem',
              opacity: 0.3,
              animation: `bounce 2s ease-in-out infinite ${idx * 0.3}s`
            }}>
              {pillar.icon}
            </div>

            <div className="eyebrow">{pillar.title}</div>
            <h4 style={{
              fontSize: '1.4rem',
              marginBottom: '1rem',
              transition: 'color 0.3s ease',
              color: activeCard === idx ? '#ff2a6d' : 'inherit'
            }}>
              {pillar.subtitle}
            </h4>
            <p style={{ marginBottom: '1.5rem' }}>
              {pillar.content}
            </p>

            {/* Expandable features list */}
            <div style={{
              maxHeight: activeCard === idx ? '300px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.5s ease, opacity 0.5s ease',
              opacity: activeCard === idx ? 1 : 0
            }}>
              <div style={{
                paddingTop: '1rem',
                borderTop: '2px dashed var(--ink-dim)',
                marginTop: '1rem'
              }}>
                <h5 style={{
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem',
                  color: '#ff2a6d',
                  letterSpacing: '0.1em'
                }}>
                  Key Features:
                </h5>
                <ul style={{
                  paddingLeft: '1.2rem',
                  lineHeight: '1.8',
                  fontSize: '0.9rem'
                }}>
                  {pillar.features.map((feature, fIdx) => (
                    <li key={fIdx} style={{
                      animation: activeCard === idx ? `fadeInLeft 0.5s ease ${fIdx * 0.1}s both` : 'none'
                    }}>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Click indicator */}
            <div style={{
              marginTop: '1rem',
              fontSize: '0.75rem',
              color: '#ff2a6d',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              {activeCard === idx ? 'Click to collapse ↑' : 'Click to expand →'}
            </div>
          </div>
        ))}
      </section>

      {/* WHY COPPELL IS SPECIAL - ENHANCED */}
      <section className="slab fade-in-up reveal" style={{
        position: 'relative',
        background: 'linear-gradient(135deg, var(--panel) 0%, rgba(255, 42, 109, 0.05) 100%)'
      }}>
        <div className="eyebrow">WHY COPPELL IS SPECIAL</div>
        <h3 className="display">A City Built on Connection</h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          marginTop: '2rem'
        }}>
          <div style={{
            animation: 'fadeInUp 1s ease 0.2s both'
          }}>
            <p className="lead">
              Coppell is more than a suburb — it is a community shaped by moments of 
              showing up for one another. Growing up here means meeting people who 
              give their time, skills, and energy so others can succeed.
            </p>
          </div>

          <div style={{
            animation: 'fadeInUp 1s ease 0.4s both'
          }}>
            <p className="lead">
              From weekend markets to youth-led initiatives, and from cultural 
              celebrations to mutual aid groups, Coppell stands out because its 
              identity is rooted in participation. Everyone contributes something,
              and everyone benefits from the shared effort.
            </p>
          </div>
        </div>

        {/* Visual timeline snippet */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          border: '3px solid var(--ink)',
          background: 'var(--bg)',
          position: 'relative',
          animation: 'zoomIn 1s ease 0.6s both'
        }}>
          <h4 style={{
            fontSize: '1.2rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            Community Evolution Timeline
          </h4>
          
          <div style={{
            position: 'relative',
            height: '4px',
            background: 'var(--ink)',
            margin: '2rem 0'
          }}>
            {['1840', '1950', '1990', '2025'].map((year, idx) => (
              <div
                key={year}
                style={{
                  position: 'absolute',
                  left: `${(idx / 3) * 100}%`,
                  transform: 'translateX(-50%)',
                  top: '-10px'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  background: '#ff2a6d',
                  border: '4px solid var(--ink)',
                  borderRadius: '50%',
                  animation: `pulse 2s ease-in-out infinite ${idx * 0.3}s`
                }} />
                <div style={{
                  marginTop: '1.5rem',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap'
                }}>
                  {year}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY THIS ARCHIVE MATTERS - ENHANCED */}
      <section className="slab fade-in-up reveal" style={{
        background: 'var(--panel)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated corner accent */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle at bottom right, rgba(255, 42, 109, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'pulse 4s ease-in-out infinite'
        }} />

        <div className="eyebrow" style={{ position: 'relative', zIndex: 2 }}>WHY THIS ARCHIVE MATTERS</div>
        <h3 className="display" style={{ position: 'relative', zIndex: 2 }}>
          Preserving What Makes Us Who We Are
        </h3>
        
        <div style={{
          marginTop: '2rem',
          position: 'relative',
          zIndex: 2
        }}>
          <p className="lead" style={{
            padding: '1.5rem',
            background: 'rgba(255, 42, 109, 0.05)',
            borderLeft: '5px solid #ff2a6d',
            animation: 'slideRight 1s ease 0.3s both'
          }}>
            For students like us, creating this archive is a way to honor the 
            community that shaped our childhood. We built it so future residents, 
            volunteers, and students can understand the heart of Coppell — not 
            through statistics or city brochures, but through real community stories.
          </p>

          <p className="lead" style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: 'rgba(5, 217, 232, 0.05)',
            borderLeft: '5px solid #05d9e8',
            animation: 'slideRight 1s ease 0.5s both'
          }}>
            This project captures the culture, generosity, and local pride that make
            Coppell feel like home. It is a snapshot of the people and places that 
            gave us opportunities, supported us, and taught us what it means to 
            belong.
          </p>
        </div>
      </section>

      {/* FINAL MESSAGE - ENHANCED */}
      <section className="slab fade-in-up reveal" style={{
        textAlign: 'center',
        background: 'var(--bg)',
        position: 'relative'
      }}>
        {/* Animated grid background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255, 42, 109, 0.1) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          opacity: 0.3,
          animation: 'gridPulse 4s ease-in-out infinite',
          pointerEvents: 'none'
        }} />

        <div className="eyebrow" style={{ position: 'relative', zIndex: 2 }}>WHAT WE REPRESENT</div>
        <h3 className="display" style={{ 
          marginBottom: '2rem',
          position: 'relative',
          zIndex: 2,
          fontSize: 'clamp(2rem, 5vw, 4rem)'
        }}>
          A Community That Shows Up
        </h3>
        
        <p className="lead" style={{ 
          maxWidth: '800px',
          margin: '0 auto 2rem',
          position: 'relative',
          zIndex: 2
        }}>
          Coppell is special because it is built on connection. Growing up here
          means learning from diverse neighbors, discovering new experiences,
          and seeing how people support one another. This archive preserves that
          feeling for anyone who visits — now and in the future.
        </p>
      </section>

      <Footer />

      {/* Enhanced Animations */}
      <style>{`
        @keyframes titleGlitch {
          0%, 90%, 100% { transform: translate(0); }
          91% { transform: translate(-2px, 2px); }
          92% { transform: translate(2px, -2px); }
          93% { transform: translate(-2px, -2px); }
          94% { transform: translate(2px, 2px); }
        }

        @keyframes slideWidth {
          from { width: 0%; }
          to { width: 100%; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes expandWidth {
          from { width: 0%; }
          to { width: 100%; }
        }

        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes gridPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
