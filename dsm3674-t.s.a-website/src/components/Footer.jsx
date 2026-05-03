import React from "react";
import { Mail, MapPin, Instagram, Facebook, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="pro-footer">
      <div className="pro-footer-inner">

        {/* SECTION 1 — ABOUT */}
        <div className="pro-footer-col fade-in-up">
          <h3 className="pro-footer-title">Our Mission</h3>
          <p className="pro-footer-text">
            Created by Coppell High School students for the 2025 TSA Webmaster Competition.
            We aim to highlight Coppell’s community, culture, local organizations, and history through an 
            interactive and educational digital archive.
          </p>
        </div>

        {/* SECTION 2 — FEATURED */}
        <div className="pro-footer-col fade-in-up delay-1">
          <h3 className="pro-footer-title">Featured Groups</h3>
          <ul className="pro-footer-links">
            <li><a href="#">Coppell Farmers Market</a></li>
            <li><a href="#">NoteLove</a></li>
            <li><a href="#">Metrocrest Services</a></li>
            <li><a href="#">Neighbors In Need</a></li>
          </ul>
        </div>

        {/* SECTION 3 — CONTACT */}
        <div className="pro-footer-col fade-in-up delay-2">
          <h3 className="pro-footer-title">Contact Us</h3>
          <p className="pro-footer-text">
            Coppell, TX — Student Webmaster Team
          </p>

          <p className="footer-contact">
            <Mail size={16} /> 
            <a href="mailto:coppellwebteam@gmail.com">coppellwebteam@gmail.com</a>
          </p>

          <div className="footer-social">
            <Instagram size={20} />
            <Facebook size={20} />
            <Twitter size={20} />
          </div>
        </div>

      </div>

      <div className="pro-footer-bottom">
        © 2025 Coppell Community Archive — Built for TSA
      </div>
    </footer>
  );
}
