import React from "react";
import { ArrowUpRight } from "lucide-react";
import { communityImages } from "../data/communityAssets";
import Footer from "../components/Footer";

export default function HomePage({ setCurrentPage }) {
  const heroCards = [
    { img: communityImages.farmers, label: "Market mornings" },
    { img: communityImages.notelove, label: "Youth music" },
    { img: communityImages.metrocrest, label: "Care network" },
    { img: communityImages.neighbors, label: "Mutual aid" },
    { img: communityImages.history, label: "Local memory" },
  ];

  const stats = [
    { num: "100+", label: "Stories gathered" },
    { num: "10K+", label: "Neighbors connected" },
    { num: "4", label: "Anchor orgs featured" },
  ];

  const people = [
    {
      tag: "Market Volunteer",
      title: "Saturday Regular",
      desc: "A resident who knows the rhythm of every stall and every hello.",
    },
    {
      tag: "Youth Leader",
      title: "NoteLove Mentor",
      desc: "A student musician turning practice into access for younger learners.",
    },
    {
      tag: "Neighbor In Action",
      title: "Metrocrest Advocate",
      desc: "Helping families find food, housing support, and stability.",
    },
    {
      tag: "Mutual Aid Organizer",
      title: "Neighbors In Need",
      desc: "Coordinating rides, groceries, and support across the city.",
    },
  ];

  const orgs = [
    {
      name: "Coppell Farmers Market",
      img: communityImages.farmers,
      link: "https://coppellfarmersmarket.org/",
      desc: "Local growers, artisans, and Saturday morning rituals.",
    },
    {
      name: "NoteLove",
      img: communityImages.notelove,
      link: "https://www.notelove.org/",
      desc: "Youth-led music lessons that make the arts easier to reach.",
    },
    {
      name: "Metrocrest Services",
      img: communityImages.metrocrest,
      link: "https://metrocrestservices.org/",
      desc: "Food, housing, senior care, and practical stability.",
    },
    {
      name: "Neighbors In Need",
      img: communityImages.neighbors,
      link: "https://www.instagram.com/neighbors_in_need_/",
      desc: "Mutual aid, rides, groceries, and direct neighbor support.",
    },
  ];

  return (
    <>
      <div className="home page-enter page-enter-active">
        <section className="editorial-hero reveal">
          <div className="hero-copy">
            <div className="hero-badge">Coppell Community Files</div>
            <h1 className="hero-title">
              WHAT&apos;S HERE
              <span>IN COPPELL</span>
            </h1>
            <p className="hero-kicker">
              A living archive of the people, places, and organizations that
              keep the city connected.
            </p>
            <div className="hero-cta reveal delay-1">
              <button className="btn primary" onClick={() => setCurrentPage("timeline")}>
                Explore timeline <ArrowUpRight size={18} />
              </button>
              <button className="btn secondary" onClick={() => setCurrentPage("map")}>
                Open map
              </button>
              <button className="btn ghost" onClick={() => setCurrentPage("mission")}>
                Why we exist
              </button>
            </div>
          </div>

          <div className="hero-card-fan" aria-label="Featured archive images">
            {heroCards.map((card, index) => (
              <figure className={`fan-card fan-card-${index + 1}`} key={card.label}>
                <img src={card.img} alt={card.label} />
                <figcaption>{card.label}</figcaption>
              </figure>
            ))}
          </div>

          <aside className="next-file">
            <span>Next file</span>
            <strong>Community Map</strong>
            <small>4 anchor organizations</small>
          </aside>
        </section>

        <section className="stat-grid">
          {stats.map((stat, index) => (
            <div key={stat.label} className={`stat-card reveal delay-${index + 1}`}>
              <div className="stat-num">{stat.num}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="split-cta">
          <button className="split-card reveal delay-1" onClick={() => setCurrentPage("timeline")}>
            <span className="eyebrow">01 / Timeline</span>
            <h3>Interactive civic eras</h3>
            <p>Move through eras of growth, art, service, and mutual aid in Coppell.</p>
            <strong>Open timeline</strong>
          </button>
          <button className="split-card reveal delay-2" onClick={() => setCurrentPage("map")}>
            <span className="eyebrow">02 / Map</span>
            <h3>Community node map</h3>
            <p>Trace how anchor organizations connect people, care, and culture.</p>
            <strong>Open map</strong>
          </button>
        </section>

        <section className="editorial-section people-section reveal">
          <div className="section-heading">
            <span className="eyebrow">The people of Coppell</span>
            <h2>Why we are a community</h2>
            <p>
              Coppell is more than streets and buildings. The archive follows
              the daily care work that turns a city into a network.
            </p>
          </div>

          <div className="people-grid">
            {people.map((person, index) => (
              <article key={person.title} className={`people-card reveal delay-${index + 1}`}>
                <div className="people-tag">{person.tag}</div>
                <h3>{person.title}</h3>
                <p>{person.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="editorial-section reveal">
          <div className="section-heading">
            <span className="eyebrow">Community resources</span>
            <h2>Anchor organizations in Coppell</h2>
            <p>Real community partners, presented as living records.</p>
          </div>

          <div className="spotlight-grid">
            {orgs.map((org, index) => (
              <a
                key={org.name}
                href={org.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`spotlight-card reveal delay-${index + 1}`}
              >
                <img src={org.img} className="spotlight-img" alt={org.name} />
                <div className="spotlight-body">
                  <h3>{org.name}</h3>
                  <p>{org.desc}</p>
                  <span>Visit resource</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
