import React from "react";
import Footer from "../components/Footer";
 
export default function ReferencePage() {
  return (
    <div className="page reference">
 
      <header className="page-head slice-reveal reveal">
        <h2 className="xxl skew reveal">REFERENCE INDEX</h2>
        <p className="kicker reveal">sources — citations — documentation</p>
      </header>
 
      <section className="reference-grid">
        <article className="slab block-pop reveal">
          <div className="eyebrow reveal">PRIMARY COMMUNITY RESOURCES</div>
          <h3 className="display reveal">Organizations Featured in the Archive</h3>
          <p className="lead" style={{ marginBottom: "1.25rem" }}>
            These are real Coppell-area organizations that ground the
            fictionalized stories, map pins, and timeline beats in actual
            community work.
          </p>
 
          <ul className="reveal">
            <li>
              <a href="https://coppellfarmersmarket.org/" target="_blank" rel="noopener noreferrer">
                Coppell Farmers Market
              </a>{" "}
              — weekly farmers market showcasing local growers and small food businesses.
            </li>
 
            <li>
              <a href="https://www.notelove.org/" target="_blank" rel="noopener noreferrer">
                NoteLove
              </a>{" "}
              — youth-led nonprofit offering free music lessons.
            </li>
 
            <li>
              <a href="https://metrocrestservices.org/" target="_blank" rel="noopener noreferrer">
                Metrocrest Services
              </a>{" "}
              — community assistance including food, housing, and senior support.
            </li>
 
            <li>
              <a href="https://www.instagram.com/neighbors_in_need_/" target="_blank" rel="noopener noreferrer">
                Neighbors In Need
              </a>{" "}
              — mutual aid group coordinating support for local families.
            </li>
          </ul>
        </article>
 
        <article className="slab ghost block-pop reveal">
          <div className="eyebrow reveal">METHODOLOGY</div>
          <h3 className="display reveal">How the Archive Uses These Resources</h3>
 
          <p className="lead reveal">
            Coppell Farmers Market, NoteLove, Metrocrest Services, and Neighbors In Need
            shaped how we built the site’s map, visual themes, and storyline.
            The organizations illustrate how food security, arts, mutual aid, and
            wraparound support intersect in real community life.
          </p>
 
          <p className="lead reveal" style={{ marginTop: "0.75rem" }}>
            TSA judges can follow the links to explore how real organizations influenced the
            site's creative and informational structure.
          </p>
        </article>
      </section>
 
      <section className="slab block-pop reveal">
        <div className="eyebrow reveal">TECH STACK</div>
        <h3 className="display reveal">How This Archive Was Built</h3>
 
        <p className="lead reveal">
          The project uses React (Vite), modern CSS animations, SVG maps, canvas effects,
          and mobile-focused responsive design to create a brutalist digital archive.
        </p>
 
        <ul style={{ marginTop: "1rem" }} className="reveal">
          <li>React components for modular storytelling</li>
          <li>Canvas-based hero animation for dynamic visuals</li>
          <li>Custom SVG map using real Coppell boundary shapes</li>
          <li>Mobile-first layout to support TSA judging screens</li>
        </ul>
      </section>
 
      <section className="slab block-pop reveal">
        <div className="eyebrow reveal">IMAGE CREDITS</div>
        <h3 className="display reveal">Sources for All Photos Used on the Site</h3>
 
        <ul className="reveal">
          <li>
            <strong>Coppell Farmers Market Photo</strong> — from{" "}
            <a href="https://coppellfarmersmarket.org/" target="_blank" rel="noopener noreferrer">
              coppellfarmersmarket.org
            </a>{" "}
            (public-facing promotional imagery)
          </li>
 
          <li>
            <strong>NoteLove Photo</strong> — from{" "}
            <a href="https://www.notelove.org/" target="_blank" rel="noopener noreferrer">
              notelove.org
            </a>{" "}
            (official nonprofit website)
          </li>
 
          <li>
            <strong>Metrocrest Services Photo</strong> — from{" "}
            <a href="https://metrocrestservices.org/" target="_blank" rel="noopener noreferrer">
              metrocrestservices.org
            </a>
          </li>
 
          <li>
            <strong>Neighbors In Need Logo / Photo</strong> — from{" "}
            <a
              href="https://www.instagram.com/neighbors_in_need_/"
              target="_blank"
              rel="noopener noreferrer"
            >
              the official Instagram page @neighbors_in_need_
            </a>{" "}
            (public profile content)
          </li>
 
          <li>
            <strong>Historical Downtown Coppell Photo</strong> — sourced from
            the public-domain collection, archived at:
            <a
              href="https://www.coppelltx.gov/610/History-of-Coppell"
              target="_blank"
              rel="noopener noreferrer"
            >
              Coppell History Website
            </a>
          </li>
 
          <li>
            <strong>Coppell Boundary Map Image</strong> — created using Google Maps styling
            (fair use for educational project).
          </li>

          

          <li>
            <strong>Early Coppell Settlement Records (1840–1900)</strong> — archival references from the
            City of Coppell public history documentation (fair use for educational research).
          </li>

          <li>
            <strong>Coppell Historical Society Timeline Notes</strong> — used to contextualize the eras shown
            in the TIMELINE page (non-commercial educational citation).
          </li>

          <li>
            <strong>DFW Regional Development Maps (1950–1990)</strong> — sourced from publicly available
            planning archives to inform the Growth & Identity era (fair use).
          </li>
        </ul>

        
        <p className="lead reveal" style={{ marginTop: "1rem" }}>
          All images and references are used for nonprofit, educational, student-competition purposes, 
         and were obtained with permission to use their likeness. No commercial redistribution is intended.
        </p>
      </section>
 
      <Footer />
    </div>
  );
}
