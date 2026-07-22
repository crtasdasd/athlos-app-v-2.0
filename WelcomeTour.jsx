import React from "react";
import SlideDeck from "../components/SlideDeck";

// Shown once after the athlete's first login — a quick tour of the app: what it
// does and where everything lives. Dismissed → never shown again on this device
// (per account).
//
// Each slide's eyebrow names the real tab the copy is about, so the structure
// tells you where in the app you'd go rather than just counting slides. One
// accent colour throughout (the brand green) — the per-slide tints this used to
// carry read as decoration and diluted the palette.
const SLIDES = [
  {
    eyebrow: "Today",
    title: "Welcome to ATHLOS", accentWord: "ATHLOS",
    desc: "Your day starts here. Do the morning check-in, get your readiness score, and the app tells you how hard to go.",
  },
  {
    eyebrow: "Calendar",
    title: "Plan your season",
    desc: "Trainings, matches and recovery in one place. The weekly load chart shows how much you've planned.",
  },
  {
    eyebrow: "Zeus",
    title: "Your AI coach",
    desc: "Tap the ATHLOS mark any time. Zeus knows your sport, your goals and your data — ask it for trainings, meals or advice.",
  },
  {
    eyebrow: "Community",
    title: "Join your club",
    desc: "Search your club or your coach's username and join. You get the club chat, and your coach sees your readiness.",
  },
  {
    eyebrow: "Profile",
    title: "Make it yours",
    desc: "Your stats, photo, plan and settings live here. That's it — let's train.",
  },
];

export default function WelcomeTour({ onDone }) {
  return <SlideDeck slides={SLIDES} onDone={onDone} backdrop="/img/working11.jpeg" doneLabel="Let's go" />;
}
