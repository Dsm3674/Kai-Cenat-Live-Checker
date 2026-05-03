import React, { useEffect, useState } from "react";
import Footer from "../components/Footer";

export default function MapPage() {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(0);
  
  const organizations = [
    {
      id: 'farmers',
      name: 'Coppell Farmers Market',
      color: '#e6dcc5',
      impact: 'Food access, small business support',
      description: 'Every Saturday morning, local growers, artisans, and food vendors gather to create a community hub. The market serves as a meeting place where neighbors connect over fresh produce and local goods.'
    },
    {
      id: 'notelove',
      name: 'NoteLove',
      color: '#d2c7b2',
      impact: 'Youth mentorship, creative access',
      description: 'Youth-led nonprofit providing free music lessons to students across Coppell. Volunteer instructors transform practice rooms and living rooms into studios, making music education accessible to all.'
    },
    {
      id: 'metrocrest',
      name: 'Metrocrest Services',
      color: '#e6dcc5',
      impact: 'Food security, housing support, crisis aid',
      description: 'Regional hub providing food pantry services, housing assistance, senior support, and emergency aid. Metrocrest acts as a safety net for families facing financial hardship or unexpected crises.'
    },
    {
      id: 'neighbors',
      name: 'Neighbors In Need',
      color: '#d2c7b2',
      impact: 'Mutual aid, direct community support',
      description: 'Grassroots mutual aid network coordinating grocery deliveries, transportation, and direct support for Coppell families. This hyperlocal approach ensures no neighbor feels isolated or forgotten.'
    }
  ];

  const insights = [
    { title: "Direct Food Pipelines", text: "The Farmers Market and Metrocrest cooperate to ensure surplus fresh produce reaches families in need, reducing waste and increasing nutrition access." },
    { title: "Creative Resilience", text: "NoteLove provides a creative outlet for students who may be receiving support from other network nodes, proving that community care includes the arts." },
    { title: "The Safety Net", text: "Neighbors In Need serves as the 'last mile' of support, picking up where institutional services end to provide rides and immediate groceries." }
  ];

  return (
    <div className="page map-page">

      {/* ENHANCED HEADER WITH ANIMATION */}
      <header className="page-head reveal fade-in" style={{
        position: 'relative',
        overflow: 'hidden',
      }}>
        <h2 className="xxl skew" style={{
          position: 'relative',
          display: 'inline-block',
          animation: 'glitchText 8s infinite'
        }}>
          MAP
          {/* Animated underline */}
          <div style={{
            position: 'absolute',
            bottom: '-8px',
            left: 0,
            width: '100%',
            height: '6px',
            background: '#ff2a6d',
            animation: 'slideRight 1s cubic-bezier(0.23, 1, 0.32, 1)'
          }} />
        </h2>
        <p className="kicker" style={{ animation: 'fadeIn 2s ease' }}>
          brutalist — community — network
        </p>

        {/* Decorative corner accent */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '120px',
          height: '120px',
          background: '#ff2a6d',
          clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
          opacity: 0.1,
          animation: 'pulse 3s ease-in-out infinite'
        }} />
      </header>

      <div className="map-layout">

        {/* LEFT SIDE — ENHANCED SVG NETWORK */}
        <div 
          className="map-spin-frame reveal fade-in-up"
          style={{
            position: 'relative',
            animation: 'floatMap 8s ease-in-out infinite',
            transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
            background: 'var(--panel)',
            border: '4px solid var(--ink)',
            boxShadow: '14px 14px 0 var(--shadow)'
          }}
        >
          <div className="map-label" style={{
            position: 'absolute', top: '15px', left: '15px', 
            background: 'var(--ink)', color: 'var(--bg)', 
            padding: '5px 10px', fontSize: '0.7rem', fontWeight: '900', zIndex: 5
          }}>
            COPPELL COMMUNITY NETWORK v1.0
          </div>

          <svg
            width="100%"
            height="100%"
            viewBox="0 0 600 520"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            className="map-image"
          >
            <defs>
              <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" stroke="#444" strokeWidth="0.5" />
              </pattern>
              
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />

            {/* Animated Connection Lines */}
            <g filter="url(#glow)">
              {[
                {x1:300, y1:120, x2:150, y2:240, delay: '0s'},
                {x1:300, y1:120, x2:450, y2:240, delay: '0.5s'},
                {x1:150, y1:240, x2:300, y2:360, delay: '1s'},
                {x1:450, y1:240, x2:300, y2:360, delay: '1.5s'},
                {x1:300, y1:360, x2:300, y2:450, delay: '2s'}
              ].map((line, i) => (
                <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="var(--ink)" strokeWidth="4" opacity="0.6">
                  <animate attributeName="stroke-width" values="4;7;4" dur="4s" begin={line.delay} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="4s" begin={line.delay} repeatCount="indefinite" />
                </line>
              ))}
            </g>

            {/* COPPELL CENTER NODE */}
            <circle cx="300" cy="120" r="45" fill="#ff2a6d" stroke="var(--ink)" strokeWidth="5" style={{ filter: 'drop-shadow(0 0 10px #ff2a6d)' }}>
              <animate attributeName="r" values="45;48;45" dur="3s" repeatCount="indefinite" />
            </circle>
            <text x="300" y="125" fontFamily="monospace" fontSize="13" fill="var(--bg)" textAnchor="middle" fontWeight="900">COPPELL</text>

            {/* Interactive Organization Nodes */}
            {organizations.map((org, i) => {
              const coords = [
                {x: 150, y: 240, label: ['Farmers', 'Market']},
                {x: 450, y: 240, label: ['NoteLove', '']},
                {x: 300, y: 360, label: ['Metrocrest', '']},
                {x: 300, y: 450, label: ['Neighbors', 'In Need']}
              ][i];

              return (
                <g key={org.id} 
                   style={{ cursor: 'pointer' }} 
                   onMouseEnter={() => setHoveredNode(org.id)} 
                   onMouseLeave={() => setHoveredNode(null)}>
                  <circle cx={coords.x} cy={coords.y} r="38" fill={org.color} stroke="var(--ink)" strokeWidth="4" 
                          style={{ transition: 'all 0.3s ease', transformBox: 'fill-box', transformOrigin: 'center' }}>
                    {hoveredNode === org.id && <animateTransform attributeName="transform" type="scale" values="1;1.15;1" dur="0.5s" repeatCount="indefinite" />}
                  </circle>
                  <text x={coords.x} y={coords.y - 2} fontSize="11" fill="var(--bg)" textAnchor="middle" fontWeight="bold">{coords.label[0]}</text>
                  <text x={coords.x} y={coords.y + 12} fontSize="11" fill="var(--bg)" textAnchor="middle" fontWeight="bold">{coords.label[1]}</text>
                </g>
              );
            })}
          </svg>

          {/* DYNAMIC HOVER OVERLAY */}
          {hoveredNode && (
            <div style={{
              position: 'absolute', bottom: '20px', left: '20px', right: '20px',
              background: 'rgba(5, 5, 5, 0.95)', border: '3px solid #ff2a6d',
              padding: '1.2rem', color: 'white', zIndex: 10, animation: 'slideUp 0.3s ease'
            }}>
              <div style={{ color: '#ff2a6d', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.3rem', fontSize: '1.1rem' }}>
                {organizations.find(o => o.id === hoveredNode)?.name}
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.4', opacity: 0.9 }}>
                {organizations.find(o => o.id === hoveredNode)?.impact}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE — Legend & Insights */}
        <div className="map-side reveal delay-2">
          <div className="slab" style={{ height: '100%', marginBottom: 0 }}>
            <div className="eyebrow">LEGEND</div>
            <h3 className="display">Ecosystem Dynamics</h3>
            <p className="lead" style={{ marginTop: '1rem' }}>
              Coppell’s network is a <strong>closed-loop support system</strong>. Resources generated at one node flow to strengthen others.
            </p>
            
            <ul style={{ marginTop: "1.5rem", listStyle: 'none' }}>
              {organizations.map((org, i) => (
                <li key={i} style={{ 
                  marginBottom: '1rem', paddingLeft: '1.5rem', borderLeft: `4px solid ${org.color}`,
                  transition: 'all 0.3s ease'
                }}>
                  <strong style={{ textTransform: 'uppercase' }}>{org.name}:</strong> 
                  <span style={{ display: 'block', fontSize: '0.9rem', opacity: 0.8 }}>{org.impact}</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px dashed var(--ink-dim)' }}>
              <div className="eyebrow">NETWORK INSIGHTS</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {insights.map((_, i) => (
                  <button key={i} onClick={() => setActiveAnalysis(i)} 
                          style={{ 
                            flex: 1, height: '4px', background: activeAnalysis === i ? '#ff2a6d' : 'var(--ink-dim)',
                            border: 'none', cursor: 'pointer', transition: '0.3s' 
                          }} />
                ))}
              </div>
              <h4 style={{ fontSize: '1rem', color: '#ff2a6d' }}>{insights[activeAnalysis].title}</h4>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{insights[activeAnalysis].text}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ENHANCED ORGANIZATIONAL DEEP DIVE */}
      <section className="slab reveal fade-in-up" style={{ marginTop: '4rem', background: 'var(--panel)' }}>
        <div className="eyebrow">DATABASE VIEW</div>
        <h3 className="display">Community Node Analysis</h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          marginTop: '2.5rem'
        }}>
          {organizations.map((org, idx) => (
            <div
              key={org.id}
              className="reveal delay-1"
              style={{
                border: '3px solid var(--ink)',
                padding: '2rem',
                background: 'var(--bg)',
                position: 'relative',
                transition: 'all 0.4s var(--ease)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = `10px 10px 0 ${org.color}`}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{
                position: 'absolute', top: '-15px', left: '20px',
                background: org.color, color: 'var(--bg)', 
                padding: '2px 10px', fontSize: '0.7rem', fontWeight: '900'
              }}>
                NODE_0{idx + 1}
              </div>
              <h4 style={{ fontSize: '1.3rem', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{org.name}</h4>
              <p style={{ fontSize: '0.95rem', lineHeight: '1.5', opacity: 0.85, marginBottom: '1.2rem' }}>
                {org.description}
              </p>
              <div style={{ 
                fontFamily: 'monospace', fontSize: '0.75rem', 
                padding: '0.5rem', background: 'rgba(255,255,255,0.05)',
                borderLeft: `3px solid ${org.color}`
              }}>
                CORE_IMPACT: {org.impact.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />

      {/* Page Specific Animations */}
      <style>{`
        @keyframes floatMap {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes glitchText {
          0%, 90%, 100% { transform: translate(0); }
          91% { transform: translate(-3px, 2px); }
          93% { transform: translate(3px, -1px); }
          95% { transform: translate(-2px, -3px); }
        }
        @keyframes slideRight {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
