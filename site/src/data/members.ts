import type { ImageMetadata } from "astro";
import bryanProfile from "../assets/members/bryan-profile.jpg";
import brettProfile from "../assets/members/brett-profile.jpg";
import bernardProfile from "../assets/members/bernard-profile.jpg";
import braydenProfile from "../assets/members/brayden-profile.jpg";
import taylorProfile from "../assets/members/taylor-profile.jpg";
import joProfile from "../assets/members/jo-profile.jpg";

export interface Member {
  slug: string;
  name: string;
  role?: string;
  profile: ImageMetadata;
  bio: string[];
}

export const members: Member[] = [
  {
    slug: "bryan-legrow",
    name: "Bryan LeGrow",
    role: "Musical Director, Occasional Beer Confiscator",
    profile: bryanProfile,
    bio: [
      "Every group needs someone to tell them when to shut up and actually work, and Bryan tells us to put down our beers and sing with such grace and civility that the Dalai Lama would be jealous.",
      "Of course, just being a pretty face and patient isn’t enough to make it into 6 Minute Warning. Bryan’s incredible vocal range crosses the entire spectrum – we’re talking a double rainbow here – with a beautiful low end to make you weep, and a delicate high end that is the cherry on top of any good a cappella cake.  Or cupcake. Or donut. Can you put cherries on donuts? I bet Bryan could cajole them into working together.",
      "With his incredible arrangements, razor-sharp musical insights, and his “do it all” vocal stylings, we are over the moon to have Bryan singing and leading us as our musical director.",
    ],
  },
  {
    slug: "brett-ludwig",
    name: "Brett Ludwig",
    role: "Care Bear Stare",
    profile: brettProfile,
    bio: [
      "The sound of Brett singing is like a Care Bear stare blasting you right in the face. You may be laughing now, but you’ll be fighting back the tears when he rips your heart out with the fragile sensitivity of his voice. You’ve been warned.",
      "His empathetic nature has given him a rare natural stage presence that helps him connect to his audience, but his palette is even more diverse than that. Brett also likes to kick things up a notch and blow people’s minds with a killer beat. That’s right. This sensitive soul is also 6 Minute Warning’s resident beat-boxer and can be more action-packed than a Michael Bay film. Put that in your pipe and smoke it!",
      "Brett’s musical ability is born of strong passion, hard work, and a natural stubbornness that keeps him going. Want him to learn something new? Just tell him he can’t do it.",
    ],
  },
  {
    slug: "bernard-quilala",
    name: "Bernard Quilala",
    role: "MSU Graduate (Making Stuff Up)",
    profile: bernardProfile,
    bio: [
      "If you need a man to take center stage and own it like it’s never been owned before, Bernard is your guy. He likes being the center of attention more than Kanye & Kim at an awards show. There is no line too far for 6 Minute Warning’s favourite stage-hog, who once took his shirt off during a show just because we ran out of bow ties that day.",
      "When he’s not exposing his physique to audiences, Bernard loves to write R&B tunes that you can’t help but dance to.  Always the laugh of the party, Bernard’s Filipino instincts also force him to show up at rehearsals and events with food for everyone, which we’re pretty sure we’ll need to add an extra day at the gym to compensate for.",
      "Bernard’s formal vocal training comes from singing in the shower and the prestigious MSU – Making Stuff Up.  With a voice that makes you melt (whichever way you swing), Bernard’s screaming high power vocals are an unforgettable addition to 6 Minute Warning’s vocal palette.",
    ],
  },
  {
    slug: "brayden-foo",
    name: "Brayden Foo",
    role: "Boy Band Vibes",
    profile: braydenProfile,
    bio: [
      "The newest member of 6 Minute Warning has an incredible voice, buttery smooth melismas, and a smile that makes the ladies swoon. Brayden is also the baby of the group, and misses most of the references the rest of us make. While the rest of us remember N’Sync & Backstreet Boys, Brayden’s nostalgic memories are from watching The Wiggles.",
      "Ever the millennial, Brayden runs our social media and his own YouTube channel, doing fantastic covers of songs on guitar and his trusty loop pedal. Actually, you might wonder why he even needs us when he can just do a cappella numbers by himself with just a loop pedal. We’re pretty sure he could just clone himself and go on a world tour, but he says he likes “talking to real live people” and that cloning is “pretty impractical”.",
      "We’re absolutely thrilled to have our Brayden singing with us, and can’t wait for his next video!",
    ],
  },
  {
    slug: "taylor-fawcett",
    name: "Taylor Fawcett",
    role: "Fawcett of Positive Energy",
    profile: taylorProfile,
    bio: [
      "Taylor is a faucet of positive energy, personality, & screaming high rock power. Classically trained as a tenor, he’s as comfortable on opera stages as he is singing pop ballads. And when he’s not singing, he’s slappin’ the bass in any style you please.",
      "All of this incredible talent comes with a cost. His voice is so explosive that 9 out of 10 ear doctors recommend limiting exposure to his voice to 1 show a day so you don’t risk hearing damage. After a few tours on the road, we can confirm that his default setting is LOUD. However, his voice is so incredible we’re happy to lose our hearing to have him in the band.",
    ],
  },
  {
    slug: "jo-tong",
    name: "Jo Tong",
    role: "Really, Really, Really Loves Singing",
    profile: joProfile,
    bio: [
      "Legend says that the night Jo’s voice changed, fire burned in the skies and the earth stood still in silent respect. He can sing notes so low that he’s legally not allowed within ten miles of any fault line.",
      "Jo loves to sing. He really, really, really loves it. He sings in so many choirs in Edmonton that when he calls in sick they just cancel all the concerts that week and pack it in.",
      "We love how much Jo loves to sing, and how much he loves to dance, and we couldn’t be happier having him lay down the foundation for 6 Minute Warning’s signature sound.",
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
