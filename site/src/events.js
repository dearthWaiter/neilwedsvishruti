// Screens 3 to 6: the four event cards. All copy is final (Section 6): verbatim.

const RAMA = "https://www.google.com/maps/search/?api=1&query=Hotel+Rama+Continental+29+Tashkent+Marg+Civil+Lines+Prayagraj";
const ITC = "https://www.google.com/maps/search/?api=1&query=Welcomhotel+by+ITC+Hotels+16+Tashkent+Marg+Civil+Lines+Prayagraj";

const rama = { venue: "Hotel Rama Continental", address: "29, Tashkent Marg, Civil Lines, Prayagraj", link: RAMA };

export const EVENTS = {
  s3: {
    plate: "s3_plate", couple: "s3_couple", variant: "light", accent: "haldi",
    title: "Haldi &amp; Mehendi",
    theme: "The School Playground",
    story: "Turmeric, henna, and all the mischief we never grew out of.",
    wear: "Pastel yellows and pinks",
    date: "Friday, 20 November 2026", time: "1:00 pm onwards", ...rama,
    icons: ["s3_boardgame", "s3_science", "s3_bottle_dumbbell", "s3_dog", "s3_tattoo"],
    sprites: "t1_petal",
  },
  s4: {
    plate: "s4_plate", couple: "s4_couple", variant: "dark", accent: "sangeet",
    title: "Sangeet &amp; Cocktails",
    theme: "The Prom We Never Had",
    story: "Our school never threw a prom. So we're throwing one, for all of us.",
    wear: "Blues, blacks and shimmer. Gowns, suits and sarees.",
    date: "Friday, 20 November 2026", time: "8:00 pm onwards", ...rama,
    icons: ["s4_wine_cheese", "s4_gown", "s4_srilanka", "s4_guitar", "s4_mushrooms"],
    topShade: true, meteors: true, lights: "s4",
  },
  s5: {
    plate: "s5_plate", couple: "s5_couple", variant: "light", accent: "wedding",
    title: "The Wedding",
    theme: "Temple Mornings",
    story: "Many temples, many prayers, and now, one more ritual. Together.",
    wear: "Reds, marigolds and golds",
    date: "Saturday, 21 November 2026", time: "12 noon onwards",
    venue: "Welcomhotel by ITC Hotels", address: "16, Tashkent Marg, Civil Lines, Prayagraj", link: ITC,
    icons: ["s5_temple", "s5_saibaba", "s5_bhog", "s5_gate", "s5_havan"],
    kalava: 4, // the thread wraps a kalava as it passes the havan kund
    sprites: "t2_marigold", diyas: "s5",
  },
  s6: {
    plate: "s6_plate", couple: "s6_couple", variant: "dark", accent: "reception",
    title: "Reception &amp; Dinner",
    theme: "A Mehfil Evening",
    story: "An evening of ghazals, old friends and older stories, with everyone who raised us.",
    wear: "Jewel tones: emeralds, sapphires and rubies",
    date: "Saturday, 21 November 2026", time: "7:30 pm onwards", ...rama,
    icons: ["s6_clocktower", "s6_bangalore", "s6_balcony", "s6_pondicherry"],
    lights: "s6",
  },
};
