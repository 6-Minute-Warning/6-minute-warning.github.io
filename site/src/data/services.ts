import type { ImageMetadata } from "astro";
import groupStudio from "../assets/photos/group-studio.jpg";
import groupSeated from "../assets/photos/group-studio-seated.jpg";
import threeMics from "../assets/photos/three-mics.jpg";
import outdoorMic from "../assets/photos/outdoor-mic.jpg";
import liveOutdoor from "../assets/photos/live-outdoor.jpg";
import groupPortrait from "../assets/photos/group-portrait.jpg";
import groupBw from "../assets/photos/group-bw-mics.jpg";

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
  presenters?: string[];
}

const anthemFaq: Faq = {
  q: "Can you sing O Canada?",
  a: "Yes. We open banquets, galas and conferences with a six-part arrangement of the anthem.",
};

const sharedFaqs: Faq[] = [
  {
    q: "How much stage space do you need?",
    a: "Room for 6 people to stand side by side. No risers, no drum kit, no amps. If a speaker fits on your stage, we fit too.",
  },
  {
    q: "What does your AV team need to do?",
    a: "Less than a band would ask for. Tell us what the venue has and we plan around it. Our tech rider goes out once the date is confirmed.",
  },
  {
    q: "What kind of music do you sing?",
    a: "Pop and R&B, from Boyz II Men and Take 6 to the songs on the radio this year, all arranged for 6 voices and nothing else.",
  },
  {
    q: "Do you travel outside Edmonton?",
    a: "We are based in Edmonton. Tell us where your event is when you get in touch and we will let you know.",
  },
];

export const services: Service[] = [
  {
    slug: "concert-series",
    nav: "Concert series",
    eventType: "Concert series or presenter",
    title: "A Cappella Touring Show for Concert Series & Arts Councils | 6 Minute Warning",
    description:
      "6 Minute Warning tours a full evening a cappella show for concert series, arts councils and theatres in Alberta, British Columbia and Saskatchewan. Pop and R&B for 6 voices, easy to host.",
    h1: "A touring a cappella show for concert series and arts councils",
    intro:
      "A full evening of pop and R&B for 6 voices, built for theatres, concert series and arts councils. We toured it across Alberta and into British Columbia in 2026, and we bring it to the Organization of Saskatchewan Arts Councils (OSAC) showcase this fall.",
    hero: groupStudio,
    heroPosition: "center 6%",
    photo: threeMics,
    points: [
      {
        title: "A full evening",
        body: "Two sets with an intermission: tight harmonies, beatbox and the spontaneity our shows are known for.",
      },
      {
        title: "Easy to host",
        body: "6 singers, a small stage footprint and a short tech list. Your crew will have an easy night.",
      },
      {
        title: "Tour ready",
        body: "We tour Alberta, British Columbia and Saskatchewan. Tell us about presenters near you and we can plan a route.",
      },
      {
        title: "Presenter materials",
        body: "Bio, press photos, videos and logos are in our press kit. The tech rider goes out once the date is confirmed.",
      },
    ],
    steps: [
      "Send us your season dates and venue.",
      "We confirm availability, fee and routing, and send the rider and press materials.",
      "We arrive, check sound, and put on the show.",
    ],
    faqs: [
      {
        q: "How long is the show?",
        a: "Two sets of about 50 minutes with an intermission.",
      },
      {
        q: "Do you tour outside Alberta?",
        a: "Yes. We toured British Columbia in 2026, including Terrace and Kitimat, and we are showcasing at OSAC in Saskatchewan in October 2026.",
      },
      {
        q: "Can you add a school workshop to a tour date?",
        a: "Ask us when you get in touch.",
      },
      {
        q: "Where do we get promo materials?",
        a: "Our press kit has a bio, highlights, press photos, logos and videos, free to use when promoting a 6 Minute Warning show.",
      },
    ],
    presenters: [
      "Horizon Stage Performing Arts Centre",
      "Terrace Concert Society",
      "Lloydminster Concert Series Association",
      "Newell Concert Association",
      "Wainwright Encore",
      "Stettler Performing Arts Centre",
      "Eleanor Pickup Arts Centre",
      "DaysArts",
      "Chautauqua Edson Arts Council",
      "Vermilion Allied Arts Council",
    ],
  },
  {
    slug: "awards-ceremony-music",
    nav: "Awards ceremonies",
    eventType: "Awards gala",
    title: "Awards Ceremony Music & Gala Entertainment in Edmonton | 6 Minute Warning",
    description:
      "Live music for awards ceremonies and galas in Edmonton and across Alberta. 6 singers in black suits, on and off stage in seconds between presentations, with almost no tech setup.",
    h1: "Awards ceremony music that keeps the show moving",
    intro:
      "Awards nights run on a tight clock. 6 Minute Warning walks on between categories, sings, and walks off before the next envelope is open. No band to reset, no stage changeover, no dead air.",
    hero: groupStudio,
    heroPosition: "center 6%",
    photo: threeMics,
    points: [
      {
        title: "On and off in seconds",
        body: "6 people and a handful of microphones. We can open the night, fill the gap between awards, and close it out without a single crew change.",
      },
      {
        title: "Dressed for the gala",
        body: "Matching black suits and blue ties. We look like we belong at the gala because we dress for it.",
      },
      {
        title: "A small footprint",
        body: "We need a strip of stage the width of 6 people. The podium, the screens and the trophy table all stay where they are.",
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
      "Conferences, launches, staff parties and client receptions all have the same problem: a band needs a stage, a crew and an hour of setup. We need a spot to stand. 6 voices, pop and R&B, and a changeover measured in seconds.",
    hero: groupSeated,
    heroPosition: "center 18%",
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
      "A cappella holiday music for Edmonton Christmas parties, office parties and seasonal events. Classic carols and pop holiday hits sung by 6 voices in suits, with no band setup.",
    h1: "Christmas party music in six-part harmony",
    intro:
      "Christmas classics and pop holiday hits, sung by 6 voices and nothing else. We fit into a boardroom, a ballroom or the corner of a restaurant, and we can move from room to room between sets.",
    hero: threeMics,
    heroPosition: "center 6%",
    photo: groupStudio,
    points: [
      {
        title: "Carols to pop hits",
        body: "Classic carols for the traditionalists and holiday pop for everyone else, arranged for voices only.",
      },
      {
        title: "Fits any room",
        body: "Office party, ballroom or restaurant. If 6 people can stand there, we can sing there.",
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
    slug: "wedding-music",
    nav: "Weddings",
    eventType: "Wedding",
    title: "Wedding Music in Edmonton | A Cappella Wedding Singers | 6 Minute Warning",
    description:
      "A cappella wedding music in Edmonton and across Alberta. 6 singers in black suits for your ceremony, signing, cocktail hour or reception, with no band gear to set up.",
    h1: "Wedding music in six-part harmony",
    intro:
      "6 voices for the moments you want to remember: walking down the aisle, signing the register, cocktails on the patio, or the first song of the reception. No amps, no drum kit, nothing to hide behind the flowers.",
    hero: groupPortrait,
    heroPosition: "center 12%",
    photo: groupSeated,
    points: [
      {
        title: "Pick your moments",
        body: "Ceremony, signing, cocktail hour or reception. Book us for one moment or several.",
      },
      {
        title: "Fits the venue",
        body: "Chapel, ballroom, barn or backyard. We need room for 6 people to stand, and that is all.",
      },
      {
        title: "Dressed for the day",
        body: "Black suits and blue ties. We fit into the photos without anyone asking us to change.",
      },
      {
        title: "Songs you both know",
        body: "Pop and R&B love songs arranged for voices only. We have sung for a wedding party before, including Jamie Salé and Craig Simpson's.",
      },
    ],
    steps: [
      "Send us the date, the venue and the moments you want music for.",
      "We talk through songs and timing with you or your planner.",
      "On the day we arrive dressed and ready, and follow your coordinator's cues.",
    ],
    faqs: [
      {
        q: "Can you sing our first dance or processional song?",
        a: "Ask us. Tell us the song when you get in touch and we will let you know.",
      },
      ...sharedFaqs,
    ],
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
      "Main stages, patio series, park stages and community halls. We bring a high-energy set that works for every age in the audience.",
    hero: liveOutdoor,
    heroPosition: "center 12%",
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
  {
    slug: "school-workshops",
    nav: "School workshops",
    eventType: "School workshop",
    title: "A Cappella Workshops & Residencies for Schools in Alberta | 6 Minute Warning",
    description:
      "One- and two-day a cappella workshops and residencies for school choirs, bands and music classes in Alberta, ending in a concert where students perform with 6 Minute Warning.",
    h1: "A cappella workshops for school choirs and bands",
    intro:
      "Students learn from and perform with a professional vocal group. Workshops run one or two days, follow the Alberta music curriculum, and end with a concert where your students share the stage with 6 Minute Warning.",
    hero: groupBw,
    heroPosition: "center 20%",
    photo: liveOutdoor,
    points: [
      {
        title: "Choirs, bands and classes",
        body: "General music residencies for music classes, and focused residencies for choir and band programs.",
      },
      {
        title: "Arrangements for your group",
        body: "We pick pieces to suit the age, size and voice types or instruments in your group, and send sheet music and demo recordings ahead of time.",
      },
      {
        title: "A concert to finish",
        body: "Your students perform their own repertoire, we perform ours, and everyone finishes on stage together. Ticket sales go to the school.",
      },
      {
        title: "Help with funding",
        body: "Alberta schools can apply for arts-in-education grants to cover part of a residency. We help partner schools with the application.",
      },
    ],
    steps: [
      "Tell us about your school, your group and the dates you have in mind.",
      "We plan the schedule and choose collaborative pieces with your lead teacher, then send sheet music and demo recordings.",
      "We run the workshops with your students and put on the concert together.",
    ],
    faqs: [
      {
        q: "What ages do you work with?",
        a: "Students of all ages and abilities. We choose arrangements to fit the age, size and voice types of your group.",
      },
      {
        q: "Do you work with bands as well as choirs?",
        a: "Yes. We run residencies for choirs, bands and general music classes.",
      },
      {
        q: "How long is a residency?",
        a: "One or two days of workshops, followed by an evening concert at the school or a local hall.",
      },
      {
        q: "Who books the concert venue?",
        a: "The concert can be at the school or a community hall. The school books the venue and keeps the ticket sales.",
      },
    ],
  },
];
