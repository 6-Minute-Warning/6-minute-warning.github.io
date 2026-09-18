import type { ImageMetadata } from "astro";
import bryanSuit from "../assets/members/bryan-suit.jpg";
import bryanCasual from "../assets/members/bryan-casual.jpg";
import brettSuit from "../assets/members/brett-suit.jpg";
import brettCasual from "../assets/members/brett-casual.jpg";
import bernardSuit from "../assets/members/bernard-suit.jpg";
import bernardCasual from "../assets/members/bernard-casual.jpg";
import braydenSuit from "../assets/members/brayden-suit.jpg";
import braydenCasual from "../assets/members/brayden-casual.jpg";
import taylorSuit from "../assets/members/taylor-suit.jpg";
import taylorCasual from "../assets/members/taylor-casual.jpg";
import joSuit from "../assets/members/jo-suit.jpg";
import joCasual from "../assets/members/jo-casual.jpg";

export interface Member {
  slug: string;
  name: string;
  role?: string;
  suit: ImageMetadata;
  casual: ImageMetadata;
  bio: string[];
}

export const members: Member[] = [
  {
    slug: "bryan-legrow",
    name: "Bryan LeGrow",
    role: "Musical director",
    suit: bryanSuit,
    casual: bryanCasual,
    bio: [
      "Every group needs someone to tell them when to shut up and work, and Bryan tells us to put down our beers and sing with such grace and civility that the Dalai Lama would be jealous.",
      "Of course, being pretty and patient isn’t enough to make it into 6 Minute Warning. Bryan’s vocal range crosses the entire spectrum, with a beautiful low end to make you weep and a delicate high end that is the cherry on top of any good a cappella cake.",
      "With his arrangements, razor-sharp musical insights, and his “do it all” vocal stylings, we are over the moon to have Bryan singing and leading us as our musical director.",
    ],
  },
  {
    slug: "brett-ludwig",
    name: "Brett Ludwig",
    role: "Vocal percussion",
    suit: brettSuit,
    casual: brettCasual,
    bio: [
      "The sound of Brett singing is like a Care Bear stare blasting you right in the face. You may be laughing now, but you’ll be fighting back the tears when he rips your heart out with the fragile sensitivity of his voice. You’ve been warned.",
      "Brett also likes to kick things up a notch with a killer beat. This sensitive soul is 6 Minute Warning’s resident beatboxer and can be more action-packed than a Michael Bay film.",
      "His musical ability is born of passion, hard work and a natural stubbornness. Want him to learn something new? Tell him he can’t do it.",
    ],
  },
  {
    slug: "bernard-quilala",
    name: "Bernard Quilala",
    suit: bernardSuit,
    casual: bernardCasual,
    bio: [
      "If you need a man to take centre stage and own it like it’s never been owned before, Bernard is your guy. There is no line too far for 6 Minute Warning’s favourite stage-hog, who once took his shirt off during a show because we ran out of bow ties that day.",
      "When he’s not exposing his physique to audiences, Bernard writes R&B tunes you can’t help but dance to. He also shows up to rehearsals with food for everyone, which means an extra day at the gym for the rest of us.",
      "His formal vocal training comes from singing in the shower and the prestigious MSU: Making Stuff Up. His screaming high power vocals are an unforgettable part of our sound.",
    ],
  },
  {
    slug: "brayden-foo",
    name: "Brayden Foo",
    suit: braydenSuit,
    casual: braydenCasual,
    bio: [
      "Brayden has an incredible voice, buttery smooth melismas and a smile that stops traffic. He’s also the baby of the group and misses most of our references: while the rest of us remember NSYNC and the Backstreet Boys, Brayden’s nostalgia is The Wiggles.",
      "Ever the millennial, Brayden runs our social media and his own YouTube channel of covers on guitar and loop pedal. We’re pretty sure he could clone himself and tour solo, but he says he likes “talking to real live people” and that cloning is “pretty impractical”.",
    ],
  },
  {
    slug: "taylor-fawcett",
    name: "Taylor Fawcett",
    role: "Tenor",
    suit: taylorSuit,
    casual: taylorCasual,
    bio: [
      "Taylor is a faucet of positive energy, personality and screaming high rock power. Classically trained as a tenor, he’s as at home on opera stages as he is singing pop ballads. When he’s not singing, he’s slappin’ the bass in any style you please.",
      "All of this talent comes at a cost. His voice is so explosive that 9 out of 10 ear doctors recommend limiting exposure to one show a day. After a few tours on the road, we can confirm his default setting is LOUD, and we’re happy to lose our hearing to have him in the band.",
    ],
  },
  {
    slug: "jo-tong",
    name: "Jo Tong",
    role: "Bass",
    suit: joSuit,
    casual: joCasual,
    bio: [
      "Legend says that the night Jo’s voice changed, fire burned in the skies and the earth stood still in silent respect. He can sing notes so low that he’s legally not allowed within ten miles of any fault line.",
      "Jo loves to sing. He sings in so many choirs in Edmonton that when he calls in sick they cancel all the concerts that week. We couldn’t be happier having him lay down the foundation for 6 Minute Warning’s sound.",
    ],
  },
];

export const alumni = [
  "Andrew Malcolm",
  "Caleb Nelson",
  "Kyle Carter",
  "Luc Tellier",
  "Nathan Willis",
  "Sean Sonego",
  "Tim Noel",
  "Tyler Smith",
  "Tyson Kerr",
];
