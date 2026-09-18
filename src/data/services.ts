import type { ImageMetadata } from "astro";
import groupStudio from "../assets/photos/group-studio.jpg";
import groupSeated from "../assets/photos/group-studio-seated.jpg";
import threeMics from "../assets/photos/three-mics.jpg";
import outdoorMic from "../assets/photos/outdoor-mic.jpg";
import liveOutdoor from "../assets/photos/live-outdoor.jpg";
import walking from "../assets/photos/walking.jpg";

export interface Faq {
  q: string;
  a: string;
}

export interface Service {
  slug: string;
  nav: string;
  eventType: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  hero: ImageMetadata;
  heroPosition?: string;
  photo: ImageMetadata;
  points: { title: string; body: string }[];
  steps: string[];
  faqs: Faq[];
}

const anthemFaq: Faq = {
  q: "Can you sing O Canada?",
  a: "Yes. We open banquets, galas and conferences with a six-part arrangement of the anthem.",
};

const sharedFaqs: Faq[] = [
  {
    q: "How much stage space do you need?",
    a: "Room for six people to stand side by side. No risers, no drum kit, no amps. If a speaker fits on your stage, we fit too.",
  },
  {
    q: "What does your AV team need to do?",
    a: "Very little. Tell us what the venue has and we plan around it. We send a one-page tech rider once the date is confirmed.",
  },
  {
    q: "What kind of music do you sing?",
    a: "Pop and R&B, from Boyz II Men and Take 6 to the songs on the radio this year, all arranged for six voices and nothing else.",
  },
  {
    q: "Do you travel outside Edmonton?",
    a: "Yes. We are based in Edmonton and have performed across Alberta, from Cold Lake to Wainwright to Markerville.",
  },
];

export const services: Service[] = [
  {
    slug: "awards-ceremony-music",
    nav: "Awards ceremonies",
    eventType: "Awards gala",
    title: "Awards Ceremony Music & Gala Entertainment in Edmonton | 6 Minute Warning",
    description:
      "Live music for awards ceremonies and galas in Edmonton and across Alberta. Six singers in black suits, on and off stage in seconds between presentations, with almost no tech setup.",
    h1: "Awards ceremony music that keeps the show moving",
    intro:
      "Awards nights run on a tight clock. 6 Minute Warning walks on between categories, sings, and walks off before the next envelope is open. No band to reset, no stage changeover, no dead air.",
    hero: groupStudio,
    photo: threeMics,
    points: [
      {
        title: "On and off in seconds",
        body: "Six people and a handful of microphones. We can open the night, fill the gap between awards, and close it out without a single crew change.",
      },
      {
        title: "Dressed for the gala",
        body: "Matching black suits and blue ties. We look like we belong at the gala because we dress for it.",
      },
      {
        title: "A small footprint",
        body: "We need a strip of stage the width of six people. The podium, the screens and the trophy table all stay where they are.",
      },
      {
        title: "Songs the room knows",
        body: "Pop and R&B hits arranged for voices only. Guests who came for the awards stay for the music.",
      },
    ],
    steps: [
      "Tell us your run of show and where you want music.",
      "We build sets to fit: a walk-on opener, short bridges between categories, a closing number.",
      "On the night we arrive dressed and ready, check sound, and follow your stage manager's cues.",
    ],
    faqs: [
      {
        q: "Can you perform between award presentations?",
        a: "That is what we are built for. With no instruments to set up, we can walk on as the presenter walks off and be gone before the next category is announced.",
      },
      anthemFaq,
      ...sharedFaqs,
    ],
  },
  {
    slug: "corporate-party-music",
    nav: "Corporate parties",
    eventType: "Corporate event",
    title: "Corporate Party Music & Event Entertainment in Edmonton | 6 Minute Warning",
    description:
      "Live music for corporate parties in Edmonton. Book 6 Minute Warning, a six-voice a cappella group, for staff parties, conferences, company parties, product launches and client receptions. Low tech, small stage, fast changeovers.",
    h1: "Corporate party music with nothing to load in",
    intro:
      "Conferences, launches, staff parties and client receptions all have the same problem: a band needs a stage, a crew and an hour of setup. We need a spot to stand. Six voices, pop and R&B, and a changeover measured in seconds.",
    hero: groupSeated,
    photo: outdoorMic,
    points: [
      {
        title: "Fits your agenda",
        body: "Open the keynote, reset the room after lunch, or play the reception. Short sets drop into a packed schedule without moving anything else.",
      },
      {
        title: "Low tech, low stress",
        body: "No drum kit, no amps, no backline. Your AV team has one less thing to worry about.",
      },
      {
        title: "Polished on stage",
        body: "Black suits, blue ties, tight harmonies. We look sharp in front of your clients and sound it too.",
      },
      {
        title: "Fun in the room",
        body: "Our shows are loose and funny. We get people singing along, and nobody needs to be told to put their phone down.",
      },
    ],
    steps: [
      "Send us the date, venue and the part of the day you want music for.",
      "We suggest a set length and song list that fits the room and the audience.",
      "We arrive ready, check sound, perform, and get out of the way.",
    ],
    faqs: [anthemFaq, ...sharedFaqs],
  },
  {
    slug: "christmas-party-music",
    nav: "Christmas parties",
    eventType: "Holiday party",
    title: "Christmas Party Music & Holiday Entertainment in Edmonton | 6 Minute Warning",
    description:
      "A cappella holiday music for Edmonton Christmas parties, office parties and seasonal events. Classic carols and pop holiday hits sung by six voices in suits, with no band setup.",
    h1: "Christmas party music in six-part harmony",
    intro:
      "Christmas classics and pop holiday hits, sung by six voices and nothing else. We fit into a boardroom, a ballroom or the corner of a restaurant, and we can move from room to room between sets.",
    hero: walking,
    heroPosition: "center 40%",
    photo: groupStudio,
    points: [
      {
        title: "Carols to pop hits",
        body: "Classic carols for the traditionalists and holiday pop for everyone else, arranged for voices only.",
      },
      {
        title: "Fits any room",
        body: "Office party, ballroom or restaurant. If six people can stand there, we can sing there.",
      },
      {
        title: "Book early",
        body: "December weekends go first. Ask about your date now, even if the details are not final.",
      },
    ],
    steps: [
      "Tell us the date, the venue and roughly how many guests.",
      "We put together a holiday set that suits your crowd.",
      "We show up dressed for the occasion and bring the cheer.",
    ],
    faqs: sharedFaqs,
  },
  {
    slug: "festival-entertainment",
    nav: "Festivals",
    eventType: "Festival or community event",
    title: "A Cappella Group for Festivals and Community Events in Alberta | 6 Minute Warning",
    description:
      "6 Minute Warning has played the Kaleido Festival main stage, the Festival Place Patio Series and community stages across Alberta. High-energy a cappella pop and R&B for outdoor and indoor events.",
    h1: "Festival and community entertainment that draws a crowd",
    intro:
      "From the Kaleido Festival main stage to the Festival Place Patio Series to a library stage in Beaumont, we bring a high-energy set that works for every age in the audience.",
    hero: liveOutdoor,
    photo: outdoorMic,
    points: [
      {
        title: "Works outdoors",
        body: "Patios, beaches and park stages. Our sound carries without a wall of speakers behind it.",
      },
      {
        title: "Easy to programme",
        body: "Quick changeovers make us an easy fit between other acts on a festival stage.",
      },
      {
        title: "All ages",
        body: "Kids love the beatbox, grandparents know the harmonies, and everyone in between sings along.",
      },
    ],
    steps: [
      "Send the date, stage and slot length.",
      "We confirm tech needs with your stage manager.",
      "We play, we meet the crowd, we clear the stage for the next act.",
    ],
    faqs: sharedFaqs,
  },
];
